---
title: "Saying Hi to the Browser: Playing with Google's On-Device Neural Nets — MediaPipe"
date: 2026-07-24 10:00:00
lang: en
translation_key: mediapipe-browser-presence-detection
description: "A frontend developer's complete notes on building an interactive demo — 'greet someone when they walk up, respond when they wave' — entirely in the browser with MediaPipe Tasks. From picking the stack, a mental model of the WASM runtime and model files, the GPU-fallback init pattern, and detection-loop throttling, to the most important part: the 'perception / decision separation' architecture — turning per-frame detections into reliable behavior events — plus a full table of pitfalls."
categories:
  - 技術
tags:
  - MediaPipe
  - AI
  - Computer Vision
  - 前端
  - TypeScript
---

I recently set out to answer this: **can you build a little "toy with eyes" using nothing but the browser?** The camera sees someone approach, and it greets them; wave at it, and it waves back. No app to install, no backend to stand up, no video sent to any server — it just runs the moment you open a web page.

After digging in a bit, the answer is yes, and it's a lot simpler than I expected. The star is Google's **MediaPipe Tasks**: the models run right in the browser on WebAssembly + GPU, **the video never leaves the device from start to finish**, so it's a lot more reassuring on privacy. These are my complete notes going from zero to a working demo, written for people like me — comfortable on the frontend, zero experience with AI vision.

<!-- more -->

## 0. The bottom line first: the bar is lower than you think

If I could keep only one sentence, it'd be this:

> For in-browser face/gesture detection, the hard part isn't "calling the AI" — that's just a few lines of init plus a loop. The hard part is **turning per-frame detections into reliable behavior events**.

The first half the official docs will teach you; the second half (guarding against false triggers, against repeat-firing, the state-machine design) is the point of this post — see section 6.

## 1. Picking the stack: why MediaPipe Tasks?

For "vision detection inside the browser" there are three paths on the table right now:

| Option | Verdict |
|------|------|
| **MediaPipe Tasks** | WASM + GPU delegate, best performance; face and gesture share the same runtime and ecosystem; fully on-device inference |
| TensorFlow.js | Workable, but the runtime is heavier and cold start is noticeably slower |
| Native `FaceDetector` API | Browser support is too thin — only good as an experimental toy |

The other key decision was "**how do you tell whether someone is getting closer**". Since the MacBook camera is just an ordinary camera, nothing as fancy as a depth camera, I used a crude but effective proxy: **face-width ratio** — the face's bounding-box width divided by the frame width. The closer the person, the bigger the face. That's it. The cost is that the threshold is tied to the camera's field of view and placement, so moving it means recalibrating — but for a demo it's more than enough.

![MediaPipe face detection demo: the camera detects a face and draws its bounding box; the closer the person, the bigger the box](/images/mediapipe-browser-presence-detection/01-face-detection.gif)

## 2. The mental model: it takes three things to run

This is the concept I think is most worth getting straight up front. To run MediaPipe in the browser you need three resources, each with its own job:

1. **WASM runtime (the engine)** — the C++ inference engine compiled to WebAssembly, about 33MB. It ships with SIMD / nosimd variants, and the right one is picked automatically based on browser support (modern Chrome supports SIMD across the board, so for a real deployment you can keep only the SIMD build and slim it to around 11MB).
2. **Model files (the fuel)** — the trained weights:
   - `blaze_face_short_range.tflite` (**229KB**, unbelievably small): face detection; the short-range build is designed for close-range scenarios within 2 meters.
   - `gesture_recognizer.task` (8MB): actually three models bundled together — palm detection + 21 landmarks + static gesture classification.
3. **The JS glue layer** — the `@mediapipe/tasks-vision` npm package itself, which handles loading and data shuttling.

Engine, fuel, glue — you can't skip any of them. Once you get this division of labor, every loading setting that follows becomes easy to understand.

## 3. Host everything yourself, skip the CDN

The official examples all load the wasm and models from a CDN, but here I chose to pull everything down into `public/`:

```bash
npm install @mediapipe/tasks-vision
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/
curl -o public/mediapipe/blaze_face_short_range.tflite \
  https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
```

The reason is simple: if the project runs in an **unreliable-network environment**, you'll naturally want it to work offline and stay stable. Once you self-host, the whole detection feature has **zero dependency** on any external service.

