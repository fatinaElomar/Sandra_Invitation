'use strict';

/* ══════════════════════════════════════════════════════════
   JHONY & SANDRA — app.js
   ──────────────────────────────────────────────────────────
   SETUP: Paste your Google Apps Script Web App URL below.
   Leave it empty and the form still saves to localStorage
   so you never lose a response.
══════════════════════════════════════════════════════════ */

// ▼▼▼  PASTE YOUR APPS SCRIPT URL HERE  ▼▼▼
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzM3kuz6Y8LWIZJfo8TMd_3IhkWDE5ZfJrzPAsfTBD5CsFhGpDZd1an52V-YyNFjGiB4A/exec';
// ▲▲▲  ─────────────────────────────────  ▲▲▲

const STORAGE_KEY = 'jhony_sandra_rsvp_v2';

// ── localStorage helpers ──────────────────────────────────
function loadGuests() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveGuests(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Countdown ─────────────────────────────────────────────
function tick() {
  const target = new Date('2026-10-10T17:00:00');
  const diff   = target - new Date();
  const pad    = n => String(Math.max(0, n)).padStart(2, '0');

  if (diff <= 0) {
    ['days','hours','mins','secs'].forEach(id => {
      const el = document.getElementById('cd-' + id);
      if (el) el.textContent = '00';
    });
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000)  / 60000);
  const s = Math.floor((diff % 60000)    / 1000);

  ['days','hours','mins','secs'].forEach((id, i) => {
    const el = document.getElementById('cd-' + id);
    if (el) el.textContent = pad([d,h,m,s][i]);
  });
}

// ── Guest counter ─────────────────────────────────────────
function refreshCounter() {
  const el = document.getElementById('rsvpCount');
  if (el) el.textContent = loadGuests().length;
}

// ── Validation ────────────────────────────────────────────
function clearErrors() {
  document.querySelectorAll('.f-err').forEach(e => (e.textContent = ''));
  document.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
}
function setError(id, msg) {
  const field = document.getElementById(id);
  const err   = document.getElementById('err-' + id);
  if (field) field.classList.add('invalid');
  if (err)   err.textContent = msg;
}
function validate(d) {
  let ok = true;
  clearErrors();
  if (!d.fullName) { setError('fullName', 'Full name is required.'); ok = false; }
  if (!d.phone)    { setError('phone', 'Phone number is required.'); ok = false; }
  else if (!/^[\d\s+\-()]{6,20}$/.test(d.phone)) {
    setError('phone', 'Please enter a valid phone number.'); ok = false;
  }
  if (!d.attendance) { setError('attendance', 'Please select your attendance.'); ok = false; }
  if (!d.guests || d.guests < 1 || d.guests > 20) {
    setError('guests', 'Enter a number between 1 and 20.'); ok = false;
  }
  return ok;
}

