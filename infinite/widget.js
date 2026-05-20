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

  // ── CSS ─────────────────────────────────────────────
  if (!document.querySelector("style[data-splshy-infinite]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-infinite", "1");
    style.textContent = [
      ".sif-widget{--sif-accent:#D30011;--sif-card-w:220px;--sif-card-h:390px;--sif-gap:30px;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;width:100%;user-select:none;padding:29px 0}",
      ".sif-widget button{outline:none!important;-webkit-tap-highlight-color:transparent}",
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
      "@media(max-width:767px){.sif-card{filter:brightness(.5)}.sif-card.is-active{filter:brightness(1)!important}.sif-widget{--sif-card-h:65vh;--sif-card-w:calc(65vh*9/16);--sif-gap:9px;--sif-step-frac:0.72}.sif-viewport{width:100%}}",
      "@media(min-width:768px) and (pointer:coarse) and (hover:none){.sif-card{filter:brightness(.5)}.sif-card.is-active{filter:brightness(1)!important}.sif-widget{--sif-card-h:65vh;--sif-card-w:calc(65vh*9/16);--sif-gap:9px;--sif-step-frac:0.72}.sif-viewport{width:100%}}",
      /* Desktop */
      "@media(min-width:768px) and (any-pointer:fine){.sif-card{transform:scale(1)!important;filter:brightness(1)!important}.sif-widget{--sif-card-w:min(320px,calc(65vh*9/16));--sif-card-h:min(568px,65vh);--sif-gap:45px}}",
      /* Poster */
      ".sif-poster{position:absolute;inset:0;border-radius:20px;overflow:hidden}",
      ".sif-poster-ph{position:absolute;inset:0;background:linear-gradient(160deg,#2a2a2a 0%,#111 100%)}",
      ".sif-poster-ph[data-idx='0']{background:linear-gradient(160deg,#1d3a2f 0%,#0d1f1a 100%)}",
      ".sif-poster-ph[data-idx='1']{background:linear-gradient(160deg,#2e1f3a 0%,#160d1f 100%)}",
      ".sif-poster-ph[data-idx='2']{background:linear-gradient(160deg,#3a2010 0%,#1f0f05 100%)}",
      ".sif-poster-ph[data-idx='3']{background:linear-gradient(160deg,#10243a 0%,#05121f 100%)}",
      ".sif-poster-ph[data-idx='4']{background:linear-gradient(160deg,#1a3020 0%,#0a1810 100%)}",
      ".sif-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px}",
      ".sif-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px;display:none;background:#000;pointer-events:none;-webkit-touch-callout:none}",
      ".sif-top-bar{position:absolute;top:0;left:0;right:0;padding:22px 20px 40px;background:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      ".sif-top-bar a{pointer-events:auto}",
      ".sif-logo{width:52px;height:52px;border-radius:50%;border:2px solid var(--sif-logo-ring,var(--sif-accent));overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center}",
      ".sif-logo.sif-logo--grad{box-sizing:border-box;width:60.5px;height:60.5px;border:none;background:transparent;position:relative;overflow:visible}",
      ".sif-logo.sif-logo--grad::before{content:'';position:absolute;inset:0;border-radius:50%;background:var(--sif-ring-grad);-webkit-mask:radial-gradient(circle, transparent 0 28.25px, #000 28.25px);mask:radial-gradient(circle, transparent 0 28.25px, #000 28.25px)}",
      ".sif-logo.sif-logo--grad .sif-logo-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;z-index:1}",
      ".sif-logo img{width:100%;height:100%;object-fit:cover}",
      ".sif-timer{position:relative;width:52px;height:52px;flex-shrink:0}",
      ".sif-timer svg{width:52px;height:52px;transform:rotate(-90deg)}",
      ".sif-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".sif-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".sif-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}",
      ".sif-bottom-bar{position:absolute;bottom:0;left:0;right:0;padding:40px 16px 26px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".sif-title{color:#fff;font-size:16.5px;font-weight:600;line-height:1.35;letter-spacing:.01em;text-shadow:0 1px 4px rgba(0,0,0,.4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-left:4px;margin-right:20px}",
      ".sif-play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;cursor:pointer;transition:opacity .2s}",
      ".sif-play-btn.hidden{opacity:0;pointer-events:none}",
      ".sif-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".sif-pause-ind.visible{opacity:1}",
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
      ".sif-progress:hover .sif-progress-thumb,.sif-progress.show .sif-progress-thumb{opacity:1;bottom:-2px}",
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
      ".sif-arrow:focus,.sif-arrow:focus-visible{outline:none}",
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
      "@media(min-width:600px){.sif-arrow{display:flex!important}}",
      ".sif-dots{display:flex;justify-content:center;gap:8.5px;margin-top:18px}",
      ".sif-dot{width:8.5px!important;height:8.5px!important;min-width:8.5px!important;min-height:8.5px!important;border-radius:50%!important;background:#ccc;border:none!important;cursor:pointer;padding:0!important;transition:background .25s,transform .25s}",
      ".sif-dot.is-active{background:var(--sif-accent);transform:scale(1.35)}",
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
    ].join("");
    document.head.appendChild(style);
  }

  // ── Container ───────────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) { console.warn("Splshy Infinite: no element '" + containerId + "'"); return; }

  container.innerHTML =
    '<div class="sif-widget">' +
      '<div class="sif-outer">' +
        '<button class="sif-arrow sif-arrow--left" style="outline:none;padding:0!important;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block;flex-shrink:0;"><polyline points="10,2 2,10 10,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
        '</button>' +
        '<div class="sif-viewport"><div class="sif-track"></div></div>' +
        '<button class="sif-arrow sif-arrow--right" style="outline:none;padding:0!important;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block;flex-shrink:0;"><polyline points="2,2 10,10 2,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sif-dots"></div>' +
    '</div>';

  var widget   = container.querySelector(".sif-widget");
  if (desktopStyle === "accordion-3" || desktopStyle === "accordion-5") widget.classList.add("sif-accordion");
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
      if (reel.posterUrl) video.setAttribute("poster",reel.posterUrl);
      card.appendChild(video);

      var resolvedLogo = reel.logoUrl||logoUrl||"";
      var logoContent = resolvedLogo
        ? '<img src="'+resolvedLogo+'" alt="logo">'
        : '<div style="width:100%;height:100%;background:#D30011;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">S</div>';
      // Gradient ring wraps the logo in an inner circle (the masked ::before
      // draws the ring); a solid ring uses the .sif-logo border directly.
      var logoHTML = ringIsGradient
        ? '<div class="sif-logo sif-logo--grad"><div class="sif-logo-inner">'+logoContent+'</div></div>'
        : '<div class="sif-logo">'+logoContent+'</div>';
      var RC = (2*Math.PI*23).toFixed(2);

      card.insertAdjacentHTML("beforeend",
        '<div class="sif-top-bar">'+
          '<a href="'+igUrl+'" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">'+
            logoHTML+
            '<div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:400;letter-spacing:0.03em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">'+followerCount+'</div>'+
          '</a>'+
          '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">'+
            '<div class="sif-timer"><svg viewBox="0 0 52 52"><circle class="sif-timer-bg" cx="26" cy="26" r="23"/><circle class="sif-timer-ring" cx="26" cy="26" r="23" stroke-dasharray="'+RC+'" stroke-dashoffset="0"/></svg><div class="sif-timer-text">--</div></div>'+
            '<div style="height:13px;"></div>'+
          '</div>'+
        '</div>'+
        '<div class="sif-bottom-bar"><div class="sif-title">'+(reel.label||"")+'</div></div>'+
        '<div class="sif-play-btn"><div class="sif-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 2L16 10L2 18V2Z" fill="white"/></svg></div></div>'+
        '<div class="sif-pause-ind"><div class="sif-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>'+
        '<button class="sif-mute-btn"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="sif-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="sif-mx1" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="sif-mx2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>'+
        '<button class="sif-popout-btn" aria-label="Pop out video">'+
          '<svg class="sif-popout-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="13" y2="11"/><line x1="3" y1="21" x2="11" y2="13"/></svg>'+
          '<svg class="sif-popin-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'+
        '</button>'+
        '<div class="sif-speed">2x</div>'+
        '<div class="sif-progress"><div class="sif-progress-track"></div><div class="sif-progress-fill"></div><div class="sif-progress-thumb"></div></div>'+
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
      });
      video.addEventListener("ended",function(){
        ring.style.strokeDashoffset=0; timerText.textContent=fmtTime(dur);
        timeCounter.textContent=fmtTime(dur)+" / "+fmtTime(dur);
        card.classList.remove("sif-playing");
        card.querySelector(".sif-play-btn").classList.remove("hidden");
        card.querySelector(".sif-mute-btn").classList.remove("visible");
        card.querySelector(".sif-popout-btn").classList.remove("visible");
        var pi=card.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
        var pb=card.querySelector(".sif-progress"); if (pb) pb.classList.remove("show");
        video.style.display="none"; poster.style.display="";
      });

      var playBtn=card.querySelector(".sif-play-btn");
      var muteBtn=card.querySelector(".sif-mute-btn");
      var popoutBtn=card.querySelector(".sif-popout-btn");
      playBtn.addEventListener("click",function(e){
        e.stopPropagation();
        // On mobile (any mode) AND in accordion desktop modes, tapping a
        // non-centre card should bring it to the centre rather than play it
        // in the background. Desktop ROW mode keeps the existing behaviour
        // (start any visible card playing).
        if ((isMobileLayout() || isAccordionDesktop()) && realIdx !== current){
          navigate(realIdx);
          return;
        }
        cards.forEach(function(c){ if (c.video!==video) resetCard(c); });
        video.muted=globalMuted; video.style.display="block"; poster.style.display="none";
        playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
        popoutBtn.classList.add("visible");   // desktop-only via CSS media query
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
        if (e.target.closest(".sif-play-btn")||e.target.closest(".sif-mute-btn")||
            e.target.closest(".sif-popout-btn")||e.target.closest(".sif-progress")) return;
        if (swallow){ swallow=false; return; }
        // On mobile (any mode) AND in accordion desktop modes, tapping a
        // non-centre card brings it to the centre. Desktop ROW mode keeps
        // the existing behaviour (click toggles pause when the centre card
        // is playing). Skipped while popped — the engine is frozen.
        if ((isMobileLayout() || isAccordionDesktop()) && realIdx !== current && !popped){
          navigate(realIdx);
          return;
        }
        if (video.style.display==="block"){
          var pi=card.querySelector(".sif-pause-ind");
          if (video.paused){ video.play(); if (pi) pi.classList.remove("visible"); }
          else { video.pause(); if (pi) pi.classList.add("visible"); }
        }
      });

      track.appendChild(card);
      var cardObj = { el:card, video:video, poster:poster, reelIdx:reelIdx, realIdx:realIdx };
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
      dot.addEventListener("click", function(){ navigate(rIdx); });
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
    if (!isAccordionDesktop()) return;
    var cardW = getCardW();
    var so    = Math.round(cardW * 0.68);
    var ss    = 0.69;
    var fs    = 0.56;
    var fanEdge = so + (cardW * ss) / 2;             // is-prev / is-next outer edge
    if (V === 5){
      var farEdge = (so * 1.55) + (cardW * fs) / 2;  // is-far outer edge
      if (farEdge > fanEdge) fanEdge = farEdge;
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
  }

  function resetCard(c){
    c.video.pause(); c.video.currentTime=0; c.video.playbackRate=1; c.video.volume=1;
    c.video.style.display="none"; c.poster.style.display="";
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
  }

  function openPopout(c){
    if (popped || popBusy || busy || !isDesktopLayout()) return;
    popBusy = true;
    popped  = true;
    poppedCard = c;
    var el = c.el;

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
  function isMobileLayout(){
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
    }
  }

  // Reposition everything on resize.
  function relayout(){
    placeAll();
    setTrack(false);
  }

  // ── Controls ─────────────────────────────────────────
  prevBtn.addEventListener("click",function(){ navigate(mod(current-1,realCount)); });
  nextBtn.addEventListener("click",function(){ navigate(mod(current+1,realCount)); });

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

})();
