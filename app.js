/* ============================================================
   INTERVALS PWA – app.js  v2
   All new features:
   • Per-interval custom color picker
   • Prepare countdown before start
   • Configurable warning time
   • Count-up / count-down toggle
   • TTS advance warning
   • Drag-to-reorder intervals
   • Duplicate interval button
   • Extended sound palette (air horn, gong, soft chime, boxing bell)
   • Progress ring
   • Full-screen 3-2-1 transition flash
   • Template tabs (Built-in / My Workouts)
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

function playTone(freq, dur, type = 'sine', vol = 0.55, attack = 0.005, release = 0.1) {
  try {
    const ctx = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur - release + dur * 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}

// Sound library – all synthesized, no files needed
const SOUNDS = {
  beep: {
    transition() { playTone(880, 0.12, 'sine', 0.5); },
    warn()       { playTone(660, 0.08, 'sine', 0.5); setTimeout(() => playTone(660, 0.08, 'sine', 0.5), 160); },
    start()      { [440,554,659,880].forEach((f,i) => setTimeout(() => playTone(f, 0.25, 'triangle', 0.45), i * 90)); },
    end()        { [880,659,523].forEach((f,i) => setTimeout(() => playTone(f, 0.4, 'sine', 0.4), i * 120)); },
    prepare()    { playTone(660, 0.07, 'sine', 0.4); },
  },
  bell: {
    transition() { _bell([523,659,784], 0.6, 0.35); },
    warn()       { playTone(880, 0.08, 'sine', 0.4); setTimeout(() => playTone(880, 0.08, 'sine', 0.4), 180); },
    start()      { _bell([392,523,659,784], 0.55, 0.4); },
    end()        { _bell([784,659,523,392], 0.7, 0.45); },
    prepare()    { playTone(784, 0.06, 'sine', 0.35); },
  },
  horn: {
    transition() { _horn(180, 0.45); },
    warn()       { _horn(220, 0.15); setTimeout(() => _horn(220, 0.15), 220); },
    start()      { _horn(160, 0.7); },
    end()        { _horn(140, 0.9); },
    prepare()    { _horn(200, 0.12); },
  },
  gong: {
    transition() { _gong(80, 1.8); },
    warn()       { _gong(160, 0.6); },
    start()      { _gong(60, 2.5); },
    end()        { _gong(55, 3.0); },
    prepare()    { _gong(120, 0.5); },
  },
  soft: {
    transition() { _chime([523,659], 0.7, 0.25); },
    warn()       { _chime([659], 0.4, 0.2); },
    start()      { _chime([523,659,784,1047], 0.8, 0.22); },
    end()        { _chime([784,659,523], 0.9, 0.25); },
    prepare()    { _chime([784], 0.3, 0.18); },
  },
  boxing: {
    transition() { _bell([293,369,440], 0.8, 0.5); setTimeout(() => _bell([293,369,440], 0.8, 0.5), 350); },
    warn()       { playTone(440, 0.1, 'square', 0.3); },
    start()      { for (let i = 0; i < 3; i++) setTimeout(() => _bell([369,440,554], 0.7, 0.45), i * 300); },
    end()        { for (let i = 0; i < 3; i++) setTimeout(() => _bell([293,369,440], 0.9, 0.55), i * 280); },
    prepare()    { playTone(369, 0.08, 'square', 0.25); },
  },
  silent: { transition(){}, warn(){}, start(){}, end(){}, prepare(){} },
};

function _bell(freqs, dur, vol) {
  freqs.forEach((f, i) => setTimeout(() => playTone(f, dur, 'sine', vol, 0.003, dur * 0.7), i * 70));
}
function _horn(freq, dur) {
  try {
    const ctx = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, ctx.currentTime + dur);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function _gong(freq, dur) {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function _chime(freqs, dur, vol) {
  freqs.forEach((f, i) => setTimeout(() => playTone(f, dur, 'sine', vol, 0.001, dur * 0.8), i * 100));
}

function getSound() {
  const sel = document.getElementById('soundSelect')?.value || 'beep';
  return SOUNDS[sel] || SOUNDS.beep;
}
function playSound(type) { try { getSound()[type](); } catch(e) {} }

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
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ─── Storage ──────────────────────────────────────────────────
const STORAGE_KEY = 'intervals_templates_v3';
function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveTemplates(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// ─── Color Palette ────────────────────────────────────────────
const PALETTE = [
  '#E8281E', '#FF6B35', '#F5C518', '#5CC85A',
  '#2C7BE5', '#7B61FF', '#E91E8C', '#00BCD4',
  '#FF9800', '#8E8E93', '#FFFFFF', '#000000',
];

// ─── Type → default color & stage class ──────────────────────
const TYPE_DEFAULTS = {
  work:     { color: '#E8281E', stage: 'state-work' },
  rest:     { color: '#5CC85A', stage: 'state-rest' },
  warmup:   { color: '#2C7BE5', stage: 'state-warmup' },
  cooldown: { color: '#7B61FF', stage: 'state-cooldown' },
  prepare:  { color: '#F5C518', stage: 'state-prepare' },
  custom:   { color: '#8E8E93', stage: 'state-custom' },
};

function typeColor(seg) {
  // If interval has a custom color, use it; else fall back to type default
  return seg.color || TYPE_DEFAULTS[seg.type]?.color || '#8E8E93';
}

function intervalStageClass(seg) {
  if (seg.color) return 'state-custom';
  return TYPE_DEFAULTS[seg.type]?.stage || 'state-custom';
}

// ─── Built-in Templates ───────────────────────────────────────
const BUILTIN_TEMPLATES = [
  {
    id: 'tabata', name: 'Tabata', builtin: true,
    desc: '20s work / 10s rest × 8 rounds',
    color: '#E8281E', rounds: 8,
    intervals: [
      { name: 'Work', duration: 20, type: 'work',  color: '#E8281E' },
      { name: 'Rest', duration: 10, type: 'rest',  color: '#5CC85A' },
    ]
  },
  {
    id: 'hiit30', name: 'HIIT 30/30', builtin: true,
    desc: '30s high / 30s recovery × 10',
    color: '#F5C518', rounds: 10,
    intervals: [
      { name: 'High Intensity', duration: 30, type: 'work', color: '#E8281E' },
      { name: 'Low Intensity',  duration: 30, type: 'rest', color: '#5CC85A' },
    ]
  },
  {
    id: 'emom', name: 'EMOM', builtin: true,
    desc: 'Every minute on the minute × 10',
    color: '#FF6B35', rounds: 10,
    intervals: [
      { name: 'Work',    duration: 40, type: 'work', color: '#FF6B35' },
      { name: 'Recover', duration: 20, type: 'rest', color: '#5CC85A' },
    ]
  },
  {
    id: 'circuit', name: 'Circuit Training', builtin: true,
    desc: 'Warm-up → 6 stations → Cool-down',
    color: '#2C7BE5', rounds: 6,
    intervals: [
      { name: 'Warm-Up',    duration: 120, type: 'warmup',   color: '#2C7BE5' },
      { name: 'Work',       duration: 45,  type: 'work',     color: '#E8281E' },
      { name: 'Transition', duration: 15,  type: 'rest',     color: '#5CC85A' },
      { name: 'Cool-Down',  duration: 60,  type: 'cooldown', color: '#7B61FF' },
    ]
  },
  {
    id: 'amrap', name: 'AMRAP', builtin: true,
    desc: 'As Many Rounds As Possible – 20 min',
    color: '#7B61FF', rounds: 1,
    intervals: [
      { name: 'AMRAP', duration: 1200, type: 'work', color: '#7B61FF' },
    ]
  },
  {
    id: 'pyramid', name: 'Pyramid', builtin: true,
    desc: 'Ascending then descending work intervals',
    color: '#E91E8C', rounds: 1,
    intervals: [
      { name: 'Work 20s', duration: 20, type: 'work', color: '#E91E8C' },
      { name: 'Rest',     duration: 10, type: 'rest', color: '#5CC85A' },
      { name: 'Work 30s', duration: 30, type: 'work', color: '#E91E8C' },
      { name: 'Rest',     duration: 10, type: 'rest', color: '#5CC85A' },
      { name: 'Work 40s', duration: 40, type: 'work', color: '#E91E8C' },
      { name: 'Rest',     duration: 10, type: 'rest', color: '#5CC85A' },
      { name: 'Work 30s', duration: 30, type: 'work', color: '#E91E8C' },
      { name: 'Rest',     duration: 10, type: 'rest', color: '#5CC85A' },
      { name: 'Work 20s', duration: 20, type: 'work', color: '#E91E8C' },
    ]
  },
];

// ─── App State ────────────────────────────────────────────────
let currentView = 'timer';
let currentTemplateTab = 'builtin';

// Interval Timer State
const IT = {
  intervals: [
    { name: 'Work', duration: 30, type: 'work',  color: '#E8281E' },
    { name: 'Rest', duration: 15, type: 'rest',  color: '#5CC85A' },
  ],
  rounds: 3,
  // Runtime
  running: false,
  active: false,
  inPrepare: false,
  prepareSecs: 0,
  roundIdx: 0,
  intervalIdx: 0,
  elapsed: 0,
  segElapsed: 0,
  ticker: null,
  warnFired: false,
  ttsWarnFired: false,
  totalDuration: 0,
  countUp: false,  // toggle display mode
};

// Stopwatch
const SW = { running: false, startTime: 0, elapsed: 0, laps: [], ticker: null };

// Countdown
const CD = { running: false, duration: 300, remaining: 300, ticker: null };

// ─── Nav ──────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'templates') renderTemplates();
}

// ─── DOM references ───────────────────────────────────────────
const stageBg         = document.getElementById('stageBg');
const bigTimeEl       = document.getElementById('bigTime');
const ciNameEl        = document.getElementById('ciName');
const ciDurationEl    = document.getElementById('ciDuration');
const ciLabelEl       = document.getElementById('ciLabel');
const niNameEl        = document.getElementById('niName');
const niDurationEl    = document.getElementById('niDuration');
const nextIntervalEl  = document.getElementById('nextInterval');
const elapsedEl       = document.getElementById('elapsed');
const remainingEl     = document.getElementById('remaining');
const intervalCountEl = document.getElementById('intervalCount');
const warningFlash    = document.getElementById('warningFlash');
const setupPanel      = document.getElementById('setupPanel');
const prepareOverlay  = document.getElementById('prepareOverlay');
const prepareCountEl  = document.getElementById('prepareCount');
const prepareFirstEl  = document.getElementById('prepareFirst');
const prFill          = document.getElementById('prFill');
const ringWrap        = document.getElementById('progressRingWrap');
const transOverlay    = document.getElementById('transitionOverlay');
const transNum        = document.getElementById('transitionNum');
const transName       = document.getElementById('transitionName');
const PR_CIRC         = 2 * Math.PI * 98; // ~616

// ─── Play/Pause / Reset / Skip ────────────────────────────────
document.getElementById('btnPlayPause').addEventListener('click', () => {
  getAudioCtx();
  if (!IT.active) return;
  if (IT.running || IT.inPrepare) { pauseWorkout(); } else { resumeWorkout(); }
});
document.getElementById('btnReset').addEventListener('click', resetWorkout);
document.getElementById('btnSkip').addEventListener('click', skipInterval);
document.getElementById('startBtn').addEventListener('click', startWorkout);

// Count-up toggle
document.getElementById('timeModeToggle').addEventListener('click', () => {
  IT.countUp = !IT.countUp;
  document.getElementById('timeModeToggle').classList.toggle('count-up', IT.countUp);
  if (IT.active) updateTimerDisplay();
});

// TTS row visibility
document.getElementById('ttsToggle').addEventListener('change', (e) => {
  document.getElementById('ttsWarnRow').style.display = e.target.checked ? '' : 'none';
});

// ─── Workout Lifecycle ────────────────────────────────────────
function startWorkout() {
  if (IT.intervals.length === 0) { showToast('Add at least one interval'); return; }
  getAudioCtx();
  IT.active  = true;
  IT.running = false;
  IT.roundIdx = 0; IT.intervalIdx = 0;
  IT.elapsed = 0;  IT.segElapsed = 0;
  IT.warnFired = false; IT.ttsWarnFired = false;
  IT.totalDuration = IT.intervals.reduce((s, iv) => s + iv.duration, 0) * IT.rounds;

  setupPanel.classList.add('hidden-panel');
  document.body.classList.add('workout-active');
  updatePlayPauseBtn(true);
  ringWrap.classList.add('visible');

  const prepareSecs = parseInt(document.getElementById('prepareSelect').value) || 0;
  if (prepareSecs > 0) {
    startPrepare(prepareSecs);
  } else {
    beginFirstInterval();
  }
}

function startPrepare(secs) {
  IT.inPrepare = true;
  IT.running   = true;
  IT.prepareSecs = secs;
  prepareOverlay.classList.remove('hidden');
  prepareCountEl.textContent = secs;
  prepareFirstEl.textContent = IT.intervals[0].name;
  playSound('prepare');

  let remaining = secs;
  IT.ticker = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(IT.ticker); IT.ticker = null;
      prepareOverlay.classList.add('hidden');
      IT.inPrepare = false;
      beginFirstInterval();
    } else {
      prepareCountEl.textContent = remaining;
      playSound('prepare');
      haptic([8]);
    }
  }, 1000);
}

function beginFirstInterval() {
  IT.running = true;
  playSound('start');
  speak(IT.intervals[0].name);
  haptic([30]);
  updateStageUI();
  startTick();
}

function pauseWorkout() {
  IT.running = false;
  IT.inPrepare = false;
  clearInterval(IT.ticker); IT.ticker = null;
  updatePlayPauseBtn(false);
  haptic([10]);
  if (!prepareOverlay.classList.contains('hidden')) {
    prepareOverlay.classList.add('hidden');
  }
}

function resumeWorkout() {
  IT.running = true;
  updatePlayPauseBtn(true);
  haptic([10]);
  startTick();
}

function resetWorkout() {
  clearInterval(IT.ticker); IT.ticker = null;
  IT.active = false; IT.running = false; IT.inPrepare = false;
  document.body.classList.remove('workout-active');
  setupPanel.classList.remove('hidden-panel');
  prepareOverlay.classList.add('hidden');
  transOverlay.classList.add('hidden');
  ringWrap.classList.remove('visible');
  updatePlayPauseBtn(false);
  stageBg.className = 'stage-bg state-idle';
  bigTimeEl.textContent = '00:00';
  ciNameEl.textContent = '–'; ciDurationEl.textContent = '–';
  niNameEl.textContent = '–'; niDurationEl.textContent = '–';
  elapsedEl.textContent = '0:00'; remainingEl.textContent = '–'; intervalCountEl.textContent = '–';
  warningFlash.classList.remove('active');
  prFill.style.strokeDashoffset = '0';
}

function skipInterval() {
  if (!IT.active || IT.inPrepare) return;
  clearInterval(IT.ticker); IT.ticker = null;
  IT.segElapsed = getCurrentInterval().duration;
  advanceInterval();
}

// ─── Core Tick ────────────────────────────────────────────────
function startTick() {
  let last = performance.now();
  IT.ticker = setInterval(() => {
    const now   = performance.now();
    const delta = (now - last) / 1000;
    last = now;
    IT.elapsed    += delta;
    IT.segElapsed += delta;

    const seg         = getCurrentInterval();
    const segRemaining = seg.duration - IT.segElapsed;
    const warnSecs     = parseInt(document.getElementById('warnSelect').value) || 0;
    const ttsWarnSecs  = parseInt(document.getElementById('ttsWarnSelect')?.value) || 0;

    // TTS advance warning
    if (ttsWarnSecs > 0 && !IT.ttsWarnFired && segRemaining <= ttsWarnSecs && segRemaining > 0) {
      IT.ttsWarnFired = true;
      const next = getNextInterval();
      if (next) speak(`${next.name} in ${ttsWarnSecs} seconds`);
    }

    // Warning beep/flash
    if (warnSecs > 0 && !IT.warnFired && segRemaining <= warnSecs && segRemaining > 0) {
      IT.warnFired = true;
      warningFlash.classList.add('active');
      playSound('warn');
      haptic([10, 60, 10]);
    }

    if (IT.segElapsed >= seg.duration) {
      advanceInterval();
    } else {
      updateTimerDisplay();
      updateProgressRing(IT.segElapsed / seg.duration);
    }
  }, 50);
}

function advanceInterval() {
  clearInterval(IT.ticker); IT.ticker = null;
  IT.warnFired = false; IT.ttsWarnFired = false;
  warningFlash.classList.remove('active');
  IT.segElapsed = 0;
  IT.intervalIdx++;

  if (IT.intervalIdx >= IT.intervals.length) {
    IT.intervalIdx = 0;
    IT.roundIdx++;
    if (IT.roundIdx >= IT.rounds) { workoutComplete(); return; }
  }

  const next = getCurrentInterval();
  showTransitionFlash(next.name, next.color || typeColor(next), () => {
    playSound('transition');
    speak(next.name);
    haptic([15, 40, 15]);
    updateStageUI();
    if (IT.running) startTick();
  });
}

function workoutComplete() {
  IT.active = false; IT.running = false;
  clearInterval(IT.ticker); IT.ticker = null;
  playSound('end');
  speak('Workout complete! Great work!');
  haptic([50, 100, 50, 100, 50]);
  bigTimeEl.textContent = '00:00';
  ciLabelEl.textContent = '';
  ciNameEl.textContent = 'COMPLETE';
  ciDurationEl.textContent = '🎉';
  nextIntervalEl.style.display = 'none';
  updatePlayPauseBtn(false);
  stageBg.className = 'stage-bg state-rest';
  prFill.style.strokeDashoffset = '0';
  showToast('Workout Complete! 🎉');
}

// ─── 3-2-1 Transition Flash ───────────────────────────────────
function showTransitionFlash(name, color, cb) {
  transOverlay.classList.remove('hidden');
  transOverlay.style.background = hexToRgba(color || '#111', 0.25);
  transName.textContent = name;

  let n = 3;
  transNum.textContent = n;
  transNum.style.animation = 'none';
  void transNum.offsetWidth; // reflow
  transNum.style.animation = '';

  const iv = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(iv);
      transOverlay.classList.add('hidden');
      cb();
    } else {
      transNum.textContent = n;
      transNum.style.animation = 'none';
      void transNum.offsetWidth;
      transNum.style.animation = '';
      playSound('prepare');
      haptic([8]);
    }
  }, 900);
}

// ─── Stage UI ─────────────────────────────────────────────────
function getCurrentInterval()  { return IT.intervals[IT.intervalIdx]; }
function getNextInterval() {
  let ni = IT.intervalIdx + 1, nr = IT.roundIdx;
  if (ni >= IT.intervals.length) { ni = 0; nr++; }
  if (nr >= IT.rounds) return null;
  return IT.intervals[ni];
}

function updateStageUI() {
  const seg  = getCurrentInterval();
  const next = getNextInterval();

  // Background color driven by interval's own color
  const col = typeColor(seg);
  stageBg.style.background = col;
  stageBg.className = 'stage-bg'; // remove state classes, use inline style

  ciLabelEl.textContent = 'CURRENT INTERVAL';
  ciNameEl.textContent  = seg.name;
  ciDurationEl.textContent = formatTime(seg.duration);

  const totalSegs = IT.intervals.length * IT.rounds;
  const curSeg    = IT.roundIdx * IT.intervals.length + IT.intervalIdx + 1;
  intervalCountEl.textContent = `${curSeg}/${totalSegs}`;

  prFill.style.stroke = 'rgba(255,255,255,0.9)';

  if (next) {
    nextIntervalEl.style.display = '';
    niNameEl.textContent    = next.name;
    niDurationEl.textContent = formatTime(next.duration);
    nextIntervalEl.style.background = hexToRgba(typeColor(next), 0.28);
  } else {
    nextIntervalEl.style.display = 'none';
  }
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const seg = getCurrentInterval();
  const segRem = Math.max(0, seg.duration - IT.segElapsed);

  if (IT.countUp) {
    bigTimeEl.textContent = formatTime(IT.segElapsed);
  } else {
    bigTimeEl.textContent = formatTime(Math.ceil(segRem));
  }

  const totalRem = Math.max(0, IT.totalDuration - IT.elapsed);
  remainingEl.textContent = formatTime(Math.ceil(totalRem));
  elapsedEl.textContent   = formatTime(Math.floor(IT.elapsed));
}

function updateProgressRing(fraction) {
  const offset = PR_CIRC * (1 - Math.min(1, fraction));
  prFill.style.strokeDashoffset = offset;
}

function updatePlayPauseBtn(playing) {
  const btn = document.getElementById('btnPlayPause');
  btn.querySelector('.icon-play').classList.toggle('hidden', playing);
  btn.querySelector('.icon-pause').classList.toggle('hidden', !playing);
}

// =========================================================
// SETUP PANEL
// =========================================================

function renderIntervalList() {
  const list = document.getElementById('intervalList');
  list.innerHTML = '';
  IT.intervals.forEach((seg, i) => {
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.draggable = true;
    row.dataset.idx = i;
    row.innerHTML = `
      <div class="ir-drag" title="Drag to reorder">⠿</div>
      <div class="ir-color-dot" style="background:${typeColor(seg)}" data-i="${i}" title="Change color"></div>
      <div class="ir-info" data-i="${i}">
        <div class="ir-name">${seg.name}</div>
        <div class="ir-dur">${formatTime(seg.duration)}</div>
      </div>
      <div class="ir-actions">
        <button class="ir-btn copy" data-i="${i}" title="Duplicate">⎘</button>
        <button class="ir-btn del"  data-i="${i}" title="Delete">✕</button>
      </div>
    `;
    // Edit on name/info tap
    row.querySelector('.ir-info').addEventListener('click', () => editInterval(i));
    // Color dot opens color picker
    row.querySelector('.ir-color-dot').addEventListener('click', (e) => {
      e.stopPropagation();
      pickColor(i);
    });
    // Duplicate
    row.querySelector('.ir-btn.copy').addEventListener('click', (e) => {
      e.stopPropagation();
      IT.intervals.splice(i + 1, 0, { ...IT.intervals[i] });
      renderIntervalList();
    });
    // Delete
    row.querySelector('.ir-btn.del').addEventListener('click', (e) => {
      e.stopPropagation();
      IT.intervals.splice(i, 1);
      renderIntervalList();
    });

    setupDragEvents(row, i);
    list.appendChild(row);
  });
}

// ─── Drag-to-reorder ──────────────────────────────────────────
let dragSrc = null;

function setupDragEvents(row, idx) {
  row.addEventListener('dragstart', (e) => {
    dragSrc = idx;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    document.querySelectorAll('.interval-row').forEach(r => r.classList.remove('drag-over'));
  });
  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.interval-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragSrc === null || dragSrc === idx) return;
    const moved = IT.intervals.splice(dragSrc, 1)[0];
    IT.intervals.splice(idx, 0, moved);
    dragSrc = null;
    renderIntervalList();
  });

  // Touch drag (iOS)
  let touchStartY = 0, touchDragIdx = null;
  row.querySelector('.ir-drag').addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchDragIdx = idx;
    row.classList.add('dragging');
    e.preventDefault();
  }, { passive: false });
  row.querySelector('.ir-drag').addEventListener('touchmove', (e) => {
    e.preventDefault();
    const y = e.touches[0].clientY;
    const rows = [...document.querySelectorAll('.interval-row')];
    rows.forEach(r => r.classList.remove('drag-over'));
    const target = rows.find(r => {
      const rect = r.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    });
    if (target) target.classList.add('drag-over');
  }, { passive: false });
  row.querySelector('.ir-drag').addEventListener('touchend', (e) => {
    row.classList.remove('dragging');
    const rows = [...document.querySelectorAll('.interval-row')];
    const overRow = rows.find(r => r.classList.contains('drag-over'));
    rows.forEach(r => r.classList.remove('drag-over'));
    if (overRow && touchDragIdx !== null) {
      const targetIdx = parseInt(overRow.dataset.idx);
      if (targetIdx !== touchDragIdx) {
        const moved = IT.intervals.splice(touchDragIdx, 1)[0];
        IT.intervals.splice(targetIdx, 0, moved);
        renderIntervalList();
      }
    }
    touchDragIdx = null;
  });
}

// ─── Add Interval ─────────────────────────────────────────────
document.getElementById('addIntervalBtn').addEventListener('click', () => {
  IT.intervals.push({ name: 'Interval', duration: 30, type: 'work', color: '#E8281E' });
  editInterval(IT.intervals.length - 1);
});

// ─── Rounds ───────────────────────────────────────────────────
document.getElementById('roundsInput').addEventListener('change', (e) => {
  IT.rounds = Math.max(1, parseInt(e.target.value) || 1);
});
document.querySelector('.ni-dec').addEventListener('click', () => {
  const inp = document.getElementById('roundsInput');
  const v = Math.max(1, (parseInt(inp.value) || 1) - 1);
  inp.value = v; IT.rounds = v;
});
document.querySelector('.ni-inc').addEventListener('click', () => {
  const inp = document.getElementById('roundsInput');
  const v = (parseInt(inp.value) || 1) + 1;
  inp.value = v; IT.rounds = v;
});

// ─── Save Template ────────────────────────────────────────────
document.getElementById('saveTemplateBtn').addEventListener('click', () => {
  openNameModal((name) => {
    if (!name) return;
    const templates = loadTemplates();
    templates.push({
      id:        'user_' + Date.now(),
      name,
      desc:      IT.intervals.map(iv => iv.name).join(' → '),
      color:     typeColor(IT.intervals[0] || {}),
      rounds:    IT.rounds,
      intervals: JSON.parse(JSON.stringify(IT.intervals)),
    });
    saveTemplates(templates);
    showToast('Template saved!');
  });
});

// ─── Modals ───────────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const modalBody    = document.getElementById('modalBody');
let modalOkCb = null;

document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOk').addEventListener('click', () => { if (modalOkCb) modalOkCb(); });
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

function closeModal() { modalOverlay.classList.add('hidden'); }
function openModal(title, bodyHTML, cb) {
  modalTitle.textContent = title;
  modalBody.innerHTML    = bodyHTML;
  modalOkCb = cb;
  modalOverlay.classList.remove('hidden');
}

// Edit interval modal
function editInterval(idx) {
  const seg  = IT.intervals[idx];
  const mins = Math.floor(seg.duration / 60);
  const secs = seg.duration % 60;
  const types = ['work','rest','warmup','cooldown','prepare','custom'];
  const curColor = typeColor(seg);

  openModal('Edit Interval', `
    <div class="modal-field">
      <label>Name</label>
      <input id="mName" type="text" value="${esc(seg.name)}" maxlength="32">
    </div>
    <div class="modal-row">
      <div class="modal-field">
        <label>Minutes</label>
        <input id="mMin" type="number" value="${mins}" min="0" max="99">
      </div>
      <div class="modal-field">
        <label>Seconds</label>
        <input id="mSec" type="number" value="${secs}" min="0" max="59">
      </div>
    </div>
    <div class="modal-field">
      <label>Type</label>
      <select id="mType">${types.map(t => `<option value="${t}" ${t===seg.type?'selected':''}>${cap(t)}</option>`).join('')}</select>
    </div>
    <div class="modal-field">
      <label>Color</label>
      <div class="color-picker-row" id="colorPicker">
        ${PALETTE.map(c => `
          <div class="color-swatch ${c===curColor?'selected':''}"
               style="background:${c}"
               data-color="${c}"></div>
        `).join('')}
      </div>
    </div>
  `, () => {
    const name  = document.getElementById('mName').value.trim() || 'Interval';
    const m     = parseInt(document.getElementById('mMin').value) || 0;
    const s     = parseInt(document.getElementById('mSec').value) || 0;
    const dur   = Math.max(1, m * 60 + s);
    const type  = document.getElementById('mType').value;
    const color = document.querySelector('.color-swatch.selected')?.dataset.color
                  || TYPE_DEFAULTS[type]?.color || '#8E8E93';
    IT.intervals[idx] = { name, duration: dur, type, color };
    renderIntervalList();
    closeModal();
  });

  // Color swatch selection
  setTimeout(() => {
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
      });
    });
    document.getElementById('mName')?.focus();
  }, 50);
}

// Quick color picker (from color dot in list)
function pickColor(idx) {
  const seg = IT.intervals[idx];
  const cur = typeColor(seg);
  openModal('Pick Color', `
    <div class="color-picker-row" id="colorPicker" style="justify-content:center">
      ${PALETTE.map(c => `
        <div class="color-swatch ${c===cur?'selected':''}"
             style="background:${c}; width:42px; height:42px"
             data-color="${c}"></div>
      `).join('')}
    </div>
  `, () => {
    const picked = document.querySelector('.color-swatch.selected')?.dataset.color;
    if (picked) { IT.intervals[idx].color = picked; renderIntervalList(); }
    closeModal();
  });
  setTimeout(() => {
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
      });
    });
  }, 50);
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
document.querySelectorAll('.tmpl-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentTemplateTab = tab.dataset.tab;
    document.querySelectorAll('.tmpl-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderTemplates();
  });
});

function renderTemplates() {
  const grid = document.getElementById('templateGrid');
  grid.innerHTML = '';

  const userTemplates = loadTemplates();
  const list = currentTemplateTab === 'builtin' ? BUILTIN_TEMPLATES : userTemplates;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <p>No saved workouts yet</p>
        <span>Configure a workout and tap "Save as Template"</span>
      </div>`;
    return;
  }

  list.forEach(tmpl => {
    const card = document.createElement('div');
    card.className = 'template-card';
    const totalSecs = tmpl.intervals.reduce((s, iv) => s + iv.duration, 0) * tmpl.rounds;
    card.innerHTML = `
      <div class="tc-color-bar" style="background:${tmpl.color}"></div>
      <div class="tc-info">
        <div class="tc-name">${esc(tmpl.name)}</div>
        <div class="tc-desc">${esc(tmpl.desc)}</div>
        <div class="tc-meta">${tmpl.rounds} round${tmpl.rounds>1?'s':''} · ${formatTime(totalSecs)}</div>
      </div>
      <div class="tc-actions">
        <button class="tc-btn use">Use</button>
        ${!tmpl.builtin ? `<button class="tc-btn delete">Delete</button>` : ''}
      </div>
    `;
    card.querySelector('.use').addEventListener('click', () => {
      IT.intervals = JSON.parse(JSON.stringify(tmpl.intervals));
      IT.rounds    = tmpl.rounds;
      document.getElementById('roundsInput').value = tmpl.rounds;
      renderIntervalList();
      switchView('timer');
      showToast(`${tmpl.name} loaded`);
    });
    if (!tmpl.builtin) {
      card.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        saveTemplates(loadTemplates().filter(t => t.id !== tmpl.id));
        renderTemplates();
      });
    }
    grid.appendChild(card);
  });
}

// =========================================================
// STOPWATCH
// =========================================================
const swTimeEl  = document.getElementById('swTime');
const swStart   = document.getElementById('swStart');
const swLap     = document.getElementById('swLap');
const swReset   = document.getElementById('swReset');
const lapListEl = document.getElementById('lapList');

swStart.addEventListener('click', () => {
  getAudioCtx();
  if (SW.running) {
    SW.running = false;
    clearInterval(SW.ticker); SW.ticker = null;
    swStart.querySelector('.icon-play').classList.remove('hidden');
    swStart.querySelector('.icon-pause').classList.add('hidden');
  } else {
    SW.running   = true;
    SW.startTime = performance.now() - SW.elapsed;
    swStart.querySelector('.icon-play').classList.add('hidden');
    swStart.querySelector('.icon-pause').classList.remove('hidden');
    swLap.disabled = false;
    SW.ticker = setInterval(() => {
      SW.elapsed = performance.now() - SW.startTime;
      swTimeEl.textContent = formatStopwatch(SW.elapsed);
    }, 50);
  }
});

swLap.addEventListener('click', () => {
  if (!SW.running) return;
  const lapTime = SW.laps.length > 0
    ? SW.elapsed - SW.laps.reduce((s, l) => s + l, 0)
    : SW.elapsed;
  SW.laps.push(lapTime);
  playSound('prepare'); haptic([10]);
  renderLaps();
});

swReset.addEventListener('click', () => {
  SW.running = false; clearInterval(SW.ticker); SW.ticker = null;
  SW.elapsed = 0; SW.laps = [];
  swTimeEl.textContent = '00:00.00';
  swLap.disabled = true;
  swStart.querySelector('.icon-play').classList.remove('hidden');
  swStart.querySelector('.icon-pause').classList.add('hidden');
  lapListEl.innerHTML = '';
});

function renderLaps() {
  if (SW.laps.length === 0) { lapListEl.innerHTML = ''; return; }
  const min = Math.min(...SW.laps);
  const max = Math.max(...SW.laps);
  lapListEl.innerHTML = '';
  [...SW.laps].reverse().forEach((t, i) => {
    const num = SW.laps.length - i;
    const fastest = t === min && SW.laps.length > 1;
    const slowest = t === max && SW.laps.length > 1;
    const row = document.createElement('div');
    row.className = 'lap-row' + (fastest ? ' fastest' : '') + (slowest ? ' slowest' : '');
    row.innerHTML = `
      <span class="lap-num">Lap ${num}${fastest ? '<span class="lap-badge">BEST</span>' : ''}${slowest ? '<span class="lap-badge">SLOW</span>' : ''}</span>
      <span class="lap-time">${formatStopwatch(t)}</span>
    `;
    lapListEl.appendChild(row);
  });
}

// =========================================================
// COUNTDOWN
// =========================================================
const cdTimeEl  = document.getElementById('cdTime');
const cdStart   = document.getElementById('cdStart');
const cdReset   = document.getElementById('cdReset');
const cdMinEl   = document.getElementById('cdMinutes');
const cdSecEl   = document.getElementById('cdSeconds');

function getCDDuration() {
  return (parseInt(cdMinEl.value) || 0) * 60 + (parseInt(cdSecEl.value) || 0);
}
function updateCDDisplay() {
  cdTimeEl.textContent = formatTime(Math.ceil(CD.remaining));
}

[cdMinEl, cdSecEl].forEach(el => {
  el.addEventListener('change', () => {
    if (!CD.running) { CD.duration = getCDDuration(); CD.remaining = CD.duration; updateCDDisplay(); }
  });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (CD.running) return;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset'));
    btn.classList.add('active-preset');
    const s = parseInt(btn.dataset.seconds);
    cdMinEl.value = Math.floor(s / 60); cdSecEl.value = s % 60;
    CD.duration = s; CD.remaining = s;
    updateCDDisplay();
  });
});

let cdWarnFired = false;
cdStart.addEventListener('click', () => {
  getAudioCtx();
  if (CD.running) {
    CD.running = false; clearInterval(CD.ticker); CD.ticker = null;
    cdStart.querySelector('.icon-play').classList.remove('hidden');
    cdStart.querySelector('.icon-pause').classList.add('hidden');
  } else {
    if (CD.remaining <= 0) { CD.remaining = getCDDuration(); cdWarnFired = false; }
    if (CD.remaining <= 0) return;
    CD.running = true;
    cdWarnFired = false;
    let last = performance.now();
    cdStart.querySelector('.icon-play').classList.add('hidden');
    cdStart.querySelector('.icon-pause').classList.remove('hidden');
    CD.ticker = setInterval(() => {
      const now = performance.now();
      CD.remaining -= (now - last) / 1000;
      last = now;
      if (!cdWarnFired && CD.remaining <= 3 && CD.remaining > 0) {
        cdWarnFired = true; playSound('warn'); haptic([10,60,10]);
      }
      if (CD.remaining <= 0) {
        CD.remaining = 0; CD.running = false;
        clearInterval(CD.ticker); CD.ticker = null;
        cdTimeEl.textContent = '00:00';
        playSound('end'); haptic([50,100,50]);
        speak('Time is up');
        cdStart.querySelector('.icon-play').classList.remove('hidden');
        cdStart.querySelector('.icon-pause').classList.add('hidden');
        return;
      }
      updateCDDisplay();
    }, 50);
  }
});

cdReset.addEventListener('click', () => {
  CD.running = false; clearInterval(CD.ticker); CD.ticker = null;
  CD.duration = getCDDuration(); CD.remaining = CD.duration;
  cdWarnFired = false;
  updateCDDisplay();
  cdStart.querySelector('.icon-play').classList.remove('hidden');
  cdStart.querySelector('.icon-pause').classList.add('hidden');
});

// ─── Helpers ──────────────────────────────────────────────────
function formatTime(totalSecs) {
  const s = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function formatStopwatch(ms) {
  const t     = Math.floor(ms);
  const mins  = Math.floor(t / 60000);
  const secs  = Math.floor((t % 60000) / 1000);
  const cents = Math.floor((t % 1000) / 10);
  return String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0') + '.' + String(cents).padStart(2,'0');
}
function cap(s)   { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function hexToRgba(hex, alpha) {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Wake Lock ────────────────────────────────────────────────
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (IT.running || SW.running || CD.running)) requestWakeLock();
});

// ─── Init ─────────────────────────────────────────────────────
renderIntervalList();
updateCDDisplay();
requestWakeLock();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// iOS: prevent double-tap zoom
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - (document._lastTap || 0) < 300) e.preventDefault();
  document._lastTap = now;
}, { passive: false });
