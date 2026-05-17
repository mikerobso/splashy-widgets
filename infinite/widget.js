(function () {

  /* ====================================================
     Splshy Infinite Swipe Carousel
     splshy.com/infinite/widget.js
  ==================================================== */

  var cfg           = window.SPLSHY_INFINITE || {};
  var reels         = cfg.reels              || [];
  var followerCount = cfg.followerCount      || "";
  var igUrl         = cfg.igUrl             || "https://www.instagram.com/";
  var logoUrl       = cfg.logoUrl           || "";
  var containerId   = cfg.containerId       || "splshy-infinite";

  if (!reels.length) { console.warn("Splshy Infinite: no reels configured."); return; }

  var n = reels.length;

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
      /* Mobile: dim side cards */
      "@media(max-width:767px){.sif-card{transform:scale(0.66);filter:brightness(.5)}.sif-card.is-active{transform:scale(1)!important;filter:brightness(1)!important}.sif-widget{--sif-card-h:65vh;--sif-card-w:calc(65vh*9/16);--sif-gap:9px}.sif-viewport{width:100%}}",
      "@media(min-width:768px) and (pointer:coarse) and (hover:none){.sif-card{transform:scale(0.66);filter:brightness(.5)}.sif-card.is-active{transform:scale(1)!important;filter:brightness(1)!important}.sif-widget{--sif-card-h:65vh;--sif-card-w:calc(65vh*9/16);--sif-gap:9px}.sif-viewport{width:100%}}",
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
      ".sif-logo{width:52px;height:52px;border-radius:50%;border:2px solid var(--sif-accent);overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center}",
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
      ".sif-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.55);backdrop-filter:blur(4px);color:#fff;font-size:15px;font-weight:700;padding:7px 14px;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);z-index:16;pointer-events:none;opacity:0;transition:opacity .15s}",
      ".sif-speed.visible{opacity:1}",
      ".sif-progress{position:absolute;bottom:0;left:0;right:0;height:20px;background:transparent;z-index:20;cursor:pointer;opacity:0;transition:opacity 1s;border-radius:0 0 20px 20px;display:flex;align-items:flex-end}",
      "@media(hover:hover){.sif-card.is-active:hover .sif-progress{opacity:1}}",
      ".sif-progress.show{opacity:1!important}",
      ".sif-progress-track{position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,.25);border-radius:0 0 20px 20px;transition:height .15s;pointer-events:none}",
      ".sif-progress:hover .sif-progress-track,.sif-progress.show .sif-progress-track{height:9px}",
      ".sif-progress-fill{position:absolute;bottom:0;left:0;height:6px;background:#fff;pointer-events:none;width:0%;transition:height .15s;border-radius:0 0 0 20px}",
      ".sif-progress:hover .sif-progress-fill,.sif-progress.show .sif-progress-fill{height:9px}",
      ".sif-progress-thumb{position:absolute;bottom:-3.5px;width:13px;height:13px;background:#fff;border-radius:50%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .15s,bottom .15s;box-shadow:0 1px 4px rgba(0,0,0,.4)}",
      ".sif-progress:hover .sif-progress-thumb,.sif-progress.show .sif-progress-thumb{opacity:1;bottom:-2px}",
      ".sif-arrow{position:absolute;top:50%;transform:translateY(-50%);width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;border-radius:50%!important;background:#fff!important;border:none!important;box-shadow:0 3px 14px rgba(0,0,0,.13);cursor:pointer;display:none;align-items:center;justify-content:center;z-index:30;transition:background .18s,transform .18s,box-shadow .18s}",
      ".sif-arrow:hover{background:var(--sif-accent)!important;transform:translateY(-50%) scale(1.1);box-shadow:0 6px 20px rgba(211,0,17,.3)}",
      ".sif-arrow:hover svg polyline{stroke:#fff}",
      ".sif-arrow:focus,.sif-arrow:focus-visible{outline:none}",
      ".sif-arrow--left{left:-24px}",
      ".sif-arrow--right{right:-24px}",
      "@media(min-width:600px){.sif-arrow{display:flex!important}}",
      ".sif-dots{display:flex;justify-content:center;gap:8.5px;margin-top:18px}",
      ".sif-dot{width:8.5px!important;height:8.5px!important;min-width:8.5px!important;min-height:8.5px!important;border-radius:50%!important;background:#ccc;border:none!important;cursor:pointer;padding:0!important;transition:background .25s,transform .25s}",
      ".sif-dot.is-active{background:var(--sif-accent);transform:scale(1.35)}",
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
  var viewport = widget.querySelector(".sif-viewport");
  var track    = widget.querySelector(".sif-track");
  var prevBtn  = widget.querySelector(".sif-arrow--left");
  var nextBtn  = widget.querySelector(".sif-arrow--right");
  var dotsEl   = widget.querySelector(".sif-dots");

  var current     = 0;
  var globalMuted = false;
  var activeFade  = null;
  var busy        = false;

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

  for (var ri = 0; ri < n; ri++) {
    (function(reelIdx){
      var reel = reels[reelIdx];
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
      var logoInner = resolvedLogo
        ? '<img src="'+resolvedLogo+'" alt="logo">'
        : '<div style="width:100%;height:100%;background:#D30011;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">S</div>';
      var RC = (2*Math.PI*23).toFixed(2);

      card.insertAdjacentHTML("beforeend",
        '<div class="sif-top-bar">'+
          '<a href="'+igUrl+'" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;text-decoration:none;gap:5px;">'+
            '<div class="sif-logo">'+logoInner+'</div>'+
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
        '<div class="sif-speed">2x</div>'+
        '<div class="sif-progress"><div class="sif-progress-track"></div><div class="sif-progress-fill"></div><div class="sif-progress-thumb"></div></div>'
      );

      card.addEventListener("contextmenu",function(e){ e.preventDefault(); });

      var ring=card.querySelector(".sif-timer-ring");
      var timerText=card.querySelector(".sif-timer-text");
      var RC2=2*Math.PI*23;
      ring.style.strokeDasharray=RC2;
      var dur=0;

      video.addEventListener("loadedmetadata",function(){ dur=video.duration; timerText.textContent=fmtTime(dur); });
      video.addEventListener("timeupdate",function(){
        if (!dur) return;
        var pct=video.currentTime/dur;
        ring.style.strokeDashoffset=RC2*(1-pct);
        timerText.textContent=fmtTime(Math.max(0,dur-video.currentTime));
        var pf=card.querySelector(".sif-progress-fill"),pt=card.querySelector(".sif-progress-thumb");
        if (pf) pf.style.width=(pct*100)+"%";
        if (pt) pt.style.left=(pct*100)+"%";
      });
      video.addEventListener("ended",function(){
        ring.style.strokeDashoffset=0; timerText.textContent=fmtTime(dur);
        card.querySelector(".sif-play-btn").classList.remove("hidden");
        card.querySelector(".sif-mute-btn").classList.remove("visible");
        var pi=card.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
        video.style.display="none"; poster.style.display="";
      });

      var playBtn=card.querySelector(".sif-play-btn");
      var muteBtn=card.querySelector(".sif-mute-btn");
      playBtn.addEventListener("click",function(e){
        e.stopPropagation();
        cards.forEach(function(c){ if (c.video!==video) resetCard(c); });
        video.muted=globalMuted; video.style.display="block"; poster.style.display="none";
        playBtn.classList.add("hidden"); muteBtn.classList.add("visible");
        syncMuteIcon(muteBtn,globalMuted); video.play();
      });
      muteBtn.addEventListener("click",function(e){
        e.stopPropagation(); globalMuted=!globalMuted;
        cards.forEach(function(c){ c.video.muted=globalMuted; syncMuteIcon(c.el.querySelector(".sif-mute-btn"),globalMuted); });
      });

      var progBar=card.querySelector(".sif-progress");
      var dragging=false;
      function getPct(e){ var r=progBar.getBoundingClientRect(); return Math.max(0,Math.min(1,((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width)); }
      function seekTo(p){ if (dur) video.currentTime=p*dur; }
      progBar.addEventListener("click",function(e){ e.stopPropagation(); });
      progBar.addEventListener("mousedown",function(e){ e.stopPropagation(); dragging=true; progBar.classList.add("show"); seekTo(getPct(e)); });
      progBar.addEventListener("touchstart",function(e){ e.stopPropagation(); dragging=true; progBar.classList.add("show"); seekTo(getPct(e)); },{passive:true});
      document.addEventListener("mousemove",function(e){ if (dragging) seekTo(getPct(e)); });
      document.addEventListener("touchmove",function(e){ if (dragging) seekTo(getPct(e)); },{passive:true});
      document.addEventListener("mouseup",function(){ if (dragging){ dragging=false; progBar.classList.remove("show"); } });
      document.addEventListener("touchend",function(){
        if (dragging){ dragging=false; progBar.classList.remove("show"); window._sifSE=true; setTimeout(function(){ window._sifSE=false; },300); }
      });
      video.addEventListener("play",function(){
        progBar.classList.add("show");
        clearTimeout(video._sifFT);
        video._sifFT=setTimeout(function(){ if (!dragging) progBar.classList.remove("show"); },7000);
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
        if (e.target.closest(".sif-play-btn")||e.target.closest(".sif-mute-btn")||e.target.closest(".sif-progress")) return;
        if (swallow){ swallow=false; return; }
        if (video.style.display==="block"){
          var pi=card.querySelector(".sif-pause-ind");
          if (video.paused){ video.play(); if (pi) pi.classList.remove("visible"); }
          else { video.pause(); if (pi) pi.classList.add("visible"); }
        }
      });

      track.appendChild(card);
      cards.push({ el:card, video:video, poster:poster, reelIdx:reelIdx });

      var dot=document.createElement("button");
      dot.className="sif-dot";
      dot.setAttribute("aria-label","Reel "+(reelIdx+1));
      dot.addEventListener("click",function(){ navigate(reelIdx); });
      dotsEl.appendChild(dot);
      dots.push(dot);

    })(ri);
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
  //  ever change.
  // ════════════════════════════════════════════════════

  // Switch the track + cards to absolute positioning (overrides the flex CSS).
  track.style.position = "relative";
  track.style.display  = "block";
  track.style.height   = "100%";

  // One step = card width + the real gap between cards.
  // (The gap is the CSS var --sif-gap, which differs desktop vs mobile.)
  function getCardW(){
    return cards[0] ? cards[0].el.offsetWidth : 220;
  }
  function getGap(){
    var g = getComputedStyle(widget).getPropertyValue("--sif-gap");
    var v = parseFloat(g);
    return isNaN(v) ? 30 : v;
  }
  function getStep(){
    return getCardW() + getGap();
  }

  // Pixel offset that places a card's left edge so the card is centred
  // horizontally in the viewport — works for any viewport width.
  function centreOffset(){
    return (viewport.offsetWidth - getCardW()) / 2;
  }

  var centreSlot = 1;   // slot currently centred (start so cards[0] is centre)

  // Position one card according to its slot.
  function placeCard(c){
    c.el.style.position = "absolute";
    c.el.style.top      = "0";
    c.el.style.left     = (c.slot * getStep()) + "px";
  }

  // Place every card.
  function placeAll(){
    cards.forEach(placeCard);
  }

  // Move the track so `centreSlot`'s card is centred in the viewport.
  // A card at slot s has left = s*step; on-screen x = T + s*step.
  // Centred means  T + centreSlot*step = centreOffset()
  //            ->  T = centreOffset() - centreSlot*step
  function setTrack(animated){
    track.style.transition = animated
      ? "transform .46s cubic-bezier(.4,0,.2,1)"
      : "none";
    var T = centreOffset() - centreSlot * getStep();
    track.style.transform = "translateX(" + T + "px)";
    if (!animated) track.offsetHeight;        // force reflow
  }

  // Reel index of the card occupying `centreSlot`.
  function centreReel(){
    for (var i=0;i<n;i++) if (cards[i].slot === centreSlot) return cards[i].reelIdx;
    return current;
  }

  function updateUI(){
    current = centreReel();
    cards.forEach(function(c){ c.el.classList.toggle("is-active", c.slot===centreSlot); });
    dots.forEach(function(d,i){ d.classList.toggle("is-active", i===current); });
  }

  function resetCard(c){
    c.video.pause(); c.video.currentTime=0; c.video.playbackRate=1; c.video.volume=1;
    c.video.style.display="none"; c.poster.style.display="";
    var pf=c.el.querySelector(".sif-progress-fill"),pt=c.el.querySelector(".sif-progress-thumb");
    if (pf) pf.style.width="0%"; if (pt) pt.style.left="0%";
    c.el.querySelector(".sif-play-btn").classList.remove("hidden");
    c.el.querySelector(".sif-mute-btn").classList.remove("visible");
    var pi=c.el.querySelector(".sif-pause-ind"); if (pi) pi.classList.remove("visible");
    var rg=c.el.querySelector(".sif-timer-ring"); if (rg) rg.style.strokeDashoffset=0;
    var tx=c.el.querySelector(".sif-timer-text"); if (tx&&c.video.duration) tx.textContent=fmtTime(c.video.duration);
    var pb=c.el.querySelector(".sif-progress"); if (pb) pb.classList.remove("show");
  }

  function pauseCardOnFrame(c){
    if (c.video.style.display==="block" && !c.video.paused){
      c.video.pause();
      var pi=c.el.querySelector(".sif-pause-ind"); if (pi) pi.classList.add("visible");
    }
  }

  // ── Initial layout ───────────────────────────────────
  // Invariant: cards always occupy the n consecutive slots
  //   [centreSlot-2 .. centreSlot+n-3]
  // The viewport shows slots [centreSlot-1 .. centreSlot+1]. The band is
  // shifted one extra slot to the LEFT so a card is always staged just off
  // the left edge, ready to slide in on a left step. For a right step the
  // staged-left card is recycled to just off the right edge BEFORE animating
  // (invisible, since it's off-screen at both ends), so it slides in smoothly
  // too. This gives smooth entry in both directions for n = 4, 5, or 6.
  // Start with reelIdx 0 centred (slot 0); reelIdx n-1 staged at slot -2,
  // reelIdx n-2 at slot -1 ... i.e. the last two reels wrap to the left.
  (function initEngine(){
    centreSlot = 0;
    // Band must be [-2 .. n-3]. Assign reelIdx i to slot:
    //   slot 0..n-3  -> reelIdx 0..n-3
    //   slot -2, -1  -> reelIdx n-2, n-1
    for (var i=0;i<n;i++){
      if (i <= n-3)      cards[i].slot = i;
      else if (i === n-2) cards[i].slot = -2;
      else                cards[i].slot = -1;   // i === n-1
    }
    placeAll();
    setTrack(false);
    updateUI();
  })();

  // ── Navigate ─────────────────────────────────────────
  function navigate(targetIdx){
    if (busy) return;
    targetIdx = mod(targetIdx, n);
    if (targetIdx === current) return;
    var delta = targetIdx - current;
    if (delta >  n/2) delta -= n;
    if (delta < -n/2) delta += n;
    step(delta > 0 ? 1 : -1, targetIdx);
  }

  function step(dir, finalTargetIdx){
    if (busy) return;
    busy = true;

    var newCentre = centreSlot + dir;
    // Occupied band AFTER this step: [newCentre-2 .. newCentre+n-3].
    var newBandLo = newCentre - 2;
    var newBandHi = newCentre + n - 3;

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

      setTimeout(function(){ finishStep(finalTargetIdx); }, 480);

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
      }, 480);
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
    //  • Desktop: a card may keep playing in a side slot; it is reset only
    //    once it is fully off-screen (outside [centreSlot-1 .. centreSlot+1]).
    var mobile = isMobileLayout();
    cards.forEach(function(c){
      var shouldStop = mobile
        ? (c.slot !== centreSlot)
        : (c.slot < centreSlot - 1 || c.slot > centreSlot + 1);
      if (shouldStop && (!c.video.paused || c.video.style.display === "block")){
        resetCard(c);
      }
    });

    busy = false;
    // Continue stepping toward a multi-step dot target.
    if (typeof finalTargetIdx === "number" && current !== finalTargetIdx){
      var d2 = finalTargetIdx - current;
      if (d2 >  n/2) d2 -= n;
      if (d2 < -n/2) d2 += n;
      setTimeout(function(){ step(d2 > 0 ? 1 : -1, finalTargetIdx); }, 30);
    }
  }

  // Reposition everything on resize.
  function relayout(){
    placeAll();
    setTrack(false);
  }

  // ── Controls ─────────────────────────────────────────
  prevBtn.addEventListener("click",function(){ navigate(mod(current-1,n)); });
  nextBtn.addEventListener("click",function(){ navigate(mod(current+1,n)); });

  var txStart=0,txStartY=0;
  viewport.addEventListener("touchstart",function(e){ txStart=e.touches[0].clientX; txStartY=e.touches[0].clientY; },{passive:true});
  viewport.addEventListener("touchend",function(e){
    if (window._sifSE) return;
    var dx=e.changedTouches[0].clientX-txStart,dy=Math.abs(e.changedTouches[0].clientY-txStartY);
    if (Math.abs(dx)>38&&Math.abs(dx)>dy) navigate(mod(current+(dx<0?1:-1),n));
  },{passive:true});

  var msStart=null,msDrag=false;
  viewport.addEventListener("mousedown",function(e){ if (e.target.closest(".sif-arrow")||e.target.closest(".sif-progress")) return; msStart=e.clientX; msDrag=false; });
  viewport.addEventListener("mousemove",function(e){ if (msStart===null) return; if (Math.abs(e.clientX-msStart)>8) msDrag=true; });
  viewport.addEventListener("mouseup",function(e){
    if (msStart===null) return;
    var dx=e.clientX-msStart; msStart=null;
    if (msDrag&&Math.abs(dx)>50) navigate(mod(current+(dx<0?1:-1),n));
    msDrag=false;
  });
  viewport.addEventListener("mouseleave",function(){ msStart=null; msDrag=false; });

  document.addEventListener("keydown",function(e){
    if (e.key==="ArrowLeft") navigate(mod(current-1,n));
    if (e.key==="ArrowRight") navigate(mod(current+1,n));
  });

  window.addEventListener("resize",function(){
    relayout();
  });

})();
