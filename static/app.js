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

// ================== LANGUAGE DICTIONARY ==================
const DISPLAY_WORDS = {
  hello: {
    en: "hello",
    de: "hallo"
  },
  this: {
    en: "this",
    de: "this"
  },
  program: {
    en: "program",
    de: "Programm"
  },
  we: {
    en: "we",
    de: "wir"
  },
  made: {
    en: "made",
    de: "gemacht"
  },
  thank_you: {
    en: "thank you",
    de: "danke"
  },
  all: {
    en: "everyone",
    de: "alle"
  }
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

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });

    els.preview.srcObject = mediaStream;
    await els.preview.play();

    els.btnStart.disabled = true;
    els.btnStop.disabled = false;

    startHandDetection();
  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera could not be started");
  }
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

  els.transcriptList.scrollTop = els.transcriptList.scrollHeight;
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = currentLang === 'de' ? 'de-DE' : 'en-GB';
  utterance.rate = 1;

  window.speechSynthesis.speak(utterance);
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
    const text = transcript.join('\n');
    navigator.clipboard.writeText(text);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;

      document.querySelectorAll('.lang-btn')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      renderOverlay(currentSentence.join(' '));
    });
  });

  els.fontSize.addEventListener('input', () => {
    renderOverlay(currentSentence.join(' '));
  });

  els.toggleOverlay.addEventListener('change', () => {
    renderOverlay(currentSentence.join(' '));
  });

  await initMediaPipe();
});
