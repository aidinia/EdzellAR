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
const dbgNearest = document.getElementById('dbg-nearest');
const collectCounter = document.getElementById('collect-counter');
const collectCountEl = document.getElementById('collect-count');
const collectTotalEl = document.getElementById('collect-total');

// Resets every page load by design (no localStorage) — see the
// conversation/commit history for why persistence was deliberately left out.
const collectedIds = new Set();

const COLLECTED_OPACITY = 0.35;

function collectDecoration(deco, el) {
  if (collectedIds.has(deco.id)) return; // already collected, ignore repeat taps
  collectedIds.add(deco.id);
  collectCountEl.textContent = collectedIds.size;

  const label = el.querySelector('a-text');
  if (label) {
    label.setAttribute('value', deco.label + ' ✓');
    label.setAttribute('color', '#7ef7a0');
  }

  if (deco.model) {
    // A .glb's materials live inside its own loaded scene graph, not on a
    // component A-Frame's `material` can reach — a tap can only land on
    // already-loaded geometry (that's what the raycaster hit), so the mesh
    // is guaranteed to exist here. Each entity gets its own freshly-parsed
    // materials even when two decorations share the same model file, so
    // this can't accidentally dim another decoration too.
    const root = el.getObject3D('mesh');
    if (root) {
      root.traverse((node) => {
        if (!node.material) return;
        (Array.isArray(node.material) ? node.material : [node.material]).forEach((mat) => {
          mat.transparent = true;
          mat.opacity = COLLECTED_OPACITY;
        });
      });
    }
  } else {
    // Placeholder shapes have A-Frame's own material component, so this is
    // just a normal attribute.
    el.setAttribute('material', `opacity: ${COLLECTED_OPACITY}; transparent: true`);
  }
}

// Haversine distance in meters — used only for the debug readout below, to
// answer "am I even close enough to any decoration to see it?" without
// having to manually compare lat/lon by eye.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A-Frame's default look-controls applies raw compass/gyro readings to the
// camera every frame with no filtering at all, so any sensor noise (there's
// always some — magnetometer interference, hand tremor) shows up directly
// as visible shake. This damps rotation by blending toward the real
// reading each frame instead of snapping straight to it — smoother, at the
// cost of a little lag when you turn quickly. Lower `damping` = smoother
// but laggier; 1 = no smoothing at all.
AFRAME.registerComponent('smooth-rotation', {
  schema: { damping: { default: 0.2 } },
  init: function () {
    this.smoothed = new THREE.Quaternion();
    this.ready = false;
  },
  tick: function () {
    const q = this.el.object3D.quaternion;
    if (!this.ready) {
      this.smoothed.copy(q);
      this.ready = true;
      return;
    }
    this.smoothed.slerp(q, this.data.damping);
    q.copy(this.smoothed);
  }
});

