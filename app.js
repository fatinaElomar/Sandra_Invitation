'use strict';

/* ══════════════════════════════════════════════════════════
   JHONY & SANDRA — app.js
   ──────────────────────────────────────────────────────────
   SETUP: Paste your Google Apps Script Web App URL below.
   Leave it empty and the form still saves to localStorage
   so you never lose a response.
══════════════════════════════════════════════════════════ */

// ▼▼▼  PASTE YOUR APPS SCRIPT URL HERE  ▼▼▼
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwi6Fgke5l_VzAICB5-jfU35B3a1U-b4HtIbh8dafaq-u6zWt3yAjw5Sm5aG1K8t6Rq/exec';
// ▲▲▲  ─────────────────────────────────  ▲▲▲

const STORAGE_KEY = 'jhony_sandra_rsvp_v2';

// ── Guest limit (default 2; updated live from Google Sheet) ──
const DEFAULT_MAX_GUESTS = 2;
let allowedGuestsForName = DEFAULT_MAX_GUESTS;

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
  const diff = target - new Date();
  const pad = n => String(Math.max(0, n)).padStart(2, '0');

  if (diff <= 0) {
    ['days', 'hours', 'mins', 'secs'].forEach(id => {
      const el = document.getElementById('cd-' + id);
      if (el) el.textContent = '00';
    });
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  ['days', 'hours', 'mins', 'secs'].forEach((id, i) => {
    const el = document.getElementById('cd-' + id);
    if (el) el.textContent = pad([d, h, m, s][i]);
  });
}

// ── Guest counter ─────────────────────────────────────────
function refreshCounter() {
  const el = document.getElementById('rsvpCount');
  if (el) el.textContent = loadGuests().length;
}

// ── Validation Helpers ────────────────────────────────────
function clearError(id) {
  const field = document.getElementById(id);
  const err = document.getElementById('err-' + id);
  if (field) {
    field.classList.remove('invalid');
    field.removeAttribute('aria-invalid');
  }
  if (err) err.textContent = '';
}

function clearAllErrors() {
  ['fullName', 'phone', 'attendance', 'guests', 'message'].forEach(clearError);
  hideStatus();
}

function setError(id, msg) {
  const field = document.getElementById(id);
  const err = document.getElementById('err-' + id);
  if (field) {
    field.classList.add('invalid');
    field.setAttribute('aria-invalid', 'true');
  }
  if (err) err.textContent = msg;
}

// ── Single Field Validator ────────────────────────────────
function validateField(id) {
  const el = document.getElementById(id);
  if (!el) return true;
  const val = el.value.trim();

  if (id === 'fullName') {
    if (!val) {
      setError('fullName', 'Full name is required.');
      return false;
    }
    if (val.length < 2) {
      setError('fullName', 'Please enter your full name (at least 2 characters).');
      return false;
    }
    if (/^[\d\W_]+$/.test(val)) {
      setError('fullName', 'Please enter a valid name.');
      return false;
    }
    clearError('fullName');
    return true;
  }

  if (id === 'phone') {
    if (!val) {
      setError('phone', 'Phone number is required.');
      return false;
    }
    const digits = val.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('phone', 'Please enter a valid phone number (e.g. 70-123 456).');
      return false;
    }
    clearError('phone');
    return true;
  }

  if (id === 'attendance') {
    if (!val || val === '') {
      setError('attendance', 'Please select whether you will attend.');
      return false;
    }
    clearError('attendance');
    return true;
  }

  if (id === 'guests') {
    const att = document.getElementById('attendance')?.value || '';
    const isUnable = att.toLowerCase().includes('unable');
    if (isUnable) {
      clearError('guests');
      return true;
    }
    const num = parseInt(val, 10);
    if (!val || isNaN(num)) {
      setError('guests', 'Number of guests is required.');
      return false;
    }
    if (num < 1) {
      setError('guests', 'Minimum is 1 guest.');
      return false;
    }
    if (num > allowedGuestsForName) {
      setError('guests', `Maximum is ${allowedGuestsForName} guest(s) for your invitation.`);
      return false;
    }
    clearError('guests');
    return true;
  }

  if (id === 'message') {
    if (val.length > 500) {
      setError('message', 'Message is too long (maximum 500 characters).');
      return false;
    }
    clearError('message');
    return true;
  }

  return true;
}