## 4. Init: two stages + GPU fallback

Every MediaPipe task initializes with the same shape — learn it once:

```ts
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

// Stage 1: load the wasm runtime (SIMD support is auto-detected here)
const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')

// Stage 2: load the model and build the instance — GPU first, fall back to CPU
for (const delegate of ['GPU', 'CPU'] as const) {
  try {
    detector = await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite', delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    })
    break
  } catch (e) { console.warn(`${delegate} delegate init failed`, e) }
}
```

A few key points:

- **delegate = where inference runs.** `GPU` (via WebGL) is several times faster than CPU, but you never know whether the user's machine has a usable GPU — so **you must write the GPU→CPU fallback**, or it just won't start on low-end machines.
- **`runningMode: 'VIDEO'`**: continuous-frame mode, where the model uses the previous frame's result to speed up tracking. The matching inference method is `detectForVideo()`; IMAGE mode pairs with `detect()`. **The mode and the method must match — mismatch them and it throws.**
- The gesture `GestureRecognizer` initializes in exactly the same shape, just with one extra `numHands: 1`.

One more habit: use `await import('@mediapipe/tasks-vision')` to **lazy-load**, and only load the gesture model once the wave feature is actually turned on. Feature off, no loading cost paid.

## 5. Feeding frames and the detection loop

### Feeding: hand the whole video element in

```ts
stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 640 }, height: { ideal: 480 } },
})
video.srcObject = stream
await video.play()

const result = detector.detectForVideo(video, performance.now())
```

- Pass the `<video>` element **straight in** — MediaPipe grabs the current frame itself, and it goes through the GPU texture path, which is faster than manually pulling pixels from a canvas. The video element doesn't even need to be in the DOM; `document.createElement('video')` as a pure frame container is enough.
- The resolution is deliberately pushed down to 640×480: plenty for detection, and the smaller the inference input the faster.
- `detectForVideo()` is a **synchronous call**, occupying the main thread for a few to a dozen-odd ms — which is exactly why the next section throttles.

### The loop: rAF + double-gate throttling

```ts
const loop = () => {
  rafId = requestAnimationFrame(loop)                  // runs along at ~60Hz
  const now = performance.now()
  if (now - lastDetectTs < 1000 / TARGET_FPS) return   // gate 1: throttle to 8fps
  if (video.currentTime === lastVideoTime) return      // gate 2: don't recompute the same frame
  lastDetectTs = now
  lastVideoTime = video.currentTime
  const result = detector.detectForVideo(video, now)
  // ...consume the result
}
```

The core idea is **decoupling detection frequency from screen refresh**: rAF keeps running at 60Hz, but the actual inference is gated down to 8fps. On the timescale of "a person walking up," 8fps is plenty (I even tried cranking it to 60fps and it was still pretty smooth); and if there's something else on the page eating GPU (say a 3D scene), this decoupling is the key to not fighting each other for resources.

Waving is the exception — each swing is only 300–500ms and needs denser sampling, so when the wave feature is on I bump the whole loop up to 12fps. Running multiple models at once doubles the resource cost, which is exactly why the gesture model should be "loaded only when needed, time-shared by a toggle."

One more thing to watch: **in VIDEO mode the timestamp must be monotonically increasing** — going backward throws. My fix is to have the throttle check and the inference argument share the same `performance.now()` value, killing any inconsistency at the source.

## 6. Perception / decision separation: turning "per-frame facts" into "behavior events"

By now you can pull a detection result for every frame. But you'll immediately hit a problem:

> What MediaPipe gives you is a **stateless per-frame fact** — "this frame has a face, this big," "this frame the palm is open, wrist is here." It won't tell you "**someone walked up**" or "**they're waving at you**."

Firing behavior straight off single-frame results is a disaster scene: a passerby drifts through and it says hi, one dropped frame and it thinks the person left, the gesture model recognizes **static** gestures while a wave is a **dynamic** motion…

My solution is to funnel the decision into two **pure-logic modules that never touch MediaPipe**, both using **temporal filtering**:

**`usePresenceStateMachine` — the arrival state machine:**

```
idle → approaching (face-width ratio hits the threshold)
     → greeted (held continuously for N ms before greeting fires)
     → cooldown (face gone for M ms before it counts as really left)
     → idle
```

