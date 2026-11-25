// functions/api/health.js — health check endpoint
// GET /api/health — returnează status 200 cu info de bază

export async function onRequestGet(context) {
  const { request, env } = context;
  const country = request.headers.get('cf-ipcountry') || 'XX';
  const ray = request.headers.get('cf-ray') || '';
  const colo = request.headers.get('cf-ipcountry') || '';

  const status = {
    ok: true,
    ts: new Date().toISOString(),
    country,
    ray,
    version: '1.0.0',
    env: {
      kv: !!(env && env.TRAP_KV),
      db: !!(env && env.TRAP_DB)
    }
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  });
}
