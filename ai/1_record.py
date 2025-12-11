import cv2
import numpy as np
import os
import mediapipe as mp
import sys

# --- Important changes ---
DATA_PATH = os.path.join('MP_Data') 
actions = np.array(['hallo', 'willkommen', 'wie_gehts', 'danke', 'nichts'])
no_sequences = 30
sequence_length = 15 # Was 30, now 15 (faster response)

# --- MEDIAPIPE ---
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

def mediapipe_detection(image, model):
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    results = model.process(image)
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    return image, results

def extract_keypoints(results):
    # 1. POSE (BODY + FACE) - 33 points * 4 coordinates = 132
    if results.pose_landmarks:
        pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten()
    else:
        pose = np.zeros(33*4)

    # 2. LEFT HAND - 21 * 3 = 63
    if results.left_hand_landmarks:
        lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten()
    else:
        lh = np.zeros(21*3)
    
    # 3. RIGHT HAND - 21 * 3 = 63
    if results.right_hand_landmarks:
        rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten()
    else:
        rh = np.zeros(21*3)
        
    # TOTAL: 132 + 63 + 63 = 258 values
    return np.concatenate([pose, lh, rh])

# --- MAIN ---
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    sys.exit("Camera not found")

with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    for action in actions:
        # Preparation pause
        for i in range(50):
            ret, frame = cap.read()
            cv2.putText(frame, f'PREPARE: {action}', (50,200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255, 0), 2, cv2.LINE_AA)
            cv2.imshow('Recorder', frame)
            cv2.waitKey(30)

        # Recording
        for sequence in range(no_sequences):
            try: os.makedirs(os.path.join(DATA_PATH, action, str(sequence)))
            except: pass

            for frame_num in range(sequence_length):
                ret, frame = cap.read()
                image, results = mediapipe_detection(frame, holistic)
                
                mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS) # Draw body skeleton
                mp_drawing.draw_landmarks(image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
                mp_drawing.draw_landmarks(image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
                
                cv2.putText(image, f'Rec: {action} [{sequence}]', (15,30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2, cv2.LINE_AA)
                cv2.imshow('Recorder', image)
                
                keypoints = extract_keypoints(results)
                npy_path = os.path.join(DATA_PATH, action, str(sequence), str(frame_num))
                np.save(npy_path, keypoints)

                if cv2.waitKey(1) & 0xFF == ord('q'): break
    cap.release()
    cv2.destroyAllWindows()
