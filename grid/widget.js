(function () {

  /* ====================================================
     Splshy Grid Widget
     splshy.com/grid/widget.js

     12-video grid (2 rows × 6 cols on desktop, 2×2 paginated
     swipe on mobile). Selected positions auto-play muted when
     the grid is in the viewport; any card plays muted on hover.
     Click a card to open a viewer overlay with full controls
     (mute, scrub, captions, popout, title).

     Class prefix: sgr-
  ==================================================== */

  function initWidget(cfg) {

  cfg = cfg || {};

  // ── Host whitelist (matches the other widgets) ─────
  var ALLOWED_HOSTS = [
    "www.visitraleigh.com",
    "www.splshy.com",
    "www.getsplashy.com",
    "*.simpleviewcms.com"
  ];
  var allowedOrigins = cfg.allowedOrigins || ALLOWED_HOSTS;
  if (allowedOrigins.length) {
    var host = (window.location && window.location.hostname) || "";
    var isDev = !host || host === "localhost" || host === "127.0.0.1" || /\.local$/i.test(host);
    var allowed = allowedOrigins.some(function (o) {
      if (o === host) return true;
      if (o.charAt(0) === "*" && o.charAt(1) === ".") {
        var suffix = o.slice(1);
        return host.length > suffix.length && host.slice(-suffix.length) === suffix;
      }
      return false;
    });
    if (!isDev && !allowed) {
      try { console.warn("Splshy grid: host '" + host + "' not allowed."); } catch (e) {}
      return;
    }
  }

  var reels       = cfg.reels       || [];
  var containerId = cfg.containerId || "splshy-grid";
  // Autoplay-eligible positions (0-indexed). Default = reels 1, 4, 8,
  // 12 (1-indexed). Only ONE of these plays at a time as part of an
  // auto-advance chain: when the current chain card's video ends, the
  // next eligible card starts. cfg.autoplayIndices is honored for
  // future tuning.
  var autoplayIndices = Array.isArray(cfg.autoplayIndices)
    ? cfg.autoplayIndices
    : [0, 3, 7, 11];
  var autoplayMap = {};
  autoplayIndices.forEach(function (i) { autoplayMap[i] = true; });

  // ── Analytics (mirrors infinite/widget.js) ─────────
  var clientId      = cfg.clientId || "";
  var analyticsOn   = (cfg.analytics !== false) && !!clientId;
  var analyticsUrl  = cfg.analyticsEndpoint || "https://www.getsplashy.com/api/play/events";
  var _trackQueue   = [];
  var _trackTimer   = null;
  function trackFlush() {
    if (!_trackQueue.length) return;
    var batch = _trackQueue.splice(0, _trackQueue.length);
    var payload = JSON.stringify({ clientId: clientId, events: batch });
    try {
      var blob = new Blob([payload], { type: "text/plain" });
      if (navigator.sendBeacon && navigator.sendBeacon(analyticsUrl, blob)) return;
    } catch (e) {}
    try { fetch(analyticsUrl, { method: "POST", body: payload, keepalive: true }); } catch (e) {}
  }
  if (analyticsOn && !window.SPLSHY_PAGE_SESSION) {
    window.SPLSHY_PAGE_SESSION = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  var pageSession = analyticsOn ? window.SPLSHY_PAGE_SESSION : "";
  var pageUrl = "";
  try {
    var loc = window.location;
    var u = loc.origin + loc.pathname;
    if (u && u.length <= 200) pageUrl = u;
  } catch (e) {}
  var svid = (typeof cfg.savedWidgetId === "string") ? cfg.savedWidgetId : "";
  function reelIdFor(url) {
    if (!url) return "";
    var h = 5381;
    for (var i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function trackPlay(reelId) {
    if (!analyticsOn || !reelId) return;
    var ev = { type: "play", widgetId: containerId, reelId: reelId, pageSession: pageSession, ts: Date.now() };
    if (pageUrl) ev.pageUrl = pageUrl;
    if (svid)    ev.svid    = svid;
    _trackQueue.push(ev);
    if (_trackTimer) clearTimeout(_trackTimer);
    _trackTimer = setTimeout(trackFlush, 5000);
  }
  function trackWatch(reelId, seconds) {
    if (!analyticsOn || !reelId) return;
    var secs = Math.round(seconds);
    if (!isFinite(secs) || secs <= 0 || secs > 21600) return;
    _trackQueue.push({ type: "watch", widgetId: containerId, reelId: reelId, seconds: secs, ts: Date.now() });
    if (_trackTimer) clearTimeout(_trackTimer);
    _trackTimer = setTimeout(trackFlush, 5000);
  }
  function trackImpression() {
    if (!analyticsOn) return;
    _trackQueue.push({ type: "impression", widgetId: containerId, pageSession: pageSession, ts: Date.now() });
    if (_trackTimer) clearTimeout(_trackTimer);
    _trackTimer = setTimeout(trackFlush, 5000);
  }
  function observeImpression(el) {
    if (!analyticsOn || !el || typeof IntersectionObserver !== "function") return;
    var fired = false;
    var io = new IntersectionObserver(function (entries) {
      if (fired) return;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          fired = true;
          trackImpression();
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0 });
    io.observe(el);
  }
  if (analyticsOn) {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") trackFlush();
    });
  }

  // ── Caption helpers (same shape as the other widgets) ──
  function splCapParseTime(ts) {
    if (!ts) return 0;
    var p = ts.split(':'); if (p.length !== 3) return 0;
    var sec = parseFloat(p[2]);
    return (parseInt(p[0], 10) || 0) * 3600 + (parseInt(p[1], 10) || 0) * 60 + (isFinite(sec) ? sec : 0);
  }
  function splCapParseVtt(vtt) {
    var out = [];
    if (!vtt || typeof vtt !== "string") return out;
    var lines = vtt.split(/\r\n|\n|\r/);
    var i = 0;
    if (i < lines.length && /^\s*WEBVTT/.test(lines[i])) i++;
    while (i < lines.length) {
      while (i < lines.length && lines[i].trim() === "") i++;
      if (i >= lines.length) break;
      if (lines[i].indexOf("-->") === -1 && i + 1 < lines.length && lines[i + 1].indexOf("-->") !== -1) i++;
      if (i >= lines.length) break;
      var m = lines[i].match(/^\s*(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
      if (!m) { i++; continue; }
      var start = splCapParseTime(m[1]);
      var end   = splCapParseTime(m[2]);
      i++;
      var textLines = [];
      while (i < lines.length && lines[i].trim() !== "") { textLines.push(lines[i]); i++; }
      if (end > start && textLines.length) out.push({ start: start, end: end, text: textLines.join("\n") });
    }
    return out;
  }
  function splCapDetectLang(availableLangs) {
    if (!availableLangs || !availableLangs.length) return null;
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var base = (langs[i] || "").toLowerCase().split("-")[0];
      if (base && base !== "en" && availableLangs.indexOf(base) !== -1) return base;
    }
    return null;
  }
  function splCapGetSavedLang() { try { return sessionStorage.getItem("splshy.captionLang") || null; } catch (e) { return null; } }
  function splCapSaveLang(lang) { try { sessionStorage.setItem("splshy.captionLang", lang || ""); } catch (e) {} }
  function splCapActiveCue(cues, currentTime) {
    if (!cues || !cues.length) return null;
    for (var i = 0; i < cues.length; i++) {
      if (currentTime >= cues[i].start && currentTime < cues[i].end) return cues[i];
    }
    return null;
  }
  var SPL_CAP_LANG_NAMES = { en: "English", es: "Español", fr: "Français", de: "Deutsch", zh: "中文" };

  // Pre-parse each reel's captions once.
  var capCuesByReel  = [];
  var capLangsByReel = [];
  for (var ci = 0; ci < reels.length; ci++) {
    var perReel = {}; var perReelLangs = [];
    var rc = reels[ci] && reels[ci].captions;
    if (rc && typeof rc === "object") {
      Object.keys(rc).forEach(function (lang) {
        var vttStr = rc[lang];
        if (typeof vttStr === "string" && vttStr) {
          var parsed = splCapParseVtt(vttStr);
          if (parsed.length) { perReel[lang] = parsed; perReelLangs.push(lang); }
        }
      });
    }
    capCuesByReel.push(perReel);
    capLangsByReel.push(perReelLangs);
  }
  var capUnionLangs = [];
  capLangsByReel.forEach(function (arr) {
    arr.forEach(function (l) { if (capUnionLangs.indexOf(l) === -1) capUnionLangs.push(l); });
  });
  var capSelected = (function () {
    var saved = splCapGetSavedLang();
    if (saved === "off") return null;
    if (saved && capUnionLangs.indexOf(saved) !== -1) return saved;
    return splCapDetectLang(capUnionLangs);
  })();

  // ── Utility helpers ────────────────────────────────
  function escapeHTML(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function safeUrl(u) {
    if (!u) return "";
    if (/^javascript:/i.test(u)) return "";
    return u;
  }
  function fmtTime(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t - m * 60);
    return m + ":" + (s < 10 ? "0" + s : s);
  }
  function isMobileLayout() { return window.innerWidth < 768; }

  // ── CSS injection ──────────────────────────────────
  var STYLE_ID = "sgr-styles";
  if (!document.getElementById(STYLE_ID)) {
    var styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = [
      ".sgr-widget{width:100%;position:relative;padding:18px 16px;box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff;-webkit-font-smoothing:antialiased}",
      "@media(max-width:767px){.sgr-widget{padding:14px 10px}}",
      // Desktop: 6-column / 2-row grid.
      ".sgr-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}",
      ".sgr-card{position:relative;aspect-ratio:9/16;border-radius:10px;overflow:hidden;background:#1a1a1a;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".sgr-poster{position:absolute;inset:0;background-size:cover;background-position:center;background-color:#0f0f0f}",
      ".sgr-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .18s}",
      ".sgr-card.is-playing .sgr-video,.sgr-card.sgr-popped--open .sgr-video{opacity:1}",
      // Soft hover lift on desktop. Touch devices skip the scale so taps
      // don't feel laggy.
      "@media(hover:hover){.sgr-card{transition:transform .18s,box-shadow .18s}.sgr-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.32)}}",
      ".sgr-play-icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;transition:opacity .18s}",
      ".sgr-play-icon.hidden{opacity:0}",
      ".sgr-play-circle{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);border:1.5px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center}",
      // Mobile: 2-column grid, three pages of 4 cards each. Each page is
      // 100% wide; scroll-snap makes lateral swipes feel like flipping
      // pages instead of free scrolling.
      "@media(max-width:767px){",
        ".sgr-grid{display:flex;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;gap:0;padding-bottom:6px;scrollbar-width:none}",
        ".sgr-grid::-webkit-scrollbar{display:none}",
        ".sgr-page{flex:0 0 100%;scroll-snap-align:start;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:0 4px;box-sizing:border-box}",
      "}",
      // Desktop: pages collapse into a single flat grid. The .sgr-page
      // wrappers are still in the DOM; we display:contents them so they
      // don't affect the visual grid layout.
      "@media(min-width:768px){.sgr-page{display:contents}}",
      // Page indicator dots (mobile only).
      ".sgr-dots{display:none;justify-content:center;gap:8px;margin-top:10px}",
      "@media(max-width:767px){.sgr-dots{display:flex}}",
      ".sgr-dot{width:7px;height:7px;border-radius:50%;background:rgba(0,0,0,.25);transition:background .18s,transform .18s}",
      ".sgr-dot.is-active{background:rgba(0,0,0,.7);transform:scale(1.2)}",

      // ── Popout (single-widget style: card scales 1.3x in place) ────
      // Backdrop overlay — fixed full-viewport, fades in when a card
      // is popped. No content lives inside it; the popped card itself
      // is reparented to document.body so the transform is unaffected
      // by any clipping/overflow on the page.
      ".sgr-popout-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:99998;opacity:0;pointer-events:none;transition:opacity .34s ease}",
      ".sgr-popout-backdrop.open{opacity:1;pointer-events:auto}",
      // Popped card state: fixed-positioned, transitioning in transform.
      ".sgr-card.sgr-popped{position:fixed;z-index:100000;transition:transform .34s cubic-bezier(.2,.8,.25,1),box-shadow .34s ease;cursor:default}",
      ".sgr-card.sgr-popped.sgr-popped--open{box-shadow:0 40px 90px rgba(0,0,0,.55)}",
      // Holder placeholder occupies the card's slot in the grid while
      // it's lifted, so neighboring cards don't reflow under it.
      ".sgr-card-holder{display:block}",
      // Per-card controls: invisible on the inline grid; revealed only
      // when the card has .sgr-popped--open (i.e. it's popped + animated).
      ".sgr-close-btn,.sgr-pop-mute-btn,.sgr-pop-cc-btn,.sgr-lang-menu,.sgr-cap-overlay,.sgr-pop-title,.sgr-pop-prog{display:none}",
      ".sgr-card.sgr-popped--open .sgr-close-btn{display:flex}",
      ".sgr-card.sgr-popped--open .sgr-pop-mute-btn{display:flex}",
      ".sgr-card.sgr-popped--open .sgr-pop-cc-btn.has-langs{display:flex}",
      ".sgr-card.sgr-popped--open .sgr-pop-title{display:block}",
      ".sgr-card.sgr-popped--open .sgr-pop-prog{display:flex}",
      // Hide play-icon while popped (the card is now the active player).
      ".sgr-card.sgr-popped--open .sgr-play-icon{display:none}",
      // Close button — top-right corner. Strong reset so host-page
      // CSS can't push the icon off-center.
      ".sgr-close-btn{position:absolute;top:6px;right:6px;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;border-radius:50%!important;background:rgba(0,0,0,.6)!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff;cursor:pointer;align-items:center;justify-content:center;z-index:20;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none;font-size:0;line-height:0;box-shadow:none!important}",
      ".sgr-close-btn:hover{background:rgba(0,0,0,.85)!important}",
      ".sgr-close-btn svg{width:10px!important;height:10px!important;display:block}",
      // Mute button — bottom-right column on popped card.
      ".sgr-pop-mute-btn{position:absolute;bottom:18px;right:8px;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;border-radius:50%!important;background:rgba(0,0,0,.55)!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff;cursor:pointer;align-items:center;justify-content:center;z-index:14;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none;box-shadow:none!important}",
      ".sgr-pop-mute-btn:hover{background:rgba(0,0,0,.8)!important}",
      ".sgr-pop-mute-btn svg{width:11px!important;height:11px!important;display:block}",
      // CC button — above mute.
      ".sgr-pop-cc-btn{position:absolute;bottom:46px;right:8px;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;border-radius:50%!important;background:rgba(0,0,0,.55)!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff!important;font-family:system-ui,-apple-system,sans-serif!important;font-weight:700!important;font-size:7.5px!important;line-height:1!important;letter-spacing:.04em!important;cursor:pointer;align-items:center;justify-content:center;z-index:14;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none;box-shadow:none!important}",
      ".sgr-pop-cc-btn:hover{background:rgba(0,0,0,.8)!important}",
      ".sgr-pop-cc-btn.is-active{background:#fff!important;color:#000!important;border-color:rgba(0,0,0,.35)!important}",
      ".sgr-pop-cc-btn.is-active:hover{background:#f0f0f0!important}",
      // Language menu — pops left of the CC button when open.
      // max-height + overflow-y so a 5-item menu stays inside the
      // small popped card without overflowing top/bottom.
      ".sgr-lang-menu{position:absolute;bottom:44px;right:36px;flex-direction:column;background:rgba(0,0,0,.95);border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px;z-index:15;min-width:78px;max-height:65%;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.45)}",
      ".sgr-card.sgr-popped--open .sgr-lang-menu.visible{display:flex}",
      // Strong reset on the menu buttons so host-page CSS (typical
      // .button or button{} rules on the embed site) can't blow up
      // their size. !important on the few that really matter.
      ".sgr-lang-opt{display:flex!important;align-items:center;padding:4px 8px!important;margin:0!important;background:transparent!important;border:0!important;outline:0!important;-webkit-appearance:none;appearance:none;color:#fff!important;font-family:system-ui,-apple-system,sans-serif!important;font-size:10.5px!important;font-weight:500!important;line-height:1.2!important;letter-spacing:0!important;cursor:pointer;border-radius:3px;text-align:left;width:100%;min-height:0!important;height:auto!important;text-transform:none!important;box-shadow:none!important}",
      ".sgr-lang-opt:hover{background:rgba(255,255,255,.08)!important}",
      ".sgr-lang-opt.is-selected{background:#fff!important;color:#000!important}",
      // Caption overlay (only visible while popped AND a language is
      // selected — class .visible is toggled by capRender). Strong
      // !important so host-page CSS can't inflate the font.
      ".sgr-cap-overlay{position:absolute;left:5%;right:5%;bottom:23%;min-height:11%;align-items:center;justify-content:center;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif!important;font-size:11px!important;font-weight:600!important;line-height:1.28!important;letter-spacing:0!important;color:#fff!important;background:rgba(0,0,0,.91);padding:4px 8px!important;border-radius:5px;z-index:13;pointer-events:none;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,.6)}",
      ".sgr-card.sgr-popped--open .sgr-cap-overlay.visible{display:flex}",
      // Even smaller on mobile — the popped card is narrow.
      "@media(max-width:767px){.sgr-cap-overlay{font-size:9.5px!important;padding:3px 6px!important;line-height:1.25!important;min-height:10%}}",
      // Title — bottom-left while popped. Single-line truncated with
      // ellipsis so a long title can't crash into the caption band.
      // !important on font/line-height so host-page typography rules
      // (often setting h-tag styles or .title font-size) can't bloat it.
      ".sgr-pop-title{position:absolute;left:8px;right:38px;bottom:8px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif!important;font-size:6.5px!important;font-weight:700!important;line-height:1.2!important;letter-spacing:0!important;color:#fff!important;text-shadow:0 1px 3px rgba(0,0,0,.7)!important;pointer-events:none;z-index:13;margin:0!important;padding:0!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:none!important}",
      "@media(max-width:767px){.sgr-pop-title{font-size:6px!important;bottom:6px}}",
      // Progress bar at very bottom of popped card.
      ".sgr-pop-prog{position:absolute;bottom:0;left:0;right:0;height:14px;z-index:20;cursor:pointer;align-items:flex-end}",
      ".sgr-pop-prog-track{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.25);pointer-events:none}",
      ".sgr-pop-prog-fill{position:absolute;bottom:0;left:0;height:3px;background:#fff;pointer-events:none;width:0%}"
    ].join("\n");
    document.head.appendChild(styleEl);
  }

  // ── Build DOM ──────────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) { try { console.warn("Splshy grid: container '#" + containerId + "' not found"); } catch (e) {} return; }
  if (container.dataset.sgrInit === "1") return; // idempotent
  container.dataset.sgrInit = "1";

  // Build pages: 3 pages × 4 cards. On desktop, .sgr-page has
  // display:contents so the cards land in the single 6×2 grid; on
  // mobile each page becomes a snap-target 2×2 grid.
  var pagesHTML = "";
  for (var pageIdx = 0; pageIdx < 3; pageIdx++) {
    var cardsHTML = "";
    for (var slot = 0; slot < 4; slot++) {
      var reelIdx = pageIdx * 4 + slot;
      cardsHTML += '<div class="sgr-card" data-idx="' + reelIdx + '"></div>';
    }
    pagesHTML += '<div class="sgr-page">' + cardsHTML + '</div>';
  }
  container.innerHTML =
    '<div class="sgr-widget">' +
      '<div class="sgr-grid" role="list">' + pagesHTML + '</div>' +
      '<div class="sgr-dots" aria-hidden="true">' +
        '<div class="sgr-dot is-active"></div><div class="sgr-dot"></div><div class="sgr-dot"></div>' +
      '</div>' +
    '</div>';

  var grid = container.querySelector(".sgr-grid");
  var dots = container.querySelectorAll(".sgr-dot");
  var cardEls = container.querySelectorAll(".sgr-card");

  observeImpression(container);

  // ── Per-card setup ─────────────────────────────────
  var cards = []; // { idx, el, video, reel, posterUrl, playedFor3s, watchStart }

  cardEls.forEach(function (el) {
    var idx = parseInt(el.getAttribute("data-idx"), 10);
    var reel = reels[idx] || null;
    if (!reel || !reel.videoUrl) {
      // Empty card — render a placeholder background so the grid stays
      // 2×6. Skip video setup.
      el.style.background = "linear-gradient(160deg,#2a2a2a 0%,#111 100%)";
      el.style.cursor = "default";
      cards.push({ idx: idx, el: el, video: null, reel: null });
      return;
    }
    // Poster (CSS background image — no <img> tag needed for the small
    // card, the viewer overlay uses a real <img> for accessibility).
    var poster = document.createElement("div");
    poster.className = "sgr-poster";
    if (reel.posterUrl) {
      poster.style.backgroundImage = 'url("' + safeUrl(reel.posterUrl).replace(/"/g, '\\"') + '")';
    }
    poster.setAttribute("role", "img");
    poster.setAttribute("aria-label", reel.posterAltText || reel.label || "Video");
    el.appendChild(poster);

    var video = document.createElement("video");
    video.className = "sgr-video";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = autoplayMap[idx] ? "metadata" : "none";
    // Lanes can advance into any card, so no video should loop —
    // they each need to fire 'ended' for the lane to step forward.
    // Hover replays from the start (startCardPlay resets currentTime).
    video.loop = false;
    video.src = reel.videoUrl;
    el.appendChild(video);

    // Play-icon overlay (visible when not playing, hidden when popped)
    var icon = document.createElement("div");
    icon.className = "sgr-play-icon";
    icon.innerHTML =
      '<div class="sgr-play-circle">' +
        '<svg width="14" height="14" viewBox="0 0 18 20" fill="none" aria-hidden="true">' +
          '<path d="M2 2L16 10L2 18V2Z" fill="white"/>' +
        '</svg>' +
      '</div>';
    el.appendChild(icon);

    // Popout-only controls. All hidden by default via CSS; only
    // visible while the card has .sgr-popped--open. Keeping them on
    // each card lets the popout work like the single-widget pattern
    // (the card itself scales 1.3x in place; controls travel with it).
    var hasCaptions = (capLangsByReel[idx] || []).length > 0;
    el.insertAdjacentHTML("beforeend",
      '<button class="sgr-close-btn" aria-label="Close popout">' +
        '<svg viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
          '<line x1="3" y1="3" x2="11" y2="11"/>' +
          '<line x1="11" y1="3" x2="3" y2="11"/>' +
        '</svg>' +
      '</button>' +
      '<button class="sgr-pop-mute-btn" aria-label="Mute audio" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
          '<path class="sgr-pm-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
          '<line class="sgr-pm-x1" x1="23" y1="9" x2="17" y2="15" style="display:none"/>' +
          '<line class="sgr-pm-x2" x1="17" y1="9" x2="23" y2="15" style="display:none"/>' +
        '</svg>' +
      '</button>' +
      (hasCaptions
        ? '<button class="sgr-pop-cc-btn has-langs" aria-label="Captions">CC</button>' +
          '<div class="sgr-lang-menu" role="menu"></div>' +
          '<div class="sgr-cap-overlay" aria-live="polite"></div>'
        : '') +
      '<div class="sgr-pop-title"></div>' +
      '<div class="sgr-pop-prog" role="slider" tabindex="0" aria-label="Seek video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="sgr-pop-prog-track"></div>' +
        '<div class="sgr-pop-prog-fill"></div>' +
      '</div>'
    );

    cards.push({
      idx:        idx,
      el:         el,
      video:      video,
      reel:       reel,
      icon:       icon,
      playedFor3s: false,
      watchStart: null,
      watchTimer: null,
      // Popout state — per-card so each card remembers what selected
      // language was set, etc. Filled lazily in openPopout.
      popped:     false
    });
  });

  function startCardPlay(card) {
    if (!card.video) return;
    if (!card.el.classList.contains("is-playing")) {
      card.el.classList.add("is-playing");
      if (card.icon) card.icon.classList.add("hidden");
      try { card.video.currentTime = 0; } catch (e) {}
      var p = card.video.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked; silent */ });
      // Splshy analytics: "qualified play" after 3s.
      if (analyticsOn && !card.playedFor3s && card.reel) {
        if (card.watchTimer) clearTimeout(card.watchTimer);
        card.watchTimer = setTimeout(function () {
          if (!card.el.classList.contains("is-playing")) return;
          card.playedFor3s = true;
          trackPlay(reelIdFor(card.reel.videoUrl));
        }, 3000);
      }
      if (card.watchStart == null) card.watchStart = Date.now();
    }
  }
  function stopCardPlay(card) {
    if (!card.video) return;
    if (card.el.classList.contains("is-playing")) {
      card.el.classList.remove("is-playing");
      if (card.icon) card.icon.classList.remove("hidden");
      try { card.video.pause(); } catch (e) {}
      if (card.watchTimer) { clearTimeout(card.watchTimer); card.watchTimer = null; }
      if (card.watchStart != null && card.reel) {
        var secs = (Date.now() - card.watchStart) / 1000;
        card.watchStart = null;
        trackWatch(reelIdFor(card.reel.videoUrl), secs);
      }
    }
  }

  // ── Autoplay lanes ─────────────────────────────────
  // Four parallel "lanes" of motion run while the grid is in the
  // viewport. Each lane starts at one of autoplayIndices (default
  // reels 1, 4, 8, 12 -> idx 0, 3, 7, 11) and independently cycles
  // forward through the reels — when its current video fires
  // 'ended', the lane advances to the next non-empty card and starts
  // it. All four lanes are visible simultaneously (4 cards playing
  // at once on average; occasional 3 if lanes collide).
  //
  // Mobile skips autoplay entirely (browser autoplay-with-mute is
  // flaky on iOS + costs cellular data).
  var inViewport  = false;
  var lanesActive = false;
  var lanes = [];
  autoplayIndices.forEach(function (startIdx) {
    var card = cards[startIdx];
    if (card && card.video) lanes.push({ current: startIdx });
  });

  function startAllLanes() {
    if (lanesActive || isMobileLayout() || !lanes.length) return;
    lanesActive = true;
    lanes.forEach(function (lane) {
      var c = cards[lane.current];
      if (c && c.video) startCardPlay(c);
    });
  }
  function stopAllLanes() {
    lanesActive = false;
    lanes.forEach(function (lane) {
      var c = cards[lane.current];
      if (c && c.video && !c.hovered) stopCardPlay(c);
    });
  }
  // Advance whichever lane's current === endedCard.idx. Skip past
  // empty/missing cards. Only ONE lane advances per ended event — if
  // two lanes happen to be on the same card, the first match wins
  // and the other lane stays on this card (it'll catch the next
  // ended on its own).
  function onLaneCardEnded(endedCard) {
    if (!lanesActive) return;
    for (var li = 0; li < lanes.length; li++) {
      if (lanes[li].current !== endedCard.idx) continue;
      stopCardPlay(endedCard);
      var next = (endedCard.idx + 1) % cards.length;
      var tries = 0;
      while (tries < cards.length) {
        var nc = cards[next];
        if (nc && nc.video) break;
        next = (next + 1) % cards.length;
        tries++;
      }
      lanes[li].current = next;
      var newCard = cards[next];
      if (newCard && newCard.video) startCardPlay(newCard);
      return;
    }
  }
  // Attach 'ended' to EVERY card's video — a lane can rotate into
  // any card, so any card may need to advance its owning lane.
  cards.forEach(function (c) {
    if (!c.video) return;
    c.video.addEventListener("ended", function () { onLaneCardEnded(c); });
  });

  // ── Mobile autoplay lane (single rotating slot) ────
  // On mobile, ONE lane plays at a time. It alternates between the
  // top-right (slot 1) and bottom-left (slot 2) of the CURRENTLY
  // VISIBLE 2×2 page. When the user swipes to a new page the lane
  // resets to that page's top-right.
  var mobileLaneActive = false;
  var mobileLaneSlot   = 1;     // 1 = top-right, 2 = bottom-left within the page's 4 cards
  function mobileVisiblePage() {
    if (!grid) return 0;
    var w = grid.clientWidth || 1;
    return Math.round(grid.scrollLeft / w);
  }
  function mobileLaneCard() {
    var page = mobileVisiblePage();
    var idx  = page * 4 + mobileLaneSlot;
    var card = cards[idx];
    if (card && card.video) return card;
    // Slot empty? Try the OTHER slot on the same page.
    var alt = page * 4 + (mobileLaneSlot === 1 ? 2 : 1);
    return cards[alt] && cards[alt].video ? cards[alt] : null;
  }
  function startMobileLane() {
    if (mobileLaneActive || !isMobileLayout()) return;
    if (poppedCard) return;        // don't play behind a popout
    mobileLaneActive = true;
    playMobileLane();
  }
  function stopMobileLane() {
    mobileLaneActive = false;
    cards.forEach(function (c) {
      if (c && c.video && !c.hovered) stopCardPlay(c);
    });
  }
  function playMobileLane() {
    if (!mobileLaneActive) return;
    var card = mobileLaneCard();
    if (!card) return;
    // Stop any other card that's mid-play (lane only plays one at a time).
    cards.forEach(function (other) {
      if (other && other.video && other !== card) stopCardPlay(other);
    });
    startCardPlay(card);
  }
  function onMobileLaneCardEnded(card) {
    if (!mobileLaneActive) return;
    stopCardPlay(card);
    // Alternate slot: 1 ↔ 2 within the current page.
    mobileLaneSlot = (mobileLaneSlot === 1 ? 2 : 1);
    playMobileLane();
  }
  // Attach 'ended' to every card for mobile-lane advance — desktop
  // lanes already attached above, this is purely additive on mobile.
  cards.forEach(function (c) {
    if (!c.video) return;
    c.video.addEventListener("ended", function () {
      if (isMobileLayout()) onMobileLaneCardEnded(c);
    });
  });

  if (typeof IntersectionObserver === "function") {
    var rootIo = new IntersectionObserver(function (entries) {
      var nowVisible = entries[0] && entries[0].isIntersecting;
      if (nowVisible === inViewport) return;
      inViewport = nowVisible;
      if (inViewport) {
        if (isMobileLayout()) startMobileLane();
        else                  startAllLanes();
      } else {
        stopAllLanes();
        stopMobileLane();
      }
    }, { threshold: 0.1 });
    rootIo.observe(container);
  }

  // ── Hover-to-play (desktop only) ───────────────────
  // Hover plays any card on demand. mouseleave stops it, UNLESS the
  // card is the currently-active chain card (in which case stopping
  // would silently kill the chain). Non-chain cards always stop on
  // mouseleave.
  cards.forEach(function (c) {
    if (!c.video) return;
    c.el.addEventListener("mouseenter", function () {
      if (isMobileLayout()) return;
      c.hovered = true;
      startCardPlay(c);
    });
    c.el.addEventListener("mouseleave", function () {
      if (isMobileLayout()) return;
      c.hovered = false;
      // If a lane is currently on this card, don't tear it down —
      // mouseleave would silently stop the lane's video.
      var laneOwns = lanesActive && lanes.some(function (l) { return l.current === c.idx; });
      if (laneOwns) return;
      stopCardPlay(c);
    });
  });
  function inViewportFor(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh && r.bottom > 0;
  }

  // ── Mobile page indicator sync + lane reset on swipe ──
  var lastVisiblePage = 0;
  if (grid) {
    grid.addEventListener("scroll", function () {
      if (!isMobileLayout()) return;
      var w = grid.clientWidth || 1;
      var page = Math.round(grid.scrollLeft / w);
      if (dots && dots.length) {
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.toggle("is-active", i === page);
        }
      }
      if (page !== lastVisiblePage) {
        lastVisiblePage = page;
        // New page → reset lane to top-right of this page.
        mobileLaneSlot = 1;
        if (mobileLaneActive) playMobileLane();
      }
    });
  }

  // ── Popout (single-widget pattern: card scales 1.3x in place) ────
  // Shared backdrop only — the popped card itself is reparented to
  // document.body so its transform isn't clipped by any overflow on
  // the host page. Controls live PER CARD (close, mute, CC, title,
  // progress) and are revealed by a CSS class on the card.
  var POPOUT_SCALE = 1.7;
  var backdrop = document.createElement("div");
  backdrop.className = "sgr-popout-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.appendChild(backdrop);

  var poppedCard  = null;       // currently popped card object (null if none)
  var poppedHold  = null;       // placeholder div sitting in the grid where the card used to be
  var popBusy     = false;

  function openPopout(c) {
    if (!c || !c.video || !c.reel || poppedCard || popBusy) return;
    popBusy = true;

    // Pause every other (autoplay/lane) card so audio doesn't double
    // and CPU doesn't churn while the popped card plays unmuted.
    cards.forEach(function (other) {
      if (other === c) return;
      if (other.video) stopCardPlay(other);
    });

    // Measure the card's current on-screen rect BEFORE lifting it.
    var r  = c.el.getBoundingClientRect();
    var w  = r.width, h = r.height;
    var tw = w * POPOUT_SCALE, th = h * POPOUT_SCALE;
    // Target top-left = centered over the original card's centre,
    // clamped to viewport with a 16px margin.
    var cx = r.left + w / 2, cy = r.top + h / 2;
    var tx = cx - tw / 2,    ty = cy - th / 2;
    var m  = 16;
    var maxX = window.innerWidth  - tw - m;
    var maxY = window.innerHeight - th - m;
    tx = Math.max(m, Math.min(tx, maxX));
    ty = Math.max(m, Math.min(ty, maxY));

    // Drop a placeholder into the card's grid slot so neighbors don't
    // reflow under the lifted card.
    poppedHold = document.createElement("div");
    poppedHold.className = "sgr-card-holder";
    poppedHold.style.width  = w + "px";
    poppedHold.style.height = h + "px";
    c.el.parentNode.insertBefore(poppedHold, c.el);

    // Lift to fixed position at the CURRENT rect (no visual jump).
    c.el.classList.add("sgr-popped");
    c.el.style.transition = "none";
    c.el.style.left   = r.left + "px";
    c.el.style.top    = r.top  + "px";
    c.el.style.width  = w + "px";
    c.el.style.height = h + "px";
    c.el.style.transformOrigin = "top left";
    c.el.style.transform = "translate(0px,0px) scale(1)";
    document.body.appendChild(c.el);
    c.el.offsetHeight;        // force reflow so the next change animates

    // Animate: backdrop fade-in, card translate + scale.
    backdrop.classList.add("open");
    c.el.classList.add("sgr-popped--open");
    c.el.style.transition = "";
    c.el.style.transform =
      "translate(" + (tx - r.left) + "px," + (ty - r.top) + "px) scale(" + POPOUT_SCALE + ")";

    // Configure popped controls for this card.
    var titleEl = c.el.querySelector(".sgr-pop-title");
    if (titleEl) titleEl.textContent = c.reel.label || "";
    c.video.muted = false;            // popout starts unmuted
    syncCardMuteIcon(c);
    capBuildMenuForCard(c);
    capSyncCardBtnState(c);

    // Try to play. If autoplay-with-sound is blocked (some browsers
    // require an explicit user gesture for audio), fall back to muted.
    var p = c.video.play();
    if (p && p.catch) p.catch(function () {
      c.video.muted = true; syncCardMuteIcon(c);
      var p2 = c.video.play(); if (p2 && p2.catch) p2.catch(function () {});
    });

    document.body.style.overflow = "hidden";
    poppedCard = c;
    setTimeout(function () { popBusy = false; }, 360);
  }

  function closePopout() {
    if (!poppedCard || popBusy) return;
    popBusy = true;
    var c = poppedCard;

    // Animate the card back to its original rect (transform identity).
    c.el.style.transform = "translate(0px,0px) scale(1)";
    c.el.classList.remove("sgr-popped--open");
    backdrop.classList.remove("open");
    document.body.style.overflow = "";

    // Hide caption + lang menu state immediately.
    var capOver = c.el.querySelector(".sgr-cap-overlay");
    if (capOver) { capOver.classList.remove("visible"); capOver.textContent = ""; }
    var langMenu = c.el.querySelector(".sgr-lang-menu");
    if (langMenu) langMenu.classList.remove("visible");

    // Pause the popped card now; reset state via stopCardPlay.
    try { c.video.pause(); } catch (e) {}
    c.video.muted = true;
    c.el.classList.remove("is-playing");
    if (c.icon) c.icon.classList.remove("hidden");

    setTimeout(function () {
      c.el.classList.remove("sgr-popped");
      c.el.style.transition = "";
      c.el.style.transform  = "";
      c.el.style.transformOrigin = "";
      c.el.style.left = c.el.style.top = "";
      c.el.style.width = c.el.style.height = "";
      if (poppedHold && poppedHold.parentNode) {
        poppedHold.parentNode.insertBefore(c.el, poppedHold);
        poppedHold.parentNode.removeChild(poppedHold);
      }
      poppedHold = null;
      poppedCard = null;
      popBusy = false;
      // Resume the autoplay lanes if the grid is in viewport.
      if (inViewport && !lanesActive && !isMobileLayout()) startAllLanes();
      if (mobileLaneActive) playMobileLane();
    }, 360);
  }

  backdrop.addEventListener("click", function () { closePopout(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && poppedCard) closePopout();
  });

  // ── Card click + control wiring ────────────────────
  cards.forEach(function (c) {
    if (!c.video || !c.reel) return;

    // Card click → pop out (unless already popped).
    c.el.addEventListener("click", function (e) {
      // Clicks on popped controls (close / mute / CC / lang menu /
      // progress) shouldn't bubble up and re-trigger openPopout.
      if (poppedCard === c) return;
      // Don't pop if click came from inside the lang menu (handled below).
      if (e.target.closest && e.target.closest(".sgr-lang-menu")) return;
      openPopout(c);
    });
    c.el.setAttribute("tabindex", "0");
    c.el.setAttribute("role", "button");
    c.el.setAttribute("aria-label", "Open: " + (c.reel.label || ("Video " + (c.idx + 1))));
    c.el.addEventListener("keydown", function (e) {
      if (poppedCard) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPopout(c); }
    });

    // Close button.
    var closeBtn = c.el.querySelector(".sgr-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (poppedCard === c) closePopout();
    });

    // Mute toggle.
    var muteBtn = c.el.querySelector(".sgr-pop-mute-btn");
    if (muteBtn) muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      c.video.muted = !c.video.muted;
      syncCardMuteIcon(c);
    });

    // CC button + language menu.
    var ccBtn   = c.el.querySelector(".sgr-pop-cc-btn");
    var ccMenu  = c.el.querySelector(".sgr-lang-menu");
    if (ccBtn && ccMenu) {
      ccBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        ccMenu.classList.toggle("visible");
      });
      ccMenu.addEventListener("click", function (e) {
        e.stopPropagation();
        var btn = e.target.closest && e.target.closest(".sgr-lang-opt");
        if (!btn) return;
        capSelectForCard(c, btn.getAttribute("data-lang") || null);
        ccMenu.classList.remove("visible");
      });
    }

    // Progress bar — scrub-to-seek.
    var prog = c.el.querySelector(".sgr-pop-prog");
    if (prog) prog.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!c.video.duration) return;
      var r = prog.getBoundingClientRect();
      var pct = (e.clientX - r.left) / r.width;
      if (pct < 0) pct = 0; if (pct > 1) pct = 1;
      c.video.currentTime = pct * c.video.duration;
    });

    // timeupdate → update progress + render captions, but only while
    // the card is the popped one.
    c.video.addEventListener("timeupdate", function () {
      if (poppedCard !== c) return;
      if (c.video.duration) {
        var pct = (c.video.currentTime / c.video.duration) * 100;
        var fill = c.el.querySelector(".sgr-pop-prog-fill");
        if (fill) fill.style.width = pct + "%";
        if (prog) prog.setAttribute("aria-valuenow", Math.round(pct));
      }
      capRenderForCard(c, false);
    });
    c.video.addEventListener("seeked", function () {
      if (poppedCard === c) capRenderForCard(c, true);
    });
  });

  function syncCardMuteIcon(c) {
    var muteBtn = c.el.querySelector(".sgr-pop-mute-btn");
    if (!muteBtn) return;
    var muted = !!c.video.muted;
    var x1 = muteBtn.querySelector(".sgr-pm-x1");
    var x2 = muteBtn.querySelector(".sgr-pm-x2");
    var um = muteBtn.querySelector(".sgr-pm-unmute");
    if (x1) x1.style.display = muted ? "block" : "none";
    if (x2) x2.style.display = muted ? "block" : "none";
    if (um) um.style.display = muted ? "none" : "block";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  // ── Captions in the popout (per-card) ───────────────
  function capRenderForCard(c, force) {
    var capOver = c.el.querySelector(".sgr-cap-overlay");
    if (!capOver) return;
    var cues = (capCuesByReel[c.idx] || {})[capSelected];
    if (!capSelected || !cues) {
      if (capOver.classList.contains("visible")) {
        capOver.classList.remove("visible");
        capOver.textContent = "";
      }
      return;
    }
    var cue = splCapActiveCue(cues, c.video.currentTime || 0);
    if (cue) {
      if (capOver.textContent !== cue.text || force) capOver.textContent = cue.text;
      capOver.classList.add("visible");
    } else if (capOver.classList.contains("visible")) {
      capOver.classList.remove("visible");
      capOver.textContent = "";
    }
  }
  function capBuildMenuForCard(c) {
    var menu  = c.el.querySelector(".sgr-lang-menu");
    var btn   = c.el.querySelector(".sgr-pop-cc-btn");
    var langs = capLangsByReel[c.idx] || [];
    if (!menu || !btn) return;
    if (!langs.length) { btn.classList.remove("has-langs"); return; }
    btn.classList.add("has-langs");
    var opts = [{ code: "", label: "Off" }];
    langs.forEach(function (lang) {
      opts.push({ code: lang, label: SPL_CAP_LANG_NAMES[lang] || lang.toUpperCase() });
    });
    menu.innerHTML = opts.map(function (o) {
      var selected = (o.code === (capSelected || ""));
      return '<button class="sgr-lang-opt' + (selected ? ' is-selected' : '') +
        '" data-lang="' + o.code + '" role="menuitemradio" aria-checked="' + (selected ? 'true' : 'false') + '">' +
        o.label + '</button>';
    }).join("");
  }
  function capSyncCardBtnState(c) {
    var btn   = c.el.querySelector(".sgr-pop-cc-btn");
    var langs = capLangsByReel[c.idx] || [];
    if (!btn) return;
    if (!langs.length) { btn.classList.remove("has-langs"); btn.classList.remove("is-active"); return; }
    btn.classList.add("has-langs");
    if (capSelected && (capCuesByReel[c.idx] || {})[capSelected]) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-pressed", "false");
    }
  }
  function capSelectForCard(c, lang) {
    capSelected = lang || null;
    splCapSaveLang(capSelected || "off");
    capBuildMenuForCard(c);
    capSyncCardBtnState(c);
    capRenderForCard(c, true);
  }

  // ── Resize handler ─────────────────────────────────
  // CSS handles the desktop ↔ mobile layout flip via media query.
  // Re-evaluate which lane variant should be running.
  window.addEventListener("resize", function () {
    if (isMobileLayout()) {
      stopAllLanes();
      if (inViewport && !mobileLaneActive) startMobileLane();
    } else {
      stopMobileLane();
      if (inViewport && !lanesActive) startAllLanes();
    }
  });

  } // end initWidget

  // ── Multi-instance bootstrap ─────────────────────────
  function processQueue() {
    var q = window.SPLSHY_GRID_QUEUE;
    if (q && q.length) while (q.length) initWidget(q.shift());
    window.SPLSHY_GRID_QUEUE = { push: function (cfg) { initWidget(cfg); } };
  }
  if (window.SPLSHY_GRID && window.SPLSHY_GRID.reels) initWidget(window.SPLSHY_GRID);
  processQueue();

})();
