// shared-worker.js — SharedWorker cu IndexedDB heartbeat + BroadcastChannel
// Partajat între tab-uri/frame-uri din același origin

var DB_NAME = 'trap_db';
var DB_VERSION = 1;
var STORE = 'state';
var bc;

try { bc = new BroadcastChannel('trap_ch'); } catch(e) {}

var ports = [];
var db = null;
var timerStarted = null;
var fired = false;
var delay = 20000;

// --- IndexedDB ---
function openDB(cb) {
  if (db) return cb(db);
  var req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = function(e) {
    e.target.result.createObjectStore(STORE);
  };
  req.onsuccess = function(e) {
    db = e.target.result;
    cb(db);
  };
  req.onerror = function() { cb(null); };
}

function dbPut(key, val) {
  openDB(function(d) {
    if (!d) return;
    var tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
  });
}

function dbGet(key, cb) {
  openDB(function(d) {
    if (!d) return cb(null);
    var tx = d.transaction(STORE, 'readonly');
    var req = tx.objectStore(STORE).get(key);
    req.onsuccess = function() { cb(req.result || null); };
    req.onerror = function() { cb(null); };
  });
}

// --- Timer check ---
function checkTimer() {
  if (fired) return;
  if (!timerStarted) return;
  var elapsed = Date.now() - timerStarted;
  if (elapsed >= delay) {
    fired = true;
    dbPut('fired', true);
    broadcast('fire');
  }
}

setInterval(checkTimer, 500);

// --- Broadcast la toate porturile + BroadcastChannel ---
function broadcast(msg) {
  ports.forEach(function(p) {
    try { p.postMessage(msg); } catch(e) {}
  });
  if (bc) {
    try { bc.postMessage(msg); } catch(e) {}
  }
}

// --- SharedWorker connection ---
self.onconnect = function(e) {
  var port = e.ports[0];
  ports.push(port);

  port.onmessage = function(ev) {
    var data = ev.data;
    if (!data) return;

    if (data.type === 'init') {
      delay = data.delay || delay;
      // verifică dacă există deja un start în IndexedDB
      dbGet('start', function(val) {
        if (val) {
          timerStarted = val;
        } else {
          timerStarted = Date.now();
          dbPut('start', timerStarted);
        }
      });
      dbGet('fired', function(val) {
        if (val) {
          fired = true;
          port.postMessage('fire');
        }
      });
    }

    if (data.type === 'reset') {
      timerStarted = Date.now();
      fired = false;
      dbPut('start', timerStarted);
      dbPut('fired', false);
    }

    if (data.type === 'ping') {
      port.postMessage({
        type: 'pong',
        elapsed: timerStarted ? Date.now() - timerStarted : 0,
        delay: delay,
        fired: fired
      });
    }

    if (data.type === 'clear') {
      openDB(function(d) {
        if (!d) return;
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
      });
      timerStarted = null;
      fired = false;
    }
  };

  port.start();
};