Three stages of hysteresis, each blocking one kind of false trigger: entry needs "continuous confirmation" to stop passerby misfires, exit needs "absence confirmation" to stop dropped-frame misfires, and cooldown stops greeting the same person over and over.

**`useWaveDetector` — wave detection:**

Track the **turning points** of the wrist's x coordinate (peak/valley detection): only count a wave when the direction reverses N times within a time window and the amplitude clears the bar. Dropped frames get a 400ms grace period. A nice bonus — this logic only looks at "did the direction reverse," not the absolute direction, so it's completely unaffected even when the preview is mirrored.

![MediaPipe gesture detection demo: recognizing a wave and drawing the 21-point hand skeleton](/images/mediapipe-browser-presence-detection/02-gesture-detection.gif)

Both modules take all their time **injected from outside** (`performance.now()` passed as an argument), so you can feed them fake data and write unit tests.

The whole data flow, boiled down to one line:

> **Camera supplies frames → MediaPipe turns them into facts (what's in this frame) → the state machine turns those into events (what behavior happened) → the app layer turns those into actions (greet).**

Each layer depends only on the output of the one above it, and MediaPipe is isolated at the outermost ring — swap in a different detection engine someday and the decision layer doesn't change a single line.

## 7. A cheat sheet for consuming detection results

**FaceDetector** (`result.detections[]`, one entry per face):

```ts
// With multiple faces in frame, take the one with the highest confidence
const best = result.detections.reduce((a, b) =>
  (b.categories[0]?.score ?? 0) > (a?.categories[0]?.score ?? 0) ? b : a,
  result.detections[0])
const faceWidthRatio = best.boundingBox.width / video.videoWidth  // distance proxy
```

**GestureRecognizer** (`recognizeForVideo()`):

```ts
const topGesture = result.gestures[0]?.[0]  // { categoryName: 'Open_Palm', score: 0.92 }
const landmarks  = result.landmarks[0]      // 21 landmarks (normalized 0~1)
const wrist      = landmarks?.[0]           // index 0 = wrist
```

- Built-in static gesture classes: Open_Palm / Closed_Fist / Thumb_Up / Victory / Pointing_Up / ILoveYou
- The 21 landmark indices are fixed: 0 wrist, 4 thumb tip, 8 index-finger tip … 20 pinky tip
- To draw the hand skeleton, the connection table ships with the package: `GestureRecognizer.HAND_CONNECTIONS`

## 8. Pitfall table

| Pitfall | Fix |
|----|----|
| wasm/models loaded from CDN → dies in an offline environment | Put everything in `public/` and self-host |
| Machine has no usable GPU, GPU delegate creation fails | GPU→CPU fallback loop; which one actually took effect, check the console log |
| Timestamp goes backward, throws | Throttle and inference share the same `performance.now()` value |
| Mirrored preview (CSS `scaleX(-1)`) flips canvas text into mirror writing | Flip locally once more when drawing the text |
| Vite build skips type checking, a misspelled API name isn't caught | grep-verify directly against `node_modules/@mediapipe/tasks-vision/vision.d.ts` |
| USB camera occasionally disconnects during long runs | Listen for the track's `ended` event and auto-retry after 3s |
| Running multiple models at once eats performance | Lazy-load the gesture model + time-share it with a toggle |

## Closing

Looking back, my two biggest takeaways. First, **on-device AI really has a very low bar for frontend folks now**: a 229KB model, a few lines of init, one throttled loop, and the browser has eyes — with the video never leaving the device. Second, the value of old-school engineering hasn't budged one bit: **AI hands you probabilistic per-frame output, and what turns it into reliable product behavior is still state machines, hysteresis, and temporal filtering — those classic crafts.**

Beyond this I've also tried visualizing the 21 landmarks as a hand skeleton, and going forward I'd like to try the other members of the MediaPipe Tasks family (pose and segmentation both look fun).

If you also want to build a "toy with eyes" for the web, the official docs are here: [MediaPipe Solutions guide](https://ai.google.dev/edge/mediapipe/solutions/guide). It's genuinely not hard — give it a weekend and you can get it waving back at you. Have fun 👋

> All parameters and impressions here come from my own setup and context, for reference only — your camera, your machine, your placement all deserve a calibration round of their own.
