/* ============================================================
   INTERVALS PWA – app.js
   ============================================================ */

'use strict';

// ─── Audio Engine ─────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playBeep(freq = 880, duration = 0.12, type = 'sine', vol = 0.6) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playBell() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => playBeep(f, 0.5, 'sine', 0.4), i * 80));
}

function playStartBell() {
  [440, 554, 659, 880].forEach((f, i) => setTimeout(() => playBeep(f, 0.35, 'triangle', 0.5), i * 100));
}

function playSound(type) {
  const sel = document.getElementById('soundSelect')?.value || 'beep';
  if (sel === 'silent') return;
  if (sel === 'bell') { playBell(); return; }
  if (type === 'start') { playStartBell(); return; }
  if (type === 'warn')  { playBeep(660, 0.08); setTimeout(() => playBeep(660, 0.08), 150); return; }
  if (type === 'end')   { playBell(); return; }
  playBeep(880, 0.12);
}

function haptic(pattern = [10]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function speak(text) {
  if (!document.getElementById('ttsToggle')?.checked) return;
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1; u.volume = 1;
  speechSynthesis.speak(u);
}

// ─── Toast ────────────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

// ─── Storage ──────────────────────────────────────────────────
const STORAGE_KEY = 'intervals_templates_v2';

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveTemplates(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// ─── Built-in Templates ───────────────────────────────────────
const BUILTIN_TEMPLATES = [
  {
    id: 'tabata', name: 'Tabata', builtin: true,
    desc: 'Classic 20s on / 10s off × 8 rounds',
    color: '#E8281E',
    rounds: 8,
    intervals: [
      { name: 'Work', duration: 20, type: 'work' },
      { name: 'Rest', duration: 10, type: 'rest' },
    ]
  },
  {
    id: 'hiit30', name: 'HIIT 30/30', builtin: true,
    desc: '30s high intensity / 30s recovery × 10',
    color: '#F5C518',
    rounds: 10,
    intervals: [
      { name: 'High Intensity', duration: 30, type: 'work' },
      { name: 'Low Intensity', duration: 30, type: 'rest' },
    ]
  },
  {
    id: 'circuit', name: 'Circuit Training', builtin: true,
    desc: '45s work / 15s transition × 6 stations',
    color: '#2C7BE5',
    rounds: 6,
    intervals: [
      { name: 'Warm-Up', duration: 120, type: 'warmup' },
      { name: 'Work', duration: 45, type: 'work' },
      { name: 'Transition', duration: 15, type: 'rest' },
      { name: 'Cool-Down', duration: 60, type: 'cooldown' },
    ]
  },
  {
    id: 'amrap', name: 'AMRAP', builtin: true,
    desc: 'As Many Rounds As Possible – 20 min',
    color: '#7B61FF',
    rounds: 1,
    intervals: [
      { name: 'AMRAP', duration: 1200, type: 'work' },
    ]
  },
];

// ─── Color/Type Mapping ───────────────────────────────────────
const TYPE_COLORS = {
  work:     '#E8281E',
  rest:     '#5CC85A',
  warmup:   '#2C7BE5',
  cooldown: '#7B61FF',
  prepare:  '#F5C518',
  custom:   '#8E8E93',
};
const TYPE_STAGE = {
  work:     'state-work',
  rest:     'state-rest',
  warmup:   'state-warmup',
  cooldown: 'state-cooldown',
  prepare:  'state-prepare',
  custom:   'state-idle',
};

function typeColor(t) { return TYPE_COLORS[t] || TYPE_COLORS.custom; }
function typeStage(t) { return TYPE_STAGE[t] || 'state-idle'; }

// ─── App State ────────────────────────────────────────────────
let currentView = 'timer';

// Interval Timer State
const IT = {
  // Config
  intervals: [
    { name: 'Work', duration: 30, type: 'work' },
    { name: 'Rest', duration: 15, type: 'rest' },
  ],
  rounds: 3,
  // Runtime
  running: false,
  paused: false,
  active: false, // workout in progress
  roundIdx: 0,
  intervalIdx: 0,
  elapsed: 0,
  segElapsed: 0,
  ticker: null,
  warnFired: false,
  totalDuration: 0,
};

// Stopwatch
const SW = {
  running: false,
  startTime: 0,
  elapsed: 0,
  laps: [],
  ticker: null,
};

// Countdown
const CD = {
  running: false,
  duration: 300,
  remaining: 300,
  startTime: 0,
  ticker: null,
};

// ─── Nav ──────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.view;
    switchView(v);
  });
});

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'templates') renderTemplates();
}

