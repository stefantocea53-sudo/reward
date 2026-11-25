// functions/api/event.js — endpoint tracking events (popup_shown, claim_click, back_attempt, etc.)
// POST /api/event cu JSON payload

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('cf-connecting-ip') || '';
    const country = request.headers.get('cf-ipcountry') || 'XX';
    const timestamp = new Date().toISOString();

    const eventType = sanitize(body.event || body.type || 'unknown');
    const allowedEvents = [
      'popup_shown', 'claim_click', 'back_attempt',
      'sw_fire', 'worker_fire', 'bc_fire', 'pageshow_fire',
      'visibility_fire', 'popstate_fire', 'tap_fire',
      'freq_cap_blocked', 'geo_blocked', 'cloak_triggered',
      'cta_click', 'countdown_expired'
    ];

    if (!allowedEvents.includes(eventType)) {
      return jsonResponse({ ok: false, reason: 'unknown_event' }, 400);
    }

    const record = {
      type: 'event',
      event: eventType,
      timestamp,
      ip,
      country,
      uid: sanitize(body.uid),
      fp: sanitize(body.fp),
      ab: sanitize(body.ab),
      delay: Number(body.delay) || 0,
      elapsed: Number(body.elapsed) || 0,
      params: sanitizeObj(body.params),
      meta: sanitizeObj(body.meta)
    };

    // KV storage
    if (env && env.TRAP_KV) {
      const key = `event:${eventType}:${timestamp}:${record.uid || ip}`;
      await env.TRAP_KV.put(key, JSON.stringify(record), {
        expirationTtl: 86400 * 30
      }).catch(() => {});

      // Increment counter per event type
      const counterKey = `counter:${eventType}`;
      const existing = await env.TRAP_KV.get(counterKey).catch(() => null);
      const count = parseInt(existing || '0') + 1;
      await env.TRAP_KV.put(counterKey, String(count)).catch(() => {});
    }

    // D1 storage
    if (env && env.TRAP_DB) {
      await env.TRAP_DB.prepare(
        `INSERT INTO events
         (uid, fp, event_type, country, ab, delay, elapsed, params, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        record.uid || '',
        record.fp || '',
        eventType,
        country,
        record.ab || '',
        record.delay,
        record.elapsed,
        JSON.stringify(record.params),
        timestamp
      ).run().catch(() => {});
    }

    return jsonResponse({ ok: true, event: eventType, ts: timestamp });

  } catch (e) {
    return jsonResponse({ ok: false }, 400);
  }
}

export async function onRequestGet(context) {
  return jsonResponse({ status: 'ok', endpoint: 'event' });
}

// === HELPERS ===
function sanitize(val) {
  if (val === null || val === undefined) return '';
  return String(val).slice(0, 128).replace(/[<>"']/g, '');
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
