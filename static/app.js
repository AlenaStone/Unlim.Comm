// ================== IMPORTS ==================
import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// ================== STATE ==================
let els = {};
let mediaStream = null;
let handLandmarker = null;

let lastGesture = '';
let lastGestureTime = 0;

const transcript = [];
let currentSentence = [];

let currentLang = 'en';
let voices = [];

// ================== LANGUAGE DICTIONARY ==================
const DISPLAY_WORDS = {
  hello: { en: "hello", de: "hallo" },
  this: { en: "this", de: "dies" },
  program: { en: "program", de: "Programm" },
  we: { en: "we", de: "wir" },
  made: { en: "made", de: "gemacht" },
  thank_you: { en: "thank you", de: "danke" },
  all: { en: "everyone", de: "alle" }
};

// ================== MEDIAPIPE INIT ==================
async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
    },
    runningMode: "VIDEO",
    numHands: 1
  });

  console.log("MediaPipe initialized");
}

// ================== CAMERA CONTROL ==================
async function startCamera() {
  if (mediaStream) return;

  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });

  els.preview.srcObject = mediaStream;
  await els.preview.play();

  els.btnStart.disabled = true;
  els.btnStop.disabled = false;

  startHandDetection();
}

function stopCamera() {
  if (!mediaStream) return;

  mediaStream.getTracks().forEach(track => track.stop());
  mediaStream = null;
  els.preview.srcObject = null;

  els.btnStart.disabled = false;
  els.btnStop.disabled = true;
}

// ================== HAND DETECTION LOOP ==================
function startHandDetection() {
  const video = els.preview;

  function loop() {
    if (!handLandmarker || !video.videoWidth) {
      requestAnimationFrame(loop);
      return;
    }

    const now = performance.now();
    const results = handLandmarker.detectForVideo(video, now);

    if (results.landmarks?.length) {
      const gesture = detectGesture(results.landmarks[0]);

      if (
        gesture &&
        gesture !== lastGesture &&
        now - lastGestureTime > 800
      ) {
        lastGesture = gesture;
        lastGestureTime = now;

        addWordToBuffer(gesture);
        highlightGestureCard(gesture);
      }
    }

    requestAnimationFrame(loop);
  }

  loop();
}

// ================== GESTURE RECOGNITION ==================
function detectGesture(hand) {
  const thumbUp  = hand[4].y < hand[3].y;
  const indexUp  = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp   = hand[16].y < hand[14].y;
  const pinkyUp  = hand[20].y < hand[18].y;

  if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) return 'hello';
  if (indexUp && pinkyUp && !middleUp && !ringUp) return 'all';
  if (indexUp && !thumbUp && !middleUp && !ringUp && !pinkyUp) return 'this';
  if (thumbUp && indexUp && !middleUp && !ringUp && !pinkyUp) return 'made';
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'we';
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'program';
  if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) return 'thank_you';

  return '';
}

// ================== GESTURE BOOK HIGHLIGHT ==================
function highlightGestureCard(gestureKey) {
  document.querySelectorAll('.gesture-card')
    .forEach(card => card.classList.remove('active'));

  const card = document.querySelector(
    `.gesture-card[data-gesture="${gestureKey}"]`
  );

  if (card) card.classList.add('active');
}

// ================== GESTURE BOOK LANGUAGE ==================
function updateGestureBookLanguage() {
  document.querySelectorAll('[data-lang]').forEach(el => {
    el.hidden = el.dataset.lang !== currentLang;
  });
}

// ================== BUFFER HANDLER ==================
function addWordToBuffer(gestureKey) {
  const word = DISPLAY_WORDS[gestureKey]?.[currentLang] || gestureKey;
  currentSentence.push(word);
  renderOverlay(currentSentence.join(' '));
}

// ================== SEND ACTION ==================
function handleSend() {
  if (!currentSentence.length) return;

  const sentence = refineSentence(currentSentence);
  transcript.push(sentence);
  renderTranscript();

  if (els.toggleVoice?.checked) {
    speakText(sentence);
  }

  currentSentence = [];
  renderOverlay('');
}