// ─── Interval Timer ───────────────────────────────────────────
const stageBg = document.getElementById('stageBg');
const bigTime = document.getElementById('bigTime');
const ciName = document.getElementById('ciName');
const ciDuration = document.getElementById('ciDuration');
const niName = document.getElementById('niName');
const niDuration = document.getElementById('niDuration');
const nextIntervalEl = document.getElementById('nextInterval');
const elapsedEl = document.getElementById('elapsed');
const remainingEl = document.getElementById('remaining');
const intervalCountEl = document.getElementById('intervalCount');
const warningFlash = document.getElementById('warningFlash');
const setupPanel = document.getElementById('setupPanel');

document.getElementById('btnPlayPause').addEventListener('click', () => {
  getAudioCtx(); // unlock audio
  if (!IT.active) return; // safety
  if (IT.running) { pauseWorkout(); } else { resumeWorkout(); }
});

document.getElementById('btnReset').addEventListener('click', resetWorkout);
document.getElementById('btnSkip').addEventListener('click', skipInterval);
document.getElementById('startBtn').addEventListener('click', startWorkout);

function startWorkout() {
  if (IT.intervals.length === 0) { showToast('Add at least one interval'); return; }
  getAudioCtx();
  IT.active = true;
  IT.running = true;
  IT.roundIdx = 0;
  IT.intervalIdx = 0;
  IT.elapsed = 0;
  IT.segElapsed = 0;
  IT.warnFired = false;
  IT.totalDuration = IT.intervals.reduce((s, i) => s + i.duration, 0) * IT.rounds;
  setupPanel.classList.add('hidden-panel');
  document.body.classList.add('workout-active');
  updatePlayPauseBtn(true);
  updateStageUI();
  playSound('start');
  speak(getCurrentInterval().name);
  haptic([30]);
  startTick();
}

function pauseWorkout() {
  IT.running = false;
  clearInterval(IT.ticker);
  IT.ticker = null;
  updatePlayPauseBtn(false);
  haptic([10]);
}

function resumeWorkout() {
  IT.running = true;
  updatePlayPauseBtn(true);
  haptic([10]);
  startTick();
}

function resetWorkout() {
  clearInterval(IT.ticker); IT.ticker = null;
  IT.active = false; IT.running = false; IT.paused = false;
  IT.roundIdx = 0; IT.intervalIdx = 0; IT.elapsed = 0; IT.segElapsed = 0;
  document.body.classList.remove('workout-active');
  setupPanel.classList.remove('hidden-panel');
  updatePlayPauseBtn(false);
  stageBg.className = 'stage-bg state-idle';
  bigTime.textContent = '00:00';
  ciName.textContent = '–'; ciDuration.textContent = '–';
  niName.textContent = '–'; niDuration.textContent = '–';
  elapsedEl.textContent = '0:00'; remainingEl.textContent = '–'; intervalCountEl.textContent = '–';
  warningFlash.classList.remove('active');
}

function skipInterval() {
  if (!IT.active) return;
  IT.segElapsed = getCurrentInterval().duration;
  advanceInterval();
}

