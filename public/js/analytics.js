// analytics.js — tracking detaliat: visit, popup_shown, claim_click, back_attempt
(function(){
  // Citeste endpoint-urile din obs pool daca e disponibil (ascunse din sursa)
  function ep(key, fallback) {
    return (window.__obs && window.__obs.get(key)) || fallback;
  }
  var ENDPOINT_VISIT = ep('ep_visit', '/api/visit');
  var ENDPOINT_EVENT = ep('ep_event', '/api/event');

  function base(){
    return{
      uid:window.__uid||'',
      fp:window.__fpHash||'',
      ab:window.__ab&&window.__ab.variantIndex,
      geo:window.__GEO_COUNTRY||'',
      device:window.__fingerprint&&window.__fingerprint.ios?'ios':window.__fingerprint&&window.__fingerprint.android?'android':'other',
      tiktokBrowser:!!(window.__fingerprint&&window.__fingerprint.tiktokBrowser),
      ts:Date.now(),
      // STATE_TOKEN pentru validare server-side (injectat de middleware)
      stateToken:window.__STATE_TOKEN||'',
    };
  }

  function post(url,data){
    try{
      fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data),
        keepalive:true
      }).catch(function(){});
    }catch(e){}
  }

  window.__analytics={
    visit:function(){
      if(!(window.__CONFIG&&window.__CONFIG.TRACK_VISIT))return;
      var d=Object.assign(base(),{
        event:'visit',
        ref:document.referrer||'',
        ua:navigator.userAgent,
        params:window.__params||{},
        screen:screen.width+'x'+screen.height,
        lang:navigator.language||'',
      });
      post(ENDPOINT_VISIT,d);
    },
    popupShown:function(){
      if(!(window.__CONFIG&&window.__CONFIG.TRACK_POPUP))return;
      post(ENDPOINT_EVENT,Object.assign(base(),{event:'popup_shown'}));
    },
    claimClick:function(){
      if(!(window.__CONFIG&&window.__CONFIG.TRACK_CLAIM))return;
      post(ENDPOINT_EVENT,Object.assign(base(),{event:'claim_click'}));
    },
    backAttempt:function(){
      post(ENDPOINT_EVENT,Object.assign(base(),{event:'back_attempt'}));
    },
    custom:function(name,extra){
      post(ENDPOINT_EVENT,Object.assign(base(),{event:name},extra||{}));
    }
  };

  // legacy compat cu track.js
  window.__trackPopupShown=function(){window.__analytics.popupShown()};
  window.__trackClaim=function(){window.__analytics.claimClick()};
})();
