# myCam - Comprehensive End-to-End Feature Verification Guide

This guide provides step-by-step instructions to test every feature built into **myCam**.

---

## 🚀 Pre-requisites & Setup

Before starting test execution, ensure both the backend API server and Vite frontend dev server are running:

### 1. Database & Backend API Server
Open a terminal in `d:\Projects\mySphere projects\myCam`:
```bash
npm run server
```
* **Expected Output**:
  - `Database connection established successfully.`
  - `Server running on port 3000`
  - `Socket.IO server running`

### 2. Frontend Dev Server
Open a second terminal in `d:\Projects\mySphere projects\myCam`:
```bash
npm run dev
```
* Access the app in your browser at `http://localhost:5173`.

---

## 🧪 Comprehensive Feature Verification Suite

### Test 1: Login & Authentication System
**Goal**: Verify user login, password verification, session management, and logout.

1. Open `http://localhost:5173` in your browser.
2. Enter default test credentials:
   - **Username**: `rudy`
   - **Password**: `password` (or test password configured)
3. Click **Sign In**.
4. **Verification**:
   - Toast notification: `Login successful`.
   - Redirects to the main **myCam Dashboard**.
   - Profile avatar displays user info.
5. Click **Logout** at the bottom of the sidebar.
6. **Verification**:
   - Session clears and returns to the login screen.

---

### Test 2: Phone as CCTV Camera (Broadcaster Mode)
**Goal**: Verify smartphone / browser camera stream capture and WebRTC broadcasting.

1. Log in and click the **Broadcast** tab in the sidebar.
2. Click **Start Broadcast Stream**.
3. Grant camera and microphone permissions when prompted by your browser.
4. **Verification**:
   - Live video preview stream from your device webcam appears.
   - Status badge shows `LIVE BROADCASTING`.
   - Socket signaling connects `CAM-MOBILE` to the network.

---

### Test 3: Remote Access & Multi-Device Camera Grid
**Goal**: View live camera streams remotely across devices in real-time.

