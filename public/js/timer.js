// timer.js — logica timer separată, folosește system clock nu setTimeout
(function(){
  var KEY_START='__st';
  var KEY_SHOWN='__shown';

  // localStorage supraviețuiește și când iOS TikTok ucide pagina complet
  var stored=localStorage.getItem(KEY_START);
  var startTime=stored?parseInt(stored,10):Date.now();
  if(!stored)localStorage.setItem(KEY_START,startTime);

  window.__timer={
    startTime:startTime,
    delay:window.__ab?window.__ab.delay:(window.__CONFIG&&window.__CONFIG.POPUP_DELAY_MS)||20000,

    elapsed:function(){return Date.now()-this.startTime},
    remaining:function(){return Math.max(0,this.delay-this.elapsed())},
    ready:function(){return this.elapsed()>=this.delay},
    wasShown:function(){return localStorage.getItem(KEY_SHOWN)==='1'},
    markShown:function(){localStorage.setItem(KEY_SHOWN,'1')},
  };
})();
