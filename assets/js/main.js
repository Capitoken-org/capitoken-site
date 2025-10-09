
// ================== CONFIGURA AQUÍ ==================
// Fecha/hora de lanzamiento en **UTC** (formato ISO 8601)
const LAUNCH_ISO = "2025-10-17T19:17:17Z";
// ====================================================

const $d = document.getElementById("d");
const $h = document.getElementById("h");
const $m = document.getElementById("m");
const $s = document.getElementById("s");
const $year = document.getElementById("y");

$year.textContent = new Date().getFullYear();

const launch = new Date(LAUNCH_ISO).getTime();

function pad(n) { return String(n).padStart(2, "0"); }

function tick() {
  const now = Date.now();
  let diff = Math.max(0, launch - now);

  const days = Math.floor(diff / 86400000);
  diff %= 86400000;
  const hours = Math.floor(diff / 3600000);
  diff %= 3600000;
  const mins = Math.floor(diff / 60000);
  diff %= 60000;
  const secs = Math.floor(diff / 1000);

  $d.textContent = days;
  $h.textContent = pad(hours);
  $m.textContent = pad(mins);
  $s.textContent = pad(secs);
}

tick();
setInterval(tick, 1000);

// TIP: si tu reloj local debe coincidir con otra zona,
// no cambies el navegador; cambia LAUNCH_ISO a la hora
// equivalente en UTC.