function startTick() {
  let last = performance.now();
  IT.ticker = setInterval(() => {
    const now = performance.now();
    const delta = (now - last) / 1000;
    last = now;
    IT.elapsed += delta;
    IT.segElapsed += delta;
    const seg = getCurrentInterval();
    const remaining = seg.duration - IT.segElapsed;

    // Warning at 3 seconds
    if (remaining <= 3 && remaining > 0 && !IT.warnFired) {
      IT.warnFired = true;
      warningFlash.classList.add('active');
      playSound('warn');
      haptic([10, 50, 10]);
    }

    if (IT.segElapsed >= seg.duration) { advanceInterval(); }
    else { updateTimerDisplay(); }
  }, 50);
}

function advanceInterval() {
  clearInterval(IT.ticker); IT.ticker = null;
  IT.warnFired = false;
  warningFlash.classList.remove('active');
  IT.segElapsed = 0;
  IT.intervalIdx++;

  if (IT.intervalIdx >= IT.intervals.length) {
    IT.intervalIdx = 0;
    IT.roundIdx++;
    if (IT.roundIdx >= IT.rounds) {
      workoutComplete();
      return;
    }
  }

  playSound('beep');
  speak(getCurrentInterval().name);
  haptic([15, 30, 15]);
  updateStageUI();
  if (IT.running) startTick();
}

function workoutComplete() {
  IT.active = false; IT.running = false;
  clearInterval(IT.ticker); IT.ticker = null;
  playSound('end');
  speak('Workout complete! Great work!');
  haptic([50, 100, 50, 100, 50]);
  bigTime.textContent = '00:00';
  ciName.textContent = 'DONE!';
  ciDuration.textContent = '🎉';
  nextIntervalEl.style.display = 'none';
  updatePlayPauseBtn(false);
  stageBg.className = 'stage-bg state-rest';
  showToast('Workout Complete! 🎉');
}

function getCurrentInterval() {
  return IT.intervals[IT.intervalIdx];
}

function getNextInterval() {
  let ni = IT.intervalIdx + 1;
  let nr = IT.roundIdx;
  if (ni >= IT.intervals.length) { ni = 0; nr++; }
  if (nr >= IT.rounds) return null;
  return IT.intervals[ni];
}

function updateStageUI() {
  const seg = getCurrentInterval();
  const next = getNextInterval();
  const stateClass = typeStage(seg.type);
  stageBg.className = 'stage-bg ' + stateClass;

  ciName.textContent = seg.name;
  ciDuration.textContent = formatTime(seg.duration);

  const totalSegs = IT.intervals.length * IT.rounds;
  const currentSeg = IT.roundIdx * IT.intervals.length + IT.intervalIdx + 1;
  intervalCountEl.textContent = currentSeg + '/' + totalSegs;

  if (next) {
    nextIntervalEl.style.display = '';
    niName.textContent = next.name;
    niDuration.textContent = formatTime(next.duration);
    nextIntervalEl.style.background = hexToRgba(typeColor(next.type), 0.25);
  } else {
    nextIntervalEl.style.display = 'none';
  }
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const seg = getCurrentInterval();
  const remaining = Math.max(0, seg.duration - IT.segElapsed);
  bigTime.textContent = formatTime(Math.ceil(remaining));

  const totalRem = Math.max(0, IT.totalDuration - IT.elapsed);
  remainingEl.textContent = formatTime(Math.ceil(totalRem));
  elapsedEl.textContent = formatTime(Math.floor(IT.elapsed));
}

function updatePlayPauseBtn(playing) {
  const btn = document.getElementById('btnPlayPause');
  btn.querySelector('.icon-play').classList.toggle('hidden', playing);
  btn.querySelector('.icon-pause').classList.toggle('hidden', !playing);
}

// ─── Setup Panel ──────────────────────────────────────────────
function renderIntervalList() {
  const list = document.getElementById('intervalList');
  list.innerHTML = '';
  IT.intervals.forEach((seg, i) => {
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.innerHTML = `
      <div class="ir-color" style="background:${typeColor(seg.type)}"></div>
      <div class="ir-info">
        <div class="ir-name">${seg.name}</div>
        <div class="ir-dur">${formatTime(seg.duration)} · ${cap(seg.type)}</div>
      </div>
      <button class="ir-delete" data-i="${i}" aria-label="Delete">✕</button>
    `;
    row.querySelector('.ir-info').addEventListener('click', () => editInterval(i));
    row.querySelector('.ir-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      IT.intervals.splice(i, 1);
      renderIntervalList();
    });
    list.appendChild(row);
  });
}

