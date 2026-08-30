# AR Christmas Decorations — Best of Worlds

A sixth version combining the strongest pieces of the other five, built to
solve one specific goal: anchor decorations around a neighborhood
(roughly 500×500 yards) so people can walk around and reliably find them —
not centimeter-precision AR, but AR that doesn't visibly drift or chase the
viewer.

## The anchoring bug this was built to fix

Symptom: a decoration would show up as a tiny moving dot that never got
closer, no matter which way you walked.

Root cause: a phone's magnetic compass is noisy and often biased 10-40°
(buildings, rebar, parked cars). The original root/mixed code re-derived
each object's on-screen position from a live compass reading essentially
every frame, with the 3D camera itself never actually rotating — so there
was no real "world" the object was anchored to. Every frame just asked
"where should I draw this dot right now," independent of the last frame,
which reads exactly like an object chasing the viewer.

## The fix: anchor via SLAM tracking, not the compass

- **Where WebXR (`immersive-ar`) is supported** — most Android/Chrome/ARCore
  phones — the app uses real 6DOF visual-inertial SLAM tracking, the same
  technology that makes native ARCore/ARKit apps feel "locked in place."
  SLAM tracks the phone's motion from the camera image + motion sensors and
  never touches the magnetometer, so once something is anchored it does not
  drift or jitter.
  - The compass is read **once**, for about 1.8 seconds, right before the
    session starts (`calibrateCompass()` in `script.js`), purely to work out
    which direction the phone was facing when tracking began. Every
    decoration's position is computed once from that calibration and real
    GPS distance/bearing, then handed to the WebXR scene — SLAM does the
    rest for the whole session.
  - If the one-time calibration reading was off, the whole set of
    decorations may end up rotated a few degrees from true north — but
    *consistently* wrong, not jittering, so it's still something a person
    can walk toward and find.
- **Where WebXR isn't available** — notably iOS Safari, which still has no
  handheld WebXR AR support as of 2026 — falls back to the previous camera +
  GPS + compass approach, with two changes: the camera's orientation is
  slerped toward each new sensor reading instead of snapping to it
  (`animateFallback()`), which measurably reduces jitter, and the debug
  overlay honestly labels this mode `compass-fallback (less stable)`. This
  is a real hardware limitation, not something fixable in JS — if reliable
  anchoring on iOS specifically becomes a hard requirement, that needs a
  VPS service (e.g. Niantic Lightship VPS for Web / 8th Wall), which tracks
  by matching camera imagery against a pre-scanned map instead of relying on
  the compass at all.

Either path resolves `christmasDecorations` entries (see `decorations.js`)
from `{ distance (m), bearing (° from true north) }` offsets into real
lat/lon, anchored to wherever the session starts — no hardcoded coordinates
to edit before testing.

## What was taken from where

- **root / mixed**: the procedural decoration meshes, and the general idea
  of camera + GPS positioning for broad (Android + iOS) device reach.
- **arcore**: real WebXR session handling, adapted here to run without
  hit-test (only real-world surface *tap-to-place* needs hit-test; plain
  6DOF tracking, which is what anchoring needs, doesn't).
- **arjs**: the mental model of decorations as real, located objects.

## Known limitations

- 500×500 yards is well within plain GPS accuracy (~5-15m error is trivial
  against that scale), so no VPS/paid API is needed for *position* — the
  fix here is entirely about *anchoring stability*, which was the actual
  reported problem.
- SLAM tracking on the WebXR path anchors well within a single session, but
  its origin resets each time you start a new session — walk-away-and-come
  -back persistence across sessions isn't implemented (would need
  server-stored anchors or a VPS service).
- Requires HTTPS (or `localhost`).
