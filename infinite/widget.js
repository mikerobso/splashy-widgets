(function () {

  /* ====================================================
     Splshy Infinite Swipe Carousel
     splshy.com/infinite/widget.js

     Multi-instance: each embed pushes its config object to
     window.SPLSHY_INFINITE_QUEUE. This script initialises every
     queued config, so any number of infinite carousels can live
     on the same page. (The legacy single global window.SPLSHY_INFINITE
     is still honoured for backward compatibility.)
  ==================================================== */

  function initWidget(cfg) {

  cfg               = cfg || {};
  // Host whitelist: widget only renders when window.location.hostname is
  // in the allowed list. Default list (ALLOWED_HOSTS below) is hardcoded
  // — when signing new clients, ADD their domain here and push. A specific
  // embed can override the list via cfg.allowedOrigins (e.g. for a one-off
  // subdomain that doesn't deserve a global push). Localhost / *.local are
  // exempted so dev environments keep working. Soft control — bypassable
  // by a forked widget.js but blocks casual copy-paste of the embed
  // snippet to other sites.
  var ALLOWED_HOSTS = [
    "www.visitraleigh.com",
    "www.splshy.com",          // splshy.com demos / landing pages
    "www.getsplashy.com",      // builder preview (future)
    "*.simpleviewcms.com"      // SimpleView CMS preview environments
                               // (raleigh.simpleviewcms.com etc — DMO clients
                               // on the SimpleView platform preview here).
  ];
  var allowedOrigins = cfg.allowedOrigins || ALLOWED_HOSTS;
  if (allowedOrigins.length) {
    var host = (window.location && window.location.hostname) || "";
    var isDev = !host || host === "localhost" || host === "127.0.0.1" || /\.local$/i.test(host);
    // Entries starting with "*." are subdomain wildcards. "*.foo.com" matches
    // "any.foo.com" but NOT "foo.com" itself, NOT "evilfoo.com".
    var allowed = allowedOrigins.some(function(o){
      if (o === host) return true;
      if (o.charAt(0) === "*" && o.charAt(1) === ".") {
        var suffix = o.slice(1);
        return host.length > suffix.length && host.slice(-suffix.length) === suffix;
      }
      return false;
    });
    if (!isDev && !allowed) {
      try { console.warn("SPLSHY infinite: host '" + host + "' not in allowedOrigins ["+allowedOrigins.join(", ")+"], widget will not render."); } catch(e){}
      return;
    }
  }
  var reels         = cfg.reels              || [];
  var followerCount = cfg.followerCount      || "";
  var igUrl         = cfg.igUrl             || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl           || "";
  var logoRing      = cfg.logoRing          || "#D30011";
  var containerId   = cfg.containerId       || "splshy-infinite";

  // Desktop rendering mode (step 3 of the accordion plan).
  //   "row"         — current infinite-carousel look (the only live mode today)
  //   "accordion-3" — wired in step 3b, V=3 band
  //   "accordion-5" — wired in step 3c, V=5 band
  // Default is "row". Until 3b/3c land the flag validates but does nothing —
  // any value still renders as the row carousel. Mobile rendering is unaffected
  // by this flag in every mode.
  var ALLOWED_DESKTOP_STYLES = ["row", "accordion-3", "accordion-5"];
  var desktopStyle = cfg.desktopStyle || "row";
  if (ALLOWED_DESKTOP_STYLES.indexOf(desktopStyle) === -1){
    console.warn("Splshy Infinite: unknown desktopStyle '" + desktopStyle + "', falling back to 'row'.");
    desktopStyle = "row";
  }

  // The Instagram-style gradient ring (matches the other Splshy widgets).
  var IG_RING = "conic-gradient(from 0deg, #F9CE34, #EE2A7B, #6228D7, #EE2A7B, #F9CE34)";
  var ringIsGradient = (logoRing === "instagram");

  // ── Pop-out ─────────────────────────────────────────
  // How much bigger a popped-out card is than its inline size. Kept moderate
  // (~1.3x) so the popped card can stay centred over its original spot
  // without the viewport-clamp dragging it toward the screen centre.
  var POPOUT_SCALE = 1.3;
  // Pop-out is DESKTOP-ONLY. The button is hidden on mobile via CSS, and the
  // openPopout() guard makes the JS a no-op there too.
  function isDesktopLayout(){
    return window.matchMedia("(min-width:768px) and (any-pointer:fine)").matches;
  }

  if (!reels.length) { console.warn("Splshy Infinite: no reels configured."); return; }

  // ── Real vs effective indexing (step 2 of the accordion plan) ─────────
  // `reels` is the configured input; `effectiveReels` is what the engine
  // slots against. They differ ONLY when an accordion mode doubles the
  // list to satisfy the n >= V+2 floor (step 3). For row mode the helper
  // is never called, so the two arrays are identical and `n === realCount`.
  //
  // Each card carries both `reelIdx` (effective, what the engine sees) and
  // `realIdx = reelIdx % realCount` (user-facing: `current`, dots, navigate).
  // With no doubling the two are equal.
  function doubleReelsToFloor(srcReels, floor){
    if (srcReels.length >= floor) return srcReels.slice();
    var out = [];
    while (out.length < floor) out = out.concat(srcReels);
    return out;
  }
  var realCount = reels.length;
  // Defensive: accordion modes have minimum reel counts (see the plan).
  // The builder is the primary gate (step 6); these checks catch a malformed
  // embed rather than letting the visible window render misleading duplicates.
  //   accordion-5 needs >= 5 reels to show 5 DISTINCT cards at rest.
  //   accordion-3 needs >= 3 reels for the same reason.
  if (desktopStyle === "accordion-5" && realCount < 5){
    console.warn("Splshy Infinite: accordion-5 requires >= 5 reels; falling back to accordion-3.");
    desktopStyle = "accordion-3";
  }
  if (desktopStyle === "accordion-3" && realCount < 3){
    console.warn("Splshy Infinite: accordion-3 requires >= 3 reels; falling back to row.");
    desktopStyle = "row";
  }
  // Hover preview: when a card is hovered for 1.25s, it plays a muted 5s
  // preview from the 0.5s mark and freezes on the last frame. Clicking the
  // card during preview commits to real playback (resets to 0, plays with
  // audio). Default OFF for infinite; builder opts in by emitting
  // `hoverPreview: true`.
  var hoverPreview = !!cfg.hoverPreview;
  // Force-mobile mode: render the widget with mobile sizing + layout even
  // on desktop viewports. Used by the builder's side-text layouts (Text
  // Left / Text Right), where the carousel sits in a narrow column and
  // wants the single-focus + peek look that the mobile @media already
  // gives us. The flag flips two things: isMobileLayout() returns true,
  // and a `<style>` tag is injected that promotes the mobile @media
  // declarations to unconditional rules.
  var forceMobile = !!cfg.forceMobile;
  // Auto-advance: when the centre reel finishes, slide to the next reel and
  // start playing it (TikTok-style continuous flow). Loops back to reel 0
  // after the last reel. Default ON; builder emits `autoAdvance: false` to
  // disable. `pendingAutoAdvance` is the per-step flag — set in the ended
  // handler, consumed in finishStep to trigger play on the new centre.
  var autoAdvance = cfg.autoAdvance !== false;
  // After an auto-advance slide, this is the realIdx of the card that
  // should be played (null when no advance pending). Cleared in finishStep
  // once we've dispatched the play click on the matching card.
  var pendingAutoAdvanceTarget = null;
  // Visible window width for the active desktop mode (V = 3 or 5, matching
  // the plan's V=3/V=5 band derivations). Drives the band invariant and the
  // accordion renderer; mobile rendering ignores V.
  var V = (desktopStyle === "accordion-5") ? 5 : 3;
  // Band left offset = -((V+1)/2). V=3 -> -2, V=5 -> -3. The band is shifted
  // (V+1)/2 slots LEFT of symmetric so a card is always staged just off the
  // visible left edge — see the unified pattern in the plan doc.
  var bandLeftOffset = -(V + 1) / 2;
  // Doubling: only accordion modes need n >= V+2 effective cards. Row mode
  // never doubles (preserves the live behaviour at any reel count).
  var effectiveReels;
  if (desktopStyle === "accordion-3"){
    effectiveReels = doubleReelsToFloor(reels, 5);    // V=3 floor = V+2 = 5
  } else if (desktopStyle === "accordion-5"){
    effectiveReels = doubleReelsToFloor(reels, 7);    // V=5 floor = V+2 = 7
  } else {
    effectiveReels = reels.slice();                   // row — unchanged
  }
  var n = effectiveReels.length;

  // ── GA4 / analytics tracking ─────────────────────────
  // Fires an event to whichever analytics the host page uses — gtag (GA4
  // direct) or dataLayer (Google Tag Manager). If neither exists, it does
  // nothing, so the widget never errors on a page without analytics.
  // (Mirrors the stories widget's trackEvent() pattern.)
  function trackEvent(eventName, params){
    try {
      var data = params || {};
      data.widget_type     = "infinite_carousel";
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
  function reelParams(reelIdx){
    var r = effectiveReels[reelIdx] || {};
    return {
      reel_index: reelIdx,
      reel_label: r.label || "",
      video_url:  r.videoUrl || ""
    };
  }

  // ── XSS hardening ────────────────────────────────────
  // Every value pulled from cfg (reel labels, URLs, follower count) is
  // attacker-controllable if the embed config or the CMS holding it is
  // compromised. escapeHTML neutralises HTML special chars before inter-
  // polation; safeUrl additionally blocks `javascript:` URLs from landing
  // in href/src attributes. Apply at every HTML-string interpolation point
  // (textContent and setAttribute are already safe — the browser handles
  // those).
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

  // ── CSS ─────────────────────────────────────────────
  if (!document.querySelector("style[data-splshy-infinite]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-infinite", "1");
    style.textContent = [
      ".sif-widget{--sif-accent:#D30011;--sif-card-w:220px;--sif-card-h:390px;--sif-gap:30px;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;width:100%;user-select:none;padding:29px 0}",
      // A11y: keep the tap-highlight removal but stop forcibly removing the
      // focus outline — keyboard users need a visible focus ring. Universal
      // :focus-visible style is white-on-2px-offset (visible on dark cards);
      // light-background controls (arrows are white-bg, dots sit on the page)
      // override the colour below for contrast.
      ".sif-widget button{-webkit-tap-highlight-color:transparent}",
      ".sif-widget button:focus-visible{outline:2px solid #fff;outline-offset:2px}",
      ".sif-arrow:focus-visible{outline-color:#111}",
      ".sif-dot:focus-visible{outline-color:var(--sif-accent)}",
      ".sif-outer{position:relative;display:flex;align-items:center;justify-content:center}",
      ".sif-viewport{overflow:hidden;height:var(--sif-card-h);width:calc(var(--sif-card-w)*3 + var(--sif-gap)*2)}",
      /* Track: a flex row of cards. We move it with translateX */
      ".sif-track{display:flex;flex-direction:row;align-items:center;height:100%;gap:var(--sif-gap);will-change:transform}",
      ".sif-card{flex-shrink:0;position:relative;width:var(--sif-card-w);height:var(--sif-card-h);border-radius:20px;overflow:hidden;background:#1a1a1a;cursor:pointer;-webkit-mask-image:-webkit-radial-gradient(white,black);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-y;transition:filter .35s,box-shadow .35s,transform .35s}",
      ".sif-card.is-active{box-shadow:0 24px 64px rgba(0,0,0,.68)}",
      // While popped out, the card is fixed-positioned (lifted into the
      // pop-out overlay). transform-origin top-left so the scale animation
      // lines up with the measured rect.
      ".sif-card.sif-popped{position:fixed!important;z-index:100000!important;margin:0!important;transition:transform .34s cubic-bezier(.2,.8,.25,1),box-shadow .34s ease!important}",
      ".sif-card.sif-popped.sif-popped--open{box-shadow:0 40px 90px rgba(0,0,0,.55)!important}",
      /* Mobile: dim side cards */
      "@media(max-width:767px){.sif-card{filter:brightness(.5)}.sif-card.is-active{filter:brightness(1)!important}.sif-widget{--sif-card-h:69vh;--sif-card-w:calc(69vh*9/16);--sif-gap:9px;--sif-step-frac:0.72}.sif-viewport{width:100%}}",
      "@media(min-width:768px) and (pointer:coarse) and (hover:none){.sif-card{filter:brightness(.5)}.sif-card.is-active{filter:brightness(1)!important}.sif-widget{--sif-card-h:69vh;--sif-card-w:calc(69vh*9/16);--sif-gap:9px;--sif-step-frac:0.72}.sif-viewport{width:100%}}",
      /* Desktop */
      "@media(min-width:768px) and (any-pointer:fine){.sif-widget:not(.sif-force-mobile) .sif-card{transform:scale(1)!important;filter:brightness(1)!important}.sif-widget:not(.sif-force-mobile){--sif-card-w:min(320px,calc(65vh*9/16));--sif-card-h:min(568px,65vh);--sif-gap:40px}}",
      /* Poster */
      ".sif-poster{position:absolute;inset:0;border-radius:20px;overflow:hidden}",
      ".sif-poster-ph{position:absolute;inset:0;background:linear-gradient(160deg,#2a2a2a 0%,#111 100%)}",
      ".sif-poster-ph[data-idx='0']{background:linear-gradient(160deg,#1d3a2f 0%,#0d1f1a 100%)}",
      ".sif-poster-ph[data-idx='1']{background:linear-gradient(160deg,#2e1f3a 0%,#160d1f 100%)}",
      ".sif-poster-ph[data-idx='2']{background:linear-gradient(160deg,#3a2010 0%,#1f0f05 100%)}",
      ".sif-poster-ph[data-idx='3']{background:linear-gradient(160deg,#10243a 0%,#05121f 100%)}",
      ".sif-poster-ph[data-idx='4']{background:linear-gradient(160deg,#1a3020 0%,#0a1810 100%)}",
      ".sif-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px}",
      // opacity transition powers the poster<->video crossfade. .sif-video
      // sits ABOVE the poster in DOM order (so opacity 1 fully obscures it,
      // opacity 0 reveals the poster beneath). 150ms is short enough to feel
      // snappy, long enough to read as a deliberate fade rather than a snap.
      ".sif-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px;display:none;background:#000;pointer-events:none;-webkit-touch-callout:none;opacity:0;transition:opacity .15s ease}",
      ".sif-top-bar{position:absolute;top:0;left:0;right:0;padding:22px 20px 40px;background:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      ".sif-top-bar a{pointer-events:auto}",
      ".sif-logo{width:52px;height:52px;border-radius:50%;border:2px solid var(--sif-logo-ring,var(--sif-accent));overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center}",
      ".sif-logo.sif-logo--grad{box-sizing:border-box;width:60.5px;height:60.5px;border:none;background:transparent;position:relative;overflow:visible}",
      ".sif-logo.sif-logo--grad::before{content:'';position:absolute;inset:0;border-radius:50%;background:var(--sif-ring-grad);-webkit-mask:radial-gradient(circle, transparent 0 28.25px, #000 28.25px);mask:radial-gradient(circle, transparent 0 28.25px, #000 28.25px)}",
      ".sif-logo.sif-logo--grad .sif-logo-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;z-index:1}",
      ".sif-logo img{width:100%;height:100%;object-fit:cover}",
      // Countdown ring (top-right) — hidden. Superseded by the bottom-right
      // .sif-time-counter (current / duration). The timer markup is kept
      // and the timeupdate / loadedmetadata handlers still write to it
      // (harmless on a display:none element), so this can be brought back
      // by removing the single rule below.
      ".sif-timer{display:none!important}",
      ".sif-timer{position:relative;width:52px;height:52px;flex-shrink:0}",
      ".sif-timer svg{width:52px;height:52px;transform:rotate(-90deg)}",
      ".sif-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".sif-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".sif-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}",
      ".sif-bottom-bar{position:absolute;bottom:0;left:0;right:0;padding:40px 16px 26px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".sif-title{color:#fff;font-size:16.5px;font-weight:600;line-height:1.35;letter-spacing:.01em;text-shadow:0 1px 4px rgba(0,0,0,.4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-left:4px;margin-right:20px}",
      // !important on the reset properties defeats host-page CSS that might
      // target generic `button` (e.g. `button{background:#teal}` from the
      // embedding theme). The play-btn is a full-card transparent overlay —
      // any inherited background would cover the video poster.
      ".sif-play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;cursor:pointer;transition:opacity .2s;border:0!important;background:transparent!important;padding:0!important;color:inherit;font:inherit;-webkit-appearance:none;appearance:none}",
      ".sif-play-btn.hidden{opacity:0;pointer-events:none}",
      // Hover-preview: same visual as .hidden (opacity 0) but stays clickable,
      // so the user can transition from preview → real play by clicking
      // anywhere on the card (including the area where the play button is).
      ".sif-play-btn.preview-active{opacity:0}",
      ".sif-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".sif-pause-ind.visible{opacity:1}",
      // Buffering indicator: styled to match .sif-mute-btn / .sif-popout-btn
      // (dark glassy circle, hairline border) with a spinning arc inside.
      // Driven by the native <video> "waiting"/"playing" events.
      ".sif-loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;z-index:11;pointer-events:none;opacity:0;transition:opacity .2s ease}",
      ".sif-loading.visible{opacity:1}",
      ".sif-loading::after{content:\"\";width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);border-top-color:rgba(255,255,255,.95);animation:sif-spin .8s linear infinite}",
      "@keyframes sif-spin{to{transform:rotate(360deg)}}",
      "@media (prefers-reduced-motion: reduce){.sif-loading::after{animation:none}}",
      ".sif-play-circle{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;transition:transform .18s,background .18s}",
      ".sif-play-btn:hover .sif-play-circle{transform:scale(1.1);background:rgba(255,255,255,.28)}",
      ".sif-play-circle svg{margin-left:4px}",
      ".sif-pause-ind .sif-play-circle svg{margin-left:0}",
      ".sif-mute-btn{position:absolute;bottom:58px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:flex;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s}",
      ".sif-mute-btn.visible{opacity:1}",
      ".sif-mute-btn svg{width:15px;height:15px}",
      // Pop-out button. Sits just above the mute button, same right edge.
      // Hidden by default; shown (on desktop only) once a video is playing,
      // mirroring the mute button's reveal. The CSS media query means it is
      // never shown on mobile / touch — pop-out is desktop-only.
      ".sif-popout-btn{position:absolute;bottom:100px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:none;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s,background .18s}",
      ".sif-popout-btn:hover{background:rgba(0,0,0,.7)!important}",
      ".sif-popout-btn svg{width:15px;height:15px}",
      "@media(min-width:768px) and (any-pointer:fine){.sif-popout-btn.visible{display:flex;opacity:1}}",
      // Desktop hover-fade for the mute + pop-out buttons. Default (card
      // NOT hovered) holds opacity at 1 for 2s, then fades over .35s; on
      // hover the transition-delay is zeroed so the buttons pop back in
      // over .15s. The 2s-stay-then-fade is achieved purely through the
      // transition-delay — no JS timer. Higher specificity than the
      // `.visible` rules above so this wins; scoped to (hover:hover) so
      // touch devices keep the always-visible behaviour from above.
      "@media(hover:hover){",
        ".sif-card .sif-mute-btn.visible,.sif-card .sif-popout-btn.visible{opacity:0;transition:opacity .35s ease 2s}",
        ".sif-card:hover .sif-mute-btn.visible,.sif-card:hover .sif-popout-btn.visible{opacity:1;transition:opacity .15s ease 0s}",
      "}",
      // Keyboard-focused mute/pop-out reappear immediately even if the
      // hover-fade has dropped them to opacity:0 — otherwise a Tab user
      // lands on an invisible button with no visible focus state.
      ".sif-mute-btn:focus-visible,.sif-popout-btn:focus-visible{opacity:1!important;transition:opacity 0s!important}",
      // Visually-hidden live region: SR-only "Reel N of M" announcements
      // on carousel navigation (set in updateUI).
      ".sif-live{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}",
      ".sif-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(4px);color:#fff;font-size:15px;font-weight:700;padding:7px 14px;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);z-index:16;pointer-events:none;opacity:0;transition:opacity .15s}",
      ".sif-speed.visible{opacity:1}",
      ".sif-progress{position:absolute;bottom:0;left:0;right:0;height:20px;background:transparent;z-index:20;cursor:pointer;opacity:0;transition:opacity 1s;border-radius:0 0 20px 20px;display:flex;align-items:flex-end}",
      "@media(hover:hover){.sif-card.sif-playing:hover .sif-progress{opacity:1}}",
      ".sif-progress.show{opacity:1!important}",
      ".sif-progress-track{position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,.25);border-radius:0 0 20px 20px;transition:height .15s;pointer-events:none}",
      ".sif-progress:hover .sif-progress-track,.sif-progress.show .sif-progress-track{height:9px}",
      ".sif-progress-fill{position:absolute;bottom:0;left:0;height:6px;background:#fff;pointer-events:none;width:0%;transition:height .15s;border-radius:0 0 0 20px}",
      ".sif-progress:hover .sif-progress-fill,.sif-progress.show .sif-progress-fill{height:9px}",
      ".sif-progress-thumb{position:absolute;bottom:-3.5px;width:13px;height:13px;background:#fff;border-radius:50%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .15s,bottom .15s;box-shadow:0 1px 4px rgba(0,0,0,.4)}",
      ".sif-progress:hover .sif-progress-thumb,.sif-progress.show .sif-progress-thumb,.sif-progress:focus-visible .sif-progress-thumb{opacity:1;bottom:-2px}",
      // Keyboard-focused scrub bar is fully visible (the existing :hover and
      // .show rules don't cover keyboard focus). :focus-visible only — mouse
      // clicks on the bar already focus it but the heuristic suppresses the
      // visible style, so mouse users never see the outline.
      ".sif-progress:focus-visible{opacity:1!important;outline:2px solid #fff;outline-offset:2px}",
      ".sif-progress:focus-visible .sif-progress-track,.sif-progress:focus-visible .sif-progress-fill{height:9px}",
      // Count-up timer ("0:30 / 0:40"), shown whenever the scrub bar is shown
      // — i.e. tied to the same triggers (.show class, or :hover when the
      // card is .sif-playing on a hover-capable pointer). tabular-nums keeps
      // the digits from jittering as they count up. pointer-events:none so
      // touches on the scrub area still go to the scrub bar underneath.
      ".sif-time-counter{position:absolute;bottom:10px;right:14px;font-size:11px;font-weight:400;color:rgba(255,255,255,.95);text-shadow:0 1px 3px rgba(0,0,0,.55);letter-spacing:.02em;z-index:15;pointer-events:none;opacity:0;transition:opacity 1s;font-variant-numeric:tabular-nums}",
      ".sif-progress.show ~ .sif-time-counter{opacity:1}",
      "@media(hover:hover){.sif-card.sif-playing:hover .sif-time-counter{opacity:1}}",
      ".sif-arrow{position:absolute;top:50%;transform:translateY(-50%);width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;border-radius:50%!important;background:#fff!important;border:none!important;box-shadow:0 3px 14px rgba(0,0,0,.13);cursor:pointer;display:none;align-items:center;justify-content:center;z-index:30;transition:background .18s,transform .18s,box-shadow .18s}",
      ".sif-arrow:hover{background:var(--sif-accent)!important;transform:translateY(-50%) scale(1.1);box-shadow:0 6px 20px rgba(211,0,17,.3)}",
      ".sif-arrow:hover svg polyline{stroke:#fff}",
      ".sif-arrow--left{left:-24px}",
      ".sif-arrow--right{right:-24px}",
      // Accordion-mode arrow positioning. The fan is narrower than the
      // viewport, so the row-mode left/right:-24px would leave the arrows
      // far from the visible card edges. JS (applyAccordionArrowOffset)
      // writes the computed distance-from-centre into --sif-arrow-offset on
      // every layout pass; the calc places each arrow that far from the
      // wrapper's horizontal centre. Higher specificity than the row rules
      // above so row mode is untouched. 300px fallback only matters if JS
      // hasn't run yet (e.g. between markup insertion and initEngine).
      ".sif-widget.sif-accordion .sif-arrow--left{left:calc(50% - var(--sif-arrow-offset,300px))}",
      ".sif-widget.sif-accordion .sif-arrow--right{right:calc(50% - var(--sif-arrow-offset,300px))}",
      ".sif-widget.sif-force-mobile .sif-arrow--left{left:calc(50% - var(--sif-arrow-offset,200px))}",
      ".sif-widget.sif-force-mobile .sif-arrow--right{right:calc(50% - var(--sif-arrow-offset,200px))}",
      "@media(min-width:600px){.sif-arrow{display:flex!important}}",
      // Dots: the BUTTON is a 24x24 transparent hit area (meets WCAG 2.2 AA
      // 2.5.8 Target Size Minimum); the actual visible dot is a centered
      // 8.5x8.5 ::before pseudo-element. gap:0 because hit areas already
      // touch — visible dots end up ~15.5px apart, slightly wider than the
      // previous 8.5px gap but still tight.
      ".sif-dots{display:flex;justify-content:center;gap:0;margin-top:18px}",
      ".sif-dot{width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;border-radius:50%!important;background:transparent!important;border:none!important;cursor:pointer;padding:0!important;display:flex;align-items:center;justify-content:center}",
      ".sif-dot::before{content:\"\";display:block;width:8.5px;height:8.5px;border-radius:50%;background:#ccc;transition:background .25s,transform .25s}",
      ".sif-dot.is-active::before{background:var(--sif-accent);transform:scale(1.35)}",
      // Dim backdrop shown behind a popped-out card. font-family is set here
      // because a card is moved INTO this overlay (a child of document.body)
      // while popped — outside .sif-widget — so it would otherwise lose the
      // widget font. The --sif-* custom properties the card chrome relies on
      // (logo ring colour / gradient) are copied onto the overlay per
      // instance in JS, since those are per-widget values.
      ".sif-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);opacity:0;transition:opacity .34s ease;pointer-events:none;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif}",
      ".sif-overlay.open{opacity:1;pointer-events:auto}",
      // Accordion mode: block pointer events on off-stage cards. Off-stage
      // cards sit INSIDE the viewport (just translated out at opacity 0),
      // so without this their invisible logo links / mute area would still
      // catch clicks. Scoped to desktop because the marker class can stay
      // set when an accordion widget is viewed at mobile width — mobile
      // never has off-stage cards, so the rule must not apply there.
      "@media(min-width:768px) and (any-pointer:fine){",
        ".sif-widget.sif-accordion .sif-card[data-offstage='1'],",
        ".sif-widget.sif-accordion .sif-card[data-offstage='1'] *{pointer-events:none!important}",
      "}",
      // Respect prefers-reduced-motion: kill the long widget animations
      // (carousel slide, accordion fan rotation, pop-out grow/shrink, overlay
      // fade). Short hover/feedback transitions (under ~.25s) are kept since
      // they're not the kind of motion the preference targets. Specificity
      // matches the original rules so later-wins covers !important ones.
      "@media (prefers-reduced-motion: reduce){",
        ".sif-track,.sif-card,.sif-card.sif-popped,.sif-overlay{transition:none!important}",
      "}",
    ].join("");
    document.head.appendChild(style);
  }

  // When cfg.forceMobile is on, inject the mobile @media declarations as
  // unconditional rules. This promotes mobile sizing (card-h, card-w,
  // gap, step-frac, dimmed-non-active filter, full-width viewport) to
  // apply even on desktop viewports, so the carousel renders mobile-
  // style — single focused card + peek cards — in narrow side-layout
  // columns. The flag is set per-embed instance, but the rules below are
  // global; we scope each one to .sif-widget descendants of the embed's
  // container via the parent selector so they don't bleed into other
  // infinite widgets on the same page.
  if (forceMobile) {
    // Conservative card sizing for forceMobile use — the carousel typically
    // lives in a narrow side-layout column (~35-42% of page), so smaller
    // cards keep the peek cards from getting clipped. 60vh capped at 480px
    // tall (vs the 69vh / 620px we use for true mobile viewports where
    // there's no column constraint).
    var fmStyle = document.createElement("style");
    fmStyle.textContent = [
      "#", containerId, " .sif-card{filter:brightness(.5);}",
      "#", containerId, " .sif-card.is-active{filter:brightness(1)!important;}",
      "#", containerId, " .sif-widget{",
        "--sif-card-h:min(560px,72vh);",
        "--sif-card-w:calc(min(560px,72vh)*9/16);",
        "--sif-gap:9px;",
        "--sif-step-frac:0.78;",
        "padding:29px 0 9px;",
      "}",
      "#", containerId, " .sif-viewport{width:100%;}"
    ].join("");
    document.head.appendChild(fmStyle);
  }

  // ── Container ───────────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) { console.warn("Splshy Infinite: no element '" + containerId + "'"); return; }

  container.innerHTML =
    '<div class="sif-widget">' +
      '<div class="sif-outer">' +
        '<button class="sif-arrow sif-arrow--left" aria-label="Previous reel" style="padding:0!important;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block;flex-shrink:0;"><polyline points="10,2 2,10 10,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
        '</button>' +
        '<div class="sif-viewport"><div class="sif-track"></div></div>' +
        '<button class="sif-arrow sif-arrow--right" aria-label="Next reel" style="padding:0!important;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block;flex-shrink:0;"><polyline points="2,2 10,10 2,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sif-dots"></div>' +
      '<div class="sif-live" aria-live="polite" aria-atomic="true"></div>' +
    '</div>';

  var widget   = container.querySelector(".sif-widget");
  if (desktopStyle === "accordion-3" || desktopStyle === "accordion-5") widget.classList.add("sif-accordion");
  if (forceMobile) widget.classList.add("sif-force-mobile");
  // Cancel any pending click-to-centre preview intent if the user leaves the
  // widget area before the slide finishes — they've moved on, don't preview.
  widget.addEventListener("mouseleave", function(){
    cards.forEach(function(c){ c.previewPending = false; });
  });
  var viewport = widget.querySelector(".sif-viewport");
  var track    = widget.querySelector(".sif-track");
  var prevBtn  = widget.querySelector(".sif-arrow--left");
  var nextBtn  = widget.querySelector(".sif-arrow--right");
  var dotsEl   = widget.querySelector(".sif-dots");

  // Logo ring colour. A solid colour sets the dedicated --sif-logo-ring
  // variable (used only by the logo border, so it doesn't affect the
  // arrows/dots which use --sif-accent); the gradient is set as
  // --sif-ring-grad and applied via the .sif-logo--grad markup per card.
  if (ringIsGradient) widget.style.setProperty("--sif-ring-grad", IG_RING);
  else widget.style.setProperty("--sif-logo-ring", logoRing);

  // ── Pop-out overlay (one per widget instance) ───────
  // Created per instance because each carousel pops out independently. The
  // --sif-* custom properties the card chrome uses are copied onto the
  // overlay so the logo ring still renders correctly once the card is moved
  // into it (the overlay is outside .sif-widget, so it can't inherit them).
  var overlay = document.createElement("div");
  overlay.className = "sif-overlay";
  // Pop-out overlay is a modal dialog — same a11y pattern as the stories
  // overlay: SR announces "Video pop-out dialog", aria-modal hints that the
  // rest of the page is non-interactive while it's open.
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Video pop-out");
  if (ringIsGradient) overlay.style.setProperty("--sif-ring-grad", IG_RING);
  else overlay.style.setProperty("--sif-logo-ring", logoRing);
  document.body.appendChild(overlay);

  var current     = 0;
  var globalMuted = false;
  var activeFade  = null;
  var busy        = false;
  // True while (or just after) the user is dragging a progress bar, so the
  // viewport swipe handler ignores that touch and doesn't navigate.
  var scrubbing   = false;
  var scrubEndTimer = null;
  // True while a card from THIS carousel is popped out. While popped, all
  // carousel navigation is frozen (see navigate()/step() and the handlers).
  var popped      = false;
  var popBusy     = false;
  var poppedCard  = null;   // the card object currently popped, if any

  function mod(x,m){ return ((x%m)+m)%m; }
  function fmtTime(s){ var m=Math.floor(s/60),sec=Math.floor(s%60); return m+":"+(sec<10?"0":"")+sec; }
  function syncMuteIcon(btn,muted){
    if (!btn) return;
    btn.querySelectorAll(".sif-unmute").forEach(function(el){ el.style.display=muted?"none":"block"; });
    btn.querySelectorAll(".sif-mx1,.sif-mx2").forEach(function(el){ el.style.display=muted?"block":"none"; });
    btn.setAttribute("aria-label", muted ? "Unmute audio" : "Mute audio");
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  // ── Build cards ──────────────────────────────────────
  var cards = [];
  var dots  = [];

  // Under future doubling (step 3, accordion modes with small reel counts),
  // two cards can share the same reel object — and therefore the same
  // videoUrl/posterUrl. That is intentional: the doubled array is built in
  // true repeating order so the engine's recycle-by-effective-n still loops
  // cleanly. The two copies are never co-visible (proven by the V=3/V=5
  // band derivations in the plan).
  for (var ri = 0; ri < n; ri++) {
    (function(reelIdx){
      var realIdx = reelIdx % realCount;
      var reel = effectiveReels[reelIdx];
      var card = document.createElement("div");
      card.className = "sif-card";

      var poster = document.createElement("div");
      poster.className = "sif-poster";
      var ph = document.createElement("div");
      ph.className = "sif-poster-ph";
      ph.setAttribute("data-idx", reelIdx%5);
      poster.appendChild(ph);
      if (reel.posterUrl){
        var img = document.createElement("img");
        img.src=reel.posterUrl; img.alt=reel.label||"";
        poster.appendChild(img);
      }
      card.appendChild(poster);

      var video = document.createElement("video");
      video.className="sif-video";
      video.src=reel.videoUrl;
      video.setAttribute("playsinline","");
      video.setAttribute("preload","metadata");
      // a11y: label the video so screen-reader rotor / video-element nav
      // identifies it by reel title rather than as an unnamed media element.
      video.setAttribute("aria-label", "Video: " + (reel.label || "Untitled"));
      if (reel.posterUrl) video.setAttribute("poster",reel.posterUrl);
      card.appendChild(video);

      // Empty logoUrl (after per-reel → global fallback) means "no Instagram
      // badge" — hide the entire top-left anchor (logo ring + follower count)
      // rather than showing a generic 'S' placeholder. Builder users opt IN
      // to the badge by filling in a logoUrl; leaving it blank yields a clean
      // top-left.
      var resolvedLogo = reel.logoUrl||logoUrl||"";
      var badgeHTML = "";
      if (resolvedLogo){
        var logoContent = '<img src="'+safeUrl(resolvedLogo)+'" alt="logo">';
        // Gradient ring wraps the logo in an inner circle (the masked ::before
        // draws the ring); a solid ring uses the .sif-logo border directly.
        var logoHTML = ringIsGradient
          ? '<div class="sif-logo sif-logo--grad"><div class="sif-logo-inner">'+logoContent+'</div></div>'
          : '<div class="sif-logo">'+logoContent+'</div>';
        badgeHTML =
          '<a href="'+safeUrl(igUrl)+'" target="_blank" rel="noopener" aria-label="Visit on Instagram (opens in new tab)" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">'+
            logoHTML+
            '<div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:400;letter-spacing:0.03em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">'+escapeHTML(followerCount)+'</div>'+
          '</a>';
      }
      var RC = (2*Math.PI*23).toFixed(2);

      card.insertAdjacentHTML("beforeend",
        '<div class="sif-top-bar">'+
          badgeHTML+
          '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">'+
            '<div class="sif-timer"><svg viewBox="0 0 52 52"><circle class="sif-timer-bg" cx="26" cy="26" r="23"/><circle class="sif-timer-ring" cx="26" cy="26" r="23" stroke-dasharray="'+RC+'" stroke-dashoffset="0"/></svg><div class="sif-timer-text">--</div></div>'+
            '<div style="height:13px;"></div>'+
          '</div>'+
        '</div>'+
        '<div class="sif-bottom-bar"><div class="sif-title">'+escapeHTML(reel.label||"")+'</div></div>'+
        '<button class="sif-play-btn" aria-label="Play video"><div class="sif-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 2L16 10L2 18V2Z" fill="white"/></svg></div></button>'+
        '<div class="sif-pause-ind"><div class="sif-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>'+
        '<div class="sif-loading" role="status" aria-label="Loading video"></div>'+
        '<button class="sif-mute-btn" aria-label="Mute audio" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="sif-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="sif-mx1" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="sif-mx2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>'+
        '<button class="sif-popout-btn" aria-label="Pop out video">'+
          '<svg class="sif-popout-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="13" y2="11"/><line x1="3" y1="21" x2="11" y2="13"/></svg>'+
          '<svg class="sif-popin-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'+
        '</button>'+
        '<div class="sif-speed">2x</div>'+
        '<div class="sif-progress" role="slider" tabindex="0" aria-label="Seek video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="sif-progress-track"></div><div class="sif-progress-fill"></div><div class="sif-progress-thumb"></div></div>'+
        '<div class="sif-time-counter">0:00 / 0:00</div>'
      );

      card.addEventListener("contextmenu",function(e){ e.preventDefault(); });

      var ring=card.querySelector(".sif-timer-ring");
      var timerText=card.querySelector(".sif-timer-text");
      var timeCounter=card.querySelector(".sif-time-counter");
      var RC2=2*Math.PI*23;
      ring.style.strokeDasharray=RC2;
      var dur=0;

      video.addEventListener("loadedmetadata",function(){
        dur=video.duration;
        timerText.textContent=fmtTime(dur);
        timeCounter.textContent="0:00 / "+fmtTime(dur);
      });
      video.addEventListener("timeupdate",function(){
        if (!dur) return;
        var pct=video.currentTime/dur;
        ring.style.strokeDashoffset=RC2*(1-pct);
        timerText.textContent=fmtTime(Math.max(0,dur-video.currentTime));
        timeCounter.textContent=fmtTime(video.currentTime)+" / "+fmtTime(dur);
        var pf=card.querySelector(".sif-progress-fill"),pt=card.querySelector(".sif-progress-thumb");
        if (pf) pf.style.width=(pct*100)+"%";
        if (pt) pt.style.left=(pct*100)+"%";
        // a11y: keep slider aria-valuenow in sync with the visual fill.
        progBar.setAttribute("aria-valuenow", Math.round(pct*100));
        // GA4: video_progress at the 50% mark, once per playback session.
        if (!cardObj._progressFired && pct >= 0.5){
          cardObj._progressFired = true;
          trackEvent("video_progress", reelParams(cardObj.reelIdx));
        }
      });
      video.addEventListener("ended",function(){
        ring.style.strokeDashoffset=0; timerText.textContent=fmtTime(dur);
        timeCounter.textContent=fmtTime(dur)+" / "+fmtTime(dur);
        previewState = "idle";
        card.classList.remove("sif-playing");
        card.querySelector(".sif-play-btn").classList.remove("hidden");
        card.querySelector(".sif-play-btn").classList.remove("preview-active");
        card.querySelector(".sif-mute-btn").classList.remove("visible");
        card.querySelector(".sif-popout-btn").classList.remove("visible");
        var pi=card.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
        var pb=card.querySelector(".sif-progress"); if (pb) pb.classList.remove("show");
        fadeOut();
        // Auto-advance — the underlying rule is: after a reel ends, the
        // NEXT reel (ended.realIdx + 1) should play. Where that target reel
        // currently is determines whether we need to slide first:
        //
        //   • Ended in CENTRE  → target is current is-next. Slide 1 right;
        //     target lands at the new centre and plays.
        //   • Ended in RIGHT (is-next) → target is the off-screen reel after
        //     it. Slide 1 right; target lands at the new is-next (right)
        //     slot and plays — the played reel keeps its visible position
        //     by becoming the new centre.
        //   • Ended in LEFT (is-prev)  → target is already the current
        //     centre. DON'T slide; just kick off centre's play button. The
        //     user's focal point doesn't shift.
        //
        // Skipped while popped (engine frozen), busy (mid-slide — first
        // ended wins), or when disabled via cfg.
        if (autoAdvance && !popped && !busy) {
          var rel = cardObj.slot - centreSlot;
          var targetRealIdx = mod(cardObj.realIdx + 1, realCount);
          if (rel === -1) {
            // Target is already centre — no slide; play centre directly.
            // Pick exactly ONE matching card (preferring the one at centre)
            // — accordion modes use doubling so multiple cards can share a
            // realIdx, and clicking play on more than one chains resets.
            var pickL = null;
            for (var iL = 0; iL < cards.length; iL++) {
              if (cards[iL].realIdx === targetRealIdx) {
                if (cards[iL].slot === centreSlot) { pickL = cards[iL]; break; }
                if (!pickL) pickL = cards[iL];
              }
            }
            if (pickL) {
              var pbL = pickL.el.querySelector(".sif-play-btn");
              if (pbL) pbL.click();
            }
          } else {
            // Slide one forward; play the target card once it lands.
            pendingAutoAdvanceTarget = targetRealIdx;
            navigate(mod(current + 1, realCount));
          }
        }
      });

      var playBtn=card.querySelector(".sif-play-btn");
      var muteBtn=card.querySelector(".sif-mute-btn");
      var popoutBtn=card.querySelector(".sif-popout-btn");

      // ── Hover preview ──────────────────────────────────
      // 1.25s after mouseenter, the video plays muted from 0.5s for 3s,
      // then freezes on the last frame. mouseleave snaps back to the poster.
      // Clicking the card (or the play button) during preview transitions
      // to real playback: video resets to 0 and plays with audio (per the
      // user's globalMuted state). Skipped on touch (no mouseenter) and
      // on accordion non-centre cards (only the centre previews there).
      // Crossfade helpers. Replace direct `video.style.display=block/none`
      // toggles with fadeIn/fadeOut so the swap reads as a 150ms opacity
      // crossfade instead of a snap. Poster stays display:block beneath at
      // all times — video opacity 1 covers it, opacity 0 reveals it.
      function fadeIn(){
        video.style.opacity = "0";
        video.style.display = "block";
        void video.offsetHeight;          // force a reflow so the transition fires
        video.style.opacity = "1";
      }
      function fadeOut(){
        video.style.opacity = "0";
        setTimeout(function(){
          // Defensive: only hide if no one re-revealed it during the fade.
          if (video.style.opacity === "0") {
            video.style.display = "none";
            video.style.opacity = "";       // back to CSS default for the next fadeIn
          }
        }, 160);
      }

      var previewState = "idle";   // "idle" | "previewing" | "playing"
      var previewTimer = null;
      var previewEndTimer = null;
      function shouldStartPreview(){
        if (!hoverPreview) return false;
        if (isMobileLayout()) return false;
        if (popped) return false;
        if (busy) return false;
        if (previewState !== "idle") return false;
        if (video.style.display === "block") return false;  // already playing for real
        // Accordion modes: only the centre card previews. Row mode: any card.
        if (isAccordionDesktop() && cardObj.slot !== centreSlot) return false;
        return true;
      }
      function startPreview(){
        if (!shouldStartPreview()) return;
        previewState = "previewing";
        video.muted = true;
        try { video.currentTime = 0.5; } catch(err){}
        fadeIn();
        playBtn.classList.add("preview-active");
        video.play().catch(function(){});
        // No auto-pause: preview plays as long as the cursor stays on the
        // card. mouseleave (endPreview) is the only thing that stops it.
        // Matches the single widget's behavior.
      }
      function endPreview(){
        if (previewState !== "previewing") return;
        if (previewEndTimer){ clearTimeout(previewEndTimer); previewEndTimer = null; }
        previewState = "idle";
        video.pause();
        try { video.currentTime = 0; } catch(err){}
        fadeOut();
        playBtn.classList.remove("preview-active");
        card.classList.remove("sif-playing");
        if (progBar) progBar.classList.remove("show");
        if (video._sifFT){ clearTimeout(video._sifFT); video._sifFT = null; }
        video.muted = globalMuted;
      }
      function transitionPreviewToPlay(){
        if (previewState !== "previewing") return;
        if (previewEndTimer){ clearTimeout(previewEndTimer); previewEndTimer = null; }
        previewState = "playing";
        try { video.currentTime = 0; } catch(err){}
        video.muted = globalMuted;
        playBtn.classList.remove("preview-active");
        cards.forEach(function(c){ if (c.video !== video) resetCard(c); });
        playBtn.classList.add("hidden");
        muteBtn.classList.add("visible");
        popoutBtn.classList.add("visible");
        syncMuteIcon(muteBtn, globalMuted);
        video.play().catch(function(){});
      }
      // a11y / UX note: this is the "user lingered on a card" trigger. The
      // separate post-navigation trigger (schedulePostNavPreview below)
      // handles the case where a user clicks a side card to bring it to
      // centre — for that flow we want the 1s delay to start when the card
      // LANDS at centre, not from the original side-card hover.
      card.addEventListener("mouseenter", function(){
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(startPreview, 1000);
      });
      // Click-to-centre flow: the click handler sets cardObj.previewPending,
      // then navigate() runs the slide. finishStep — after the slide finishes
      // and busy goes false — calls this on the now-centred card to start a
      // FRESH 1s timer. So the user gets a true "1s after centred" delay
      // regardless of how long the slide animation took.
      function schedulePostNavPreview(){
        if (!hoverPreview) return;
        if (isMobileLayout()) return;
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(startPreview, 1000);
      }
      card.addEventListener("mouseleave", function(){
        if (previewTimer){ clearTimeout(previewTimer); previewTimer = null; }
        endPreview();
      });

      playBtn.addEventListener("click",function(e){
        e.stopPropagation();
        // On mobile (any mode) AND in accordion desktop modes, tapping a
        // non-centre card should bring it to the centre rather than play it
        // in the background. Desktop ROW mode keeps the existing behaviour
        // (start any visible card playing).
        if ((isMobileLayout() || isAccordionDesktop()) && realIdx !== current){
          cardObj.previewPending = true;
          navigate(realIdx);
          return;
        }
        // Cancel any pending preview and transition straight to real play.
        if (previewTimer){ clearTimeout(previewTimer); previewTimer = null; }
        if (previewState === "previewing"){
          transitionPreviewToPlay();
          return;
        }
        cards.forEach(function(c){ if (c.video!==video) resetCard(c); });
        video.muted=globalMuted;
        fadeIn();
        playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
        popoutBtn.classList.add("visible");   // desktop-only via CSS media query
        previewState = "playing";
        syncMuteIcon(muteBtn,globalMuted); video.play();
      });
      muteBtn.addEventListener("click",function(e){
        e.stopPropagation(); globalMuted=!globalMuted;
        cards.forEach(function(c){ c.video.muted=globalMuted; syncMuteIcon(c.el.querySelector(".sif-mute-btn"),globalMuted); });
      });
      popoutBtn.addEventListener("click",function(e){
        e.stopPropagation();
        togglePopout(cardObj);
      });

      // Buffering indicator: show on `waiting` (browser stalled), hide on
      // `playing`/`canplay` (data arrived). 400ms grace period before the
      // spinner appears — every play() call fires `waiting` for a tick while
      // the browser decodes the first frame, so without the delay the spinner
      // flashes on every click. Also hide on `error` so a permanently-broken
      // stream doesn't get stuck with a spinner.
      var loadingEl = card.querySelector(".sif-loading");
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

      // GA4 / analytics: video_play (first playing), video_progress (50%),
      // video_complete (ended), video_error. playFired / progressFired flags
      // are reset in resetCard so a recycled card can fire fresh events.
      video.addEventListener("playing", function(){
        if (!cardObj._playFired){
          cardObj._playFired = true;
          trackEvent("video_play", reelParams(cardObj.reelIdx));
        }
      });
      video.addEventListener("ended", function(){
        trackEvent("video_complete", reelParams(cardObj.reelIdx));
      });
      video.addEventListener("error", function(){
        trackEvent("video_error", reelParams(cardObj.reelIdx));
      });

      var progBar=card.querySelector(".sif-progress");
      var dragging=false;
      function getPct(e){ var r=progBar.getBoundingClientRect(); return Math.max(0,Math.min(1,((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width)); }
      function seekTo(p){ if (dur) video.currentTime=p*dur; }
      progBar.addEventListener("click",function(e){ e.stopPropagation(); });
      progBar.addEventListener("mousedown",function(e){ e.stopPropagation(); dragging=true; progBar.classList.add("show"); seekTo(getPct(e)); });
      progBar.addEventListener("touchstart",function(e){ e.stopPropagation(); dragging=true; scrubbing=true; if(scrubEndTimer)clearTimeout(scrubEndTimer); progBar.classList.add("show"); seekTo(getPct(e)); },{passive:true});
      document.addEventListener("mousemove",function(e){ if (dragging) seekTo(getPct(e)); });
      document.addEventListener("touchmove",function(e){ if (dragging){ scrubbing=true; seekTo(getPct(e)); } },{passive:true});
      document.addEventListener("mouseup",function(){ if (dragging){ dragging=false; progBar.classList.remove("show"); } });
      document.addEventListener("touchend",function(){
        if (dragging){
          dragging=false; progBar.classList.remove("show");
          // Keep `scrubbing` true briefly so the swipe handler that fires
          // from the SAME touch release is ignored.
          if (scrubEndTimer) clearTimeout(scrubEndTimer);
          scrubEndTimer = setTimeout(function(){ scrubbing=false; }, 350);
        }
      });
      // a11y: keyboard scrubbing. ← / → seek ±5s, Home / End jump to ends.
      // stopPropagation prevents the widget-level Arrow handler (which
      // navigates the carousel) from also firing while the scrub bar has
      // focus.
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
      video.addEventListener("play",function(){
        // Mark the card as playing so the hover-reshow CSS rule
        // (.sif-card.sif-playing:hover .sif-progress) applies to it —
        // this is what lets a side card's scrub bar reappear on hover
        // after the 7s auto-hide, the same way the centre card does.
        card.classList.add("sif-playing");
        progBar.classList.add("show");
        clearTimeout(video._sifFT);
        video._sifFT=setTimeout(function(){ if (!dragging) progBar.classList.remove("show"); },7000);
      });
      // On mobile, when the video is PAUSED mid-playback, show the scrub bar
      // and keep it visible — so the viewer can see how far along they are /
      // how much is left while paused. Mobile has no hover, so without this
      // the bar would just be hidden when paused. The pending 7s auto-hide
      // (video._sifFT) is cancelled so the bar holds for as long as the video
      // stays paused; the next `play` re-arms the normal auto-hide. The
      // `!video.ended` guard skips this when the pause is the video finishing
      // — the `ended` handler clears the bar. Desktop is unaffected: it has
      // hover-to-reshow and this whole block is gated on (hover:none).
      video.addEventListener("pause",function(){
        if (video.ended) return;
        if (window.matchMedia("(hover:none)").matches){
          clearTimeout(video._sifFT);
          progBar.classList.add("show");
        }
      });

      var speedInd=card.querySelector(".sif-speed");
      var ht=null,holding=false,swallow=false;
      function startHold(){ if (video.style.display!=="block"||video.paused) return; ht=setTimeout(function(){ holding=true; if (!video.paused){ video.playbackRate=2; speedInd.classList.add("visible"); } },300); }
      function endHold(){ clearTimeout(ht); if (holding){ holding=false; swallow=true; video.playbackRate=1; speedInd.classList.remove("visible"); setTimeout(function(){ swallow=false; },50); } }
      card.addEventListener("mousedown",startHold);
      card.addEventListener("touchstart",startHold,{passive:true});
      card.addEventListener("mouseup",endHold);
      card.addEventListener("mouseleave",endHold);
      card.addEventListener("touchend",endHold);
      card.addEventListener("touchcancel",endHold);

      card.addEventListener("click",function(e){
        if (e.target.closest(".sif-mute-btn")||
            e.target.closest(".sif-popout-btn")||e.target.closest(".sif-progress")) return;
        // The play button has .preview-active during preview (clickable). A
        // click in its area should transition to real play, not be ignored —
        // so don't short-circuit when target is .sif-play-btn during preview.
        if (e.target.closest(".sif-play-btn") && previewState !== "previewing") return;
        if (swallow){ swallow=false; return; }
        // On mobile (any mode) AND in accordion desktop modes, tapping a
        // non-centre card brings it to the centre. Desktop ROW mode keeps
        // the existing behaviour (click toggles pause when the centre card
        // is playing). Skipped while popped — the engine is frozen.
        if ((isMobileLayout() || isAccordionDesktop()) && realIdx !== current && !popped){
          cardObj.previewPending = true;
          navigate(realIdx);
          return;
        }
        // Click during preview → transition to real play.
        if (previewState === "previewing"){
          transitionPreviewToPlay();
          return;
        }
        if (video.style.display==="block"){
          var pi=card.querySelector(".sif-pause-ind");
          if (video.paused){ video.play(); if (pi) pi.classList.remove("visible"); }
          else { video.pause(); if (pi) pi.classList.add("visible"); }
        }
      });

      track.appendChild(card);
      var cardObj = { el:card, video:video, poster:poster, reelIdx:reelIdx, realIdx:realIdx, endPreview:endPreview, schedulePostNavPreview:schedulePostNavPreview, previewPending:false, fadeOut:fadeOut };
      cards.push(cardObj);

    })(ri);
  }

  // Dots: one per REAL reel (not per effective card). With doubling,
  // effectiveReels has duplicates but the dot row stays at realCount.
  for (var di = 0; di < realCount; di++){
    (function(rIdx){
      var dot = document.createElement("button");
      dot.className = "sif-dot";
      dot.setAttribute("aria-label","Reel "+(rIdx+1));
      dot.addEventListener("click", function(){
        trackEvent("widget_navigate", { direction: "dot", from_reel: current, target_reel: rIdx });
        navigate(rIdx);
      });
      dotsEl.appendChild(dot);
      dots.push(dot);
    })(di);
  }


  // ════════════════════════════════════════════════════
  //  CAROUSEL ENGINE  (rebuilt — clean, infinite, smooth)
  //
  //  Each card has an integer `slot` (its position on an infinite line of
  //  card positions). A card is absolutely positioned at  left = slot*step.
  //  The track is translated by `T`; a card's on-screen x = T + slot*step.
  //
  //  The viewport shows 3 cards. A card is CENTRED when  T + slot*step = step
  //  → so to centre `centreSlot`,  T = (1 - centreSlot) * step.
  //
  //  Navigation just changes `centreSlot` by ±1 and animates `T` to the new
  //  value. `T` is monotonic — never reset, never snapped — so every slide
  //  is perfectly smooth in both directions.
  //
  //  Infinite wrap: only n cards exist, slots are unbounded. After a step,
  //  any card that fell outside the visible 3-window is recycled: its slot
  //  shifts by ±n, teleporting it to the far side. That happens while the
  //  card is OFF-SCREEN, so it's invisible. A recycled card is reset to its
  //  thumbnail so it scrolls back in clean.
  //
  //  Card DOM nodes never move (no appendChild) — so a playing <video> is
  //  never detached and never pauses. Only `left` and the track `transform`
  //  ever change. (Exception: the pop-out feature temporarily lifts ONE card
  //  into a fixed overlay; while that card is popped the whole carousel is
  //  frozen, and the card is restored to the track on pop-in.)
  // ════════════════════════════════════════════════════

  // Switch the track + cards to absolute positioning (overrides the flex CSS).
  track.style.position = "relative";
  track.style.display  = "block";
  track.style.height   = "100%";

  // One step = the centre-to-centre distance between adjacent cards.
  function getCardW(){
    return cards[0] ? cards[0].el.offsetWidth : 220;
  }
  function getGap(){
    var g = getComputedStyle(widget).getPropertyValue("--sif-gap");
    var v = parseFloat(g);
    return isNaN(v) ? 30 : v;
  }
  // On desktop: cards sit side by side -> step = cardW + gap.
  // On mobile: the active card is full size and the side cards are scaled
  // down (CSS scale) and tucked PARTLY UNDER it, so they only peek in. The
  // step must be SMALLER than cardW for that overlap look. We use a fraction
  // of the card width (tunable via --sif-step-frac, default .72).
  function getStep(){
    if (isMobileLayout()){
      var frac = parseFloat(
        getComputedStyle(widget).getPropertyValue("--sif-step-frac")
      );
      if (isNaN(frac)) frac = 0.72;
      return getCardW() * frac;
    }
    return getCardW() + getGap();
  }

  // Pixel offset that places a card's left edge so the card is centred
  // horizontally in the viewport — works for any viewport width.
  function centreOffset(){
    return (viewport.offsetWidth - getCardW()) / 2;
  }

  var centreSlot = 1;   // slot currently centred (start so cards[0] is centre)

  // Position one card according to its slot.
  // Desktop: absolute `left` on the track. Mobile: a per-card transform
  // relative to the centre (no transition — used for off-screen recycling).
  function placeCard(c){
    c.el.style.position = "absolute";
    c.el.style.top      = "0";
    if (isMobileLayout()){
      c.el.style.left       = "50%";
      c.el.style.marginLeft = (-getCardW()/2) + "px";
      c.el.style.transition = "none";
      c.el.style.transform  = mobileCardTransform(c.slot - centreSlot);
      c.el.offsetHeight;                       // force reflow so the jump is instant
    } else if (isAccordionDesktop()){
      c.el.style.left       = "50%";
      c.el.style.marginLeft = (-getCardW()/2) + "px";
      c.el.style.transition = "none";
      applyAccordionCard(c);
      c.el.offsetHeight;                       // force reflow so the jump is instant
    } else {
      c.el.style.left = (c.slot * getStep()) + "px";
    }
  }

  // Place every card.
  function placeAll(){
    cards.forEach(placeCard);
  }

  // Move the track so `centreSlot`'s card is centred in the viewport.
  // A card at slot s has left = s*step; on-screen x = T + s*step.
  // Slide animation duration in milliseconds.
  // Desktop: 460ms. Mobile: 520ms — matched to the reels carousel.
  function slideMs(){
    // Accordion modes use a slightly slower "rotation" feel (.52s, matching
    // ACCORDION_TRANS) so the post-slide recycle setTimeout fires AFTER
    // the slide ends, not during it.
    if (isAccordionDesktop()) return 520;
    return isMobileLayout() ? 520 : 460;
  }

  // Slide easing curve.
  // Desktop: cubic-bezier(.4,0,.2,1).
  // Mobile:  cubic-bezier(.4,0,.2,1) — matched to the reels carousel.
  function slideEasing(){
    return "cubic-bezier(.4,0,.2,1)";
  }

  // Centred means  T + centreSlot*step = centreOffset()
  //            ->  T = centreOffset() - centreSlot*step
  function setTrack(animated){
    if (isMobileLayout()){ applyMobileLayout(animated); return; }
    if (isAccordionDesktop()){ applyAccordionLayout(animated); return; }
    track.style.transition = animated
      ? ("transform " + (slideMs()/1000) + "s " + slideEasing())
      : "none";
    var T = centreOffset() - centreSlot * getStep();
    track.style.transform = "translateX(" + T + "px)";
    if (!animated) track.offsetHeight;        // force reflow
  }

  // ── Mobile movement model (ported from the reels carousel) ──────────
  // On mobile we do NOT move a track. Instead every card positions ITSELF
  // with one combined `transform: translateX() scale()`, relative to the
  // centre. When centreSlot changes, each card animates its own transform
  // from its old spot to its new spot — slide and scale locked together,
  // exactly like the reels carousel. Recycled (off-screen) cards jump with
  // no transition. Desktop still uses the track model above.
  function mobileCardTransform(rel){
    var step  = getStep();                       // centre-to-centre distance
    var x     = rel * step;                      // lateral offset from centre
    var scale = (rel === 0) ? 1 : 0.627;         // active full size, sides smaller
    return "translateX(" + x + "px) scale(" + scale + ")";
  }
  function applyMobileLayout(animated){
    // Clear any accordion-mode inline overrides (filter !important, opacity)
    // left over from desktop layout, so the mobile CSS applies cleanly when
    // an accordion-3 widget is viewed at mobile width (e.g. on rotation).
    cards.forEach(function(c){
      c.el.style.removeProperty("filter");
      c.el.style.opacity = "";
    });
    var trans = animated
      ? ("transform " + slideMs() + "ms " + slideEasing() +
         ",filter " + slideMs() + "ms " + slideEasing())
      : "none";
    // The track itself never moves on mobile.
    track.style.transition = "none";
    track.style.transform  = "translateX(0px)";

    // Pass 1: set position anchors + the transition on every card.
    cards.forEach(function(c){
      c.el.style.position   = "absolute";
      c.el.style.top        = "0";
      c.el.style.left       = "50%";             // anchor; transform does the rest
      c.el.style.marginLeft = (-getCardW()/2) + "px";
      c.el.style.transition = trans;
    });

    // Force a reflow so the transition change above is committed BEFORE we
    // change any transform. Without this, if the cards were previously in a
    // transition:none state (e.g. a resize/relayout fired while the user
    // scrolled the page), the browser batches the transition + transform
    // changes together and the slide snaps instantly instead of animating.
    if (cards.length) cards[0].el.offsetHeight;

    // Pass 2: now apply the transforms — these will animate.
    cards.forEach(function(c){
      c.el.style.transform = mobileCardTransform(c.slot - centreSlot);
      if (!animated) c.el.offsetHeight;          // force reflow on instant moves
    });

    // forceMobile lives inside a wider column, so the default ±24px arrow
    // CSS would put arrows at the column edges instead of next to the card.
    // Recompute arrow offset based on the centre card's width.
    if (forceMobile) applyAccordionArrowOffset();
  }

  // ── Accordion-3 desktop rendering (step 3b) ─────────────────────────
  // Activated when desktopStyle === "accordion-3". Reuses the V=3 band
  // (centre + two side cards visible at rest). Cards outside the visible
  // window are positioned at the off-stage "far" spot with opacity 0; when
  // they cycle into the visible window on a slide they translate + fade in,
  // matching the look of the reels widget's accordion.
  //
  // Values lifted from reels/widget.js layout():
  //   so = round(cardW * 0.68)   side translate distance
  //   ss = 0.69                  side card scale
  //   fs = 0.56                  off-stage card scale (the reels widget's
  //                              `.is-far` slot — used here as the off-screen
  //                              staging point)
  //   transition .52s cubic-bezier(.4,0,.2,1) on transform/opacity/filter/box-shadow
  //
  // Inline `!important` is required for transform/filter because the desktop
  // CSS rule `.sif-card{transform:scale(1)!important;filter:brightness(1)!important}`
  // would otherwise win over a plain inline style.
  // Accordion slide transition. Single string used by every animated card.
  //
  // Transform / scale / brightness / box-shadow run .52s with a snappy
  // ease-out — that's the "rotation around centre" pace, matched by
  // slideMs() returning 520 in accordion mode so the post-slide recycle
  // fires after the slide ends.
  //
  // Opacity is intentionally delayed: stays at 1 (or 0) for the first .26s,
  // then transitions over .26s. Why this is symmetric for both directions:
  //
  //   EXIT (visible → off-stage). The exiting card rotates inward from
  //     is-prev/is-far toward translateX(0). The arriving centre card
  //     (z=10) doesn't start covering the middle until t≈.16s, and fully
  //     covers the exit by t≈.27s. The delay keeps opacity at 1 during
  //     the entire visible inward rotation; the .26s fade then runs
  //     invisibly behind centre.
  //
  //   ENTRY (off-stage → visible). The entering card starts at translateX(0)
  //     (the off-stage spot — behind centre's path). In V=3 it has z=5,
  //     identical to the OLD centre's new z (is-prev), and the new centre's
  //     z=10 cover doesn't kick in until t≈.16s. Without the delay, the
  //     entering card's rising opacity would blend with the old centre at
  //     the middle (DOM order puts entering on top at equal z) — the user
  //     sees through the centre to the new card materialising behind it.
  //     With the delay, opacity is 0 until t=.26s; by then the new centre
  //     fully covers the middle, and the entry emerges from behind it on
  //     the right (or left, for a left-arrow click) over the remaining .26s.
  //
  // The base .sif-card CSS uses .35s and omits opacity, but placeCard's
  // accordion branch sets "none" inline on recycle and applyAccordionLayout
  // sets this string on every animated slide, so the base never leaks
  // through in accordion mode.
  var ACCORDION_TRANS =
    "transform .52s cubic-bezier(.4,0,.2,1)," +
    "opacity .26s cubic-bezier(.4,0,.2,1) .26s," +
    "filter .52s cubic-bezier(.4,0,.2,1)," +
    "box-shadow .52s cubic-bezier(.4,0,.2,1)";

  function isAccordionDesktop(){
    return !isMobileLayout() &&
           (desktopStyle === "accordion-3" || desktopStyle === "accordion-5");
  }
  function applyAccordionCard(c){
    var rel   = c.slot - centreSlot;
    var cardW = getCardW();
    var so    = Math.round(cardW * 0.68);
    var ss    = 0.69;
    var fs    = 0.56;
    var transform, filter, opacity, zIndex;
    var offStage = false;
    // V=3 (accordion-3): visible at rel 0, ±1; everything else is off-stage.
    // V=5 (accordion-5): visible at rel 0, ±1, ±2; |rel| >= 3 is off-stage.
    // Off-stage cards are slid FULLY past the viewport's overflow:hidden
    // edge, with scale + brightness matching the adjacent visible card —
    // so the exit/entry is a PURE TRANSLATE (no shrink, no dim, no fade).
    // An earlier design hid off-stage cards via opacity 0 at translateX(±so*1.55);
    // that fade-in-place caused a perceptible "flash" on the far edge during
    // a step. Opacity now stays at 1 for every accordion card; pointer events
    // on off-stage cards are blocked via data-offstage (decoupled from opacity).
    if (rel === 0){
      transform = "translateX(0px) scale(1)";
      filter    = "brightness(1)";
      opacity   = 1;
      zIndex    = 10;
    } else if (rel === -1 || rel === 1){
      transform = "translateX(" + (rel * so) + "px) scale(" + ss + ")";
      filter    = "brightness(.55)";
      opacity   = 1;
      zIndex    = 5;
    } else if (V === 5 && (rel === -2 || rel === 2)){
      // is-far (V=5 only): visible, dimmed, sitting at the far spot.
      var dFar = rel < 0 ? -1 : 1;
      transform = "translateX(" + (dFar * so * 1.55) + "px) scale(" + fs + ")";
      filter    = "brightness(.3)";
      opacity   = 1;
      zIndex    = 2;
    } else {
      // Off-stage. Animates INWARD toward translateX(0), shrinks small,
      // dims, and fades quickly — reads as the card rotating "around the
      // back" of the centre (carousel mental model). The opacity transition
      // is .15s while transform/scale/brightness slide over the full .52s,
      // so the card visibly moves a bit then is hidden, rather than
      // dissolving over the whole slide. z-index is low so the off-stage
      // card is fully behind the centre (z=10) and side cards (z=5).
      // Entry from off-stage is the reverse: card emerges from behind the
      // centre, becomes opaque early, then rotates outward to is-next /
      // is-far over the rest of the .52s.
      offStage = true;
      transform = "translateX(0px) scale(0.3)";
      filter    = "brightness(.1)";
      opacity   = 0;
      zIndex    = Math.max(1, 4 - Math.abs(rel));
    }
    c.el.style.setProperty("transform", transform, "important");
    c.el.style.setProperty("filter",    filter,    "important");
    c.el.style.opacity    = opacity;
    c.el.style.zIndex     = zIndex;
    c.el.dataset.offstage = offStage ? "1" : "0";
  }
  function applyAccordionLayout(animated){
    // The track itself never moves in accordion mode — each card animates
    // its own transform (same model as applyMobileLayout above).
    track.style.transition = "none";
    track.style.transform  = "translateX(0px)";

    // Pass 1: anchor + transition. All cards use ACCORDION_TRANS (single
    // delayed-opacity transition — see the comment above its declaration
    // for why exit AND entry both need the delay).
    var trans = animated ? ACCORDION_TRANS : "none";
    cards.forEach(function(c){
      c.el.style.position   = "absolute";
      c.el.style.top        = "0";
      c.el.style.left       = "50%";
      c.el.style.marginLeft = (-getCardW()/2) + "px";
      c.el.style.transition = trans;
    });

    // Force the transition change to commit before applying transforms,
    // for the same reason applyMobileLayout does it.
    if (cards.length) cards[0].el.offsetHeight;

    // Pass 2: per-card transforms.
    cards.forEach(function(c){
      applyAccordionCard(c);
      if (!animated) c.el.offsetHeight;
    });

    // Place the navigation arrows just outside the visible fan. Recomputed
    // every layout pass (init + step + resize) since the fan width depends
    // on cardW, which changes with viewport.
    applyAccordionArrowOffset();
  }

  // Position the navigation arrows just outside the visible accordion fan,
  // plus a small gap. Ported from reels/widget.js layout(). The fan edge is
  // the outer edge of whichever visible card is widest (is-prev/is-next for
  // V=3; is-far for V=5, since it sits further out than the side cards). A
  // clamp prevents the arrow from escaping a narrow wrapper.
  function applyAccordionArrowOffset(){
    var accordion = isAccordionDesktop();
    if (!accordion && !forceMobile) return;
    var cardW = getCardW();
    var fanEdge;
    if (accordion){
      var so    = Math.round(cardW * 0.68);
      var ss    = 0.69;
      var fs    = 0.56;
      fanEdge = so + (cardW * ss) / 2;               // is-prev / is-next outer edge
      if (V === 5){
        var farEdge = (so * 1.55) + (cardW * fs) / 2;
        if (farEdge > fanEdge) fanEdge = farEdge;
      }
    } else {
      // forceMobile: centre card is full-size, peeks are scaled down and tuck
      // behind it. Anchor the arrows just outside the centre card's edge.
      fanEdge = cardW / 2;
    }
    var ARROW_W = 40, GAP = 15, EDGE_MARGIN = 4;
    var arrowOffset = fanEdge + GAP + ARROW_W;
    // Clamp to the wrapper's half-width so the arrow's outer edge can never
    // sit closer than EDGE_MARGIN to the container edge — otherwise in a
    // narrow column (e.g. a Simpleview sidebar) the calc would go negative
    // and fling the arrow OUTSIDE the container.
    var wrapper = prevBtn.parentElement;
    var wrapW = wrapper ? wrapper.offsetWidth : 0;
    if (wrapW > 0){
      var maxOffset = wrapW / 2 - EDGE_MARGIN;
      if (arrowOffset > maxOffset) arrowOffset = maxOffset;
    }
    widget.style.setProperty("--sif-arrow-offset", arrowOffset + "px");
  }

  // Reel index of the card occupying `centreSlot`.
  function centreReel(){
    for (var i=0;i<n;i++) if (cards[i].slot === centreSlot) return cards[i].realIdx;
    return current;
  }

  function updateUI(){
    current = centreReel();
    // Desktop row mode: sync each card's scale transition to the slide.
    // Mobile is handled entirely by applyMobileLayout. Accordion mode is
    // handled by applyAccordionLayout, which owns its own per-card
    // transition AND its own z-index stacking — so this block must skip
    // both for accordion.
    var desktop   = !isMobileLayout();
    var accordion = isAccordionDesktop();
    var cardTrans = "filter " + slideMs() + "ms " + slideEasing() +
                    ",box-shadow " + slideMs() + "ms " + slideEasing() +
                    ",transform " + slideMs() + "ms " + slideEasing();
    cards.forEach(function(c){
      var active = (c.slot === centreSlot);
      if (desktop && !accordion) c.el.style.transition = cardTrans;
      c.el.classList.toggle("is-active", active);
      if (!accordion){
        // The active card must sit ON TOP of the side cards it overlaps.
        // Cards nearer the centre stack above ones further away.
        c.el.style.zIndex = active ? 3 : (Math.abs(c.slot - centreSlot) === 1 ? 2 : 1);
      }
    });
    dots.forEach(function(d,i){ d.classList.toggle("is-active", i===current); });
    // a11y: only the centre card's interactive elements stay in the tab
    // order. Off-centre cards (visible on row mode, faded on accordion)
    // get tabindex="-1" on IG link / mute / pop-out / scrub bar so a Tab
    // user goes ARROWS → centre card's controls → DOTS, instead of having
    // to tab through every card's controls in sequence. The popped-card
    // path (openPopout) overrides this for whichever card is popped.
    cards.forEach(function(c){
      var isCentre = (c.slot === centreSlot);
      var skippable = c.el.querySelectorAll(".sif-top-bar a, .sif-mute-btn, .sif-popout-btn");
      skippable.forEach(function(el){
        if (isCentre) el.removeAttribute("tabindex");
        else el.setAttribute("tabindex", "-1");
      });
      var pg = c.el.querySelector(".sif-progress");
      if (pg) pg.setAttribute("tabindex", isCentre ? "0" : "-1");
    });
    // a11y: announce reel change via the live region. updateUI fires on
    // every step (arrow / dot / swipe / keyboard nav) AND on initial layout.
    // Setting the live region during initial render doesn't cause an
    // announcement (SRs only fire on changes after page-load settles).
    var liveEl = widget.querySelector(".sif-live");
    if (liveEl){
      var centreCard = null;
      for (var i = 0; i < cards.length; i++){
        if (cards[i].slot === centreSlot){ centreCard = cards[i]; break; }
      }
      if (centreCard){
        var lbl = (effectiveReels[centreCard.reelIdx] && effectiveReels[centreCard.reelIdx].label) || "";
        liveEl.textContent = "Reel " + (current + 1) + " of " + realCount + (lbl ? ": " + lbl : "");
      }
    }
  }

  function resetCard(c){
    if (c.endPreview) c.endPreview();   // cancel any active hover preview
    c.video.pause(); c.video.currentTime=0; c.video.playbackRate=1; c.video.volume=1;
    c._playFired = false; c._progressFired = false;  // reset GA flags for next play
    if (c.fadeOut) c.fadeOut(); else { c.video.style.display="none"; }
    c.el.classList.remove("sif-playing");
    var pf=c.el.querySelector(".sif-progress-fill"),pt=c.el.querySelector(".sif-progress-thumb");
    if (pf) pf.style.width="0%"; if (pt) pt.style.left="0%";
    c.el.querySelector(".sif-play-btn").classList.remove("hidden");
    c.el.querySelector(".sif-mute-btn").classList.remove("visible");
    var pob=c.el.querySelector(".sif-popout-btn"); if (pob) pob.classList.remove("visible");
    var pi=c.el.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
    var rg=c.el.querySelector(".sif-timer-ring"); if (rg) rg.style.strokeDashoffset=0;
    var tx=c.el.querySelector(".sif-timer-text"); if (tx&&c.video.duration) tx.textContent=fmtTime(c.video.duration);
    var tc=c.el.querySelector(".sif-time-counter"); if (tc) tc.textContent="0:00 / "+(c.video.duration?fmtTime(c.video.duration):"0:00");
    var pb=c.el.querySelector(".sif-progress"); if (pb) pb.classList.remove("show");
  }

  function pauseCardOnFrame(c){
    if (c.video.style.display==="block" && !c.video.paused){
      c.video.pause();
      var pi=c.el.querySelector(".sif-pause-ind"); if (pi) pi.classList.add("visible");
    }
  }

  // ── Pop-out ─────────────────────────────────────────
  // Desktop-only. Lifts ONE card out of the track into the fixed pop-out
  // overlay and animates it from its measured rect up to POPOUT_SCALE,
  // centred over its ORIGINAL spot, clamped to the viewport. The video is
  // never reloaded — only the card's position/scale change — so playback
  // continues seamlessly. While a card is popped the whole carousel is
  // frozen (navigate()/step() and all input handlers bail on `popped`).
  // On pop-in the card is returned to the track with its slot untouched, so
  // the carousel-engine invariant holds.
  function popoutIcons(cardEl, showPopin){
    var out = cardEl.querySelector(".sif-popout-icon");
    var inn = cardEl.querySelector(".sif-popin-icon");
    if (out) out.style.display = showPopin ? "none" : "block";
    if (inn) inn.style.display = showPopin ? "block" : "none";
    // a11y: keep the button's aria-label in sync with what it now does.
    var btn = cardEl.querySelector(".sif-popout-btn");
    if (btn) btn.setAttribute("aria-label", showPopin ? "Close pop-out" : "Pop out video");
  }

  function openPopout(c){
    if (popped || popBusy || busy || !isDesktopLayout()) return;
    popBusy = true;
    popped  = true;
    poppedCard = c;
    var el = c.el;
    trackEvent("video_popout", reelParams(c.reelIdx));

    // Measure the card's current on-screen rect BEFORE moving it.
    var r = el.getBoundingClientRect();
    var w = r.width, h = r.height;
    var tw = w * POPOUT_SCALE, th = h * POPOUT_SCALE;

    // Desired top-left so the popped card is centred over its ORIGINAL centre.
    var cx = r.left + w / 2, cy = r.top + h / 2;
    var tx = cx - tw / 2, ty = cy - th / 2;

    // Clamp so the popped card stays fully on screen (small margin).
    var m = 16;
    tx = Math.max(m, Math.min(tx, window.innerWidth  - tw - m));
    ty = Math.max(m, Math.min(ty, window.innerHeight - th - m));

    // Remember exactly how to put the card back on the track afterwards.
    c._restore = {
      left:       el.style.left,
      top:        el.style.top,
      zIndex:     el.style.zIndex,
      transition: el.style.transition,
      transform:  el.style.transform
    };

    // Lift the card into the overlay, fixed at its CURRENT rect — visually
    // identical to where it just was, so there is no jump. (Desktop cards
    // are absolutely positioned on the track, so removing one doesn't
    // disturb the others' layout.)
    el.classList.add("sif-popped");
    el.style.transition = "none";
    el.style.left   = r.left + "px";
    el.style.top    = r.top  + "px";
    el.style.width  = w + "px";
    el.style.height = h + "px";
    el.style.transformOrigin = "top left";
    // The desktop CSS has `.sif-card{transform:scale(1)!important}`, which a
    // plain inline transform can't override — so the pop transform is set
    // with !important via setProperty, which DOES beat a stylesheet !important.
    el.style.setProperty("transform", "translate(0px,0px) scale(1)", "important");
    // Override accordion-mode dimming for the popped card. In row mode these
    // are redundant (the desktop CSS already gives brightness 1); in accordion
    // mode they undo the brightness(.55) / brightness(.3) !important values
    // that applyAccordionCard sets on is-prev/is-next/is-far cards, so the
    // popped card reads bright. closePopout's cleanup clears these and
    // placeCard reapplies the accordion value on restore. data-offstage is
    // forced to "0" so the offstage pointer-events rule can't accidentally
    // block clicks on a popped card.
    el.style.setProperty("filter", "brightness(1)", "important");
    el.style.opacity      = "1";
    el.dataset.offstage   = "0";
    overlay.appendChild(el);
    el.offsetHeight;                         // force reflow so the next change animates

    // Animate: fade the backdrop in, grow + move the card to the target.
    overlay.classList.add("open");
    el.classList.add("sif-popped--open");
    el.style.transition = "";                // re-enable the CSS transition
    el.style.setProperty("transform",
      "translate(" + (tx - r.left) + "px," + (ty - r.top) + "px) scale(" + POPOUT_SCALE + ")",
      "important");

    document.body.style.overflow = "hidden"; // lock page scroll while popped
    popoutIcons(el, true);
    setTimeout(function(){ popBusy = false; }, 360);
    // a11y: restore tabindex on the popped card's interactive elements
    // (updateUI may have set them to "-1" if this was an off-centre card)
    // so the focus trap can find them.
    el.querySelectorAll(".sif-top-bar a, .sif-mute-btn, .sif-popout-btn").forEach(function(b){
      b.removeAttribute("tabindex");
    });
    var prog = el.querySelector(".sif-progress");
    if (prog) prog.setAttribute("tabindex", "0");
    // a11y: move keyboard focus to the pop-out button (which now acts as
    // close) so the user has a clear path out. Animations need a moment
    // to settle; preventScroll keeps the page from jumping.
    setTimeout(function(){
      var btn = el.querySelector(".sif-popout-btn");
      if (btn) {
        try { btn.focus({ preventScroll: true }); }
        catch(err) { btn.focus(); }
      }
    }, 380);
  }

  function closePopout(){
    if (!popped || popBusy || !poppedCard) return;
    popBusy = true;
    var c  = poppedCard;
    var el = c.el;

    // Animate the card back to its original on-screen position.
    el.style.setProperty("transform", "translate(0px,0px) scale(1)", "important");
    overlay.classList.remove("open");
    el.classList.remove("sif-popped--open");
    document.body.style.overflow = "";

    setTimeout(function(){
      // Return the card to the track and restore its exact pre-pop styles.
      el.classList.remove("sif-popped");
      el.style.transformOrigin = "";
      el.style.width  = "";
      el.style.height = "";
      // Clear the !important pop transform fully (a plain ="" doesn't always
      // clear an !important inline value), then restore engine-owned styles.
      el.style.removeProperty("transform");
      // Drop the pop-out's brightness(1) / opacity overrides. placeCard below
      // reapplies the accordion value via applyAccordionCard; in row mode the
      // desktop CSS provides brightness 1 once the inline value is cleared.
      el.style.removeProperty("filter");
      el.style.opacity = "";
      var rs = c._restore || {};
      el.style.left       = rs.left       || "";
      el.style.top        = rs.top        || "";
      el.style.zIndex     = rs.zIndex     || "";
      el.style.transition = rs.transition || "";
      if (rs.transform) el.style.transform = rs.transform;
      track.appendChild(el);
      c._restore = null;
      poppedCard = null;
      popped  = false;
      popBusy = false;
      popoutIcons(el, false);
      // Re-assert the engine's layout in case anything drifted.
      placeCard(c);
      updateUI();
      // a11y: return focus to the pop-out button on the now-on-track card,
      // so the keyboard user lands back where they triggered the pop-out
      // (the button is still visible since the video is still playing).
      var btn = el.querySelector(".sif-popout-btn");
      if (btn) {
        try { btn.focus({ preventScroll: true }); }
        catch(err) { btn.focus(); }
      }
    }, 360);
  }

  function togglePopout(c){
    if (popped){
      // Only the popped card's own button (or the backdrop/Escape) closes it.
      if (poppedCard === c) closePopout();
    } else {
      openPopout(c);
    }
  }

  // ── Initial layout ───────────────────────────────────
  // Band invariant: cards always occupy the n consecutive slots
  //   [centreSlot + bandLeftOffset .. centreSlot + bandLeftOffset + n - 1].
  // V=3 (row, accordion-3): band [centre-2..centre+n-3]; visible window
  //   [centre-1..centre+1].
  // V=5 (accordion-5):       band [centre-3..centre+n-4]; visible window
  //   [centre-2..centre+2].
  // The band is shifted (V+1)/2 slots LEFT of symmetric, so a card is always
  // staged just off the visible left edge. RIGHT steps recycle the staged-
  // left card to off the right edge BEFORE animating; LEFT steps recycle
  // the off-right card AFTER the slide. The recycle moves are invisible at
  // both ends.
  // Init: reel 0 starts centred (slot 0); the last (V+1)/2 reels wrap into
  // the negative band slots so scrolling left loops cleanly. See the plan
  // doc's V=5 derivation traces for n=7 and n=10.
  (function initEngine(){
    centreSlot = 0;
    // Number of negative slots to fill = -bandLeftOffset = (V+1)/2.
    // V=3 -> 2 (the last 2 reels wrap to slots -2, -1).
    // V=5 -> 3 (the last 3 reels wrap to slots -3, -2, -1).
    var negSlots = -bandLeftOffset;
    for (var i=0;i<n;i++){
      if (i <= n - 1 - negSlots) cards[i].slot = i;        // 0 .. n-1-negSlots
      else                       cards[i].slot = i - n;    // -negSlots .. -1
    }
    placeAll();
    setTrack(false);
    updateUI();
    // GA4: widget_impression — fires once per widget instance after init.
    trackEvent("widget_impression", { reel_count: realCount, desktop_style: desktopStyle });
  })();

  // ── Navigate ─────────────────────────────────────────
  function navigate(targetIdx){
    if (busy || popped) return;          // frozen while a card is popped out
    targetIdx = mod(targetIdx, realCount);
    if (targetIdx === current) return;
    var delta = targetIdx - current;
    if (delta >  realCount/2) delta -= realCount;
    if (delta < -realCount/2) delta += realCount;
    step(delta > 0 ? 1 : -1, targetIdx);
  }

  function step(dir, finalTargetIdx){
    if (busy || popped) return;          // frozen while a card is popped out
    busy = true;

    var newCentre = centreSlot + dir;
    // Occupied band AFTER this step. V=3 -> [newCentre-2 .. newCentre+n-3];
    // V=5 -> [newCentre-3 .. newCentre+n-4]. Always exactly n slots wide.
    var newBandLo = newCentre + bandLeftOffset;
    var newBandHi = newBandLo + n - 1;

    if (dir === 1){
      // RIGHT step. The incoming card must enter from just off the right edge
      // (slot centreSlot+2). The card staged off the LEFT edge (slot
      // centreSlot-2) is idle and off-screen — recycle it +n to the right
      // BEFORE animating. At the current track position centreSlot+2 is off
      // the right edge, so this move is invisible; the card then slides in
      // smoothly as the track animates.
      cards.forEach(function(c){
        if (c.slot < newBandLo || c.slot > newBandHi){
          c.slot += n;
          placeCard(c);
          resetCard(c);
        }
      });
      centreSlot = newCentre;
      setTrack(true);
      updateUI();

      setTimeout(function(){ finishStep(finalTargetIdx); }, slideMs() + 20);

    } else {
      // LEFT step. The incoming card is already staged at slot centreSlot-2
      // (the new left slot) — it slides in smoothly with no pre-work.
      centreSlot = newCentre;
      setTrack(true);
      updateUI();

      // The outgoing card (now off the RIGHT edge) is recycled to the left
      // AFTER the slide, while it is safely off-screen.
      setTimeout(function(){
        cards.forEach(function(c){
          if (c.slot < newBandLo || c.slot > newBandHi){
            c.slot += -n;
            placeCard(c);
            resetCard(c);
          }
        });
        finishStep(finalTargetIdx);
      }, slideMs() + 20);
    }
  }

  // True on touch/mobile layouts (matches the mobile CSS media queries).
  // Also true when cfg.forceMobile is set — used by the builder's
  // side-text layouts so the carousel renders single-focus on desktop.
  function isMobileLayout(){
    if (forceMobile) return true;
    return window.matchMedia(
      "(max-width:767px), (min-width:768px) and (pointer:coarse) and (hover:none)"
    ).matches;
  }

  function finishStep(finalTargetIdx){
    // Stop videos that should no longer be playing.
    //  • Mobile: only the CENTRED card may play. Any card that has left the
    //    centre slot is reset (video + audio stop) — so audio stops after a
    //    single swipe.
    //  • Desktop ACCORDION (3 / 5 visible): treated like mobile. Side and
    //    is-far cards are scaled down and dimmed, so a video playing in
    //    one of those slots reads as abandoned background audio — kill it
    //    on the slide.
    //  • Desktop ROW: a card may keep playing in a side slot; it is reset
    //    only once it is fully off-screen (outside [centreSlot-1
    //    .. centreSlot+1]). Side cards in row mode are full-brightness and
    //    equal-size, so background playback there is fine.
    var mobile    = isMobileLayout();
    var accordion = isAccordionDesktop();
    var halfVis   = (V - 1) / 2;
    cards.forEach(function(c){
      var shouldStop = (mobile || accordion)
        ? (c.slot !== centreSlot)
        : (Math.abs(c.slot - centreSlot) > halfVis);
      if (shouldStop && (!c.video.paused || c.video.style.display === "block")){
        resetCard(c);
      }
    });

    busy = false;
    // Continue stepping toward a multi-step dot target.
    if (typeof finalTargetIdx === "number" && current !== finalTargetIdx){
      var d2 = finalTargetIdx - current;
      if (d2 >  realCount/2) d2 -= realCount;
      if (d2 < -realCount/2) d2 += realCount;
      setTimeout(function(){ step(d2 > 0 ? 1 : -1, finalTargetIdx); }, 30);
    } else {
      // Navigation is fully complete (we're at the final target). Process the
      // per-card click-to-centre intent: any card with previewPending that
      // landed at centre gets a FRESH 1s timer, then preview starts. Cards
      // that were marked pending but didn't end up centred (rare, multi-step
      // edge cases) have the flag cleared.
      cards.forEach(function(c){
        if (!c.previewPending) return;
        if (c.slot === centreSlot && c.schedulePostNavPreview) {
          c.schedulePostNavPreview();
        }
        c.previewPending = false;
      });
      // Auto-advance landing: a reel just ended and we slid one over.
      // Click play on the card that holds the target reel (realIdx =
      // ended.realIdx + 1). For centre-ended that card lands at the new
      // centre; for right-ended it lands at the new right. Pick ONE
      // matching card (accordion doubling means multiple cards can share a
      // realIdx — preferring the centre, falling back to the closest slot
      // to centre, so the play stays on a visible card).
      if (pendingAutoAdvanceTarget !== null) {
        var target = pendingAutoAdvanceTarget;
        pendingAutoAdvanceTarget = null;
        var pick = null, pickDist = Infinity;
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].realIdx === target) {
            var d = Math.abs(cards[i].slot - centreSlot);
            if (d < pickDist) { pick = cards[i]; pickDist = d; }
          }
        }
        if (pick) {
          var pb = pick.el.querySelector(".sif-play-btn");
          if (pb) pb.click();
        }
      }
    }
  }

  // Reposition everything on resize.
  function relayout(){
    placeAll();
    setTrack(false);
  }

  // ── Controls ─────────────────────────────────────────
  prevBtn.addEventListener("click",function(){
    trackEvent("widget_navigate", { direction: "prev", from_reel: current });
    navigate(mod(current-1,realCount));
  });
  nextBtn.addEventListener("click",function(){
    trackEvent("widget_navigate", { direction: "next", from_reel: current });
    navigate(mod(current+1,realCount));
  });

  var txStart=0,txStartY=0;
  viewport.addEventListener("touchstart",function(e){ txStart=e.touches[0].clientX; txStartY=e.touches[0].clientY; },{passive:true});
  viewport.addEventListener("touchend",function(e){
    // Ignore the touch entirely if the user was scrubbing a progress bar,
    // or if a card is popped out (the carousel is frozen).
    if (scrubbing || popped || window._sifSE) return;
    var dx=e.changedTouches[0].clientX-txStart,dy=Math.abs(e.changedTouches[0].clientY-txStartY);
    // Require a clear, mostly-horizontal swipe (threshold raised so a small
    // drift while tapping/scrubbing doesn't trigger navigation).
    if (Math.abs(dx)>42 && Math.abs(dx)>dy*1.4) navigate(mod(current+(dx<0?1:-1),realCount));
  },{passive:true});

  var msStart=null,msDrag=false;
  viewport.addEventListener("mousedown",function(e){ if (popped||e.target.closest(".sif-arrow")||e.target.closest(".sif-progress")) return; msStart=e.clientX; msDrag=false; });
  viewport.addEventListener("mousemove",function(e){ if (msStart===null) return; if (Math.abs(e.clientX-msStart)>8) msDrag=true; });
  viewport.addEventListener("mouseup",function(e){
    if (msStart===null) return;
    var dx=e.clientX-msStart; msStart=null;
    if (msDrag&&Math.abs(dx)>50) navigate(mod(current+(dx<0?1:-1),realCount));
    msDrag=false;
  });
  viewport.addEventListener("mouseleave",function(){ msStart=null; msDrag=false; });

  document.addEventListener("keydown",function(e){
    // Escape closes a popped-out card.
    if (e.key==="Escape" && popped){ closePopout(); return; }
    // Arrow keys navigate — but only when the pointer is over THIS carousel
    // (so multiple carousels don't all move at once) and nothing is popped.
    if (popped) return;
    if (!widget.matches(":hover")) return;
    if (e.key==="ArrowLeft") navigate(mod(current-1,realCount));
    if (e.key==="ArrowRight") navigate(mod(current+1,realCount));
  });

  // Click the dim backdrop (outside the card) to close the pop-out.
  overlay.addEventListener("click",function(e){
    if (e.target === overlay) closePopout();
  });

  // a11y: focus trap while popped. Tab / Shift+Tab cycles through the
  // popped card's interactive controls (IG link, mute, pop-out, scrub)
  // instead of escaping to the page behind the overlay.
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

  // Resize handling. On mobile, scrolling the page makes the browser's URL
  // bar show/hide, which fires `resize` with only a HEIGHT change. The
  // carousel layout only depends on width, so we ignore height-only resizes
  // — this avoids needless relayouts (and the snap bug they used to cause)
  // while the user scrolls.
  var lastW = window.innerWidth;
  window.addEventListener("resize",function(){
    // If a card is popped when the viewport changes, close it — re-clamping
    // a live pop animation is fiddly and resizing while popped is rare.
    if (popped && !popBusy){ closePopout(); return; }
    if (window.innerWidth === lastW) return;   // height-only change — ignore
    lastW = window.innerWidth;
    relayout();
  });

  } // end initWidget

  // ── Multi-instance bootstrap ─────────────────────────
  // Process every queued config. Each embed does:
  //   (window.SPLSHY_INFINITE_QUEUE = window.SPLSHY_INFINITE_QUEUE || []).push(cfg)
  // We replace the queue's push with one that initialises immediately, so
  // configs added before OR after this script loads are all handled.
  function processQueue(){
    var q = window.SPLSHY_INFINITE_QUEUE;
    if (q && q.length){
      // Drain any configs queued before the script loaded.
      while (q.length){ initWidget(q.shift()); }
    }
    // Replace the array with a live object whose push() inits on the spot,
    // so embeds appearing later on the page still work.
    window.SPLSHY_INFINITE_QUEUE = {
      push: function(cfg){ initWidget(cfg); }
    };
  }

  // Backward compatibility: honour a single legacy global config.
  if (window.SPLSHY_INFINITE && window.SPLSHY_INFINITE.reels){
    initWidget(window.SPLSHY_INFINITE);
  }

  processQueue();

  // ── Global Space-to-toggle ───────────────────────────────
  // Document-level Space handler, made idempotent via window.SPLSHY_SPACE_HOOKED
  // so multiple widget scripts on the same page register exactly one listener
  // (not one per widget — that would multi-toggle and cancel out). Matches
  // the YouTube / native-HTML5 expectation: Space pauses/resumes the currently
  // VISIBLE video (the one with display:block set by the widget on play).
  // Skips when typing in an input/textarea/contentEditable, and does nothing
  // when no video is visible — so Space falls through to default page-scroll
  // when there's nothing to toggle (e.g. after an accordion slide on a card
  // that hasn't been played yet). Mirrors the card-click handler's pause-
  // indicator toggle so the visual state stays consistent.
  // M = toggle mute on the currently-active video (YouTube convention).
  // Idempotent across widget scripts via window.SPLSHY_MUTE_HOOKED. Same
  // target-finding strategy as the Space handler. Dispatches a click on
  // the widget's own mute button so all the existing state-sync (icon,
  // aria-label, aria-pressed, global mute) runs as if the user clicked.
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
