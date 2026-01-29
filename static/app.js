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
  hello:       { en: "hello",        de: "hallo" },
  this:        { en: "this",         de: "dies" },
  program:     { en: "program",      de: "Programm" },
  we:          { en: "we",           de: "wir" },
  made:        { en: "made",         de: "gemacht" },
  thank_you:   { en: "thank you",    de: "danke" },
  all:         { en: "everyone",     de: "alle" },

  yes:         { en: "yes",          de: "ja" },
  there_are:   { en: "there are",    de: "es gibt" },
  questions:   { en: "questions",    de: "Fragen" }
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

// ================== HELPERS ==================
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ================== GESTURE RECOGNITION ==================
function detectGesture(hand) {
  const thumbUp  = hand[4].y < hand[3].y;
  const indexUp  = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp   = hand[16].y < hand[14].y;
  const pinkyUp  = hand[20].y < hand[18].y;

  // ---- QUESTIONS (fingers compact / circle shape)
  const tips = [hand[8], hand[12], hand[16], hand[20]];
  const compact =
    dist(tips[0], tips[1]) < 0.04 &&
    dist(tips[1], tips[2]) < 0.04 &&
    dist(tips[2], tips[3]) < 0.04;

  const thumbNear = dist(hand[4], hand[8]) < 0.05;

  if (compact && thumbNear) return 'questions';

  // ---- YES (thumb up only)
  if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) return 'yes';

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

  if (raw.includes('there are') && raw.includes('questions')) {
    return currentLang === 'de'
      ? "Es gibt Fragen aus dem Publikum."
      : "There are questions from the audience.";
  }

  if (raw.includes('thank')) {
    return currentLang === 'de'
      ? "Vielen Dank für Ihre Aufmerksamkeit!"
      : "Thank you very much for your attention!";
  }

  const simple = words.join(' ');
  return simple.charAt(0).toUpperCase() + simple.slice(1) + '.';
}
