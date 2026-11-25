// fingerprint.js — device fingerprinting aprofundat
(function(){
  function getFingerprint(){
    var fp={};
    try{
      fp.ua=navigator.userAgent;
      fp.lang=navigator.language||navigator.userLanguage||'';
      fp.langs=(navigator.languages||[]).join(',');
      fp.platform=navigator.platform||'';
      fp.cores=navigator.hardwareConcurrency||0;
      fp.mem=navigator.deviceMemory||0;
      fp.touch=navigator.maxTouchPoints||0;
      fp.screen=screen.width+'x'+screen.height+'@'+screen.colorDepth;
      fp.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
      fp.tzoff=new Date().getTimezoneOffset();
      fp.cookieEnabled=navigator.cookieEnabled;
      fp.doNotTrack=navigator.doNotTrack||'';
      fp.online=navigator.onLine;
      fp.pdfViewer=navigator.pdfViewerEnabled||false;
      fp.webdriver=!!navigator.webdriver;
      fp.standalone=!!navigator.standalone;
      fp.ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
      fp.android=/Android/.test(navigator.userAgent);
      fp.tiktokBrowser=/Musical.ly|TikTok/.test(navigator.userAgent);
      fp.webView=/(wv|WebView)/.test(navigator.userAgent);
      // canvas fingerprint (lightweight)
      try{
        var c=document.createElement('canvas');
        var ctx=c.getContext('2d');
        ctx.textBaseline='top';
        ctx.font='14px Arial';
        ctx.fillStyle='#f00';
        ctx.fillText('fp',2,2);
        fp.canvas=c.toDataURL().slice(-20);
      }catch(e){fp.canvas=''}
      // connection
      var conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(conn){fp.connType=conn.effectiveType||'';fp.connRtt=conn.rtt||0}
    }catch(e){}
    return fp;
  }

  window.__fingerprint=getFingerprint();

  // hash simplu pentru UID alternativ
  function hashFp(obj){
    var str=JSON.stringify(obj);
    var h=0;
    for(var i=0;i<str.length;i++){h=(h<<5)-h+str.charCodeAt(i);h|=0}
    return Math.abs(h).toString(36);
  }
  window.__fpHash=hashFp(window.__fingerprint);
})();