// ── Phone Auto-Decorator (XX-XXX XXX) ────────────────────
function formatPhoneNumber(val) {
  if (!val) return '';
  const isPlus = val.trim().startsWith('+');
  let digits = val.replace(/\D/g, '');

  if (isPlus) {
    if (digits.startsWith('961')) {
      const rest = digits.slice(3, 11);
      let res = '+961';
      if (rest.length > 0) res += ' ' + rest.slice(0, 2);
      if (rest.length > 2) res += '-' + rest.slice(2, 5);
      if (rest.length > 5) res += ' ' + rest.slice(5, 8);
      return res;
    }
    return '+' + digits.slice(0, 15);
  }

  // Format: XX-XXX XXX
  digits = digits.slice(0, 8);
  let res = '';
  if (digits.length > 0) {
    res = digits.slice(0, 2);
  }
  if (digits.length > 2) {
    res += '-' + digits.slice(2, 5);
  }
  if (digits.length > 5) {
    res += ' ' + digits.slice(5, 8);
  }
  return res;
}

// ── Validate Entire Form ──────────────────────────────────
function validateForm() {
  let firstInvalid = null;
  const fields = ['fullName', 'phone', 'attendance', 'guests', 'message'];
  let isValid = true;

  fields.forEach(id => {
    const ok = validateField(id);
    if (!ok) {
      isValid = false;
      if (!firstInvalid) firstInvalid = document.getElementById(id);
    }
  });

  if (!isValid && firstInvalid) {
    const form = document.getElementById('rsvpForm');
    if (form) {
      form.classList.remove('form-shake');
      void form.offsetWidth; // Trigger reflow
      form.classList.add('form-shake');
    }
    firstInvalid.focus();
  }

  return isValid;
}

// ── Live name lookup — updates max guests from Google Sheet ──
async function lookupGuestLimit(name) {
  if (!SHEET_URL || SHEET_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;
  if (!name || name.length < 2) return;

  const guestsInput = document.getElementById('guests');
  const guestHint = document.getElementById('guest-limit-hint');

  try {
    // Build the GET URL using the same base URL (replace /exec with /exec?checkName=...)
    const url = SHEET_URL + '?checkName=' + encodeURIComponent(name);
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();

    if (data.found && data.maxGuests) {
      allowedGuestsForName = data.maxGuests;
    } else {
      allowedGuestsForName = DEFAULT_MAX_GUESTS;
    }
  } catch (_) {
    allowedGuestsForName = DEFAULT_MAX_GUESTS;
  }

  // Update the input's max attribute
  if (guestsInput) {
    guestsInput.max = allowedGuestsForName;
    // Clamp current value if it exceeds new max
    const cur = parseInt(guestsInput.value, 10);
    if (cur > allowedGuestsForName) guestsInput.value = allowedGuestsForName;
  }

  // Show subtle hint
  if (guestHint) {
    guestHint.textContent = `Up to ${allowedGuestsForName} guest(s) allowed for your invitation`;
    guestHint.style.display = 'block';
  }

  // Re-run guest validation with updated limit
  validateField('guests');
}

// ── Setup Real-time Validation Listeners ──────────────────
function initValidation() {
  const fields = ['fullName', 'phone', 'attendance', 'guests', 'message'];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Validate when user leaves the input
    el.addEventListener('blur', () => {
      validateField(id);
    });

    // Clear error live while typing once valid
    el.addEventListener('input', () => {
      if (el.classList.contains('invalid')) {
        validateField(id);
      }
    });
  });

  // Phone auto-decoration on input
  const phoneEl = document.getElementById('phone');
  if (phoneEl) {
    phoneEl.addEventListener('input', (e) => {
      phoneEl.value = formatPhoneNumber(phoneEl.value);
      if (phoneEl.classList.contains('invalid')) {
        validateField('phone');
      }
    });
  }

  // ── Live name lookup on fullName blur ─────────────────────
  const nameEl = document.getElementById('fullName');
  if (nameEl) {
    nameEl.addEventListener('blur', () => {
      const name = nameEl.value.trim();
      if (name.length >= 2) lookupGuestLimit(name);
    });
  }

  // Dynamic behavior when attendance option changes
  const attendanceSelect = document.getElementById('attendance');
  const guestsInput = document.getElementById('guests');
  if (attendanceSelect) {
    attendanceSelect.addEventListener('change', () => {
      validateField('attendance');
      const val = attendanceSelect.value;
      if (val.toLowerCase().includes('unable')) {
        clearError('guests');
        if (guestsInput) {
          guestsInput.value = '0';
          guestsInput.style.opacity = '0.5';
        }
      } else {
        if (guestsInput) {
          guestsInput.style.opacity = '1';
          if (!guestsInput.value || guestsInput.value === '0') {
            guestsInput.value = '1';
          }
        }
        validateField('guests');
      }
    });
  }
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
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  });

  return { ok: true };
}

