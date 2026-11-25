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

  // --- LAYER vizibil pentru WebKit (opacity > 0, pointer-events: auto) ---
  // WebKit nu acceptă opacity: 0 ca "visible" — folosim opacity: 0.001
  function createGestureLayer(onGesture) {
    var layer = document.createElement('div');
    layer.id = '__ios_gesture_layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('tabindex', '-1');
    layer.style.cssText = [
      'position:fixed',
      'top:0', 'left:0',
      'width:100vw', 'height:100vh',
      'z-index:99997',
      'opacity:0.001',           // non-zero — WebKit îl consideră visible
      'background:transparent',
      'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent',
      'cursor:pointer'
    ].join(';');

    var fired = false;

    // touchend — singurul event acceptat sincronic de WebKit pentru window.open
    layer.addEventListener('touchend', function(e) {
      if (fired) return;
      fired = true;
      e.preventDefault();
      e.stopPropagation();

      // Curăță layer-ul
      if (layer.parentNode) layer.parentNode.removeChild(layer);

      // Execută callback în același tick — SINCRONIC
      onGesture();
    }, { passive: false, capture: true });

    // Fallback click pentru desktop/non-iOS
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
