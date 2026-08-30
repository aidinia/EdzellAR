// AR Christmas Decorations — "Best of Worlds"
//
// Primary mode: camera feed + GPS + compass (works on Android AND iOS,
// unlike raw WebXR AR which iOS Safari still doesn't support as of 2026).
// Optional mode: real WebXR hit-testing for precise tap-to-place, offered
// only on devices/browsers that actually support it (mainly Android/ARCore).
//
// Bugs fixed relative to the original root/mixed versions this was built
// from:
//  - The compass listener used to freeze after its first reading; it now
//    updates continuously.
//  - The camera never actually rotated — decorations were swung around a
//    static camera via ad-hoc trigonometry, while the live video background
//    stayed fixed, so the overlay and the real world could drift apart. The
//    camera now has a real orientation (device-orientation quaternion, the
//    same technique three.js's own DeviceOrientationControls uses), and the
//    video plane is a child of the camera so it always fills the frame.
//  - Decoration coordinates were hardcoded to one absolute location. They're
//    now generated relative to wherever the session starts (see
//    decorations.js), so the demo works whichever real spot you test it in.
//  - iOS 13+ requires an explicit user-gesture permission prompt for motion
//    /orientation sensors; the original code never requested it, so compass
//    data silently never arrived on iOS. That request is now made on the
//    Start button tap.
//  - Removed a leftover unused OpenCV.js include that referenced an
//    undefined onload handler.

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6371e3;

let camera, scene, renderer, videoMesh, video, stream;
let debugEl;
let decorationMeshes = [];
let currentPosition = null; // { lat, lon, accuracy }
let sessionOrigin = null;   // first GPS fix, used to resolve relative decoration offsets
let lastError = '';
let orientationSource = 'none'; // 'absolute' | 'relative' | 'none'

const startButton = document.getElementById('startAR');
const precisionButton = document.getElementById('startPrecisionAR');
const unsupportedMsg = document.getElementById('unsupportedMsg');
const startScreen = document.getElementById('startScreen');
const arContainer = document.getElementById('arContainer');
const canvas = document.getElementById('arCanvas');

startButton.addEventListener('click', startAR);
precisionButton.addEventListener('click', startPrecisionAR);

// Offer the WebXR precision button only where it's actually usable.
(async function checkPrecisionSupport() {
  if (navigator.xr && navigator.xr.isSessionSupported) {
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      if (supported) {
        precisionButton.hidden = false;
        return;
      }
    } catch (e) {
      // fall through to unsupported message
    }
  }
  unsupportedMsg.hidden = false;
})();

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

// Given a start point, a bearing (degrees from true north) and a distance
// (meters), return the destination lat/lon. This is what lets decorations
// be authored as "3m, bearing 60°" instead of a hardcoded lat/lon.
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

// ---------------------------------------------------------------------
// Debug overlay — so failures are visible on-device without needing
// remote debugging tools.
// ---------------------------------------------------------------------

function updateDebugOverlay(mode) {
  if (!debugEl) return;
  const lines = [];
  lines.push(`mode: ${mode}`);
  if (currentPosition) {
    lines.push(`gps: ${currentPosition.lat.toFixed(6)}, ${currentPosition.lon.toFixed(6)} (±${Math.round(currentPosition.accuracy)}m)`);
  } else {
    lines.push('gps: waiting for fix...');
  }
  lines.push(`orientation: ${orientationSource}`);
  lines.push(`decorations placed: ${decorationMeshes.length}`);
  if (lastError) lines.push(`<span class="err">error: ${lastError}</span>`);
  debugEl.innerHTML = lines.join('\n');
}

function setError(context, err) {
  lastError = `${context}: ${err && err.message ? err.message : err}`;
  console.error(context, err);
  updateDebugOverlay(currentMode);
}

let currentMode = 'gps';

// ---------------------------------------------------------------------
// Mode 1: camera feed + GPS + compass (primary, broad device support)
// ---------------------------------------------------------------------

