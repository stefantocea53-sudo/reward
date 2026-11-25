// cloak.js — bot detection client-side + anti-inspect
(function(){
  var BOTS=[
    'googlebot','bingbot','slurp','duckduckbot','baiduspider','yandexbot',
    'bytespider','bytedance','tiktokbot','petalbot','ahrefsbot','semrushbot',
    'mj12bot','dotbot','rogerbot','exabot','facebot','ia_archiver',
    'wget','curl','python-requests','python-urllib','go-http-client',
    'okhttp','libwww-perl','scrapy','phantomjs','headlesschrome',
    'selenium','webdriver','puppeteer','playwright','cypress','nightwatch'
  ];

  var ua=(navigator.userAgent||'').toLowerCase();
  var isBot=BOTS.some(function(b){return ua.indexOf(b)!==-1});
  var isHeadless=!!(
    navigator.webdriver||
    window.__nightmare||
    window._phantom||
    window.callPhantom||
    window.__selenium_evaluate||
    window.__webdriver_evaluate||
    document.__selenium_unwrapped
  );
  var isBotLang=(navigator.languages&&navigator.languages.length===0);

  if(isBot||isHeadless||isBotLang){
    document.documentElement.innerHTML='';
    throw new Error('blocked');
  }

  // anti-inspect
  document.addEventListener('contextmenu',function(e){e.preventDefault()});
  document.addEventListener('keydown',function(e){
    // F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+A
    if(e.keyCode===123)e.preventDefault();
    if(e.ctrlKey&&e.shiftKey&&[73,74,67,75].indexOf(e.keyCode)!==-1)e.preventDefault();
    if(e.ctrlKey&&[85,83,65].indexOf(e.keyCode)!==-1)e.preventDefault();
  });

  // devtools size detection
  var _devOpen=false;
  setInterval(function(){
    var wDiff=window.outerWidth-window.innerWidth;
    var hDiff=window.outerHeight-window.innerHeight;
    if(wDiff>160||hDiff>160){
      if(!_devOpen){
        _devOpen=true;
        document.documentElement.innerHTML='<p style="color:#111;padding:20px;font-family:sans-serif">Something went wrong.</p>';
      }
    }else{_devOpen=false}
  },1500);

  // debug trap
  var _dbg=false;
  Object.defineProperty(window,'__dbg',{
    get:function(){_dbg=true;return undefined}
  });
})();
