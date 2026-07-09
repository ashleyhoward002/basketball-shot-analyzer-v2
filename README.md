# Basketball Shot Analyzer v2

A computer-vision app that uses MediaPipe pose and hand tracking to analyze basketball shooting mechanics in real time from a single webcam.

## Features

- Real-time pose tracking (33-point body pose via MediaPipe Pose) and hand landmark detection (21 points) to analyze shooting form
- Shot classification (layups, three-pointers, free throws, makes vs. misses)
- Session tracking: start/stop/save shooting sessions and compare them over time
- Performance dashboard with shooting percentages (FG%, 3P%, FT%) and trend charts (Chart.js)
- Form scoring feedback based on release point, follow-through, and body positioning

## How It Works

MediaPipe Pose and Hand Landmarker run in the browser to track body and hand keypoints frame by frame. A basketball detection model tracks the ball's trajectory alongside the pose data to classify shot type and outcome. Session data is stored locally (IndexedDB), with optional Firebase sync.

## Tech Stack

MediaPipe, TensorFlow Lite, OpenCV, JavaScript (Canvas API), Node.js (session management), Chart.js

## Getting Started

1. Allow camera/webcam access
2. Stand 6-8 feet from the camera
3. Shoot naturally — the app detects and classifies shots as you play
4. Review form feedback and save the session to track progress over time

## Notes

This is a personal project built to explore applying pose-estimation models to sports analytics. Performance (FPS, latency, detection accuracy) varies by hardware and camera setup, and I haven't run a formal, independent benchmark, so specific accuracy figures are left out rather than guessed at. Happy to walk through the CV pipeline and design tradeoffs in more detail.
