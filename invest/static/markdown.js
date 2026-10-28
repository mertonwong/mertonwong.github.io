/* Minimal markdown → HTML (tables, lists, code, headings, inline). */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(text) {
    let s = escapeHtml(text);
    // code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    // bold / italic
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // links
    s = s.replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    return s;
  }

  /* Split "a；- b；- c" style inline bullet runs. Only splits on " - " that follows
     CJK text/punctuation or bold/closing parens, and only when there are ≥2 such
     separators, so ordinary hyphens / ranges are left alone. */
  function splitInlineBullets(text) {
    const marked = String(text).replace(
      /([\u3000-\u303f\uff00-\uffef\u4e00-\u9fff*)\]])\s+[-•]\s+(?=\S)/g,
      "$1\u0000"
    );
    const parts = marked.split("\u0000");
    if (parts.length < 3) return [text];
    return parts.map((p) => p.trim()).filter((p, idx) => idx === 0 || p);
  }

  function isTableSep(line) {
    return /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(line) && /\|/.test(line) && /-/.test(line);
  }

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((c) => c.trim());
  }

  function renderMarkdown(md) {
    if (!md) return "";
    const lines = String(md).replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let inCode = false;
    let codeLang = "";
    let codeBuf = [];
    let listStack = []; // [{type:'ul'|'ol', indent}]
    let para = [];

    function flushPara() {
      if (!para.length) return;
      out.push("<p>" + para.map(inline).join("<br>") + "</p>");
      para = [];
    }
    function closeTag(t) {
      return t === "ol" ? "</ol>" : "</ul>";
    }
    function flushList() {
      while (listStack.length) out.push("</li>" + closeTag(listStack.pop().type));
    }
    function listItem(indent, type, text) {
      while (listStack.length && listStack[listStack.length - 1].indent > indent) {
        out.push("</li>" + closeTag(listStack.pop().type));
      }
      const top = listStack[listStack.length - 1];
      if (top && top.indent === indent && top.type === type) {
        out.push("</li>");
      } else {
        if (top && top.indent === indent) {
          out.push("</li>" + closeTag(listStack.pop().type));
        }
        listStack.push({ type, indent });
        out.push(type === "ol" ? "<ol>" : "<ul>");
      }
      out.push("<li>" + inline(text));
    }
    function flushCode() {
      out.push(
        "<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>"
      );
      codeBuf = [];
      inCode = false;
      codeLang = "";
    }

    while (i < lines.length) {
      const line = lines[i];

      if (inCode) {
        if (/^```/.test(line)) {
          flushCode();
        } else {
          codeBuf.push(line);
        }
        i++;
        continue;
      }

      if (/^```/.test(line)) {
        flushPara();
        flushList();
        inCode = true;
        codeLang = line.slice(3).trim();
        i++;
        continue;
      }

      if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
        flushPara();
        flushList();
        out.push("<hr>");
        i++;
        continue;
      }

      // table
      if (
        line.includes("|") &&
        i + 1 < lines.length &&
        isTableSep(lines[i + 1])
      ) {
        flushPara();
        flushList();
        const headers = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        // Probability columns (情景/形态 tables): keep "50%" on one line and
        // drop "(原 40%)" history suffixes — readers want the current weight.
        const probCols = headers.map((h) => /概率|权重|probab/i.test(h));
        const cleanProb = (c) => {
          // "52%（10/19 由 45%）" / "**50%**（原 40%）" → just the current weight
          const m = c.match(
            /^(\**\s*[~≈约]?\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*%\s*\**)\s*[（(].*$/
          );
          if (m) return m[1].trim();
          return c
            .replace(/\s*[（(]\s*(?:原|由|自)[^）)]*[）)]/g, "")
            .trim();
        };
        let html = "<table><thead><tr>";
        headers.forEach((h, k) => {
          html += (probCols[k] ? '<th class="col-prob">' : "<th>") + inline(h) + "</th>";
        });
        html += "</tr></thead><tbody>";
        rows.forEach((row) => {
          html += "<tr>";
          row.forEach((c, k) => {
            html += probCols[k]
              ? '<td class="col-prob">' + inline(cleanProb(c)) + "</td>"
              : "<td>" + inline(c) + "</td>";
          });
          html += "</tr>";
        });
        html += "</tbody></table>";
        out.push(html);
        continue;
      }

      const hm = /^(#{1,4})\s+(.+)$/.exec(line);
      if (hm) {
        flushPara();
        flushList();
        const level = hm[1].length;
        out.push("<h" + level + ">" + inline(hm[2]) + "</h" + level + ">");
        i++;
        continue;
      }

      const bqm = /^>\s?(.*)$/.exec(line);
      if (bqm) {
        flushPara();
        flushList();
        const buf = [bqm[1]];
        i++;
        while (i < lines.length) {
          const m2 = /^>\s?(.*)$/.exec(lines[i]);
          if (!m2) break;
          buf.push(m2[1]);
          i++;
        }
        out.push("<blockquote><p>" + buf.map(inline).join("<br>") + "</p></blockquote>");
        continue;
      }

      // lists (nested by indentation: 2+ spaces or a tab = one level deeper)
      const lm = /^([ \t]*)([-*+]|\d+[.)])\s+(.+)$/.exec(line);
      if (lm) {
        flushPara();
        const indent = lm[1].replace(/\t/g, "    ").length;
        const type = /^\d/.test(lm[2]) ? "ol" : "ul";
        const parts = splitInlineBullets(lm[3]);
        listItem(indent, type, parts[0]);
        for (let k = 1; k < parts.length; k++) listItem(indent + 2, "ul", parts[k]);
        i++;
        continue;
      }

      // indented continuation line inside a list item → line break in that item
      if (listStack.length && /^[ \t]+\S/.test(line)) {
        out.push("<br>" + inline(line.trim()));
        i++;
        continue;
      }

      if (!line.trim()) {
        flushPara();
        flushList();
        i++;
        continue;
      }

      flushList();
      {
        // "text - a - b" written on one line → paragraph + one bullet per " - " part
        const parts = splitInlineBullets(line.trim());
        if (parts.length > 1) {
          flushPara();
          if (parts[0]) para.push(parts[0]);
          flushPara();
          for (let k = 1; k < parts.length; k++) listItem(0, "ul", parts[k]);
          flushList();
        } else {
          para.push(line.trim());
        }
      }
      i++;
    }

    flushPara();
    flushList();
    if (inCode) flushCode();
    return out.join("\n");
  }

  global.renderMarkdown = renderMarkdown;
  global.renderInline = inline;
})(typeof window !== "undefined" ? window : globalThis);
