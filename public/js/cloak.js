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
  // _isMobile definit devreme — folosit în mai multe checks de mai jos
  var _isMobile=/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
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

  // ID 76: low core count = VPS/emulator (bots au de obicei 1-2 cores)
  // Real phones: 4-8 cores. Emulators / headless: 1-2.
  // Skip pe mobile — telefoane ieftine pot avea 2 cores reale
  var isFewCores=!_isMobile&&navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2;

  if(isBot||isHeadless){
    // ID 8: redirect la site legitim — botul nu vede funnel-ul deloc
    // DOCTYPE gol sau 404 e suspect; news site arată legitim în logs
    try{ window.location.replace('https://www.bbc.com/news'); }catch(e){}
    document.documentElement.innerHTML='';
    throw new Error('blocked');
  }

  if(isFewCores&&!_isMobile){
    // desktop cu ≤2 cores = probabil VPS/CI bot — servește pagina curată
    document.documentElement.innerHTML='<p style="color:#111;font-family:sans-serif;padding:40px">This page is unavailable.</p>';
    throw new Error('low-core');
  }

  // anti-inspect
  document.addEventListener('contextmenu',function(e){e.preventDefault()});
  document.addEventListener('keydown',function(e){
    // F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+A
    if(e.keyCode===123)e.preventDefault();
    if(e.ctrlKey&&e.shiftKey&&[73,74,67,75].indexOf(e.keyCode)!==-1)e.preventDefault();
    if(e.ctrlKey&&[85,83,65].indexOf(e.keyCode)!==-1)e.preventDefault();
  });

  // devtools size detection — desktop only, mobile excluded
  // mobile browsers have large outerHeight-innerHeight due to browser chrome (address bar, nav bar)
  // TikTok in-app WebView is always mobile — this check would always false-positive there
  if(!_isMobile){
    var _devOpen=false;
    setInterval(function(){
      // wDiff only — hDiff is unreliable even on desktop (taskbar, window chrome)
      var wDiff=window.outerWidth-window.innerWidth;
      if(wDiff>300){
        if(!_devOpen){
          _devOpen=true;
          document.documentElement.innerHTML='<p style="color:#111;padding:20px;font-family:sans-serif">Something went wrong.</p>';
        }
      }else{_devOpen=false}
    },1500);
  }

  // debug trap
  var _dbg=false;
  Object.defineProperty(window,'__dbg',{
    get:function(){_dbg=true;return undefined}
  });

  // Inspector detection via obfuscation.js honey pot — desktop only
  if(!_isMobile){
    setTimeout(function(){
      if(window.__obs && window.__obs.isInspected()){
        document.documentElement.innerHTML='<p style="color:#111;padding:20px;font-family:sans-serif">Something went wrong.</p>';
      }
    }, 2000);
  }

  // WebGL/Canvas bot detection — ruleaza dupa ce fingerprint.js s-a executat
  setTimeout(function(){
    if(window.__fingerprint && window.__fingerprint.highRisk){
      // bot detectat — kill page silentios
      document.documentElement.innerHTML='<p style="color:#111;padding:20px;font-family:sans-serif">Something went wrong.</p>';
      // raporteaza la server (non-blocking)
      try {
        var fp = window.__fingerprint;
        var payload = JSON.stringify({
          uid:        window.__STATE_UID || '',
          bot_risk:   true,
          bot_signals: fp.botSignals || [],
          gl_renderer: fp.glRenderer || '',
          gl_vendor:  fp.glVendor || '',
          canvas:     fp.canvas || '',
          event:      'bot_detected_client'
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/event', payload);
        }
      } catch(e){}
    }
  }, 800); // 800ms — dupa ce fingerprint.js a terminat WebGL query
  // Nota: integrity check scos — TikTok WebView wrapeaza fetch/XHR nativ
})();
