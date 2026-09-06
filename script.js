// ---------------------------------------------------------------------------
// Phase 1 mock-up: prove that GPS-anchored AR positioning works, using plain
// A-Frame primitives instead of real 3D models. Swap step: once positions
// are confirmed good on a real walk, replace the shape-based entity builder
// below with one that sets gltf-model on downloaded Sketchfab .glb files —
// the decorations.js config is already shaped to support both.
// ---------------------------------------------------------------------------

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const sceneContainer = document.getElementById('scene-container');
const debugPanel = document.getElementById('debug-panel');
const debugToggle = document.getElementById('debug-toggle');
const dbgLat = document.getElementById('dbg-lat');
const dbgLon = document.getElementById('dbg-lon');
const dbgAcc = document.getElementById('dbg-acc');
const dbgCount = document.getElementById('dbg-count');

startBtn.addEventListener('click', start);
debugToggle.addEventListener('click', () => { debugPanel.hidden = !debugPanel.hidden; });

async function start() {
  startBtn.disabled = true;

  if (!('geolocation' in navigator)) {
    statusEl.textContent = 'This browser has no geolocation support — try Chrome (Android) or Safari (iPhone).';
    startBtn.disabled = false;
    return;
  }

  // iOS 13+ gates DeviceOrientationEvent behind an explicit permission
  // prompt that can only be triggered from a user gesture (this click).
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    statusEl.textContent = 'Requesting compass access…';
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') {
        statusEl.textContent = 'Compass access denied — without it decorations can’t be placed relative to where you’re facing. Reload and allow it to try again.';
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
  navigator.geolocation.getCurrentPosition(
    () => {
      // We only needed this call to trigger (and confirm) the location
      // permission prompt. AR.js's own gps-camera component runs its own
      // continuous watchPosition once the scene loads.
      launchScene();
    },
    (err) => {
      statusEl.textContent = 'Location access denied — AR needs it to know where you are. Reload and allow it to try again. (' + err.message + ')';
      startBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function launchScene() {
  startScreen.hidden = true;
  debugToggle.hidden = false;

  const scene = document.createElement('a-scene');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('embedded', '');
  scene.setAttribute('arjs', 'sourceType: webcam; videoTexture: true; debugUIEnabled: false;');
  scene.setAttribute('renderer', 'antialias: true; alpha: true');

  const camera = document.createElement('a-camera');
  camera.setAttribute('gps-camera', 'gpsMinDistance: 2');
  camera.setAttribute('rotation-reader', '');
  camera.addEventListener('gps-camera-update-position', (e) => {
    dbgLat.textContent = e.detail.position.latitude.toFixed(6);
    dbgLon.textContent = e.detail.position.longitude.toFixed(6);
    if (e.detail.position.accuracy) dbgAcc.textContent = Math.round(e.detail.position.accuracy);
  });
  scene.appendChild(camera);

  decorations.forEach((deco) => scene.appendChild(buildDecorationEntity(deco)));
  dbgCount.textContent = decorations.length;

  sceneContainer.appendChild(scene);
}

function buildDecorationEntity(deco) {
  // deco.shape -> an A-Frame primitive tag (a-box, a-sphere, a-cone, ...).
  // Later phases can instead check for `deco.model` and build an
  // <a-entity gltf-model="url(...)"> here.
  const el = document.createElement('a-' + deco.shape);
  el.setAttribute('color', deco.color);
  el.setAttribute('scale', deco.scale);
  el.setAttribute('gps-entity-place', `latitude: ${deco.lat}; longitude: ${deco.lon};`);

  const label = document.createElement('a-text');
  label.setAttribute('value', deco.label);
  label.setAttribute('align', 'center');
  label.setAttribute('color', '#ffffff');
  label.setAttribute('position', '0 2 0');
  label.setAttribute('scale', '4 4 4');
  el.appendChild(label);

  return el;
}
