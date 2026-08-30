// AR Christmas Decorations — "Best of Worlds" (v2: anchoring fix)
//
// The core problem with a pure GPS+compass approach: a phone's magnetometer
// is noisy and often biased 10-40° (buildings, rebar, metal). Continuously
// re-deriving an object's screen position from live compass readings makes
// it visibly swim/chase the viewer instead of staying anchored — that's
// what "a pixel that moved with me" was.
//
// The fix used here: don't rely on the compass for anchoring, only for a
// one-time calibration.
//
//  - Where WebXR ('immersive-ar') is available (Android/Chrome on this
//    project's test device, most ARCore phones generally): anchoring uses
//    real 6DOF visual-inertial SLAM tracking, the same tech ARCore/ARKit
//    apps use to feel "locked in place." It never touches the compass
//    during tracking, so it doesn't drift or jitter. The compass is read
//    ONCE, briefly, right before the session starts, purely to work out
//    which way is north relative to the session's own tracking origin —
//    everything after that is held in place by SLAM, not the magnetometer.
//  - Where WebXR isn't available (iOS Safari, still no handheld AR support
//    as of 2026): falls back to camera + GPS + compass, same as before, but
//    now with the orientation smoothed (slerped) frame to frame instead of
//    snapping straight to noisy raw sensor values, which measurably reduces
//    (but can't fully eliminate) the jitter inherent to magnetometer-based
//    tracking. This mode is honestly labeled as less stable in the debug
//    overlay — that's a real limitation of phone-grade compass hardware,
//    not something fixable in JS.
//
// Other fixes carried over from the previous pass:
//  - Decoration coordinates are relative offsets (distance + bearing) from
//    wherever the session starts, not hardcoded to one absolute location.
//  - iOS 13+ orientation permission is explicitly requested on the Start tap.
//  - No dead OpenCV include, no external glTF fetch dependency.

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6371e3;

const startButton = document.getElementById('startAR');
const statusEl = document.getElementById('startStatus');
const startScreen = document.getElementById('startScreen');
const arContainer = document.getElementById('arContainer');
const canvas = document.getElementById('arCanvas');
let debugEl;

let currentPosition = null; // { lat, lon, accuracy }
let sessionOrigin = null;
let lastError = '';
let currentMode = 'starting';

startButton.addEventListener('click', start);

// ---------------------------------------------------------------------
// Geo math
// ---------------------------------------------------------------------

function calculateDistance(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * DEG2RAD;
  const phi2 = lat2 * DEG2RAD;
  const dPhi = (lat2 - lat1) * DEG2RAD;
  const dLambda = (lon2 - lon1) * DEG2RAD;

  const a = Math.sin(dPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * DEG2RAD;
  const phi2 = lat2 * DEG2RAD;
  const dLambda = (lon2 - lon1) * DEG2RAD;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const theta = Math.atan2(y, x);

  return (theta / DEG2RAD + 360) % 360;
}

function destinationPoint(lat, lon, distanceM, bearingDeg) {
  const phi1 = lat * DEG2RAD;
  const lambda1 = lon * DEG2RAD;
  const theta = bearingDeg * DEG2RAD;
  const delta = distanceM / EARTH_RADIUS_M;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
  );

  return { lat: phi2 / DEG2RAD, lon: lambda2 / DEG2RAD };
}

// Circular mean, because you can't naively average compass degrees
// (359° and 1° should average to 0°, not 180°).
function circularMeanDegrees(samples) {
  let sinSum = 0, cosSum = 0;
  samples.forEach(deg => {
    sinSum += Math.sin(deg * DEG2RAD);
    cosSum += Math.cos(deg * DEG2RAD);
  });
  return (Math.atan2(sinSum, cosSum) / DEG2RAD + 360) % 360;
}

// ---------------------------------------------------------------------
// Debug overlay
// ---------------------------------------------------------------------

function updateDebugOverlay() {
  if (!debugEl) return;
  const lines = [];
  lines.push(`mode: ${currentMode}`);
  if (currentPosition) {
    lines.push(`gps: ${currentPosition.lat.toFixed(6)}, ${currentPosition.lon.toFixed(6)} (±${Math.round(currentPosition.accuracy)}m)`);
  } else {
    lines.push('gps: waiting for fix...');
  }
  if (lastError) lines.push(`<span class="err">error: ${lastError}</span>`);
  debugEl.innerHTML = lines.join('\n');
}

