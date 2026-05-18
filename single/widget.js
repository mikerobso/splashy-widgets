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
  var containerId   = cfg.containerId   || "splshy-single";
  var followerCount = cfg.followerCount || "";
  var igUrl         = cfg.igUrl         || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl       || "";
  var logoRing      = cfg.logoRing      || "#D30011";
  var videoUrl      = cfg.videoUrl      || "";
  var posterUrl     = cfg.posterUrl     || "";
  var label         = cfg.label         || "";

  // The Instagram-style gradient ring (matches the other Splshy widgets).
  var IG_RING = "conic-gradient(from 0deg, #F9CE34, #EE2A7B, #6228D7, #EE2A7B, #F9CE34)";
  // logoRing may be a solid colour (e.g. "#D30011") or the string
  // "instagram" for the gradient ring.
  var ringIsGradient = (logoRing === "instagram");

  // ── Inject CSS (once per page) ──────────────────────
  if (!document.querySelector("style[data-splshy-single]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-single", "1");
    style.textContent = [
      ".srv-widget{--srv-accent:#D30011;--srv-card-w:280px;--srv-card-h:496px;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;padding:30px 60px 55px 30px;box-sizing:border-box;display:flex;align-items:flex-start}",
      ".srv-widget *{box-sizing:border-box;margin:0;padding:0}",
      ".srv-widget,.srv-widget *{-webkit-user-select:none!important;-moz-user-select:none!important;user-select:none!important;-webkit-user-drag:none!important}",
      ".srv-widget button{outline:none!important;-webkit-tap-highlight-color:transparent}",
      ".srv-card{position:relative;width:var(--srv-card-w);height:var(--srv-card-h);border-radius:20px;overflow:hidden;background:#1a1a1a;-webkit-mask-image:-webkit-radial-gradient(white,black);-webkit-touch-callout:none;user-select:none;box-shadow:0 24px 64px rgba(0,0,0,.28);flex-shrink:0;touch-action:pan-y}",
      ".srv-poster{position:absolute;inset:0}",
      ".srv-poster-bg{position:absolute;inset:0;background:linear-gradient(160deg,#2a1a0e 0%,#0d0804 100%)}",
      ".srv-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
      ".srv-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;background:#000;pointer-events:none;-webkit-touch-callout:none}",
      ".srv-top-bar{position:absolute;top:0;left:0;right:0;padding:22px 20px 40px;background:linear-gradient(to bottom,rgba(0,0,0,.6) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      // The logo ring. A solid ring uses `border`; the Instagram gradient
      // ring uses a conic-gradient background with the logo padded inside
      // (a CSS border can't be a gradient). The .srv-logo-ring--grad
      // modifier switches to the gradient style.
      ".srv-logo{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;border-radius:50%!important;border:2px solid var(--srv-accent)!important;overflow:hidden!important;background:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important}",
      // Instagram-style gradient ring. The masked gradient lives on a
      // ::before pseudo-element so the mask (which punches the transparent
      // centre hole) affects ONLY the gradient — the logo is a separate,
      // un-masked child sitting on top. To widen the gap without shrinking
      // the logo, the OUTER circle is grown to 47.5px (radius 23.75) while
      // the logo stays 39px. Geometry: gradient ring 23.75->21.75 (2px),
      // transparent gap 21.75->19.5 (2.25px), logo r19.5 (39px).
      ".srv-logo.srv-logo--grad{width:47.5px!important;height:47.5px!important;min-width:47.5px!important;min-height:47.5px!important;border:none!important;background:transparent!important;position:relative}",
      ".srv-logo.srv-logo--grad::before{content:'';position:absolute;inset:0;border-radius:50%;background:var(--srv-ring-grad);-webkit-mask:radial-gradient(circle, transparent 0 21.75px, #000 21.75px);mask:radial-gradient(circle, transparent 0 21.75px, #000 21.75px)}",
      ".srv-logo.srv-logo--grad .srv-logo-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:39px;height:39px;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;z-index:1}",
      ".srv-logo img{width:100%;height:100%;object-fit:cover;display:block}",
      ".srv-timer{position:relative;width:46px;height:46px;flex-shrink:0}",
      ".srv-timer svg{width:46px;height:46px;transform:rotate(-90deg)}",
      ".srv-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".srv-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".srv-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}",
      ".srv-bottom-bar{position:absolute;bottom:0;left:0;right:0;padding:40px 16px 26px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".srv-label{color:#fff;font-size:16px;font-weight:600;line-height:1.35;text-shadow:0 1px 4px rgba(0,0,0,.4);padding-left:4px;margin-right:20px}",
      ".srv-play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;cursor:pointer;transition:opacity .2s}",
      ".srv-play-btn.hidden{opacity:0;pointer-events:none}",
      ".srv-play-circle{width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;border-radius:50%!important;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5)!important;display:flex;align-items:center;justify-content:center;padding:0!important;transition:transform .18s,background .18s}",
      ".srv-play-btn:hover .srv-play-circle{transform:scale(1.1);background:rgba(255,255,255,.28)}",
      ".srv-play-circle svg{margin-left:4px;display:block}",
      ".srv-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".srv-pause-ind.visible{opacity:1}",
      ".srv-pause-circle{width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;border-radius:50%!important;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5)!important;display:flex;align-items:center;justify-content:center;padding:0!important}",
      ".srv-pause-circle svg{display:block;margin-left:0}",
      ".srv-mute-btn{position:absolute;bottom:58px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:flex;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s}",
      ".srv-mute-btn.visible{opacity:1}",
      ".srv-mute-btn svg{width:15px;height:15px;display:block}",
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
      ".srv-progress:hover .srv-progress-thumb,.srv-progress.dragging .srv-progress-thumb{opacity:1;bottom:-2px}",
      "@media(max-width:767px){.srv-widget{padding:20px;justify-content:center;--srv-card-w:78.2vw;--srv-card-h:calc(78.2vw*16/9)}}",
      "@media(min-width:768px) and (any-pointer:fine){.srv-widget{--srv-card-w:280px;--srv-card-h:496px}}",
      "@media(min-width:1024px) and (any-pointer:fine){.srv-widget{--srv-card-w:320px;--srv-card-h:568px}}"
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
        '<div class="srv-play-btn"><div class="srv-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 2L16 10L2 18V2Z" fill="white"/></svg></div></div>' +
        '<div class="srv-pause-ind"><div class="srv-pause-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>' +
        '<button class="srv-mute-btn" aria-label="Toggle mute"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="srv-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="srv-mx1" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="srv-mx2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>' +
        '<div class="srv-speed">2x</div>' +
        '<div class="srv-progress"><div class="srv-progress-track"></div><div class="srv-progress-fill"></div><div class="srv-progress-thumb"></div></div>' +
      '</div>' +
    '</div>';

  var widget    = container.querySelector(".srv-widget");
  var card      = widget.querySelector(".srv-card");
  var video     = widget.querySelector(".srv-video");
  var poster    = widget.querySelector(".srv-poster");
  var playBtn   = widget.querySelector(".srv-play-btn");
  var muteBtn   = widget.querySelector(".srv-mute-btn");
  var pauseInd  = widget.querySelector(".srv-pause-ind");
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

  // Top bar
  var RING_C = (2 * Math.PI * 20).toFixed(2);
  // The logo's inner content — an uploaded image, or the "S" fallback.
  var logoContent = logoUrl
    ? '<img src="' + logoUrl + '" alt="logo">'
    : '<div style="width:100%;height:100%;background:#D30011;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">S</div>';
  // For the gradient ring the logo content sits in an inner circle centred
  // in the masked ring; the transparent hole + smaller logo create the
  // Instagram-style see-through gap. For a solid ring the border does it.
  var logoHTML = ringIsGradient
    ? '<div class="srv-logo srv-logo--grad"><div class="srv-logo-inner">' + logoContent + '</div></div>'
    : '<div class="srv-logo">' + logoContent + '</div>';

  card.insertAdjacentHTML("afterbegin",
    '<div class="srv-top-bar">' +
      '<a href="' + igUrl + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">' +
        logoHTML +
        '<div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:400;letter-spacing:0.03em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">' + followerCount + '</div>' +
      '</a>' +
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
  var RING_C2   = 2 * Math.PI * 20;
  ring.style.strokeDasharray = RING_C2;

  var dur = 0, muted = false, dragging = false;
  var holding = false, swallow = false, holdTimer = null;

  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  video.addEventListener("loadedmetadata", function () {
    dur = video.duration;
    timerText.textContent = fmtTime(dur);
  });
  video.addEventListener("timeupdate", function () {
    if (!dur) return;
    var pct = video.currentTime / dur;
    ring.style.strokeDashoffset = RING_C2 * (1 - pct);
    timerText.textContent = fmtTime(Math.max(0, dur - video.currentTime));
    progFill.style.width = (pct * 100) + "%";
    progThumb.style.left = (pct * 100) + "%";
  });
  video.addEventListener("ended", function () {
    ring.style.strokeDashoffset = 0;
    timerText.textContent = fmtTime(dur);
    progFill.style.width = "0%"; progThumb.style.left = "0%";
    video.style.display = "none"; poster.style.display = "";
    playBtn.classList.remove("hidden");
    muteBtn.classList.remove("visible");
    pauseInd.classList.remove("visible");
  });

  // Play
  playBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    video.muted = muted; video.style.display = "block"; poster.style.display = "none";
    playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
    syncMute(); video.play();
  });

  // Card click
  card.addEventListener("click", function (e) {
    if (e.target.closest(".srv-play-btn") || e.target.closest(".srv-mute-btn") || e.target.closest(".srv-progress")) return;
    if (swallow) { swallow = false; return; }
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
  }
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation(); muted = !muted; video.muted = muted; syncMute();
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
  video.addEventListener("play", function () {
    if (window.matchMedia("(hover:none)").matches) {
      progBar.classList.add("visible");
      clearTimeout(window._srvFade);
      window._srvFade = setTimeout(function () { if (!dragging) progBar.classList.remove("visible"); }, 7000);
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

})();
