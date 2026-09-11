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
const collectCounter = document.getElementById('collect-counter');
const collectCountEl = document.getElementById('collect-count');
const collectTotalEl = document.getElementById('collect-total');
const collectResetBtn = document.getElementById('collect-reset');

let origin = null;      // { lat, lon } read once at Start (or Recalibrate)
let headingDeg = 0;     // compass bearing (0=N, 90=E) the device faced at that moment

// See the main project's script.js for the fuller comment — a more
// surgical alternative to aframe-extras' animation-mixer for a model where
// one specific bone's motion (e.g. a root/torso bone that spins the whole
// model) needs excluding without losing the rest of the animation.
AFRAME.registerComponent('filtered-animation-mixer', {
  schema: { clip: { default: '' }, excludeNode: { default: '' } },
  init: function () {
    this.el.addEventListener('model-loaded', (evt) => {
      const model = evt.detail.model;
      if (!model.animations || !model.animations.length) return;
      let clips = this.data.clip
        ? [THREE.AnimationClip.findByName(model.animations, this.data.clip)].filter(Boolean)
        : model.animations;
      if (this.data.excludeNode) {
        clips.forEach((clip) => {
          clip.tracks = clip.tracks.filter((t) => !t.name.startsWith(this.data.excludeNode + '.'));
        });
      }
      this.mixer = new THREE.AnimationMixer(model);
      clips.forEach((clip) => this.mixer.clipAction(clip).play());
    });
  },
  tick: function (time, delta) {
    if (this.mixer) this.mixer.update(delta / 1000);
  }
});

// Saved on the device (localStorage), not per-session — see the main
// project's script.js for the fuller comment. Same storage key there and
// here: since both pages share an origin, progress collected on one build
// shows up on the other too.
const COLLECTED_STORAGE_KEY = 'edzellar-collected-ids';
const collectedIds = new Set();
try {
  JSON.parse(localStorage.getItem(COLLECTED_STORAGE_KEY) || '[]').forEach((id) => collectedIds.add(id));
} catch (e) { /* corrupt/unavailable storage — just start empty */ }

function saveCollectedIds() {
  try { localStorage.setItem(COLLECTED_STORAGE_KEY, JSON.stringify([...collectedIds])); } catch (e) { /* storage unavailable */ }
}

const COLLECTED_OPACITY = 0.35;
const decorationEntities = new Map();

function setCollectedVisual(deco, el, collected) {
  const label = el.querySelector('a-text');
  if (label) {
    label.setAttribute('value', collected ? deco.label + ' ✓' : deco.label);
    label.setAttribute('color', collected ? '#7ef7a0' : '#ffffff');
  }

  // See the main project's script.js for the fuller comment on why .glb
  // models need direct traversal here instead of A-Frame's material
  // component, and why this can't accidentally affect another decoration
  // that happens to share the same model file.
  const opacity = collected ? COLLECTED_OPACITY : 1;
  if (deco.model) {
    const root = el.getObject3D('mesh');
    if (root) {
      root.traverse((node) => {
        if (!node.material) return;
        (Array.isArray(node.material) ? node.material : [node.material]).forEach((mat) => {
          mat.transparent = collected;
          mat.opacity = opacity;
        });
      });
    }
  } else {
    el.setAttribute('material', `opacity: ${opacity}; transparent: ${collected}`);
  }
}

function collectDecoration(deco, el) {
  if (collectedIds.has(deco.id)) return;
  collectedIds.add(deco.id);
  saveCollectedIds();
  collectCountEl.textContent = collectedIds.size;
  setCollectedVisual(deco, el, true);
}

function resetProgress() {
  if (collectedIds.size === 0) return;
  if (!confirm(`Reset ${collectedIds.size} collected decoration${collectedIds.size === 1 ? '' : 's'} back to 0?`)) return;
  collectedIds.forEach((id) => {
    const entry = decorationEntities.get(id);
    if (entry) setCollectedVisual(entry.deco, entry.el, false);
  });
  collectedIds.clear();
  saveCollectedIds();
  collectCountEl.textContent = 0;
}
collectResetBtn.addEventListener('click', resetProgress);

// Matches the main site's gps-camera maxDistance — decorations farther than
// this (in meters, from wherever you last anchored) don't render at all.
// IMPORTANT caveat specific to this build: unlike the main site, this is
// only evaluated once, at Start/Recalibrate time, using your GPS position
// at that moment — not continuously as you actually walk (WebXR tracks
// your movement itself, not GPS, once a session is running). So walking
// closer to a decoration that was hidden as too-far at anchor time won't
// reveal it; tap Recalibrate once you're near it instead.
const MAX_VISIBLE_METERS = 30;

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

