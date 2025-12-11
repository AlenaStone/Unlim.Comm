import numpy as np
import os
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

DATA_PATH = os.path.join('MP_Data') 
actions = np.array(['hallo', 'willkommen', 'wie_gehts', 'danke', 'nichts'])
no_sequences = 30
sequence_length = 15 # Was 30, now 15

label_map = {label:num for num, label in enumerate(actions)}

sequences, labels = [], []

print("Loading data...")
for action in actions:
    for sequence in range(no_sequences):
        window = []
        try:
            for frame_num in range(sequence_length):
                res = np.load(os.path.join(DATA_PATH, action, str(sequence), "{}.npy".format(frame_num)))
                window.append(res)
            sequences.append(window)
            labels.append(label_map[action])
        except:
            pass

X = np.array(sequences)
y = to_categorical(labels).astype(int)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.05)

model = Sequential()
# IMPORTANT: input_shape=(15, 258). 258 = body + both hands.
model.add(LSTM(64, return_sequences=True, activation='relu', input_shape=(15, 258)))
model.add(LSTM(128, return_sequences=True, activation='relu'))
model.add(LSTM(64, return_sequences=False, activation='relu'))
model.add(Dense(64, activation='relu'))
model.add(Dense(32, activation='relu'))
model.add(Dense(actions.shape[0], activation='softmax'))

model.compile(optimizer='Adam', loss='categorical_crossentropy', metrics=['categorical_accuracy'])
model.fit(X_train, y_train, epochs=150)
model.save('action.h5')
print("Model trained on POSE and HANDS!")
