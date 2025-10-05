// Fecha de lanzamiento (UTC)
const LAUNCH_ISO = "2025-10-17T23:17:17Z";

const d = document.getElementById('d');
const h = document.getElementById('h');
const m = document.getElementById('m');
const s = document.getElementById('s');

function pad(n){ return n.toString().padStart(2,'0'); }

function tick(){
  if(!LAUNCH_ISO) return;
  const now = new Date();
  const target = new Date(LAUNCH_ISO);
  let diff = Math.max(0, target - now);
  const dd = Math.floor(diff/86400000); diff -= dd*86400000;
  const hh = Math.floor(diff/3600000);  diff -= hh*3600000;
  const mm = Math.floor(diff/60000);    diff -= mm*60000;
  const ss = Math.floor(diff/1000);

  d.textContent = pad(dd);
  h.textContent = pad(hh);
  m.textContent = pad(mm);
  s.textContent = pad(ss);
}
tick(); setInterval(tick, 1000);
