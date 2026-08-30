# AR Christmas Decorations — Best of Worlds

A sixth version that combines the strongest pieces of the other five and
fixes the bugs found while reviewing them, rather than being built from
scratch.

## What was taken from where

- **root / mixed** — the camera + GPS + compass technique in general (the
  only approach here that reaches both Android *and* iOS Safari — real
  WebXR AR still isn't supported on handheld iOS as of 2026), and the
  procedural decoration meshes (tree/santa/snowman/present/star), the
  richest-looking content of the five versions.
- **arcore** — real WebXR hit-testing, offered as an optional
  "Precision AR" mode on devices that actually support it (mainly
  Android/ARCore), so you get exact tap-to-place accuracy where it's
  available instead of only the GPS approximation.
- **arjs** — the underlying idea that decorations are real, located
  objects rather than things glued to the camera.

## Bugs fixed from the originals

1. **Hardcoded coordinates.** The original `decorations.js` hardcoded one
   absolute lat/lon (a spot in Arbroath, Scotland) with `// REPLACE`
   comments nobody had replaced — so testing anywhere else showed nothing.
   Here, decorations are authored as `{ distance (m), bearing (° from true
   north) }` offsets and resolved to real lat/lon from your actual first
   GPS fix, so the demo works wherever you run it.
2. **Frozen compass.** The original fallback `deviceorientation` listener
   only updated `deviceHeading` the first time it fired, then never again.
   Orientation now updates continuously from every event.
3. **Camera never actually rotated.** The original scheme kept the
   Three.js camera fixed and swung decorations around it using manual
   trigonometry, while the live camera video (a full-screen background,
   not attached to the camera) never rotated at all — so the virtual
   overlay and the real-world video feed could visibly drift apart as you
   turned. The camera here has a real orientation, computed from device
   orientation events the same way three.js's own
   `DeviceOrientationControls` does, and the video plane is parented to
   the camera so it always fills the frame.
4. **No iOS sensor permission request.** iOS 13+ requires an explicit
   `DeviceOrientationEvent.requestPermission()` call from a user gesture
   before orientation events fire at all. The original code never made
   this call, so compass data silently never arrived on iOS. It's now
   requested on the Start button tap.
5. **Dead code.** Removed an unused OpenCV.js `<script>` tag that
   referenced an `onOpenCvReady()` function that didn't exist anywhere.
6. **No visibility into failures.** Debugging "nothing appears" required
   plugging into `chrome://inspect`. There's now an on-screen debug
   overlay showing GPS fix/accuracy, which orientation source is active,
   how many decorations are placed, and the last error — visible directly
   on the device.

## How it works

- **Start AR Experience** (primary, works on Android + iOS): requests
  camera + geolocation + orientation, anchors the decoration offsets to
  your first GPS fix, and renders them as real Three.js objects positioned
  by live distance/bearing to you as you move, with a device-orientation
  driven camera so they stay put in the world as you look around.
- **Enable Precision AR (WebXR)** (optional, shown only when supported):
  starts a real `immersive-ar` hit-test session; tap a detected surface to
  drop a decoration exactly there, cycling through the five types.

## Known limitations (inherent to the technique, not bugs)

- Consumer GPS accuracy is typically several meters even with
  `enableHighAccuracy`, so decorations placed only a couple of meters apart
  may be hard to tell apart positionally — this is a limitation of
  phone-grade GPS, not something fixable in JS.
- The GPS/compass mode approximates AR; it doesn't detect real surfaces,
  so decorations can appear to float. Use Precision AR mode where you want
  objects anchored to an actual detected plane.
- Requires HTTPS (or `localhost`) — camera, geolocation, orientation
  sensors, and WebXR all refuse to run over plain HTTP on a network
  address.