document.getElementById('addIntervalBtn').addEventListener('click', () => {
  IT.intervals.push({ name: 'Interval', duration: 30, type: 'work' });
  editInterval(IT.intervals.length - 1);
});

document.getElementById('roundsInput').addEventListener('change', (e) => {
  IT.rounds = Math.max(1, parseInt(e.target.value) || 1);
});
document.querySelectorAll('.ni-dec, .ni-inc').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = document.getElementById('roundsInput');
    let v = parseInt(inp.value) || 1;
    v = btn.classList.contains('ni-inc') ? v + 1 : Math.max(1, v - 1);
    inp.value = v;
    IT.rounds = v;
  });
});

document.getElementById('saveTemplateBtn').addEventListener('click', () => {
  openNameModal((name) => {
    if (!name) return;
    const templates = loadTemplates();
    templates.push({
      id: 'user_' + Date.now(),
      name,
      desc: IT.intervals.map(i => i.name).join(' → '),
      color: typeColor(IT.intervals[0]?.type || 'work'),
      rounds: IT.rounds,
      intervals: JSON.parse(JSON.stringify(IT.intervals)),
    });
    saveTemplates(templates);
    showToast('Template saved!');
  });
});

// ─── Interval Edit Modal ──────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
let modalOkCb = null;

document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOk').addEventListener('click', () => { if (modalOkCb) modalOkCb(); });
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

function closeModal() {
  modalOverlay.classList.add('hidden');
}
function openModal(title, bodyHTML, cb) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalOkCb = cb;
  modalOverlay.classList.remove('hidden');
}

function editInterval(idx) {
  const seg = IT.intervals[idx];
  const mins = Math.floor(seg.duration / 60);
  const secs = seg.duration % 60;
  const types = ['work','rest','warmup','cooldown','prepare','custom'];

  openModal('Edit Interval', `
    <div class="modal-field">
      <label>Name</label>
      <input id="mName" type="text" value="${seg.name}" maxlength="32">
    </div>
    <div class="modal-field" style="flex-direction:row;gap:12px;align-items:flex-end">
      <div style="flex:1">
        <label>Minutes</label>
        <input id="mMin" type="number" value="${mins}" min="0" max="99">
      </div>
      <div style="flex:1">
        <label>Seconds</label>
        <input id="mSec" type="number" value="${secs}" min="0" max="59">
      </div>
    </div>
    <div class="modal-field">
      <label>Type</label>
      <select id="mType">${types.map(t => `<option value="${t}" ${t===seg.type?'selected':''}>${cap(t)}</option>`).join('')}</select>
    </div>
  `, () => {
    const name = document.getElementById('mName').value.trim() || 'Interval';
    const m = parseInt(document.getElementById('mMin').value) || 0;
    const s = parseInt(document.getElementById('mSec').value) || 0;
    const dur = Math.max(1, m * 60 + s);
    const type = document.getElementById('mType').value;
    IT.intervals[idx] = { name, duration: dur, type };
    renderIntervalList();
    closeModal();
  });
  setTimeout(() => document.getElementById('mName')?.focus(), 50);
}

function openNameModal(cb) {
  openModal('Save Template', `
    <div class="modal-field">
      <label>Template Name</label>
      <input id="tmplName" type="text" placeholder="My Workout" maxlength="40">
    </div>
  `, () => {
    cb(document.getElementById('tmplName').value.trim());
    closeModal();
  });
  setTimeout(() => document.getElementById('tmplName')?.focus(), 50);
}

