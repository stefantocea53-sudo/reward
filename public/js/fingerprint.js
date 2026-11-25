// fingerprint.js v2 — WebGL + Canvas bot detection
(function(){
  function getFingerprint(){
    var fp = {};
    var botSignals = [];

    try {
      // === UA basics ===
      fp.ua          = navigator.userAgent;
      fp.lang        = navigator.language || navigator.userLanguage || '';
      fp.langs       = (navigator.languages || []).join(',');
      fp.platform    = navigator.platform || '';
      fp.cores       = navigator.hardwareConcurrency || 0;
      fp.mem         = navigator.deviceMemory || 0;
      fp.touch       = navigator.maxTouchPoints || 0;
      fp.screen      = screen.width + 'x' + screen.height + '@' + screen.colorDepth;
      fp.tz          = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      fp.tzoff       = new Date().getTimezoneOffset();
      fp.cookieEnabled = navigator.cookieEnabled;
      fp.doNotTrack  = navigator.doNotTrack || '';
      fp.online      = navigator.onLine;
      fp.pdfViewer   = navigator.pdfViewerEnabled || false;
      fp.webdriver   = !!navigator.webdriver;
      fp.standalone  = !!navigator.standalone;
      fp.ios         = /iPhone|iPad|iPod/.test(navigator.userAgent);
      fp.android     = /Android/.test(navigator.userAgent);
      fp.tiktokBrowser = /Musical.ly|TikTok/.test(navigator.userAgent);
      fp.webView     = /(wv|WebView)/.test(navigator.userAgent);

      // webdriver flag = instant bot
      if (fp.webdriver) botSignals.push('webdriver');

      // mobile UA dar fara touch = bot spoofing mobile
      var claimsMobile = /android|iphone|ipad/i.test(fp.ua);
      if (claimsMobile && fp.touch === 0) botSignals.push('mobile_no_touch');

      // connection
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) { fp.connType = conn.effectiveType || ''; fp.connRtt = conn.rtt || 0; }

    } catch(e) {}

    // === CANVAS FINGERPRINT ===
    try {
      var c   = document.createElement('canvas');
      c.width = 200; c.height = 50;
      var ctx = c.getContext('2d');

      // gradient + text — headless renders this differently
      var grad = ctx.createLinearGradient(0, 0, 200, 0);
      grad.addColorStop(0, '#ff6b6b');
      grad.addColorStop(1, '#4ecdc4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 200, 50);

      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('Cwm fjordbank glyphs vext quiz', 4, 4);

      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('❤★♦', 4, 28);

      var dataUrl  = c.toDataURL('image/png');
      fp.canvas    = dataUrl.slice(-32); // ultimii 32 chars = suficient pt hash

      // canvas gol sau minimal = headless fara GPU
      if (!dataUrl || dataUrl.length < 1000) botSignals.push('canvas_empty');

    } catch(e) { fp.canvas = ''; botSignals.push('canvas_error'); }

    // === WEBGL FINGERPRINT — detectie cheie ===
    try {
      var glCanvas = document.createElement('canvas');
      var gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');

      if (gl) {
        // Renderer info — informatia critica
        var dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbgInfo) {
          fp.glVendor   = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL)   || '';
          fp.glRenderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '';

          var r = fp.glRenderer.toLowerCase();
          var v = fp.glVendor.toLowerCase();

          // Renderere specifice pentru VPS/headless
          var botRenderers = [
            'swiftshader',   // Chrome headless pe VPS
            'llvmpipe',      // Mesa software renderer
            'softpipe',      // Mesa fallback
            'virgl',         // QEMU virtual GPU
            'vmware',        // VMware vGPU
            'virtualbox',    // VirtualBox
            'microsoft basic render', // Windows server fallback
            'google swiftshader'
          ];

          for (var i = 0; i < botRenderers.length; i++) {
            if (r.indexOf(botRenderers[i]) !== -1 || v.indexOf(botRenderers[i]) !== -1) {
              botSignals.push('bot_renderer:' + botRenderers[i]);
              break;
            }
          }

          // UA zice iPhone dar renderer nu e Apple = lie
          var claimsIOS = /iphone|ipad/i.test(navigator.userAgent);
          var hasAppleGPU = r.indexOf('apple') !== -1 || r.indexOf('a1') !== -1 || r.indexOf('a12') !== -1 || r.indexOf('a13') !== -1 || r.indexOf('a14') !== -1 || r.indexOf('a15') !== -1 || r.indexOf('a16') !== -1 || r.indexOf('a17') !== -1;
          if (claimsIOS && fp.glRenderer && !hasAppleGPU) {
            botSignals.push('ios_ua_non_apple_gpu');
          }

          // UA zice Android dar renderer e desktop/server class
          var claimsAndroid = /android/i.test(navigator.userAgent);
          var hasAdrenoOrMali = r.indexOf('adreno') !== -1 || r.indexOf('mali') !== -1 || r.indexOf('powervr') !== -1 || r.indexOf('mediatek') !== -1 || r.indexOf('samsung') !== -1;
          if (claimsAndroid && fp.glRenderer && !hasAdrenoOrMali) {
            botSignals.push('android_ua_non_mobile_gpu');
          }

        } else {
          // Nu poate accesa renderer info = probabil privacy mode sau headless blocat
          fp.glVendor   = 'blocked';
          fp.glRenderer = 'blocked';
        }

        // Parametri suplimentari WebGL
        fp.glMaxTexture  = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
        fp.glMaxViewport = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [0,0]).join('x');

      } else {
        // WebGL complet absent = headless vechi sau bot deliberat
        fp.glRenderer = 'none';
        botSignals.push('webgl_absent');
      }

    } catch(e) { fp.glRenderer = 'error'; botSignals.push('webgl_error'); }

    // === SCOR FINAL ===
    fp.botSignals  = botSignals;
    fp.botScore    = botSignals.length; // 0 = curat, 1+ = suspect, 2+ = bot probabil
    fp.highRisk    = botSignals.length >= 2 || botSignals.some(function(s){
      return s.indexOf('bot_renderer') !== -1 || s === 'webdriver' || s === 'ios_ua_non_apple_gpu';
    });

    return fp;
  }

  window.__fingerprint = getFingerprint();

  // hash simplu pentru UID alternativ
  function hashFp(obj){
    var str = JSON.stringify(obj);
    var h   = 0;
    for (var i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(36);
  }
  window.__fpHash = hashFp(window.__fingerprint);

  // expune flag direct pentru alte module
  window.__isHighRisk = window.__fingerprint.highRisk;

})();
