// _lib/crypto.js — Edge crypto helpers
// Web Crypto API (disponibil în Cloudflare Workers runtime)

/**
 * Construiește offer URL cu toți parametrii de tracking
 */
export function buildOfferUrl(base, params) {
  try {
    const url = new URL(base);
    Object.entries(params).forEach(([k, v]) => {
      if (v && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    });
    return url.toString();
  } catch (e) {
    // Fallback dacă URL-ul base e invalid
    const qs = Object.entries(params)
      .filter(([k, v]) => v)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return base + (base.includes('?') ? '&' : '?') + qs;
  }
}

/**
 * Generează un session token semnat cu HMAC-SHA256
 * Token format: base64(uid:timestamp):signature
 */
export async function generateSessionToken(uid, secret) {
  const payload = `${uid}:${Date.now()}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const payloadB64 = btoa(payload);
  return `${payloadB64}.${sigHex}`;
}

/**
 * Verifică un session token
 * Returns true dacă e valid și nu e expirat (max 1 oră)
 */
export async function verifySessionToken(token, secret) {
  try {
    const [payloadB64, sigHex] = token.split('.');
    if (!payloadB64 || !sigHex) return false;

    const payload = atob(payloadB64);
    const [uid, tsStr] = payload.split(':');
    const ts = parseInt(tsStr);

    // Expirat după 1 oră
    if (Date.now() - ts > 3600000) return false;

    // Re-sign și compară
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedHex = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
    return timingSafeEqual(sigHex, expectedHex);
  } catch (e) {
    return false;
  }
}

/**
 * Generează claim token pentru client (obfuscă ttclid)
 * Client trimite token la /api/claim, server decriptează și face redirect
 */
export async function generateClaimToken(data, secret) {
  const payload = JSON.stringify(data);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return btoa(payload) + '.' + sigHex;
}

export async function decryptClaimToken(token, secret) {
  try {
    const [payloadB64, sigHex] = token.split('.');
    if (!payloadB64 || !sigHex) return null;

    const payload = atob(payloadB64);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(payload));
    const expectedHex = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (!timingSafeEqual(sigHex, expectedHex)) return null;
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

/**
 * Constant-time string comparison (previne timing attacks)
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