// Sets an entity's position from its decoration's coordinates, and hides it
// entirely beyond MAX_VISIBLE_METERS — see that constant's comment for why
// this is a one-time check rather than something that updates as you walk.
function placeDecorationEntity(el, deco) {
  const { x, z } = computeLocalXZ(deco);
  el.setAttribute('position', `${x} 0 ${z}`);
  el.setAttribute('visible', Math.hypot(x, z) <= MAX_VISIBLE_METERS);
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

  // isSessionSupported alone can false-positive on desktop browsers with
  // any OpenXR runtime registered (SteamVR, a headset driver, a WebXR
  // emulator extension...) — this build is Android/Chrome/ARCore only by
  // design, so require that platform too rather than trusting the API's
  // self-reported answer on its own. See index.html's matching check.
  if (!/Android/i.test(navigator.userAgent)) {
    statusEl.textContent = 'This experiment needs Chrome for Android — try the main site instead.';
    startBtn.disabled = false;
    return;
  }

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
      placeDecorationEntity(el, deco);
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
  // Tap-to-collect. IMPORTANT: this is a real WebXR immersive-ar session,
  // not a plain page — screen taps arrive as WebXR 'selectstart' input
  // events, not ordinary mouse/touch events, so rayOrigin: mouse (what the
  // non-XR main site uses) would never fire here. rayOrigin: xrselect is
  // A-Frame's documented cursor mode specifically for handheld-AR taps.
  scene.setAttribute('raycaster', 'objects: .collectible');
  scene.setAttribute('cursor', 'rayOrigin: xrselect');

  const camera = document.createElement('a-entity');
  camera.setAttribute('camera', '');
  camera.setAttribute('position', '0 1.6 0');
  scene.appendChild(camera);

  decorations.forEach((deco) => scene.appendChild(buildDecorationEntity(deco)));

  collectTotalEl.textContent = decorations.length;
  collectCountEl.textContent = collectedIds.size; // may be >0, restored from a previous visit
  collectCounter.hidden = false;

  sceneContainer.appendChild(scene);

  const enterAR = () => {
    scene.enterAR().catch((err) => {
      // isSessionSupported('immersive-ar') can say yes on a real Android
      // phone/browser whose ARCore support isn't actually solid enough to
      // open a session (seen in the wild on some budget/rugged phones +
      // non-Chrome browsers) — there's no reliable way to predict that in
      // advance, so instead of dead-ending here, fall back to the main
      // AR.js site, which works far more broadly.
      console.error('Failed to enter WebXR AR session:', err);
      // Remember this so index.html's redirect-in check stops sending this
      // browser back here — without it, the two builds' checks disagreeing
      // (isSessionSupported says yes, an actual session says no) creates an
      // infinite redirect loop: main -> geo -> [fails] -> main -> geo -> ...
      try { localStorage.setItem('edzellar-webxr-ar-failed', '1'); } catch (e) { /* storage unavailable — worst case the loop returns */ }
      alert('This device reported WebXR support but couldn’t actually start an AR session. Sending you to the main site instead.');
      window.location.replace('../');
    });
  };
  if (scene.hasLoaded) enterAR();
  else scene.addEventListener('loaded', enterAR, { once: true });
}

// decorations.js is shared with the main project (see README.md) and its
// model paths are written relative to THAT page's location — the root
// index.html, one folder up from here — since that's the file's natural
// home. A bare relative path resolves against the current page's own URL,
// so left as-is it'd look for the model inside geo/ itself. Absolute URLs
// (a CDN link, or a leading slash) are left untouched.
function resolveModelUrl(path) {
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith('/')) return path;
  return '../' + path;
}

function buildDecorationEntity(deco) {
  let el;
  if (deco.model) {
    // Real Sketchfab (or any other) .glb/.gltf model — see the main
    // project's script.js for the fuller comment; identical approach here.
    el = document.createElement('a-entity');
    el.setAttribute('gltf-model', `url(${resolveModelUrl(deco.model)})`);
    if (deco.rotation) el.setAttribute('rotation', deco.rotation);
    // animation-mixer (loaded via aframe-extras in geo/index.html) plays
    // any animation embedded in the model — gltf-model alone never does.
    // See the main project's script.js for the fuller comment on the
    // filtered-animation-mixer / animate / animation-mixer trio below.
    if (deco.animation) {
      el.setAttribute('filtered-animation-mixer', deco.animation);
    } else if (deco.animate !== false) {
      el.setAttribute('animation-mixer', '');
    }
  } else {
    el = document.createElement('a-' + deco.shape);
    el.setAttribute('color', deco.color);
  }
  el.setAttribute('id', 'deco-' + deco.id);
  el.setAttribute('scale', deco.scale);
  el.classList.add('collectible');
  el.addEventListener('click', () => collectDecoration(deco, el));
  decorationEntities.set(deco.id, { deco, el });
  placeDecorationEntity(el, deco);

  const label = document.createElement('a-text');
  label.setAttribute('value', deco.label);
  label.setAttribute('align', 'center');
  label.setAttribute('color', '#ffffff');
  label.setAttribute('position', '0 2 0');
  label.setAttribute('scale', '4 4 4');
  el.appendChild(label);

  // Restoring "already collected" from a previous visit — see the main
  // project's script.js for the fuller comment on the load-timing reason
  // this needs to wait for model-loaded on a .glb specifically.
  if (collectedIds.has(deco.id)) {
    if (deco.model) el.addEventListener('model-loaded', () => setCollectedVisual(deco, el, true), { once: true });
    else setCollectedVisual(deco, el, true);
  }

  return el;
}
