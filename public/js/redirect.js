// redirect.js v2 — toate redirect-urile merg prin /api/claim
// OFFER_URL nu apare NICIODATĂ în client source
// Clientul trimite ttclid + token la server → server răspunde cu 302 la URL-ul real
(function(){

  // Construiește payload-ul pentru /api/claim
  function buildClaimPayload() {
    var p = window.__params || {};
    var uid = window.__uid || '';
    var fp = window.__fpHash || '';
    var ab = window.__ab || {};
    var geo = window.__GEO_COUNTRY || '';
    var ts = window.__SERVER_TS || Date.now();

    return {
      ttclid:      p.ttclid      || '',
      clickid:     p.clickid     || p.ttclid || '',
      sub1:        p.sub1        || '',
      sub2:        p.sub2        || '',
      sub3:        p.sub3        || '',
      aff_id:      p.aff_id      || '',
      campaign:    p.campaign    || '',
      creative:    p.creative    || p.creative_id || '',
      uid:         uid,
      fp:          fp,
      ab:          ab.variantIndex !== undefined ? String(ab.variantIndex) : '',
      country:     geo,
      ts:          String(ts),
      utm_source:  p.utm_source  || '',
      utm_medium:  p.utm_medium  || '',
      utm_campaign:p.utm_campaign|| ''
    };
  }

  // Trimite POST la /api/claim și urmează redirect-ul
  // Serverul răspunde cu 302 → browser-ul merge direct la OFFER_URL
  function claimAndRedirect(onError) {
    var payload = buildClaimPayload();

    // Încearcă fetch cu urmărire redirect (follow)
    fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    }).then(function(r) {
      // Dacă fetch a urmărit redirect-ul, URL-ul final e în r.url
      if (r.redirected && r.url && r.url !== window.location.href) {
        window.location.href = r.url;
      } else if (r.ok) {
        // Serverul ar trebui să returneze 302, dar dacă returnează 200 cu JSON
        return r.json().then(function(data) {
          if (data && data.url) window.location.href = data.url;
        });
      } else {
        if (onError) onError(new Error('claim_failed_' + r.status));
      }
    }).catch(function(err) {
      if (onError) onError(err);
    });
  }

  // Versiune iOS: deschide fereastră blank sincron (în gestura touchend),
  // face claim async, asignează URL-ul ferestrei când răspunsul vine
  function claimAndOpenWindow(win) {
    var payload = buildClaimPayload();

    fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    }).then(function(r) {
      var targetUrl = null;
      if (r.redirected && r.url) {
        targetUrl = r.url;
      } else if (r.ok) {
        return r.json().then(function(data) {
          if (data && data.url) {
            if (win && !win.closed) {
              win.location.href = data.url;
            } else {
              window.location.href = data.url;
            }
          }
        });
      }
      if (targetUrl) {
        if (win && !win.closed) {
          win.location.href = targetUrl;
        } else {
          window.location.href = targetUrl;
        }
      }
    }).catch(function() {
      // Fallback: închide fereastra blank, redirect current
      if (win && !win.closed) win.close();
      // Nu avem URL direct — nu facem nimic, lăsăm userul să apese din nou
    });
  }

  window.__redirect = {
    // POST la /api/claim → urmărire 302 → OFFER_URL (OFFER_URL niciodată în client)
    go: function() {
      claimAndRedirect(function(err) {
        // Eroare silențioasă — nu afișăm nimic utilizatorului
        if (window.__analytics) window.__analytics.event('claim_error', { msg: String(err) });
      });
    },

    // Versiunea iOS pentru pattern-ul blank-window
    goWithWindow: function(win) {
      claimAndOpenWindow(win);
    },

    // Build URL local (DEPRECATED — păstrat pentru compatibilitate backward)
    // Nu mai include OFFER_URL în client — această funcție nu ar trebui folosită
    build: function(base) {
      // Returnează /api/claim cu params ca query string (ca fallback minimal)
      var p = buildClaimPayload();
      var qs = Object.keys(p)
        .filter(function(k) { return p[k]; })
        .map(function(k) { return k + '=' + encodeURIComponent(p[k]); })
        .join('&');
      return '/api/claim' + (qs ? '?' + qs : '');
    }
  };

})();