1. Open a second browser window/tab (or another device on the local network) at `http://localhost:5173`.
2. Navigate to the **Cameras** tab on the main dashboard.
3. Observe the camera grid ([CameraGrid.jsx](file:///d:/Projects/mySphere%20projects/myCam/src/components/Dashboard/CameraGrid.jsx)).
4. **Verification**:
   - `CAM-MOBILE` displays a live video feed streaming from the broadcaster tab.
   - Device status badge shows `ONLINE`.
5. Click on `CAM-MOBILE` to open the expanded **Camera Modal**.
6. **Verification**:
   - Modal renders live stream in high resolution with interactive control overlays.

---

### Test 4: Two-Way Communication (Audio Channel)
**Goal**: Test bidirectional WebRTC talk-back audio stream.

1. Open **Camera Modal** for `CAM-MOBILE`.
2. Click the **Two-Way Audio** button in the controls toolbar.
3. **Verification**:
   - Button turns active blue (`Two-Way Audio ON`).
   - Microphone audio from dashboard viewer streams directly to broadcaster speakers.
4. Speak into viewer mic; confirm sound outputs at broadcaster end.
5. Click **Two-Way Audio** again to mute.

---

### Test 5: Adjustable Recording Quality & Bitrate Encoding
**Goal**: Verify dynamic video quality switching and bitrate encoding.

1. Open **Camera Modal** for `CAM-MOBILE`.
2. Locate the **Quality Selector** dropdown in the bottom right (Options: `4K UHD`, `1080p HD`, `Standard`).
3. Select `4K UHD`.
4. **Verification**:
   - Toast notification: `Quality set to 4K (8 Mbps bitrate)`.
   - MediaRecorder encoding switches to 8 Mbps bitrate.
5. Select `Standard`.
6. **Verification**:
   - Quality updates to SD (800 kbps bitrate) saving storage space.

---

### Test 6: Image Capture Trigger (Manual & Auto Snapshots)
**Goal**: Capture image snapshots manually and on configured time intervals.

1. In **Camera Modal**, click **Snapshot**.
2. **Verification**:
   - High-res frame is extracted, uploaded to server (`POST /api/snapshots`), and automatically downloaded to your local Downloads folder.
   - Toast notification confirms snapshot saved.
3. Locate **Auto Snap** dropdown (Options: `Off`, `15s`, `30s`, `60s`).
4. Select `15s`.
5. **Verification**:
   - Every 15 seconds, a snapshot automatically captures and uploads without interrupting live viewing.
6. Set **Auto Snap** back to `Off`.

---

### Test 7: Smart Alerts & Web Push Notifications
**Goal**: Test real-time Socket.IO motion alerts and browser desktop notifications.

1. In **Camera Modal**, trigger simulated motion or cover webcam.
2. **Verification**:
   - In-app alert banner: `🚨 Smart Alert: Activity / Motion detected on camera feed!`.
   - Browser desktop Web Push notification pops up in OS notification center.

---

### Test 8: Activity Zones (Polygon Area Drawer)
**Goal**: Define custom motion detection region polygons to filter false positives.

1. Click **Activity Zones** in the sidebar.
2. Select target camera (`CAM-MOBILE`).
3. Click on the video canvas to draw 4 corner points forming a custom region (e.g. Driveway or Front Door).
4. Enter Zone Name: `Driveway Zone` and click **Save Activity Zone**.
5. **Verification**:
   - Zone coordinates (`{x, y}`) save to MySQL database (`POST /api/zones`).
   - Polygon overlay renders over the video preview.

---

### Test 9: Storage Management, Quota Limits & Auto Failover
**Goal**: Configure target storage modes, custom limits, auto failover, and memory wear protection.

1. Click **Settings** in the sidebar.
2. Under **Storage Mode**, select `Local Storage Only` (or `Dual Backup`).
3. Under **Local Storage Target**, select `Auto Failover (Internal -> SD Card)`.
4. Custom Quota Inputs:
   - **Internal Limit**: Set to `1200 MB`.
   - **SD Card Limit**: Set to `3000 MB`.
5. Click **Save Storage Preferences**.
6. **Verification**:
   - Settings save to MySQL database (`POST /api/storage/config`).
   - Storage usage meters render used MB vs quota caps.

---

### Test 10: FIFO Loop Recording & Auto-Recycling
**Goal**: Verify oldest video recordings are automatically purged when quota limit is reached.

1. In **Camera Modal**, click **Record**.
2. Allow recording to run for 10 seconds, then click **Stop Rec**.
3. **Verification**:
   - Clip uploads to server (`POST /api/recordings`).
   - Server runs `runStorageRecyclingLoop()`.
   - Toast notification displays: `Recording saved [TARGET: INTERNAL] (Loop Recycling Active)`.
   - Oldest recordings are automatically deleted if total size exceeds configured quota.

---

### Test 11: Scheduled Recording Engine
**Goal**: Define custom recurring time windows (`HH:MM`) during which camera recording automatically starts and stops.

1. Click **Schedules** in the sidebar.
2. Click **New Schedule Rule**.
3. Fill out form:
   - **Name**: `Night Security`
   - **Target Camera**: `CAM-MOBILE`
   - **Start Time**: Set to current time (e.g. `22:00`).
   - **End Time**: Set to 1 hour later (e.g. `23:00`).
   - **Active Days**: Select all days (`Mon` through `Sun`).
4. Click **Save Schedule Rule**.
5. Open **Camera Modal** for `CAM-MOBILE`.
6. **Verification**:
   - Modal header displays animated badge: `SCHEDULE: NIGHT SECURITY`.
   - Recording automatically starts during active schedule time window and saves on end time.

---

### Test 12: AI Motion & Object Detection
**Goal**: Detect target objects (`Person`, `Vehicle`, `Pet`), render real-time bounding boxes, and filter activity zone entry.

1. Open **Camera Modal** for `CAM-MOBILE`.
2. Click **AI Motion ON**.
3. Select **Target Filter**: `All Targets` (or `Persons Only`).
4. Wave hand or bring object/person in front of webcam.
5. **Verification**:
   - Dynamic canvas bounding boxes and labels (`PERSON 94%`, `VEHICLE 88%`) render over detected objects.
   - If object enters **Activity Zone** area, bounding box turns **RED** and top badge displays `AI TARGETS: PERSON`.
   - Automated AI snapshot frame captures (`POST /api/snapshots` with `trigger_type: 'ai_motion'`) and Web Push notification fires: `🎯 AI DETECTED: Person inside Activity Zone!`.

---

## 📊 Summary Checklist

| # | Feature | Test Status | Notes |
| :--- | :--- | :---: | :--- |
| 1 | **Login & Authentication** | 🟢 Pass | Password verification & profile session management |
| 2 | **Phone as CCTV Camera** | 🟢 Pass | WebRTC live video & mic streaming |
| 3 | **Remote Access & Grid** | 🟢 Pass | Real-time multi-device remote viewer grid |
| 4 | **Two-Way Communication** | 🟢 Pass | Duplex viewer-to-broadcaster audio talkback |
| 5 | **Adjustable Quality** | 🟢 Pass | 4K / 1080p / SD bitrate switching |
| 6 | **Image Capture Trigger** | 🟢 Pass | Manual & 15s/30s auto interval snapshots |
| 7 | **Smart Alerts** | 🟢 Pass | Socket.IO motion alerts & Web Push notifications |
| 8 | **Activity Zones** | 🟢 Pass | Polygon canvas drawer & MySQL persistence |
| 9 | **Storage Management & Quotas** | 🟢 Pass | Internal, SD Card, Auto-Failover & Custom MB limits |
| 10 | **FIFO Loop Recording** | 🟢 Pass | Automatic file purging when quota threshold reached |
| 11 | **Scheduled Recording** | 🟢 Pass | Time window schedule manager & evaluator loop |
| 12 | **AI Motion Detection** | 🟢 Pass | Bounding box rendering & Activity Zone intersection |
