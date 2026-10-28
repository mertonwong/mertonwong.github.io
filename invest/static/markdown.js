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
    let listType = null; // 'ul' | 'ol'
    let para = [];

    function flushPara() {
      if (!para.length) return;
      out.push("<p>" + inline(para.join(" ")) + "</p>");
      para = [];
    }
    function flushList() {
      if (!listType) return;
      out.push(listType === "ol" ? "</ol>" : "</ul>");
      listType = null;
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
        let html = "<table><thead><tr>";
        headers.forEach((h) => {
          html += "<th>" + inline(h) + "</th>";
        });
        html += "</tr></thead><tbody>";
        rows.forEach((row) => {
          html += "<tr>";
          row.forEach((c) => {
            html += "<td>" + inline(c) + "</td>";
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
        out.push("<blockquote><p>" + inline(buf.join(" ")) + "</p></blockquote>");
        continue;
      }

      const ulm = /^[-*+]\s+(.+)$/.exec(line);
      if (ulm) {
        flushPara();
        if (listType !== "ul") {
          flushList();
          listType = "ul";
          out.push("<ul>");
        }
        out.push("<li>" + inline(ulm[1]) + "</li>");
        i++;
        continue;
      }

      const olm = /^\d+\.\s+(.+)$/.exec(line);
      if (olm) {
        flushPara();
        if (listType !== "ol") {
          flushList();
          listType = "ol";
          out.push("<ol>");
        }
        out.push("<li>" + inline(olm[1]) + "</li>");
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
      para.push(line.trim());
      i++;
    }

    flushPara();
    flushList();
    if (inCode) flushCode();
    return out.join("\n");
  }

  global.renderMarkdown = renderMarkdown;
})(typeof window !== "undefined" ? window : globalThis);
