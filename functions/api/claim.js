// functions/api/claim.js — server-side offer URL redirect
// Clientul NU vede niciodată OFFER_URL în plaintext
// POST /api/claim { token, uid, ttclid, sub1, ... } → 302 Redirect
// GET  /api/claim?token=...                          → 302 Redirect

// OFFER_URL se pune în Cloudflare Pages env var: OFFER_URL
// wrangler pages secret put OFFER_URL

import { buildOfferUrl, verifySessionToken, generateClaimToken } from '../_lib/crypto.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  return handleClaim(request, env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  return handleClaim(request, env);
}

async function handleClaim(request, env) {
  const url = new URL(request.url);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const country = request.headers.get('cf-ipcountry') || 'XX';
  const ua = request.headers.get('user-agent') || '';
  const timestamp = new Date().toISOString();

  // Citește params din body (POST) sau URL (GET)
  let params = {};
  if (request.method === 'POST') {
    try {
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        params = await request.json();
      } else {
        const form = await request.formData();
        for (const [k, v] of form.entries()) params[k] = v;
      }
    } catch (e) {}
  } else {
    for (const [k, v] of url.searchParams.entries()) params[k] = v;
  }

  // Validare token sesiune (opțional — dacă CLAIM_SECRET e setat)
  const secret = env.CLAIM_SECRET || '';
  if (secret && params.token) {
    const valid = await verifySessionToken(params.token, secret).catch(() => false);
    if (!valid) {
      return new Response('Invalid token', { status: 403 });
    }
  }

  // Rate limiting simplu via KV (max 3 claim-uri per IP per oră)
  if (env.TRAP_KV) {
    const rateKey = `rate:claim:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const count = parseInt(await env.TRAP_KV.get(rateKey).catch(() => '0') || '0');
    if (count > 10) {
      return Response.redirect('https://google.com', 302);
    }
    await env.TRAP_KV.put(rateKey, String(count + 1), { expirationTtl: 3600 }).catch(() => {});
  }

  // Obține OFFER_URL din env (niciodată în client code)
  const offerBase = env.OFFER_URL || 'RECO_AFFILIATE_LINK_AICI';

  // Construiește URL-ul final cu toți parametrii de tracking
  const finalUrl = buildOfferUrl(offerBase, {
    ttclid: sanitize(params.ttclid || params.clickid || params.click_id || ''),
    sub1:   sanitize(params.sub1 || ''),
    sub2:   sanitize(params.sub2 || ''),
    sub3:   sanitize(params.sub3 || ''),
    aff_id: sanitize(params.aff_id || ''),
    campaign: sanitize(params.campaign || ''),
    creative_id: sanitize(params.creative_id || ''),
    uid:    sanitize(params.uid || ''),
    fp:     sanitize(params.fp || ''),
    ab:     sanitize(params.ab || ''),
    country,
    ts:     Date.now().toString()
  });

  // Log event
  if (env.TRAP_KV) {
    const record = {
      type: 'claim',
      timestamp,
      ip,
      country,
      ua,
      uid: sanitize(params.uid || ''),
      fp: sanitize(params.fp || ''),
      ab: sanitize(params.ab || ''),
      ttclid: sanitize(params.ttclid || ''),
      sub1: sanitize(params.sub1 || '')
    };
    const key = `claim:${timestamp}:${record.uid || ip}`;
    await env.TRAP_KV.put(key, JSON.stringify(record), {
      expirationTtl: 86400 * 30
    }).catch(() => {});
  }

  // 302 Redirect — browserul urmărește, clientul nu vede URL-ul
  return Response.redirect(finalUrl, 302);
}

// === HELPERS ===
function sanitize(val) {
  if (!val) return '';
  return String(val).slice(0, 256).replace(/[<>"'\s]/g, '');
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
