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

// Mapping: Gesture ID -> Display Word
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

      // Delay to prevent flickering (800ms)
      if (
        gesture &&
        gesture !== lastGesture &&
        now - lastGestureTime > 800
      ) {
        lastGesture = gesture;
        lastGestureTime = now;
        
        // ✨ AUTO-TRIGGER: Add word AND update screen immediately
        addWordToBuffer(gesture);
      }
    }

    requestAnimationFrame(loop);
  }

  loop();
}

// ================== GESTURE RECOGNITION ==================
function detectGesture(hand) {
  // Y coordinate: Lower value = Higher on screen
  // 4=Thumb, 8=Index, 12=Middle, 16=Ring, 20=Pinky
  
  const thumbUp  = hand[4].y < hand[3].y;
  const indexUp  = hand[8].y < hand[6].y;
  const middleUp = hand[12].y < hand[10].y;
  const ringUp   = hand[16].y < hand[14].y;
  const pinkyUp  = hand[20].y < hand[18].y;

  // 1. HELLO (Open Hand)
  if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) {
    return 'hello';
  }

  // 2. THIS (Index Only)
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

  // 5. PROGRAM (Victory/Peace Sign)
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return 'program';
  }

  // 6. THANK YOU (Shaka/Phone)
  if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) {
    return 'thank_you';
  }

  return '';
}

// ================== DATA HANDLING (UPDATED) ==================
function addWordToBuffer(gestureKey) {
  const word = DISPLAY_WORDS[gestureKey] || gestureKey;
  currentSentence.push(word);

  // 1. Get the raw text (e.g., "we made")
  const rawText = currentSentence.join(' ');
  
  // 2. Check if it matches a SMART phrase
  const smartText = refineSentence(currentSentence);

  // 3. Update Overlay IMMEDIATELY (Autofill)
  renderOverlay(smartText);

  // 4. If the smart text is a full sentence (ends with . or !), 
  // automatically log it to transcript so we can start fresh?
  // OPTIONAL: Uncomment below if you want auto-clear after sentence
  /* if (smartText.length > 20 && (smartText.includes('!') || smartText.includes('.'))) {
     transcript.push(smartText);
     renderTranscript();
     // Keep buffer until manual clear? Or clear? 
     // Let's keep it manual clear for safety during demo.
  } 
  */
}

function renderTranscript() {
  els.transcriptList.innerHTML = '';
  
  transcript.forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
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
  
  // === CSS FIX FOR LONG TEXT ===
  // This ensures the text wraps and doesn't show "..."
  bubble.style.whiteSpace = "pre-wrap"; 
  bubble.style.wordWrap = "break-word";
  bubble.style.width = "90%";
  bubble.style.maxWidth = "600px";
  bubble.style.lineHeight = "1.3";
  bubble.style.textAlign = "center";
  bubble.style.padding = "10px";
  bubble.style.background = "rgba(0, 0, 0, 0.6)"; // Dark background for readability
  bubble.style.borderRadius = "12px";
  bubble.style.margin = "0 auto";

  // Dynamic font size: smaller if text is long
  let size = Number(els.fontSize.value) || 28;
  if (text.length > 30) size = Math.max(16, size * 0.7); // Shrink for long sentences
  
  bubble.style.fontSize = size + 'px';
  
  els.overlay.appendChild(bubble);
}

// ================== SPEECH SYNTHESIS ==================
function speakText(text) {
  if (!text || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; 
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

// ================== SMART SENTENCE BUILDER ==================
function refineSentence(wordsArray) {
  const rawText = wordsArray.join(' ').toLowerCase();

  // === SCENARIO 1: HELLO ===
  // Trigger: Just "hello" is enough to expand
  if (rawText.includes('hello')) {
    return "Hello everyone! Welcome to our project.";
  }

  // === SCENARIO 2: THE PITCH ===
  // Trigger: "we made" OR "we made program" OR "this program"
  if (
    (rawText.includes('we') && rawText.includes('made')) ||
    (rawText.includes('program') && rawText.includes('this'))
  ) {
    return "We developed this software to help mute people communicate efficiently.";
  }

  // === SCENARIO 3: THANK YOU ===
  // Trigger: "thank_you"
  if (rawText.includes('thank')) {
    return "Thank you very much for your attention!";
  }

  // === FALLBACK: RAW WORDS ===
  // If no smart match yet, just show what we have (e.g. "We made")
  // Capitalize first letter
  const simple = wordsArray.join(' ');
  return simple.charAt(0).toUpperCase() + simple.slice(1);
}

// ================== UI INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM READY');

  // 1. Get Elements
  els = {
    preview: document.getElementById('preview'),
    overlay: document.getElementById('overlay'),
    
    // Buttons
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
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

  // 3. Speak Button (Optional now, since text shows automatically)
  if (els.btnSpeak) {
    els.btnSpeak.addEventListener('click', () => {
      // Speak whatever is currently on screen
      const textToSpeak = els.overlay.textContent; // Get text directly from overlay
      
      if (textToSpeak) {
        speakText(textToSpeak);
        // Log to transcript when spoken
        transcript.push(textToSpeak);
        renderTranscript();
        
        // Optional: clear after speaking?
        // currentSentence = []; 
        // renderOverlay('');
      }
    });
  }

  // 4. Edit Buttons
  if (els.btnUndo) {
    els.btnUndo.addEventListener('click', () => {
      currentSentence.pop();
      // Recalculate overlay immediately
      const newText = refineSentence(currentSentence);
      renderOverlay(newText);
    });
  }

  if (els.btnClear) {
    els.btnClear.addEventListener('click', () => {
      currentSentence = [];
      renderOverlay('');
    });
  }

  if (els.btnCopy) {
    els.btnCopy.addEventListener('click', () => {
      const textToCopy = Array.from(els.transcriptList.querySelectorAll('p'))
          .map(p => p.textContent)
          .join('\n');
      
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => alert('Copied!'))
          .catch(err => console.error(err));
      }
    });
  }

  // 5. Visual Settings
  els.fontSize.addEventListener('input', () => {
    // Refresh overlay with new size
    const smartText = refineSentence(currentSentence);
    renderOverlay(smartText);
  });

  els.toggleOverlay.addEventListener('change', () => {
    const smartText = refineSentence(currentSentence);
    if (els.toggleOverlay.checked) {
      renderOverlay(smartText);
    } else {
      renderOverlay('');
    }
  });

  // 6. Theme
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

  // 7. Init AI
  await initMediaPipe();
});