// ─── Templates View ───────────────────────────────────────────
function renderTemplates() {
  const grid = document.getElementById('templateGrid');
  grid.innerHTML = '';
  const userTemplates = loadTemplates();
  const all = [...BUILTIN_TEMPLATES, ...userTemplates];

  all.forEach(tmpl => {
    const card = document.createElement('div');
    card.className = 'template-card';
    const totalSecs = tmpl.intervals.reduce((s,i) => s + i.duration, 0) * tmpl.rounds;
    card.innerHTML = `
      <div class="tc-color-bar" style="background:${tmpl.color}"></div>
      <div class="tc-info">
        <div class="tc-name">${tmpl.name}</div>
        <div class="tc-desc">${tmpl.desc}</div>
        <div class="tc-meta">${tmpl.rounds} round${tmpl.rounds>1?'s':''} · ${formatTime(totalSecs)}</div>
      </div>
      <div class="tc-actions">
        <button class="tc-btn use">Use</button>
        ${!tmpl.builtin ? `<button class="tc-btn delete">Delete</button>` : ''}
      </div>
    `;
    card.querySelector('.use').addEventListener('click', () => {
      IT.intervals = JSON.parse(JSON.stringify(tmpl.intervals));
      IT.rounds = tmpl.rounds;
      document.getElementById('roundsInput').value = tmpl.rounds;
      renderIntervalList();
      switchView('timer');
      showToast(tmpl.name + ' loaded');
    });
    if (!tmpl.builtin) {
      card.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const arr = loadTemplates().filter(t => t.id !== tmpl.id);
        saveTemplates(arr);
        renderTemplates();
      });
    }
    grid.appendChild(card);
  });
}

// ─── Stopwatch ────────────────────────────────────────────────
const swTimeEl = document.getElementById('swTime');
const swStartBtn = document.getElementById('swStart');
const swLapBtn = document.getElementById('swLap');
const swResetBtn = document.getElementById('swReset');
const lapListEl = document.getElementById('lapList');

swStartBtn.addEventListener('click', () => {
  getAudioCtx();
  if (SW.running) {
    SW.running = false;
    clearInterval(SW.ticker); SW.ticker = null;
    swStartBtn.querySelector('.icon-play').classList.remove('hidden');
    swStartBtn.querySelector('.icon-pause').classList.add('hidden');
  } else {
    SW.running = true;
    SW.startTime = performance.now() - SW.elapsed;
    swStartBtn.querySelector('.icon-play').classList.add('hidden');
    swStartBtn.querySelector('.icon-pause').classList.remove('hidden');
    swLapBtn.disabled = false;
    SW.ticker = setInterval(() => {
      SW.elapsed = performance.now() - SW.startTime;
      swTimeEl.textContent = formatStopwatch(SW.elapsed);
    }, 50);
  }
});

swLapBtn.addEventListener('click', () => {
  if (!SW.running) return;
  const lapTime = SW.laps.length > 0
    ? SW.elapsed - SW.laps.reduce((s,l) => s + l, 0)
    : SW.elapsed;
  SW.laps.push(lapTime);
  playSound('beep'); haptic([10]);
  renderLaps();
});

swResetBtn.addEventListener('click', () => {
  SW.running = false; clearInterval(SW.ticker); SW.ticker = null;
  SW.elapsed = 0; SW.laps = [];
  swTimeEl.textContent = '00:00.00';
  swLapBtn.disabled = true;
  swStartBtn.querySelector('.icon-play').classList.remove('hidden');
  swStartBtn.querySelector('.icon-pause').classList.add('hidden');
  lapListEl.innerHTML = '';
});

function renderLaps() {
  const min = Math.min(...SW.laps);
  const max = Math.max(...SW.laps);
  lapListEl.innerHTML = '';
  [...SW.laps].reverse().forEach((t, i) => {
    const num = SW.laps.length - i;
    const row = document.createElement('div');
    row.className = 'lap-row' + (t === min && SW.laps.length > 1 ? ' fastest' : '') + (t === max && SW.laps.length > 1 ? ' slowest' : '');
    row.innerHTML = `<span class="lap-num">Lap ${num}</span><span class="lap-time">${formatStopwatch(t)}</span>`;
    lapListEl.appendChild(row);
  });
}

