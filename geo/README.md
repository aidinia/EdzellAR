# EdzellAR — WebXR experiment (Phase 1, parallel track)

This folder is a **separate, self-contained experiment** — it does not touch
or depend on anything in the parent `edzellarclaude/` project. Nothing here
was copied by reference; `decorations.js` is its own copy.

## Why this exists

The main project (one level up) uses AR.js's "webcam mode": a plain
`<video>` background plus raw compass (`deviceorientation`) readings applied
every frame. That's simple and works on both Android and iPhone, but the
raw compass has no filtering, so it visibly shakes.

This experiment instead uses a real **WebXR `immersive-ar` session**. On
supported devices (Chrome for Android, powered by ARCore) that gives you
actual visual-inertial tracking — the browser fuses the camera image with
the gyroscope/accelerometer frame to frame — which is inherently far
smoother than reading a magnetometer directly. It is **not** the ARCore
Geospatial API (that needs a native app + a billed Google Cloud project);
this is the free, plain-WebXR tracking that ARCore already exposes to
Chrome without any of that.

## The trade-off this creates

WebXR has no concept of GPS or compass built in — it only knows "how has
the device moved since the AR session started," in its own arbitrary local
coordinate space. So to anchor decorations to real GPS coordinates, this
experiment:

1. Reads your GPS position **once**, when you tap Start — call this the
   origin.
2. Reads your compass heading **once**, briefly averaged over ~1.5s to
   reduce noise, to work out which real-world compass direction the WebXR
   session's "forward" axis lines up with.
3. Converts every decoration's lat/lon into a fixed (x, z) meter offset
   from that origin, rotated by that starting heading, and places it there
   as a static point in the WebXR scene.

From then on, **your movement is tracked by WebXR itself, not by GPS or
compass** — nothing here calls `watchPosition` continuously the way the
AR.js version does. That's what removes the shake. But it also means:

- **Everything is only as good as that one-time compass reading.** Phone
  magnetometers can be off by 15–30° near buildings/metal/cars. If it's
  off, the whole layout will be internally stable but rotated — a
  decoration meant to be "ahead of you" might consistently show up to one
  side instead. There's a "Recalibrate" button in the debug panel to
  re-read GPS + heading and reposition everything without restarting the
  AR session, in case the first reading was bad.
- **No correction for long walks.** WebXR tracking can drift the farther
  you walk from the anchor point, with nothing pulling it back to true GPS
  (that correction is exactly what the paid, native-only ARCore Geospatial
  API provides). Fine for a short walk around one house; less fine for a
  lap of the whole neighbourhood without recalibrating.
- **Android + Chrome only.** iOS Safari has never supported WebXR AR
  sessions at all, so this mode will refuse to start there — that's a
  platform limitation, not a bug. The main AR.js site remains the one that
  works for iPhone friends.

## Files

- `index.html` — loads A-Frame 1.8.0 (current latest; no AR.js dependency
  here, so none of the version-pinning constraints from the main project
  apply)
- `decorations.js` — same 5 placeholder shapes/coordinates as the main
  project's copy, so the two can be compared standing at the same spot
- `script.js` — GPS+heading anchoring, entity placement, and the WebXR
  session lifecycle
- `style.css` — matching visual style to the main site