// ================== UI RENDERERS ==================
function renderTranscript() {
  els.transcriptList.innerHTML = '';
  transcript.forEach(text => {
    const p = document.createElement('p');
    p.textContent = text;
    els.transcriptList.appendChild(p);
  });
}

function renderOverlay(text) {
  els.overlay.innerHTML = '';
  if (!els.toggleOverlay.checked || !text) return;

  const bubble = document.createElement('div');
  bubble.className = 'subtitle';
  bubble.textContent = text;

  let size = Number(els.fontSize.value) || 28;
  if (text.length > 25) size = Math.max(18, size * 0.8);
  bubble.style.fontSize = size + 'px';

  els.overlay.appendChild(bubble);
}

// ================== TEXT TO SPEECH ==================
function speakText(text) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);

  let voice = null;

  if (currentLang === 'de') {
    voice = voices.find(v => v.lang === 'de-DE');
    u.lang = 'de-DE';
  } else {
    voice = voices.find(v => v.lang === 'en-GB' || v.lang === 'en-US');
    u.lang = 'en-GB';
  }

  if (!voice) return;

  u.voice = voice;
  u.rate = 1;
  u.pitch = 1;

  window.speechSynthesis.speak(u);
}

// ================== SENTENCE LOGIC ==================
function refineSentence(words) {
  const raw = words.join(' ').toLowerCase();

  if (raw.includes('hello')) {
    return currentLang === 'de'
      ? "Hallo zusammen! Willkommen zu unserem Projekt."
      : "Hello everyone! Welcome to our project.";
  }

  if (raw.includes('program') || (raw.includes('we') && raw.includes('made'))) {
    return currentLang === 'de'
      ? "Wir haben diese Software entwickelt, um die Kommunikation zu erleichtern."
      : "We developed this software to help people communicate more easily.";
  }

  if (raw.includes('thank')) {
    return currentLang === 'de'
      ? "Vielen Dank für Ihre Aufmerksamkeit!"
      : "Thank you very much for your attention!";
  }

  const simple = words.join(' ');
  return simple.charAt(0).toUpperCase() + simple.slice(1) + '.';
}

// ================== THEME ==================
function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');

  if (saved === 'light') {
    root.setAttribute('data-theme', 'light');
  }

  els.themeToggle?.addEventListener('click', () => {
    const isLight = root.getAttribute('data-theme') === 'light';

    if (isLight) {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  });
}

// ================== INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', async () => {

  els = {
    preview: document.getElementById('preview'),
    overlay: document.getElementById('overlay'),

    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    btnSend: document.getElementById('btnSend'),

    btnUndo: document.getElementById('btnUndo'),
    btnClear: document.getElementById('btnClear'),
    btnCopy: document.getElementById('btnCopy'),

    toggleVoice: document.getElementById('toggleVoice'),
    toggleOverlay: document.getElementById('toggleOverlay'),

    fontSize: document.getElementById('fontSize'),
    transcriptList: document.getElementById('transcriptList'),
    themeToggle: document.getElementById('themeToggle')
  };

  initTheme();

  els.btnStart.addEventListener('click', startCamera);
  els.btnStop.addEventListener('click', stopCamera);
  els.btnSend.addEventListener('click', handleSend);

  els.btnUndo?.addEventListener('click', () => {
    currentSentence.pop();
    renderOverlay(currentSentence.join(' '));
  });

  els.btnClear?.addEventListener('click', () => {
    currentSentence = [];
    renderOverlay('');
  });

  els.btnCopy?.addEventListener('click', () => {
    navigator.clipboard.writeText(transcript.join('\n'));
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.langSwitch;

      document.querySelectorAll('.lang-btn')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      renderOverlay(currentSentence.join(' '));
      updateGestureBookLanguage();
    });
  });

  els.fontSize.addEventListener('input', () => {
    renderOverlay(currentSentence.join(' '));
  });

  els.toggleOverlay.addEventListener('change', () => {
    renderOverlay(currentSentence.join(' '));
  });

  speechSynthesis.onvoiceschanged = () => {
    voices = speechSynthesis.getVoices();
  };

  updateGestureBookLanguage();
  await initMediaPipe();
});
