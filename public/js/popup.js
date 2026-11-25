// popup.js v2 — UI mutation stadii (ID 8) + skin rotation (ID 17) + claim via /api/claim
(function(){
  var popupFired = false;

  // --- Skin rotation (ID 17): 3 variante vizuale diferite ---
  var SKINS = [
    {
      id: 'skin-minimal',
      badge: '✨ Selected for You',
      title: "You've Qualified",
      sub: 'A special offer is available for your profile. Tap below to access it.',
      cta: 'Access Offer →',
      color: '#2563eb',
      colorEnd: '#7c3aed'
    },
    {
      id: 'skin-urgent',
      badge: '⚠️ Limited Time',
      title: 'Last Chance!',
      sub: 'Only a few spots remaining for today\'s offer. Secure yours now.',
      cta: 'Claim My Spot →',
      color: '#dc2626',
      colorEnd: '#ea580c'
    },
    {
      id: 'skin-reward',
      badge: '🎁 Reward Ready',
      title: 'Your Gift Is Waiting',
      sub: 'We\'ve reserved an exclusive reward for you. It expires soon.',
      cta: 'Get My Reward →',
      color: '#16a34a',
      colorEnd: '#0d9488'
    }
  ];

  // Alege skin persistent per sesiune
  var skinIndex = 0;
  try {
    var stored = sessionStorage.getItem('__sk');
    if (stored !== null) {
      skinIndex = parseInt(stored) || 0;
    } else {
      skinIndex = Math.floor(Math.random() * SKINS.length);
      sessionStorage.setItem('__sk', String(skinIndex));
    }
  } catch(e) {}
  var skin = SKINS[skinIndex % SKINS.length];

  // --- Construiește HTML-ul popup-ului cu skin-ul ales ---
  function buildPopupHTML() {
    var gradient = 'linear-gradient(135deg, ' + skin.color + ' 0%, ' + skin.colorEnd + ' 100%)';
    return [
      '<div id="__po" style="',
        'position:fixed;top:0;left:0;width:100vw;z-index:99999;',
        'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;',
        'pointer-events:none;',
      '">',
        // Overlay semi-transparent
        '<div id="__po-bg" style="',
          'position:fixed;top:0;left:0;width:100%;height:100%;',
          'background:rgba(0,0,0,0);transition:background 0.4s ease;',
          'pointer-events:none;',
        '"></div>',

        // Cardul popup — începe ca banner mic (stage 1)
        '<div id="__po-card" class="__po-stage-banner" style="',
          'position:relative;z-index:2;width:100%;max-width:480px;',
          'background:#fff;border-radius:24px 24px 0 0;',
          'padding:16px 20px;box-shadow:0 -4px 32px rgba(0,0,0,0.12);',
          'transition:all 0.45s cubic-bezier(0.34,1.56,0.64,1);',
          'pointer-events:all;',
        '">',
          // Stage 1: banner mic
          '<div id="__po-s1" style="display:flex;align-items:center;gap:12px;">',
            '<span style="font-size:22px;">🎁</span>',
            '<span style="font-size:14px;font-weight:600;color:#111;">',
              skin.badge,
            '</span>',
            '<span style="margin-left:auto;font-size:12px;color:', skin.color, ';font-weight:700;">TAP TO SEE</span>',
          '</div>',

          // Stage 2+: conținut complet (ascuns inițial)
          '<div id="__po-s2" style="display:none;">',
            '<div style="text-align:center;padding:8px 0 20px;">',
              '<div style="',
                'display:inline-block;padding:5px 14px;border-radius:20px;',
                'background:', skin.color, '1a;border:1px solid ', skin.color, '44;',
                'font-size:11px;font-weight:700;color:', skin.color, ';',
                'text-transform:uppercase;letter-spacing:0.6px;margin-bottom:16px;',
              '">', skin.badge, '</div>',
              '<h2 style="font-size:24px;font-weight:800;color:#111;margin-bottom:10px;line-height:1.2;">',
                skin.title,
              '</h2>',
              '<p style="font-size:14px;color:#666;line-height:1.6;margin-bottom:8px;">',
                skin.sub,
              '</p>',
              '<p id="__po-cd" style="font-size:13px;color:', skin.color, ';font-weight:600;margin-bottom:0;">',
                '⏱ Expires in <span id="__po-time">05:00</span>',
              '</p>',
            '</div>',

            '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;text-align:left;">',
              '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#333;">',
                '<span style="font-size:16px;">✅</span> Free to start — no credit card',
              '</div>',
              '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#333;">',
                '<span style="font-size:16px;">⚡</span> Instant access after sign up',
              '</div>',
              '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#333;">',
                '<span style="font-size:16px;">🔒</span> Secure & private',
              '</div>',
            '</div>',

            '<button id="__po-btn" type="button" style="',
              'display:block;width:100%;padding:17px 24px;',
              'background:', gradient, ';',
              'color:#fff;font-size:17px;font-weight:800;',
              'border:none;border-radius:14px;cursor:pointer;',
              'touch-action:manipulation;',
              'box-shadow:0 10px 24px rgba(0,0,0,0.2);',
              'letter-spacing:0.3px;-webkit-appearance:none;',
              'position:relative;transition:transform 0.1s ease,opacity 0.15s ease;',
            '">',
              skin.cta,
              '<span id="__po-spin" style="',
                'display:none;width:18px;height:18px;',
                'border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;',
                'border-radius:50%;animation:__spin 0.6s linear infinite;',
                'position:absolute;right:18px;top:50%;transform:translateY(-50%);',
              '"></span>',
            '</button>',

            '<p style="font-size:11px;color:#ccc;text-align:center;margin-top:12px;">',
              'By continuing, you agree to the terms and conditions.',
            '</p>',
          '</div>',
        '</div>',
      '</div>',
      '<style>',
        '@keyframes __spin{to{transform:translateY(-50%) rotate(360deg)}}',
        '#__po-card.__po-stage-sheet{padding:24px 20px}',
        '#__po-card.__po-stage-full{border-radius:0;height:100vh;justify-content:center;overflow-y:auto;padding:40px 24px}',
        '#__po-btn:active{transform:scale(0.97)}',
        '#__po-btn.loading{opacity:0.75;pointer-events:none}',
      '</style>'
    ].join('');
  }

  // --- Injectează popup-ul în DOM ---
  function injectPopup() {
    if (document.getElementById('__po')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = buildPopupHTML();
    document.body.appendChild(wrap.firstChild);
  }

  // --- Tranziție între stadii (ID 8) ---
  function transitionToSheet() {
    var card = document.getElementById('__po-card');
    var bg   = document.getElementById('__po-bg');
    var s1   = document.getElementById('__po-s1');
    var s2   = document.getElementById('__po-s2');
    if (!card) return;

    card.classList.remove('__po-stage-banner');
    card.classList.add('__po-stage-sheet');
    card.style.padding = '24px 20px 32px';
    if (bg) bg.style.background = 'rgba(0,0,0,0.5)';
    if (s1) s1.style.display = 'none';
    if (s2) s2.style.display = 'block';
    if (bg) bg.style.pointerEvents = 'all';
  }

  function transitionToFull() {
    var card = document.getElementById('__po-card');
    if (!card) return;
    card.classList.remove('__po-stage-sheet');
    card.classList.add('__po-stage-full');
  }

  // --- Countdown în popup ---
  function startCountdown() {
    var cfg = window.__CONFIG || {};
    var seconds = cfg.POPUP_COUNTDOWN_S || 300;
    var el = document.getElementById('__po-time');
    if (!el) return;
    function fmt(s) {
      var m = Math.floor(s / 60), sec = s % 60;
      return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }
    el.textContent = fmt(seconds);
    var iv = setInterval(function() {
      seconds--;
      if (seconds <= 0) { clearInterval(iv); el.textContent = '00:00'; return; }
      if (el) el.textContent = fmt(seconds);
    }, 1000);
  }

  // --- CTA handler: POST la /api/claim ---
  function bindCTA() {
    var btn = document.getElementById('__po-btn');
    var spin = document.getElementById('__po-spin');
    var claimed = false;

    function claimNow(openedWindow) {
      if (claimed) return;
      claimed = true;
      if (btn) { btn.classList.add('loading'); if (spin) spin.style.display = 'block'; }
      if (window.__analytics) window.__analytics.claimClick();

      var p = window.__params || {};
      var payload = {
        ttclid:   p.ttclid || '',
        clickid:  p.clickid || p.ttclid || '',
        sub1:     p.sub1 || '',
        sub2:     p.sub2 || '',
        sub3:     p.sub3 || '',
        aff_id:   p.aff_id || '',
        campaign: p.campaign || '',
        creative: p.creative || '',
        uid:      window.__uid || '',
        fp:       window.__fpHash || '',
        ab:       window.__ab ? String(window.__ab.variantIndex || 0) : '0',
        country:  window.__GEO_COUNTRY || ''
      };

      // Ruta obfuscată /c în loc de /api/claim (ID 15)
      fetch('/c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      }).then(function(r) {
        if (btn) { btn.classList.remove('loading'); if (spin) spin.style.display = 'none'; }
        var url = r.redirected ? r.url : null;
        if (!url && r.ok) {
          return r.json().then(function(d) {
            var target = d && d.url;
            if (target) {
              if (openedWindow && !openedWindow.closed) openedWindow.location.href = target;
              else window.location.href = target;
            }
          });
        }
        if (url) {
          if (openedWindow && !openedWindow.closed) openedWindow.location.href = url;
          else window.location.href = url;
        }
      }).catch(function() {
        claimed = false;
        if (btn) { btn.classList.remove('loading'); if (spin) spin.style.display = 'none'; }
      });
    }

    if (!btn) return;

    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      btn.addEventListener('touchend', function(e) {
        e.preventDefault();
        // blank-first în contextul gestului (ID 23 pattern)
        var win = window.open('', '_blank');
        claimNow(win);
      }, { passive: false, capture: true });
    } else {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        claimNow(null);
      });
      btn.addEventListener('touchend', function(e) {
        e.preventDefault();
        claimNow(null);
      }, { passive: false });
    }
  }

  // --- showPopup principal ---
  function showPopup() {
    if (popupFired) return;
    if (window.__freqCap && window.__freqCap.isBlocked()) return;
    if (window.__geo && !window.__geo.isAllowed()) return;

    popupFired = true;
    if (window.__timer) window.__timer.markShown();
    if (window.__freqCap) window.__freqCap.record();
    if (window.__analytics) window.__analytics.popupShown();

    // Injectează popup-ul în DOM
    injectPopup();

    // Back-trap
    history.pushState(null, '', window.location.href);
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', function() {
      if (window.__analytics) window.__analytics.backAttempt();
      history.pushState(null, '', window.location.href);
    });

    // Stadiu 1 — banner mic, apare imediat
    var card = document.getElementById('__po-card');
    if (card) card.style.transform = 'translateY(0)';

    // Stadiu 2 — bottom sheet după 2.5s (ID 8)
    setTimeout(transitionToSheet, 2500);

    // Stadiu 3 — fullscreen după 5s (ID 8)
    setTimeout(transitionToFull, 5000);

    // Countdown pornit la stadiu 2
    setTimeout(startCountdown, 2500);

    // Bind CTA
    setTimeout(bindCTA, 100);
  }

  window.__popup = {
    show: showPopup,
    fired: function() { return popupFired; }
  };
  window.__showPopup = showPopup;

})();
