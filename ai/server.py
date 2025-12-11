import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
import cv2
import base64
from collections import Counter

try:
    import mediapipe as mp
    from tensorflow.keras.models import load_model
    _HAVE_VISION = True
except ImportError:
    _HAVE_VISION = False

app = Flask(__name__)
CORS(app)

model = None
mp_holistic = None
sequence = []
recent_predictions = []
SMOOTHING_WINDOW = 3
current_text = "..."
threshold = 0.45  # Lower threshold for quicker predictions
actions = np.array(['hallo', 'willkommen', 'wie_gehts', 'danke', 'nichts'])

if _HAVE_VISION:
    model = load_model('action.h5')
    mp_holistic = mp.solutions.holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5)

def extract_keypoints(results):
    # Same function used during recording
    if results.pose_landmarks:
        pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten()
    else:
        pose = np.zeros(33*4)
        
    if results.left_hand_landmarks:
        lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten()
    else:
        lh = np.zeros(21*3)
    
    if results.right_hand_landmarks:
        rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten()
    else:
        rh = np.zeros(21*3)
    return np.concatenate([pose, lh, rh])

@app.route("/infer", methods=['POST'])
def infer():
    global sequence, current_text, recent_predictions
    if not _HAVE_VISION: return jsonify({"error": "No AI"}), 500

    data = request.get_json(silent=True) or {}
    b64 = data.get("image", "").split(",")[-1]
    if not b64: return jsonify({"gesture": ""}), 400

    try:
        buf = base64.b64decode(b64)
        arr = np.frombuffer(buf, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        # IMPORTANT: mirror the frame if the frontend shows a mirror view
        # img = cv2.flip(img, 1) # Uncomment if left/right looks swapped

        results = mp_holistic.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        keypoints = extract_keypoints(results)

        sequence.append(keypoints)
        sequence = sequence[-15:] # Keep only the last 15 frames

        if len(sequence) == 15:
            res = model.predict(np.expand_dims(sequence, axis=0), verbose=0)[0]
            best_class = np.argmax(res)
            confidence = res[best_class]

            if confidence > threshold:
                prediction = actions[best_class]
                recent_predictions.append(prediction)
                recent_predictions = recent_predictions[-SMOOTHING_WINDOW:]
                
                # Take the most common gesture across recent checks (debounce)
                most_common = Counter(recent_predictions).most_common(1)[0]
                if most_common[1] >= 2: # accept when seen 2 of last 3
                    current_text = most_common[0]
            else:
                recent_predictions.append("nichts") # If not confident, treat as nothing

        return jsonify({"gesture": current_text})

    except Exception as e:
        print(e)
        return jsonify({"gesture": ""}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