// ── Status banner ─────────────────────────────────────────
function showStatus(type, msg) {
  const el = document.getElementById('submitStatus');
  if (!el) return;
  el.className = 'submit-status ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}
function hideStatus() {
  const el = document.getElementById('submitStatus');
  if (el) el.style.display = 'none';
}

// ── Send to Google Sheets ─────────────────────────────────
async function sendToGoogleSheet(data) {
  if (!SHEET_URL || SHEET_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    // No URL configured — skip silently, data already in localStorage
    return { ok: true, local: true };
  }

  // Use text/plain to avoid CORS preflight rejection from Google Apps Script
  await fetch(SHEET_URL, {
    method:  'POST',
    mode:    'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify(data),
  });

  return { ok: true };
}

// ── Submit handler ────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const get = id => document.getElementById(id)?.value?.trim() ?? '';

  const data = {
    fullName:   get('fullName'),
    phone:      get('phone'),
    attendance: get('attendance'),
    guests:     parseInt(get('guests'), 10) || 0,
    message:    get('message'),
    timestamp:  new Date().toLocaleString('en-GB'),
  };

  if (!validate(data)) return;

  // Disable button while sending
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  showStatus('sending', '⏳  Sending your RSVP response…');

  // 1. Save locally first (never lose data)
  const list = loadGuests();
  list.push(data);
  saveGuests(list);
  refreshCounter();

  // 2. Send to Google Sheets
  try {
    await sendToGoogleSheet(data);
    hideStatus();
    showSuccessPanel(data);
  } catch (err) {
    console.error('Submission error:', err);
    hideStatus();
    showSuccessPanel(data);
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Send RSVP ♥'; }
}

function showSuccessPanel(data) {
  const form    = document.getElementById('rsvpForm');
  const success = document.getElementById('successCard');
  const msg     = document.getElementById('successMsg');

  form.style.display = 'none';

  msg.textContent = data.attendance.startsWith('No')
    ? "We're sorry you can't make it. Thank you for letting us know — we'll miss you!"
    : "Your RSVP has been received! We can't wait to celebrate with you on October 10th! 🎉";

  success.style.display = 'block';
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Reset form ────────────────────────────────────────────
function resetForm() {
  const form    = document.getElementById('rsvpForm');
  const success = document.getElementById('successCard');
  form.reset();
  clearErrors();
  hideStatus();
  success.style.display = 'none';
  form.style.display    = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Excel export (local backup) ───────────────────────────
function exportToExcel() {
  const list = loadGuests();

  if (!list.length) {
    alert('No RSVP responses yet.\nSubmit at least one response first.');
    return;
  }

  const headers = [
    'Full Name', 'Phone Number',
    'Attendance', 'Guests (#)', 'Message', 'Submitted At'
  ];
  const rows = list.map(g => [
    g.fullName   || '',
    g.phone      || '',
    g.attendance || '',
    g.guests     || '',
    g.message    || '',
    g.timestamp  || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:26},{wch:18},{wch:34},
    {wch:12},{wch:40},{wch:22}
  ];

  /* Summary sheet */
  const attending  = list.filter(g => !g.attendance?.startsWith('No'));
  const notAttend  = list.filter(g =>  g.attendance?.startsWith('No'));
  const totalHeads = attending.reduce((s, g) => s + (parseInt(g.guests) || 0), 0);

  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['Jhony & Sandra Wedding — RSVP Summary'],
    [''],
    ['Wedding Date',         'Saturday, October 10, 2025'],
    ['Ceremony',             'Edbel Church — 5:00 PM'],
    ['Reception',            'Glamour Garden — 7:00 PM'],
    [''],
    ['Total Responses',      list.length],
    ['Attending',            attending.length],
    ['Not Attending',        notAttend.length],
    ['Total Guests (heads)', totalHeads],
    [''],
    ['Report Generated',     new Date().toLocaleString('en-GB')],
  ]);
  wsSummary['!cols'] = [{wch:30},{wch:36}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,        'Guest List');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.writeFile(wb, 'Jhony_Sandra_RSVP_GuestList.xlsx');
}

// ── Scroll reveal ─────────────────────────────────────────
function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('revealed');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.std-card, .rsvp-section').forEach(el => {
    el.classList.add('reveal');
    io.observe(el);
  });
}

