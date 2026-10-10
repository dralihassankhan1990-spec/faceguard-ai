# FaceGuard AI — Intelligent Attendance Management System

A browser-based face-recognition attendance system built with React and face-api.js. No servers, no ID cards, no fingerprint scanners — just a webcam and a modern browser.

## Features

**Detector mode (surveillance)**
- Continuously scans the camera feed and logs every face it sees
- Captures a photo, records a timestamp, and speaks a voice confirmation
- Live log panel with full detection history

**Attendance mode**
- Register users by capturing their face with a name ("Capture & Save")
- Hands-free auto-marking: registered users walking past the camera are identified automatically and greeted by voice
- 60-second cooldown per person prevents duplicate marks
- Time-in / time-out tracking with today's attendance view
- One-click Excel export of attendance logs (`xlsx`)

**Privacy-first**
- All face data and logs stay in the browser's `localStorage` — nothing is ever uploaded anywhere

## Tech Stack

- React 19 + TypeScript + Vite
- face-api.js (SSD MobileNetV1 detection, 68-point landmarks, face recognition)
- lucide-react icons, Tailwind CSS (CDN)
- `xlsx` for Excel report export

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# 1. Download the face-api.js model weights (required, one time)
bash public/models/fetch-models.sh

# 2. Install dependencies
npm install

# 3. Run the dev server (http://localhost:3000)
npm run dev

# 4. Production build
npm run build
```

> **Note:** the `*-shard*` model weight files are not stored in git (see `public/models/DOWNLOAD_MODELS.md`). Run `fetch-models.sh` after cloning, or the app will show "Failed to load AI models".

Allow camera access when prompted. For best recognition: good lighting on the face, 1–2 meters from the camera.

See [guide.md](guide.md) for the full user guide.

## Author

Muhammad Bilal