// A more surgical alternative to aframe-extras' animation-mixer, for a
// model where one specific bone's motion needs removing without losing the
// rest of the animation (e.g. a root/torso bone whose own rotation spins
// the whole model, while every other bone's motion — wings, legs, head —
// should keep playing). `clip` picks one named clip instead of the
// generic component's default of playing every clip at once (which can
// look chaotic if a model ships several, as this one does). `excludeNode`
// drops any track targeting that node by name (matched by GLTFLoader's
// `NodeName.property` track naming) before the clip ever plays.
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
  // gpsMinDistance: only recompute position after moving this many meters —
  // was 2, which is *more* twitchy than AR.js's own default (5); raised to
  // smooth out GPS noise while standing still.
  // positionMinAccuracy: ignore any GPS reading reporting worse than this
  // many meters of accuracy — defaults to 100 (barely filters anything),
  // which let noisy/bad fixes constantly jump the decorations around. This
  // is the main fix for "shaky" placement.
  // alert: shows AR.js's built-in "GPS signal is very poor" banner
  // whenever readings are being rejected, so it's obvious *why* things
  // aren't moving rather than it looking frozen/broken.
  // maxDistance: hides any decoration farther than this many meters away —
  // NOT real occlusion (AR.js has no idea a house/wall exists and can't
  // block line of sight to something behind one), just a visibility
  // radius so far-off decorations don't clutter the view. Tune this
  // per how spread out your decorations end up being.
  camera.setAttribute('gps-camera', 'gpsMinDistance: 8; positionMinAccuracy: 25; alert: true; maxDistance: 30');
  camera.setAttribute('rotation-reader', '');
  camera.setAttribute('smooth-rotation', '');
  // Turns a screen tap into a 3D ray from the camera through that screen
  // point (rayOrigin: mouse), tested against any entity with the
  // 'collectible' class — the standard A-Frame idiom for tap-to-interact.
  // Mobile browsers fire the necessary synthetic mouse/click events from a
  // real touch tap on their own; nothing else needed for that to work.
  camera.setAttribute('raycaster', 'objects: .collectible');
  camera.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
  // AR.js dispatches this on `window`, not on the camera entity — it's a
  // plain window.dispatchEvent(new CustomEvent(...)) internally, which does
  // NOT bubble down to any element. Listening on `camera` here silently
  // never fired, which is why the debug panel stayed blank.
  window.addEventListener('gps-camera-update-position', (e) => {
    const { latitude, longitude, accuracy } = e.detail.position;
    dbgLat.textContent = latitude.toFixed(6);
    dbgLon.textContent = longitude.toFixed(6);
    if (accuracy) dbgAcc.textContent = Math.round(accuracy);

    let nearest = null;
    decorations.forEach((deco) => {
      const d = distanceMeters(latitude, longitude, deco.lat, deco.lon);
      if (!nearest || d < nearest.d) nearest = { d, deco };
    });
    if (nearest) {
      dbgNearest.textContent = `${nearest.deco.label} — ${Math.round(nearest.d)} m away`;
    }
  });
  scene.appendChild(camera);

  decorations.forEach((deco) => scene.appendChild(buildDecorationEntity(deco)));
  // NOTE: this is just the count of decorations queued into the scene, not
  // confirmation any of them actually placed near you — gps-entity-place
  // positions each one relative to your real GPS fix, which only exists
  // once "lat"/"lon" above are populated. Compare those against the
  // coordinates in decorations.js: if you're not within visual range of
  // those placeholder points, nothing will appear on screen.
  dbgCount.textContent = decorations.length;

  collectTotalEl.textContent = decorations.length;
  collectCounter.hidden = false;

  sceneContainer.appendChild(scene);
}

function buildDecorationEntity(deco) {
  let el;
  if (deco.model) {
    // Real Sketchfab (or any other) .glb/.gltf model — A-Frame's built-in
    // gltf-model component loads it, no extra library needed. Sketchfab
    // exports aren't guaranteed to come out at any particular real-world
    // size, so `scale` is still per-decoration and usually needs tuning by
    // eye once you see it in AR.
    el = document.createElement('a-entity');
    el.setAttribute('gltf-model', `url(${deco.model})`);
    if (deco.rotation) el.setAttribute('rotation', deco.rotation);
    // gltf-model on its own loads a static mesh and never plays any
    // animation embedded in the file — one of the two mixers below (loaded
    // via aframe-extras in index.html, or filtered-animation-mixer above)
    // is what actually drives that.
    if (deco.animation) {
      // Needs surgery: a specific clip and/or a specific bone's motion
      // excluded (e.g. a root bone whose rotation spins the whole model).
      el.setAttribute('filtered-animation-mixer', deco.animation);
    } else if (deco.animate !== false) {
      // Default: play every clip found, looped — fine for a decoration
      // that either has one obvious animation or none at all; harmless to
      // set on a model with no animations. `animate: false` opts out
      // entirely instead.
      el.setAttribute('animation-mixer', '');
    }
  } else {
    // Phase 1 fallback: deco.shape -> an A-Frame primitive tag (a-box,
    // a-sphere, a-cone, ...). Lets decorations be swapped to real models
    // one at a time — anything without a `model` field still renders as
    // its placeholder shape.
    el = document.createElement('a-' + deco.shape);
    el.setAttribute('color', deco.color);
  }
  el.setAttribute('scale', deco.scale);
  el.setAttribute('gps-entity-place', `latitude: ${deco.lat}; longitude: ${deco.lon};`);
  el.classList.add('collectible');
  el.addEventListener('click', () => collectDecoration(deco, el));

  const label = document.createElement('a-text');
  label.setAttribute('value', deco.label);
  label.setAttribute('align', 'center');
  label.setAttribute('color', '#ffffff');
  label.setAttribute('position', '0 2 0');
  label.setAttribute('scale', '4 4 4');
  el.appendChild(label);

  return el;
}
