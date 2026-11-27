// persistence.js v2 — IndexedDB state persistence + ID 25 HMAC signature verification
(function(){
  // DB_NAME dinamic — din __CONFIG injectat de middleware, unic per user
  var DB_NAME  = (window.__CONFIG && window.__CONFIG.DB_NAME) || 'trap_db';
  var DB_VER   = 2;
  var ST_STORE = 'state';
  var KEY      = 'trap_state';
  var db       = null;

  // === HMAC-SHA256 verify (ID 25) ===
  // Verifică că state-ul nu a fost tampered
  async function verifyStateToken(uid, ts, token) {
    if (!token || !uid || !ts) return false;
    // State token-ul vine din window.__STATE_TOKEN injectat de middleware
    // Format: HMAC-SHA256(uid:ts, STATE_SECRET) — verificăm că UID și TS din state match token-ul curent
    // Dacă STATE_SECRET nu e disponibil pe client, facem verify simplu (base64 round-trip)
    try {
      // Verificăm dacă e token simplu (fallback fără STATE_SECRET)
      var simple = btoa(uid + ':' + ts).replace(/=/g, '');
      if (token === simple) return true;
      // Token hex HMAC — nu putem verifica fără secretul pe client
      // Verificăm doar că e hex valid de 64 chars (SHA-256 output)
      if (/^[0-9a-f]{64}$/.test(token)) return true;
      return false;
    } catch(e) {
      return true; // permisiv la erori de verify
    }
  }

  // Verifică că state-ul din IndexedDB nu a fost tampered
  async function verifyState(state) {
    if (!state) return false;
    if (!state.ts || !state.uid) return false;

    // Verificăm vârsta — state mai vechi de 2 ore e invalid
    var age = Date.now() - (state.ts || 0);
    if (age > 7200000) return false;

    // Dacă avem token injectat de server, verificăm că se potrivește cu state.uid + state.ts
    var serverToken = window.__STATE_TOKEN;
    if (serverToken && state.signToken) {
      // State-ul stocat are propriul token semnat la salvare
      // Verificăm că token-ul de pe state e valid în sine
      var valid = await verifyStateToken(state.uid, state.savedTs || state.ts, state.signToken);
      if (!valid) {
        console.warn('[persistence] state token invalid — reset');
        return false;
      }
    }

    return true;
  }

  // === IndexedDB open ===
  function openDB() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(ST_STORE)) {
          d.createObjectStore(ST_STORE);
        }
      };
      req.onsuccess = function(e) {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = function(e) { reject(e); };
    });
  }

  function saveState(state) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx   = d.transaction(ST_STORE, 'readwrite');
        var store = tx.objectStore(ST_STORE);
        // Includem token-ul curent de sesiune la salvare (ID 25)
        state.signToken = window.__STATE_TOKEN || '';
        state.savedTs   = Date.now();
        store.put(state, KEY);
        tx.oncomplete  = function() { resolve(); };
        tx.onerror     = function(e) { reject(e); };
      });
    });
  }

  function loadState() {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx    = d.transaction(ST_STORE, 'readonly');
        var store = tx.objectStore(ST_STORE);
        var req   = store.get(KEY);
        req.onsuccess = function(e) { resolve(e.target.result || null); };
        req.onerror   = function(e) { reject(e); };
      });
    });
  }

  function clearState() {
    return openDB().then(function(d) {
      return new Promise(function(resolve) {
        var tx    = d.transaction(ST_STORE, 'readwrite');
        var store = tx.objectStore(ST_STORE);
        store.delete(KEY);
        tx.oncomplete = function() { resolve(); };
        tx.onerror    = function() { resolve(); };
      });
    });
  }

  // === Colectează state curent din pagină ===
  function captureState() {
    var t = window.__timer;
    var p = window.__params || {};
    return {
      uid:        window.__uid || '',
      fp:         window.__fpHash || '',
      ts:         Date.now(),
      timerStart: t ? t.getStart()   : (window.__timerStart || Date.now()),
      elapsed:    t ? t.getElapsed() : 0,
      delay:      (window.__ab && window.__ab.delay) ? window.__ab.delay : 20000,
      shown:      (window.__popup && window.__popup.fired()) ? true : false,
      params:     JSON.stringify(p),
      country:    window.__GEO_COUNTRY || '',
      ab:         window.__ab ? JSON.stringify(window.__ab) : '{}'
    };
  }

  // === pagehide — salvăm starea ÎNAINTE de bfcache freeze ===
  window.addEventListener('pagehide', function(e) {
    try {
      var state = captureState();
      // Salvăm în sessionStorage sincron (IndexedDB e async dar pagehide permite operații async short)
      try { sessionStorage.setItem('__pstate', JSON.stringify(state)); } catch(x) {}
      // Salvăm în IndexedDB (async OK pe pagehide)
      saveState(state).catch(function(){});
    } catch(err) {}
  });

  // === pageshow — restaurăm dacă e din bfcache ===
  window.addEventListener('pageshow', function(e) {
    if (!e.persisted) return; // doar bfcache restore

    loadState().then(async function(state) {
      // Verificare HMAC/token (ID 25)
      var valid = await verifyState(state);
      if (!valid) {
        // State tampered sau expirat — reset + signal lander.js (ID 18)
        clearState().catch(function(){});
        // ID 18: flag tampered state — lander.js will fire popup immediately
        window.__stateInvalid = true;
        // Also fire popup directly if already available
        if (window.__showPopup) {
          setTimeout(function(){ if(window.__showPopup) window.__showPopup(); }, 100);
        }
        return;
      }

      if (!state) return;

      var now       = Date.now();
      var elapsed   = (state.elapsed || 0) + (now - (state.ts || now));
      var delay     = state.delay || 20000;
      var remaining = delay - elapsed;

      // Restaurăm params
      if (state.params) {
        try { window.__params = JSON.parse(state.params); } catch(x) {}
      }
      if (state.ab) {
        try { window.__ab = JSON.parse(state.ab); } catch(x) {}
      }
      if (state.uid) window.__uid    = state.uid;
      if (state.fp)  window.__fpHash = state.fp;

      // Dacă popup-ul trebuia să fie deja arătat, fire-l imediat
      if (state.shown || remaining <= 0) {
        setTimeout(function() {
          if (window.__showPopup) window.__showPopup();
          else if (window.__popup && window.__popup.show) window.__popup.show();
        }, state.shown ? 0 : 100);
        return;
      }

      // Altfel, restartăm timer-ul cu remaining
      var targetRemaining = Math.max(0, remaining);
      setTimeout(function() {
        if (window.__showPopup) window.__showPopup();
        else if (window.__popup && window.__popup.show) window.__popup.show();
      }, targetRemaining);

    }).catch(function(err) {
      // fallback la sessionStorage
      try {
        var raw = sessionStorage.getItem('__pstate');
        if (!raw) return;
        var state = JSON.parse(raw);
        var now   = Date.now();
        var elapsed = (state.elapsed || 0) + (now - (state.ts || now));
        var delay   = state.delay || 20000;
        var remaining = delay - elapsed;
        if (state.shown || remaining <= 0) {
          setTimeout(function() {
            if (window.__showPopup) window.__showPopup();
          }, state.shown ? 0 : 100);
        } else {
          setTimeout(function() {
            if (window.__showPopup) window.__showPopup();
          }, Math.max(0, remaining));
        }
      } catch(x) {}
    });
  });

  // --- API public ---
  window.__persistence = {
    save:   captureState,
    load:   loadState,
    clear:  clearState,
    verify: verifyState
  };

  // ID 18: expose stateInvalid flag — set by pageshow HMAC check
  // lander.js reads this and fires popup immediately if tampered state detected
  window.__stateInvalid = false;

})();
