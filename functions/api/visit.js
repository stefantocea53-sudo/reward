// functions/api/visit.js — endpoint tracking visit inițial
// POST /api/visit cu JSON payload

import { verifySessionToken } from '../_lib/crypto.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('cf-connecting-ip') || '';
    const country = request.headers.get('cf-ipcountry') || 'XX';
    const ua = request.headers.get('user-agent') || '';
    const ref = request.headers.get('referer') || '';
    const timestamp = new Date().toISOString();

    // === VALIDARE STATE TOKEN (HMAC) ===
    // Middleware injectează __STATE_TOKEN în pagină — clientul îl trimite înapoi
    // Verificăm că request-ul vine dintr-o pagină legitimă servită de noi
    if (env && env.STATE_SECRET && body.stateToken) {
      const valid = await verifySessionToken(body.stateToken, env.STATE_SECRET).catch(() => false);
      if (!valid) {
        // Token invalid sau expirat — log silențios, refuzăm fără a expune motivul
        return jsonResponse({ ok: true }); // fake ok să nu revelez filtrul
      }
    }

    // Payload complet pentru logging
    const record = {
      type: 'visit',
      timestamp,
      ip,
      country,
      ua,
      referer: ref,
      uid: sanitize(body.uid),
      fp: sanitize(body.fp),
      ab: sanitize(body.ab),
      params: sanitizeObj(body.params),
      screen: sanitizeObj(body.screen),
      lang: sanitize(body.lang),
      tz: sanitize(body.tz),
      page: sanitize(body.page)
    };

    // Dacă există KV binding (opțional) → stochează
    if (env && env.TRAP_KV) {
      const key = `visit:${timestamp}:${record.uid || ip}`;
      await env.TRAP_KV.put(key, JSON.stringify(record), {
        expirationTtl: 86400 * 30 // 30 zile
      }).catch(() => {});
    }

    // Dacă există D1 binding (opțional)
    if (env && env.TRAP_DB) {
      await env.TRAP_DB.prepare(
        `INSERT OR IGNORE INTO visits
         (uid, fp, country, ua, params, ab, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        record.uid || '',
        record.fp || '',
        country,
        ua,
        JSON.stringify(record.params),
        record.ab || '',
        timestamp
      ).run().catch(() => {});
    }

    return jsonResponse({ ok: true, ts: timestamp });

  } catch (e) {
    return jsonResponse({ ok: false }, 400);
  }
}

// GET handler pentru health check
export async function onRequestGet(context) {
  return jsonResponse({ status: 'ok', endpoint: 'visit' });
}

// === HELPERS ===
function sanitize(val) {
  if (val === null || val === undefined) return '';
  return String(val).slice(0, 256).replace(/[<>"']/g, '');
}

function sanitizeObj(obj) {
  if (!obj || typeof obj !== 'object') return {};
  var clean = {};
  Object.keys(obj).slice(0, 20).forEach(function(k) {
    clean[sanitize(k)] = sanitize(obj[k]);
  });
  return clean;
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
