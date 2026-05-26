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
      ".sgr-widget{width:100%;position:relative;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff;-webkit-font-smoothing:antialiased}",
      // Desktop: 6-column / 2-row grid.
      ".sgr-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}",
      ".sgr-card{position:relative;aspect-ratio:9/16;border-radius:10px;overflow:hidden;background:#1a1a1a;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".sgr-poster{position:absolute;inset:0;background-size:cover;background-position:center;background-color:#0f0f0f}",
      ".sgr-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .18s}",
      ".sgr-card.is-playing .sgr-video{opacity:1}",
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

      // ── Viewer overlay (popout) ────────────────────
      ".sgr-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:99999;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:20px;box-sizing:border-box}",
      ".sgr-overlay.visible{display:flex}",
      ".sgr-viewer{position:relative;height:min(92vh,800px);aspect-ratio:9/16;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 40px 90px rgba(0,0,0,.55)}",
      // Mobile: shrink viewer + relax the backdrop so the popout
      // feels less invasive. Leaves visible page chrome on top/bottom.
      "@media(max-width:767px){.sgr-viewer{height:min(72vh,600px)}.sgr-overlay{padding:36px 16px;background:rgba(0,0,0,.7)}}",
      ".sgr-viewer-video{width:100%;height:100%;object-fit:cover;display:block;background:#000}",
      ".sgr-viewer-poster{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;opacity:0;transition:opacity .2s}",
      ".sgr-viewer-poster.visible{opacity:1}",
      ".sgr-viewer-title{position:absolute;left:14px;right:60px;bottom:42px;font-size:17px;font-weight:700;line-height:1.25;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6);pointer-events:none;z-index:13}",
      ".sgr-viewer-close{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;padding:0}",
      ".sgr-viewer-close:hover{background:rgba(0,0,0,.85)}",
      ".sgr-viewer-mute{position:absolute;bottom:58px;right:14px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:14;padding:0}",
      ".sgr-viewer-mute:hover{background:rgba(0,0,0,.8)}",
      ".sgr-viewer-mute svg{width:16px;height:16px}",
      ".sgr-viewer-cc{position:absolute;bottom:100px;right:14px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);color:#fff;font-weight:700;font-size:11px;letter-spacing:.04em;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:14;padding:0}",
      ".sgr-viewer-cc.visible{display:flex}",
      ".sgr-viewer-cc.is-active{background:#fff;color:#000;border-color:rgba(0,0,0,.35)}",
      ".sgr-viewer-cc:hover{background:rgba(0,0,0,.8)}",
      ".sgr-viewer-cc.is-active:hover{background:#f0f0f0}",
      ".sgr-lang-menu{position:absolute;bottom:100px;right:56px;display:none;flex-direction:column;background:rgba(0,0,0,.95);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:4px;z-index:15;min-width:120px;box-shadow:0 8px 24px rgba(0,0,0,.45)}",
      ".sgr-lang-menu.visible{display:flex}",
      ".sgr-lang-opt{display:flex;align-items:center;padding:8px 12px;background:transparent;border:none;color:#fff;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:500;cursor:pointer;border-radius:5px;text-align:left}",
      ".sgr-lang-opt:hover{background:rgba(255,255,255,.08)}",
      ".sgr-lang-opt.is-selected{background:#fff;color:#000}",
      ".sgr-cap-overlay{position:absolute;left:5%;right:5%;bottom:23%;min-height:11%;display:none;align-items:center;justify-content:center;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;font-weight:600;line-height:1.32;color:#fff;background:rgba(0,0,0,.91);padding:8px 14px;border-radius:5px;z-index:13;pointer-events:none;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,.6)}",
      ".sgr-cap-overlay.visible{display:flex}",
      "@media(max-width:767px){.sgr-cap-overlay{font-size:13px;left:6%;right:6%;padding:6px 10px}}",
      // Pause indicator + viewer play overlay
      ".sgr-viewer-pauseind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0;transition:opacity .2s}",
      ".sgr-viewer-pauseind.visible{opacity:1}",
      ".sgr-viewer-pause-circle{width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center}",
      // Progress bar at very bottom of viewer
      ".sgr-viewer-prog{position:absolute;bottom:0;left:0;right:0;height:20px;z-index:20;cursor:pointer;display:flex;align-items:flex-end}",
      ".sgr-viewer-prog-track{position:absolute;bottom:0;left:0;right:0;height:5px;background:rgba(255,255,255,.25);pointer-events:none}",
      ".sgr-viewer-prog-fill{position:absolute;bottom:0;left:0;height:5px;background:#fff;pointer-events:none;width:0%}"
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
    // Autoplay-chain cards play to end (then chain advances). Non-
    // chain cards loop while hovered so the visitor can re-watch
    // a short clip without it freezing on the last frame.
    if (!autoplayMap[idx]) video.loop = true;
    video.src = reel.videoUrl;
    el.appendChild(video);

    // Play-icon overlay (visible when not playing)
    var icon = document.createElement("div");
    icon.className = "sgr-play-icon";
    icon.innerHTML =
      '<div class="sgr-play-circle">' +
        '<svg width="14" height="14" viewBox="0 0 18 20" fill="none" aria-hidden="true">' +
          '<path d="M2 2L16 10L2 18V2Z" fill="white"/>' +
        '</svg>' +
      '</div>';
    el.appendChild(icon);

    cards.push({
      idx:        idx,
      el:         el,
      video:      video,
      reel:       reel,
      icon:       icon,
      playedFor3s: false,
      watchStart: null,
      watchTimer: null
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

  // ── Autoplay chain ─────────────────────────────────
  // Only one chain card plays at a time. When its video ends, advance
  // to the next eligible slot. Mobile skips this entirely (autoplay-
  // with-mute on mobile browsers is flaky + costs cellular data).
  var inViewport  = false;
  var chainActive = false;
  var chainPos    = 0;            // index into autoplayIndices

  function chainCardAt(pos) {
    var idx = autoplayIndices[pos];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].idx === idx) return cards[i];
    }
    return null;
  }
  function startChain() {
    if (chainActive || isMobileLayout()) return;
    chainActive = true;
    advanceChain(chainPos);
  }
  function stopChain() {
    chainActive = false;
    var c = chainCardAt(chainPos);
    if (c && !c.hovered) stopCardPlay(c);
  }
  function advanceChain(targetPos) {
    if (!chainActive) return;
    var tries = 0;
    while (tries < autoplayIndices.length) {
      var c = chainCardAt(targetPos);
      if (c && c.video) { chainPos = targetPos; startCardPlay(c); return; }
      targetPos = (targetPos + 1) % autoplayIndices.length;
      tries++;
    }
    // All chain slots empty — nothing to play. Set inactive so we
    // don't spin.
    chainActive = false;
  }
  // Attach 'ended' to every chain card's video so the chain advances
  // naturally when the current clip finishes.
  cards.forEach(function (c) {
    if (!c.video || !autoplayMap[c.idx]) return;
    c.video.addEventListener("ended", function () {
      if (!chainActive) return;
      var pos = autoplayIndices.indexOf(c.idx);
      if (pos < 0) return;
      stopCardPlay(c);
      advanceChain((pos + 1) % autoplayIndices.length);
    });
  });

  if (typeof IntersectionObserver === "function") {
    var rootIo = new IntersectionObserver(function (entries) {
      var nowVisible = entries[0] && entries[0].isIntersecting;
      if (nowVisible === inViewport) return;
      inViewport = nowVisible;
      if (inViewport) startChain();
      else            stopChain();
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
      var pos = autoplayIndices.indexOf(c.idx);
      var isActiveChainCard = (chainActive && pos === chainPos);
      if (isActiveChainCard) return;   // chain card stays running
      stopCardPlay(c);
    });
  });
  function inViewportFor(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh && r.bottom > 0;
  }

  // ── Mobile page indicator sync ─────────────────────
  if (dots && dots.length) {
    grid.addEventListener("scroll", function () {
      if (!isMobileLayout()) return;
      var w = grid.clientWidth || 1;
      var page = Math.round(grid.scrollLeft / w);
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle("is-active", i === page);
      }
    });
  }

  // ── Viewer overlay ─────────────────────────────────
  // One overlay shared across all 12 cards; click a card to populate
  // it with that reel's video + open. Lives at document.body so it can
  // escape any clipping/overflow contexts on the host page.
  var overlay = document.createElement("div");
  overlay.className = "sgr-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML =
    '<div class="sgr-viewer">' +
      '<button class="sgr-viewer-close" aria-label="Close viewer">&times;</button>' +
      '<div class="sgr-viewer-poster"></div>' +
      '<video class="sgr-viewer-video" playsinline webkit-playsinline preload="metadata"></video>' +
      '<div class="sgr-cap-overlay" aria-live="polite"></div>' +
      '<button class="sgr-viewer-cc" aria-label="Captions">CC</button>' +
      '<div class="sgr-lang-menu" role="menu"></div>' +
      '<button class="sgr-viewer-mute" aria-label="Mute audio" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
          '<path class="sgr-vm-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
          '<line class="sgr-vm-x1" x1="23" y1="9" x2="17" y2="15" style="display:none"/>' +
          '<line class="sgr-vm-x2" x1="17" y1="9" x2="23" y2="15" style="display:none"/>' +
        '</svg>' +
      '</button>' +
      '<div class="sgr-viewer-title"></div>' +
      '<div class="sgr-viewer-prog" role="slider" tabindex="0" aria-label="Seek video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="sgr-viewer-prog-track"></div>' +
        '<div class="sgr-viewer-prog-fill"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var vClose    = overlay.querySelector(".sgr-viewer-close");
  var vVideo    = overlay.querySelector(".sgr-viewer-video");
  var vPoster   = overlay.querySelector(".sgr-viewer-poster");
  var vTitle    = overlay.querySelector(".sgr-viewer-title");
  var vMute     = overlay.querySelector(".sgr-viewer-mute");
  var vCC       = overlay.querySelector(".sgr-viewer-cc");
  var vLangMenu = overlay.querySelector(".sgr-lang-menu");
  var vCapOver  = overlay.querySelector(".sgr-cap-overlay");
  var vProg     = overlay.querySelector(".sgr-viewer-prog");
  var vProgFill = overlay.querySelector(".sgr-viewer-prog-fill");
  var vMuteX1   = vMute.querySelector(".sgr-vm-x1");
  var vMuteX2   = vMute.querySelector(".sgr-vm-x2");
  var vUnmuteIcon = vMute.querySelector(".sgr-vm-unmute");

  var activeReelIdx = -1;
  function syncMuteIcon() {
    var muted = !!vVideo.muted;
    if (vMuteX1) vMuteX1.style.display = muted ? "block" : "none";
    if (vMuteX2) vMuteX2.style.display = muted ? "block" : "none";
    if (vUnmuteIcon) vUnmuteIcon.style.display = muted ? "none" : "block";
    vMute.setAttribute("aria-pressed", muted ? "true" : "false");
  }
  function openViewer(idx) {
    var reel = reels[idx]; if (!reel || !reel.videoUrl) return;
    activeReelIdx = idx;
    // Pause every grid card so audio doesn't double when the viewer
    // plays unmuted.
    cards.forEach(function (c) { if (c.video) stopCardPlay(c); });
    vVideo.src = reel.videoUrl;
    vVideo.muted = false;            // viewer starts unmuted by default
    if (reel.posterUrl) {
      vPoster.style.backgroundImage = 'url("' + safeUrl(reel.posterUrl).replace(/"/g, '\\"') + '")';
      vPoster.classList.add("visible");
    } else {
      vPoster.style.backgroundImage = "";
      vPoster.classList.remove("visible");
    }
    vTitle.textContent = reel.label || "";
    vTitle.setAttribute("aria-label", reel.label || "");
    syncMuteIcon();
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
    capBuildMenu();
    capSyncBtnState();
    var p = vVideo.play();
    if (p && p.catch) p.catch(function () {
      // Autoplay blocked — start muted and try once more.
      vVideo.muted = true; syncMuteIcon();
      var p2 = vVideo.play();
      if (p2 && p2.catch) p2.catch(function () {});
    });
    // Hide poster once the video has decoded enough to show first frame.
    var hidePoster = function () {
      vPoster.classList.remove("visible");
      vVideo.removeEventListener("playing", hidePoster);
    };
    vVideo.addEventListener("playing", hidePoster);
  }
  function closeViewer() {
    overlay.classList.remove("visible");
    vLangMenu.classList.remove("visible");
    vCapOver.classList.remove("visible");
    vCapOver.textContent = "";
    document.body.style.overflow = "";
    try { vVideo.pause(); } catch (e) {}
    vVideo.removeAttribute("src");
    try { vVideo.load(); } catch (e) {}
    activeReelIdx = -1;
  }
  vClose.addEventListener("click", function (e) { e.stopPropagation(); closeViewer(); });
  overlay.addEventListener("click", function (e) {
    // Click on the dim backdrop (anything outside the viewer card) closes.
    if (e.target === overlay) closeViewer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("visible")) closeViewer();
  });

  // Mute / unmute
  vMute.addEventListener("click", function (e) {
    e.stopPropagation();
    vVideo.muted = !vVideo.muted;
    syncMuteIcon();
  });

  // Progress bar — scrub-to-seek
  vProg.addEventListener("click", function (e) {
    if (!vVideo.duration) return;
    var r = vProg.getBoundingClientRect();
    var pct = (e.clientX - r.left) / r.width;
    if (pct < 0) pct = 0; if (pct > 1) pct = 1;
    vVideo.currentTime = pct * vVideo.duration;
  });
  vVideo.addEventListener("timeupdate", function () {
    if (!vVideo.duration) return;
    var pct = (vVideo.currentTime / vVideo.duration) * 100;
    vProgFill.style.width = pct + "%";
    vProg.setAttribute("aria-valuenow", Math.round(pct));
    capRender(false);
  });

  // Card click → open viewer
  cards.forEach(function (c) {
    if (!c.video || !c.reel) return;
    c.el.addEventListener("click", function () { openViewer(c.idx); });
    c.el.setAttribute("tabindex", "0");
    c.el.setAttribute("role", "button");
    c.el.setAttribute("aria-label", "Open: " + (c.reel.label || ("Video " + (c.idx + 1))));
    c.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(c.idx); }
    });
  });

  // ── Captions in the viewer ─────────────────────────
  function capCurrentReelLangs() { return activeReelIdx >= 0 ? (capLangsByReel[activeReelIdx] || []) : []; }
  function capCurrentReelCues()  { return activeReelIdx >= 0 ? (capCuesByReel[activeReelIdx]  || {}) : {}; }
  function capRender(force) {
    var cues = capCurrentReelCues()[capSelected];
    if (!capSelected || !cues) {
      if (vCapOver.classList.contains("visible")) {
        vCapOver.classList.remove("visible");
        vCapOver.textContent = "";
      }
      return;
    }
    var cue = splCapActiveCue(cues, vVideo.currentTime || 0);
    if (cue) {
      if (vCapOver.textContent !== cue.text || force) vCapOver.textContent = cue.text;
      vCapOver.classList.add("visible");
    } else if (vCapOver.classList.contains("visible")) {
      vCapOver.classList.remove("visible");
      vCapOver.textContent = "";
    }
  }
  function capBuildMenu() {
    var langs = capCurrentReelLangs();
    if (!langs.length) { vCC.classList.remove("visible"); return; }
    vCC.classList.add("visible");
    var opts = [{ code: "", label: "Off" }];
    langs.forEach(function (lang) { opts.push({ code: lang, label: SPL_CAP_LANG_NAMES[lang] || lang.toUpperCase() }); });
    vLangMenu.innerHTML = opts.map(function (o) {
      var selected = (o.code === (capSelected || ""));
      return '<button class="sgr-lang-opt' + (selected ? ' is-selected' : '') +
        '" data-lang="' + o.code + '" role="menuitemradio" aria-checked="' + (selected ? 'true' : 'false') + '">' +
        o.label + '</button>';
    }).join("");
  }
  function capSyncBtnState() {
    var langs = capCurrentReelLangs();
    if (!langs.length) { vCC.classList.remove("visible"); vCC.classList.remove("is-active"); return; }
    vCC.classList.add("visible");
    if (capSelected && capCurrentReelCues()[capSelected]) {
      vCC.classList.add("is-active");
      vCC.setAttribute("aria-pressed", "true");
    } else {
      vCC.classList.remove("is-active");
      vCC.setAttribute("aria-pressed", "false");
    }
  }
  function capSelect(lang) {
    capSelected = lang || null;
    splCapSaveLang(capSelected || "off");
    capBuildMenu();
    capSyncBtnState();
    capRender(true);
  }
  vCC.addEventListener("click", function (e) {
    e.stopPropagation();
    vLangMenu.classList.toggle("visible");
  });
  vLangMenu.addEventListener("click", function (e) {
    e.stopPropagation();
    var btn = e.target.closest && e.target.closest(".sgr-lang-opt");
    if (!btn) return;
    capSelect(btn.getAttribute("data-lang") || null);
    vLangMenu.classList.remove("visible");
  });
  overlay.addEventListener("click", function (e) {
    if (!vLangMenu.classList.contains("visible")) return;
    if (e.target.closest && (e.target.closest(".sgr-viewer-cc") || e.target.closest(".sgr-lang-menu"))) return;
    vLangMenu.classList.remove("visible");
  });

  // ── Resize handler ─────────────────────────────────
  // CSS handles the desktop ↔ mobile layout flip via media query.
  // Just (re-)evaluate the chain: if we just crossed into mobile,
  // stop it; if we just crossed into desktop and the grid is in the
  // viewport, kick it back on.
  window.addEventListener("resize", function () {
    if (isMobileLayout()) { stopChain(); return; }
    if (inViewport && !chainActive) startChain();
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
