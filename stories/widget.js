(function () {

  /* ====================================================
     Splshy Story Highlights
     splshy.com/stories/widget.js

     A row of circular highlight thumbnails. Tapping one opens a
     fullscreen overlay that plays the video and auto-advances to
     the next (looping back to the first after the last). Supports
     swipe / arrow navigation inside the overlay.

     Multi-instance: each embed pushes its config to
     window.SPLSHY_STORIES_QUEUE.
  ==================================================== */

  function initWidget(cfg) {

  cfg               = cfg || {};
  var reels         = cfg.reels         || [];
  var followerCount = cfg.followerCount || "";
  var igUrl         = cfg.igUrl         || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl       || "";
  var containerId   = cfg.containerId   || "splshy-stories";
  var ringColor     = cfg.ringColor     || "#D30011";   // default ring colour
  var GAP_MS        = 1000;                              // gap between videos

  if (!reels.length) { console.warn("Splshy Stories: no reels configured."); return; }
  var n = reels.length;

  // ── GA4 / analytics tracking ─────────────────────────
  // Fires an event to whichever analytics the host page uses — gtag (GA4
  // direct) or dataLayer (Google Tag Manager). If neither exists, it does
  // nothing, so the widget never errors on a page without analytics.
  function track(eventName, params){
    try {
      var data = params || {};
      data.widget_type     = "story_highlights";
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
  // Params describing a given reel, attached to video events.
  function reelParams(i){
    var r = reels[i] || {};
    return {
      reel_index: i,
      reel_label: r.label || "",
      reel_title: r.videoTitle || r.label || "",
      video_url:  r.videoUrl || ""
    };
  }

  function mod(x,m){ return ((x%m)+m)%m; }
  function fmtTime(s){ var m=Math.floor(s/60),sec=Math.floor(s%60); return m+":"+(sec<10?"0":"")+sec; }
  // True on phones / small touch screens — drives the simpler pop animation.
  function isMobileLayout(){
    return window.matchMedia("(max-width:767px), (min-width:768px) and (pointer:coarse) and (hover:none)").matches;
  }

  // ── CSS (injected once) ─────────────────────────────
  if (!document.querySelector("style[data-splshy-stories]")) {
    var style = document.createElement("style");
    style.setAttribute("data-splshy-stories","1");
    style.textContent = [
      // Circles row
      ".sst-widget{font-family:'Avenir','Avenir Next','Helvetica Neue',sans-serif;width:100%;user-select:none;padding:18px 0}",
      ".sst-row{display:flex;flex-direction:row;align-items:flex-start;justify-content:center;gap:30px;overflow-x:auto;padding:6px 16px;-webkit-overflow-scrolling:touch;scrollbar-width:none}",
      ".sst-row::-webkit-scrollbar{display:none}",
      ".sst-item{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:12px;cursor:pointer;width:168px}",
      ".sst-ring{position:relative;width:168px!important;height:168px!important;border-radius:50%;padding:5px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transition:transform .3s cubic-bezier(.34,1.4,.5,1)}",
      // Hover shimmer: a conic-gradient overlay with one bright arc that
      // rotates once around the ring. Desktop hover only; sits over the
      // coloured ring band but under the photo (.sst-ring-inner).
      ".sst-ring::before{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,transparent 300deg,rgba(255,255,255,.9) 340deg,transparent 360deg);opacity:0;transform:rotate(0deg);pointer-events:none;z-index:1}",
      // Shimmer plays once via the .sst-shimmer class (JS-controlled).
      ".sst-item.sst-shimmer .sst-ring::before{opacity:1;transform:rotate(396deg);transition:transform 1.1s ease-in-out,opacity .12s ease}",
      // Enlarged size holds for as long as the cursor is on the circle.
      "@media(hover:hover){.sst-item:hover .sst-ring{transform:scale(1.06)}}",
      ".sst-ring-inner{position:relative;z-index:2;width:100%;height:100%;border-radius:50%;border:4px solid #fff;overflow:hidden;background:#1a1a1a}",
      ".sst-ring-inner img{width:100%;height:100%;object-fit:cover;display:block}",
      ".sst-label{font-size:15px;font-weight:600;color:#222;text-align:center;line-height:1.25;max-width:168px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
      "@media(max-width:767px){.sst-row{justify-content:flex-start}}",

      // Overlay — a flex row: [left arrow] [stage] [right arrow]
      ".sst-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;gap:18px;opacity:0;transition:opacity .2s}",
      ".sst-overlay.open{display:flex;opacity:1}",
      ".sst-stagebox{position:relative}",
      ".sst-stage{position:relative;height:75vh;max-height:75vh;aspect-ratio:9/16;border-radius:18px;overflow:hidden;background:#000;-webkit-mask-image:-webkit-radial-gradient(white,black);transform-origin:center center}",
      ".sst-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;pointer-events:none;-webkit-touch-callout:none}",
      // Round buttons — !important on dimensions so host CSS can't squash them
      ".sst-close{position:absolute!important;top:-6px;right:-58px;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;max-width:44px!important;max-height:44px!important;border-radius:50%!important;background:rgba(255,255,255,.14)!important;border:1.5px solid rgba(255,255,255,.4)!important;color:#fff!important;font-size:22px;line-height:1;cursor:pointer;padding:0!important;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;box-sizing:border-box}",
      ".sst-close:hover{background:rgba(255,255,255,.28)!important}",

      // Chrome inside the stage (mirrors the card chrome)
      ".sst-top{position:absolute;top:0;left:0;right:0;padding:20px 18px 38px;background:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,transparent 100%);display:flex;align-items:flex-start;justify-content:space-between;z-index:13;pointer-events:none}",
      ".sst-top a{pointer-events:auto}",
      ".sst-logo{width:50px;height:50px;border-radius:50%;border:2px solid #fff;overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center}",
      ".sst-logo img{width:100%;height:100%;object-fit:cover}",
      ".sst-foll{color:rgba(255,255,255,.8);font-size:10px;font-weight:400;letter-spacing:.03em;text-shadow:0 1px 3px rgba(0,0,0,.5);margin-top:4px;text-align:center}",
      ".sst-timer{position:relative;width:50px;height:50px;flex-shrink:0}",
      ".sst-timer svg{width:50px;height:50px;transform:rotate(-90deg)}",
      ".sst-timer-bg{fill:none;stroke:rgba(255,255,255,.22);stroke-width:2.5}",
      ".sst-timer-ring{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset .25s linear}",
      ".sst-timer-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}",
      ".sst-bottom{position:absolute;bottom:0;left:0;right:0;padding:40px 18px 24px;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);z-index:13;pointer-events:none}",
      ".sst-title{color:#fff;font-size:16.5px;font-weight:600;line-height:1.35;letter-spacing:.01em;text-shadow:0 1px 4px rgba(0,0,0,.4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      ".sst-pause-ind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;pointer-events:none;opacity:0}",
      ".sst-pause-ind.visible{opacity:1}",
      ".sst-play-circle{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center}",
      ".sst-mute-btn{position:absolute;bottom:54px;right:14px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;z-index:14;cursor:pointer;pointer-events:auto;padding:0;-webkit-tap-highlight-color:transparent}",
      ".sst-mute-btn svg{width:16px;height:16px}",
      ".sst-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);color:#fff;font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.3);z-index:16;pointer-events:none;opacity:0;transition:opacity .15s;box-sizing:border-box}",
      ".sst-speed.visible{opacity:1}",
      // Progress bar
      ".sst-progress{position:absolute;bottom:0;left:0;right:0;height:20px;z-index:20;cursor:pointer;display:flex;align-items:flex-end}",
      ".sst-progress-track{position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,.25);pointer-events:none}",
      ".sst-progress-fill{position:absolute;bottom:0;left:0;height:6px;background:#fff;pointer-events:none;width:0%}",
      ".sst-progress-thumb{position:absolute;bottom:-3px;width:13px;height:13px;background:#fff;border-radius:50%;transform:translateX(-50%);pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.4)}",
      // Overlay arrows — in-flow flex items beside the stage; forced circles
      ".sst-arrow{flex:0 0 auto;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;max-width:48px!important;max-height:48px!important;border-radius:50%!important;background:rgba(255,255,255,.14)!important;border:1.5px solid rgba(255,255,255,.4)!important;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0!important;-webkit-tap-highlight-color:transparent;box-sizing:border-box}",
      ".sst-arrow:hover{background:rgba(255,255,255,.28)!important}",
      "@media(max-width:767px){.sst-overlay{gap:0}.sst-stage{height:80vh!important;max-height:80vh!important;width:auto!important;max-width:92vw;aspect-ratio:9/16;border-radius:16px}.sst-stagebox{max-width:92vw}.sst-arrow{position:absolute!important;top:50%;transform:translateY(-50%);width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;max-width:40px!important;max-height:40px!important;background:rgba(0,0,0,.4)!important;z-index:5}.sst-arrow--left{left:6px}.sst-arrow--right{right:6px}.sst-close{position:absolute!important;top:-52px;right:0;left:auto}}"
    ].join("");
    document.head.appendChild(style);
  }

  // ── Container ───────────────────────────────────────
  var container = document.getElementById(containerId);
  if (!container) { console.warn("Splshy Stories: no element '"+containerId+"'"); return; }

  var globalMuted = false;
  var userUnmuted = false;   // true once the user explicitly unmutes

  // ── Build the circles row ───────────────────────────
  var widget = document.createElement("div");
  widget.className = "sst-widget";
  var row = document.createElement("div");
  row.className = "sst-row";
  widget.appendChild(row);

  reels.forEach(function(reel, i){
    var item = document.createElement("div");
    item.className = "sst-item";
    var ring = document.createElement("div");
    ring.className = "sst-ring";
    ring.style.background = reel.ringColor || ringColor;
    var inner = document.createElement("div");
    inner.className = "sst-ring-inner";
    if (reel.posterUrl){
      var img = document.createElement("img");
      img.src = reel.posterUrl; img.alt = reel.label || "";
      inner.appendChild(img);
    }
    ring.appendChild(inner);
    item.appendChild(ring);
    if (reel.label){
      var lbl = document.createElement("div");
      lbl.className = "sst-label";
      lbl.textContent = reel.label;
      item.appendChild(lbl);
    }
    item.addEventListener("click", function(){
      track("story_open", reelParams(i));
      pressAndOpen(i, ring);
    });
    // Hover plays the shimmer ONCE (1.1s). If the cursor leaves before it
    // finishes, the shimmer is cancelled immediately. The scale-up is pure
    // CSS :hover, so it simply holds while hovering.
    var shimmerTimer = null;
    item.addEventListener("mouseenter", function(){
      if (item.classList.contains("sst-shimmer")) return;  // mid-play, ignore
      item.classList.add("sst-shimmer");
      if (shimmerTimer) clearTimeout(shimmerTimer);
      shimmerTimer = setTimeout(function(){
        item.classList.remove("sst-shimmer");
      }, 1120);
    });
    item.addEventListener("mouseleave", function(){
      if (shimmerTimer){ clearTimeout(shimmerTimer); shimmerTimer = null; }
      item.classList.remove("sst-shimmer");   // cancel shimmer on leave
    });
    row.appendChild(item);
  });

  container.innerHTML = "";
  container.appendChild(widget);

  // On mobile, if the row of circles overflows the viewport, start the
  // scroll position centred so highlights peek on BOTH sides — making it
  // obvious the row scrolls. (No-op on desktop where they all fit centred.)
  function centreRowScroll(){
    if (row.scrollWidth > row.clientWidth){
      row.scrollLeft = (row.scrollWidth - row.clientWidth) / 2;
    }
  }
  centreRowScroll();
  // Re-centre once images have loaded (scrollWidth can change as they size in).
  setTimeout(centreRowScroll, 60);
  setTimeout(centreRowScroll, 300);

  // Fire a widget_impression once the widget actually scrolls into view.
  if (typeof IntersectionObserver === "function"){
    var seen = false;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting && !seen){
          seen = true;
          track("widget_impression", { reel_count: n });
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(widget);
  } else {
    track("widget_impression", { reel_count: n });
  }

  // ── Build the overlay (one per widget instance) ─────
  var resolvedLogo = logoUrl
    ? '<img src="'+logoUrl+'" alt="logo">'
    : '<div style="width:100%;height:100%;background:'+ringColor+';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">S</div>';
  var RC = (2*Math.PI*23).toFixed(2);

  var overlay = document.createElement("div");
  overlay.className = "sst-overlay";
  overlay.innerHTML =
    '<button class="sst-arrow sst-arrow--left" aria-label="Previous">' +
      '<svg width="12" height="20" viewBox="0 0 12 20" fill="none"><polyline points="10,2 2,10 10,18" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
    '</button>' +
    '<div class="sst-stagebox">' +
      '<button class="sst-close" aria-label="Close">&times;</button>' +
      '<div class="sst-stage">' +
        '<video class="sst-video" playsinline webkit-playsinline muted preload="auto"></video>' +
        '<div class="sst-top">' +
          '<a href="'+igUrl+'" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;">' +
            '<div class="sst-logo">'+resolvedLogo+'</div>' +
            '<div class="sst-foll">'+followerCount+'</div>' +
          '</a>' +
          '<div class="sst-timer"><svg viewBox="0 0 52 52"><circle class="sst-timer-bg" cx="26" cy="26" r="23"/><circle class="sst-timer-ring" cx="26" cy="26" r="23" stroke-dasharray="'+RC+'" stroke-dashoffset="0"/></svg><div class="sst-timer-text">--</div></div>' +
        '</div>' +
        '<div class="sst-bottom"><div class="sst-title"></div></div>' +
        '<div class="sst-pause-ind"><div class="sst-play-circle"><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><rect x="4" y="2" width="4" height="16" rx="1.5" fill="white"/><rect x="10" y="2" width="4" height="16" rx="1.5" fill="white"/></svg></div></div>' +
        '<div class="sst-speed">2&times;</div>' +
        '<button class="sst-mute-btn"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="sst-unmute" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/><line class="sst-mx1" x1="23" y1="9" x2="17" y2="15" style="display:none"/><line class="sst-mx2" x1="17" y1="9" x2="23" y2="15" style="display:none"/></svg></button>' +
        '<div class="sst-progress"><div class="sst-progress-track"></div><div class="sst-progress-fill"></div><div class="sst-progress-thumb"></div></div>' +
      '</div>' +
    '</div>' +
    '<button class="sst-arrow sst-arrow--right" aria-label="Next">' +
      '<svg width="12" height="20" viewBox="0 0 12 20" fill="none"><polyline points="2,2 10,10 2,18" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
    '</button>';
  document.body.appendChild(overlay);

  var video    = overlay.querySelector(".sst-video");
  var stage    = overlay.querySelector(".sst-stage");
  var titleEl  = overlay.querySelector(".sst-title");
  var ringEl   = overlay.querySelector(".sst-timer-ring");
  var timerTx  = overlay.querySelector(".sst-timer-text");
  var pauseInd = overlay.querySelector(".sst-pause-ind");
  var speedEl  = overlay.querySelector(".sst-speed");
  var muteBtn  = overlay.querySelector(".sst-mute-btn");
  var progBar  = overlay.querySelector(".sst-progress");
  var progFill = overlay.querySelector(".sst-progress-fill");
  var progThumb= overlay.querySelector(".sst-progress-thumb");
  var RC2 = 2*Math.PI*23;
  ringEl.style.strokeDasharray = RC2;

  var cur = 0;        // current reel index in the overlay
  var gapTimer = null;
  var playFired = false;      // video_play fired for the current reel?
  var progressFired = false;  // video_progress (50%) fired for the current reel?

  function syncMuteIcon(){
    muteBtn.querySelectorAll(".sst-unmute").forEach(function(el){ el.style.display=globalMuted?"none":"block"; });
    muteBtn.querySelectorAll(".sst-mx1,.sst-mx2").forEach(function(el){ el.style.display=globalMuted?"block":"none"; });
  }

  // Load + play the reel at index i.
  function playIndex(i){
    if (gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
    cur = mod(i, n);
    playFired = false; progressFired = false;   // reset tracking for the new reel
    var reel = reels[cur];
    titleEl.textContent = reel.videoTitle || reel.label || "";
    progFill.style.width = "0%"; progThumb.style.left = "0%";
    ringEl.style.strokeDashoffset = 0;
    timerTx.textContent = "--";
    pauseInd.classList.remove("visible");
    if (speedEl) speedEl.classList.remove("visible");
    video.playbackRate = 1;

    // Mobile browsers block autoplay WITH sound — so on mobile we must start
    // muted or the video never starts (it just sits on the poster showing the
    // native play button). Desktop can usually start with sound after the tap.
    if (isMobileLayout() && !userUnmuted) globalMuted = true;
    video.muted = globalMuted;
    syncMuteIcon();

    if (reel.posterUrl) video.setAttribute("poster", reel.posterUrl);
    video.src = reel.videoUrl;
    video.load();

    function tryPlay(){
      var p = video.play();
      if (p && p.catch) p.catch(function(){
        // Still blocked — force muted and try once more.
        video.muted = true; globalMuted = true; syncMuteIcon();
        var p2 = video.play(); if (p2 && p2.catch) p2.catch(function(){});
      });
    }
    // Play as soon as there's enough data; also try immediately in case it's
    // already buffered (e.g. navigating between reels).
    if (video.readyState >= 2){ tryPlay(); }
    else {
      var once = function(){ video.removeEventListener("loadeddata", once); tryPlay(); };
      video.addEventListener("loadeddata", once);
    }
  }

  // Video failed to load. Keep the poster visible (don't show a broken
  // player) and skip to the next reel so the widget never gets stuck.
  function handleVideoError(){
    track("video_error", reelParams(cur));
    if (gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
    // Brief pause on the poster, then move on (unless it was the only reel).
    if (n > 1){
      gapTimer = setTimeout(function(){ next(); }, 1200);
    }
  }
  video.addEventListener("error", handleVideoError);

  // Remembers which ring the overlay popped out of, so closing can pop back.
  var originRing = null;
  function popMs(){ return isMobileLayout() ? 529 : 620; }

  // The chrome elements that stagger in after the stage pops out.
  var chromeEls = [
    overlay.querySelector(".sst-top"),
    overlay.querySelector(".sst-bottom"),
    overlay.querySelector(".sst-progress")
  ];

  // Geometry mapping the stage onto a ring: the translate that moves the
  // stage centre onto the circle, and the scale factors.
  function ringGeometry(ring){
    var s = stage.getBoundingClientRect();
    var r = ring.getBoundingClientRect();
    if (!s.width || !r.width) return null;
    return {
      tx: (r.left + r.width/2)  - (s.left + s.width/2),
      ty: (r.top  + r.height/2) - (s.top  + s.height/2),
      sx: r.width  / s.width,
      sy: r.height / s.height
    };
  }

  // Pop keyframes: the stage TRAVELS from the circle up to centre while it
  // grows uniformly. The travel is what makes it read as real motion.
  if (!document.querySelector("style[data-splshy-stories-genie]")){
    var gStyle = document.createElement("style");
    gStyle.setAttribute("data-splshy-stories-genie","1");
    gStyle.textContent =
      "@keyframes sstPopInSimple{" +
        "0%{transform:translate(var(--sst-tx),var(--sst-ty)) scale(var(--sst-sx),var(--sst-sy))}" +
        "100%{transform:translate(0,0) scale(1,1)}" +
      "}" +
      "@keyframes sstPopOutSimple{" +
        "0%{transform:translate(0,0) scale(1,1)}" +
        "100%{transform:translate(var(--sst-tx),var(--sst-ty)) scale(var(--sst-sx),var(--sst-sy))}" +
      "}";
    document.head.appendChild(gStyle);
  }

  // Show / hide the chrome (logo bar, title, progress) with a small slide.
  function setChrome(on, instant){
    chromeEls.forEach(function(el){
      if (!el) return;
      el.style.transition = instant ? "none" : "opacity .28s ease, transform .28s ease";
      el.style.opacity = on ? "1" : "0";
      var fromBelow = el.classList.contains("sst-bottom") || el.classList.contains("sst-progress");
      el.style.transform = on ? "translateY(0)" : ("translateY(" + (fromBelow ? "10px" : "-6px") + ")");
    });
  }

  // Press-bounce: tap the circle → it contracts, springs back, THEN the
  // player pops out of it. ~0.3s of anticipation before openOverlay runs.
  var pressBusy = false;
  function pressAndOpen(i, ring){
    if (pressBusy) return;
    pressBusy = true;
    ring.style.transition = "transform .12s cubic-bezier(.4,0,.4,1)";
    ring.style.transform  = "scale(.82)";                 // contract
    setTimeout(function(){
      ring.style.transition = "transform .18s cubic-bezier(.34,1.55,.5,1)";
      ring.style.transform  = "scale(1)";                 // spring back (overshoots)
    }, 120);
    setTimeout(function(){
      pressBusy = false;
      openOverlay(i, ring);                               // now pop the player out
    }, 300);
  }

  function openOverlay(i, ring){
    originRing = ring || null;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    if (originRing) originRing.style.transform = "scale(.86)";   // ring dips
    setChrome(false, true);                                      // chrome hidden
    playIndex(i);

    var g = originRing ? ringGeometry(originRing) : null;
    if (g){
      var ms = popMs();
      // Clean pop: travel from the circle to centre with a uniform scale.
      // Desktop ease has a slight overshoot; mobile is a plain ease-out.
      var ease = isMobileLayout() ? "cubic-bezier(.2,.7,.3,1)" : "cubic-bezier(.2,.8,.25,1.06)";
      stage.style.animation = "none";
      stage.style.transformOrigin = "center center";
      stage.style.setProperty("--sst-tx", g.tx + "px");
      stage.style.setProperty("--sst-ty", g.ty + "px");
      stage.style.setProperty("--sst-sx", g.sx);
      stage.style.setProperty("--sst-sy", g.sy);
      stage.style.transform = "translate(" + g.tx + "px," + g.ty + "px) scale(" + g.sx + "," + g.sy + ")";
      stage.offsetHeight; // force reflow
      stage.style.animation = "sstPopInSimple " + ms + "ms " + ease + " forwards";
      setTimeout(function(){ setChrome(true, false); }, ms * 0.52);
    } else {
      setChrome(true, true);
    }
  }

  function closeOverlay(){
    if (gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
    video.pause();

    function finishClose(){
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      stage.style.animation = "none";
      stage.style.transform  = "none";
      stage.style.transformOrigin = "";
      overlay.style.transition = "";
      overlay.style.opacity = "";
      if (originRing){ originRing.style.transform = ""; originRing.style.transition = ""; originRing = null; }
      setChrome(true, true);   // reset for next open
      video.removeAttribute("src");
      video.load();
    }

    // Chrome fades first, then the stage travels back into its ring.
    setChrome(false, false);
    var g = originRing ? ringGeometry(originRing) : null;
    if (g){
      var ms = popMs() - 90;
      var anim = "sstPopOutSimple";
      setTimeout(function(){
        stage.style.transformOrigin = "center center";
        stage.style.setProperty("--sst-tx", g.tx + "px");
        stage.style.setProperty("--sst-ty", g.ty + "px");
        stage.style.setProperty("--sst-sx", g.sx);
        stage.style.setProperty("--sst-sy", g.sy);
        stage.style.animation = anim + " " + ms + "ms cubic-bezier(.4,0,.25,1) forwards";
        overlay.style.transition = "opacity " + ms + "ms ease";
        overlay.style.opacity = "0";
        setTimeout(finishClose, ms);
      }, 90);
    } else {
      finishClose();
    }
  }

  function restagger(){
    setChrome(false, false);
    setTimeout(function(){ setChrome(true, false); }, 150);
  }
  function next(manual){
    if (manual) track("widget_navigate", { direction: "next", from_reel: cur });
    playIndex(cur + 1); restagger();
  }
  function prev(manual){
    if (manual) track("widget_navigate", { direction: "prev", from_reel: cur });
    playIndex(cur - 1); restagger();
  }

  // ── Video events ────────────────────────────────────
  video.addEventListener("loadedmetadata", function(){
    if (video.duration) timerTx.textContent = fmtTime(video.duration);
  });
  video.addEventListener("playing", function(){
    // video_play — fired once, the first time this reel actually plays.
    if (!playFired){ playFired = true; track("video_play", reelParams(cur)); }
  });
  video.addEventListener("timeupdate", function(){
    var d = video.duration; if (!d) return;
    var pct = video.currentTime / d;
    ringEl.style.strokeDashoffset = RC2 * (1 - pct);
    timerTx.textContent = fmtTime(Math.max(0, d - video.currentTime));
    progFill.style.width = (pct*100) + "%";
    progThumb.style.left = (pct*100) + "%";
    // video_progress — fired once when the reel passes the 50% mark.
    if (!progressFired && pct >= 0.5){
      progressFired = true;
      track("video_progress", reelParams(cur));
    }
  });
  video.addEventListener("ended", function(){
    track("video_complete", reelParams(cur));
    // Hold the final frame for the 1s gap, then auto-advance (loops).
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = setTimeout(function(){ next(); }, GAP_MS);
  });

  // ── Controls ────────────────────────────────────────
  overlay.querySelector(".sst-close").addEventListener("click", closeOverlay);
  overlay.querySelector(".sst-arrow--left").addEventListener("click", function(e){ e.stopPropagation(); prev(true); });
  overlay.querySelector(".sst-arrow--right").addEventListener("click", function(e){ e.stopPropagation(); next(true); });

  // Tap the backdrop (outside the stage) to close.
  overlay.addEventListener("click", function(e){
    if (e.target === overlay) closeOverlay();
  });

  // Tap the stage to pause / resume.
  var swallowTap = false;
  stage.addEventListener("click", function(e){
    if (e.target.closest(".sst-mute-btn") || e.target.closest(".sst-progress")) return;
    if (swallowTap){ swallowTap = false; return; }
    if (video.paused){
      if (gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
      video.play(); pauseInd.classList.remove("visible");
    } else {
      video.pause(); pauseInd.classList.add("visible");
    }
  });

  // Press-and-hold the stage to play at 2x speed; release to return to 1x.
  // A short hold delay means a quick tap still pauses normally.
  var holdTimer = null, holding = false;
  function holdStart(e){
    if (e.target.closest(".sst-mute-btn") || e.target.closest(".sst-progress")) return;
    holding = false;
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = setTimeout(function(){
      holding = true;
      if (!video.paused){
        video.playbackRate = 2;
        speedEl.classList.add("visible");
      }
    }, 280);
  }
  function holdEnd(){
    if (holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
    if (holding){
      video.playbackRate = 1;
      speedEl.classList.remove("visible");
      swallowTap = true;                       // don't let the hold also pause
      setTimeout(function(){ swallowTap = false; }, 50);
      holding = false;
    }
  }
  stage.addEventListener("mousedown", holdStart);
  stage.addEventListener("mouseup", holdEnd);
  stage.addEventListener("mouseleave", holdEnd);
  stage.addEventListener("touchstart", holdStart, {passive:true});
  stage.addEventListener("touchend", holdEnd);
  stage.addEventListener("touchcancel", holdEnd);

  muteBtn.addEventListener("click", function(e){
    e.stopPropagation();
    globalMuted = !globalMuted;
    if (!globalMuted) userUnmuted = true;   // user opted into sound
    video.muted = globalMuted;
    syncMuteIcon();
  });

  // Progress-bar scrubbing.
  var dragging = false;
  function pctFrom(e){
    var r = progBar.getBoundingClientRect();
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  }
  function seek(p){ if (video.duration) video.currentTime = p * video.duration; }
  progBar.addEventListener("click", function(e){ e.stopPropagation(); });
  progBar.addEventListener("mousedown", function(e){ e.stopPropagation(); dragging = true; seek(pctFrom(e)); });
  progBar.addEventListener("touchstart", function(e){ e.stopPropagation(); dragging = true; seek(pctFrom(e)); }, {passive:true});
  document.addEventListener("mousemove", function(e){ if (dragging) seek(pctFrom(e)); });
  document.addEventListener("touchmove", function(e){ if (dragging) seek(pctFrom(e)); }, {passive:true});
  document.addEventListener("mouseup", function(){ dragging = false; });
  document.addEventListener("touchend", function(){
    if (dragging){ dragging = false; swallowTap = true; setTimeout(function(){ swallowTap=false; }, 300); }
  });

  // Swipe left/right inside the overlay to change reel.
  var txS = 0, tyS = 0;
  stage.addEventListener("touchstart", function(e){
    txS = e.touches[0].clientX; tyS = e.touches[0].clientY;
  }, {passive:true});
  stage.addEventListener("touchend", function(e){
    if (dragging) return;
    var dx = e.changedTouches[0].clientX - txS;
    var dy = Math.abs(e.changedTouches[0].clientY - tyS);
    if (Math.abs(dx) > 45 && Math.abs(dx) > dy*1.4){
      swallowTap = true; setTimeout(function(){ swallowTap=false; }, 50);
      if (dx < 0) next(true); else prev(true);
    }
  }, {passive:true});

  // Keyboard: arrows navigate, Escape closes (only when overlay is open).
  document.addEventListener("keydown", function(e){
    if (!overlay.classList.contains("open")) return;
    if (e.key === "ArrowLeft")  prev(true);
    if (e.key === "ArrowRight") next(true);
    if (e.key === "Escape")     closeOverlay();
  });

  } // end initWidget

  // ── Multi-instance bootstrap ─────────────────────────
  function processQueue(){
    var q = window.SPLSHY_STORIES_QUEUE;
    if (q && q.length){ while (q.length){ initWidget(q.shift()); } }
    window.SPLSHY_STORIES_QUEUE = { push: function(cfg){ initWidget(cfg); } };
  }
  if (window.SPLSHY_STORIES && window.SPLSHY_STORIES.reels){
    initWidget(window.SPLSHY_STORIES);
  }
  processQueue();

})();
