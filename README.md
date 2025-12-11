**FH JOANNEUM – Hackathon Project**  

# 👋🤗😊 Unlimited Communication  

<sub>👋🤗😊 — Symbolic representation of the ASL spirit: “Welcome, we’re glad to see you.”</sub>

Have you ever dreamed of a world where communication between hearing and non-hearing people feels natural, fast and inclusive?  
**Unlimited Communication** is a simple web application that translates **sign language gestures into text**, helping people with hearing or speech impairments easily express their thoughts in any environment and be understood anywhere.  

Our mission is to make **gesture-based communication accessible, clear, and effortless** - whether at home, in school or in public service spaces.  

---


## 💡 Concept  

The application uses your webcam to recognize gestures — for example, *“Hello”*, *“Yes”*, *“No”*, or even full sentences - and displays them as readable text on the screen.  
It also includes a **Gesture Book**, where users can explore and learn sign language gestures and their meanings.  
This is our first step toward real-time subtitle generation and truly barrier-free communication for everyone.  

<p align="center">
  <img src="./assets/example.jpg" 
       alt="Basic sign language gestures illustration" width="500">
</p>

---

## 👥 Team

<p align="center">
  <b>Alena Vodopianova</b><br>
  Development & Integration<br><br>
  <b>Oleh Haievyi</b><br>
  Model Research & AI Prototyping<br><br>
  <b>Helma Arjmand</b><br>
  Documentation, Design & Frontend Support
</p>


---
## ⚙️ Key Features

### Must-haves

| Feature | Description |
| --- | --- |
| **Camera Input** | Start the webcam and detect hand gestures in real time. |
| **Gesture to Text** | Recognized gesture appears instantly as readable text. |
| **Gesture Book** | Visual dictionary showing how to perform each sign. |
| **Copy Function** | Copy recognized text to clipboard for easy sharing. |

### Nice-to-haves

| Feature | Description |
| --- | --- |
| **Multilingual Translation** | Translate recognized text into multiple languages (EN/DE/RU …) with one click. |
| **Text-to-Speech & Audio Output** | Natural voice playback with options for voice, speed, punctuation handling |
| **Training Mode** | Interactive practice: show a target gesture, give feedback (correct/try again), track progress. |

---

## 🧠 Tech Stack & Architecture

**MVP architecture (local, no cloud):**

 * Frontend (frontend/): HTML/CSS/JavaScript. Captures webcam, shows UI & subtitles, sends frames to backend.

* AI Backend (ai/server.py): Flask + MediaPipe Hands + OpenCV (Python 3.11).
Receives a single frame (POST /infer with base64 image), classifies gesture, returns JSON.

```markdown

flowchart TD
    A["Webcam"] --> B["Frontend (Browser)"]
    B -->|POST /infer| C["Backend (Flask, Python)"]
    C --> D["MediaPipe + OpenCV"]
    D --> E["Recognized Gesture"]
    E --> B
 ```   



## Demo
![Demo GIF](./assets/demo.gif)

---
## 🧰 Installation & Setup

> Requires **Python 3.11.x** awebcam, any modern browser.We recommend a virtual environment to isolate dependencies.

### 1. Clone the Repository

### 2. Install dependencies

   ```bash
   python -m pip install -U pip
  python -m pip install -r ai/requirements.txt
  pip install opencv-python numpy mediapipe tensorflow flask flask-cors scikit-learn
  ```



### Shared Knowledge
All findings (setup notes, model choices, file formats, code snippets) are **shared with the whole team** to keep everyone aligned across iterations.

---

## 🚀 Getting Started

1. Open the website *(GitLab Pages in development)*.  
2. Click **Start Camera** to enable video capture.  
3. Perform one of the basic gestures (*Hello*, *Yes*, *No*).  
4. Watch the text appear on the screen.  
5. Copy it using the **Copy** button.  
6. Explore the **Gesture Book** section to learn how each gesture works.

You can stop the camera anytime and start a new recognition session.

---