(function () {

  /* ====================================================
     Splshy Infinite Swipe Carousel — Hosted Version
     splshy.com/infinite/widget.js

     Usage on any page:

     <div id="splshy-infinite"></div>
     <script>
       window.SPLSHY_INFINITE = {
         containerId:   "splshy-infinite",
         followerCount: "118K followers",
         igUrl:         "https://www.instagram.com/visitraleigh/",
         logoUrl:       "",
         reels: [
           { videoUrl: "https://...", posterUrl: "https://...", label: "Reel Title" },
           ...up to 7 reels
         ]
       };
     </script>
     <script src="https://splshy.com/infinite/widget.js"></script>
  ==================================================== */

  var cfg           = window.SPLSHY_INFINITE || {};
  var reels         = cfg.reels              || [];
  var followerCount = cfg.followerCount      || "";
  var igUrl         = cfg.igUrl             || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl           || "";
  var containerId   = cfg.containerId       || "splshy-infinite";

  if (!reels.length) {
    console.warn("Splshy Infinite: no reels configured.");
    return;
  }

  // ── Inject CSS ──────────────────────────────────────
  if (!document.querySelector("style[data-splshy-infinite]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-infinite", "1");
    style.textContent = [
      /* Widget wrapper */
      ".sif-widget{--sif-accent:#D30011;--sif-card-w:220px;--sif-card-h:390px;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;width:100%;user-select:none;padding:29px 0}",
      ".sif-widget button{outline:none!important;-webkit-tap-highlight-color:transparent}",

      /* Stage */
      ".sif-stage{position:relative;width:100%;height:var(--sif-card-h);display:flex;align-items:center;justify-content:center;overflow:hidden;isolation:isolate}",

      /* Card — shared */
      ".sif-card{position:absolute;width:var(--sif-card-w);height:var(--sif-card-h);border-radius:20px;overflow:hidden;background:#1a1a1a;cursor:pointer;will-change:transform,opacity,filter;-webkit-transform:translateZ(0);-webkit-mask-image:-webkit-radial-gradient(white,black);-webkit-user-select:none;-webkit-touch-callout:none;user-select:none;touch-action:pan-y;transition:transform .45s cubic-bezier(.4,0,.2,1),opacity .45s cubic-bezier(.4,0,.2,1),filter .45s cubic-bezier(.4,0,.2,1),box-shadow .45s cubic-bezier(.4,0,.2,1)}",

      /* Mobile card states (default) */
      ".sif-card.is-active{transform:translateX(0) scale(1);opacity:1;filter:brightness(1);box-shadow:0 24px 64px rgba(0,0,0,.68);cursor:default;z-index:10}",
      ".sif-card.is-prev,.sif-card.is-next{opacity:1;filter:brightness(.55);z-index:5}",
      ".sif-card.is-far{opacity:1;filter:brightness(.3);z-index:2}",
      ".sif-card.is-hidden{opacity:0;pointer-events:none;z-index:1}",

      /* Poster */
      ".sif-poster{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:20px;overflow:hidden}",
      ".sif-poster-placeholder{position:absolute;inset:0;background:linear-gradient(160deg,#2a2a2a 0%,#111 100%)}",
      ".sif-poster-placeholder[data-idx='0']{background:linear-gradient(160deg,#1d3a2f 0%,#0d1f1a 100%)}",
      ".sif-poster-placeholder[data-idx='1']{background:linear-gradient(160deg,#2e1f3a 0%,#160d1f 100%)}",
      ".sif-poster-placeholder[data-idx='2']{background:linear-gradient(160deg,#3a2010 0%,#1f0f05 100%)}",
      ".sif-poster-placeholder[data-idx='3']{background:linear-gradient(160deg,#10243a 0%,#05121f 100%)}",
      ".sif-poster-placeholder[data-idx='4']{background:linear-gradient(160deg,#1a3020 0%,#0a1810 100%)}",
      ".sif-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px}",

      /* Video */
      ".sif-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px;display:none;background:#000;pointer-events:none;-webkit-touch-callout:none}",

      /* Top bar */
      ".sif-top-bar{position:absolute;top:0;left:0;right:0;padding:22px 20px 40px;background:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      ".sif-top-bar a{pointer-events:auto}",
      ".sif-logo{width:52px;height:52px;border-radius:50%;border:2px solid var(--sif-accent);overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center}",
      ".sif-logo img{width:100%;height:100%;object-fit:cover}",
      ".sif-timer{position:relative;width:52px;height:52px;flex-shrink:0}",
      ".sif-timer svg{width:52px;height:52px;transform:rotate(-90deg)}",
      ".sif-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".sif-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".sif-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;letter-spacing:-.01em;line-height:1}",

      /* Bottom bar */
      ".sif-bottom-bar{position:absolute;bottom:0;left:0;right:0;padding:40px 16px 26px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".sif-title{color:#fff;font-size:16.5px;font-weight:600;line-height:1.35;letter-spacing:.01em;text-shadow:0 1px 4px rgba(0,0,0,.4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-left:4px;margin-right:20px}",

      /* Play / pause */
      ".sif-play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;cursor:pointer;transition:opacity .2s}",
      ".sif-play-btn.hidden{opacity:0;pointer-events:none}",
      ".sif-card:not(.is-active) .sif-play-btn{opacity:0;pointer-events:none}",
      ".sif-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".sif-pause-ind.visible{opacity:1}",
      ".sif-card:not(.is-active) .sif-pause-ind{opacity:0}",
      ".sif-play-circle{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;transition:transform .18s,background .18s}",
      ".sif-play-btn:hover .sif-play-circle{transform:scale(1.1);background:rgba(255,255,255,.28)}",
      ".sif-play-circle svg{margin-left:4px}",
      ".sif-pause-ind .sif-play-circle svg{margin-left:0}",

      /* Mute */
      ".sif-mute-btn{position:absolute;bottom:58px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:flex;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s}",
      ".sif-mute-btn.visible{opacity:1}",
      ".sif-mute-btn svg{width:15px;height:15px}",

      /* Speed */
      ".sif-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(4px);color:#fff;font-size:15px;font-weight:700;padding:7px 14px;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);z-index:16;pointer-events:none;opacity:0;transition:opacity .15s}",
      ".sif-speed.visible{opacity:1}",

      /* Progress */
      ".sif-progress{position:absolute;bottom:0;left:0;right:0;height:20px;background:transparent;z-index:20;cursor:pointer;opacity:0;transition:opacity 1s;border-radius:0 0 20px 20px;display:flex;align-items:flex-end}",
      "@media(hover:hover){.sif-card.is-active:hover .sif-progress{opacity:1}}",
      ".sif-progress.dragging,.sif-progress.visible{opacity:1!important}",
      ".sif-progress-track{position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,.25);border-radius:0 0 20px 20px;transition:height .15s;pointer-events:none}",
      ".sif-progress:hover .sif-progress-track,.sif-progress.dragging .sif-progress-track{height:9px}",
      ".sif-progress-fill{position:absolute;bottom:0;left:0;height:6px;background:#fff;pointer-events:none;width:0%;transition:height .15s;border-radius:0 0 0 20px}",
      ".sif-progress:hover .sif-progress-fill,.sif-progress.dragging .sif-progress-fill{height:9px}",
      ".sif-progress-thumb{position:absolute;bottom:-3.5px;width:13px;height:13px;background:#fff;border-radius:50%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .15s,bottom .15s;box-shadow:0 1px 4px rgba(0,0,0,.4)}",
      ".sif-progress:hover .sif-progress-thumb,.sif-progress.dragging .sif-progress-thumb{opacity:1;bottom:-2px}",

      /* Arrows */
      ".sif-arrow{position:absolute;top:calc(var(--sif-card-h)/2);transform:translateY(-50%);width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;border-radius:50%!important;background:#fff!important;border:none!important;box-shadow:0 3px 14px rgba(0,0,0,.13);cursor:pointer;align-items:center;justify-content:center;z-index:30;display:none;transition:background .18s,transform .18s,box-shadow .18s}",
      ".sif-arrow:hover{background:var(--sif-accent)!important;transform:translateY(-50%) scale(1.1);box-shadow:0 6px 20px rgba(211,0,17,.3)}",
      ".sif-arrow:hover svg polyline{stroke:#fff}",
      ".sif-arrow:focus,.sif-arrow:focus-visible{outline:none}",
      "@media(min-width:600px){.sif-arrow{display:flex!important}.sif-arrow--left{left:calc(50% - var(--sif-card-w)*1.4 - 56px)!important}.sif-arrow--right{right:calc(50% - var(--sif-card-w)*1.4 - 56px)!important}}",

      /* Dots */
      ".sif-dots{display:flex;justify-content:center;gap:8.5px;margin-top:18px}",
      ".sif-dot{width:8.5px!important;height:8.5px!important;min-width:8.5px!important;min-height:8.5px!important;border-radius:50%!important;background:#ccc;border:none!important;cursor:pointer;padding:0!important;transition:background .25s,transform .25s}",
      ".sif-dot.is-active{background:var(--sif-accent);transform:scale(1.35)}",

      /* ── DESKTOP OVERRIDES ── */
      "@media(min-width:768px) and (any-pointer:fine){",
        ".sif-widget{--sif-card-w:min(354px,calc(70vh*9/16));--sif-card-h:min(627px,70vh)}",
        /* On desktop all visible cards are same size/brightness */
        ".sif-card.is-prev,.sif-card.is-next{filter:brightness(1)!important;opacity:1!important}",
        ".sif-card.is-far,.sif-card.is-hidden{opacity:0!important;pointer-events:none!important}",
        /* Desktop: clicking side cards is allowed */
        ".sif-card.is-prev,.sif-card.is-next{cursor:pointer!important}",
        /* Arrow positioning for desktop 3-up */
        ".sif-arrow--left{left:calc(50% - var(--sif-card-w)*1.55 - 52px)!important}",
        ".sif-arrow--right{right:calc(50% - var(--sif-card-w)*1.55 - 52px)!important}",
      "}",

      /* ── MOBILE ── */
      "@media(max-width:767px){.sif-widget{--sif-card-h:65vh;--sif-card-w:calc(65vh*9/16)}}",
      "@media(min-width:768px) and (pointer:coarse) and (hover:none){.sif-widget{--sif-card-h:65vh;--sif-card-w:calc(65vh*9/16)}}",
    ].join("");
    document.head.appendChild(style);
  }

  // ── Find container ──────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) {
    console.warn("Splshy Infinite: no element with id '" + containerId + "'");
    return;
  }

  // ── Build widget shell ──────────────────────────────
  container.innerHTML =
    '<div class="sif-widget">' +
      '<div style="position:relative;">' +
        '<div class="sif-stage"></div>' +
        '<button class="sif-arrow sif-arrow--left" aria-label="Previous" style="outline:none;padding:0!important;display:none;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block;flex-shrink:0;">' +
            '<polyline points="10,2 2,10 10,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '</svg>' +
        '</button>' +
        '<button class="sif-arrow sif-arrow--right" aria-label="Next" style="outline:none;padding:0!important;display:none;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block;flex-shrink:0;">' +
            '<polyline points="2,2 10,10 2,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="sif-dots"></div>' +
    '</div>';

  var widget  = container.querySelector(".sif-widget");
  var stage   = widget.querySelector(".sif-stage");
  var prevBtn = widget.querySelector(".sif-arrow--left");
  var nextBtn = widget.querySelector(".sif-arrow--right");
  var dotsEl  = widget.querySelector(".sif-dots");

  var n           = reels.length;
  var current     = 0;
  var cardEls     = [];
  var dotEls      = [];
  var globalMuted = false;
  var activeFade  = null;

  function mod(x, m) { return ((x % m) + m) % m; }
  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }
  function syncMuteIcon(btn, muted) {
    if (!btn) return;
    btn.querySelectorAll(".sif-unmute").forEach(function (el) { el.style.display = muted ? "none" : "block"; });
    btn.querySelectorAll(".sif-mx1,.sif-mx2").forEach(function (el) { el.style.display = muted ? "block" : "none"; });
  }
  function isDesktop() {
    return window.matchMedia("(min-width:768px) and (any-pointer:fine)").matches;
  }

  // ── Build cards ─────────────────────────────────────
  reels.forEach(function (reel, i) {
    var card = document.createElement("div");
    card.className = "sif-card is-hidden";

    // Poster
    var poster = document.createElement("div");
    poster.className = "sif-poster";
    var ph = document.createElement("div");
    ph.className = "sif-poster-placeholder";
    ph.setAttribute("data-idx", i % 5);
    poster.appendChild(ph);
    if (reel.posterUrl) {
      var img = document.createElement("img");
      img.src = reel.posterUrl; img.alt = reel.label || "";
      poster.appendChild(img);
    }
    card.appendChild(poster);

    // Video
    var video = document.createElement("video");
    video.className = "sif-video";
    video.src = reel.videoUrl;
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "metadata");
    if (reel.posterUrl) video.setAttribute("poster", reel.posterUrl);
    card.appendChild(video);

    // Top bar
    var resolvedLogo = reel.logoUrl || logoUrl || "";
    var logoInner = resolvedLogo
      ? '<img src="' + resolvedLogo + '" alt="logo">'
      : '<div style="width:100%;height:100%;background:#D30011;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">S</div>';
    var RING_C = (2 * Math.PI * 23).toFixed(2);

    card.insertAdjacentHTML("beforeend",
      '<div class="sif-top-bar">' +
        '<a href="' + igUrl + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">' +
          '<div class="sif-logo">' + logoInner + '</div>' +
          '<div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:400;letter-spacing:0.03em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">' + followerCount + '</div>' +
        '</a>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">' +
          '<div class="sif-timer">' +
            '<svg viewBox="0 0 52 52"><circle class="sif-timer-bg" cx="26" cy="26" r="23"/><circle class="sif-timer-ring" cx="26" cy="26" r="23" stroke-dasharray="' + RING_C + '" stroke-dashoffset="0"/></svg>' +
            '<div class="sif-timer-text">--</div>' +
          '</div>' +
          '<div style="height:13px;"></div>' +
        '</div>' +
      '</div>' +
      '<div class="sif-bottom-bar"><div class="sif-title">' + (reel.label || "") + '</div></div>' +
      '<div class="sif-play-btn"><div class="sif-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 2L16 10L2 18V2Z" fill="white"/></svg></div></div>' +
      '<div class="sif-pause-ind"><div class="sif-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>' +
      '<button class="sif-mute-btn"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="sif-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="sif-mx1" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="sif-mx2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>' +
      '<div class="sif-speed">2x</div>' +
      '<div class="sif-progress"><div class="sif-progress-track"></div><div class="sif-progress-fill"></div><div class="sif-progress-thumb"></div></div>'
    );

    stage.appendChild(card);
    card.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // Timer
    var ring      = card.querySelector(".sif-timer-ring");
    var timerText = card.querySelector(".sif-timer-text");
    var RING_C2   = 2 * Math.PI * 23;
    ring.style.strokeDasharray = RING_C2;
    var dur = 0;

    video.addEventListener("loadedmetadata", function () {
      dur = video.duration;
      timerText.textContent = fmtTime(dur);
    });
    video.addEventListener("timeupdate", function () {
      if (!dur) return;
      var pct = video.currentTime / dur;
      ring.style.strokeDashoffset = RING_C2 * (1 - pct);
      timerText.textContent = fmtTime(Math.max(0, dur - video.currentTime));
      var pf = card.querySelector(".sif-progress-fill"), pt = card.querySelector(".sif-progress-thumb");
      if (pf) pf.style.width = (pct * 100) + "%";
      if (pt) pt.style.left  = (pct * 100) + "%";
    });
    video.addEventListener("ended", function () {
      ring.style.strokeDashoffset = 0;
      timerText.textContent = fmtTime(dur);
      card.querySelector(".sif-play-btn").classList.remove("hidden");
      card.querySelector(".sif-mute-btn").classList.remove("visible");
      var pi = card.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
      video.style.display = "none"; poster.style.display = "";
    });

    // Play btn
    var playBtn = card.querySelector(".sif-play-btn");
    var muteBtn = card.querySelector(".sif-mute-btn");
    playBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      video.muted = globalMuted; video.style.display = "block"; poster.style.display = "none";
      playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
      syncMuteIcon(muteBtn, globalMuted); video.play();
    });
    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation(); globalMuted = !globalMuted;
      cardEls.forEach(function (c) { c.video.muted = globalMuted; syncMuteIcon(c.el.querySelector(".sif-mute-btn"), globalMuted); });
    });

    // Progress
    var progBar = card.querySelector(".sif-progress");
    var dragging = false;
    function getPct(e) {
      var rect = progBar.getBoundingClientRect();
      return Math.max(0, Math.min(1, ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) / rect.width));
    }
    function seekTo(pos) { if (dur) video.currentTime = pos * dur; }
    progBar.addEventListener("click", function (e) { e.stopPropagation(); });
    progBar.addEventListener("mousedown", function (e) { e.stopPropagation(); dragging = true; progBar.classList.add("dragging"); seekTo(getPct(e)); });
    progBar.addEventListener("touchstart", function (e) { e.stopPropagation(); dragging = true; progBar.classList.add("dragging"); seekTo(getPct(e)); }, { passive: true });
    document.addEventListener("mousemove", function (e) { if (dragging) seekTo(getPct(e)); });
    document.addEventListener("touchmove", function (e) { if (dragging) seekTo(getPct(e)); }, { passive: true });
    document.addEventListener("mouseup", function () { if (dragging) { dragging = false; progBar.classList.remove("dragging"); } });
    document.addEventListener("touchend", function () {
      if (dragging) { dragging = false; progBar.classList.remove("dragging"); window._sifScrubEnd = true; setTimeout(function () { window._sifScrubEnd = false; }, 300); }
    });
    video.addEventListener("play", function () {
      if (window.matchMedia("(hover:none)").matches) {
        progBar.classList.add("visible");
        setTimeout(function () { if (!dragging) progBar.classList.remove("visible"); }, 7000);
      }
    });

    // 2x hold
    var speedInd = card.querySelector(".sif-speed");
    var holdTimer = null, holding = false, swallow = false;
    function startHold() {
      if (i !== current || video.style.display !== "block" || video.paused) return;
      holdTimer = setTimeout(function () { holding = true; if (!video.paused) { video.playbackRate = 2; speedInd.classList.add("visible"); } }, 300);
    }
    function endHold() {
      clearTimeout(holdTimer);
      if (holding) { holding = false; swallow = true; video.playbackRate = 1; speedInd.classList.remove("visible"); setTimeout(function () { swallow = false; }, 50); }
    }
    card.addEventListener("mousedown", startHold);
    card.addEventListener("touchstart", startHold, { passive: true });
    card.addEventListener("mouseup", endHold);
    card.addEventListener("mouseleave", endHold);
    card.addEventListener("touchend", endHold);
    card.addEventListener("touchcancel", endHold);

    // Click to navigate or pause
    card.addEventListener("click", function (e) {
      if (e.target.closest(".sif-play-btn") || e.target.closest(".sif-mute-btn") || e.target.closest(".sif-progress")) return;
      if (swallow) { swallow = false; return; }
      if (i !== current) { goTo(i); return; }
      if (video.style.display === "block") {
        var pi = card.querySelector(".sif-pause-ind");
        if (video.paused) { video.play(); if (pi) pi.classList.remove("visible"); }
        else { video.pause(); if (pi) pi.classList.add("visible"); }
      }
    });

    // Dot
    var dot = document.createElement("button");
    dot.className = "sif-dot";
    dot.setAttribute("aria-label", "Reel " + (i + 1));
    dot.addEventListener("click", function () { goTo(i); });
    dotsEl.appendChild(dot);
    dotEls.push(dot);

    cardEls.push({ el: card, video: video, poster: poster });
  });

  // ── Layout ──────────────────────────────────────────
  function layout() {
    var cardW    = cardEls[0] ? cardEls[0].el.offsetWidth : 220;
    var desktop  = isDesktop();
    var sideOff  = desktop ? Math.round(cardW * 1.04) : Math.round(cardW * 0.68);
    var sideScl  = desktop ? 1 : (window.matchMedia("(max-width:767px),(pointer:coarse) and (hover:none)").matches ? 0.635 : 0.69);
    var farScl   = desktop ? 1 : (window.matchMedia("(max-width:767px),(pointer:coarse) and (hover:none)").matches ? 0.515 : 0.56);

    cardEls.forEach(function (c, i) {
      var el  = c.el;
      var rel = i - current;
      // Shortest path (for infinite wrap feel)
      if (rel >  Math.floor(n / 2)) rel -= n;
      if (rel < -Math.floor(n / 2)) rel += n;

      el.classList.remove("is-active", "is-prev", "is-next", "is-far", "is-hidden");

      if (rel === 0) {
        el.classList.add("is-active");
        el.style.transform = "translateX(0px) scale(1)";
        el.style.zIndex = "10";
      } else if (rel === -1) {
        el.classList.add("is-prev");
        el.style.transform = "translateX(-" + sideOff + "px) scale(" + sideScl + ")";
        el.style.zIndex = "5";
      } else if (rel === 1) {
        el.classList.add("is-next");
        el.style.transform = "translateX(" + sideOff + "px) scale(" + sideScl + ")";
        el.style.zIndex = "5";
      } else if (Math.abs(rel) === 2 && !desktop) {
        el.classList.add("is-far");
        var dir = rel < 0 ? -1 : 1;
        el.style.transform = "translateX(" + (dir * sideOff * 1.55) + "px) scale(" + farScl + ")";
        el.style.zIndex = "2";
      } else {
        el.classList.add("is-hidden");
        el.style.transform = "translateX(0px) scale(1)";
        el.style.zIndex = "1";
      }
    });

    dotEls.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
  }

  // ── Reset a card ────────────────────────────────────
  function resetCard(c) {
    c.video.pause(); c.video.currentTime = 0; c.video.playbackRate = 1; c.video.volume = 1;
    c.video.style.display = "none"; c.poster.style.display = "";
    var pf = c.el.querySelector(".sif-progress-fill"), pt = c.el.querySelector(".sif-progress-thumb");
    if (pf) pf.style.width = "0%"; if (pt) pt.style.left = "0%";
    c.el.querySelector(".sif-play-btn").classList.remove("hidden");
    c.el.querySelector(".sif-mute-btn").classList.remove("visible");
    var pi = c.el.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
    var r  = c.el.querySelector(".sif-timer-ring"); if (r) r.style.strokeDashoffset = 0;
    var tx = c.el.querySelector(".sif-timer-text"); if (tx && c.video.duration) tx.textContent = fmtTime(c.video.duration);
  }

  function fadeOutAndReset(c) {
    var vid = c.video;
    if (vid.paused || vid.volume === 0) { resetCard(c); return; }
    var fade = setInterval(function () {
      if (vid.volume > 0.05) { vid.volume = Math.max(0, vid.volume - 0.05); }
      else { clearInterval(fade); if (activeFade === fade) activeFade = null; vid.volume = 1; resetCard(c); }
    }, 30);
    activeFade = fade;
  }

  // ── Navigate ─────────────────────────────────────────
  function goTo(index) {
    index = mod(index, n);
    if (index === current) return;
    if (activeFade) { clearInterval(activeFade); activeFade = null; }
    cardEls.forEach(function (c) { if (!c.video.paused) resetCard(c); });
    var outgoing = cardEls[current];
    current = index;
    layout();
    fadeOutAndReset(outgoing);
  }

  prevBtn.addEventListener("click", function () { goTo(current - 1); });
  nextBtn.addEventListener("click", function () { goTo(current + 1); });

  // Touch swipe
  var txStart = 0, txStartY = 0;
  stage.addEventListener("touchstart", function (e) { txStart = e.touches[0].clientX; txStartY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (window._sifScrubEnd) return;
    var dx = e.changedTouches[0].clientX - txStart;
    var dy = Math.abs(e.changedTouches[0].clientY - txStartY);
    if (Math.abs(dx) > 38 && Math.abs(dx) > dy) goTo(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Desktop mouse swipe
  var msStart = null, msDrag = false;
  stage.addEventListener("mousedown", function (e) { if (e.target.closest(".sif-arrow") || e.target.closest(".sif-progress")) return; msStart = e.clientX; msDrag = false; });
  stage.addEventListener("mousemove", function (e) { if (msStart === null) return; if (Math.abs(e.clientX - msStart) > 8) msDrag = true; });
  stage.addEventListener("mouseup", function (e) {
    if (msStart === null) return;
    var dx = e.clientX - msStart; msStart = null;
    if (msDrag && Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
    msDrag = false;
  });
  stage.addEventListener("mouseleave", function () { msStart = null; msDrag = false; });

  // Keyboard
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") goTo(current - 1);
    if (e.key === "ArrowRight") goTo(current + 1);
  });

  layout();
  window.addEventListener("resize", layout);

})();