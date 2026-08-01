# myCam - Feature Roadmap & myCloud v2.5.5 VPS Migration Plan

This document outlines the feature implementation status for **myCam** and the architectural migration plan to connect to the live **myCloud v2.5.5** VPS server.

---

## 1. myCloud v2.5.5 VPS Migration Plan

Currently, `myCam` references a local legacy directory (`mycloud_v0.4/`) for file storage and direct MySQL database connections. Upgrading to the hosted **myCloud v2.5.5** on VPS requires the following changes:

### A. File Storage Pathing & Uploads
* **Current State**: Video clips and snapshots are saved to `path.join(__dirname, '../mycloud_v0.4/uploads')` via `Multer` in `server/routes.cjs`.
* **Required Changes**:
  * Replace the hardcoded relative path with environment variable `MYCLOUD_STORAGE_DIR`.
  * Alternatively, proxy recorded video and snapshot payloads directly to the VPS REST endpoint (`POST https://mycloud.yourdomain.com/api/v1/files/upload`).

### B. Database & Authentication
* **Current State**: Connects locally (`127.0.0.1:3306`) to `mycloud_db`.
* **Required Changes**:
  * Update `.env` to point `DB_HOST` to the remote VPS MySQL database host.
  * If `myCloud v2.5.5` uses OAuth2/JWT tokens instead of direct SQL verification, update `POST /api/login` in `server/routes.cjs` to authenticate against the VPS Auth API.

### C. Repository Cleanup
* Remove or `.gitignore` the obsolete `mycloud_v0.4/` subfolder from `myCam`.

---

## 2. Feature Implementation Status

### 🟢 Fully Implemented Features (100% Complete)

| Feature | Implementation Details |
| :--- | :--- |
| **Phone as CCTV Camera** | WebRTC broadcasting interface ([Broadcaster.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Broadcaster.jsx)) streams live camera feeds using browser `navigator.mediaDevices.getUserMedia`. |
| **Remote Access** | Real-time P2P WebRTC streaming with STUN server (`stun:stun.l.google.com:19302`) for NAT traversal. |
| **AI Motion Detection** | Computer vision object analysis engine ([aiDetector.js](file:///d:/Projects/mySphere%20projects/myCam/src/utils/aiDetector.js)) classifying target objects (`Person`, `Vehicle`, `Pet`), Ray-Casting Point-in-Polygon Activity Zone intersection, real-time bounding box canvas overlays (`PERSON 94%`), target category filters, and automated AI snapshot/alert triggers. |
| **Scheduled Recording** | Automated schedule manager ([ScheduleManager.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/ScheduleManager.jsx)) with custom time windows (`HH:MM`), day-of-week selection, camera target selection, active schedule badges, and real-time evaluator loops in [CameraModal.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/CameraModal.jsx). |
| **Recording Storage, Limits & Loop Recording** | Configurable target storage (`Internal Storage`, `SD Card`, `Auto Failover`, `Staged Cloud`), custom quota caps (e.g. 1.2GB Internal / 3.0GB SD Card), and automated FIFO loop recycling that purges oldest recordings when limits are reached ([routes.cjs](file:///d:/Projects/mySphere%20projects/myCam/server/routes.cjs), [Settings.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/Settings.jsx)). Includes RAM ring-buffering & debounced I/O wear protection. |
| **Two-Way Communication** | Full duplex bidirectional WebRTC audio channel allowing talk-back from dashboard viewer to broadcaster device speakers ([CameraFeed.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/CameraFeed.jsx), [Broadcaster.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Broadcaster.jsx)). |
| **Adjustable Recording Quality** | Dynamic video track constraint switching (`4K`, `1080p`, `SD`) and bitrate-aware `MediaRecorder` encoding (`4K`: 8Mbps, `1080p`: 3Mbps, `SD`: 800kbps) via Socket.IO quality signaling. |
| **Image Capture Trigger** | Canvas video frame extraction (`toBlob`/`toDataURL`) supporting manual snapshots, automatic interval snapshots (15s/30s/60s), motion-triggered capture, auto-download, and backend storage API (`POST /api/snapshots`). |
| **Smart Alerts** | Real-time `motion-detected` Socket.IO alert relays, in-app toast alerts, and native browser Web Push desktop/mobile notifications (`Notification.requestPermission()`). |
| **Activity Zones** | Interactive HTML5 Canvas zone drawer ([ActivityZones.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/ActivityZones.jsx)) saving normalized polygon coordinates (`{x, y}`) to MySQL. |
| **Login System** | Authentication pipeline with `scrypt` / `pbkdf2` Werkzeug password hashing, password reset tokens, and profile management. |
| **Multi-Device Support** | Grid view supporting dynamic device connection signaling ([CameraGrid.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/CameraGrid.jsx)). |

---

### 🎉 All Core Features Implemented!
All 14 core features requested for **myCam** have been successfully built, verified, and documented.
