// uid.js — generare și persistență UID unic per user
(function(){
  var KEY='__uid';
  var FP_KEY='__fpid';

  function generate(){
    return Math.random().toString(36).slice(2)+Date.now().toString(36)+Math.random().toString(36).slice(2);
  }

  function getUid(){
    try{
      var stored=localStorage.getItem(KEY);
      if(stored)return stored;
      var u=generate();
      localStorage.setItem(KEY,u);
      // backup în sessionStorage
      sessionStorage.setItem(KEY,u);
      return u;
    }catch(e){
      try{
        var s=sessionStorage.getItem(KEY);
        if(s)return s;
        var u2=generate();
        sessionStorage.setItem(KEY,u2);
        return u2;
      }catch(e2){
        return window.__fpHash||generate();
      }
    }
  }

  function getFpId(){
    try{
      var fp=localStorage.getItem(FP_KEY);
      if(fp)return fp;
      var id=window.__fpHash||generate();
      localStorage.setItem(FP_KEY,id);
      return id;
    }catch(e){return window.__fpHash||''}
  }

  window.__uid=getUid();
  window.__fpId=getFpId();
})();
