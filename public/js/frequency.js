// frequency.js — dynamic frequency cap (ID 35)
// Cooldown bazat pe comportamentul userului:
//   converted  → 48h (a clamat, nu îl spam-ui)
//   rejected   → 48h (a închis rapid, iritant să revii prea curând)
//   error      → 1h  (oferta a crăpat, userul nu e vinovat — încearcă repede)
//   shown      → 24h (default — a văzut dar nu a acționat)
(function(){
  var KEY='__fc';
  var cfg=window.__CONFIG||{};
  var ENABLED=cfg.FREQ_CAP_ENABLED!==false;

  // Ore per reason — config override posibil din __CONFIG
  var HOURS={
    converted: cfg.FREQ_CAP_CONVERTED_H || 48,
    rejected:  cfg.FREQ_CAP_REJECTED_H  || 48,
    error:     cfg.FREQ_CAP_ERROR_H     || 1,
    shown:     cfg.FREQ_CAP_HOURS       || 24   // default fallback
  };

  window.__freqCap={
    isBlocked:function(){
      if(!ENABLED)return false;
      try{
        var raw=localStorage.getItem(KEY);
        if(!raw)return false;
        var data=JSON.parse(raw);
        var reason=data.reason||'shown';
        var limit=(HOURS[reason]||HOURS.shown)*3600*1000;
        var elapsed=Date.now()-data.ts;
        return elapsed<limit;
      }catch(e){return false}
    },

    // reason: 'shown' | 'rejected' | 'converted' | 'error'
    record:function(reason){
      if(!ENABLED)return;
      try{
        localStorage.setItem(KEY,JSON.stringify({
          ts:Date.now(),
          uid:window.__uid||'',
          reason:reason||'shown'
        }));
      }catch(e){}
    },

    // apelat din popup.js la close rapid (<2s după arătare)
    recordRejected:function(){
      this.record('rejected');
    },

    // apelat din analytics.js / claim flow
    recordConverted:function(){
      this.record('converted');
    },

    // apelat dacă /api/claim returnează eroare
    recordError:function(){
      this.record('error');
    },

    clear:function(){
      try{localStorage.removeItem(KEY)}catch(e){}
    },

    // returnează reason-ul din storage (pentru debug/analytics)
    getReason:function(){
      try{
        var raw=localStorage.getItem(KEY);
        return raw?JSON.parse(raw).reason:null;
      }catch(e){return null}
    }
  };
})();
