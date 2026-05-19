(function () {

  /* ====================================================
     Splshy Reels Widget — Hosted Version
     splshy.com/reels/widget.js

     Multi-instance: each embed pushes its config object to
     window.SPLSHY_REELS_QUEUE. This script initialises every
     queued config, so any number of accordion carousels can live
     on the same page. (The legacy single global window.SPLSHY_REELS
     is still honoured for backward compatibility.)

     Usage on any page:

     <div id="splshy-reels"></div>
     <script>
       (window.SPLSHY_REELS_QUEUE = window.SPLSHY_REELS_QUEUE || []).push({
         containerId:   "splshy-reels",
         followerCount: "118K followers",
         igUrl:         "https://www.instagram.com/visitraleigh/",
         logoUrl:       "",
         logoRing:      "#D30011",
         reels: [
           { videoUrl: "https://...", posterUrl: "https://...", label: "Reel Title" },
           { videoUrl: "https://...", posterUrl: "https://...", label: "Reel Title" }
         ]
       });
     </script>
     <script src="https://splshy.com/reels/widget.js"></script>
  ==================================================== */

  function initWidget(cfg) {

  cfg               = cfg || {};
  var reels         = cfg.reels           || [];
  var followerCount = cfg.followerCount   || "";
  var igUrl         = cfg.igUrl           || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl         || "";
  var logoRing      = cfg.logoRing        || "#D30011";
  var containerId   = cfg.containerId     || "splshy-reels";

  // The Instagram-style gradient ring (matches the other Splshy widgets).
  var IG_RING = "conic-gradient(from 0deg, #F9CE34, #EE2A7B, #6228D7, #EE2A7B, #F9CE34)";
  var ringIsGradient = (logoRing === "instagram");

  if (!reels.length) {
    console.warn("Splshy: no reels configured. Set window.SPLSHY_REELS.reels before loading the script.");
    return;
  }

  // ── Inject CSS (once per page) ──────────────────────
  if (!document.querySelector("style[data-splshy-reels]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-reels", "1");
    style.textContent = [
      ".rvc-widget{--rvc-accent:#D30011;--rvc-card-w:220px;--rvc-card-h:390px;font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;width:100%;user-select:none;padding:29px 0}",
      ".rvc-widget button{outline:none!important;-webkit-tap-highlight-color:transparent}",
      ".rvc-stage{position:relative;width:100%;height:var(--rvc-card-h);display:flex;align-items:center;justify-content:center;overflow:hidden;isolation:isolate}",
      ".rvc-card{position:absolute;width:var(--rvc-card-w);height:var(--rvc-card-h);border-radius:20px;overflow:hidden;background:#1a1a1a;cursor:pointer;will-change:transform,opacity,filter;-webkit-transform:translateZ(0);-webkit-mask-image:-webkit-radial-gradient(white,black);-webkit-user-select:none;-webkit-touch-callout:none;user-select:none;touch-action:pan-y;transition:transform .52s cubic-bezier(.4,0,.2,1),opacity .52s cubic-bezier(.4,0,.2,1),filter .52s cubic-bezier(.4,0,.2,1),box-shadow .52s cubic-bezier(.4,0,.2,1)}",
      ".rvc-card.is-active{transform:translateX(0) scale(1);opacity:1;filter:brightness(1);box-shadow:0 24px 64px rgba(0,0,0,.68);cursor:default}",
      ".rvc-card.is-prev,.rvc-card.is-next{opacity:1;filter:brightness(.55);cursor:pointer;pointer-events:auto}",
      ".rvc-card.is-far{opacity:1;filter:brightness(.3);pointer-events:auto;cursor:pointer}",
      ".rvc-poster{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:20px;overflow:hidden}",
      ".rvc-poster-placeholder{position:absolute;inset:0;background:linear-gradient(160deg,#2a2a2a 0%,#111 100%)}",
      ".rvc-poster-placeholder[data-idx='0']{background:linear-gradient(160deg,#1d3a2f 0%,#0d1f1a 100%)}",
      ".rvc-poster-placeholder[data-idx='1']{background:linear-gradient(160deg,#2e1f3a 0%,#160d1f 100%)}",
      ".rvc-poster-placeholder[data-idx='2']{background:linear-gradient(160deg,#3a2010 0%,#1f0f05 100%)}",
      ".rvc-poster-placeholder[data-idx='3']{background:linear-gradient(160deg,#10243a 0%,#05121f 100%)}",
      ".rvc-poster-placeholder[data-idx='4']{background:linear-gradient(160deg,#1a3020 0%,#0a1810 100%)}",
      ".rvc-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px}",
      ".rvc-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px;display:none;background:#000;-webkit-touch-callout:none;pointer-events:none}",
      ".rvc-play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;cursor:pointer;transition:opacity .2s}",
      ".rvc-play-btn.hidden{opacity:0;pointer-events:none}",
      ".rvc-card:not(.is-active) .rvc-play-btn{opacity:0;pointer-events:none}",
      ".rvc-pause-indicator{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".rvc-pause-indicator.visible{opacity:1}",
      ".rvc-card:not(.is-active) .rvc-pause-indicator{opacity:0}",
      ".rvc-play-circle{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;transition:transform .18s,background .18s}",
      ".rvc-play-btn:hover .rvc-play-circle{transform:scale(1.1);background:rgba(255,255,255,.28)}",
      ".rvc-play-circle svg{margin-left:4px}",
      ".rvc-pause-indicator .rvc-play-circle svg{margin-left:0}",
      ".rvc-top-bar{position:absolute;top:0;left:0;right:0;padding:22px 20px 40px;background:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      ".rvc-top-bar a{pointer-events:auto}",
      // The logo ring. A solid ring uses the .rvc-logo border (coloured by
      // --rvc-logo-ring, falling back to --rvc-accent red). The Instagram
      // gradient ring uses a masked conic-gradient on a ::before pseudo-
      // element so the mask affects ONLY the gradient — the logo is a
      // separate un-masked child. Geometry mirrors the single widget,
      // scaled to this widget's 52px logo: outer 60.5px (radius 30.25),
      // gradient ring 30.25->28.25 (2px), gap 28.25->26 (2.25px), logo 52px.
      ".rvc-logo{width:52px;height:52px;border-radius:50%;border:2px solid var(--rvc-logo-ring,var(--rvc-accent));overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center}",
      ".rvc-logo.rvc-logo--grad{box-sizing:border-box;width:60.5px;height:60.5px;border:none;background:transparent;position:relative;overflow:visible}",
      ".rvc-logo.rvc-logo--grad::before{content:'';position:absolute;inset:0;border-radius:50%;background:var(--rvc-ring-grad);-webkit-mask:radial-gradient(circle, transparent 0 28.25px, #000 28.25px);mask:radial-gradient(circle, transparent 0 28.25px, #000 28.25px)}",
      ".rvc-logo.rvc-logo--grad .rvc-logo-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;z-index:1}",
      ".rvc-logo img{width:100%;height:100%;object-fit:cover}",
      ".rvc-timer{position:relative;width:52px;height:52px;flex-shrink:0}",
      ".rvc-timer svg{width:52px;height:52px;transform:rotate(-90deg)}",
      ".rvc-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".rvc-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".rvc-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;letter-spacing:-.01em;line-height:1}",
      ".rvc-bottom-bar{position:absolute;bottom:0;left:0;right:0;padding:40px 16px 26px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".rvc-title{color:#fff;font-size:16.5px;font-weight:600;line-height:1.35;letter-spacing:.01em;text-shadow:0 1px 4px rgba(0,0,0,.4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-left:4px;margin-right:20px}",
      ".rvc-speed-indicator{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#fff;font-size:15px;font-weight:700;letter-spacing:.04em;padding:7px 14px;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);z-index:16;pointer-events:none;opacity:0;transition:opacity .15s}",
      ".rvc-speed-indicator.visible{opacity:1}",
      ".rvc-progress{position:absolute;bottom:0;left:0;right:0;height:20px;background:transparent;z-index:20;cursor:pointer;opacity:0;transition:opacity 1s;border-radius:0 0 20px 20px;display:flex;align-items:flex-end}",
      "@media(hover:hover){.rvc-card.is-active:hover .rvc-progress{opacity:1}}",
      ".rvc-progress.dragging{opacity:1!important}",
      ".rvc-progress.visible{opacity:1}",
      ".rvc-progress-track{position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,.25);border-radius:0 0 20px 20px;transition:height .15s;pointer-events:none}",
      ".rvc-progress:hover .rvc-progress-track,.rvc-progress.dragging .rvc-progress-track{height:9px}",
      ".rvc-progress-fill{position:absolute;bottom:0;left:0;height:6px;background:#fff;pointer-events:none;width:0%;transition:height .15s;border-radius:0 0 0 20px}",
      ".rvc-progress:hover .rvc-progress-fill,.rvc-progress.dragging .rvc-progress-fill{height:9px}",
      ".rvc-progress-thumb{position:absolute;bottom:-3.5px;width:13px;height:13px;background:#fff;border-radius:50%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .15s,bottom .15s;box-shadow:0 1px 4px rgba(0,0,0,.4)}",
      ".rvc-progress:hover .rvc-progress-thumb,.rvc-progress.dragging .rvc-progress-thumb{opacity:1;bottom:-2px}",
      ".rvc-mute-btn{position:absolute;bottom:58px;right:14px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;background:rgba(0,0,0,.45)!important;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25)!important;display:flex;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;opacity:0;padding:0!important;transition:opacity .25s}",
      ".rvc-mute-btn.visible{opacity:1}",
      ".rvc-mute-btn svg{width:15px;height:15px}",
      ".rvc-arrow{position:absolute;top:calc(var(--rvc-card-h)/2);transform:translateY(-50%);width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;border-radius:50%!important;background:#fff!important;border:none!important;box-shadow:0 3px 14px rgba(0,0,0,.13);cursor:pointer;align-items:center;justify-content:center;z-index:30;display:none;overflow:visible;transition:background .18s,transform .18s,box-shadow .18s}",
      ".rvc-arrow:hover{background:var(--rvc-accent)!important;transform:translateY(-50%) scale(1.1);box-shadow:0 6px 20px rgba(211,0,17,.3);color:#fff}",
      ".rvc-arrow:hover svg polyline{stroke:#fff}",
      ".rvc-arrow:disabled{opacity:.2;pointer-events:none;outline:none}",
      ".rvc-arrow:focus,.rvc-arrow:focus-visible{outline:none}",
      // Arrow positioning. The horizontal offset is computed in JS (see
      // layout()) and supplied as --rvc-arrow-offset: the distance from the
      // stage centre out to the arrow's outer edge, derived from the actual
      // card-fan layout math (translate distance + scaled half-width of the
      // outermost visible card, + a 15px gap + the 40px arrow). This makes
      // the arrows sit just outside the visible card fan at ANY container
      // width — a narrow side column or a full-width page. The fallback
      // 260px keeps the arrows sane if the variable is somehow unset.
      "@media(min-width:600px){.rvc-arrow{display:flex!important}.rvc-arrow--left{left:calc(50% - var(--rvc-arrow-offset,260px))!important}.rvc-arrow--right{right:calc(50% - var(--rvc-arrow-offset,260px))!important}}",
      ".rvc-dots{display:flex;justify-content:center;gap:8.5px;margin-top:18px}",
      ".rvc-dot{width:8.5px!important;height:8.5px!important;min-width:8.5px!important;min-height:8.5px!important;border-radius:50%!important;background:#ccc;border:none!important;cursor:pointer;padding:0!important;transition:background .25s,transform .25s}",
      ".rvc-dot.is-active{background:var(--rvc-accent);transform:scale(1.35)}",
      "@media(max-width:767px){.rvc-widget{--rvc-card-h:65vh;--rvc-card-w:calc(65vh*9/16)}}",
      "@media(min-width:768px) and (pointer:coarse) and (hover:none){.rvc-widget{--rvc-card-h:65vh;--rvc-card-w:calc(65vh*9/16)}}",
      "@media(min-width:768px) and (any-pointer:fine){.rvc-widget{--rvc-card-w:316px;--rvc-card-h:min(559px,70vh)}}",
      "@media(min-width:900px) and (any-pointer:fine){.rvc-widget{--rvc-card-w:min(354px,calc(70vh*9/16));--rvc-card-h:min(627px,70vh)}}"
    ].join("");
    document.head.appendChild(style);
  }

  // ── Find container ──────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) {
    console.warn("Splshy: no element found with id '" + containerId + "'");
    return;
  }

  // ── Build widget HTML ───────────────────────────────
  container.innerHTML =
    '<div class="rvc-widget">' +
      '<div style="position:relative;">' +
        '<div class="rvc-stage"></div>' +
        '<button class="rvc-arrow rvc-arrow--left" aria-label="Previous reel" style="outline:none;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;padding:0!important;display:none;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block!important;flex-shrink:0;">' +
            '<polyline points="10,2 2,10 10,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '</svg>' +
        '</button>' +
        '<button class="rvc-arrow rvc-arrow--right" aria-label="Next reel" style="outline:none;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;padding:0!important;display:none;">' +
          '<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style="display:block!important;flex-shrink:0;">' +
            '<polyline points="2,2 10,10 2,18" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="rvc-dots"></div>' +
    '</div>';

  var widget  = container.querySelector(".rvc-widget");
  var stage   = widget.querySelector(".rvc-stage");
  var prevBtn = widget.querySelector(".rvc-arrow--left");
  var nextBtn = widget.querySelector(".rvc-arrow--right");
  var dotsEl  = widget.querySelector(".rvc-dots");

  // Logo ring colour. A solid colour sets the dedicated --rvc-logo-ring
  // variable (used only by the logo border, so it doesn't affect the
  // arrows/dots which use --rvc-accent); the gradient is set as
  // --rvc-ring-grad and applied via the .rvc-logo--grad markup per card.
  if (ringIsGradient) widget.style.setProperty("--rvc-ring-grad", IG_RING);
  else widget.style.setProperty("--rvc-logo-ring", logoRing);

  var current     = Math.floor(reels.length / 2);
  var cardEls     = [];
  var dotEls      = [];
  var globalMuted = false;

  function formatTime(s) {
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function syncMuteIcon(btn, muted) {
    if (!btn) return;
    btn.querySelectorAll(".rvc-unmute-lines").forEach(function (el) { el.style.display = muted ? "none"  : "block"; });
    btn.querySelectorAll(".rvc-mute-x, .rvc-mute-x2").forEach(function (el) { el.style.display = muted ? "block" : "none"; });
  }

  // ── Build cards ─────────────────────────────────────
  reels.forEach(function (reel, i) {
    var card = document.createElement("div");
    card.className = "rvc-card is-far";

    var poster = document.createElement("div");
    poster.className = "rvc-poster";
    var ph = document.createElement("div");
    ph.className = "rvc-poster-placeholder";
    ph.setAttribute("data-idx", i % 5);
    poster.appendChild(ph);
    if (reel.posterUrl) {
      var img = document.createElement("img");
      img.src = reel.posterUrl; img.alt = reel.label || "";
      poster.appendChild(img);
    }
    card.appendChild(poster);

    var video = document.createElement("video");
    video.className = "rvc-video";
    video.src = reel.videoUrl;
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "metadata");
    if (reel.posterUrl) video.setAttribute("poster", reel.posterUrl);
    card.appendChild(video);

    // Top bar
    var resolvedLogo = reel.logoUrl || logoUrl || "";
    var logoContent = resolvedLogo
      ? '<img src="' + resolvedLogo + '" alt="logo">'
      : '<div style="width:100%;height:100%;background:#D30011;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">S</div>';
    // Gradient ring wraps the logo in an inner circle (the masked ::before
    // draws the ring); a solid ring uses the .rvc-logo border directly.
    var logoHTML = ringIsGradient
      ? '<div class="rvc-logo rvc-logo--grad"><div class="rvc-logo-inner">' + logoContent + '</div></div>'
      : '<div class="rvc-logo">' + logoContent + '</div>';
    var RING_C = (2 * Math.PI * 23).toFixed(2);
    card.insertAdjacentHTML("beforeend",
      '<div class="rvc-top-bar">' +
        '<a href="' + igUrl + '" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">' +
          logoHTML +
          '<div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:400;letter-spacing:0.03em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">' + followerCount + '</div>' +
        '</a>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">' +
          '<div class="rvc-timer">' +
            '<svg viewBox="0 0 52 52"><circle class="rvc-timer-bg" cx="26" cy="26" r="23"/><circle class="rvc-timer-ring" cx="26" cy="26" r="23" stroke-dasharray="' + RING_C + '" stroke-dashoffset="0"/></svg>' +
            '<div class="rvc-timer-text">--</div>' +
          '</div>' +
          '<div style="height:13px;"></div>' +
        '</div>' +
      '</div>'
    );

    card.insertAdjacentHTML("beforeend",
      '<div class="rvc-bottom-bar"><div class="rvc-title">' + (reel.label || "") + '</div></div>' +
      '<div class="rvc-play-btn" role="button" aria-label="Play video"><div class="rvc-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 2L16 10L2 18V2Z" fill="white"/></svg></div></div>' +
      '<div class="rvc-pause-indicator" aria-label="Paused"><div class="rvc-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>' +
      '<button class="rvc-mute-btn" aria-label="Toggle mute"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="rvc-unmute-lines" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="rvc-mute-x" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="rvc-mute-x2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>' +
      '<div class="rvc-speed-indicator">2x</div>' +
      '<div class="rvc-progress"><div class="rvc-progress-track"></div><div class="rvc-progress-fill"></div><div class="rvc-progress-thumb"></div></div>'
    );

    stage.appendChild(card);
    cardEls.push({ el: card, video: video });
    card.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // Timer
    var timerText = card.querySelector(".rvc-timer-text");
    var timerRing = card.querySelector(".rvc-timer-ring");
    var RING_C2 = 2 * Math.PI * 23;
    var videoDuration = 0;
    timerRing.style.strokeDasharray = RING_C2;
    timerRing.style.strokeDashoffset = 0;

    video.addEventListener("loadedmetadata", function () {
      videoDuration = video.duration;
      timerText.textContent = formatTime(videoDuration);
    });
    video.addEventListener("timeupdate", function () {
      if (!videoDuration) return;
      var progress = video.currentTime / videoDuration;
      timerRing.style.strokeDashoffset = RING_C2 * (1 - progress);
      timerText.textContent = formatTime(Math.max(0, videoDuration - video.currentTime));
      var pf = card.querySelector(".rvc-progress-fill"), pt = card.querySelector(".rvc-progress-thumb");
      if (pf) pf.style.width = (progress * 100) + "%";
      if (pt) pt.style.left  = (progress * 100) + "%";
    });
    video.addEventListener("ended", function () {
      timerRing.style.strokeDashoffset = 0;
      timerText.textContent = formatTime(videoDuration);
      var pb = card.querySelector(".rvc-play-btn"), mb = card.querySelector(".rvc-mute-btn"), pi = card.querySelector(".rvc-pause-indicator");
      if (pb) pb.classList.remove("hidden"); if (mb) mb.classList.remove("visible"); if (pi) pi.classList.remove("visible");
      var pg = card.querySelector(".rvc-progress"); if (pg) pg.classList.remove("visible");
      video.style.display = "none"; poster.style.display = "";
    });

    // Play
    var playBtn = card.querySelector(".rvc-play-btn");
    var muteBtn = card.querySelector(".rvc-mute-btn");
    playBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      video.muted = globalMuted; video.style.display = "block"; poster.style.display = "none";
      playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
      syncMuteIcon(muteBtn, globalMuted); video.play();
    });
    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation(); globalMuted = !globalMuted;
      cardEls.forEach(function (c) { c.video.muted = globalMuted; syncMuteIcon(c.el.querySelector(".rvc-mute-btn"), globalMuted); });
    });

    // Progress
    var progressBar = card.querySelector(".rvc-progress");
    var isDragging = false;
    function getSeekPos(e) {
      var rect = progressBar.getBoundingClientRect();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      return Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    }
    function seekTo(pos) { if (videoDuration) video.currentTime = pos * videoDuration; }
    progressBar.addEventListener("mousedown",  function (e) { e.stopPropagation(); isDragging = true; progressBar.classList.add("dragging"); seekTo(getSeekPos(e)); });
    progressBar.addEventListener("click",      function (e) { e.stopPropagation(); });
    progressBar.addEventListener("touchstart", function (e) { e.stopPropagation(); isDragging = true; progressBar.classList.add("dragging"); seekTo(getSeekPos(e)); }, { passive: true });
    document.addEventListener("mousemove", function (e) { if (isDragging) seekTo(getSeekPos(e)); });
    document.addEventListener("touchmove", function (e) { if (isDragging) seekTo(getSeekPos(e)); }, { passive: true });
    document.addEventListener("mouseup",   function () { if (isDragging) { isDragging = false; progressBar.classList.remove("dragging"); } });
    document.addEventListener("touchend",  function () {
      if (isDragging) { isDragging = false; progressBar.classList.remove("dragging"); window._splshyScrubEnd = true; setTimeout(function () { window._splshyScrubEnd = false; }, 300); }
    });
    video.addEventListener("play", function () {
      if (window.matchMedia("(hover:none)").matches) {
        progressBar.classList.add("visible");
        clearTimeout(video._rvcFade);
        video._rvcFade = setTimeout(function () { if (!isDragging) progressBar.classList.remove("visible"); }, 7000);
      }
    });
    // On mobile, when the video is PAUSED mid-playback, show the scrub bar
    // and keep it visible — so the viewer can see how far along they are /
    // how much is left while paused. Mobile has no hover, so without this
    // the bar would just be hidden when paused. The pending 7s auto-hide
    // (video._rvcFade) is cancelled so the bar holds for as long as the
    // video stays paused; the next `play` re-arms the normal auto-hide. The
    // `!video.ended` guard skips this when the pause is the video finishing
    // — the `ended` handler clears the bar. Desktop is unaffected: it has
    // hover-to-reshow and this whole block is gated on (hover:none).
    video.addEventListener("pause", function () {
      if (video.ended) return;
      if (window.matchMedia("(hover:none)").matches) {
        clearTimeout(video._rvcFade);
        progressBar.classList.add("visible");
      }
    });

    // 2x hold
    var speedInd = card.querySelector(".rvc-speed-indicator");
    var holdTimer = null, isHolding = false, swallowNextClick = false;
    function startHold() {
      if (i !== current || video.style.display !== "block" || video.paused) return;
      holdTimer = setTimeout(function () { isHolding = true; if (!video.paused) { video.playbackRate = 2; if (speedInd) speedInd.classList.add("visible"); } }, 300);
    }
    function endHold() {
      clearTimeout(holdTimer);
      if (isHolding) { isHolding = false; swallowNextClick = true; video.playbackRate = 1; if (speedInd) speedInd.classList.remove("visible"); setTimeout(function () { swallowNextClick = false; }, 50); }
    }
    card.addEventListener("mousedown",   startHold);
    card.addEventListener("touchstart",  startHold, { passive: true });
    card.addEventListener("mouseup",     endHold);
    card.addEventListener("mouseleave",  endHold);
    card.addEventListener("touchend",    endHold);
    card.addEventListener("touchcancel", endHold);
    card.addEventListener("click", function (e) {
      if (e.target.closest(".rvc-play-btn") || e.target.closest(".rvc-mute-btn")) return;
      if (swallowNextClick) { swallowNextClick = false; return; }
      if (i !== current) { goTo(i); return; }
      if (video.style.display === "block") {
        var pi = card.querySelector(".rvc-pause-indicator");
        if (video.paused) { video.play(); if (pi) pi.classList.remove("visible"); }
        else { video.pause(); if (pi) pi.classList.add("visible"); }
      }
    });

    // Dot
    var dot = document.createElement("button");
    dot.className = "rvc-dot";
    dot.setAttribute("aria-label", "Reel " + (i + 1));
    dot.addEventListener("click", function () { goTo(i); });
    dotsEl.appendChild(dot);
    dotEls.push(dot);
  });

  // ── Layout ──────────────────────────────────────────
  function layout() {
    var cardW = cardEls[0] ? cardEls[0].el.offsetWidth : 220;
    var mob = window.matchMedia("(max-width:767px),(pointer:coarse) and (hover:none)").matches;
    var ss = mob ? 0.635 : 0.69, fs = mob ? 0.515 : 0.56, so = Math.round(cardW * 0.68);
    cardEls.forEach(function (c, i) {
      var el = c.el, rel = i - current;
      el.classList.remove("is-active","is-prev","is-next","is-far");
      if      (rel ===  0) { el.classList.add("is-active"); el.style.transform = "translateX(0px) scale(1)"; el.style.zIndex = "10"; }
      else if (rel === -1) { el.classList.add("is-prev");   el.style.transform = "translateX(-" + so + "px) scale(" + ss + ")"; el.style.zIndex = "5"; }
      else if (rel ===  1) { el.classList.add("is-next");   el.style.transform = "translateX(" + so + "px) scale(" + ss + ")"; el.style.zIndex = "5"; }
      else { el.classList.add("is-far"); var d = rel < 0 ? -1 : 1; el.style.transform = "translateX(" + (d * so * 1.55) + "px) scale(" + fs + ")"; el.style.zIndex = String(Math.max(1, 4 - Math.abs(rel))); }
    });
    dotEls.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === reels.length - 1;

    // Position the navigation arrows just OUTSIDE the visible card fan.
    // The fan's outer edge is derived from the SAME layout math used to
    // place the cards above — so the arrows always sit correctly however
    // wide the widget's container is (a narrow side column or full width).
    //
    // A side card is translated from the stage centre and then scaled about
    // its own centre, so its visible outer edge (distance from stage centre)
    // is:  translate distance + (cardW * scale / 2).
    //  • is-prev / is-next card:  so          + cardW*ss/2
    //  • is-far card:             so*1.55     + cardW*fs/2
    // A far card is only actually visible when there are >= 4 reels (centre
    // + one each side fills 3; far cards appear beyond that), so the far
    // edge is only considered then. The arrows clear whichever card sticks
    // out furthest, plus a 15px gap, plus the arrow's own 40px width.
    var ARROW_W = 40, GAP = 15;
    var nextEdge = so + (cardW * ss) / 2;
    var fanEdge  = nextEdge;
    if (reels.length >= 4) {
      var farEdge = (so * 1.55) + (cardW * fs) / 2;
      if (farEdge > fanEdge) fanEdge = farEdge;
    }
    // Distance from the stage's horizontal centre (50%) to the arrow's
    // outer side. The arrows are positioned via a CSS custom property so a
    // plain value cleanly overrides the stylesheet rule (which now reads
    // this variable) without needing inline !important.
    var arrowOffset = fanEdge + GAP + ARROW_W;
    // CLAMP. The CSS places each arrow at `left/right: calc(50% - offset)`,
    // resolved against the relative wrapper. If `offset` exceeds the
    // wrapper's half-width, `calc()` goes negative and the arrow is flung
    // OUTSIDE the container — which is exactly what happened when the
    // widget was dropped into a narrow ~430px Simpleview sidebar column:
    // the visible card fan is wider than the column, so the math-derived
    // offset (~412px) was larger than half the wrapper (~215px), giving
    // left:-197px. So we cap the offset so the arrow's outer edge can never
    // sit closer than EDGE_MARGIN to the container edge. When there's room
    // (a wide page) the cap never bites and the arrows sit just outside the
    // fan as intended; in a narrow column the arrows pin neatly to the
    // container edge instead of escaping. (The fan itself still overflows a
    // very narrow column — that is a separate sizing matter — but the
    // arrows now always stay put.)
    var EDGE_MARGIN = 4;
    var wrapper = prevBtn.parentElement;
    var wrapW = wrapper ? wrapper.offsetWidth : 0;
    if (wrapW > 0) {
      var maxOffset = wrapW / 2 - EDGE_MARGIN;
      if (arrowOffset > maxOffset) arrowOffset = maxOffset;
    }
    widget.style.setProperty("--rvc-arrow-offset", arrowOffset + "px");
  }


  // ── Navigation ──────────────────────────────────────
  var activeFade = null;
  function resetCard(c) {
    c.video.pause(); c.video.currentTime = 0; c.video.playbackRate = 1; c.video.volume = 1; c.video.style.display = "none";
    var f = c.el.querySelector(".rvc-progress-fill"), t = c.el.querySelector(".rvc-progress-thumb");
    if (f) f.style.width = "0%"; if (t) t.style.left = "0%";
    c.el.querySelector(".rvc-poster").style.display = "";
    c.el.querySelector(".rvc-play-btn").classList.remove("hidden");
    c.el.querySelector(".rvc-mute-btn").classList.remove("visible");
    var p = c.el.querySelector(".rvc-pause-indicator"); if (p) p.classList.remove("visible");
    var r = c.el.querySelector(".rvc-timer-ring"); if (r) r.style.strokeDashoffset = 0;
    var tx = c.el.querySelector(".rvc-timer-text"); if (tx && c.video.duration) tx.textContent = formatTime(c.video.duration);
    var pg = c.el.querySelector(".rvc-progress"); if (pg) pg.classList.remove("visible");
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
  function goTo(index) {
    if (index < 0 || index >= reels.length || index === current) return;
    if (activeFade) { clearInterval(activeFade); activeFade = null; }
    cardEls.forEach(function (c) { if (!c.video.paused) resetCard(c); });
    var outgoing = cardEls[current]; current = index; layout(); fadeOutAndReset(outgoing);
  }

  prevBtn.addEventListener("click", function () { goTo(current - 1); });
  nextBtn.addEventListener("click", function () { goTo(current + 1); });

  var txStart = 0, txStartY = 0;
  stage.addEventListener("touchstart", function (e) { txStart = e.touches[0].clientX; txStartY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend",   function (e) {
    if (window._splshyScrubEnd) return;
    var dx = e.changedTouches[0].clientX - txStart, dy = Math.abs(e.changedTouches[0].clientY - txStartY);
    if (Math.abs(dx) > 38 && Math.abs(dx) > dy) goTo(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  var msStart = null, msDrag = false;
  stage.addEventListener("mousedown",  function (e) { if (e.target.closest(".rvc-arrow") || e.target.closest(".rvc-progress")) return; msStart = e.clientX; msDrag = false; });
  stage.addEventListener("mousemove",  function (e) { if (msStart === null) return; if (Math.abs(e.clientX - msStart) > 8) msDrag = true; });
  stage.addEventListener("mouseup",    function (e) { if (msStart === null) return; var dx = e.clientX - msStart; msStart = null; if (msDrag && Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1)); msDrag = false; });
  stage.addEventListener("mouseleave", function () { msStart = null; msDrag = false; });

  document.addEventListener("keydown", function (e) {
    // With multiple carousels on a page, only the hovered one responds.
    if (!widget.matches(":hover")) return;
    if (e.key === "ArrowLeft")  goTo(current - 1);
    if (e.key === "ArrowRight") goTo(current + 1);
  });

  layout();
  window.addEventListener("resize", layout);

  } // end initWidget

  // ── Multi-instance bootstrap ─────────────────────────
  // Process every queued config. Each embed does:
  //   (window.SPLSHY_REELS_QUEUE = window.SPLSHY_REELS_QUEUE || []).push(cfg)
  // We replace the queue's push with one that initialises immediately, so
  // configs added before OR after this script loads are all handled.
  function processQueue() {
    var q = window.SPLSHY_REELS_QUEUE;
    if (q && q.length) {
      // Drain any configs queued before the script loaded.
      while (q.length) { initWidget(q.shift()); }
    }
    // Replace the array with a live object whose push() inits on the spot,
    // so embeds appearing later on the page still work.
    window.SPLSHY_REELS_QUEUE = {
      push: function (cfg) { initWidget(cfg); }
    };
  }

  // Backward compatibility: honour a single legacy global config.
  if (window.SPLSHY_REELS && window.SPLSHY_REELS.reels) {
    initWidget(window.SPLSHY_REELS);
  }

  processQueue();

})();