async function startAR() {
  currentMode = 'gps';
  startButton.disabled = true;

  try {
    // iOS 13+ requires an explicit permission prompt for motion/orientation
    // sensors, triggered from a user gesture. Ask for it before anything
    // else so we don't silently lose compass data on iOS.
    await requestOrientationPermission();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    startScreen.hidden = true;
    arContainer.hidden = false;
    debugEl = document.getElementById('debugOverlay');

    video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    video.play();

    video.addEventListener('loadedmetadata', () => {
      initThreeJS();
      addOrientationListeners();
      startGeolocation();
      animate();
      updateDebugOverlay(currentMode);
    });
  } catch (error) {
    setError('startAR', error);
    alert('Could not start AR: ' + (error.message || error));
    startButton.disabled = false;
  }
}

async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const result = await DeviceOrientationEvent.requestPermission();
    if (result !== 'granted') {
      throw new Error('Motion/orientation permission denied');
    }
  }
  // Non-iOS browsers: no explicit permission step needed.
}

function initThreeJS() {
  scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.rotation.reorder('YXZ');
  camera.position.set(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Video background is a CHILD of the camera at a fixed local offset, so
  // it always fills the frame regardless of how the camera rotates. (In
  // the original version the background never rotated with the phone at
  // all, which is why the overlay and the live feed could feel out of
  // sync with each other.)
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, depthTest: false, depthWrite: false });
  const videoGeometry = new THREE.PlaneGeometry(4, 4);
  videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
  videoMesh.position.set(0, 0, -2);
  videoMesh.renderOrder = -1;
  camera.add(videoMesh);
  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  createDecorations();

  window.addEventListener('resize', onWindowResize);
}

function createDecorations() {
  decorationMeshes.forEach(mesh => scene.remove(mesh));
  decorationMeshes = [];

  christmasDecorations.forEach(decoration => {
    const mesh = createDecorationMesh(decoration.type, decoration.color, decoration.scale);
    mesh.userData = decoration;
    mesh.visible = false; // shown once we can compute a real position
    decorationMeshes.push(mesh);
    scene.add(mesh);
  });
}

// Resolve each decoration's absolute lat/lon from its {distance, bearing}
// offset, anchored to wherever the session started.
function resolveDecorationCoordinates() {
  decorationMeshes.forEach(mesh => {
    const d = mesh.userData;
    if (d._resolved) return;
    const dest = destinationPoint(sessionOrigin.lat, sessionOrigin.lon, d.distance, d.bearing);
    d.lat = dest.lat;
    d.lon = dest.lon;
    d._resolved = true;
  });
}

