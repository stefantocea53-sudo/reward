// obfuscation.js — layer de ofuscare pentru strings și logică sensibilă
// Încarcă înainte de orice alt modul dacă vrei să ascunzi strings din devtools

(function() {
  'use strict';

  // Simple string encoder/decoder (XOR cu cheie rotativă)
  var KEY = [0x54, 0x52, 0x41, 0x50]; // "TRAP"

  function xorEncode(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      out.push(str.charCodeAt(i) ^ KEY[i % KEY.length]);
    }
    return out;
  }

  function xorDecode(arr) {
    var out = '';
    for (var i = 0; i < arr.length; i++) {
      out += String.fromCharCode(arr[i] ^ KEY[i % KEY.length]);
    }
    return out;
  }

  // Base64 helpers compacte
  function b64e(str) {
    try { return btoa(unescape(encodeURIComponent(str))); } catch(e) { return str; }
  }
  function b64d(str) {
    try { return decodeURIComponent(escape(atob(str))); } catch(e) { return str; }
  }

  // Ofuscare URL-uri sensibile (offer URL nu apare în clar în memorie)
  function encodeUrl(url) {
    return xorEncode(url);
  }

  function decodeUrl(arr) {
    return xorDecode(arr);
  }

  // Funcție de wrap pentru eval protejat (rulează cod ca string)
  // Folosit pentru a ascunde string literals din source view
  function safeExec(encodedFn) {
    try {
      var decoded = b64d(encodedFn);
      var fn = new Function('return ' + decoded)();
      if (typeof fn === 'function') fn();
    } catch(e) {}
  }

  // Anti-tampering: verifică dacă funcțiile native au fost overwrite
  function checkNativeIntegrity() {
    var checks = [
      [Function.prototype.toString, /native code/],
      [XMLHttpRequest.prototype.open, /native code/],
      [fetch, /native code/]
    ];
    for (var i = 0; i < checks.length; i++) {
      try {
        var src = Function.prototype.toString.call(checks[i][0]);
        if (!checks[i][1].test(src)) return false;
      } catch(e) { return false; }
    }
    return true;
  }

  // String pool — toate string-urile sensibile encode-uite
  // Operator le accesează via window.__obs.get('key')
  var pool = {};

  function addToPool(key, val) {
    pool[key] = xorEncode(val);
  }

  function getFromPool(key) {
    if (!pool[key]) return '';
    return xorDecode(pool[key]);
  }

  // Prototype poisoning prevention
  // Blochează modificarea unor proto native
  try {
    Object.defineProperty(Array.prototype, '__secret', {
      get: function() { return undefined; },
      set: function() {},
      configurable: false
    });
  } catch(e) {}

  // Honey pot: dacă cineva accesează această proprietate, e inspector
  var inspectorDetected = false;
  try {
    var trap = {};
    Object.defineProperty(trap, 'inspector', {
      get: function() {
        inspectorDetected = true;
        return undefined;
      }
    });
    // Nu face nimic cu trap, e doar un trap object
  } catch(e) {}

  // --- Public API ---
  window.__obs = {
    encode: b64e,
    decode: b64d,
    xorEncode: xorEncode,
    xorDecode: xorDecode,
    encodeUrl: encodeUrl,
    decodeUrl: decodeUrl,
    safeExec: safeExec,
    checkIntegrity: checkNativeIntegrity,
    addToPool: addToPool,
    get: getFromPool,
    isInspected: function() { return inspectorDetected; }
  };

  // Ascunde __obs din enumerare
  try {
    Object.defineProperty(window, '__obs', {
      value: window.__obs,
      writable: false,
      enumerable: false,
      configurable: false
    });
  } catch(e) {}

})();
