# AI Module – Gesture2Text

Machine-learning component for Unlimited Communication: captures hand/body landmarks with MediaPipe, feeds them into an LSTM, and serves gesture → text over HTTP.

## Quick Start

1) Install deps (Python 3.11 recommended):
```bash
pip install -r ai/requirements.txt
```
2) Run the inference server:
```bash
python ai/server.py
```
3) Open the frontend (served from `frontend/`) so it can POST frames to `http://127.0.0.1:5000/infer`.

## API

`POST /infer`  
Body: `{"image": "<data:image/jpeg;base64,...>"}` (a single JPEG frame).  
Response: `{"gesture": "<string>"}` where `gesture` is the latest stabilized prediction.

## Model / Logic Snapshot (current)

- Classes: `['hallo', 'willkommen', 'wie_gehts', 'danke', 'nichts']`
- Input window: last 15 frames, each frame is 258 features (pose 33×4 + left hand 21×3 + right hand 21×3).
- Threshold: `0.45` confidence.
- Smoothing: window of 3 predictions; accept when the same class appears at least 2 times.
- Fallback: if below threshold, push `"nichts"` to the smoothing window.
- Optional mirror: uncomment `img = cv2.flip(img, 1)` in `server.py` if your camera feed is mirrored in the UI.

## Data Collection

`ai/1_record.py`  
- Captures 30 sequences per class, 15 frames per sequence.  
- Saves keypoints to `MP_Data/<action>/<sequence>/<frame>.npy`.

## Training Options

`ai/2_train.py` (baseline)  
- Uses 15-frame sequences (258 features).  
- 3× LSTM stack + dense head; trains for 150 epochs; saves `action.h5`.

`ai/3_train_smart.py` (augmented)  
- Uses 30-frame sequences (126 features: only hands) plus noise augmentation.  
- Different input shape; only use this if you also adjust `server.py` to match 30×126.

## Files

- `server.py` – Flask inference server with MediaPipe Holistic, smoothing, and thresholding.
- `1_record.py` – Capture dataset from webcam.
- `2_train.py` – Train baseline 15×258 model.
- `3_train_smart.py` – Train augmented 30×126 model (requires matching server changes).
- `requirements.txt` – Python dependencies.

## Tips

- Ensure `action.h5` is present in `ai/` before starting the server.
- Give the model ~15 frames (~1s) to warm up before first prediction.
- If left/right is swapped, flip the frame in `server.py`.
- Frontend currently normalizes `wie_gehts` to `wie geht's?` for display.
