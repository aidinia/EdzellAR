let camera, scene, renderer, textMesh, shapeMesh, treeMesh;
let video;
let latitude = 'Loading...';
let longitude = 'Loading...';
let longitudeValue = 0;
let deviceHeading = 0; // Compass heading in degrees

const startButton = document.getElementById('startAR');
const arContainer = document.getElementById('arContainer');
const canvas = document.getElementById('arCanvas');

startButton.addEventListener('click', startAR);

// Get device orientation (compass)
function getOrientation() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientationabsolute', (event) => {
      if (event.alpha !== null) {
        deviceHeading = event.alpha; // 0-360 degrees, 0 is North
        updateTreePosition();
      }
    });

    // Fallback for devices without absolute orientation
    window.addEventListener('deviceorientation', (event) => {
      if (event.alpha !== null && deviceHeading === 0) {
        deviceHeading = 360 - event.alpha; // Adjust for standard compass
        updateTreePosition();
      }
    });
  }
}

// Get device location
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        latitude = position.coords.latitude.toFixed(6);
        longitude = position.coords.longitude.toFixed(6);
        longitudeValue = position.coords.longitude;
        updateTextMesh();
        updateShape();
      },
      (error) => {
        console.error('Error getting location:', error);
        latitude = 'N/A';
        longitude = 'N/A';
        longitudeValue = 0;
        updateTextMesh();
        updateShape();
      },
      { enableHighAccuracy: true }
    );
  } else {
    latitude = 'N/A';
    longitude = 'N/A';
    longitudeValue = 0;
    console.error('Geolocation is not supported');
  }
}

async function startAR() {
  try {
    // Request camera permission and access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    // Hide button and show AR container
    startButton.style.display = 'none';
    arContainer.style.display = 'block';

    // Create video element for camera feed
    video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    video.play();

    // Wait for video to be ready
    video.addEventListener('loadedmetadata', () => {
      initThreeJS();
      getLocation();
      getOrientation();
      animate();
    });

  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('Could not access camera. Please ensure you have granted camera permissions.');
    startButton.style.display = 'block';
  }
}

function initThreeJS() {
  // Set up scene
  scene = new THREE.Scene();

  // Set up camera (perspective camera for 3D view)
  const aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(0, 0, 0);

  // Set up renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Create video texture for background
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const videoGeometry = new THREE.PlaneGeometry(2, 2);
  const videoMaterial = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide
  });
  const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
  videoMesh.position.z = -2;
  scene.add(videoMesh);

  // Create initial text mesh
  createTextMesh();

  // Create initial shape
  createShape();

  // Create tree
  createTree();

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

function createTextMesh() {
  // Create canvas for text texture
  const textCanvas = document.createElement('canvas');
  const context = textCanvas.getContext('2d');
  textCanvas.width = 1024;
  textCanvas.height = 512;

  // Draw text on canvas
  context.fillStyle = '#00ff00';
  context.font = 'bold 60px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const text = `Lat: ${latitude}\nLon: ${longitude}`;
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    context.fillText(line, textCanvas.width / 2, textCanvas.height / 2 - 40 + index * 80);
  });

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(textCanvas);

  // Create sprite material with the texture
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9
  });

  // Remove old text mesh if it exists
  if (textMesh) {
    const oldPosition = textMesh.position.clone();
    scene.remove(textMesh);

    // Create sprite (always faces camera)
    textMesh = new THREE.Sprite(spriteMaterial);
    textMesh.scale.set(0.8, 0.4, 1);
    textMesh.position.copy(oldPosition);
    scene.add(textMesh);
  } else {
    // Create sprite (always faces camera)
    textMesh = new THREE.Sprite(spriteMaterial);
    textMesh.scale.set(0.8, 0.4, 1);
    textMesh.position.set(0, 0, -1);
    scene.add(textMesh);
  }
}

function updateTextMesh() {
  if (!textMesh) return;
  createTextMesh();
}

function createShape() {
  // Remove old shape if it exists
  if (shapeMesh) {
    scene.remove(shapeMesh);
  }

  let geometry;

  // Check longitude value to decide shape
  if (longitudeValue < -2.61900) {
    // Create cube
    geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  } else {
    // Create sphere
    geometry = new THREE.SphereGeometry(0.1, 32, 32);
  }

  const material = new THREE.MeshPhongMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.8
  });

  shapeMesh = new THREE.Mesh(geometry, material);
  shapeMesh.position.set(0, -0.3, -1); // Below the text
  scene.add(shapeMesh);
}

function updateShape() {
  if (!scene) return;
  createShape();
}

function createTree() {
  // Remove old tree if it exists
  if (treeMesh) {
    scene.remove(treeMesh);
  }

  // Create a group to hold tree parts
  treeMesh = new THREE.Group();

  // Create trunk (brown cylinder)
  const trunkGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 8);
  const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 0.2; // Raise trunk up
  treeMesh.add(trunk);

  // Create foliage (green cone/sphere layers)
  const foliageGeometry1 = new THREE.ConeGeometry(0.15, 0.3, 8);
  const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
  const foliage1 = new THREE.Mesh(foliageGeometry1, foliageMaterial);
  foliage1.position.y = 0.5;
  treeMesh.add(foliage1);

  const foliageGeometry2 = new THREE.ConeGeometry(0.12, 0.25, 8);
  const foliage2 = new THREE.Mesh(foliageGeometry2, foliageMaterial);
  foliage2.position.y = 0.7;
  treeMesh.add(foliage2);

  const foliageGeometry3 = new THREE.ConeGeometry(0.09, 0.2, 8);
  const foliage3 = new THREE.Mesh(foliageGeometry3, foliageMaterial);
  foliage3.position.y = 0.85;
  treeMesh.add(foliage3);

  // Position tree 1 meter south (will be updated based on orientation)
  updateTreePosition();

  scene.add(treeMesh);
}

function updateTreePosition() {
  if (!treeMesh) return;

  // South is 180 degrees
  // Calculate the angle to place tree 1 meter south
  const southAngle = 180;

  // Calculate offset based on device heading
  // We want the tree to be south relative to real-world, not device
  const angleToSouth = (southAngle - deviceHeading) * (Math.PI / 180);

  // Place tree 1 meter away in the south direction
  const distance = 1;
  const x = Math.sin(angleToSouth) * distance;
  const z = -Math.cos(angleToSouth) * distance - 1; // -1 to account for camera offset

  treeMesh.position.set(x, -0.5, z);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  // Rotate the shape for visual effect
  if (shapeMesh) {
    shapeMesh.rotation.x += 0.01;
    shapeMesh.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
}
