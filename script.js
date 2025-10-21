let camera, scene, renderer, textMesh;
let video;
let opencvReady = false;
let horizontalLines = [];
let textVelocity = { x: 0, y: -0.005, z: 0 }; // Falling text
let gravity = -0.0002;
let latitude = 'Loading...';
let longitude = 'Loading...';

const startButton = document.getElementById('startAR');
const arContainer = document.getElementById('arContainer');
const canvas = document.getElementById('arCanvas');

startButton.addEventListener('click', startAR);

// OpenCV ready callback
window.onOpenCvReady = function() {
  console.log('OpenCV.js is ready');
  opencvReady = true;
};

// Get device location
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        latitude = position.coords.latitude.toFixed(6);
        longitude = position.coords.longitude.toFixed(6);
        updateTextMesh();
      },
      (error) => {
        console.error('Error getting location:', error);
        latitude = 'N/A';
        longitude = 'N/A';
        updateTextMesh();
      },
      { enableHighAccuracy: true }
    );
  } else {
    latitude = 'N/A';
    longitude = 'N/A';
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
    scene.remove(textMesh);
  }

  // Create sprite (always faces camera)
  textMesh = new THREE.Sprite(spriteMaterial);
  textMesh.scale.set(0.8, 0.4, 1);
  textMesh.position.set(0, 0.3, -1);
  scene.add(textMesh);
}

function updateTextMesh() {
  if (!textMesh) return;
  createTextMesh();
  // Preserve the current position and velocity
  if (textMesh) {
    textMesh.position.y = textMesh.position.y || 0.3;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function detectHorizontalLines() {
  if (!opencvReady || !video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    return [];
  }

  try {
    // Create a temporary canvas to process the video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    // Convert to OpenCV Mat
    const src = cv.imread(tempCanvas);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const lines = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Edge detection
    cv.Canny(gray, edges, 50, 150, 3);

    // Detect lines using Hough Transform
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);

    const detectedLines = [];

    // Filter for horizontal lines
    for (let i = 0; i < lines.rows; ++i) {
      const startX = lines.data32S[i * 4];
      const startY = lines.data32S[i * 4 + 1];
      const endX = lines.data32S[i * 4 + 2];
      const endY = lines.data32S[i * 4 + 3];

      const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

      // Filter for horizontal lines (angle close to 0 or 180 degrees)
      if ((angle > -10 && angle < 10) || (angle > 170 || angle < -170)) {
        // Normalize coordinates to range [-1, 1] for 3D space
        const normalizedY = -((startY + endY) / 2 / video.videoHeight * 2 - 1) * 0.7;
        detectedLines.push({
          y: normalizedY,
          startX: startX,
          endX: endX,
          midY: (startY + endY) / 2
        });
      }
    }

    // Clean up
    src.delete();
    gray.delete();
    edges.delete();
    lines.delete();

    return detectedLines;

  } catch (error) {
    console.error('Error in line detection:', error);
    return [];
  }
}

function updateTextPhysics() {
  if (!textMesh) return;

  // Apply gravity
  textVelocity.y += gravity;

  // Update position
  textMesh.position.x += textVelocity.x;
  textMesh.position.y += textVelocity.y;
  textMesh.position.z += textVelocity.z;

  // Check collision with horizontal lines
  const textBottom = textMesh.position.y - 0.2; // Bottom of text (half of height)

  for (let line of horizontalLines) {
    // Check if text is near the line's Y position
    if (Math.abs(textBottom - line.y) < 0.05 && textVelocity.y < 0) {
      // Bounce!
      textVelocity.y = -textVelocity.y * 0.8; // Reverse velocity with dampening
      textMesh.position.y = line.y + 0.2; // Reset position to be on the line

      // Change text color briefly to show collision
      textMesh.material.color.setHex(0xff0000);
      setTimeout(() => {
        // Recreate the text with original color
        createTextMesh();
      }, 100);

      break;
    }
  }

  // Keep text within bounds
  if (textMesh.position.y < -0.8) {
    textMesh.position.y = -0.8;
    textVelocity.y = -textVelocity.y * 0.8;
  }

  if (textMesh.position.y > 0.8) {
    textMesh.position.y = 0.8;
    textVelocity.y = 0;
  }
}

function animate() {
  requestAnimationFrame(animate);

  // Detect horizontal lines every few frames for performance
  if (Math.random() < 0.1) { // 10% of frames
    horizontalLines = detectHorizontalLines();
  }

  // Update text physics and check collisions
  updateTextPhysics();

  renderer.render(scene, camera);
}
