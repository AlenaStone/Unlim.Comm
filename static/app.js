// ====== DOM ======
// Centralized handles to UI elements (query once, reuse everywhere).
const els = {
  preview: document.getElementById('preview'),          // <video> element with live stream
  overlay: document.getElementById('overlay'),          // container where the subtitle bubble is injected
  btnStart: document.getElementById('btnStart'),        // "Start Camera" button
  btnStop: document.getElementById('btnStop'),          // "Stop" button
  fontSize: document.getElementById('fontSize'),        // range input for subtitle font size
  toggleOverlay: document.getElementById('toggleOverlay'), // checkbox to show/hide overlay
  punctuationChoice: document.getElementById('punctuationChoice'), // select for punctuation
  autoPause: document.getElementById('autoPause'),      // checkbox to add pause marker
  singleLine: document.getElementById('singleLine'),    // checkbox to force single-line overlay
  transcriptList: document.getElementById('transcriptList'), // scrollable list of recognized sentences
  btnExportTxt: document.getElementById('btnExportTxt'), // export transcript as .txt
  btnUndo: document.getElementById('btnUndo'),          // remove last sentence
  btnClear: document.getElementById('btnClear'),        // clear transcript
  themeToggle: document.getElementById('themeToggle')   // light/dark switcher
};


// ====== STATE ======
// Global runtime state (not persisted).
let mediaStream = null;        // active MediaStream from getUserMedia (null when stopped)
let overlayLastText = '';      // last text rendered into the overlay (for re-render after undo/clear)
const transcript = [];         // append-only history of items { ts:number, text:string, clean:string, kind:'token' }

// Inference state (for /infer and de-duplication)
let lastReceived = '';         // last gesture text received from backend
let inferTimer = null;         // interval id for periodic /infer calls


// ====== UTILS ======
// Download helper for exporting text files on the client.
function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// Milliseconds timestamp (used for ordering and future SRT building).
function nowTs() { return Date.now(); }


// ====== VIDEO ======
// Request webcam and start preview playback.
// On success: lock Start button, enable Stop; on failure: show alert.
async function startCamera() {
  if (mediaStream) return; // already running
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }, // front camera on mobile, laptop webcam on desktop
      audio: false                   // we don't capture audio (recognition is gesture-based)
    });
    els.preview.srcObject = mediaStream;
    await els.preview.play();
    els.btnStart.disabled = true;
    els.btnStop.disabled = false;

    // Start periodic inference when the camera is running
    if (!inferTimer) {
      inferTimer = setInterval(inferOnce, 350); // ~1.4 FPS server calls; tune as needed
    }
  } catch (e) {
    console.error('Camera error:', e);
    alert('Failed to start the camera: ' + e.message);
  }
}

function stopCamera() {
  if (!mediaStream) return;
  mediaStream.getTracks().forEach(t => t.stop());
  mediaStream = null;
  els.preview.srcObject = null;
  els.btnStart.disabled = false;
  els.btnStop.disabled = true;

  // Stop periodic inference
  if (inferTimer) {
    clearInterval(inferTimer);
    inferTimer = null;
  }
}


// ====== OVERLAY (subtitle over video) ======
// Re-render the subtitle bubble according to current controls.
function renderOverlay(text) {
  overlayLastText = text || '';
  els.overlay.innerHTML = '';
  if (!els.toggleOverlay.checked || !overlayLastText) return;
  const bubble = document.createElement('div');
  bubble.className = 'subtitle';
  bubble.textContent = overlayLastText;
  // apply live settings from UI controls
  bubble.style.fontSize = (Number(els.fontSize.value) || 28) + 'px';
  bubble.style.background = 'rgba(0,0,0,0.45)';
  // one-line option
  bubble.style.whiteSpace = els.singleLine?.checked ? 'nowrap' : 'normal';
  els.overlay.appendChild(bubble);
}


// ====== TRANSCRIPT (text log of phrases) ======
// Add a sentence into the transcript list and mirror it in the UI.
function addSentence(text) {
  const token = formatToken(text);
  if (!token) return;
  const clean = cleanTokenDisplay(token);
  transcript.push({ ts: nowTs(), text: token, clean, kind: 'token' });
  renderTranscriptList();
  renderOverlay(lastTokenText());
}

// Remove the most recent transcript entry and update both the list and overlay.
function undoLast() {
  if (!transcript.length) return; // nothing to undo
  transcript.pop(); // remove last token
  renderTranscriptList();
  renderOverlay(lastTokenText());
}

// Clear all transcript data and overlay text.
function clearTranscript() {
  transcript.length = 0;
  els.transcriptList.innerHTML = '';
  renderOverlay('');
}

// Used for exporting as .txt file or for quick copy/paste.
function toTxt() {
  return currentLineText();
}

// Join all tokens into the current line (used for overlay and transcript)
function currentLineText() {
  return transcript
    .filter(x => x.kind === 'token')
    .map(x => x.text)
    .join('');
}

// Format the incoming token with optional punctuation and pause marker
function formatToken(text) {
  const normalized = normalizeGesture(text);
  if (!normalized) return '';
  const selectedPunct = els.punctuationChoice?.value || '';
  const hasEndingPunct = /[.!?]$/.test(normalized);
  const punct = hasEndingPunct ? '' : selectedPunct;
  const pause = els.autoPause?.checked ? ' | ' : ' ';
  return normalized + punct + pause;
}