// ─── Countdown ────────────────────────────────────────────────
const cdTimeEl = document.getElementById('cdTime');
const cdStartBtn = document.getElementById('cdStart');
const cdResetBtn = document.getElementById('cdReset');
const cdMinEl = document.getElementById('cdMinutes');
const cdSecEl = document.getElementById('cdSeconds');

function getCDDuration() {
  return (parseInt(cdMinEl.value) || 0) * 60 + (parseInt(cdSecEl.value) || 0);
}

function updateCDDisplay() {
  cdTimeEl.textContent = formatTime(Math.ceil(CD.remaining));
}

[cdMinEl, cdSecEl].forEach(el => {
  el.addEventListener('change', () => {
    if (!CD.running) {
      CD.duration = getCDDuration();
      CD.remaining = CD.duration;
      updateCDDisplay();
    }
  });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (CD.running) return;
    const s = parseInt(btn.dataset.seconds);
    cdMinEl.value = Math.floor(s / 60);
    cdSecEl.value = s % 60;
    CD.duration = s; CD.remaining = s;
    updateCDDisplay();
  });
});

cdStartBtn.addEventListener('click', () => {
  getAudioCtx();
  if (CD.running) {
    CD.running = false;
    clearInterval(CD.ticker); CD.ticker = null;
    cdStartBtn.querySelector('.icon-play').classList.remove('hidden');
    cdStartBtn.querySelector('.icon-pause').classList.add('hidden');
  } else {
    if (CD.remaining <= 0) { CD.remaining = getCDDuration(); }
    if (CD.remaining <= 0) return;
    CD.running = true;
    let last = performance.now();
    cdStartBtn.querySelector('.icon-play').classList.add('hidden');
    cdStartBtn.querySelector('.icon-pause').classList.remove('hidden');
    CD.ticker = setInterval(() => {
      const now = performance.now();
      CD.remaining -= (now - last) / 1000;
      last = now;
      if (CD.remaining <= 3 && CD.remaining > 2.9) { playSound('warn'); haptic([10,50,10]); }
      if (CD.remaining <= 0) {
        CD.remaining = 0; CD.running = false;
        clearInterval(CD.ticker); CD.ticker = null;
        cdTimeEl.textContent = '00:00';
        playSound('end'); haptic([50,100,50]);
        speak('Time is up');
        cdStartBtn.querySelector('.icon-play').classList.remove('hidden');
        cdStartBtn.querySelector('.icon-pause').classList.add('hidden');
        return;
      }
      updateCDDisplay();
    }, 50);
  }
});

cdResetBtn.addEventListener('click', () => {
  CD.running = false; clearInterval(CD.ticker); CD.ticker = null;
  CD.duration = getCDDuration(); CD.remaining = CD.duration;
  updateCDDisplay();
  cdStartBtn.querySelector('.icon-play').classList.remove('hidden');
  cdStartBtn.querySelector('.icon-pause').classList.add('hidden');
});

// ─── Helpers ──────────────────────────────────────────────────
function formatTime(totalSecs) {
  const s = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + String(sec).padStart(2, '0');
}

function formatStopwatch(ms) {
  const total = Math.floor(ms);
  const mins = Math.floor(total / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  const cents = Math.floor((total % 1000) / 10);
  return String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0') + '.' + String(cents).padStart(2,'0');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Wake Lock ────────────────────────────────────────────────
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch(e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (IT.running || SW.running || CD.running)) {
    requestWakeLock();
  }
});

// ─── Init ─────────────────────────────────────────────────────
renderIntervalList();
updateCDDisplay();
requestWakeLock();

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// iOS PWA: prevent double-tap zoom
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - (document._lastTouchEnd || 0) < 300) e.preventDefault();
  document._lastTouchEnd = now;
}, { passive: false });
