// ab.js — A/B testing pe delay și variante popup
(function(){
  var cfg=window.__CONFIG||{};
  var ENABLED=cfg.AB_ENABLED!==false;
  var VARIANTS=cfg.AB_VARIANTS||[{delay:20000,weight:100}];
  var KEY='__ab';

  function pickVariant(){
    var total=VARIANTS.reduce(function(s,v){return s+v.weight},0);
    var r=Math.random()*total;
    var acc=0;
    for(var i=0;i<VARIANTS.length;i++){
      acc+=VARIANTS[i].weight;
      if(r<=acc)return i;
    }
    return 0;
  }

  function getVariantIndex(){
    if(!ENABLED)return 0;
    try{
      var stored=sessionStorage.getItem(KEY);
      if(stored!==null)return parseInt(stored,10);
      var idx=pickVariant();
      sessionStorage.setItem(KEY,idx);
      return idx;
    }catch(e){return 0}
  }

  var idx=getVariantIndex();
  var variant=VARIANTS[idx]||VARIANTS[0];

  window.__ab={
    variantIndex:idx,
    variant:variant,
    delay:variant.delay||(cfg.POPUP_DELAY_MS||20000),
  };
})();
