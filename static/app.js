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

// Mapping: Internal Gesture ID -> Display Word
const DISPLAY_WORDS = {
  hello: "hello",
  this: "this",
  program: "program",
  we: "we",
  made: "made",
  thank_you: "thank you"
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

  console.log("✅ MediaPipe ready");
}

// ================== CAMERA LOGIC ==================
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

// ================== DETECTION LOOP ==================
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

      // Debounce logic: prevent flickering (800ms delay)
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
  // Y coordinate: Lower value means higher on screen (Tip < Base = Finger Up)
  // 4=Thumb, 8=Index, 12=Middle, 16=Ring, 20=Pinky
  
  const thumbUp  = hand[4].y < hand[3].y;
  const indexUp  = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp   = hand[16].y < hand[14].y;
  const pinkyUp  = hand[20].y < hand[18].y;

  // 1. Open Hand -> HELLO
  // All fingers up
  if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) {
    return 'hello';
  }

  // 2. Index Finger -> THIS / POINTER
  // Only Index up
  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return 'this';
  }

  // 3. Fist -> WE
  // All fingers down
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
    return 'we';
  }

  // 4. Thumb Up -> MADE / GOOD
  // Only Thumb up
  if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
    return 'made';
  }

  // 5. Victory Sign -> PROGRAM
  // Index & Middle up
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return 'program';
  }

  // 6. Shaka / Phone -> THANK YOU
  // Thumb & Pinky up
  if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) {
    return 'thank_you';
  }

  return '';
}

// ================== DATA HANDLING ==================
function addWordToBuffer(gestureKey) {
  const word = DISPLAY_WORDS[gestureKey] || gestureKey;
  currentSentence.push(word);
  renderOverlay(currentSentence.join(' '));
}

function renderTranscript() {
  els.transcriptList.innerHTML = '';
  
  transcript.forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
    els.transcriptList.appendChild(p);
  });
  
  // Auto-scroll to bottom
  els.transcriptList.scrollTop = els.transcriptList.scrollHeight;
}

function renderOverlay(text) {
  els.overlay.innerHTML = '';
  if (!els.toggleOverlay.checked || !text) return;

  const bubble = document.createElement('div');
  bubble.className = 'subtitle';
  bubble.textContent = text;
  
  const size = Number(els.fontSize.value) || 28;
  bubble.style.fontSize = size + 'px';
  
  els.overlay.appendChild(bubble);
}

// ================== SPEECH SYNTHESIS ==================
function speakText(text) {
  if (!text || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; // English for the demo
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

// ================== SMART SENTENCE BUILDER ==================
function refineSentence(wordsArray) {
  const rawText = wordsArray.join(' ').toLowerCase();

  // Scenario 1: Greeting
  // Input: "hello"
  if (rawText.includes('hello')) {
    return "Hello everyone! Welcome to our project presentation.";
  }

  // Scenario 2: Main Pitch
  // Input: "we" + "made" + "program" OR "this" + "program"
  if (
    (rawText.includes('we') && rawText.includes('made')) ||
    (rawText.includes('program') && rawText.includes('this'))
  ) {
    return "We developed this software to help mute people communicate efficiently.";
  }

  // Scenario 3: Closing
  // Input: "thank you"
  if (rawText.includes('thank') || rawText.includes('made')) {
     // Fallback: if they just show thumb up at the end, treat as thank you
    return "Thank you very much for your attention!";
  }

  // Fallback: Simple capitalization
  const simple = wordsArray.join(' ');
  return simple.charAt(0).toUpperCase() + simple.slice(1) + ".";
}

// ================== UI INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM READY');

  // 1. Get Elements
  els = {
    preview: document.getElementById('preview'),
    overlay: document.getElementById('overlay'),
    
    // Control Buttons
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    
    // Action Buttons
    btnSpeak: document.getElementById('btnSpeak'),
    btnUndo: document.getElementById('btnUndo'),
    btnClear: document.getElementById('btnClear'),
    btnCopy: document.getElementById('btnCopy'),
    
    // Settings
    fontSize: document.getElementById('fontSize'),
    toggleOverlay: document.getElementById('toggleOverlay'),
    transcriptList: document.getElementById('transcriptList'),
    punctuationChoice: document.getElementById('punctuationChoice'),
    themeToggle: document.getElementById('themeToggle'),
  };

  // 2. Camera Listeners
  els.btnStart.addEventListener('click', startCamera);
  els.btnStop.addEventListener('click', stopCamera);

  // 3. Speak Button (The Magic)
  if (els.btnSpeak) {
    els.btnSpeak.addEventListener('click', () => {
      if (currentSentence.length === 0) return;

      const finalPhrase = refineSentence(currentSentence);

      renderOverlay(finalPhrase);
      transcript.push(finalPhrase);
      renderTranscript();
      speakText(finalPhrase);

      currentSentence = [];
    });
  }

  // 4. Edit Buttons (Undo / Clear / Copy)
  
  // Undo: Remove last word
  if (els.btnUndo) {
    els.btnUndo.addEventListener('click', () => {
      currentSentence.pop();
      renderOverlay(currentSentence.join(' '));
    });
  }

  // Clear: Reset current buffer
  if (els.btnClear) {
    els.btnClear.addEventListener('click', () => {
      currentSentence = [];
      renderOverlay('');
    });
  }

  // Copy: Copy transcript to clipboard
  if (els.btnCopy) {
    els.btnCopy.addEventListener('click', () => {
      const textToCopy = Array.from(els.transcriptList.querySelectorAll('p'))
          .map(p => p.textContent)
          .join('\n');
      
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => alert('Transcript copied!'))
          .catch(err => console.error('Copy failed', err));
      }
    });
  }

  // 5. Visual Settings
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

  // 6. Theme Toggle
  const root = document.documentElement;
  if (localStorage.getItem('theme') === 'light') {
    root.setAttribute('data-theme', 'light');
  }

  if (els.themeToggle) {
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
  }

  // 7. Start MediaPipe
  await initMediaPipe();
});