function setError(context, err) {
  lastError = `${context}: ${err && err.message ? err.message : err}`;
  console.error(context, err);
  updateDebugOverlay();
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// ---------------------------------------------------------------------
// Shared setup: GPS fix + one-time compass calibration + iOS permission.
// Both the XR path and the fallback path need this.
// ---------------------------------------------------------------------

async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const result = await DeviceOrientationEvent.requestPermission();
    if (result !== 'granted') {
      throw new Error('Motion/orientation permission denied');
    }
  }
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// Samples compass heading for a short window and returns the circular
// mean. This is the ONLY place the compass is used for the XR-anchored
// path — after this, SLAM tracking takes over and the compass is ignored.
function calibrateCompass(durationMs) {
  return new Promise((resolve) => {
    const samples = [];
    let usingAbsolute = false;

    const onAbsolute = (event) => {
      if (event.alpha === null) return;
      usingAbsolute = true;
      samples.push(event.alpha);
    };
    const onRelative = (event) => {
      if (event.alpha === null || usingAbsolute) return;
      samples.push(event.alpha);
    };

    window.addEventListener('deviceorientationabsolute', onAbsolute);
    window.addEventListener('deviceorientation', onRelative);

    setTimeout(() => {
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onRelative);
      resolve({
        headingDeg: samples.length ? circularMeanDegrees(samples) : 0,
        sampleCount: samples.length,
        wasAbsolute: usingAbsolute
      });
    }, durationMs);
  });
}

async function start() {
  startButton.disabled = true;
  lastError = '';

  try {
    await requestOrientationPermission();

    setStatus('Getting your location…');
    const position = await getCurrentPositionAsync({ enableHighAccuracy: true, timeout: 15000 });
    currentPosition = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    sessionOrigin = { lat: currentPosition.lat, lon: currentPosition.lon };

    setStatus('Calibrating compass — hold your phone still, facing forward…');
    const calibration = await calibrateCompass(1800);

    const xrSupported = await isImmersiveArSupported();

    if (xrSupported) {
      try {
        await startXRAnchored(calibration.headingDeg);
        return;
      } catch (xrError) {
        console.warn('WebXR session failed, falling back to compass mode:', xrError);
        // fall through to the fallback path below
      }
    }

    await startCompassFallback();
  } catch (error) {
    setError('start', error);
    alert('Could not start AR: ' + (error.message || error));
    startButton.disabled = false;
    setStatus('');
  }
}

async function isImmersiveArSupported() {
  if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch (e) {
    return false;
  }
}

function enterArUI() {
  startScreen.hidden = true;
  arContainer.hidden = false;
  debugEl = document.getElementById('debugOverlay');
  updateDebugOverlay();
}

// Resolve each decoration's absolute lat/lon from its {distance, bearing}
// offset, anchored to the session's starting GPS position.
function resolveDecorationCoordinates() {
  christmasDecorations.forEach(d => {
    if (d._resolved) return;
    const dest = destinationPoint(sessionOrigin.lat, sessionOrigin.lon, d.distance, d.bearing);
    d.lat = dest.lat;
    d.lon = dest.lon;
    d._resolved = true;
  });
}

// ---------------------------------------------------------------------
// Path A: WebXR-anchored (real SLAM tracking — the fix for "moves with
// me"). Decorations are placed ONCE in the session's local reference
// space; from then on the browser's own 6DOF tracking keeps them anchored,
// not the compass.
// ---------------------------------------------------------------------

let xrSession, xrRefSpace, xrScene, xrCamera, xrRenderer;

async function startXRAnchored(calibratedHeadingDeg) {
  currentMode = 'xr-anchored (SLAM)';

  xrSession = await navigator.xr.requestSession('immersive-ar', {
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body }
  });

  enterArUI();
  updateDebugOverlay();

  resolveDecorationCoordinates();

  xrScene = new THREE.Scene();
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  xrScene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(0, 1, 1);
  xrScene.add(directionalLight);

  // Place every decoration once, using the true GPS bearing/distance from
  // the session's start position, rotated into the XR session's own local
  // coordinate frame via the one-time compass calibration. No further
  // repositioning happens — SLAM tracking (not compass) holds these in
  // place as the viewer walks and looks around.
  christmasDecorations.forEach(d => {
    const trueBearing = calculateBearing(sessionOrigin.lat, sessionOrigin.lon, d.lat, d.lon);
    const angle = (trueBearing - calibratedHeadingDeg) * DEG2RAD;
    const mesh = createDecorationMesh(d.type, d.color, d.scale);
    mesh.position.set(
      Math.sin(angle) * d.distance,
      -0.5,
      -Math.cos(angle) * d.distance
    );
    xrScene.add(mesh);
  });

  xrRenderer = new THREE.WebGLRenderer({ alpha: true, canvas: document.createElement('canvas') });
  xrRenderer.autoClear = false;
  xrRenderer.xr.enabled = true;

  xrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
  xrCamera.matrixAutoUpdate = false;

  document.body.appendChild(xrRenderer.domElement);
  await xrRenderer.xr.setSession(xrSession);

  xrRefSpace = await xrSession.requestReferenceSpace('local');

  xrSession.addEventListener('end', onXRSessionEnded);
  xrSession.requestAnimationFrame(onXRFrame);
}

