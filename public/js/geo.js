// geo.js — GEO filter client-side via CF header injectat de server
// serverul injectează window.__GEO din cf-ipcountry header
(function(){
  var cfg=window.__CONFIG||{};
  var ALLOWED=cfg.GEO_ALLOWED||[];
  var BLOCKED=cfg.GEO_BLOCKED||[];

  window.__geo={
    country:window.__GEO_COUNTRY||'',
    isAllowed:function(){
      var c=window.__GEO_COUNTRY||'';
      if(!c)return true; // nu știm = permitem
      if(BLOCKED.indexOf(c)!==-1)return false;
      if(ALLOWED.length>0&&ALLOWED.indexOf(c)===-1)return false;
      return true;
    }
  };
})();
