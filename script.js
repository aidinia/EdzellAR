let camera, scene, renderer, cube;
let video;
let opencvReady = false;
let horizontalLines = [];
let cubeVelocity = { x: 0, y: -0.005, z: 0 }; // Falling cube
let gravity = -0.0002;

const startButton = document.getElementById('startAR');
const arContainer = document.getElementById('arContainer');
const canvas = document.getElementById('arCanvas');

startButton.addEventListener('click', startAR);

// OpenCV ready callback
window.onOpenCvReady = function() {
  console.log('OpenCV.js is ready');
  opencvReady = true;
};

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

  // Create the AR cube (0.2m x 0.2m x 0.2m)
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8
  });
  cube = new THREE.Mesh(geometry, material);

  // Position cube 1 meter in front of camera
  cube.position.set(0, 0.3, -1);
  scene.add(cube);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
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

function updateCubePhysics() {
  if (!cube) return;

  // Apply gravity
  cubeVelocity.y += gravity;

  // Update position
  cube.position.x += cubeVelocity.x;
  cube.position.y += cubeVelocity.y;
  cube.position.z += cubeVelocity.z;

  // Check collision with horizontal lines
  const cubeBottom = cube.position.y - 0.1; // Bottom of cube (half of height)

  for (let line of horizontalLines) {
    // Check if cube is near the line's Y position
    if (Math.abs(cubeBottom - line.y) < 0.05 && cubeVelocity.y < 0) {
      // Bounce!
      cubeVelocity.y = -cubeVelocity.y * 0.8; // Reverse velocity with dampening
      cube.position.y = line.y + 0.1; // Reset position to be on the line

      // Change cube color briefly to show collision
      cube.material.color.setHex(0xff0000);
      setTimeout(() => {
        cube.material.color.setHex(0x00ff00);
      }, 100);

      break;
    }
  }

  // Keep cube within bounds
  if (cube.position.y < -0.8) {
    cube.position.y = -0.8;
    cubeVelocity.y = -cubeVelocity.y * 0.8;
  }

  if (cube.position.y > 0.8) {
    cube.position.y = 0.8;
    cubeVelocity.y = 0;
  }

  // Rotate the cube
  cube.rotation.x += 0.02;
  cube.rotation.y += 0.02;
}

function animate() {
  requestAnimationFrame(animate);

  // Detect horizontal lines every few frames for performance
  if (Math.random() < 0.1) { // 10% of frames
    horizontalLines = detectHorizontalLines();
  }

  // Update cube physics and check collisions
  updateCubePhysics();

  renderer.render(scene, camera);
}