function onXRFrame(time, frame) {
  const session = frame.session;
  session.requestAnimationFrame(onXRFrame);

  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    const view = pose.views[0];
    const viewport = session.renderState.baseLayer.getViewport(view);
    xrRenderer.setSize(viewport.width, viewport.height);

    xrCamera.matrix.fromArray(view.transform.matrix);
    xrCamera.projectionMatrix.fromArray(view.projectionMatrix);
    xrCamera.updateMatrixWorld(true);

    xrRenderer.render(xrScene, xrCamera);
  }
}

function onXRSessionEnded() {
  xrSession = null;
  if (xrRenderer && xrRenderer.domElement.parentNode) {
    xrRenderer.domElement.parentNode.removeChild(xrRenderer.domElement);
  }
  arContainer.hidden = true;
  startScreen.hidden = false;
  startButton.disabled = false;
  setStatus('');
}

// ---------------------------------------------------------------------
// Path B: camera + GPS + smoothed compass fallback (iOS / no WebXR).
// Positions are re-derived from live GPS on each fix (stable — this is
// plain geometry, not compass-dependent); only the camera's on-screen
// orientation depends on the compass, and that's now damped frame to
// frame instead of snapping to raw sensor noise.
// ---------------------------------------------------------------------

let camera, scene, renderer, video, stream;
let decorationMeshes = [];
const _targetQuaternion = new THREE.Quaternion();
const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around x
let haveOrientation = false;

async function startCompassFallback() {
  currentMode = 'compass-fallback (less stable — no WebXR on this browser)';

  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

  enterArUI();
  resolveDecorationCoordinates();

  video = document.createElement('video');
  video.srcObject = stream;
  video.setAttribute('playsinline', true);
  video.play();

  video.addEventListener('loadedmetadata', () => {
    initFallbackScene();
    addOrientationListeners();
    watchGeolocation();
    animateFallback();
    updateDebugOverlay();
  });
}

function initFallbackScene() {
  scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.rotation.reorder('YXZ');
  camera.position.set(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, depthTest: false, depthWrite: false });
  const videoMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), videoMaterial);
  videoMesh.position.set(0, 0, -2);
  videoMesh.renderOrder = -1;
  camera.add(videoMesh); // child of camera so it always fills the frame
  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  decorationMeshes = christmasDecorations.map(d => {
    const mesh = createDecorationMesh(d.type, d.color, d.scale);
    mesh.userData = d;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  window.addEventListener('resize', onWindowResize);
}

function watchGeolocation() {
  navigator.geolocation.watchPosition(
    (position) => {
      currentPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      updateDecorationPositions();
      updateDebugOverlay();
    },
    (error) => setError('geolocation', error.message || error),
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

function updateDecorationPositions() {
  if (!currentPosition) return;
  decorationMeshes.forEach(mesh => {
    const d = mesh.userData;
    const distance = calculateDistance(currentPosition.lat, currentPosition.lon, d.lat, d.lon);
    const bearing = calculateBearing(currentPosition.lat, currentPosition.lon, d.lat, d.lon);
    const bearingRad = bearing * DEG2RAD;

    mesh.position.set(
      Math.sin(bearingRad) * distance,
      -0.5,
      -Math.cos(bearingRad) * distance
    );
    mesh.visible = true;
  });
}

function setTargetOrientation(alpha, beta, gamma) {
  const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  _euler.set(beta * DEG2RAD, alpha * DEG2RAD, -gamma * DEG2RAD, 'YXZ');
  _targetQuaternion.setFromEuler(_euler);
  _targetQuaternion.multiply(_q1);
  _targetQuaternion.multiply(_q0.setFromAxisAngle(_zee, -screenAngle * DEG2RAD));
  haveOrientation = true;
}

function addOrientationListeners() {
  let usingAbsolute = false;

  window.addEventListener('deviceorientationabsolute', (event) => {
    if (event.alpha === null) return;
    usingAbsolute = true;
    setTargetOrientation(event.alpha, event.beta || 0, event.gamma || 0);
  });

  window.addEventListener('deviceorientation', (event) => {
    if (event.alpha === null || usingAbsolute) return;
    setTargetOrientation(event.alpha, event.beta || 0, event.gamma || 0);
  });
}

function onWindowResize() {
  if (!camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animateFallback() {
  requestAnimationFrame(animateFallback);

  // Damp toward the latest sensor reading instead of snapping straight to
  // it — this is what smooths out magnetometer jitter frame to frame.
  if (haveOrientation) {
    camera.quaternion.slerp(_targetQuaternion, 0.2);
  }

  decorationMeshes.forEach(m => {
    if (m.userData.id.includes('star') && m.visible) m.rotation.y += 0.005;
  });

  renderer.render(scene, camera);
}
