// ---------------------------------------------------------------------------
// WebXR experiment build — see README.md for the full explanation of what
// this is and why it exists alongside the AR.js version one folder up.
//
// Short version: instead of AR.js's plain webcam video + raw compass
// reading, this uses a real WebXR `immersive-ar` session (Chrome/Android +
// ARCore only) for actual visual-inertial camera tracking, which should be
// far smoother. The cost: WebXR has no idea about GPS or compass on its
// own, so decorations are placed using a ONE-TIME GPS + heading reading
// taken when you tap Start, converted into fixed local (x, z) meters and
// left static from then on — your later movement is tracked by WebXR
// itself, not by continued GPS/compass reads.
// ---------------------------------------------------------------------------

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const sceneContainer = document.getElementById('scene-container');
const debugPanel = document.getElementById('debug-panel');
const debugToggle = document.getElementById('debug-toggle');
const dbgLat = document.getElementById('dbg-lat');
const dbgLon = document.getElementById('dbg-lon');
const dbgHeading = document.getElementById('dbg-heading');
const dbgCount = document.getElementById('dbg-count');
const dbgNearest = document.getElementById('dbg-nearest');
const recalibrateBtn = document.getElementById('recalibrate-btn');

let origin = null;      // { lat, lon } read once at Start (or Recalibrate)
let headingDeg = 0;     // compass bearing (0=N, 90=E) the device faced at that moment

startBtn.addEventListener('click', start);
debugToggle.addEventListener('click', () => { debugPanel.hidden = !debugPanel.hidden; });
recalibrateBtn.addEventListener('click', recalibrate);

// ---------------------------------------------------------------------------
// Geometry: real-world lat/lon -> local (x, z) meters, rotated so that
// "forward" in the WebXR scene matches whichever way the device was
// actually facing (in real compass terms) at the moment we read it.
// ---------------------------------------------------------------------------

// Equirectangular approximation (fine for the sub-kilometer distances this
// project deals with) — returns meters north/east of (lat1, lon1).
function metersOffset(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const north = toRad(lat2 - lat1) * R;
  const east = toRad(lon2 - lon1) * R * Math.cos(toRad((lat1 + lat2) / 2));
  return { north, east };
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const { north, east } = metersOffset(lat1, lon1, lat2, lon2);
  return Math.hypot(north, east);
}

// Rotates a (north, east) real-world offset into the WebXR local frame,
// given the compass heading (degrees, 0=N clockwise) the device faced when
// the session's origin was established. A-Frame/three.js use -Z as
// "forward", so the rotated forward component is negated onto z.
function rotateToLocal(north, east, heading0Deg) {
  const h = (heading0Deg * Math.PI) / 180;
  const forward = north * Math.cos(h) + east * Math.sin(h);
  const right = -north * Math.sin(h) + east * Math.cos(h);
  return { x: right, z: -forward };
}

function computeLocalXZ(deco) {
  const { north, east } = metersOffset(origin.lat, origin.lon, deco.lat, deco.lon);
  return rotateToLocal(north, east, headingDeg);
}

// ---------------------------------------------------------------------------
// One-time GPS + heading capture
// ---------------------------------------------------------------------------

function getPositionOnce() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000
    });
  });
}

// Averages compass readings (vector mean, so it handles wraparound near
// 0°/360° correctly) over `durationMs` to reduce single-sample noise before
// committing to a heading. Resolves null if no absolute/compass-referenced
// reading arrived at all (plain relative orientation samples are ignored —
// they're not tied to true north and would misalign everything).
function captureHeading(durationMs) {
  return new Promise((resolve) => {
    let sumCos = 0, sumSin = 0, count = 0;

    const handler = (e) => {
      let heading = null;
      if (typeof e.webkitCompassHeading === 'number') {
        heading = e.webkitCompassHeading; // iOS: already true compass bearing
      } else if (e.absolute && typeof e.alpha === 'number') {
        heading = (360 - e.alpha) % 360; // Android absolute: alpha -> compass bearing
      }
      if (heading !== null) {
        const rad = (heading * Math.PI) / 180;
        sumCos += Math.cos(rad);
        sumSin += Math.sin(rad);
        count++;
      }
    };

    window.addEventListener('deviceorientationabsolute', handler);
    window.addEventListener('deviceorientation', handler);

    setTimeout(() => {
      window.removeEventListener('deviceorientationabsolute', handler);
      window.removeEventListener('deviceorientation', handler);
      if (count === 0) { resolve(null); return; }
      let avg = (Math.atan2(sumSin / count, sumCos / count) * 180) / Math.PI;
      if (avg < 0) avg += 360;
      resolve(avg);
    }, durationMs);
  });
}

// ---------------------------------------------------------------------------
// Start flow
// ---------------------------------------------------------------------------