function cleanTokenDisplay(token) {
  return token.replace(/\s*\|\s*$/, '').trim();
}

function lastTokenText() {
  const last = [...transcript].reverse().find(x => x.kind === 'token');
  return last ? (last.clean || last.text).trim() : '';
}

function normalizeGesture(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const map = {
    wie_gehts: "wie geht's?",
    hallo: 'hallo',
    danke: 'danke',
    willkommen: 'willkommen'
  };
  if (map[text]) return map[text];
  return text.replace(/_/g, ' ');
}

// Re-render transcript list as a single growing line
function renderTranscriptList() {
  const line = currentLineText();
  els.transcriptList.innerHTML = '';
  if (!line) return;
  const p = document.createElement('p');
  p.textContent = line;
  els.transcriptList.appendChild(p);
  els.transcriptList.scrollTop = els.transcriptList.scrollHeight;
}


// ====== NAV ACTIVE (highlight active navigation link) ======
// Automatically highlights the nav link that matches the section currently in view.
function initActiveNav() {
  const sections = document.querySelectorAll('main section[id]');
  const links = [...document.querySelectorAll('header nav a[href^="#"]')];
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      links.forEach(a => a.removeAttribute('aria-current'));
      const link = map.get(id);
      if (link) link.setAttribute('aria-current', 'page');
    });
  }, { 
    rootMargin: '-40% 0px -55% 0px',
    threshold: 0.01
  });

  sections.forEach(s => obs.observe(s));
}


// ====== DEMO (quick test without backend) ======
// Adds a few example sentences so we can see overlay and transcript working.
function startDemoOnce() {
  const demo = [
    'Testing subtitles over video.',
    'Camera is ready. Recognition will be connected later.',
    'Unlimited Communication is running!'
  ];
  let i = 0;
  const pushNext = () => {
    if (i >= demo.length) return;
    addSentence(demo[i++]);
    setTimeout(pushNext, 1500);
  };
  pushNext();
}


// ====== BACKEND BRIDGES ======
// Legacy polling for /gesture (kept as-is; can be disabled if using /infer)
async function pollGestures() {
  try {
    const r = await fetch('http://127.0.0.1:5000/gesture');
    const data = await r.json();
    const text = String(data.gesture || '').trim();
    if (text && text !== lastReceived) { // avoid duplicates
      lastReceived = text;
      addSentence(text);
    }
  } catch (e) {
    console.error('API error:', e);
  }
}

// Convert current <video> frame to a JPEG data URL for /infer
function frameToDataURL() {
  const v = els.preview;
  if (!v || !v.videoWidth) return null;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(v, 0, 0);
  return c.toDataURL('image/jpeg', 0.7); // compress a bit for faster uploads
}

// Send a frame to backend /infer and append result (if new)
async function inferOnce() {
  const image = frameToDataURL();
  if (!image) return;
  try {
    const r = await fetch('http://127.0.0.1:5000/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image })
    });
    const { gesture } = await r.json();
    const text = String(gesture || '').trim();
    if (text && text !== lastReceived) {
      lastReceived = text;
      addSentence(text);
    }
  } catch (e) {
    console.warn('infer error:', e.message || e);
  }
}


// ====== WIRE UI ======
// Hook up UI controls after DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
  // CAMERA BUTTONS
  els.btnStart?.addEventListener('click', startCamera);
  els.btnStop?.addEventListener('click', stopCamera);

  // OVERLAY CONTROLS
  els.fontSize?.addEventListener('input', () => renderOverlay(overlayLastText));
  els.toggleOverlay?.addEventListener('change', () => renderOverlay(overlayLastText));
  els.punctuationChoice?.addEventListener('change', () => {
    renderTranscriptList();
    renderOverlay(lastTokenText());
  });
  els.autoPause?.addEventListener('change', () => {
    renderTranscriptList();
    renderOverlay(lastTokenText());
  });
  els.singleLine?.addEventListener('change', () => renderOverlay(lastTokenText()));

  // TRANSCRIPT ACTIONS
  const btnCopy = document.getElementById('btnCopy');
  btnCopy?.addEventListener('click', async () => {
    const text = toTxt();
    try {
      await navigator.clipboard.writeText(text);
      btnCopy.textContent = 'Copied!';
      setTimeout(() => (btnCopy.textContent = 'Copy'), 1500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      alert('Could not copy text.');
    }
  });

  els.btnExportTxt?.addEventListener('click', () => download('subtitles.txt', toTxt()));
  els.btnUndo?.addEventListener('click', undoLast);
  els.btnClear?.addEventListener('click', clearTranscript);

  // THEME TOGGLE
  const applyTheme = (mode) => {
    document.body.setAttribute('data-theme', mode);
    localStorage.setItem('uc-theme', mode);
  };
  const savedTheme = localStorage.getItem('uc-theme') || 'dark';
  applyTheme(savedTheme);
  els.themeToggle?.addEventListener('click', () => {
    const next = (document.body.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    applyTheme(next);
  });

  // NAVIGATION HIGHLIGHT
  initActiveNav();

  // DEMO MODE (keep as-is; disabled by default)
  // startDemoOnce();

  // Backend polling (kept as-is, but disabled to avoid duplicate lines when using /infer)
  // setInterval(pollGestures, 1500);
});
