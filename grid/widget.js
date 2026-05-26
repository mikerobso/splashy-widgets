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

  // Preconnect to every unique video host so DNS + TLS handshake is
  // primed before the first card requests its file. Saves ~100-300ms
  // per cold connection on first interaction. Run once per host even
  // if multiple widgets on the same page hit the same CDN.
  (function () {
    if (!reels || !reels.length || !document.head) return;
    if (!window.__SPLSHY_PRECONNECTED) window.__SPLSHY_PRECONNECTED = {};
    var done = window.__SPLSHY_PRECONNECTED;
    var hosts = {};
    reels.forEach(function (r) {
      if (!r) return;
      [r.videoUrl, r.videoUrlSd, r.videoUrlHls, r.posterUrl].forEach(function (u) {
        if (!u || typeof u !== "string") return;
        try {
          var h = new URL(u, window.location.href).origin;
          if (h && !done[h]) hosts[h] = true;
        } catch (e) {}
      });
    });
    Object.keys(hosts).forEach(function (origin) {
      done[origin] = true;
      var l = document.createElement("link");
      l.rel = "preconnect";
      l.href = origin;
      l.crossOrigin = "anonymous";
      document.head.appendChild(l);
    });
  })();

  // ── HLS support ───────────────────────────────────
  // Three playback paths:
  //   1. Native HLS (Safari, iOS WebKit, Edge Legacy): set
  //      video.src = playlist URL and the browser handles it.
  //   2. hls.js (Chrome/Firefox/Edge): lazy-load the library on first
  //      use, attach to the video element. capLevelToPlayerSize=true
  //      caps quality to roughly match the rendered video size, so
  //      grid cards stream low quality and popped cards auto-upgrade.
  //   3. MP4 fallback (no HLS support or no urlHls in cfg): same SD/HD
  //      swap pattern as before — videoUrlSd for the grid card,
  //      videoUrl swap on popout.
  var HLS_JS_SRC = cfg.hlsJsSrc || "https://cdn.jsdelivr.net/npm/hls.js@1.5/dist/hls.min.js";
  function canPlayHlsNatively(video) {
    return video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
           video.canPlayType("application/x-mpegURL")        !== "";
  }
  // Force every TextTrack on the element into 'disabled' so the
  // browser's native subtitle renderer never paints. Listens for
  // addtrack so tracks added after manifest load (HLS playlists
  // populate them async) also get muted. Our .sgr-cap-overlay
  // handles caption display via its own VTT parser, completely
  // independent of the TextTrack API, so this is safe.
  function suppressNativeTextTracks(video) {
    function killAll() {
      try {
        var tt = video.textTracks;
        if (!tt) return;
        for (var i = 0; i < tt.length; i++) tt[i].mode = "disabled";
      } catch (e) {}
    }
    killAll();
    try {
      if (video.textTracks && video.textTracks.addEventListener) {
        video.textTracks.addEventListener("addtrack", killAll);
        // Some Safari builds need 'change' too.
        video.textTracks.addEventListener("change", killAll);
      }
    } catch (e) {}
  }
  var hlsJsLoaderPromise = null;
  function ensureHlsJsLoaded() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsJsLoaderPromise) return hlsJsLoaderPromise;
    hlsJsLoaderPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = HLS_JS_SRC;
      s.async = true;
      s.onload  = function () { window.Hls ? resolve(window.Hls) : reject(new Error("hls.js loaded but Hls global missing")); };
      s.onerror = function () { reject(new Error("hls.js failed to load")); };
      document.head.appendChild(s);
    });
    return hlsJsLoaderPromise;
  }
  function attachMp4Fallback(video, reel) {
    // Used in the grid card (low-res) — popout swaps to videoUrl.
    video.src = reel.videoUrlSd || reel.videoUrl;
  }
  function attachVideoSource(video, reel, cardObj) {
    // Bump the attach-generation. Any in-flight HLS setup from a
    // previous attachVideoSource call will see its generation
    // mismatch the current one and bail before mutating state.
    // Prevents the race where: close-popout fires attachVideoSource
    // (async hls.js load), user re-pops before it resolves,
    // openPopout's MP4 swap runs, then the late HLS attach
    // overrides the MP4 src and freezes playback.
    cardObj.attachGen = (cardObj.attachGen || 0) + 1;
    var myGen = cardObj.attachGen;
    // Only autoplay-lane cards use HLS. The other cards play one at
    // a time on hover/click — MP4 is equivalent quality for a single
    // stream and avoids the hls.js cost (Web Worker, MediaSource
    // buffer, manifest fetch). 12-card grid: 4 HLS / 8 MP4.
    // compact6 (side-text) grid: 2 HLS / 4 MP4. Major reduction in
    // browser overhead, and the HLS->MP4 popout swap (which has had
    // freeze issues in Chrome) only applies to the lane cards now.
    var useHls = !!(reel.videoUrlHls && autoplayMap[cardObj.idx]);
    if (useHls && canPlayHlsNatively(video)) {
      video.src = reel.videoUrlHls;
      cardObj.usingHls = true;
      cardObj.hlsKind  = "native";
      // Vimeo's HLS playlists embed subtitle tracks. Safari's native
      // player renders them via TextTrack API and they'd stack on
      // top of our custom .sgr-cap-overlay. Suppress them — our
      // overlay parses VTT independently and doesn't use TextTrack.
      suppressNativeTextTracks(video);
      // Safari native HLS doesn't dispatch fatal-error events the same
      // way hls.js does; a 404/CORS/playback failure surfaces as the
      // standard <video> 'error' event. Swap to MP4 if that fires.
      video.addEventListener("error", function onErr() {
        if (cardObj.hlsKind !== "native") return;
        try { console.warn("SPLSHY grid: native HLS playback errored, falling back to MP4"); } catch (e) {}
        video.removeEventListener("error", onErr);
        cardObj.usingHls = false;
        cardObj.hlsKind  = null;
        attachMp4Fallback(video, reel);
      });
      return;
    }
    if (useHls) {
      // Lazy-load hls.js. Until it resolves the card has no src; the
      // poster image stays visible. If the load fails, MSE isn't
      // supported, or the playlist itself errors out, fall back to
      // MP4 so the card still plays.
      ensureHlsJsLoaded().then(function (Hls) {
        // Stale callback (a newer attachVideoSource or openPopout
        // has taken over) — bail.
        if (myGen !== cardObj.attachGen) return;
        if (!Hls.isSupported()) { attachMp4Fallback(video, reel); return; }
        var hls = new Hls({
          // capLevelToPlayerSize sounds right but doesn't work here:
          // the popout uses CSS transform:scale(), which DOESN'T
          // change clientWidth/clientHeight, so hls.js keeps using
          // the grid-card-sized quality even when the video is
          // visually 2.45x larger. We manage the cap manually below
          // via autoLevelCapping.
          capLevelToPlayerSize: false,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          // Don't let hls.js render embedded subtitle tracks — our
          // custom .sgr-cap-overlay handles that.
          subtitleDisplay: false,
          renderTextTracksNatively: false
        });
        // Once the manifest parses, cap the level to ~540p (or the
        // highest variant <= 540p). Popout open/close adjust this
        // dynamically so the popped card gets full quality.
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          var levels = hls.levels || [];
          var capIdx = -1;
          for (var i = 0; i < levels.length; i++) {
            if (levels[i].height && levels[i].height <= 540) capIdx = i;
          }
          // If no variant is <=540p (rare), let the player pick freely
          // — better than capping to nothing and refusing to play.
          hls.autoLevelCapping = capIdx;
          cardObj.hlsGridCap = capIdx;  // remembered for close-popout restore
        });
        // Belt-and-suspenders: also disable any TextTrack entries that
        // appear later. hls.js still populates video.textTracks for
        // programmatic access even with subtitleDisplay:false.
        suppressNativeTextTracks(video);
        // Fatal-error fallback: manifest 404, CORS on the playlist,
        // segment fetch failures, codec mismatch, etc. all bubble up
        // as fatal errors. Tear down the Hls instance and attach the
        // MP4 src so the card still plays SOMETHING. Surface to
        // console so the embedder can debug.
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (!data || !data.fatal) return;
          try { console.warn("SPLSHY grid: HLS fatal error, falling back to MP4", data); } catch (e) {}
          try { hls.destroy(); } catch (e) {}
          cardObj.usingHls    = false;
          cardObj.hlsKind     = null;
          cardObj.hlsInstance = null;
          attachMp4Fallback(video, reel);
        });
        hls.loadSource(reel.videoUrlHls);
        hls.attachMedia(video);
        cardObj.usingHls    = true;
        cardObj.hlsKind     = "hlsjs";
        cardObj.hlsInstance = hls;
      }).catch(function (e) {
        if (myGen !== cardObj.attachGen) return;
        try { console.warn("SPLSHY grid: hls.js load failed, falling back to MP4", e); } catch (_) {}
        attachMp4Fallback(video, reel);
      });
      return;
    }
    attachMp4Fallback(video, reel);
  }
  // When true, only the first row (cards 0-5) is shown on desktop;
  // mobile still shows all 12 across 3 swipeable pages. The autoplay
  // lanes that start in the hidden row (>= 6) are skipped on desktop
  // and the lane-rotation logic wraps within the visible range.
  var hideBottomRowDesktop = !!cfg.hideBottomRowDesktop;
  // When true, the grid renders at 70% width on desktop (centered),
  // with proportionally tighter padding + gap. Mobile is unaffected.
  var shrinkDesktop = !!cfg.shrinkDesktop;
  // When true, only the first 6 reels render and the grid is laid out
  // as 3 cols x 2 rows on desktop / 2 cols x 3 rows on mobile (no
  // pagination, no swipe dots). Used by the side-text Studio variant
  // where a 6-card grid sits next to a text block.
  var compact6 = !!cfg.compact6;
  // Autoplay-eligible positions (0-indexed). Default = reels 1, 4, 8,
  // 12 (1-indexed). Only ONE of these plays at a time as part of an
  // auto-advance chain: when the current chain card's video ends, the
  // next eligible card starts. cfg.autoplayIndices is honored for
  // future tuning.
  var autoplayIndices = Array.isArray(cfg.autoplayIndices)
    ? cfg.autoplayIndices
    : [0, 3, 7, 11];
  if (compact6) {
    // Compact mode only renders 6 cards. Lane starts default to reels
    // 1 and 5 (idx 0 and 4) so the two playing videos sit diagonally
    // across the 3x2 grid instead of stacked on top of each other.
    // cfg.autoplayIndices overrides if set.
    autoplayIndices = Array.isArray(cfg.autoplayIndices)
      ? cfg.autoplayIndices.filter(function (i) { return i < 6; })
      : [0, 4];
  }
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

  // Captions can arrive in two shapes per reel:
  //   - reel.captions:          { en: "WEBVTT\n...", es: "..." }  (legacy inline)
  //   - reel.captionsAvailable: ["en", "es"]                       (lazy fetch)
  // For inline shape we parse cues upfront. For captionsAvailable we
  // store an empty placeholder and fetch the VTT the first time the
  // user picks that language for that reel. Either way the union of
  // languages drives the CC menu.
  var captionsEndpoint = cfg.captionsEndpoint || "https://www.getsplashy.com/api/play/captions";
  var capCuesByReel    = [];
  var capLangsByReel   = [];
  // capPendingByReel[reelIdx][lang] = true while a fetch is in flight,
  // so concurrent capRender calls don't double-fetch the same VTT.
  var capPendingByReel = [];
  for (var ci = 0; ci < reels.length; ci++) {
    var perReel = {}; var perReelLangs = []; var perReelPending = {};
    var rc  = reels[ci] && reels[ci].captions;
    var av  = reels[ci] && reels[ci].captionsAvailable;
    if (rc && typeof rc === "object") {
      Object.keys(rc).forEach(function (lang) {
        var vttStr = rc[lang];
        if (typeof vttStr === "string" && vttStr) {
          var parsed = splCapParseVtt(vttStr);
          if (parsed.length) { perReel[lang] = parsed; perReelLangs.push(lang); }
        }
      });
    }
    if (Array.isArray(av)) {
      av.forEach(function (lang) {
        if (typeof lang === "string" && lang && perReelLangs.indexOf(lang) === -1) {
          perReelLangs.push(lang);
        }
      });
    }
    capCuesByReel.push(perReel);
    capLangsByReel.push(perReelLangs);
    capPendingByReel.push(perReelPending);
  }
  var capUnionLangs = [];
  capLangsByReel.forEach(function (arr) {
    arr.forEach(function (l) { if (capUnionLangs.indexOf(l) === -1) capUnionLangs.push(l); });
  });

  // Reel ID matches the server's storage key (djb2 of videoUrl). Used
  // to address the captions endpoint when fetching a VTT.
  function capReelIdFor(url) {
    if (!url) return "";
    var h = 5381;
    for (var i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  // Lazy fetch + parse + cache. Calls onLoaded() once cues exist (or
  // never if the request fails / returns 404). Subsequent calls for
  // the same reel/lang short-circuit and call onLoaded() synchronously.
  function capEnsureCuesLoaded(reelIdx, lang, onLoaded) {
    if (capCuesByReel[reelIdx] && capCuesByReel[reelIdx][lang]) {
      if (typeof onLoaded === "function") onLoaded();
      return;
    }
    if (capLangsByReel[reelIdx].indexOf(lang) === -1) return;
    if (capPendingByReel[reelIdx][lang]) return; // fetch already in flight
    if (!clientId) return;
    var reel = reels[reelIdx];
    if (!reel || !reel.videoUrl) return;
    capPendingByReel[reelIdx][lang] = true;
    var url = captionsEndpoint
      + "?c=" + encodeURIComponent(clientId)
      + "&r=" + encodeURIComponent(capReelIdFor(reel.videoUrl))
      + "&l=" + encodeURIComponent(lang);
    fetch(url, { credentials: "omit" })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) {
        capPendingByReel[reelIdx][lang] = false;
        if (!text) return;
        var parsed = splCapParseVtt(text);
        if (parsed.length) {
          capCuesByReel[reelIdx][lang] = parsed;
          if (typeof onLoaded === "function") onLoaded();
        }
      })
      .catch(function () { capPendingByReel[reelIdx][lang] = false; });
  }
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
      ".sgr-card{position:relative;aspect-ratio:9/16;border-radius:10px;overflow:hidden;background:#1a1a1a;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}",
      // Belt-and-suspenders: also kill long-press callout / selection
      // on the inner video + image elements (iOS Safari sometimes
      // ignores the parent's -webkit-touch-callout for media).
      ".sgr-card video,.sgr-card img{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-tap-highlight-color:transparent!important;pointer-events:auto}",
      ".sgr-poster{position:absolute;inset:0;background-size:cover;background-position:center;background-color:#0f0f0f}",
      ".sgr-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .18s}",
      ".sgr-card.is-playing .sgr-video,.sgr-card.sgr-popped--open .sgr-video{opacity:1}",
      // Soft hover lift on desktop. Touch devices skip the scale so taps
      // don't feel laggy.
      "@media(hover:hover){.sgr-card{transition:transform .18s,box-shadow .18s}.sgr-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.32)}}",
      // Buffering spinner — shown while video is stalled, hidden when
      // data arrives. Sits over the card (z-index between video and
      // controls). 400ms grace before showing so a quick stall on
      // play() doesn't cause flicker.
      ".sgr-loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;z-index:11;pointer-events:none;opacity:0;transition:opacity .2s ease}",
      ".sgr-loading.visible{opacity:1}",
      ".sgr-loading::after{content:\"\";width:20px;height:20px;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);border-top-color:rgba(255,255,255,.95);animation:sgr-spin .8s linear infinite}",
      "@keyframes sgr-spin{to{transform:rotate(360deg)}}",
      "@media(prefers-reduced-motion:reduce){.sgr-loading::after{animation:none}}",
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
      // hideBottomRowDesktop option: only the first .sgr-page (cards 0-3)
      // and the first 2 cards of the second page would render — but the
      // simplest target is "first 6 cards of the flattened grid", which
      // is .sgr-page:nth-child(1) plus the first 2 cells of nth-child(2).
      // Easier: keep the markup intact and hide cards 6-11 by data-idx.
      "@media(min-width:768px){.sgr-widget--top-only .sgr-card[data-idx='6'],.sgr-widget--top-only .sgr-card[data-idx='7'],.sgr-widget--top-only .sgr-card[data-idx='8'],.sgr-widget--top-only .sgr-card[data-idx='9'],.sgr-widget--top-only .sgr-card[data-idx='10'],.sgr-widget--top-only .sgr-card[data-idx='11']{display:none}}",
      // shrinkDesktop option: the widget renders at 70% width on desktop,
      // centered, with proportionally tighter gap + padding. Cards are
      // 1fr columns so they shrink with the container; aspect-ratio:9/16
      // keeps the vertical proportion intact.
      "@media(min-width:768px){.sgr-widget--shrink{max-width:75%;margin-left:auto;margin-right:auto;padding:14px 12px}.sgr-widget--shrink .sgr-grid{gap:11px}}",
      // compact6 option: only 6 cards exist. Desktop renders them as a
      // single 3x2 grid (override grid-template-columns to 3). Mobile
      // uses the default swipeable paging — each .sgr-page contains
      // just 2 cards, so each page shows 2 reels side-by-side and the
      // user swipes through 3 pages. Used by the Studio side-text
      // Grid variant. Dots stay visible on mobile (3 pages = 3 dots),
      // hidden on desktop by the existing .sgr-dots rule.
      "@media(min-width:768px){.sgr-widget--compact .sgr-grid{grid-template-columns:repeat(3,1fr);gap:10px}.sgr-widget--compact{padding:14px 12px}}",
      // Page indicator dots (mobile only).
      // Page dots — same dimensions + behavior as the infinite/stories
      // widget dots so accessibility is consistent across all widgets:
      // 24x24 hit target (well above the WCAG 24x24 minimum), 8.5px
      // visible disc via ::before, 1.35x scale on active.
      ".sgr-dots{display:none;justify-content:center;gap:0;margin-top:10px}",
      "@media(max-width:767px){.sgr-dots{display:flex}}",
      ".sgr-dot{width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;border-radius:50%!important;background:transparent!important;border:none!important;cursor:pointer;padding:0!important;margin:0!important;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent}",
      ".sgr-dot::before{content:\"\";display:block;width:8.5px;height:8.5px;border-radius:50%;background:#ccc;transition:background .25s,transform .25s}",
      ".sgr-dot.is-active::before{background:#D30011;transform:scale(1.35)}",
      ".sgr-dot:focus-visible{outline:2px solid #D30011;outline-offset:2px}",

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
      ".sgr-close-btn,.sgr-pop-mute-btn,.sgr-pop-cc-btn,.sgr-lang-menu,.sgr-cap-overlay,.sgr-pop-title,.sgr-pop-prog,.sgr-pop-time{display:none}",
      ".sgr-card.sgr-popped--open .sgr-close-btn{display:flex}",
      ".sgr-card.sgr-popped--open .sgr-pop-mute-btn{display:flex}",
      ".sgr-card.sgr-popped--open .sgr-pop-cc-btn.has-langs{display:flex}",
      ".sgr-card.sgr-popped--open .sgr-pop-title{display:block}",
      ".sgr-card.sgr-popped--open .sgr-pop-prog{display:flex}",
      // Hide play-icon while popped (the popped card uses its own
      // pause-indicator instead — see .sgr-pause-ind below).
      ".sgr-card.sgr-popped--open .sgr-play-icon{display:none}",
      // Pause indicator: matches the other widgets' style — a circle
      // with two vertical bars overlaid on the video while paused.
      ".sgr-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:14;pointer-events:none;opacity:0;transition:opacity .15s}",
      ".sgr-card.sgr-popped--open.sgr-paused .sgr-pause-ind{opacity:1}",
      ".sgr-pause-circle{width:30px!important;height:30px!important;min-width:30px!important;min-height:30px!important;border-radius:50%!important;background:rgba(0,0,0,.5)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border:1.5px solid rgba(255,255,255,.6)!important;display:flex;align-items:center;justify-content:center;padding:0!important;box-sizing:border-box!important}",
      ".sgr-pause-circle svg{display:block;width:11px!important;height:12px!important}",
      // Close button — top-right corner. Strong reset so host-page
      // CSS can't push the icon off-center.
      ".sgr-close-btn{position:absolute;top:6px;right:6px;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;border-radius:50%!important;background:rgba(0,0,0,.6)!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff;cursor:pointer;align-items:center;justify-content:center;z-index:20;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none;font-size:0;line-height:0;box-shadow:none!important}",
      ".sgr-close-btn:hover{background:rgba(0,0,0,.85)!important}",
      ".sgr-close-btn svg{width:10px!important;height:10px!important;display:block}",
      // Mute button — bottom-right column on popped card.
      ".sgr-pop-mute-btn{position:absolute;bottom:32px;right:8px;width:19px!important;height:19px!important;min-width:19px!important;min-height:19px!important;border-radius:50%!important;background:rgba(0,0,0,.55)!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff;cursor:pointer;align-items:center;justify-content:center;z-index:14;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none;box-shadow:none!important}",
      ".sgr-pop-mute-btn:hover{background:rgba(0,0,0,.8)!important}",
      ".sgr-pop-mute-btn svg{width:9.5px!important;height:9.5px!important;display:block}",
      // CC button — above mute.
      ".sgr-pop-cc-btn{position:absolute;bottom:60px;right:8px;width:19px!important;height:19px!important;min-width:19px!important;min-height:19px!important;border-radius:50%!important;background:rgba(0,0,0,.55)!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff!important;font-family:system-ui,-apple-system,sans-serif!important;font-weight:700!important;font-size:6.5px!important;line-height:1!important;letter-spacing:.04em!important;cursor:pointer;align-items:center;justify-content:center;z-index:14;padding:0!important;margin:0!important;-webkit-appearance:none;appearance:none;box-shadow:none!important}",
      ".sgr-pop-cc-btn:hover{background:rgba(0,0,0,.8)!important}",
      ".sgr-pop-cc-btn.is-active{background:#fff!important;color:#000!important;border-color:rgba(0,0,0,.35)!important}",
      ".sgr-pop-cc-btn.is-active:hover{background:#f0f0f0!important}",
      // Mobile: mute + CC buttons 10% smaller (22 -> 20), icons scale.
      // Lives AFTER the base rules so source-order wins on mobile.
      "@media(max-width:767px){.sgr-pop-mute-btn{width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important}.sgr-pop-mute-btn svg{width:10px!important;height:10px!important}.sgr-pop-cc-btn{width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;font-size:6.8px!important}}",
      // Language menu — pops left of the CC button when open.
      // max-height + overflow-y so a 5-item menu stays inside the
      // small popped card without overflowing top/bottom.
      ".sgr-lang-menu{position:absolute;bottom:58px;right:36px;flex-direction:column;background:rgba(0,0,0,.95);border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:1px;z-index:15;min-width:60px;max-height:65%;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.45)}",
      ".sgr-card.sgr-popped--open .sgr-lang-menu.visible{display:flex}",
      // Strong reset on the menu buttons so host-page CSS (typical
      // .button or button{} rules on the embed site) can't blow up
      // their size. !important on the few that really matter.
      ".sgr-lang-opt{display:flex!important;align-items:center;padding:3px 7px!important;margin:0!important;background:transparent!important;border:0!important;outline:0!important;-webkit-appearance:none;appearance:none;color:#fff!important;font-family:system-ui,-apple-system,sans-serif!important;font-size:8.5px!important;font-weight:500!important;line-height:1.2!important;letter-spacing:0!important;cursor:pointer;border-radius:3px;text-align:left;width:100%;min-height:0!important;height:auto!important;text-transform:none!important;box-shadow:none!important}",
      ".sgr-lang-opt:hover{background:rgba(255,255,255,.08)!important}",
      ".sgr-lang-opt.is-selected{background:#fff!important;color:#000!important}",
      "@media(max-width:767px){.sgr-lang-menu{min-width:54px}.sgr-lang-opt{font-size:7.5px!important;padding:3px 6px!important}}",
      // Caption overlay (only visible while popped AND a language is
      // selected — class .visible is toggled by capRender). Strong
      // !important so host-page CSS can't inflate the font.
      ".sgr-cap-overlay{position:absolute;left:5%;right:5%;bottom:23%;min-height:11%;align-items:center;justify-content:center;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif!important;font-size:7px!important;font-weight:600!important;line-height:1.28!important;letter-spacing:0!important;color:#fff!important;background:rgba(0,0,0,.91);padding:3px 7px!important;border-radius:5px;z-index:13;pointer-events:none;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,.6)}",
      ".sgr-card.sgr-popped--open .sgr-cap-overlay.visible{display:flex}",
      "@media(max-width:767px){.sgr-cap-overlay{font-size:7.5px!important;padding:3px 6px!important;line-height:1.25!important;min-height:10%}}",
      // Press-and-hold 2x speed indicator — same style as the other
      // widgets. Shown while .visible, hidden otherwise.
      ".sgr-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:29px!important;height:29px!important;min-width:29px!important;min-height:29px!important;box-sizing:border-box!important;background:rgba(0,0,0,.55)!important;color:#fff!important;font-size:9px!important;font-weight:700!important;line-height:1!important;padding:0!important;border-radius:50%!important;border:1.5px solid rgba(255,255,255,.3)!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:16;pointer-events:none;opacity:0;transition:opacity .15s;font-family:system-ui,-apple-system,sans-serif!important;text-align:center!important}",
      ".sgr-speed.visible{opacity:1}",
      // Title — bottom-left while popped. Allowed to wrap to TWO
      // lines with ellipsis-after-line-2 so longer titles still get
      // shown without crashing into the caption band or the scrub
      // bar. !important on font + line-height so host-page typography
      // can't bloat it.
      ".sgr-pop-title{position:absolute;left:8px;right:38px;bottom:25px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif!important;font-size:8px!important;font-weight:700!important;line-height:1.2!important;letter-spacing:0!important;color:#fff!important;text-shadow:0 1px 3px rgba(0,0,0,.7)!important;pointer-events:none;z-index:13;margin:0!important;padding:0!important;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;white-space:normal;text-transform:none!important}",
      ".sgr-card.sgr-popped--open .sgr-pop-title{display:-webkit-box}",
      "@media(max-width:767px){.sgr-pop-title{font-size:7.5px!important;bottom:22px}}",
      // Time counter (e.g. "0:08 / 0:22") just above the scrub bar, right-aligned.
      ".sgr-pop-time{position:absolute;right:8px;bottom:14px;font-family:system-ui,-apple-system,sans-serif!important;font-size:8px!important;font-weight:600!important;line-height:1!important;letter-spacing:.02em!important;color:rgba(255,255,255,.95)!important;text-shadow:0 1px 3px rgba(0,0,0,.55)!important;z-index:14;pointer-events:none;font-variant-numeric:tabular-nums;margin:0!important;padding:0!important;text-transform:none!important;background:transparent!important;border:0!important}",
      ".sgr-card.sgr-popped--open .sgr-pop-time{display:block}",
      "@media(max-width:767px){.sgr-pop-time{font-size:7.5px!important;bottom:12px}}",
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

  // Build pages. Default: 3 pages × 4 cards (mobile shows 2x2 per page).
  // compact6: 3 pages × 2 cards (mobile shows 2 side-by-side per page,
  // user swipes through 3 pages of 2). Desktop in either mode uses
  // display:contents on .sgr-page so all cards flow into the single
  // top-level grid.
  var slotsPerPage = compact6 ? 2 : 4;
  var pagesHTML = "";
  for (var pageIdx = 0; pageIdx < 3; pageIdx++) {
    var cardsHTML = "";
    for (var slot = 0; slot < slotsPerPage; slot++) {
      var reelIdx = pageIdx * slotsPerPage + slot;
      cardsHTML += '<div class="sgr-card" data-idx="' + reelIdx + '"></div>';
    }
    pagesHTML += '<div class="sgr-page">' + cardsHTML + '</div>';
  }
  container.innerHTML =
    '<div class="sgr-widget' +
      (hideBottomRowDesktop ? ' sgr-widget--top-only' : '') +
      (shrinkDesktop ? ' sgr-widget--shrink' : '') +
      (compact6 ? ' sgr-widget--compact' : '') +
    '">' +
      '<div class="sgr-grid" role="list">' + pagesHTML + '</div>' +
      '<div class="sgr-dots" role="tablist" aria-label="Grid pages">' +
        '<button type="button" class="sgr-dot is-active" role="tab" aria-label="Page 1" aria-selected="true"></button>' +
        '<button type="button" class="sgr-dot" role="tab" aria-label="Page 2" aria-selected="false"></button>' +
        '<button type="button" class="sgr-dot" role="tab" aria-label="Page 3" aria-selected="false"></button>' +
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
    // Lanes can advance into any card, so no video should loop —
    // they each need to fire 'ended' for the lane to step forward.
    // Hover replays from the start (startCardPlay resets currentTime).
    video.loop = false;
    // preload='metadata' on EVERY card. moov atom is fetched at init
    // (~60KB per card) so hover-play and pop-out start in ~200-500ms
    // instead of doing a cold DNS+TLS+moov fetch on first interaction.
    // We considered preload='auto' for the autoplay-lane starters but
    // at ~1min/11MB per 540p clip, 4 lanes = ~45MB on page load —
    // too aggressive even on broadband. The native progressive-
    // download path (browser pulls bytes ahead of playback) is
    // fast enough on a primed connection.
    video.preload = "metadata";
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

    // Buffering spinner — same lifecycle pattern as the infinite widget.
    // 400ms grace before showing so the brief 'waiting' that fires at
    // the start of every play() doesn't cause a flash.
    var loadingEl = document.createElement("div");
    loadingEl.className = "sgr-loading";
    loadingEl.setAttribute("role", "status");
    loadingEl.setAttribute("aria-label", "Loading video");
    el.appendChild(loadingEl);
    // Buffer-spinner logic. HLS fires lots of brief 'waiting' events
    // at segment boundaries even when playback is healthy, so the
    // grace period is generous (1000ms) and we suppress the spinner
    // entirely if the video already has enough data to play through
    // a brief stall (readyState >= HAVE_FUTURE_DATA = 3).
    var bufferTimer = null;
    function showBuffering() {
      if (bufferTimer) clearTimeout(bufferTimer);
      bufferTimer = setTimeout(function () {
        // Re-check at fire time — if data has arrived (readyState 3+)
        // or the video is no longer paused-on-data, skip the spinner.
        if (video.readyState >= 3) return;
        loadingEl.classList.add("visible");
      }, 1000);
    }
    function hideBuffering() {
      if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
      loadingEl.classList.remove("visible");
    }
    video.addEventListener("waiting",  showBuffering);
    video.addEventListener("stalled",  showBuffering);
    video.addEventListener("playing",  hideBuffering);
    video.addEventListener("canplay",  hideBuffering);
    video.addEventListener("error",    hideBuffering);
    // HLS streams briefly flap between buffered and not — also hide
    // when timeupdate fires (proves playback is actively progressing).
    video.addEventListener("timeupdate", hideBuffering);

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
      '<div class="sgr-pause-ind"><div class="sgr-pause-circle">' +
        '<svg width="14" height="16" viewBox="0 0 18 20" fill="none">' +
          '<rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/>' +
          '<rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/>' +
        '</svg>' +
      '</div></div>' +
      '<div class="sgr-speed">2&times;</div>' +
      '<div class="sgr-pop-time">0:00 / 0:00</div>' +
      '<div class="sgr-pop-prog" role="slider" tabindex="0" aria-label="Seek video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="sgr-pop-prog-track"></div>' +
        '<div class="sgr-pop-prog-fill"></div>' +
      '</div>'
    );

    var cardObj = {
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
      popped:     false,
      // Source attachment state. Set by attachVideoSource: "hlsjs"
      // when an Hls instance owns the video, "native-hls" when Safari
      // is playing the playlist directly, "mp4" otherwise. The MP4
      // SD/HD swap on popout only runs when usingHls is falsy.
      usingHls:   false,
      hlsInstance: null
    };
    cards.push(cardObj);
    attachVideoSource(video, reel, cardObj);
  });

  // viaAutoplay = true when this start is part of an autoplay lane
  // (initial 4-lane play, lane rotation on 'ended', or the mobile
  // single lane). Those plays are passive — they happen when the
  // grid scrolls into view, without any user action — so we skip
  // both the qualified-play counter and the watch-time tracker.
  // Hover/click paths leave viaAutoplay false so user-initiated
  // playback still feeds analytics.
  function startCardPlay(card, viaAutoplay) {
    if (!card.video) return;
    if (!card.el.classList.contains("is-playing")) {
      card.el.classList.add("is-playing");
      if (card.icon) card.icon.classList.add("hidden");
      try { card.video.currentTime = 0; } catch (e) {}
      var p = card.video.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked; silent */ });
      // Splshy analytics: "qualified play" after 3s, only for
      // user-initiated playback.
      if (!viaAutoplay && analyticsOn && !card.playedFor3s && card.reel) {
        if (card.watchTimer) clearTimeout(card.watchTimer);
        card.watchTimer = setTimeout(function () {
          if (!card.el.classList.contains("is-playing")) return;
          card.playedFor3s = true;
          trackPlay(reelIdFor(card.reel.videoUrl));
        }, 3000);
      }
      // Only start the watch-time clock for user-initiated plays;
      // autoplay leaves watchStart null so stopCardPlay skips the
      // trackWatch call.
      if (!viaAutoplay && card.watchStart == null) card.watchStart = Date.now();
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
  // True when an index belongs to a row currently hidden on this layout.
  // On desktop with hideBottomRowDesktop, indices >=6 are off-screen and
  // ineligible for lane play / rotation. Mobile ignores this entirely.
  function laneIdxHidden(idx) {
    if (compact6 && idx >= 6) return true;
    return hideBottomRowDesktop && !isMobileLayout() && idx >= 6;
  }
  autoplayIndices.forEach(function (startIdx) {
    var card = cards[startIdx];
    if (card && card.video) lanes.push({ current: startIdx });
  });

  function startAllLanes() {
    if (lanesActive || isMobileLayout() || !lanes.length) return;
    lanesActive = true;
    lanes.forEach(function (lane) {
      if (laneIdxHidden(lane.current)) return;
      var c = cards[lane.current];
      if (c && c.video) startCardPlay(c, true);
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
        if (nc && nc.video && !laneIdxHidden(next)) break;
        next = (next + 1) % cards.length;
        tries++;
      }
      lanes[li].current = next;
      var newCard = cards[next];
      if (newCard && newCard.video) startCardPlay(newCard, true);
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
  // On mobile, ONE lane plays at a time. Per-mode slot setup:
  //   - 12-card (4 cards per page, 2x2): slot 1 = top-right, 2 =
  //     bottom-left. Alternates 1 <-> 2 within the visible page.
  //   - compact6 (2 cards per page, side-by-side): slot 1 = right,
  //     0 = left. Alternates 1 <-> 0 within the visible page.
  // In both modes the lane resets to slot 1 (right) on swipe.
  var mobileLaneActive = false;
  var mobileSlotsPerPage = compact6 ? 2 : 4;
  var mobileLaneAltSlot  = compact6 ? 0 : 2;
  var mobileLaneSlot     = 1;
  function mobileVisiblePage() {
    if (!grid) return 0;
    var w = grid.clientWidth || 1;
    return Math.round(grid.scrollLeft / w);
  }
  function mobileLaneCard() {
    var page = mobileVisiblePage();
    var idx  = page * mobileSlotsPerPage + mobileLaneSlot;
    var card = cards[idx];
    if (card && card.video) return card;
    // Slot empty? Try the OTHER slot on the same page.
    var alt = page * mobileSlotsPerPage + (mobileLaneSlot === 1 ? mobileLaneAltSlot : 1);
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
    startCardPlay(card, true);
  }
  function onMobileLaneCardEnded(card) {
    if (!mobileLaneActive) return;
    stopCardPlay(card);
    // Alternate within current page: 1 <-> altSlot (2 in 12-card mode,
    // 0 in compact6 mode).
    mobileLaneSlot = (mobileLaneSlot === 1 ? mobileLaneAltSlot : 1);
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

  // ── Network-aware autoplay gate ───────────────────
  // Skip autoplay entirely on slow connections (effectiveType 2g/3g
  // or the user's data-saver pref). The grid still renders posters
  // and the user can tap to popout — only the eager-stream lanes
  // are suppressed. We re-evaluate when the network changes so a
  // user who reconnects to WiFi mid-page gets autoplay back.
  function isSlowConnection() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;
    if (c.saveData) return true;
    if (c.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return true;
    return false;
  }
  function tryStartLanes() {
    if (isSlowConnection()) return;
    if (document.hidden) return;
    if (isMobileLayout()) startMobileLane();
    else                  startAllLanes();
  }

  if (typeof IntersectionObserver === "function") {
    // threshold 0.7 — autoplay fires only when the widget is mostly
    // (70%+) on-screen, not just barely peeking above the fold.
    // Tracks intersectionRatio against the threshold list so we can
    // also stop when the user scrolls past the 70% mark in either
    // direction.
    var rootIo = new IntersectionObserver(function (entries) {
      var e = entries[0]; if (!e) return;
      var nowVisible = e.intersectionRatio >= 0.7;
      if (nowVisible === inViewport) return;
      inViewport = nowVisible;
      if (inViewport) {
        tryStartLanes();
      } else {
        stopAllLanes();
        stopMobileLane();
      }
    }, { threshold: [0, 0.7] });
    rootIo.observe(container);
  }

  // Tab/window visibility: pause every lane when the page is hidden
  // (saves data + CPU when the user has the widget in a background
  // tab). Resume on visibility return if the grid is still in view
  // and the connection is OK.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAllLanes();
      stopMobileLane();
    } else if (inViewport) {
      tryStartLanes();
    }
  });

  // Network status change: re-evaluate whether we should be autoplaying
  // when the connection switches (e.g. cellular -> WiFi or vice versa).
  try {
    var navConn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (navConn && typeof navConn.addEventListener === "function") {
      navConn.addEventListener("change", function () {
        if (isSlowConnection()) {
          stopAllLanes();
          stopMobileLane();
        } else if (inViewport && !document.hidden) {
          tryStartLanes();
        }
      });
    }
  } catch (e) {}

  // ── Hover-to-play (desktop only) ───────────────────
  // Hover plays any card on demand. mouseleave stops it, UNLESS the
  // card is the currently-active chain card (in which case stopping
  // would silently kill the chain). Non-chain cards always stop on
  // mouseleave.
  // Hover-preload helper. When the card has a separate full-res URL
  // (videoUrlSd != videoUrl), warming the HTTP cache for the HD file
  // on hover means the popout's src swap is instant when the user
  // eventually clicks. Once-per-card flag avoids re-firing if the
  // user mouseenters repeatedly. The hidden <video> is removed after
  // 30s — the browser's HTTP cache holds the bytes from there on.
  // Hover-preload the MP4 URL that the popout will use:
  //   - HLS cards: popout swaps HLS -> MP4; preload the MP4 so the
  //     swap is instant on click (otherwise we eat 1-3s of cold
  //     network fetch on the first popout of every card).
  //   - MP4 cards with SD/HD split: preload the HD URL since popout
  //     swaps SD -> HD.
  //   - Pure MP4 cards (no HLS, no SD): no preload needed; the same
  //     src plays in both grid and popout.
  function preloadHd(card) {
    if (card.hdPreloaded) return;
    var r = card.reel;
    if (!r) return;
    // Pick the URL the popout will use.
    var popoutUrl = null;
    if (r.videoUrlHls) {
      popoutUrl = r.videoUrl || r.videoUrlSd;
    } else if (r.videoUrlSd && r.videoUrl && r.videoUrlSd !== r.videoUrl) {
      popoutUrl = r.videoUrl;
    }
    if (!popoutUrl) return;
    card.hdPreloaded = true;
    var pv = document.createElement("video");
    pv.muted = true;
    pv.playsInline = true;
    pv.preload = "auto";
    pv.style.cssText = "position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;left:-9999px!important;top:0";
    pv.src = popoutUrl;
    document.body.appendChild(pv);
    setTimeout(function () { try { pv.remove(); } catch (e) {} }, 30000);
  }

  cards.forEach(function (c) {
    if (!c.video) return;
    c.el.addEventListener("mouseenter", function () {
      if (isMobileLayout()) return;
      // Preload the HD URL regardless of poppedCard state — even if
      // a popout is open, this primes the cache for the NEXT pop.
      preloadHd(c);
      if (poppedCard) return;     // popout owns the playback while open
      c.hovered = true;
      startCardPlay(c);
    });
    c.el.addEventListener("mouseleave", function () {
      if (isMobileLayout()) return;
      if (poppedCard) return;     // never tear down a popped card on mouseleave
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
          var on = (i === page);
          dots[i].classList.toggle("is-active", on);
          dots[i].setAttribute("aria-selected", on ? "true" : "false");
        }
      }
      if (page !== lastVisiblePage) {
        lastVisiblePage = page;
        // New page → reset lane to top-right of this page.
        mobileLaneSlot = 1;
        if (mobileLaneActive) playMobileLane();
      }
    });
    // Tap a dot to jump to that page.
    if (dots && dots.length) {
      for (var di = 0; di < dots.length; di++) {
        (function (page) {
          dots[page].addEventListener("click", function (e) {
            e.preventDefault();
            if (!grid) return;
            var w = grid.clientWidth || 1;
            grid.scrollTo({ left: page * w, behavior: "smooth" });
          });
        })(di);
      }
    }
  }

  // ── Popout (single-widget pattern: card scales 1.3x in place) ────
  // Shared backdrop only — the popped card itself is reparented to
  // document.body so its transform isn't clipped by any overflow on
  // the host page. Controls live PER CARD (close, mute, CC, title,
  // progress) and are revealed by a CSS class on the card.
  // Both scales bumped 20% over their previous values.
  // Desktop still ends up ~20% larger than mobile because we scaled
  // both by the same factor.
  var POPOUT_SCALE_MOBILE  = 2.04;
  var POPOUT_SCALE_DESKTOP = 2.45;
  function currentPopoutScale() {
    return isMobileLayout() ? POPOUT_SCALE_MOBILE : POPOUT_SCALE_DESKTOP;
  }
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
    // Mark the lanes inactive too — otherwise closePopout sees
    // lanesActive===true and skips the restart.
    cards.forEach(function (other) {
      if (other === c) return;
      if (other.video) stopCardPlay(other);
    });
    lanesActive = false;

    // Measure the card's current on-screen rect BEFORE lifting it.
    var r  = c.el.getBoundingClientRect();
    var w  = r.width, h = r.height;
    var POPOUT_SCALE = currentPopoutScale();
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

    // VisitRaleigh has ancestor elements with transform/will-change
    // that trap position:fixed inside them, so we MUST reparent to
    // body for the popout to render correctly.
    //
    // For hls.js + DOM reparent: even with detachMedia + video.load()
    // + attachMedia the MediaSource is unreliable in Chrome (~50%
    // freeze rate). Switch strategy: HLS is great for the grid
    // (adaptive bitrate, multiple simultaneous streams), but for
    // the SINGLE-stream popout it's not worth fighting the issue.
    // Tear down hls.js entirely and play the MP4 URL instead — one
    // stream, predictable playback. Restored to HLS in closePopout.
    // Invalidate any pending HLS attach so a late async callback from
    // a previous open/close cycle can't race the MP4 swap below.
    c.attachGen = (c.attachGen || 0) + 1;
    var savedTime = 0;
    var popoutSwappedFromHls = false;
    if (c.usingHls && c.hlsKind === "hlsjs" && c.hlsInstance) {
      savedTime = c.video.currentTime || 0;
      try { c.hlsInstance.destroy(); } catch (e) {}
      c.hlsInstance = null;
      c.usingHls   = false;
      c.hlsKind    = null;
      popoutSwappedFromHls = true;
    }
    try { c.video.pause(); } catch (e) {}
    if (popoutSwappedFromHls) {
      // Swap to MP4. Reset video element fully first so the prior
      // MediaSource binding from hls.js can't linger.
      var mp4Url = c.reel.videoUrl || c.reel.videoUrlSd;
      if (mp4Url) {
        try { c.video.removeAttribute("src"); c.video.load(); } catch (e) {}
        c.video.src = mp4Url;
        // Note: assigning src triggers an implicit load — no need to
        // call load() again, which can confuse the event sequence.
      }
      c.popoutOriginallyHls = true;
    } else {
      try { c.video.load(); } catch (e) {}
    }

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
    // Seed the timer text with whatever we know right now (duration
    // may not be loaded yet — the loadedmetadata listener will fill
    // it in once it is).
    var tEl = c.el.querySelector(".sgr-pop-time");
    if (tEl) {
      var d0 = c.video.duration;
      var fmt0 = function (s) {
        if (!isFinite(s) || s < 0) s = 0;
        var m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return m + ":" + (sec < 10 ? "0" : "") + sec;
      };
      tEl.textContent = fmt0(c.video.currentTime) + " / " +
                        fmt0(isFinite(d0) ? d0 : 0);
    }
    c.video.muted = false;            // popout starts unmuted
    syncCardMuteIcon(c);
    capBuildMenuForCard(c);
    capSyncCardBtnState(c);

    // Single play path. Whether the card is now on MP4 (via the
    // HLS->MP4 swap above), native HLS, or pure MP4 from init, the
    // video is paused with the right src — call play() with autoplay-
    // fallback to muted if the browser blocks audio.
    function popPlay() {
      var p = c.video.play();
      if (p && p.catch) p.catch(function () {
        c.video.muted = true; syncCardMuteIcon(c);
        var p2 = c.video.play(); if (p2 && p2.catch) p2.catch(function () {});
      });
    }
    if (popoutSwappedFromHls) {
      // CRITICAL: call play() IMMEDIATELY rather than waiting for
      // canplay/loadedmetadata. Chrome's autoplay policy ties the
      // user-gesture token to the synchronous tail of the click
      // event — if we await an async event (which can take 1-3s
      // for a fresh MP4 fetch), the gesture is gone and play()
      // gets rejected with "play() failed because the user didn't
      // interact with the document first". That's the
      // "buffer-then-pause" symptom: data loads, then play()
      // rejects silently. The browser internally waits for data
      // before actually starting playback, so calling play() with
      // no buffered data is fine — it just delays playback start
      // until canplay-equivalent state is reached.
      popPlay();
      // Seek-back to where the lane left off, once metadata is
      // parsed enough to know where to seek to.
      if (savedTime > 0.1) {
        var onMeta = function () {
          c.video.removeEventListener("loadedmetadata", onMeta);
          if (poppedCard !== c) return;
          try { c.video.currentTime = savedTime; } catch (e) {}
        };
        c.video.addEventListener("loadedmetadata", onMeta);
      }
    } else {
      popPlay();
    }

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
    // Defensive: clear any in-flight press-and-hold state.
    var spd = c.el.querySelector(".sgr-speed");
    if (spd) spd.classList.remove("visible");
    try { c.video.playbackRate = 1; } catch (e) {}
    c.el.classList.remove("sgr-paused");

    // Pause the popped card now; reset state via stopCardPlay.
    try { c.video.pause(); } catch (e) {}
    c.video.muted = true;
    c.el.classList.remove("is-playing");
    if (c.icon) c.icon.classList.remove("hidden");

    // Restore the original playback source for grid use. Three cases:
    //   - Card was HLS originally: tear down the popout's MP4, build a
    //     fresh hls.js instance, re-attach. Card streams adaptive
    //     bitrate in the grid again.
    //   - Card was MP4 with SD/HD split: swap back to SD URL so any
    //     subsequent lane rotation streams low-res.
    //   - Pure MP4 (no HLS, no SD): nothing to swap.
    if (c.popoutOriginallyHls && c.reel.videoUrlHls) {
      c.popoutOriginallyHls = false;
      // Tear down whatever the popout was using and rebuild HLS.
      try { c.video.removeAttribute("src"); c.video.load(); } catch (e) {}
      attachVideoSource(c.video, c.reel, c);
    } else if (!c.usingHls &&
               c.reel.videoUrlSd && c.reel.videoUrlSd !== c.reel.videoUrl &&
               c.video.src !== c.reel.videoUrlSd) {
      c.video.src = c.reel.videoUrlSd;
    }

    setTimeout(function () {
      c.el.classList.remove("sgr-popped");
      c.el.style.transition = "";
      c.el.style.transform  = "";
      c.el.style.transformOrigin = "";
      c.el.style.left = c.el.style.top = "";
      c.el.style.width = c.el.style.height = "";
      if (poppedHold && poppedHold.parentNode) {
        // No-reparent path: c.el is already in its grid slot, just
        // adjacent to the placeholder. Reparent path (if ever
        // re-enabled): c.el is in body and needs to be moved back.
        // Defensive — works for both.
        if (c.el.parentNode !== poppedHold.parentNode) {
          poppedHold.parentNode.insertBefore(c.el, poppedHold);
        }
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

    // Card click → pop out (unless already popped). When already
    // popped, clicking the video area toggles play/pause; clicks on
    // controls are excluded so they keep their own behavior.
    c.el.addEventListener("click", function (e) {
      if (c._swallowClick && c._swallowClick()) { e.stopPropagation(); return; }
      if (poppedCard === c) {
        if (e.target.closest && (
              e.target.closest(".sgr-close-btn") ||
              e.target.closest(".sgr-pop-mute-btn") ||
              e.target.closest(".sgr-pop-cc-btn") ||
              e.target.closest(".sgr-lang-menu") ||
              e.target.closest(".sgr-pop-prog"))) return;
        if (c.video.paused) {
          var pp = c.video.play();
          if (pp && pp.catch) pp.catch(function () {});
        } else {
          c.video.pause();
        }
        return;
      }
      if (e.target.closest && e.target.closest(".sgr-lang-menu")) return;
      openPopout(c);
    });
    // Reflect paused/playing state on the card so the play-circle cue
    // shows whenever the video is paused while popped.
    c.video.addEventListener("pause", function () {
      if (poppedCard === c) c.el.classList.add("sgr-paused");
    });
    c.video.addEventListener("play", function () {
      c.el.classList.remove("sgr-paused");
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

    // Progress bar — drag-to-scrub (mouse + touch). mousedown/touchstart
    // on the bar starts a drag; document-level mousemove/touchmove
    // continuously seek while the pointer stays down. Mouseup/touchend
    // ends the drag. Quick clicks still work (mousedown→seek, mouseup
    // immediately after, no movement). If duration isn't loaded yet we
    // cache the last pct and apply once 'loadedmetadata' fires.
    var prog = c.el.querySelector(".sgr-pop-prog");
    var dragging = false;
    function getPct(e) {
      var r = prog.getBoundingClientRect();
      var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var p = (x - r.left) / r.width;
      if (p < 0) p = 0; if (p > 1) p = 1;
      return p;
    }
    function seekTo(p) {
      if (isFinite(c.video.duration) && c.video.duration > 0) {
        c.video.currentTime = p * c.video.duration;
      } else {
        var once = function () {
          c.video.currentTime = p * c.video.duration;
          c.video.removeEventListener("loadedmetadata", once);
        };
        c.video.addEventListener("loadedmetadata", once);
      }
    }
    if (prog) {
      prog.addEventListener("mousedown", function (e) {
        e.stopPropagation(); e.preventDefault();
        dragging = true;
        seekTo(getPct(e));
      });
      prog.addEventListener("touchstart", function (e) {
        e.stopPropagation();
        dragging = true;
        seekTo(getPct(e));
      }, { passive: true });
      document.addEventListener("mousemove", function (e) {
        if (!dragging || poppedCard !== c) return;
        seekTo(getPct(e));
      });
      document.addEventListener("touchmove", function (e) {
        if (!dragging || poppedCard !== c) return;
        seekTo(getPct(e));
      }, { passive: true });
      document.addEventListener("mouseup",     function () { dragging = false; });
      document.addEventListener("touchend",    function () { dragging = false; });
      document.addEventListener("touchcancel", function () { dragging = false; });
    }

    // ── Press-and-hold for 2× speed ─────────────────
    // Same pattern as the other widgets: 350ms hold on the popped
    // card flips playbackRate to 2 and shows a "2×" indicator over
    // the video. Release returns to 1×. Clicks on controls (CC,
    // mute, close, progress, lang menu) are excluded so they keep
    // their normal behavior.
    var holdTimer = null, holding = false, swallowNextClick = false;
    var speedInd = c.el.querySelector(".sgr-speed");
    function onTargetIsControl(target) {
      if (!target || !target.closest) return false;
      return !!(target.closest(".sgr-close-btn") ||
                target.closest(".sgr-pop-mute-btn") ||
                target.closest(".sgr-pop-cc-btn") ||
                target.closest(".sgr-lang-menu") ||
                target.closest(".sgr-pop-prog"));
    }
    function startHold() {
      if (holding) return;
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(function () {
        holding = true;
        try { c.video.playbackRate = 2; } catch (e) {}
        if (speedInd) speedInd.classList.add("visible");
      }, 350);
    }
    function endHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (!holding) return;
      holding = false;
      swallowNextClick = true;
      try { c.video.playbackRate = 1; } catch (e) {}
      if (speedInd) speedInd.classList.remove("visible");
      setTimeout(function () { swallowNextClick = false; }, 60);
    }
    c.el.addEventListener("mousedown", function (e) {
      if (poppedCard !== c) return;
      if (onTargetIsControl(e.target)) return;
      startHold();
    });
    c.el.addEventListener("mouseup",    endHold);
    c.el.addEventListener("mouseleave", endHold);
    c.el.addEventListener("touchstart", function (e) {
      if (poppedCard !== c) return;
      if (onTargetIsControl(e.target)) return;
      startHold();
    }, { passive: true });
    c.el.addEventListener("touchend",    endHold);
    c.el.addEventListener("touchcancel", endHold);

    // Stash swallowNextClick getter on the card so the click handler
    // (registered earlier above) can ignore the click that fires
    // immediately after press-and-hold release.
    c._swallowClick = function () { return swallowNextClick; };

    // timeupdate → update progress fill + timer + captions, while popped.
    var timeEl = c.el.querySelector(".sgr-pop-time");
    function fmtT(s) {
      if (!isFinite(s) || s < 0) s = 0;
      var m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return m + ":" + (sec < 10 ? "0" : "") + sec;
    }
    function refreshTimeText() {
      if (!timeEl) return;
      var d = c.video.duration;
      timeEl.textContent = fmtT(c.video.currentTime) + " / " +
                           fmtT(isFinite(d) ? d : 0);
    }
    c.video.addEventListener("loadedmetadata", refreshTimeText);
    c.video.addEventListener("timeupdate", function () {
      if (poppedCard !== c) return;
      if (c.video.duration) {
        var pct = (c.video.currentTime / c.video.duration) * 100;
        var fill = c.el.querySelector(".sgr-pop-prog-fill");
        if (fill) fill.style.width = pct + "%";
        if (prog) prog.setAttribute("aria-valuenow", Math.round(pct));
      }
      refreshTimeText();
      capRenderForCard(c, false);
    });
    c.video.addEventListener("seeked", function () {
      if (poppedCard !== c) return;
      refreshTimeText();
      capRenderForCard(c, true);
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
    // Cues not loaded yet but lang IS available for this reel — kick
    // off a lazy fetch and bail. Once the VTT arrives the resolver
    // calls capRender again to display it.
    if (!cues && capSelected && capLangsByReel[c.idx] && capLangsByReel[c.idx].indexOf(capSelected) !== -1) {
      capEnsureCuesLoaded(c.idx, capSelected, function () {
        if (poppedCard === c) capRenderForCard(c, true);
      });
    }
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