function startGeolocation() {
  if (!navigator.geolocation) {
    setError('geolocation', 'not supported on this browser');
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      currentPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      if (!sessionOrigin) {
        sessionOrigin = { lat: currentPosition.lat, lon: currentPosition.lon };
        resolveDecorationCoordinates();
      }

      updateDecorationPositions();
      updateDebugOverlay(currentMode);
    },
    (error) => {
      setError('geolocation', error.message || error);
    },
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

// Places each decoration at a FIXED position in world space, computed from
// real GPS distance/bearing to the user's current position. Unlike the
// original version, this does not need to run every animation frame or
// re-derive an ad-hoc "relative angle" — the camera itself rotates via
// device orientation, so normal 3D projection/culling makes objects appear
// and disappear correctly as you turn or walk, the same way it would with
// any other fixed-in-world 3D object.
function updateDecorationPositions() {
  if (!currentPosition || !sessionOrigin) return;

  decorationMeshes.forEach(mesh => {
    const d = mesh.userData;
    if (!d._resolved) return;

    const distance = calculateDistance(currentPosition.lat, currentPosition.lon, d.lat, d.lon);
    const bearing = calculateBearing(currentPosition.lat, currentPosition.lon, d.lat, d.lon);
    const bearingRad = bearing * DEG2RAD;

    // World convention: -Z = true north (matches the device-orientation
    // quaternion convention used in setCameraOrientation()).
    const x = Math.sin(bearingRad) * distance;
    const z = -Math.cos(bearingRad) * distance;

    mesh.position.set(x, -0.5, z);
    mesh.visible = true;
  });
}

// ---------------------------------------------------------------------
// Device orientation -> camera rotation (continuous, unlike the original
// version's one-shot fallback listener).
// ---------------------------------------------------------------------

const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around x

function setCameraOrientation(alpha, beta, gamma) {
  if (!camera) return;
  const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;

  _euler.set(beta * DEG2RAD, alpha * DEG2RAD, -gamma * DEG2RAD, 'YXZ');
  camera.quaternion.setFromEuler(_euler);
  camera.quaternion.multiply(_q1);
  camera.quaternion.multiply(_q0.setFromAxisAngle(_zee, -screenAngle * DEG2RAD));
}

function addOrientationListeners() {
  let usingAbsolute = false;

  window.addEventListener('deviceorientationabsolute', (event) => {
    if (event.alpha === null) return;
    usingAbsolute = true;
    orientationSource = 'absolute';
    setCameraOrientation(event.alpha, event.beta || 0, event.gamma || 0);
  });

  window.addEventListener('deviceorientation', (event) => {
    if (event.alpha === null || usingAbsolute) return; // prefer absolute when available
    orientationSource = event.absolute ? 'absolute' : 'relative';
    setCameraOrientation(event.alpha, event.beta || 0, event.gamma || 0);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (decorationMeshes.some(m => m.userData.id.includes('star'))) {
    decorationMeshes.forEach(m => {
      if (m.userData.id.includes('star') && m.visible) m.rotation.y += 0.005;
    });
  }
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------
// Mode 2 (optional): real WebXR hit-testing for precise tap-to-place,
// adapted from the arcore/ version. Offered only when the browser reports
// 'immersive-ar' + hit-test support (mainly Android/ARCore today).
// ---------------------------------------------------------------------

let xrSession = null;
let xrRefSpace = null;
let xrHitTestSource = null;
let xrScene, xrCamera, xrRenderer, xrReticle;
let placedCount = 0;

async function startPrecisionAR() {
  currentMode = 'webxr';
  precisionButton.disabled = true;

  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body }
    });

    startScreen.hidden = true;
    arContainer.hidden = false;
    debugEl = document.getElementById('debugOverlay');
    updateDebugOverlay(currentMode);

    initXRScene();
    xrSession.addEventListener('end', onXRSessionEnded);
    xrSession.addEventListener('select', onXRSelect);

    document.body.appendChild(xrRenderer.domElement);
    await xrRenderer.xr.setSession(xrSession);

    xrRefSpace = await xrSession.requestReferenceSpace('local');
    const viewerSpace = await xrSession.requestReferenceSpace('viewer');
    xrHitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });

    xrSession.requestAnimationFrame(onXRFrame);
  } catch (error) {
    setError('startPrecisionAR', error);
    alert('Could not start precision AR: ' + (error.message || error));
    precisionButton.disabled = false;
  }
}

function initXRScene() {
  xrScene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  xrScene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(0, 1, 1);
  xrScene.add(directionalLight);

  // Simple ring reticle — no external glTF fetch required, so it can't
  // fail due to a blocked/slow third-party asset load.
  const reticleGeometry = new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2);
  const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  xrReticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
  xrReticle.visible = false;
  xrReticle.matrixAutoUpdate = false;
  xrScene.add(xrReticle);

  xrRenderer = new THREE.WebGLRenderer({ alpha: true, canvas: document.createElement('canvas') });
  xrRenderer.autoClear = false;
  xrRenderer.xr.enabled = true;

  xrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  xrCamera.matrixAutoUpdate = false;
}

function onXRSelect() {
  if (!xrReticle.visible) return;

  // Cycle through decoration types so repeated taps place different objects.
  const types = christmasDecorations.map(d => d.type);
  const type = types[placedCount % types.length];
  const color = christmasDecorations[placedCount % christmasDecorations.length].color;

  const mesh = createDecorationMesh(type, color, '5 5 5');
  mesh.position.setFromMatrixPosition(xrReticle.matrix);
  xrScene.add(mesh);
  placedCount++;
  updateDebugOverlay(currentMode);
}

function onXRFrame(time, frame) {
  const session = frame.session;
  session.requestAnimationFrame(onXRFrame);

  if (xrHitTestSource) {
    const hitTestResults = frame.getHitTestResults(xrHitTestSource);
    if (hitTestResults.length > 0) {
      const pose = hitTestResults[0].getPose(xrRefSpace);
      xrReticle.visible = true;
      xrReticle.matrix.fromArray(pose.transform.matrix);
    } else {
      xrReticle.visible = false;
    }
  }

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
  precisionButton.disabled = false;
}
