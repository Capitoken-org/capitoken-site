const countdown = document.getElementById('countdown');
const LAUNCH_ISO = "2025-12-01T17:00:00Z";

function updateCountdown() {
  const now = new Date();
  const launch = new Date(LAUNCH_ISO);
  const diff = launch - now;
  if (diff <= 0) {
    countdown.textContent = "🚀 We are live!";
    return;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  countdown.textContent = `${days}d ${hours}h ${minutes}m`;
}

setInterval(updateCountdown, 60000);
updateCountdown();
