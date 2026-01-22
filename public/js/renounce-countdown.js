/**
 * renounce-countdown.js
 * Shows a live countdown in the navbar to the planned ownership renounce moment.
 * Target: 2026-04-17 19:17 (UTC)  — keeps consistent regardless of viewer timezone.
 */
import { CAPI } from "./capi-config.js";

const TARGET_ISO_UTC = (CAPI?.renounce?.targetUtcIso) || "2026-04-17T19:17:00Z";
const targetMs = Date.parse(TARGET_ISO_UTC);

const $ = (id) => document.getElementById(id);

const el = {
  wrap: $("navRenounce"),
  label: $("renounceLabel"),
  d: $("renDays"),
  h: $("renHours"),
  m: $("renMins"),
  s: $("renSecs"),
};

const pad2 = (n) => String(Math.max(0, n|0)).padStart(2, "0");

function setText(node, text){
  if (!node) return;
  node.textContent = text;
}

function tick(){
  if (!el.wrap) return;
  const now = Date.now();
  let diff = targetMs - now;

  // If target missing/invalid, keep discreet placeholders
  if (!Number.isFinite(targetMs)){
    setText(el.label, "RENUNCIA:");
    setText(el.d, "—"); setText(el.h, "—"); setText(el.m, "—"); setText(el.s, "—");
    return;
  }

  if (diff <= 0){
    setText(el.label, "RENUNCIADO ✅");
    setText(el.d, "00"); setText(el.h, "00"); setText(el.m, "00"); setText(el.s, "00");
    return;
  }

  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  setText(el.label, "RENUNCIA EN:");
  setText(el.d, pad2(days));
  setText(el.h, pad2(hours));
  setText(el.m, pad2(mins));
  setText(el.s, pad2(secs));
}

// Start
document.addEventListener("DOMContentLoaded", () => {
  tick();
  // Smooth, low-cost interval
  window.setInterval(tick, 1000);
});
