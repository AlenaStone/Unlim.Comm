// ================== DOM ==================
import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";


const els = {
  preview: document.getElementById('preview'),
  overlay: document.getElementById('overlay'),
  btnStart: document.getElementById('btnStart'),
  btnStop: document.getElementById('btnStop'),
  fontSize: document.getElementById('fontSize'),
  toggleOverlay: document.getElementById('toggleOverlay'),
  transcriptList: document.getElementById('transcriptList'),
};

// ================== STATE ==================
let mediaStream = null;
let handLandmarker = null;
let lastGesture = '';
let lastGestureTime = 0;
const transcript = [];

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




initMediaPipe();

// ================== CAMERA ==================
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

    if (results.landmarks && results.landmarks.length > 0) {
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

// ================== SIMPLE GESTURE LOGIC ==================
function detectGesture(hand) {
  const indexUp = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp = hand[16].y < hand[14].y;
  const pinkyUp = hand[20].y < hand[18].y;

  const allUp = indexUp && middleUp && ringUp && pinkyUp;
  const allDown = !indexUp && !middleUp && !ringUp && !pinkyUp;

  if (allUp) return 'hallo';
  if (allDown) return 'danke';

  return '';
}

// ================== TRANSCRIPT ==================
function addSentence(text) {
  transcript.push(text);
  renderTranscript();
  renderOverlay(text);
}

function renderTranscript() {
  els.transcriptList.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = transcript.join(' ');
  els.transcriptList.appendChild(p);
}

function renderOverlay(text) {
  els.overlay.innerHTML = '';
  if (!els.toggleOverlay.checked) return;

  const bubble = document.createElement('div');
  bubble.className = 'subtitle';
  bubble.textContent = text;
  bubble.style.fontSize = (Number(els.fontSize?.value) || 28) + 'px';
  els.overlay.appendChild(bubble);
}

// ================== UI ==================
document.addEventListener('DOMContentLoaded', () => {
  els.btnStart?.addEventListener('click', startCamera);
  els.btnStop?.addEventListener('click', stopCamera);
  els.fontSize?.addEventListener('input', () => renderOverlay(lastGesture));
  els.toggleOverlay?.addEventListener('change', () => renderOverlay(lastGesture));
});