// ══════════════════════════════════════════════════════════
// BACKGROUND CANVAS ANIMATION
// Three layers: gold dust particles · falling hearts · sparkle bursts
// ══════════════════════════════════════════════════════════
function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ── Resize handler ──────────────────────────────────────
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Gold palette ────────────────────────────────────────
  const GOLD  = ['rgba(201,168,76,', 'rgba(232,208,143,', 'rgba(255,236,180,', 'rgba(180,140,50,'];
  function goldColor(alpha) {
    return GOLD[Math.floor(Math.random() * GOLD.length)] + alpha + ')';
  }

  const rand  = (a, b) => Math.random() * (b - a) + a;
  const randI = (a, b) => Math.floor(rand(a, b));

  // ══════════════════════════════════════════════════════
  // Layer 1 — Floating gold dust particles
  // ══════════════════════════════════════════════════════
  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x     = rand(0, canvas.width);
      this.y     = initial ? rand(0, canvas.height) : canvas.height + 10;
      this.r     = rand(0.6, 2.4);
      this.vx    = rand(-0.3, 0.3);
      this.vy    = rand(-0.6, -1.4);
      this.alpha = 0;
      this.maxA  = rand(0.25, 0.65);
      this.fade  = rand(0.008, 0.02);
      this.phase = initial ? 'hold' : 'in';
      this.life  = rand(120, 260);
      this.age   = 0;
      this.color = goldColor(this.maxA);
    }
    update() {
      this.x += this.vx + Math.sin(this.age * 0.04) * 0.3;
      this.y += this.vy;
      this.age++;
      if (this.phase === 'in')   { this.alpha = Math.min(this.alpha + this.fade, this.maxA); if (this.alpha >= this.maxA) this.phase = 'hold'; }
      if (this.phase === 'hold') { if (this.age > this.life) this.phase = 'out'; }
      if (this.phase === 'out')  { this.alpha -= this.fade * 0.7; }
      if (this.alpha <= 0 || this.y < -10) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = goldColor(this.alpha);
      ctx.fill();
    }
  }

  // ══════════════════════════════════════════════════════
  // Layer 2 — Falling hearts
  // ══════════════════════════════════════════════════════
  class Heart {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x     = rand(0, canvas.width);
      this.y     = initial ? rand(-20, canvas.height) : rand(-60, -10);
      this.size  = rand(6, 18);
      this.vx    = rand(-0.4, 0.4);
      this.vy    = rand(0.4, 1.1);
      this.alpha = rand(0.08, 0.28);
      this.rot   = rand(0, Math.PI * 2);
      this.rotV  = rand(-0.015, 0.015);
      this.swing = rand(0, Math.PI * 2);
      this.swingA= rand(0.3, 0.9);
    }
    update() {
      this.y    += this.vy;
      this.x    += this.vx + Math.sin(this.swing) * 0.3;
      this.rot  += this.rotV;
      this.swing += 0.025;
      if (this.y > canvas.height + 30) this.reset();
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.globalAlpha = this.alpha;
      ctx.font = `${this.size}px serif`;
      ctx.fillStyle = goldColor(this.alpha);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2665', 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ══════════════════════════════════════════════════════
  // Layer 3 — Sparkle bursts (4-point star ✦)
  // ══════════════════════════════════════════════════════
  class Sparkle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x     = rand(0, canvas.width);
      this.y     = initial ? rand(0, canvas.height) : rand(0, canvas.height);
      this.size  = rand(3, 9);
      this.alpha = 0;
      this.maxA  = rand(0.15, 0.55);
      this.speed = rand(0.012, 0.03);
      this.phase = 'in';
      this.delay = randI(0, 200);
      this.age   = -this.delay;
    }
    update() {
      this.age++;
      if (this.age < 0) return;
      if (this.phase === 'in')  { this.alpha += this.speed; if (this.alpha >= this.maxA) { this.alpha = this.maxA; this.phase = 'out'; } }
      if (this.phase === 'out') { this.alpha -= this.speed * 0.7; if (this.alpha <= 0) this.reset(); }
    }
    draw() {
      if (this.age < 0 || this.alpha <= 0) return;
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = this.alpha;
      ctx.strokeStyle = goldColor(this.alpha);
      ctx.lineWidth   = 0.8;
      // 4-point star
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(0, s);
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
      ctx.stroke();
      // Diagonal shorter arms
      const d = s * 0.45;
      ctx.beginPath();
      ctx.moveTo(-d, -d); ctx.lineTo(d, d);
      ctx.moveTo(d, -d);  ctx.lineTo(-d, d);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ── Build pools ──────────────────────────────────────────
  const particles = Array.from({ length: 80  }, () => new Particle());
  const hearts    = Array.from({ length: 22  }, () => new Heart());
  const sparkles  = Array.from({ length: 40  }, () => new Sparkle());

  // ── Render loop ──────────────────────────────────────────
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle radial vignette glow at top (gold tint)
    const grad = ctx.createRadialGradient(
      canvas.width / 2, 0, 0,
      canvas.width / 2, 0, canvas.height * 0.65
    );
    grad.addColorStop(0,   'rgba(201,168,76,0.04)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => { p.update(); p.draw(); });
    hearts   .forEach(h => { h.update(); h.draw(); });
    sparkles .forEach(s => { s.update(); s.draw(); });

    requestAnimationFrame(frame);
  }
  frame();
}


document.addEventListener('DOMContentLoaded', () => {
  initBackground();            // ← animated canvas background
  tick();
  setInterval(tick, 1000);
  refreshCounter();
  initReveal();

  const form = document.getElementById('rsvpForm');
  if (form) form.addEventListener('submit', handleSubmit);
});