// ── Submit handler ────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    showStatus('error', '⚠️ Please complete all required fields correctly.');
    return;
  }

  const get = id => document.getElementById(id)?.value?.trim() ?? '';
  const isUnable = get('attendance').toLowerCase().includes('unable');

  const data = {
    fullName: get('fullName'),
    phone: get('phone'),
    attendance: get('attendance'),
    guests: isUnable ? 0 : (parseInt(get('guests'), 10) || 1),
    message: get('message'),
    timestamp: new Date().toLocaleString('en-GB'),
  };

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
  const form = document.getElementById('rsvpForm');
  const success = document.getElementById('successCard');
  const msg = document.getElementById('successMsg');

  form.style.display = 'none';

  const isAttending = data.attendance?.toLowerCase().startsWith('yes');

  msg.textContent = !isAttending
    ? "We're sorry you can't make it. Thank you for letting us know — we'll miss you!"
    : "Your RSVP has been received! We can't wait to celebrate with you on October 10th! 🎉";

  success.style.display = 'block';
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Reset form ────────────────────────────────────────────
function resetForm() {
  const form = document.getElementById('rsvpForm');
  const success = document.getElementById('successCard');
  form.reset();
  clearAllErrors();
  hideStatus();
  success.style.display = 'none';
  form.style.display = 'block';
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
    g.fullName || '',
    g.phone || '',
    g.attendance || '',
    g.guests || '',
    g.message || '',
    g.timestamp || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 26 }, { wch: 18 }, { wch: 34 },
    { wch: 12 }, { wch: 40 }, { wch: 22 }
  ];

  /* Summary sheet */
  const attending = list.filter(g => g.attendance?.toLowerCase().startsWith('yes'));
  const notAttend = list.filter(g => !g.attendance?.toLowerCase().startsWith('yes'));
  const totalAttended = attending.reduce((s, g) => s + (parseInt(g.guests) || 0), 0);
  const totalInvited = list.reduce((s, g) => s + (parseInt(g.guests) || 0), 0);

  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['Jhony & Sandra Wedding — RSVP Summary'],
    [''],
    ['Wedding Date', 'Saturday, October 10, 2026'],
    ['Ceremony', 'Edbel Church — 5:00 PM'],
    ['Reception', 'Glamour Garden — 7:00 PM'],
    [''],
    ['Total Attending Guests', totalAttended],
    ['Total Invited People', totalInvited],
    ['Total RSVP Responses', list.length],
    ['Not Attending Count', notAttend.length],
    [''],
    ['Report Generated', new Date().toLocaleString('en-GB')],
  ]);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 36 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Guest List');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.writeFile(wb, 'Jhony_Sandra_RSVP_GuestList.xlsx');
}

// ── Scroll Reveal, Progressive "Magic Typing" & Parallax ──
function initProgressiveScrollReveal() {
  const elements = document.querySelectorAll('.fs-section, .type-reveal, .reveal-progressive, .reveal-fade-up, .reveal-zoom');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = parseInt(el.getAttribute('data-delay') || '0', 10);

        setTimeout(() => {
          el.classList.add('is-revealed');
        }, delay);

        // If a section entered, also trigger reveals on its child items
        if (el.classList.contains('fs-section')) {
          el.querySelectorAll('.type-reveal, .reveal-progressive, .reveal-fade-up, .reveal-zoom').forEach(child => {
            const childDelay = parseInt(child.getAttribute('data-delay') || '0', 10);
            setTimeout(() => {
              child.classList.add('is-revealed');
            }, childDelay);
          });
        }
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => io.observe(el));
}