async function start() {
  startBtn.disabled = true;

  if (!navigator.xr) {
    statusEl.textContent = 'WebXR isn’t available in this browser. This experiment needs Chrome for Android — try the main site instead.';
    startBtn.disabled = false;
    return;
  }

  let arSupported = false;
  try {
    arSupported = await navigator.xr.isSessionSupported('immersive-ar');
  } catch (err) {
    arSupported = false;
  }
  if (!arSupported) {
    statusEl.textContent = 'This device/browser doesn’t support WebXR AR sessions (needs Chrome for Android + ARCore). Use the main site instead.';
    startBtn.disabled = false;
    return;
  }

  if (!('geolocation' in navigator)) {
    statusEl.textContent = 'This browser has no geolocation support.';
    startBtn.disabled = false;
    return;
  }

  // iOS gates DeviceOrientationEvent behind a permission prompt triggerable
  // only from a user gesture. Kept here for completeness even though
  // immersive-ar itself won't be reached on iOS today.
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') {
        statusEl.textContent = 'Compass access denied — decorations can’t be aligned without it. Reload and allow it to try again.';
        startBtn.disabled = false;
        return;
      }
    } catch (err) {
      statusEl.textContent = 'Could not request compass access: ' + err.message;
      startBtn.disabled = false;
      return;
    }
  }

  statusEl.textContent = 'Requesting location…';
  let pos;
  try {
    pos = await getPositionOnce();
  } catch (err) {
    statusEl.textContent = 'Location access denied — needed to anchor decorations. Reload and allow it to try again.';
    startBtn.disabled = false;
    return;
  }
  origin = { lat: pos.coords.latitude, lon: pos.coords.longitude };

  statusEl.textContent = 'Reading compass — hold the phone flat, or wave it in a figure-8 if this hangs…';
  const heading = await captureHeading(1500);
  headingDeg = heading !== null ? heading : 0;
  if (heading === null) {
    statusEl.textContent = 'No compass reading came through — continuing, but decorations may face the wrong way. Try Recalibrate once AR starts.';
  }

  launchScene();
}

async function recalibrate() {
  recalibrateBtn.disabled = true;
  const original = recalibrateBtn.textContent;
  recalibrateBtn.textContent = 'Recalibrating…';
  try {
    const pos = await getPositionOnce();
    origin = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    const heading = await captureHeading(1500);
    if (heading !== null) headingDeg = heading;
    decorations.forEach((deco) => {
      const el = document.getElementById('deco-' + deco.id);
      if (!el) return;
      const { x, z } = computeLocalXZ(deco);
      el.setAttribute('position', `${x} 0 ${z}`);
    });
    updateDebugPanel();
  } finally {
    recalibrateBtn.disabled = false;
    recalibrateBtn.textContent = original;
  }
}

function updateDebugPanel() {
  dbgLat.textContent = origin.lat.toFixed(6);
  dbgLon.textContent = origin.lon.toFixed(6);
  dbgHeading.textContent = Math.round(headingDeg);
  dbgCount.textContent = decorations.length;

  let nearest = null;
  decorations.forEach((deco) => {
    const { x, z } = computeLocalXZ(deco);
    const d = Math.hypot(x, z);
    if (!nearest || d < nearest.d) nearest = { d, deco };
  });
  if (nearest) {
    dbgNearest.textContent = `${nearest.deco.label} — ${Math.round(nearest.d)} m away`;
  }
}

function launchScene() {
  startScreen.hidden = true;
  debugToggle.hidden = false;
  updateDebugPanel();

  const scene = document.createElement('a-scene');
  // Our own Start button already handled the permission/entry flow, so we
  // don't want A-Frame's own injected enter-immersive button on top of it.
  // NOTE: the component is `xr-mode-ui` on this A-Frame version (1.8.0) —
  // it was renamed from the older `vr-mode-ui` used in the main project's
  // AR.js build (pinned to A-Frame 1.3.0). Setting the old name here did
  // nothing, silently, which is why A-Frame's default button kept
  // showing — and its default mode is "vr", which is exactly why tapping
  // it tried to start a VR session instead of AR.
  scene.setAttribute('xr-mode-ui', 'enabled: false');
  // dom-overlay: without requesting this, none of the page's normal HTML
  // (debug panel, debug/recalibrate buttons) renders at all once the AR
  // session takes over the screen — it's not optional-but-nice, it's the
  // only way regular DOM content shows up over a WebXR session. Point it
  // at <body> so everything already in the page overlays correctly.
  scene.setAttribute('webxr', 'optionalFeatures: dom-overlay; overlayElement: body;');
  scene.setAttribute('renderer', 'colorManagement: true; alpha: true');

  const camera = document.createElement('a-entity');
  camera.setAttribute('camera', '');
  camera.setAttribute('position', '0 1.6 0');
  scene.appendChild(camera);

  decorations.forEach((deco) => scene.appendChild(buildDecorationEntity(deco)));

  sceneContainer.appendChild(scene);

  const enterAR = () => {
    scene.enterAR().catch((err) => {
      statusEl.textContent = ''; // start screen is hidden; log instead
      console.error('Failed to enter WebXR AR session:', err);
      alert('Could not start the AR session: ' + err.message);
    });
  };
  if (scene.hasLoaded) enterAR();
  else scene.addEventListener('loaded', enterAR, { once: true });
}

function buildDecorationEntity(deco) {
  const el = document.createElement('a-' + deco.shape);
  el.setAttribute('id', 'deco-' + deco.id);
  el.setAttribute('color', deco.color);
  el.setAttribute('scale', deco.scale);
  const { x, z } = computeLocalXZ(deco);
  el.setAttribute('position', `${x} 0 ${z}`);

  const label = document.createElement('a-text');
  label.setAttribute('value', deco.label);
  label.setAttribute('align', 'center');
  label.setAttribute('color', '#ffffff');
  label.setAttribute('position', '0 2 0');
  label.setAttribute('scale', '4 4 4');
  el.appendChild(label);

  return el;
}
