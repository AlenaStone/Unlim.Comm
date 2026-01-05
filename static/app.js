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

  console.log("✅ MediaPipe ready");
}

// ================== CAMERA ==================
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
    console.error('CAMERA ERROR:', err);
    alert('Camera could not be started');
  }
}

function stopCamera() {
  if (!mediaStream) return;

  mediaStream.getTracks().forEach(t => t.stop());
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
        addSentence(gesture);
      }
    }

    requestAnimationFrame(loop);
  }

  loop();
}

// ================== GESTURE LOGIC ==================
function detectGesture(hand) {
  const indexUp = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp = hand[16].y < hand[14].y;
  const pinkyUp = hand[20].y < hand[18].y;

  if (indexUp && middleUp && ringUp && pinkyUp) return 'hallo';
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'danke';

  return '';
}

// ================== TRANSCRIPT ==================
function addSentence(word) {
  currentSentence.push(word);
  renderOverlay(currentSentence.join(' '));
}

function renderTranscript() {
  els.transcriptList.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = getTranscriptWithPunctuation();
  els.transcriptList.appendChild(p);
}

function renderOverlay(text) {
  els.overlay.innerHTML = '';
  if (!els.toggleOverlay.checked || !text) return;

  const bubble = document.createElement('div');
  bubble.className = 'subtitle';
  bubble.textContent = text;
  bubble.style.fontSize = (Number(els.fontSize.value) || 28) + 'px';
  els.overlay.appendChild(bubble);
}

// ================== TEXT TO SPEECH ==================
function speakText(text) {
  if (!text || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = 1;
  u.pitch = 1;
  u.volume = 1;

  window.speechSynthesis.speak(u);
}

// ================== TEXT WITH PUNCTUATION ==================
function getTranscriptWithPunctuation() {
  const p = els.punctuationChoice.value || '';
  return transcript.join(' ') + p;
}

// ================== INIT UI ==================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM READY');

  // ---- DOM ELEMENTS ----
  els = {
    preview: document.getElementById('preview'),
    overlay: document.getElementById('overlay'),
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    btnSpeak: document.getElementById('btnSpeak'),
    fontSize: document.getElementById('fontSize'),
    toggleOverlay: document.getElementById('toggleOverlay'),
    transcriptList: document.getElementById('transcriptList'),
    punctuationChoice: document.getElementById('punctuationChoice'),
    themeToggle: document.getElementById('themeToggle'),
  };

  console.log('ELS:', els);

  // ---- BUTTONS ----
  els.btnStart.addEventListener('click', startCamera);
  els.btnStop.addEventListener('click', stopCamera);

  els.btnSpeak.addEventListener('click', () => {
    if (transcript.length) {
      speakText(getTranscriptWithPunctuation());
    }
  });

els.fontSize.addEventListener('input', () => {
  renderOverlay(currentSentence.join(' '));
});

els.toggleOverlay.addEventListener('change', () => {
  if (els.toggleOverlay.checked) {
    renderOverlay(currentSentence.join(' '));
  } else {
    renderOverlay('');
  }
});
    els.punctuationChoice.addEventListener('change', () => {
  const p = els.punctuationChoice.value;
  if (!p || currentSentence.length === 0) return;

  const finished = currentSentence.join(' ') + p;
  transcript.push(finished);

  currentSentence = [];
  renderTranscript();
  renderOverlay('');
   els.punctuationChoice.value = '';
});

  // ---- THEME ----
  const root = document.documentElement;
  if (localStorage.getItem('theme') === 'light') {
    root.setAttribute('data-theme', 'light');
  }

  els.themeToggle.addEventListener('click', () => {
    const isLight = root.getAttribute('data-theme') === 'light';

    if (isLight) {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  });

  // ---- MEDIAPIPE LAST ----
  await initMediaPipe();
});