function initParallaxAndSceneNav() {
  const sections = Array.from(document.querySelectorAll('.fs-section'));
  const dots = document.querySelectorAll('.scene-dot');
  let isTicking = false;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function update() {
    const vh = window.innerHeight;

    // 1. Subtle gentle floating parallax on the section photo backdrop
    if (!prefersReducedMotion) {
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const bg = sec.querySelector('.fs-bg');
        if (bg) {
          const rect = sec.getBoundingClientRect();
          if (rect.top < vh && rect.bottom > 0) {
            // Distance of section center from viewport center
            const centerOffset = (rect.top + rect.height * 0.5 - vh * 0.5) / vh;
            const yShift = centerOffset * 30;
            bg.style.transform = `scale(1.03) translateY(${yShift.toFixed(1)}px)`;
          }
        }
      }
    }

    // 2. Continuous scene chapter dot tracker
    let activeSectionId = 'couple-photo';
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const rect = sec.getBoundingClientRect();
      if (rect.top <= vh * 0.5 && rect.bottom >= vh * 0.25) {
        const id = sec.getAttribute('id');
        if (id && id !== 'footer') {
          activeSectionId = id;
        }
      }
    }

    if (activeSectionId && dots.length > 0) {
      dots.forEach(dot => {
        if (dot.getAttribute('data-scene') === activeSectionId) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    isTicking = false;
  }

  window.addEventListener('scroll', () => {
    if (!isTicking) {
      window.requestAnimationFrame(update);
      isTicking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (!isTicking) {
      window.requestAnimationFrame(update);
      isTicking = true;
    }
  }, { passive: true });

  // Smooth click scroll for scene dots
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const targetId = dot.getAttribute('data-scene');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  update();
}

// ── Romantic Wedding Background Music Controller ──────────
function initMusic() {
  const audio = document.getElementById('bgAudio');
  const btn = document.getElementById('musicToggleBtn');
  const tooltip = document.getElementById('musicTooltip');
  if (!btn || !audio) return;

  let isPlaying = false;
  let audioCtx = null;
  let synthTimer = null;

  // Romantic Harp synthesizer fallback (Pachelbel's Canon chord progression in D major)
  function playProceduralRomanticMusic() {
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Canon in D chords: D - A - Bm - F#m - G - D - G - A
      const chords = [
        [293.66, 369.99, 440.00, 587.33],
        [220.00, 277.18, 329.63, 440.00],
        [246.94, 293.66, 369.99, 493.88],
        [185.00, 220.00, 277.18, 369.99],
        [196.00, 246.94, 293.66, 392.00],
        [293.66, 369.99, 440.00, 587.33],
        [196.00, 246.94, 293.66, 392.00],
        [220.00, 277.18, 329.63, 440.00]
      ];

      let chordIdx = 0;
      let noteIdx = 0;

      function playHarpNote(freq, time) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        // Soft bell/harp acoustic envelope
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.035, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 1.6);
      }

      function step() {
        if (!isPlaying) return;
        const now = audioCtx.currentTime;
        const currentChord = chords[chordIdx];
        const noteFreq = currentChord[noteIdx];
        playHarpNote(noteFreq, now);

        noteIdx++;
        if (noteIdx >= currentChord.length) {
          noteIdx = 0;
          chordIdx = (chordIdx + 1) % chords.length;
        }
        synthTimer = setTimeout(step, 500);
      }
      step();
    } catch (e) {
      console.warn('Web Audio synthesis not supported:', e);
    }
  }

  function stopProceduralRomanticMusic() {
    if (synthTimer) {
      clearTimeout(synthTimer);
      synthTimer = null;
    }
  }

  async function playMusic() {
    isPlaying = true;
    btn.classList.add('playing');
    if (tooltip) tooltip.style.opacity = '0';

    try {
      audio.volume = 0.55;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log('Audio file blocked or unavailable, launching magical music box synthesis');
          playProceduralRomanticMusic();
        });
      }
    } catch (err) {
      playProceduralRomanticMusic();
    }
  }

  function pauseMusic() {
    isPlaying = false;
    btn.classList.remove('playing');
    audio.pause();
    stopProceduralRomanticMusic();
  }

  function toggleMusic(e) {
    if (e) e.stopPropagation();
    if (isPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  }

  btn.addEventListener('click', toggleMusic);

  // Auto-start on first user interaction (click/touch anywhere on the page)
  let userInteracted = false;
  function handleFirstInteraction() {
    if (userInteracted) return;
    userInteracted = true;
    if (!isPlaying) {
      playMusic();
    }
    document.removeEventListener('pointerdown', handleFirstInteraction);
    document.removeEventListener('keydown', handleFirstInteraction);
  }
  document.addEventListener('pointerdown', handleFirstInteraction, { once: true });
  document.addEventListener('keydown', handleFirstInteraction, { once: true });
}

