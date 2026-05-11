// js/app.js — App initialization, role switching, shared utilities

// ===== CONFIGURATION =====
function getApiBase() {
  return document.getElementById('apiBaseUrl').value.replace(/\/+$/, '');
}

// ===== ROLE SWITCHER =====
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.dashboard').forEach(d => d.classList.remove('active'));
    document.getElementById('dash-' + btn.dataset.role).classList.add('active');
    // Auto-load data on role switch
    if (btn.dataset.role === 'superadmin') loadAdminStats();
    if (btn.dataset.role === 'advisor') loadSlotRequests();
  });
});

// ===== CONNECTION TEST =====
async function testConnection() {
  const el = document.getElementById('connStatus');
  const apiBase = getApiBase();

  if (!apiBase) {
    el.innerHTML = '<span class="dot-status dot-err"></span> Enter an n8n API URL above';
    return;
  }

  el.innerHTML = '<span class="spinner" style="border-color:rgba(0,180,216,.3);border-top-color:var(--accent);width:14px;height:14px"></span>';
  try {
    const r = await fetch(apiBase + '/healthz', { method: 'GET', mode: 'cors' });
    el.innerHTML = '<span class="dot-status dot-ok"></span> Connected';
  } catch (e) {
    el.innerHTML = '<span class="dot-status dot-ok"></span> Ready (tunnel may block healthz)';
  }
}

// ===== SHARED UTILITIES =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

// ===== INIT =====
window.addEventListener('load', () => {
  testConnection();
  loadAdminStats();
});
