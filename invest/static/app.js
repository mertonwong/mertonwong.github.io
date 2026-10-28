(function () {
  const main = document.getElementById("main");
  const genAt = document.getElementById("gen-at");
  const refreshBtn = document.getElementById("refresh-btn");

  // 用户给定默认顺序：原测试标的 + 新增 24 只
  const DEFAULT_ORDER = [
    "BTC",
    "INTC",
    "GOOG",
    "TSM",
    "ASML",
    "NVDA",
    "AVGO",
    "000660.KS",
    "MU",
    "SNDK",
    "LITE",
    "COHR",
    "PLTR",
    "APP",
    "MSFT",
    "SNPS",
    "VRT",
    "GLW",
    "APH",
    "ARM",
    "ANET",
    "NBIS",
    "MRVL",
    "QCOM",
    "TSLA",
    "CRCL",
    "HOOD",
  ];
  const ORDER_KEY = "invest-watch-card-order";

  function loadSavedOrder() {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return null;
      return arr.map(String);
    } catch {
      return null;
    }
  }

  function saveOrder(tickers) {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(tickers));
    } catch {
      /* ignore quota */
    }
    fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
    }).catch(() => {});
  }

  function sortTickers(tickers) {
    const saved = loadSavedOrder();
    const base = saved && saved.length ? saved : DEFAULT_ORDER;
    const rank = new Map(base.map((t, i) => [String(t).toUpperCase(), i]));
    return tickers.slice().sort((a, b) => {
      const ta = String(a.ticker || "").toUpperCase();
      const tb = String(b.ticker || "").toUpperCase();
      const ia = rank.has(ta) ? rank.get(ta) : 10000;
      const ib = rank.has(tb) ? rank.get(tb) : 10000;
      if (ia !== ib) return ia - ib;
      return ta.localeCompare(tb);
    });
  }

  function fmtMoney(n, ticker) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return String(n);
    const isKrw = String(ticker || "").toUpperCase().endsWith(".KS");
    const prefix = isKrw ? "₩" : "$";
    if (Math.abs(x) >= 1000) {
      return (
        prefix +
        x.toLocaleString("en-US", { maximumFractionDigits: x >= 10000 ? 0 : 2 })
      );
    }
    return (
      prefix +
      x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }



  function fmtBigMoney(n, currency) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    const abs = Math.abs(x);
    const sign = x < 0 ? "-" : "";
    const cur = String(currency || "USD").toUpperCase();
    const sym =
      cur === "USD"
        ? "$"
        : cur === "HKD"
          ? "HK$"
          : cur === "KRW"
            ? "₩"
            : cur === "CNY" || cur === "RMB"
              ? "¥"
              : cur === "EUR"
                ? "€"
                : cur + " ";
    // Chinese 亿 = 1e8; 万亿 = 1e12
    if (abs >= 1e12) return sign + sym + (abs / 1e12).toFixed(2) + "万亿";
    if (abs >= 1e8) return sign + sym + (abs / 1e8).toFixed(1) + "亿";
    if (abs >= 1e6) return sign + sym + (abs / 1e6).toFixed(1) + "M";
    return (
      sign +
      sym +
      abs.toLocaleString("en-US", { maximumFractionDigits: 0 })
    );
  }

  function fmtRatioX(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    if (!Number.isFinite(x)) return "—";
    if (x < 0) return "负";
    return x.toFixed(1) + "x";
  }

  function fmtPctRatio(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    // stored as fraction (0.25 = 25%)
    const pct = x * 100;
    const abs = Math.abs(pct);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
    return pct.toFixed(digits) + "%";
  }

  function renderFundamentals(f) {
    if (!f || f.skipped === "crypto") {
      return "";
    }
    if (!f.present) {
      return (
        '<section class="panel fundamentals-panel"><h2>基本面</h2>' +
        '<div class="empty">暂无基本面缓存（可运行 scripts/fetch_fundamentals.py）</div></section>'
      );
    }
    const cur = f.currency || "USD";
    const finCur =
      f.currency_mismatch && f.financial_currency
        ? f.financial_currency
        : cur;
    const cells = [
      ["市值", fmtBigMoney(f.market_cap, cur)],
      ["Forward P/E", fmtRatioX(f.forward_pe)],
      ["市销率 PS", fmtRatioX(f.ps)],
      ["FCF Yield", fmtPctRatio(f.fcf_yield)],
      ["毛利率", fmtPctRatio(f.gross_margin)],
      ["营业利润率", fmtPctRatio(f.op_margin)],
      ["净利率", fmtPctRatio(f.net_margin)],
      ["ROE", fmtPctRatio(f.roe)],
      ["ROIC", fmtPctRatio(f.roic)],
      ["现金", fmtBigMoney(f.cash, finCur)],
      ["负债", fmtBigMoney(f.debt, finCur)],
    ];
    let grid = '<div class="fundamentals-grid">';
    for (const [label, value] of cells) {
      grid +=
        '<div class="fund-cell"><div class="fund-label">' +
        escapeText(label) +
        '</div><div class="fund-value">' +
        escapeText(value) +
        "</div></div>";
    }
    grid += "</div>";
    const asOf =
      f.price_derived_as_of || f.fundamentals_as_of || f.as_of || "";
    const sticky = f.fundamentals_as_of || f.as_of || "";
    let foot = '<div class="fundamentals-foot">';
    if (asOf) {
      foot += "数据截至 " + escapeText(fmtTime(asOf));
      if (sticky && sticky !== asOf) {
        foot += " · 财报字段 " + escapeText(fmtDateTimeShort(sticky));
      }
      if (f.source) foot += " · " + escapeText(String(f.source));
      if (f.currency_mismatch) {
        foot +=
          " · 报表币种 " +
          escapeText(String(f.financial_currency || "")) +
          " 与报价不同，PS/FCF Yield 暂缺";
      }
    } else {
      foot += "数据来源：Yahoo Finance";
    }
    foot += "</div>";
    return (
      '<section class="panel fundamentals-panel"><h2>基本面</h2>' +
      grid +
      foot +
      "</section>"
    );
  }

  function fmtTokenAmt(n, unit) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    const abs = Math.abs(x);
    let body;
    if (abs >= 1e8) body = (x / 1e8).toFixed(2) + "亿";
    else if (abs >= 1e4) body = (x / 1e4).toFixed(abs >= 1e7 ? 0 : 1) + "万";
    else body = x.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return body + (unit ? " " + unit : "");
  }

  function fmtShortDate(iso) {
    if (!iso) return "—";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso);
    return Number(m[2]) + "/" + Number(m[3]);
  }

  function renderCryptoMetrics(c, ticker) {
    if (!c || !c.present) return "";
    const unit = ticker || "";
    const px =
      c.price == null
        ? "—"
        : "$" + Number(c.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pxChg =
      c.chg_24h_pct == null ? "" : " (" + (c.chg_24h_pct >= 0 ? "+" : "") + Number(c.chg_24h_pct).toFixed(1) + "%)";
    const sub = (main, extra) => (extra ? main + '<div class="fund-sub">' + escapeText(extra) + "</div>" : main);
    const cells = [
      ["价格", escapeText(px + pxChg)],
      ["流通市值", escapeText(fmtBigMoney(c.market_cap_circ, "USD"))],
      ["FDV", escapeText(fmtBigMoney(c.fdv, "USD"))],
      [
        "24h 永续成交量",
        sub(
          escapeText(fmtBigMoney(c.perp_vol_24h, "USD")),
          c.hip3_vol_share != null ? "HIP-3 占 " + fmtPctRatio(c.hip3_vol_share) : ""
        ),
      ],
      ["30日成交量", escapeText(fmtBigMoney(c.perp_vol_30d, "USD"))],
      [
        "未平仓 OI",
        sub(
          escapeText(fmtBigMoney(c.open_interest, "USD")),
          c.open_interest_hip3 != null ? "HIP-3 " + fmtBigMoney(c.open_interest_hip3, "USD") : ""
        ),
      ],
      ["30日手续费", escapeText(fmtBigMoney(c.fees_30d, "USD"))],
      [
        "年化收入",
        sub(
          escapeText(fmtBigMoney(c.revenue_annualized, "USD")),
          c.p_rev_circ != null ? "流通口径 " + fmtRatioX(c.p_rev_circ) : ""
        ),
      ],
      [
        "援助基金持仓",
        sub(
          escapeText(fmtTokenAmt(c.af_hype, unit)),
          c.af_value_usd != null ? "≈ " + fmtBigMoney(c.af_value_usd, "USD") : ""
        ),
      ],
      [
        "30日回购",
        sub(
          escapeText(fmtTokenAmt(c.af_buy_30d_hype, unit)),
          c.af_buy_30d_usd != null ? "≈ " + fmtBigMoney(c.af_buy_30d_usd, "USD") : ""
        ),
      ],
      [
        "回购收益率",
        sub(
          escapeText(fmtPctRatio(c.buyback_yield_circ)),
          c.buyback_yield_fdv != null ? "FDV 口径 " + fmtPctRatio(c.buyback_yield_fdv) : ""
        ),
      ],
      [
        "下次解锁",
        sub(
          escapeText(fmtShortDate(c.next_unlock_date)),
          c.last_unlock_actual && c.last_unlock_actual.amount != null
            ? "上次实发 " + fmtTokenAmt(c.last_unlock_actual.amount, "")
            : ""
        ),
      ],
      ["月度解锁上限", escapeText(fmtTokenAmt(c.unlock_monthly_cap, unit))],
      [
        "质押率",
        sub(
          escapeText(fmtPctRatio(c.stake_ratio)),
          c.staked_hype != null ? fmtTokenAmt(c.staked_hype, unit) : ""
        ),
      ],
    ];
    let grid = '<div class="fundamentals-grid">';
    for (const [label, valueHtml] of cells) {
      grid +=
        '<div class="fund-cell"><div class="fund-label">' +
        escapeText(label) +
        '</div><div class="fund-value">' +
        valueHtml +
        "</div></div>";
    }
    grid += "</div>";
    let foot = '<div class="fundamentals-foot">';
    if (c.as_of) foot += "数据截至 " + escapeText(fmtTime(c.as_of));
    if (c.source) foot += " · " + escapeText(String(c.source));
    foot += " · 每日更新";
    if (c.af_buy_30d_method) foot += " · 回购：" + escapeText(String(c.af_buy_30d_method));
    if (Array.isArray(c.stale_fields) && c.stale_fields.length) {
      foot += " · 部分字段沿用上次数据";
    }
    foot += "</div>";
    return (
      '<section class="panel fundamentals-panel crypto-metrics-panel"><h2>链上指标</h2>' +
      grid +
      foot +
      "</section>"
    );
  }

  function fmtTargetDisplay(t) {
    const ticker = t.ticker;
    if (t.dual_target && t.target_a != null && t.target_b != null) {
      // two lines so homepage cards stay narrow
      return (
        '<div class="target-ab">' +
        '<div class="target-line"><span class="ab-tag">A</span> ' +
        fmtMoney(t.target_a, ticker) +
        "</div>" +
        '<div class="target-line"><span class="ab-tag">B</span> ' +
        fmtMoney(t.target_b, ticker) +
        "</div></div>"
      );
    }
    const single = t.target_buy != null ? t.target_buy : t.target_a != null ? t.target_a : t.target_b;
    return fmtMoney(single, ticker);
  }

  function targetBlockClass(t) {
    // ≤A 绿底；仅 ≤B 绿边；单轨触及时绿底
    if (t.below_a) return " below-a";
    if (t.below_b) return " below-b";
    if (t.below_target) return " below-a";
    return "";
  }

  function fmtTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return (
        d.toLocaleString("zh-CN", {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }) + " PT"
      );
    } catch {
      return iso;
    }
  }

  function fmtDateTimeShort(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return (
        d.toLocaleString("zh-CN", {
          timeZone: "America/Los_Angeles",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }) + " PT"
      );
    } catch {
      return iso;
    }
  }

  async function api(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText || "请求失败");
    }
    return res.json();
  }

  function setActiveNav(route) {
    document.querySelectorAll(".nav-link").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  }

  function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const parts = hash.split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "ticker" && parts[1]) return { name: "ticker", sym: parts[1].toUpperCase() };
    if (parts[0] === "logs") return { name: "logs", id: parts[1] || null };
    return { name: "home" };
  }

  async function render() {
    const r = route();
    main.innerHTML = '<div class="loading">加载中…</div>';
    try {
      if (r.name === "home") {
        setActiveNav("home");
        await renderHome();
      } else if (r.name === "ticker") {
        setActiveNav("home");
        await renderTicker(r.sym);
      } else if (r.name === "logs") {
        setActiveNav("logs");
        await renderLogs(r.id);
      }
    } catch (e) {
      main.innerHTML = '<div class="error">加载失败：' + escapeText(e.message) + "</div>";
    }
  }

  function escapeText(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function bindCardDrag(grid) {
    let dragEl = null;
    let didDrag = false;

    grid.querySelectorAll(".ticker-card").forEach((card) => {
      card.setAttribute("draggable", "true");

      card.addEventListener("dragstart", (e) => {
        dragEl = card;
        didDrag = false;
        card.classList.add("dragging");
        grid.classList.add("reordering");
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", card.dataset.ticker || "");
        } catch {
          /* ignore */
        }
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        grid.classList.remove("reordering");
        grid.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
        if (didDrag) {
          const order = [...grid.querySelectorAll(".ticker-card")].map((el) => el.dataset.ticker);
          saveOrder(order);
        }
        // prevent accidental navigation after a drag
        if (didDrag) {
          const block = (ev) => {
            ev.preventDefault();
            card.removeEventListener("click", block, true);
          };
          card.addEventListener("click", block, true);
          setTimeout(() => card.removeEventListener("click", block, true), 0);
        }
        dragEl = null;
        didDrag = false;
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!dragEl || dragEl === card) return;
        didDrag = true;
        const rect = card.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        card.classList.add("drag-over");
        if (before) {
          grid.insertBefore(dragEl, card);
        } else {
          grid.insertBefore(dragEl, card.nextSibling);
        }
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over");
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("drag-over");
        didDrag = true;
      });
    });
  }


  function logoHtml(t, cls) {
    const url = t && t.logo_url;
    const sym = (t && t.ticker) || "";
    const initials = String(sym)
      .replace(/\.[A-Z]{2}$/i, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?";
    const fallback =
      '<span class="ticker-logo fallback" aria-hidden="true">' +
      escapeText(initials) +
      "</span>";
    if (!url) return fallback;
    return (
      '<img class="ticker-logo' +
      (cls ? " " + cls : "") +
      '" src="' +
      escapeText(url) +
      '" alt="" loading="lazy" decoding="async" onerror="this.classList.add(\'broken\');this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ticker-logo fallback\',textContent:\'' +
      escapeText(initials).replace(/'/g, "") +
      '\'}))" />'
    );
  }

  async function renderHome() {
    const data = await api("/api/overview");
    if (genAt) genAt.textContent = "更新于 " + fmtTime(data.generated_at);

    let html = "";
    const summary = data.daily_summary;
    if (summary && summary.present && summary.markdown) {
      html +=
        '<section class="attr-strip summary-strip" aria-label="今日总结">' +
        "<h2>今日总结 · " +
        escapeText(summary.date) +
        "</h2>" +
        '<div class="md-body">' +
        renderMarkdown(summary.markdown) +
        "</div></section>";
    }

    const pc = data.private_credit;
    if (pc && pc.present) {
      const sev = pc.severity || "watch";
      const phase = pc.phase_zh || "";
      let bullets = "";
      if (Array.isArray(pc.bullets) && pc.bullets.length) {
        bullets =
          "<ul class=\"pc-bullets\">" +
          pc.bullets
            .map((b) => "<li>" + escapeText(String(b)) + "</li>")
            .join("") +
          "</ul>";
      }
      let metrics = "";
      if (Array.isArray(pc.display_metrics) && pc.display_metrics.length) {
        metrics =
          '<div class="pc-metrics">' +
          pc.display_metrics
            .map((m) => {
              const hint = m.hint_zh
                ? '<div class="pc-m-hint">' + escapeText(m.hint_zh) + "</div>"
                : "";
              return (
                '<div class="pc-m">' +
                '<div class="pc-m-label">' +
                escapeText(m.label_zh || "") +
                "</div>" +
                '<div class="pc-m-val">' +
                escapeText(m.value || "") +
                "</div>" +
                hint +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }
      html +=
        '<section class="pc-strip sev-' +
        escapeText(sev) +
        '" aria-label="私募信贷">' +
        "<h2>" +
        escapeText(pc.title_zh || "私募信贷") +
        (phase
          ? ' <span class="pc-phase">' + escapeText(phase) + "</span>"
          : "") +
        "</h2>" +
        '<p class="pc-summary">' +
        escapeText(pc.summary_zh || "") +
        "</p>" +
        metrics +
        bullets +
        (pc.as_of
          ? '<div class="pc-meta">更新 ' + escapeText(fmtTime(pc.as_of)) + "</div>"
          : "") +
        "</section>";
    }


    const bub = data.ai_bubble;
    if (bub && bub.present) {
      const sev = bub.severity || "watch";
      const phase = bub.phase_zh || bub.verdict_label || "";
      let bullets = "";
      if (Array.isArray(bub.bullets) && bub.bullets.length) {
        bullets =
          '<ul class="pc-bullets">' +
          bub.bullets
            .map((b) => "<li>" + escapeText(String(b)) + "</li>")
            .join("") +
          "</ul>";
      }
      let metrics = "";
      if (Array.isArray(bub.display_metrics) && bub.display_metrics.length) {
        metrics =
          '<div class="pc-metrics">' +
          bub.display_metrics
            .map((m) => {
              const hint = m.hint_zh
                ? '<div class="pc-m-hint">' + escapeText(m.hint_zh) + "</div>"
                : "";
              return (
                '<div class="pc-m">' +
                '<div class="pc-m-label">' +
                escapeText(m.label_zh || "") +
                "</div>" +
                '<div class="pc-m-val">' +
                escapeText(m.value || "") +
                "</div>" +
                hint +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }
      const src = bub.source_url
        ? ' · <a class="pc-src" href="' +
          escapeText(bub.source_url) +
          '" target="_blank" rel="noopener">来源</a>'
        : "";
      const issue =
        bub.issue_number != null
          ? "Issue " + escapeText(String(bub.issue_number))
          : "";
      const bubTitle = escapeText(bub.title_zh || "AI 泡沫监测");
      const bubTitleHtml = bub.source_url
        ? '<a class="pc-title-link" href="' +
          escapeText(bub.source_url) +
          '" target="_blank" rel="noopener">' +
          bubTitle +
          "</a>"
        : bubTitle;
      html +=
        '<section class="pc-strip bubble-strip sev-' +
        escapeText(sev) +
        '" aria-label="AI泡沫监测">' +
        "<h2>" +
        bubTitleHtml +
        (phase
          ? ' <span class="pc-phase">' + escapeText(phase) + "</span>"
          : "") +
        "</h2>" +
        '<p class="pc-summary">' +
        escapeText(bub.summary_zh || "") +
        "</p>" +
        metrics +
        bullets +
        '<div class="pc-meta">' +
        (issue ? issue + " · " : "") +
        (bub.source_as_of
          ? "对方 as_of " + escapeText(String(bub.source_as_of)) + " · "
          : "") +
        (bub.as_of ? "我方更新 " + escapeText(fmtTime(bub.as_of)) : "") +
        src +
        "</div></section>";
    }


    const kim = data.kimpremium;
    if (kim && kim.present) {
      const sev = kim.severity || "watch";
      const phase = kim.phase_zh || kim.verdict_label || "";
      let bullets = "";
      if (Array.isArray(kim.bullets) && kim.bullets.length) {
        bullets =
          '<ul class="pc-bullets">' +
          kim.bullets
            .map((b) => "<li>" + escapeText(String(b)) + "</li>")
            .join("") +
          "</ul>";
      }
      let metrics = "";
      if (Array.isArray(kim.display_metrics) && kim.display_metrics.length) {
        metrics =
          '<div class="pc-metrics">' +
          kim.display_metrics
            .map((m) => {
              const hint = m.hint_zh
                ? '<div class="pc-m-hint">' + escapeText(m.hint_zh) + "</div>"
                : "";
              return (
                '<div class="pc-m">' +
                '<div class="pc-m-label">' +
                escapeText(m.label_zh || "") +
                "</div>" +
                '<div class="pc-m-val">' +
                escapeText(m.value || "") +
                "</div>" +
                hint +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }
      const src = kim.source_url
        ? ' · <a class="pc-src" href="' +
          escapeText(kim.source_url) +
          '" target="_blank" rel="noopener">来源</a>'
        : "";
      const kimTitle = escapeText(kim.title_zh || "韩股杠杆监控");
      const kimTitleHtml = kim.source_url
        ? '<a class="pc-title-link" href="' +
          escapeText(kim.source_url) +
          '" target="_blank" rel="noopener">' +
          kimTitle +
          "</a>"
        : kimTitle;
      html +=
        '<section class="pc-strip kim-strip sev-' +
        escapeText(sev) +
        '" aria-label="韩股杠杆监控">' +
        "<h2>" +
        kimTitleHtml +
        (phase
          ? ' <span class="pc-phase">' + escapeText(phase) + "</span>"
          : "") +
        "</h2>" +
        '<p class="pc-summary">' +
        escapeText(kim.summary_zh || "") +
        "</p>" +
        metrics +
        bullets +
        '<div class="pc-meta">' +
        (kim.source_as_of
          ? "对方 asof " + escapeText(String(kim.source_as_of)) + " · "
          : "") +
        (kim.source_generated
          ? "生成 " + escapeText(String(kim.source_generated)) + " BJ · "
          : "") +
        (kim.as_of ? "我方更新 " + escapeText(fmtTime(kim.as_of)) : "") +
        src +
        "</div></section>";
    }


    html +=
      '<div class="section-head"><h1>观察列表</h1><span class="meta">' +
      data.count +
      ' 个标的 · <span class="drag-hint">可拖动卡片排序</span></span></div>';

    if (!data.tickers.length) {
      html += '<div class="empty">暂无观察标的。请在 /workspace/invest/watchlist/ 添加 JSON。</div>';
      main.innerHTML = html;
      return;
    }

    const tickers = sortTickers(data.tickers);

    html += '<div class="ticker-grid">';
    for (const t of tickers) {
      const hit = !!(t.below_b || t.below_a || t.below_target);
      const hitA = !!t.below_a;
      const verdict = t.latest_verdict || "暂无最新结论";
      const badgeExtra = hitA ? " · 价值区" : hit ? " · 周期买区" : "";
      html +=
        '<a class="ticker-card' +
        (hit ? " hit" : "") +
        '" href="#/ticker/' +
        encodeURIComponent(t.ticker) +
        '" data-link draggable="true" data-ticker="' +
        escapeText(t.ticker) +
        '">' +
        '<div class="card-top">' +
        '<div class="sym-row">' +
        logoHtml(t) +
        '<div class="sym-text"><div class="sym">' +
        escapeText(t.ticker) +
        '</div><div class="sym-name">' +
        escapeText(t.name || "") +
        "</div></div></div>" +
        '<span class="badge ' +
        escapeText(String(t.status || "watch").toLowerCase()) +
        (hit ? " hit-badge" : "") +
        '">' +
        escapeText(t.status_label || t.status || "观察中") +
        badgeExtra +
        "</span></div>" +
        '<div class="price-row">' +
        '<div class="price-block">' +
        '<div class="price-label">最新价</div>' +
        '<div class="price">' +
        fmtMoney(t.last_price, t.ticker) +
        "</div></div>" +
        '<div class="target-block' +
        targetBlockClass(t) +
        '">' +
        '<div class="target-label">' +
        "目标价" +
        "</div>" +
        '<div class="target-value">' +
        fmtTargetDisplay(t) +
        "</div></div>" +
        "</div>" +
        '<div class="summary">' +
        escapeText(verdict) +
        "</div>" +
        '<div class="card-foot"><span>' +
        escapeText(
          (t.asset_class || "") +
            (t.markets && t.markets.length ? " · " + t.markets.join("/") : "")
        ) +
        "</span><span>" +
        escapeText(t.last_price_at ? fmtTime(t.last_price_at) : "") +
        "</span></div></a>";
    }
    html += "</div>";
    main.innerHTML = html;
    const grid = main.querySelector(".ticker-grid");
    if (grid) bindCardDrag(grid);
  }


  function renderValuationRails(data) {
    const ticker = data.ticker;
    const a = data.target_a;
    const b = data.target_b;
    const dual = !!data.dual_target;
    const lo = data.street_pt_low;
    const hi = data.street_pt_high;
    const avg = data.street_pt_avg;
    const src = data.street_pt_source;
    const hasStreet = lo != null || hi != null || avg != null;
    if (a == null && b == null && !hasStreet) return "";

    let streetCell = "—";
    if (lo != null && hi != null) {
      streetCell = fmtMoney(lo, ticker) + " – " + fmtMoney(hi, ticker);
      if (avg != null) streetCell += "（均 " + fmtMoney(avg, ticker) + "）";
    } else if (avg != null) {
      streetCell = "均 " + fmtMoney(avg, ticker);
    } else if (lo != null) {
      streetCell = "低 " + fmtMoney(lo, ticker);
    } else if (hi != null) {
      streetCell = "高 " + fmtMoney(hi, ticker);
    }

    const aCell = a != null ? fmtMoney(a, ticker) : "—";
    const bCell = dual && b != null ? fmtMoney(b, ticker) : a != null ? "（同 A / 单轨）" : "—";

    return (
      '<div class="val-rails" aria-label="估值对照">' +
      '<div class="val-rails-title">估值对照</div>' +
      '<table class="val-rails-table"><thead><tr>' +
      "<th>独立价值 A</th><th>动量/周期 B</th><th>华尔街目标（街低–街高）</th>" +
      "</tr></thead><tbody><tr>" +
      '<td class="rail-a">' + aCell + "</td>" +
      '<td class="rail-b">' + bCell + "</td>" +
      '<td class="rail-street">' + streetCell + "</td>" +
      "</tr></tbody></table>" +
      (src
        ? '<div class="val-rails-src">街目标来源：' + escapeText(src) + "</div>"
        : "") +
      "</div>"
    );
  }

  async function renderTicker(sym) {
    const data = await api("/api/ticker/" + encodeURIComponent(sym));
    const tLike = {
      ticker: data.ticker,
      target_a: data.target_a,
      target_b: data.target_b,
      target_buy: data.target_buy,
      dual_target: data.dual_target,
      below_a: data.below_a,
      below_b: data.below_b,
      below_target: data.below_target,
    };
    let html =
      '<a class="back" href="#/" data-link>← 返回总览</a>' +
      '<section class="detail-hero">' +
      "<h1>" +
      logoHtml(data, "lg") +
      "<span>" +
      escapeText(data.ticker) +
      '</span><span class="name">' +
      escapeText(data.name || "") +
      '</span><span class="badge ' +
      escapeText(String(data.status || "").toLowerCase()) +
      '">' +
      escapeText(data.status_label || data.status || "") +
      "</span></h1>" +
      '<div class="stats">' +
      '<div class="stat"><div class="label">最新价</div><div class="value">' +
      fmtMoney(data.last_price, data.ticker) +
      "</div></div>" +
      '<div class="stat stat-target' +
      targetBlockClass(tLike).trim() +
      '"><div class="label">' +
      "目标价" +
      '</div><div class="value">' +
      fmtTargetDisplay(tLike) +
      "</div></div>" +
      "</div>";

    const verdict = data.latest_verdict || "暂无最新结论";
    html +=
      '<div class="verdict-box"><div class="verdict-label">最新结论</div><p>' +
      escapeText(verdict) +
      "</p></div>";
    html += "</section>";

    html += renderFundamentals(data.fundamentals);
    html += renderCryptoMetrics(data.crypto_metrics, data.ticker);

    html +=
      '<section class="panel"><h2>完整分析</h2>' +
      renderValuationRails(data) +
      (data.has_analysis
        ? '<div class="md-body">' + renderMarkdown(data.analysis_markdown) + "</div>"
        : '<div class="empty">暂无分析文件（analysis/' +
          escapeText(sym) +
          ".md）</div>") +
      "</section>";

    const updates = Array.isArray(data.updates) ? data.updates : [];
    html += '<section class="panel" id="changelog-panel"><h2>更新日志</h2>';
    if (updates.length) {
      html +=
        '<div class="changelog" id="changelog-list" data-page="0" data-page-size="8"></div>' +
        '<div class="changelog-pager" id="changelog-pager"></div>';
    } else {
      html += '<div class="empty">暂无更新记录。</div>';
    }
    html += "</section>";

    main.innerHTML = html;
    if (updates.length) bindChangelogPager(updates);
  }

  function renderChangelogItems(updates) {
    let html = "";
    for (const u of updates) {
      const title = u.title_zh || u.text_zh || "更新";
      const summary = u.text_zh || "";
      const hasDetail = !!(u.has_detail || u.detail_md);
      if (hasDetail) {
        html +=
          '<details class="changelog-item">' +
          '<summary class="changelog-summary-row">' +
          '<time class="changelog-ts">' +
          escapeText(fmtDateTimeShort(u.ts)) +
          "</time>" +
          '<div class="changelog-main">' +
          '<span class="changelog-title">' +
          escapeText(title) +
          "</span>" +
          (summary && summary !== title
            ? '<span class="changelog-summary">' + escapeText(summary) + "</span>"
            : "") +
          "</div>" +
          '<span class="changelog-open-hint">详情</span>' +
          "</summary>" +
          '<div class="changelog-detail md-body">' +
          renderMarkdown(u.detail_md || "") +
          "</div></details>";
      } else {
        html +=
          '<div class="changelog-item flat">' +
          '<time class="changelog-ts">' +
          escapeText(fmtDateTimeShort(u.ts)) +
          "</time>" +
          '<span class="changelog-title">' +
          escapeText(title) +
          "</span>" +
          (summary && summary !== title
            ? '<span class="changelog-summary">' + escapeText(summary) + "</span>"
            : "") +
          "</div>";
      }
    }
    return html;
  }

  function bindChangelogPager(updates) {
    const list = document.getElementById("changelog-list");
    const pager = document.getElementById("changelog-pager");
    if (!list || !pager) return;
    const pageSize = Number(list.dataset.pageSize || 8);
    const totalPages = Math.max(1, Math.ceil(updates.length / pageSize));

    function paint(page) {
      page = Math.max(0, Math.min(totalPages - 1, page));
      list.dataset.page = String(page);
      const start = page * pageSize;
      const slice = updates.slice(start, start + pageSize);
      list.innerHTML = renderChangelogItems(slice);
      if (totalPages <= 1) {
        pager.innerHTML =
          '<span class="pager-meta">共 ' + updates.length + " 条</span>";
        return;
      }
      pager.innerHTML =
        '<button type="button" class="pager-btn" data-dir="-1"' +
        (page === 0 ? " disabled" : "") +
        ">上一页</button>" +
        '<span class="pager-meta">第 ' +
        (page + 1) +
        " / " +
        totalPages +
        " 页 · 共 " +
        updates.length +
        " 条</span>" +
        '<button type="button" class="pager-btn" data-dir="1"' +
        (page >= totalPages - 1 ? " disabled" : "") +
        ">下一页</button>";
      pager.querySelectorAll(".pager-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = Number(btn.getAttribute("data-dir") || 0);
          paint(page + dir);
        });
      });
    }
    paint(0);
  }

  async function renderLogs(openId) {
    const data = await api("/api/logs");
    let html =
      '<div class="section-head"><h1>盯盘日志</h1><span class="meta">按轮询展开 · 最新在前</span></div>';

    if (!data.logs.length) {
      html += '<div class="empty">暂无日志。</div>';
      main.innerHTML = html;
      return;
    }

    html += '<div class="log-list">';
    for (const log of data.logs) {
      const open = openId && openId === log.id ? " open" : "";
      const tickers =
        log.tickers_touched && log.tickers_touched.length
          ? log.tickers_touched.join(" · ")
          : "";
      html +=
        '<details class="log-item"' +
        open +
        ' data-id="' +
        escapeText(log.id) +
        '">' +
        "<summary>" +
        '<span class="log-date">' +
        escapeText(fmtDateTimeShort(log.ts)) +
        "</span>" +
        '<span class="log-title">' +
        escapeText(log.title || "盯盘轮询") +
        "</span>" +
        (log.has_market_summary ? '<span class="log-tag">含大盘归因</span>' : "") +
        (tickers
          ? '<span class="log-tickers">' + escapeText(tickers) + "</span>"
          : "") +
        '<span class="log-preview">' +
        escapeText(log.preview || "") +
        "</span>" +
        "</summary>" +
        '<div class="log-body loading">加载中…</div>' +
        "</details>";
    }
    html += "</div>";
    main.innerHTML = html;

    main.querySelectorAll("details.log-item").forEach((el) => {
      el.addEventListener("toggle", async () => {
        if (!el.open) return;
        const body = el.querySelector(".log-body");
        if (!body || body.dataset.loaded === "1") return;
        const id = el.dataset.id;
        try {
          const detail = await api("/api/logs/entry/" + encodeURIComponent(id));
          body.classList.remove("loading");
          body.innerHTML =
            '<div class="md-body">' + renderMarkdown(detail.markdown || detail.body_zh || "") + "</div>";
          body.dataset.loaded = "1";
          history.replaceState(null, "", "#/logs/" + id);
        } catch (e) {
          body.textContent = "加载失败：" + e.message;
        }
      });
      if (el.open) el.dispatchEvent(new Event("toggle"));
    });
  }

  window.addEventListener("hashchange", render);
  refreshBtn.addEventListener("click", render);

  document.body.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-link]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (href && href.startsWith("#")) {
      // let browser handle hash
    }
  });

  render();
})();