// ── Interactive Fairy Dust on Mouse Move & Touch ──────────
function initMagicCursorDust() {
  let lastSpawn = 0;
  const chars = ['✦', '✨', '•', '⋆'];
  const colors = ['#ffe8a3', '#ffd766', '#d4b86a', '#ffffff'];

  function spawnSparkle(x, y) {
    const now = Date.now();
    if (now - lastSpawn < 35) return;
    lastSpawn = now;

    const el = document.createElement('span');
    el.textContent = chars[Math.floor(Math.random() * chars.length)];
    el.style.position = 'fixed';
    el.style.left = (x + (Math.random() * 16 - 8)) + 'px';
    el.style.top = (y + (Math.random() * 16 - 8)) + 'px';
    el.style.color = colors[Math.floor(Math.random() * colors.length)];
    el.style.fontSize = (Math.random() * 10 + 8) + 'px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '99999';
    el.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0) scale(1) rotate(0deg)';
    el.style.filter = 'drop-shadow(0 0 6px rgba(255,220,120,0.8))';

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      const vx = (Math.random() - 0.5) * 32;
      const vy = - (Math.random() * 35 + 15);
      el.style.opacity = '0';
      el.style.transform = `translate(${vx}px, ${vy}px) scale(0.3) rotate(${Math.random() * 90 - 45}deg)`;
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 850);
  }

  window.addEventListener('mousemove', e => {
    spawnSparkle(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) {
      spawnSparkle(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Gold palette ────────────────────────────────────────
  const GOLD = ['rgba(201,168,76,', 'rgba(232,208,143,', 'rgba(255,236,180,', 'rgba(180,140,50,'];
  function goldColor(alpha) {
    return GOLD[Math.floor(Math.random() * GOLD.length)] + alpha + ')';
  }

  const rand = (a, b) => Math.random() * (b - a) + a;
  const randI = (a, b) => Math.floor(rand(a, b));

  // ══════════════════════════════════════════════════════
  // Layer 1 — Floating gold dust particles
  // ══════════════════════════════════════════════════════
  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x = rand(0, canvas.width);
      this.y = initial ? rand(0, canvas.height) : canvas.height + 10;
      this.r = rand(0.6, 2.4);
      this.vx = rand(-0.3, 0.3);
      this.vy = rand(-0.6, -1.4);
      this.alpha = 0;
      this.maxA = rand(0.25, 0.65);
      this.fade = rand(0.008, 0.02);
      this.phase = initial ? 'hold' : 'in';
      this.life = rand(120, 260);
      this.age = 0;
      this.color = goldColor(this.maxA);
    }
    update() {
      this.x += this.vx + Math.sin(this.age * 0.04) * 0.3;
      this.y += this.vy;
      this.age++;
      if (this.phase === 'in') { this.alpha = Math.min(this.alpha + this.fade, this.maxA); if (this.alpha >= this.maxA) this.phase = 'hold'; }
      if (this.phase === 'hold') { if (this.age > this.life) this.phase = 'out'; }
      if (this.phase === 'out') { this.alpha -= this.fade * 0.7; }
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
      this.x = rand(0, canvas.width);
      this.y = initial ? rand(-20, canvas.height) : rand(-60, -10);
      this.size = rand(6, 18);
      this.vx = rand(-0.4, 0.4);
      this.vy = rand(0.4, 1.1);
      this.alpha = rand(0.08, 0.28);
      this.rot = rand(0, Math.PI * 2);
      this.rotV = rand(-0.015, 0.015);
      this.swing = rand(0, Math.PI * 2);
      this.swingA = rand(0.3, 0.9);
    }
    update() {
      this.y += this.vy;
      this.x += this.vx + Math.sin(this.swing) * 0.3;
      this.rot += this.rotV;
      this.swing += 0.025;
      if (this.y > canvas.height + 30) this.reset();
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = goldColor(this.alpha);

      // Draw vector heart path
      const s = this.size;
      const topCurve = s * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, topCurve - s * 0.5);
      ctx.bezierCurveTo(0, -s * 0.5, -s * 0.5, -s * 0.5, -s * 0.5, topCurve - s * 0.5);
      ctx.bezierCurveTo(-s * 0.5, (s + topCurve) * 0.5 - s * 0.5, 0, (s + topCurve) * 0.7 - s * 0.5, 0, s - s * 0.5);
      ctx.bezierCurveTo(0, (s + topCurve) * 0.7 - s * 0.5, s * 0.5, (s + topCurve) * 0.5 - s * 0.5, s * 0.5, topCurve - s * 0.5);
      ctx.bezierCurveTo(s * 0.5, -s * 0.5, 0, -s * 0.5, 0, topCurve - s * 0.5);
      ctx.closePath();
      ctx.fill();

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
      this.x = rand(0, canvas.width);
      this.y = initial ? rand(0, canvas.height) : rand(0, canvas.height);
      this.size = rand(3, 9);
      this.alpha = 0;
      this.maxA = rand(0.15, 0.55);
      this.speed = rand(0.012, 0.03);
      this.phase = 'in';
      this.delay = randI(0, 200);
      this.age = -this.delay;
    }
    update() {
      this.age++;
      if (this.age < 0) return;
      if (this.phase === 'in') { this.alpha += this.speed; if (this.alpha >= this.maxA) { this.alpha = this.maxA; this.phase = 'out'; } }
      if (this.phase === 'out') { this.alpha -= this.speed * 0.7; if (this.alpha <= 0) this.reset(); }
    }
    draw() {
      if (this.age < 0 || this.alpha <= 0) return;
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = this.alpha;
      ctx.strokeStyle = goldColor(this.alpha);
      ctx.lineWidth = 0.8;
      // 4-point star
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(0, s);
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
      ctx.stroke();
      // Diagonal shorter arms
      const d = s * 0.45;
      ctx.beginPath();
      ctx.moveTo(-d, -d); ctx.lineTo(d, d);
      ctx.moveTo(d, -d); ctx.lineTo(-d, d);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ── Build pools ──────────────────────────────────────────
  const particles = Array.from({ length: 80 }, () => new Particle());
  const hearts = Array.from({ length: 22 }, () => new Heart());
  const sparkles = Array.from({ length: 40 }, () => new Sparkle());

  // ── Render loop ──────────────────────────────────────────
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle radial vignette glow at top (gold tint)
    const grad = ctx.createRadialGradient(
      canvas.width / 2, 0, 0,
      canvas.width / 2, 0, canvas.height * 0.65
    );
    grad.addColorStop(0, 'rgba(201,168,76,0.04)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => { p.update(); p.draw(); });
    hearts.forEach(h => { h.update(); h.draw(); });
    sparkles.forEach(s => { s.update(); s.draw(); });

    requestAnimationFrame(frame);
  }
  frame();
}


// ══════════════════════════════════════════════════════════
// LUXURY INVITATION INTRO CONTROLLER
// ══════════════════════════════════════════════════════════
function initEnvelopeIntro() {
  const overlay = document.getElementById('envelopeIntro');
  const openBtn = document.getElementById('openInvitationBtn');
  const skipBtn = document.getElementById('skipIntroBtn');
  const outerCard = document.getElementById('envelopeBox');
  const sparkleFd = document.getElementById('envSparkleField');
  if (!overlay) return;

  // Prevent background scroll while invitation is shown
  document.body.style.overflow = 'hidden';

  // Ambient floating gold dust inside the intro screen
  if (sparkleFd) {
    const chars = ['✦', '❊', '•', '⋆', '♥'];
    for (let i = 0; i < 24; i++) {
      const sp = document.createElement('span');
      sp.textContent = chars[Math.floor(Math.random() * chars.length)];
      sp.style.position = 'absolute';
      sp.style.left = (Math.random() * 100) + '%';
      sp.style.top = (Math.random() * 100) + '%';
      sp.style.color = 'rgba(180, 154, 108, ' + (Math.random() * 0.4 + 0.1) + ')';
      sp.style.fontSize = (Math.random() * 8 + 6) + 'px';
      sp.style.pointerEvents = 'none';
      sp.style.animation = 'sparkleTwinkle ' + (Math.random() * 4 + 3) + 's ease-in-out infinite alternate';
      sp.style.animationDelay = (Math.random() * 4) + 's';
      sparkleFd.appendChild(sp);
    }
  }

  let opened = false;

  function openEnvelope() {
    if (opened) return;
    opened = true;

    // Start background music on user's tap
    const audio = document.getElementById('bgAudio');
    const musicBtn = document.getElementById('musicToggleBtn');
    const tooltip = document.getElementById('musicTooltip');
    if (tooltip) tooltip.style.opacity = '0';
    if (audio) {
      audio.volume = 0.55;
      const pp = audio.play();
      if (pp !== undefined) {
        pp.then(() => { if (musicBtn) musicBtn.classList.add('playing'); })
          .catch(() => { if (musicBtn) musicBtn.classList.add('playing'); });
      }
    }

    // Animate card away
    overlay.classList.add('opening');

    // Ensure background video plays smoothly
    const bgVid = document.getElementById('mainBgVideo');
    if (bgVid) bgVid.play().catch(() => { });

    // Fade out the whole overlay
    setTimeout(() => {
      overlay.classList.add('is-opened');
      document.body.style.overflow = '';
    }, 700);

    // Remove from render tree
    setTimeout(() => {
      overlay.style.display = 'none';
      const cp = document.getElementById('couple-photo') || document.getElementById('invitation');
      if (cp) cp.classList.add('is-revealed');
    }, 1600);
  }

  function skipIntro() {
    if (opened) return;
    opened = true;
    document.body.style.overflow = '';
    overlay.classList.add('is-opened');

    const bgVid = document.getElementById('mainBgVideo');
    if (bgVid) bgVid.play().catch(() => { });

    const audio = document.getElementById('bgAudio');
    const musicBtn = document.getElementById('musicToggleBtn');
    if (audio) {
      audio.volume = 0.55;
      audio.play().then(() => {
        if (musicBtn) musicBtn.classList.add('playing');
      }).catch(() => { });
    }

    setTimeout(() => {
      overlay.style.display = 'none';
      const cp = document.getElementById('couple-photo') || document.getElementById('invitation');
      if (cp) cp.classList.add('is-revealed');
    }, 900);
  }

  if (openBtn) openBtn.addEventListener('click', openEnvelope);
  if (skipBtn) skipBtn.addEventListener('click', skipIntro);
  // Clicking anywhere on the outer card also opens
  if (outerCard) outerCard.addEventListener('click', openEnvelope);
}


// ── Common Background Video Controller ────────────────────
function initBgVideo() {
  const vid = document.getElementById('mainBgVideo');
  if (!vid) return;

  function attemptPlay() {
    vid.muted = true;
    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Will resume on first user touch/interaction
      });
    }
  }

  attemptPlay();

  // Resume play immediately on first click, touch or scroll
  const onFirstTouch = () => {
    attemptPlay();
    window.removeEventListener('click', onFirstTouch);
    window.removeEventListener('touchstart', onFirstTouch);
    window.removeEventListener('scroll', onFirstTouch);
  };
  window.addEventListener('click', onFirstTouch, { passive: true, once: true });
  window.addEventListener('touchstart', onFirstTouch, { passive: true, once: true });
  window.addEventListener('scroll', onFirstTouch, { passive: true, once: true });
}

document.addEventListener('DOMContentLoaded', () => {
  initBgVideo();                  // ← continuous background video controller
  initEnvelopeIntro();            // ← open letter envelope intro
  initBackground();               // ← animated canvas background
  initProgressiveScrollReveal();  // ← progressive scroll-triggered text reveal & magic animations
  initParallaxAndSceneNav();      // ← continuous scene transitions, parallax & chapter navigation
  initMusic();                    // ← romantic wedding background music controller
  initMagicCursorDust();          // ← interactive golden fairy dust on mouse & touch
  tick();
  setInterval(tick, 1000);
  refreshCounter();
  initValidation();               // ← live real-time input validation

  const form = document.getElementById('rsvpForm');
  if (form) form.addEventListener('submit', handleSubmit);

  // Smooth scroll and focus for RSVP action buttons
  const openRsvpBtn = document.getElementById('openRsvpFormBtn');
  if (openRsvpBtn) {
    openRsvpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const formEl = document.getElementById('rsvpForm');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const nameInput = document.getElementById('fullName');
        if (nameInput) setTimeout(() => nameInput.focus(), 600);
      }
    });
  }
});
