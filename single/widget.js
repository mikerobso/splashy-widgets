(function () {

  /* ====================================================
     Splshy Single Reel Widget — Hosted Version
     splshy.com/single/widget.js

     Usage on any page:

     <div id="splshy-single"></div>
     <script>
       window.SPLSHY_SINGLE = {
         containerId:   "splshy-single",
         followerCount: "118K followers",
         igUrl:         "https://www.instagram.com/visitraleigh/",
         logoUrl:       "",
         logoRing:      "#D30011",
         videoUrl:      "https://...",
         posterUrl:     "https://...",
         label:         "Reel Title"
       };
     </script>
     <script src="https://splshy.com/single/widget.js"></script>
  ==================================================== */

  var cfg           = window.SPLSHY_SINGLE || {};
  // Host whitelist: see infinite widget for the longer rationale. Hardcoded
  // list maintained here; add new client domains and push to deploy.
  // cfg.allowedOrigins overrides per-embed for edge cases.
  var ALLOWED_HOSTS = [
    "www.visitraleigh.com",
    "www.splshy.com",          // splshy.com demos / landing pages
    "www.getsplashy.com",      // builder preview (future)
    "*.simpleviewcms.com"      // SimpleView CMS preview environments.
  ];
  var allowedOrigins = cfg.allowedOrigins || ALLOWED_HOSTS;
  if (allowedOrigins.length) {
    var host = (window.location && window.location.hostname) || "";
    var isDev = !host || host === "localhost" || host === "127.0.0.1" || /\.local$/i.test(host);
    var allowed = allowedOrigins.some(function(o){
      if (o === host) return true;
      if (o.charAt(0) === "*" && o.charAt(1) === ".") {
        var suffix = o.slice(1);
        return host.length > suffix.length && host.slice(-suffix.length) === suffix;
      }
      return false;
    });
    if (!isDev && !allowed) {
      try { console.warn("SPLSHY single: host '" + host + "' not in allowedOrigins ["+allowedOrigins.join(", ")+"], widget will not render."); } catch(e){}
      return;
    }
  }
  var containerId   = cfg.containerId   || "splshy-single";
  var followerCount = cfg.followerCount || "";
  var igUrl         = cfg.igUrl         || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl       || "";
  var logoRing      = cfg.logoRing      || "#D30011";
  var videoUrl      = cfg.videoUrl      || "";
  var posterUrl     = cfg.posterUrl     || "";
  var label         = cfg.label         || "";
  // Splshy-native analytics (Phase 0). Fires "play" events to
  // getsplashy.com once a video reaches 3s of playback. Requires
  // cfg.clientId; harmless no-op without it. cfg.analytics === false
  // opts out per-embed; default on.
  var clientId        = cfg.clientId        || "";
  var analyticsOn     = (cfg.analytics !== false) && !!clientId;
  var analyticsUrl    = cfg.analyticsEndpoint || "https://www.getsplashy.com/api/analytics/events";
  var _splTrackQueue  = [];
  var _splTrackTimer  = null;
  function splTrackFlush(){
    if (!_splTrackQueue.length) return;
    var batch = _splTrackQueue.splice(0, _splTrackQueue.length);
    var payload = JSON.stringify({ clientId: clientId, events: batch });
    try {
      // sendBeacon with text/plain skips CORS preflight AND survives
      // page unload. We never read the response anyway.
      var blob = new Blob([payload], { type: "text/plain" });
      if (navigator.sendBeacon && navigator.sendBeacon(analyticsUrl, blob)) return;
    } catch (e) {}
    // Fallback for older browsers: best-effort fetch, no await.
    try { fetch(analyticsUrl, { method: "POST", body: payload, keepalive: true }); } catch (e) {}
  }
  function splTrackPlay(widgetId, reelId){
    if (!analyticsOn || !widgetId || !reelId) return;
    _splTrackQueue.push({ type: "play", widgetId: widgetId, reelId: reelId, ts: Date.now() });
    if (_splTrackTimer) clearTimeout(_splTrackTimer);
    _splTrackTimer = setTimeout(splTrackFlush, 5000);
  }
  // Stable short id derived from the video URL. Same video URL on
  // different pages produces the same reelId, so dashboard rollups
  // aggregate correctly across embeds. djb2 hash, base36-encoded.
  function splReelId(videoUrlStr){
    if (!videoUrlStr) return "";
    var h = 5381;
    for (var i = 0; i < videoUrlStr.length; i++) h = ((h << 5) + h + videoUrlStr.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  if (analyticsOn) {
    document.addEventListener("visibilitychange", function(){
      if (document.visibilityState === "hidden") splTrackFlush();
    });
  }
  // Hover preview: 1s after the cursor lands on the card, the video plays
  // muted from the 0.5s mark and keeps playing for as long as the cursor
  // stays on the card. mouseleave snaps back to the poster. Clicking the
  // card during preview commits to real playback (resets to 0, plays with
  // audio). Default ON for single; builder emits `hoverPreview: false` to
  // disable per-embed.
  var hoverPreview  = cfg.hoverPreview !== false;

  // ── GA4 / analytics tracking ─────────────────────────
  // Fires an event to whichever analytics the host page uses — gtag (GA4
  // direct) or dataLayer (Google Tag Manager). If neither exists, it does
  // nothing, so the widget never errors on a page without analytics.
  function track(eventName, params){
    try {
      var data = params || {};
      data.widget_type     = "single_reel";
      data.widget_instance = containerId;
      if (typeof window.gtag === "function"){
        window.gtag("event", eventName, data);
      } else if (window.dataLayer && typeof window.dataLayer.push === "function"){
        var payload = { event: eventName };
        for (var k in data){ if (data.hasOwnProperty(k)) payload[k] = data[k]; }
        window.dataLayer.push(payload);
      }
    } catch (e) { /* analytics must never break the widget */ }
  }
  function reelParams(){
    return { reel_label: label || "", video_url: videoUrl || "" };
  }

  // ── XSS hardening ────────────────────────────────────
  // Escape any cfg-sourced value before interpolating into an HTML string.
  // textContent / setAttribute paths are already safe.
  function escapeHTML(s){
    return String(s == null ? "" : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function safeUrl(u){
    if (!u) return "";
    var s = String(u).trim();
    if (/^javascript:/i.test(s)) return "";
    return escapeHTML(s);
  }

  // The Instagram-style gradient ring (matches the other Splshy widgets).
  var IG_RING = "conic-gradient(from 0deg, #F9CE34, #EE2A7B, #6228D7, #EE2A7B, #F9CE34)";
  // logoRing may be a solid colour (e.g. "#D30011") or the string
  // "instagram" for the gradient ring.
  var ringIsGradient = (logoRing === "instagram");

  // ── Pop-out ─────────────────────────────────────────
  // How much bigger the popped-out player is than the inline card.
  // Tweak this single value to taste. Kept moderate (~1.3x) on purpose:
  // big enough to feel like a real "pop", small enough that the popped
  // player can stay centred over its original spot without the
  // viewport-clamp dragging it toward the screen centre.
  var POPOUT_SCALE = 1.3;
  // Pop-out is a DESKTOP-ONLY feature. On mobile the button is hidden via
  // CSS, and this guard makes the JS a no-op there too.
  function isDesktop(){
    return window.matchMedia("(min-width:768px) and (any-pointer:fine)").matches;
  }

  // ── Inject CSS (once per page) ──────────────────────
  if (!document.querySelector("style[data-splshy-single]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-single", "1");
    style.textContent = [
      ".srv-widget{--srv-accent:#D30011;--srv-card-w:280px;--srv-card-h:496px;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;padding:30px 60px 55px 30px;box-sizing:border-box;display:flex;align-items:flex-start}",
      ".srv-widget *{box-sizing:border-box;margin:0;padding:0}",
      ".srv-widget,.srv-widget *{-webkit-user-select:none!important;-moz-user-select:none!important;user-select:none!important;-webkit-user-drag:none!important}",
      // A11y: keep tap-highlight removal, restore focus outlines for keyboard
      // users via :focus-visible (mouse clicks don't trigger it).
      ".srv-widget button{-webkit-tap-highlight-color:transparent}",
      ".srv-widget button:focus-visible{outline:2px solid #fff;outline-offset:2px}",
      ".srv-card{position:relative;width:var(--srv-card-w);height:var(--srv-card-h);border-radius:20px;overflow:hidden;background:#1a1a1a;-webkit-mask-image:-webkit-radial-gradient(white,black);-webkit-touch-callout:none;user-select:none;box-shadow:0 24px 64px rgba(0,0,0,.28);flex-shrink:0;touch-action:pan-y}",
      // While popped out, the card is fixed-positioned (lifted into the
      // overlay). transform-origin top-left so the scale animation lines up
      // with the measured rect. transition drives the grow/shrink.
      ".srv-card.srv-popped{position:fixed;z-index:100000;transition:transform .34s cubic-bezier(.2,.8,.25,1),box-shadow .34s ease}",
      ".srv-card.srv-popped.srv-popped--open{box-shadow:0 40px 90px rgba(0,0,0,.55)}",
      // A placeholder that holds the card's space in the page layout while
      // the card itself is lifted out into the overlay.
      ".srv-card-holder{flex-shrink:0}",
      ".srv-poster{position:absolute;inset:0}",
      ".srv-poster-bg{position:absolute;inset:0;background:linear-gradient(160deg,#2a1a0e 0%,#0d0804 100%)}",
      ".srv-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
      // opacity transition powers the poster<->video crossfade. See infinite
      // for the longer explanation — same idea, 150ms ease.
      ".srv-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;background:#000;pointer-events:none;-webkit-touch-callout:none;opacity:0;transition:opacity .15s ease}",
      ".srv-top-bar{position:absolute;top:0;left:0;right:0;padding:22px 20px 40px;background:linear-gradient(to bottom,rgba(0,0,0,.6) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      // The logo ring. A solid ring uses `border`; the Instagram gradient
      // ring uses a conic-gradient background with the logo padded inside
      // (a CSS border can't be a gradient). The .srv-logo-ring--grad
      // modifier switches to the gradient style.
      ".srv-logo{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;border-radius:50%!important;border:2px solid var(--srv-accent)!important;overflow:hidden!important;background:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important}",
      // Instagram-style gradient ring. The masked gradient lives on a
      // ::before pseudo-element so the mask (which punches the transparent
      // centre hole) affects ONLY the gradient — the logo is a separate,
      // un-masked child sitting on top. The logo is 42px to match the solid-
      // ring mode exactly (where a 46px circle minus a 2px border = 42px
      // content). Geometry: outer 50.5px (radius 25.25), gradient ring
      // 25.25->23.25 (2px), transparent gap 23.25->21 (2.25px), logo r21 (42px).
      ".srv-logo.srv-logo--grad{width:50.5px!important;height:50.5px!important;min-width:50.5px!important;min-height:50.5px!important;border:none!important;background:transparent!important;position:relative}",
      ".srv-logo.srv-logo--grad::before{content:'';position:absolute;inset:0;border-radius:50%;background:var(--srv-ring-grad);-webkit-mask:radial-gradient(circle, transparent 0 23.25px, #000 23.25px);mask:radial-gradient(circle, transparent 0 23.25px, #000 23.25px)}",
      ".srv-logo.srv-logo--grad .srv-logo-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;z-index:1}",
      ".srv-logo img{width:100%;height:100%;object-fit:cover;display:block}",
      // Countdown ring (top-right) — hidden. Superseded by the bottom-right
      // .srv-time-counter (current / duration). The timer markup is kept
      // and the timeupdate / loadedmetadata handlers still write to it
      // (harmless on a display:none element), so this can be brought back
      // by removing the single rule below.
      ".srv-timer{display:none!important}",
      ".srv-timer{position:relative;width:46px;height:46px;flex-shrink:0}",
      ".srv-timer svg{width:46px;height:46px;transform:rotate(-90deg)}",
      ".srv-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".srv-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".srv-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}",
      ".srv-bottom-bar{position:absolute;bottom:0;left:0;right:0;padding:40px 16px 26px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".srv-label{color:#fff;font-size:16px;font-weight:600;line-height:1.35;letter-spacing:.01em;text-shadow:0 1px 4px rgba(0,0,0,.4);padding-left:4px;margin-right:20px}",
      // !important on the reset properties defeats host-page CSS that might
      // target generic `button` from the embedding theme. The play-btn is a
      // full-card transparent overlay — any inherited background would cover
      // the video poster.
      ".srv-play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;cursor:pointer;transition:opacity .2s;border:0!important;background:transparent!important;padding:0!important;color:inherit;font:inherit;-webkit-appearance:none;appearance:none}",
      ".srv-play-btn.hidden{opacity:0;pointer-events:none}",
      // Hover-preview: same visual as .hidden but stays clickable so a
      // click during preview transitions cleanly to real playback.
      ".srv-play-btn.preview-active{opacity:0}",
      ".srv-play-circle{width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;border-radius:50%!important;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5)!important;display:flex;align-items:center;justify-content:center;padding:0!important;transition:transform .18s,background .18s}",
      ".srv-play-btn:hover .srv-play-circle{transform:scale(1.1);background:rgba(255,255,255,.28)}",
      ".srv-play-circle svg{margin-left:4px;display:block}",
      ".srv-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".srv-pause-ind.visible{opacity:1}",
      // Buffering indicator: dark glassy circle + spinning arc, styled to
      // match the other circular controls. Driven by waiting/playing events.
      ".srv-loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;z-index:11;pointer-events:none;opacity:0;transition:opacity .2s ease}",
      ".srv-loading.visible{opacity:1}",
      ".srv-loading::after{content:\"\";width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);border-top-color:rgba(255,255,255,.95);animation:srv-spin .8s linear infinite}",
      "@keyframes srv-spin{to{transform:rotate(360deg)}}",
      "@media (prefers-reduced-motion: reduce){.srv-loading::after{animation:none}}",
      ".srv-pause-circle{width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;border-radius:50%!important;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5)!important;display:flex;align-items:center;justify-content:center;padding:0!important}",
      ".srv-pause-circle svg{display:block;margin-left:0}",
      ".srv-mute-btn{position:absolute;bottom:58px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:flex;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s}",
      ".srv-mute-btn.visible{opacity:1}",
      ".srv-mute-btn svg{width:15px;height:15px;display:block}",
      // Pop-out button. Sits just above the mute button, same right edge.
      // Hidden by default; shown (on desktop only) once a video is playing,
      // mirroring the mute button's reveal. The CSS media query means it is
      // never shown on mobile / touch — pop-out is desktop-only.
      ".srv-popout-btn{position:absolute;bottom:100px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:none;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s,background .18s}",
      ".srv-popout-btn:hover{background:rgba(0,0,0,.7)!important}",
      ".srv-popout-btn svg{width:15px;height:15px;display:block}",
      "@media(min-width:768px) and (any-pointer:fine){.srv-popout-btn.visible{display:flex;opacity:1}}",
      // Desktop hover-fade for the mute + pop-out buttons. See infinite/widget.js
      // for the rationale — same pattern. Transition-delay on the un-hover state
      // gives a 2s wait before the .35s fade; the hover rule zeroes the delay
      // so the buttons pop back in immediately. Scoped to (hover:hover) so
      // touch devices keep the existing always-visible behaviour.
      "@media(hover:hover){",
        ".srv-card .srv-mute-btn.visible,.srv-card .srv-popout-btn.visible{opacity:0;transition:opacity .35s ease 2s}",
        ".srv-card:hover .srv-mute-btn.visible,.srv-card:hover .srv-popout-btn.visible{opacity:1;transition:opacity .15s ease 0s}",
      "}",
      // Keyboard-focused mute/pop-out reappear immediately even if the
      // hover-fade has dropped them to opacity:0.
      ".srv-mute-btn:focus-visible,.srv-popout-btn:focus-visible{opacity:1!important;transition:opacity 0s!important}",
      ".srv-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(4px);color:#fff;font-size:15px;font-weight:700;padding:7px 14px;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);z-index:16;pointer-events:none;opacity:0;transition:opacity .15s}",
      ".srv-speed.visible{opacity:1}",
      ".srv-progress{position:absolute;bottom:0;left:0;right:0;height:20px;background:transparent;z-index:20;cursor:pointer;opacity:0;transition:opacity 1s;border-radius:0 0 20px 20px;display:flex;align-items:flex-end;touch-action:none}",
      "@media(hover:hover){.srv-card:hover .srv-progress{opacity:1}}",
      ".srv-progress.dragging{opacity:1!important}",
      ".srv-progress.visible{opacity:1}",
      ".srv-progress-track{position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,.25);border-radius:0 0 20px 20px;transition:height .15s;pointer-events:none}",
      ".srv-progress:hover .srv-progress-track,.srv-progress.dragging .srv-progress-track{height:9px}",
      ".srv-progress-fill{position:absolute;bottom:0;left:0;height:6px;background:#fff;pointer-events:none;width:0%;transition:height .15s}",
      ".srv-progress:hover .srv-progress-fill,.srv-progress.dragging .srv-progress-fill{height:9px}",
      ".srv-progress-thumb{position:absolute;bottom:-3.5px;width:13px;height:13px;background:#fff;border-radius:50%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .15s,bottom .15s;box-shadow:0 1px 4px rgba(0,0,0,.4)}",
      ".srv-progress:hover .srv-progress-thumb,.srv-progress.dragging .srv-progress-thumb,.srv-progress:focus-visible .srv-progress-thumb{opacity:1;bottom:-2px}",
      // :focus-visible only — mouse clicks on the bar focus it but the
      // heuristic suppresses the visible style, so mouse users see no ring.
      ".srv-progress:focus-visible{opacity:1!important;outline:2px solid #fff;outline-offset:2px}",
      ".srv-progress:focus-visible .srv-progress-track,.srv-progress:focus-visible .srv-progress-fill{height:9px}",
      // Count-up timer ("0:30 / 0:40"), shown whenever the scrub bar is shown
      // — tied to the same visibility triggers (.visible / .dragging classes,
      // or :hover on a hover-capable pointer). pointer-events:none so touches
      // on the scrub area underneath aren't blocked. tabular-nums keeps the
      // digits from jittering as they tick up.
      ".srv-time-counter{position:absolute;bottom:10px;right:14px;font-size:11px;font-weight:400;color:rgba(255,255,255,.95);text-shadow:0 1px 3px rgba(0,0,0,.55);letter-spacing:.02em;z-index:15;pointer-events:none;opacity:0;transition:opacity 1s;font-variant-numeric:tabular-nums}",
      ".srv-progress.visible ~ .srv-time-counter,.srv-progress.dragging ~ .srv-time-counter{opacity:1}",
      "@media(hover:hover){.srv-card:hover .srv-time-counter{opacity:1}}",
      // Dim backdrop shown behind the popped-out player. The font-family is
      // set here because the card is moved INTO this overlay (a child of
      // document.body) while popped — outside .srv-widget — so it no longer
      // inherits .srv-widget's font. Without this the title falls back to the
      // host page's font and looks wrong (e.g. bold/serif).
      ".srv-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);opacity:0;transition:opacity .34s ease;pointer-events:none;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif}",
      ".srv-overlay.open{opacity:1;pointer-events:auto}",
      "@media(max-width:767px){.srv-widget{padding:20px;justify-content:center;--srv-card-w:78.2vw;--srv-card-h:calc(78.2vw*16/9)}}",
      "@media(min-width:768px) and (any-pointer:fine){.srv-widget{--srv-card-w:280px;--srv-card-h:496px}}",
      "@media(min-width:1024px) and (any-pointer:fine){.srv-widget{--srv-card-w:320px;--srv-card-h:568px}}",
      // Respect prefers-reduced-motion: kill the long widget animations
      // (pop-out grow/shrink, overlay fade). Short hover/feedback transitions
      // are kept since they're not the kind of motion the preference targets.
      "@media (prefers-reduced-motion: reduce){",
        ".srv-card,.srv-card.srv-popped,.srv-overlay{transition:none!important}",
      "}"
    ].join("");
    document.head.appendChild(style);
  }

  // ── Find container ──────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) {
    console.warn("Splshy: no element found with id '" + containerId + "'");
    return;
  }

  // ── Build HTML ──────────────────────────────────────
  container.innerHTML =
    '<div class="srv-widget">' +
      '<div class="srv-card">' +
        '<div class="srv-poster"><div class="srv-poster-bg"></div></div>' +
        '<video class="srv-video" playsinline preload="metadata"></video>' +
        '<div class="srv-bottom-bar"><div class="srv-label"></div></div>' +
        '<button class="srv-play-btn" aria-label="Play video"><div class="srv-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 2L16 10L2 18V2Z" fill="white"/></svg></div></button>' +
        '<div class="srv-pause-ind"><div class="srv-pause-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>' +
        '<div class="srv-loading" role="status" aria-label="Loading video"></div>' +
        '<button class="srv-mute-btn" aria-label="Mute audio" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="srv-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="srv-mx1" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="srv-mx2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>' +
        '<button class="srv-popout-btn" aria-label="Pop out video">' +
          '<svg class="srv-popout-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="13" y2="11"/><line x1="3" y1="21" x2="11" y2="13"/></svg>' +
          '<svg class="srv-popin-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>' +
        '</button>' +
        '<div class="srv-speed">2x</div>' +
        '<div class="srv-progress" role="slider" tabindex="0" aria-label="Seek video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="srv-progress-track"></div><div class="srv-progress-fill"></div><div class="srv-progress-thumb"></div></div>' +
        '<div class="srv-time-counter">0:00 / 0:00</div>' +
      '</div>' +
    '</div>';

  var widget    = container.querySelector(".srv-widget");
  var card      = widget.querySelector(".srv-card");
  var video     = widget.querySelector(".srv-video");
  var poster    = widget.querySelector(".srv-poster");
  var playBtn   = widget.querySelector(".srv-play-btn");
  var muteBtn   = widget.querySelector(".srv-mute-btn");
  var popoutBtn = widget.querySelector(".srv-popout-btn");
  var pauseInd  = widget.querySelector(".srv-pause-ind");
  var loadingEl = widget.querySelector(".srv-loading");
  // GA4: video_play (first playing), video_progress (50%), video_complete,
  // video_error.
  // Splshy-native analytics: a separate "qualified play" fires once the
  // video has reached 3 seconds of actual playback (industry-standard
  // threshold that filters impression-bounces). Cancelled if the user
  // pauses/seeks/leaves before the threshold.
  var _playFired = false, _progressFired = false;
  var _splPlayFired = false, _splPlayTimer = null;
  function splArmPlay(){
    if (_splPlayFired || _splPlayTimer || !analyticsOn) return;
    _splPlayTimer = setTimeout(function(){
      _splPlayFired = true;
      _splPlayTimer = null;
      splTrackPlay(containerId, splReelId(videoUrl));
    }, 3000);
  }
  function splDisarmPlay(){
    if (_splPlayTimer){ clearTimeout(_splPlayTimer); _splPlayTimer = null; }
  }
  video.addEventListener("playing", function(){
    if (!_playFired){ _playFired = true; track("video_play", reelParams()); }
    splArmPlay();
  });
  video.addEventListener("pause", splDisarmPlay);
  video.addEventListener("ended", function(){
    track("video_complete", reelParams());
    _playFired = false; _progressFired = false;
    _splPlayFired = false;
    splDisarmPlay();
  });
  video.addEventListener("error", function(){
    track("video_error", reelParams());
  });
  // Buffering: 400ms grace period before the spinner shows (every play()
  // call fires `waiting` briefly while the browser decodes — without the
  // delay the spinner flashes on every click).
  var waitTimer = null;
  function showLoading(){
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = setTimeout(function(){
      if (loadingEl) loadingEl.classList.add("visible");
    }, 400);
  }
  function hideLoading(){
    if (waitTimer){ clearTimeout(waitTimer); waitTimer = null; }
    if (loadingEl) loadingEl.classList.remove("visible");
  }
  video.addEventListener("waiting",  showLoading);
  video.addEventListener("playing",  hideLoading);
  video.addEventListener("canplay",  hideLoading);
  video.addEventListener("error",    hideLoading);
  var speedInd  = widget.querySelector(".srv-speed");
  var progBar   = widget.querySelector(".srv-progress");
  var progFill  = widget.querySelector(".srv-progress-fill");
  var progThumb = widget.querySelector(".srv-progress-thumb");

  // Apply a solid logo-ring colour (set as the --srv-accent the border uses).
  // The gradient case is handled below when the logo markup is built.
  if (!ringIsGradient) widget.style.setProperty("--srv-accent", logoRing);
  else widget.style.setProperty("--srv-ring-grad", IG_RING);

  // Label
  widget.querySelector(".srv-label").textContent = label;

  // Poster + video src
  if (posterUrl) {
    var img = document.createElement("img");
    img.src = posterUrl; img.alt = label;
    poster.appendChild(img);
    video.setAttribute("poster", posterUrl);
  }
  if (videoUrl) video.src = videoUrl;
  // a11y: name the video so screen-reader rotor / video-element nav
  // identifies it by reel title rather than as an unnamed media element.
  video.setAttribute("aria-label", "Video: " + (label || "Untitled"));

  // Top bar
  var RING_C = (2 * Math.PI * 20).toFixed(2);
  // Empty logoUrl means "no Instagram badge" — hide the entire top-left
  // anchor (logo ring + follower count) rather than showing a generic 'S'
  // placeholder. Builder users opt IN to the badge by filling in a logoUrl;
  // leaving it blank yields a clean top-left.
  var badgeHTML = "";
  if (logoUrl) {
    var logoContent = '<img src="' + safeUrl(logoUrl) + '" alt="logo">';
    // For the gradient ring the logo content sits in an inner circle centred
    // in the masked ring; the transparent hole + smaller logo create the
    // Instagram-style see-through gap. For a solid ring the border does it.
    var logoHTML = ringIsGradient
      ? '<div class="srv-logo srv-logo--grad"><div class="srv-logo-inner">' + logoContent + '</div></div>'
      : '<div class="srv-logo">' + logoContent + '</div>';
    badgeHTML =
      '<a href="' + safeUrl(igUrl) + '" target="_blank" rel="noopener" aria-label="Visit on Instagram (opens in new tab)" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">' +
        logoHTML +
        '<div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:400;letter-spacing:0.03em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">' + escapeHTML(followerCount) + '</div>' +
      '</a>';
  }

  card.insertAdjacentHTML("afterbegin",
    '<div class="srv-top-bar">' +
      badgeHTML +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">' +
        '<div class="srv-timer">' +
          '<svg viewBox="0 0 46 46"><circle class="srv-timer-bg" cx="23" cy="23" r="20"/><circle class="srv-timer-ring" cx="23" cy="23" r="20" stroke-dasharray="' + RING_C + '" stroke-dashoffset="0"/></svg>' +
          '<div class="srv-timer-text">--</div>' +
        '</div>' +
        '<div style="height:13px;"></div>' +
      '</div>' +
    '</div>'
  );

  var ring      = card.querySelector(".srv-timer-ring");
  var timerText = card.querySelector(".srv-timer-text");
  var timeCounter = widget.querySelector(".srv-time-counter");
  var RING_C2   = 2 * Math.PI * 20;
  ring.style.strokeDasharray = RING_C2;

  var dur = 0, muted = false, dragging = false;
  var holding = false, swallow = false, holdTimer = null;
  // Per-widget timer handle for the scrub bar's mobile auto-hide. Kept as a
  // local (not a window.* global) so multiple single widgets on one page each
  // manage their own scrub bar independently.
  var srvFade = null;

  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  video.addEventListener("loadedmetadata", function () {
    dur = video.duration;
    timerText.textContent = fmtTime(dur);
    timeCounter.textContent = "0:00 / " + fmtTime(dur);
  });
  video.addEventListener("timeupdate", function () {
    if (!dur) return;
    var pct = video.currentTime / dur;
    ring.style.strokeDashoffset = RING_C2 * (1 - pct);
    timerText.textContent = fmtTime(Math.max(0, dur - video.currentTime));
    timeCounter.textContent = fmtTime(video.currentTime) + " / " + fmtTime(dur);
    progFill.style.width = (pct * 100) + "%";
    progThumb.style.left = (pct * 100) + "%";
    progBar.setAttribute("aria-valuenow", Math.round(pct * 100));
    if (!_progressFired && pct >= 0.5){
      _progressFired = true;
      track("video_progress", reelParams());
    }
  });
  video.addEventListener("ended", function () {
    ring.style.strokeDashoffset = 0;
    timerText.textContent = fmtTime(dur);
    timeCounter.textContent = fmtTime(dur) + " / " + fmtTime(dur);
    progFill.style.width = "0%"; progThumb.style.left = "0%";
    progBar.classList.remove("visible");
    fadeOut();
    playBtn.classList.remove("hidden");
    playBtn.classList.remove("preview-active");
    muteBtn.classList.remove("visible");
    popoutBtn.classList.remove("visible");
    pauseInd.classList.remove("visible");
    previewState = "idle";
  });

  // ── Hover preview ────────────────────────────────────
  // 1.25s after mouseenter, the video plays muted from 0.5s for 3s, then
  // freezes on the last frame. mouseleave snaps back to the poster. Clicking
  // the card (or the play button) during preview resets to 0 and plays with
  // audio. Skipped on touch (no mouseenter fires).
  var previewState = "idle";
  var previewTimer = null;
  var previewEndTimer = null;
  // Crossfade helpers — see infinite for the full rationale. Replace direct
  // display:block/none on the video with fadeIn/fadeOut so the poster<->video
  // swap reads as a 150ms opacity crossfade.
  function fadeIn(){
    video.style.opacity = "0";
    video.style.display = "block";
    void video.offsetHeight;
    video.style.opacity = "1";
  }
  function fadeOut(){
    video.style.opacity = "0";
    setTimeout(function(){
      if (video.style.opacity === "0") {
        video.style.display = "none";
        video.style.opacity = "";
      }
    }, 160);
  }
  function startPreview(){
    if (!hoverPreview) return;
    if (previewState !== "idle") return;
    if (video.style.display === "block") return;
    if (popped || popBusy) return;
    previewState = "previewing";
    video.muted = true;
    try { video.currentTime = 0.5; } catch(err){}
    fadeIn();
    playBtn.classList.add("preview-active");
    video.play().catch(function(){});
    // No auto-pause: preview plays as long as the cursor stays on the card.
    // mouseleave (endPreview) is the only thing that stops the preview;
    // a natural `ended` event will also fall through to the existing handler
    // which snaps back to the poster.
  }
  function endPreview(){
    if (previewState !== "previewing") return;
    if (previewEndTimer){ clearTimeout(previewEndTimer); previewEndTimer = null; }
    previewState = "idle";
    video.pause();
    try { video.currentTime = 0; } catch(err){}
    fadeOut();
    playBtn.classList.remove("preview-active");
    progBar.classList.remove("visible");
    video.muted = muted;
  }
  function transitionPreviewToPlay(){
    if (previewState !== "previewing") return;
    if (previewEndTimer){ clearTimeout(previewEndTimer); previewEndTimer = null; }
    previewState = "playing";
    try { video.currentTime = 0; } catch(err){}
    video.muted = muted;
    playBtn.classList.remove("preview-active");
    playBtn.classList.add("hidden");
    muteBtn.classList.add("visible");
    popoutBtn.classList.add("visible");
    syncMute();
    video.play().catch(function(){});
  }
  card.addEventListener("mouseenter", function(){
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(startPreview, 1000);
  });
  card.addEventListener("mouseleave", function(){
    if (previewTimer){ clearTimeout(previewTimer); previewTimer = null; }
    endPreview();
  });

  // Play
  playBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (previewTimer){ clearTimeout(previewTimer); previewTimer = null; }
    if (previewState === "previewing"){
      transitionPreviewToPlay();
      return;
    }
    video.muted = muted;
    fadeIn();
    playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
    popoutBtn.classList.add("visible");   // desktop-only via CSS media query
    previewState = "playing";
    syncMute(); video.play();
  });

  // Card click
  card.addEventListener("click", function (e) {
    if (e.target.closest(".srv-mute-btn") ||
        e.target.closest(".srv-popout-btn") || e.target.closest(".srv-progress")) return;
    // Play btn is .preview-active (clickable) during preview — let those
    // clicks reach this handler so we can transition. Outside preview, the
    // play btn has its own handler and should bypass us as before.
    if (e.target.closest(".srv-play-btn") && previewState !== "previewing") return;
    if (swallow) { swallow = false; return; }
    if (previewState === "previewing"){
      transitionPreviewToPlay();
      return;
    }
    if (video.style.display === "block") {
      if (video.paused) { video.play(); pauseInd.classList.remove("visible"); }
      else { video.pause(); pauseInd.classList.add("visible"); }
    }
  });
  card.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // Mute
  function syncMute() {
    var u = muteBtn.querySelectorAll(".srv-unmute");
    var x = muteBtn.querySelectorAll(".srv-mx1, .srv-mx2");
    u.forEach(function (el) { el.style.display = muted ? "none"  : "block"; });
    x.forEach(function (el) { el.style.display = muted ? "block" : "none";  });
    muteBtn.setAttribute("aria-label", muted ? "Unmute audio" : "Mute audio");
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation(); muted = !muted; video.muted = muted; syncMute();
  });

  // ── Pop-out ─────────────────────────────────────────
  // Desktop-only. The card is lifted into a fixed-position overlay and
  // animated from its measured inline rect up to POPOUT_SCALE, centred over
  // its ORIGINAL position but clamped so it stays fully on screen. The video
  // element is never reloaded — only the card's position/scale change — so
  // playback continues seamlessly through the transition.
  var popped = false;
  var popBusy = false;
  var holder = null;          // placeholder occupying the card's layout slot

  // The dim backdrop. Created PER WIDGET INSTANCE — not shared page-wide —
  // because multiple single-reel widgets can sit on one page, each with its
  // own logo-ring setting. A shared overlay would mean the last widget to
  // initialise overwrites the logo-ring variable for all of them, so a
  // popped-out widget could show another widget's ring colour. A private
  // overlay per widget keeps each one's ring (and its backdrop-click close)
  // correct and independent.
  var overlay = document.createElement("div");
  overlay.className = "srv-overlay";
  // Pop-out overlay is a modal dialog (same pattern as the stories overlay
  // and the infinite pop-out).
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Video pop-out");
  document.body.appendChild(overlay);
  // The logo ring's colour/gradient comes from a CSS variable set on
  // .srv-widget. When the card is popped it is moved INTO this overlay —
  // outside .srv-widget — so it no longer inherits that variable and the
  // gradient ring would vanish. Copy the variable onto the overlay so the
  // ring renders correctly while popped. (Same fix as the title font.)
  if (ringIsGradient) overlay.style.setProperty("--srv-ring-grad", IG_RING);
  else overlay.style.setProperty("--srv-accent", logoRing);

  function popoutIcons(showPopin){
    var out = popoutBtn.querySelector(".srv-popout-icon");
    var inn = popoutBtn.querySelector(".srv-popin-icon");
    if (out) out.style.display = showPopin ? "none" : "block";
    if (inn) inn.style.display = showPopin ? "block" : "none";
    // a11y: keep the button's aria-label in sync with what it now does.
    popoutBtn.setAttribute("aria-label", showPopin ? "Close pop-out" : "Pop out video");
  }

  function openPopout(){
    if (popped || popBusy || !isDesktop()) return;
    popBusy = true;
    popped  = true;
    track("video_popout", reelParams());

    // Measure the card's current on-screen rect BEFORE moving it.
    var r = card.getBoundingClientRect();
    var w = r.width, h = r.height;

    // Target (popped) size.
    var tw = w * POPOUT_SCALE, th = h * POPOUT_SCALE;

    // Desired top-left so the popped player is centred over the ORIGINAL
    // card centre.
    var cx = r.left + w / 2, cy = r.top + h / 2;
    var tx = cx - tw / 2, ty = cy - th / 2;

    // Clamp so the popped player stays fully on screen (with a small margin).
    var m = 16;
    var maxX = window.innerWidth  - tw - m;
    var maxY = window.innerHeight - th - m;
    tx = Math.max(m, Math.min(tx, maxX));
    ty = Math.max(m, Math.min(ty, maxY));

    // Insert a placeholder of the SAME size into the card's spot so the page
    // layout doesn't collapse while the card is lifted out.
    holder = document.createElement("div");
    holder.className = "srv-card-holder";
    holder.style.width  = w + "px";
    holder.style.height = h + "px";
    card.parentNode.insertBefore(holder, card);

    // Lift the card into the overlay, fixed at its CURRENT rect — visually
    // identical to where it just was, so there is no jump.
    card.classList.add("srv-popped");
    card.style.transition = "none";
    card.style.left   = r.left + "px";
    card.style.top    = r.top  + "px";
    card.style.width  = w + "px";
    card.style.height = h + "px";
    card.style.transformOrigin = "top left";
    card.style.transform = "translate(0px,0px) scale(1)";
    overlay.appendChild(card);
    card.offsetHeight;                       // force reflow so the next change animates

    // Animate: fade the backdrop in, grow + move the card to the target.
    overlay.classList.add("open");
    card.classList.add("srv-popped--open");
    card.style.transition = "";              // re-enable the CSS transition
    card.style.transform =
      "translate(" + (tx - r.left) + "px," + (ty - r.top) + "px) scale(" + POPOUT_SCALE + ")";

    // Lock page scroll while popped.
    document.body.style.overflow = "hidden";

    popoutIcons(true);
    setTimeout(function(){ popBusy = false; }, 360);
    // a11y: move focus to the pop-out button (now acting as close) once
    // the animation has settled.
    setTimeout(function(){
      try { popoutBtn.focus({ preventScroll: true }); }
      catch(err) { popoutBtn.focus(); }
    }, 380);
  }

  function closePopout(){
    if (!popped || popBusy) return;
    popBusy = true;

    // Animate the card back to its original rect (transform identity).
    card.style.transform = "translate(0px,0px) scale(1)";
    overlay.classList.remove("open");
    card.classList.remove("srv-popped--open");

    document.body.style.overflow = "";

    // After the transition, drop the card back into its real layout slot.
    setTimeout(function(){
      card.classList.remove("srv-popped");
      card.style.transition = "";
      card.style.transform  = "";
      card.style.transformOrigin = "";
      card.style.left = card.style.top = "";
      card.style.width = card.style.height = "";
      if (holder && holder.parentNode){
        holder.parentNode.insertBefore(card, holder);
        holder.parentNode.removeChild(holder);
      }
      holder = null;
      popped = false;
      popBusy = false;
      popoutIcons(false);
      // a11y: restore focus to the pop-out button (now on the card back
      // in its layout slot) so keyboard users land where they started.
      try { popoutBtn.focus({ preventScroll: true }); }
      catch(err) { popoutBtn.focus(); }
    }, 360);
  }

  function togglePopout(){
    if (popped) closePopout(); else openPopout();
  }

  popoutBtn.addEventListener("click", function(e){
    e.stopPropagation();
    togglePopout();
  });
  // a11y: focus trap while popped. Tab / Shift+Tab cycles through the
  // popped card's interactive controls instead of escaping to the page.
  overlay.addEventListener("keydown", function(e){
    if (e.key !== "Tab") return;
    if (!overlay.classList.contains("open")) return;
    var focusable = overlay.querySelectorAll(
      "button:not([disabled]), [tabindex='0'], a[href]"
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !overlay.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !overlay.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  // Click the dim backdrop (outside the card) to close.
  overlay.addEventListener("click", function(e){
    if (e.target === overlay) closePopout();
  });
  // Escape closes.
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && popped) closePopout();
  });
  // If the viewport is resized while popped, just close — re-clamping a live
  // animation is fiddly and a resize while popped is a rare edge case.
  window.addEventListener("resize", function(){
    if (popped && !popBusy) closePopout();
  });

  // Progress
  function seekTo(pos) { if (dur) video.currentTime = Math.max(0, Math.min(1, pos)) * dur; }
  function getPct(e) {
    var rect = progBar.getBoundingClientRect();
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    return (x - rect.left) / rect.width;
  }
  progBar.addEventListener("click",      function (e) { e.stopPropagation(); });
  progBar.addEventListener("mousedown",  function (e) { e.stopPropagation(); dragging = true; progBar.classList.add("dragging"); seekTo(getPct(e)); });
  progBar.addEventListener("touchstart", function (e) { e.stopPropagation(); dragging = true; progBar.classList.add("dragging"); seekTo(getPct(e)); }, { passive: true });
  document.addEventListener("mousemove", function (e) { if (dragging) seekTo(getPct(e)); });
  document.addEventListener("touchmove", function (e) { if (dragging) seekTo(getPct(e)); }, { passive: true });
  function endDrag() { if (dragging) { dragging = false; progBar.classList.remove("dragging"); window._srvScrubEnd = true; setTimeout(function () { window._srvScrubEnd = false; }, 300); } }
  document.addEventListener("mouseup",  endDrag);
  document.addEventListener("touchend", endDrag);
  // a11y: keyboard scrubbing. ← / → seek ±5s, Home / End jump to ends.
  progBar.addEventListener("keydown", function(e){
    if (!dur) return;
    var handled = false;
    if (e.key === "ArrowLeft"){
      video.currentTime = Math.max(0, video.currentTime - 5);
      handled = true;
    } else if (e.key === "ArrowRight"){
      video.currentTime = Math.min(dur, video.currentTime + 5);
      handled = true;
    } else if (e.key === "Home"){
      video.currentTime = 0;
      handled = true;
    } else if (e.key === "End"){
      video.currentTime = dur;
      handled = true;
    }
    if (handled){ e.preventDefault(); e.stopPropagation(); }
  });
  video.addEventListener("play", function () {
    if (window.matchMedia("(hover:none)").matches) {
      progBar.classList.add("visible");
      clearTimeout(srvFade);
      srvFade = setTimeout(function () { if (!dragging) progBar.classList.remove("visible"); }, 7000);
    }
  });
  // On mobile, when the video is PAUSED mid-playback, show the scrub bar and
  // keep it visible — so the viewer can see how far along they are / how much
  // is left while paused. (Mobile has no hover, so without this the bar would
  // simply be hidden when paused.) The pending 7s auto-hide is cancelled so
  // the bar holds for as long as the video stays paused; the next `play`
  // re-arms the normal auto-hide. The `!video.ended` guard skips this when the
  // pause is really the video finishing — the `ended` handler clears the bar.
  video.addEventListener("pause", function () {
    if (video.ended) return;
    if (window.matchMedia("(hover:none)").matches) {
      clearTimeout(srvFade);
      progBar.classList.add("visible");
    }
  });

  // 2x hold
  function startHold() {
    if (video.style.display !== "block" || video.paused) return;
    holdTimer = setTimeout(function () { holding = true; if (!video.paused) { video.playbackRate = 2; speedInd.classList.add("visible"); } }, 300);
  }
  function endHold() {
    clearTimeout(holdTimer);
    if (holding) { holding = false; swallow = true; video.playbackRate = 1; speedInd.classList.remove("visible"); setTimeout(function () { swallow = false; }, 300); }
  }
  card.addEventListener("mousedown",   startHold);
  card.addEventListener("touchstart",  startHold, { passive: true });
  card.addEventListener("mouseup",     endHold);
  card.addEventListener("mouseleave",  endHold);
  card.addEventListener("touchcancel", endHold);
  card.addEventListener("touchend",    endHold);

  // GA4: widget_impression — fires once per widget instance after setup.
  track("widget_impression", {});

  // ── Global Space-to-toggle ───────────────────────────────
  // Document-level Space handler, made idempotent via window.SPLSHY_SPACE_HOOKED
  // so multiple widget scripts on the same page register exactly one listener
  // (not one per widget — that would multi-toggle and cancel out). Matches
  // the YouTube / native-HTML5 expectation: Space pauses/resumes the currently
  // VISIBLE video (the one with display:block set by the widget on play).
  // Skips when typing in an input/textarea/contentEditable, and does nothing
  // when no video is visible — so Space falls through to default page-scroll
  // when there's nothing to toggle. Mirrors the card-click handler's pause-
  // indicator toggle so the visual state stays consistent.
  // M = toggle mute on the currently-active video. Idempotent via the
  // SPLSHY_MUTE_HOOKED flag (same pattern as the Space hook).
  if (!window.SPLSHY_MUTE_HOOKED) {
    window.SPLSHY_MUTE_HOOKED = true;
    document.addEventListener("keydown", function(e){
      if (e.key !== "m" && e.key !== "M") return;
      var t = e.target;
      if (t){
        var tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      var vids = document.querySelectorAll("video"), target = null;
      for (var i = 0; i < vids.length; i++){
        var v = vids[i];
        if (v.style.display === "block" && !v.paused){ target = v; break; }
      }
      if (!target){
        var last = window.SPLSHY_LAST_PLAYED;
        if (last && last.style.display === "block") target = last;
      }
      if (!target){
        for (var i = 0; i < vids.length; i++){
          var v = vids[i];
          if (v.style.display === "block"){ target = v; break; }
        }
      }
      if (!target) return;
      var card = target.closest(".sif-card, .srv-card, .sst-stage");
      if (!card) return;
      var muteBtn = card.querySelector(".sif-mute-btn, .srv-mute-btn, .sst-mute-btn");
      if (!muteBtn) return;
      e.preventDefault();
      muteBtn.click();
    });
  }

  if (!window.SPLSHY_SPACE_HOOKED) {
    window.SPLSHY_SPACE_HOOKED = true;

    // Track the most recently played video so Space on a multi-widget page
    // resumes the one the user was last watching, not whichever is first in
    // DOM order. `play` events don't bubble, so capture-phase is required.
    document.addEventListener("play", function(e){
      if (e.target && e.target.tagName === "VIDEO") {
        window.SPLSHY_LAST_PLAYED = e.target;
      }
    }, true);

    document.addEventListener("keydown", function(e){
      if (e.code !== "Space" && e.key !== " ") return;
      var t = e.target;
      if (t){
        var tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      var vids = document.querySelectorAll("video"), target = null;
      // 1. Currently-playing visible video wins — clean "pause what I see".
      for (var i = 0; i < vids.length; i++){
        var v = vids[i];
        if (v.style.display === "block" && !v.paused){ target = v; break; }
      }
      // 2. Else the most recently played video, if still visible — handles
      //    the multi-widget paused-paused case (resume the one I last used,
      //    not whichever happens to be first on the page).
      if (!target){
        var last = window.SPLSHY_LAST_PLAYED;
        if (last && last.style.display === "block") target = last;
      }
      // 3. Else first visible-but-paused (rare; e.g. autoplay scenario).
      if (!target){
        for (var i = 0; i < vids.length; i++){
          var v = vids[i];
          if (v.style.display === "block"){ target = v; break; }
        }
      }
      if (!target) return;
      e.preventDefault();
      var wasPaused = target.paused;
      if (wasPaused) target.play(); else target.pause();
      var card = target.closest(".sif-card, .srv-card, .sst-stage");
      if (card){
        var pi = card.querySelector(".sif-pause-ind, .srv-pause-ind, .sst-pause-ind");
        if (pi){
          if (wasPaused) pi.classList.remove("visible");
          else pi.classList.add("visible");
        }
      }
    });
  }

})();
