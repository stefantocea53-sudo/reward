// worker-timer.js v2 — heartbeat mutual cu SW (ID 6)
// rulează pe thread separat, Android nu îl killă
// trimite ping la SW la fiecare 10s cu elapsed curent
// dacă SW răspunde cu pong.fired = true → postMessage('fire') la pagină

var start = Date.now();
var delay = 20000; // suprascris de pagină via postMessage
var fired = false;
var swPort = null;
var CH_HB = 'hb_default'; // suprascris de pagină la init — nu e niciodată vizibil în prod

// Timer principal — verifică la 500ms
var timerIv = setInterval(function() {
  if (fired) return;
  var elapsed = Date.now() - start;
  if (elapsed >= delay) {
    fired = true;
    clearInterval(timerIv);
    postMessage('fire');
  }
}, 500);

// Heartbeat ping la SW la fiecare 10s (ID 6)
// Ține SW-ul activ și sincronizează starea timerului
var heartbeatIv = setInterval(function() {
  var elapsed = Date.now() - start;
  // Trimitem ping la SW prin BroadcastChannel
  // (worker nu are acces direct la SW, dar poate comunica prin BC)
  try {
    var bc = new BroadcastChannel(CH_HB);
    bc.postMessage({
      type: 'ping',
      elapsed: elapsed,
      delay: delay,
      fired: fired,
      ts: Date.now()
    });
    bc.close();
  } catch(e) {}
}, 10000);

// Primim mesaje de la pagina principală
self.onmessage = function(e) {
  var data = e.data;
  if (!data) return;

  if (data.type === 'init' || data.delay) {
    // Pagina ne trimite delay-ul din A/B test + channel name
    delay = data.delay || 20000;
    if (data.chHb) CH_HB = data.chHb;
    start = Date.now();
    fired = false;
  }

  if (data === 'reset' || (data.type === 'reset')) {
    start = Date.now();
    fired = false;
  }

  // SW ne trimite pong prin pagină (relayed)
  if (data.type === 'pong') {
    if (data.fired && !fired) {
      fired = true;
      postMessage('fire');
    }
  }

  if (data === 'ping') {
    postMessage({
      type: 'status',
      elapsed: Date.now() - start,
      delay: delay,
      fired: fired
    });
  }
};
