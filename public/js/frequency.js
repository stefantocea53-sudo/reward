// frequency.js — frequency cap: nu arăta popup de 2x în X ore
(function(){
  var KEY='__fc';
  var cfg=window.__CONFIG||{};
  var ENABLED=cfg.FREQ_CAP_ENABLED!==false;
  var HOURS=cfg.FREQ_CAP_HOURS||24;

  window.__freqCap={
    isBlocked:function(){
      if(!ENABLED)return false;
      try{
        var raw=localStorage.getItem(KEY);
        if(!raw)return false;
        var data=JSON.parse(raw);
        var elapsed=Date.now()-data.ts;
        var limit=HOURS*3600*1000;
        return elapsed<limit;
      }catch(e){return false}
    },
    record:function(){
      if(!ENABLED)return;
      try{
        localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),uid:window.__uid||''}));
      }catch(e){}
    },
    clear:function(){
      try{localStorage.removeItem(KEY)}catch(e){}
    }
  };
})();
