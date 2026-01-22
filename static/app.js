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
let currentSentence = []; // Buffer for RAW words

// Mapping: Gesture Key -> Display Word
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

      // Debounce: 800ms delay to prevent flickering
      if (
        gesture &&
        gesture !== lastGesture &&
        now - lastGestureTime > 800
      ) {
        lastGesture = gesture;
        lastGestureTime = now;
        
        // Add word to temporary buffer
        addWordToBuffer(gesture);
      }
    }

    requestAnimationFrame(loop);
  }

  loop();
}

// ================== GESTURE RECOGNITION ==================
function detectGesture(hand) {
  // Check finger states
  const thumbUp  = hand[4].y < hand[3].y;
  const indexUp  = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp   = hand[16].y < hand[14].y;
  const pinkyUp  = hand[20].y < hand[18].y;

  // 1. HELLO (Open Palm)
  if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) {
    return 'hello';
  }

  // 2. THIS (Index Finger)
  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return 'this';
  }

  // 3. WE (Fist)
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
    return 'we';
  }

  // 4. MADE (Thumb Up)
  if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
    return 'made';
  }

  // 5. PROGRAM (Victory Sign)
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return 'program';
  }

  // 6. THANK YOU (Shaka / Phone)
  if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) {
    return 'thank_you';
  }

  return '';
}

// ================== BUFFER HANDLER ==================
function addWordToBuffer(gestureKey) {
  const word = DISPLAY_WORDS[gestureKey] || gestureKey;
  
  // Add raw word to buffer
  currentSentence.push(word);

  // Show raw words on overlay (Draft mode)
  // e.g., "we made program"
  renderOverlay(currentSentence.join(' '));
}

// ================== SEND BUTTON LOGIC (THE MAGIC) ==================
function handleSend() {
    if (currentSentence.length === 0) return;

    // 1. Convert raw words to a smart sentence
    const smartSentence = refineSentence(currentSentence);

    // 2. Add to the transcript list
    transcript.push(smartSentence);
    renderTranscript();

    // 3. Speak the result
    speakText(smartSentence);

    // 4. Clear the overlay for the next phrase
    currentSentence = [];
    renderOverlay('');
}

// ================== UI RENDERERS ==================
function renderTranscript() {
  els.transcriptList.innerHTML = '';
  
  transcript.forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.borderBottom = "1px solid #333";
    p.style.padding = "8px 0";
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
  
  // Overlay Styles
  bubble.style.whiteSpace = "pre-wrap"; 
  bubble.style.wordWrap = "break-word";
  bubble.style.width = "90%";
  bubble.style.textAlign = "center";
  bubble.style.padding = "10px";
  bubble.style.background = "rgba(0, 0, 0, 0.6)"; 
  bubble.style.borderRadius = "12px";
  bubble.style.margin = "0 auto";

  let size = Number(els.fontSize.value) || 28;
  if (text.length > 25) size = Math.max(18, size * 0.8);
  bubble.style.fontSize = size + 'px';
  
  els.overlay.appendChild(bubble);
}

function speakText(text) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; 
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

// ================== SMART LOGIC (AI MOCKUP) ==================
function refineSentence(wordsArray) {
  const rawText = wordsArray.join(' ').toLowerCase();

  // SCENARIO 1: GREETING
  if (rawText.includes('hello')) {
    return "Hello everyone! Welcome to our project.";
  }

  // SCENARIO 2: PITCH (WE + MADE + PROGRAM)
  if (
    (rawText.includes('we') && rawText.includes('made')) ||
    (rawText.includes('program'))
  ) {
    return "We developed this software to help mute people communicate efficiently.";
  }

  // SCENARIO 3: CLOSING (THANK YOU)
  if (rawText.includes('thank')) {
    return "Thank you very much for your attention!";
  }

  // FALLBACK
  const simple = wordsArray.join(' ');
  return simple.charAt(0).toUpperCase() + simple.slice(1) + ".";
}

// ================== INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM READY');

  els = {
    preview: document.getElementById('preview'),
    overlay: document.getElementById('overlay'),
    
    // Buttons
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    btnSend: document.getElementById('btnSend'), // Main Action Button
    
    // Transcript Actions
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

  // Event Listeners
  els.btnStart.addEventListener('click', startCamera);
  els.btnStop.addEventListener('click', stopCamera);

  // === MAIN SEND BUTTON ===
  if (els.btnSend) {
      els.btnSend.addEventListener('click', handleSend);
  }

  // Re-speak from transcript
  if (els.btnSpeak) {
    els.btnSpeak.addEventListener('click', () => {
       const text = els.transcriptList.lastElementChild?.textContent;
       if (text) speakText(text);
    });
  }

  // Undo / Clear Logic
  if (els.btnUndo) {
    els.btnUndo.addEventListener('click', () => {
      currentSentence.pop();
      renderOverlay(currentSentence.join(' '));
    });
  }

  if (els.btnClear) {
    els.btnClear.addEventListener('click', () => {
      currentSentence = [];
      renderOverlay('');
    });
  }

  // Visual Settings
  els.fontSize.addEventListener('input', () => {
    renderOverlay(currentSentence.join(' '));
  });
  
  els.toggleOverlay.addEventListener('change', () => {
    if (els.toggleOverlay.checked) renderOverlay(currentSentence.join(' '));
    else renderOverlay('');
  });

  // Start System
  await initMediaPipe();
});