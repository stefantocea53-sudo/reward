// params.js — captură și persistență click params (ttclid, sub1, clickid etc.)
(function(){
  var KEY='__params';

  function parse(){
    var p=new URLSearchParams(window.location.search);
    return{
      ttclid:p.get('ttclid')||'',
      clickid:p.get('clickid')||p.get('click_id')||p.get('cid')||'',
      sub1:p.get('sub1')||'',
      sub2:p.get('sub2')||'',
      sub3:p.get('sub3')||'',
      aff_id:p.get('aff_id')||p.get('affiliate_id')||'',
      campaign:p.get('campaign')||p.get('utm_campaign')||'',
      source:p.get('utm_source')||'tiktok',
      medium:p.get('utm_medium')||'',
      creative:p.get('creative_id')||p.get('ad_id')||'',
    };
  }

  function load(){
    try{
      var raw=localStorage.getItem(KEY);
      return raw?JSON.parse(raw):{};
    }catch(e){return{}}
  }

  function save(data){
    try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}
    try{sessionStorage.setItem(KEY,JSON.stringify(data))}catch(e){}
  }

  // params din URL au prioritate; fallback la stored
  var fresh=parse();
  var stored=load();
  var merged={};
  var keys=Object.keys(fresh);
  for(var i=0;i<keys.length;i++){
    merged[keys[i]]=fresh[keys[i]]||stored[keys[i]]||'';
  }

  if(fresh.ttclid||fresh.clickid)save(merged);

  window.__params=merged;
})();
