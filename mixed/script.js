let camera, scene, renderer, textMesh, shapeMesh, treeMesh;
let video;
let latitude = 'Loading...';
let longitude = 'Loading...';
let longitudeValue = 0;
let latitudeValue = 0;
let deviceHeading = 0; // Compass heading in degrees
let decorationMeshes = []; // Array to store decoration meshes

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
        updateDecorations();
      }
    });

    // Fallback for devices without absolute orientation
    window.addEventListener('deviceorientation', (event) => {
      if (event.alpha !== null && deviceHeading === 0) {
        deviceHeading = 360 - event.alpha; // Adjust for standard compass
        updateTreePosition();
        updateDecorations();
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
        latitudeValue = position.coords.latitude;
        updateTextMesh();
        updateShape();
        updateDecorations();
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

  // Create decorations from decorations.js
  createDecorations();

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

// Calculate distance between two GPS coordinates (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Calculate bearing between two GPS coordinates (in degrees)
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360; // Convert to degrees and normalize
}

// Create Three.js mesh for a decoration type
function createDecorationMesh(type, color, scale) {
  const group = new THREE.Group();

  // Parse scale values
  const scaleValues = scale.split(' ').map(s => parseFloat(s) * 0.01); // Scale down for AR view
  const scaleX = scaleValues[0] || 0.1;
  const scaleY = scaleValues[1] || 0.1;
  const scaleZ = scaleValues[2] || 0.1;

  const colorHex = parseInt(color.replace('#', '0x'));

  switch(type) {
    case 'tree':
      // Create tree with cones and cylinder
      const foliage1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 * scaleX, 0.6 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      foliage1.position.y = 0;
      group.add(foliage1);

      const foliage2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.25 * scaleX, 0.5 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      foliage2.position.y = -0.15 * scaleY;
      group.add(foliage2);

      const foliage3 = new THREE.Mesh(
        new THREE.ConeGeometry(0.3 * scaleX, 0.4 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      foliage3.position.y = -0.25 * scaleY;
      group.add(foliage3);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scaleX, 0.05 * scaleX, 0.2 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: 0x8b4513 })
      );
      trunk.position.y = -0.5 * scaleY;
      group.add(trunk);

      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scaleX, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xffd700 })
      );
      star.position.y = 0.3 * scaleY;
      group.add(star);
      break;

    case 'santa':
      // Create Santa with spheres
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      body.position.y = 0;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xffc0cb })
      );
      head.position.y = 0.2 * scaleY;
      group.add(head);

      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.1 * scaleX, 0.2 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      hat.position.y = 0.35 * scaleY;
      group.add(hat);
      break;

    case 'snowman':
      // Create snowman with three spheres
      const bottom = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      bottom.position.y = 0;
      group.add(bottom);

      const middle = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      middle.position.y = 0.25 * scaleY;
      group.add(middle);

      const top = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      top.position.y = 0.45 * scaleY;
      group.add(top);

      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.015 * scaleX, 0.08 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: 0xff6600 })
      );
      nose.position.set(0, 0.47 * scaleY, 0.1 * scaleZ);
      nose.rotation.x = Math.PI / 2;
      group.add(nose);
      break;

    case 'present':
      // Create present box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.2 * scaleX, 0.2 * scaleY, 0.2 * scaleZ),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      box.position.y = 0;
      group.add(box);

      const ribbon1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.03 * scaleX, 0.21 * scaleY, 0.21 * scaleZ),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      ribbon1.position.y = 0;
      group.add(ribbon1);

      const ribbon2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.21 * scaleX, 0.03 * scaleY, 0.21 * scaleZ),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      ribbon2.position.y = 0;
      group.add(ribbon2);

      const bow = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scaleX, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      bow.position.y = 0.12 * scaleY;
      group.add(bow);
      break;

    case 'star':
      // Create star with center and points
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      center.position.y = 0;
      group.add(center);

      // Add 6 points
      for (let i = 0; i < 6; i++) {
        const point = new THREE.Mesh(
          new THREE.ConeGeometry(0.05 * scaleX, 0.2 * scaleY, 8),
          new THREE.MeshPhongMaterial({ color: colorHex })
        );

        if (i === 0) {
          point.position.y = 0.2 * scaleY;
          point.rotation.x = 0;
        } else if (i === 1) {
          point.position.y = -0.2 * scaleY;
          point.rotation.x = Math.PI;
        } else if (i === 2) {
          point.position.x = 0.2 * scaleX;
          point.rotation.z = -Math.PI / 2;
        } else if (i === 3) {
          point.position.x = -0.2 * scaleX;
          point.rotation.z = Math.PI / 2;
        } else if (i === 4) {
          point.position.z = 0.2 * scaleZ;
          point.rotation.x = -Math.PI / 2;
        } else {
          point.position.z = -0.2 * scaleZ;
          point.rotation.x = Math.PI / 2;
        }

        group.add(point);
      }
      break;

    default:
      // Default box
      const defaultBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.2 * scaleX, 0.2 * scaleY, 0.2 * scaleZ),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(defaultBox);
  }

  return group;
}

// Create all decorations
function createDecorations() {
  if (typeof christmasDecorations === 'undefined') {
    console.warn('christmasDecorations not found. Make sure decorations.js is loaded.');
    return;
  }

  // Clear existing decorations
  decorationMeshes.forEach(mesh => {
    scene.remove(mesh);
  });
  decorationMeshes = [];

  // Create each decoration
  christmasDecorations.forEach(decoration => {
    const mesh = createDecorationMesh(decoration.type, decoration.color, decoration.scale);
    mesh.userData = {
      id: decoration.id,
      lat: decoration.lat,
      lon: decoration.lon,
      name: decoration.name
    };

    decorationMeshes.push(mesh);
    scene.add(mesh);
  });

  // Update positions based on current location
  updateDecorations();
}

// Update decoration positions based on user location and orientation
function updateDecorations() {
  if (latitudeValue === 0 || longitudeValue === 0) return;

  decorationMeshes.forEach(mesh => {
    const decorationLat = mesh.userData.lat;
    const decorationLon = mesh.userData.lon;

    // Calculate distance and bearing to decoration
    const distance = calculateDistance(latitudeValue, longitudeValue, decorationLat, decorationLon);
    const bearing = calculateBearing(latitudeValue, longitudeValue, decorationLat, decorationLon);

    // Calculate relative angle considering device heading
    const relativeAngle = (bearing - deviceHeading) * (Math.PI / 180);

    // Position decoration based on distance and bearing
    // Scale down distance for AR view (1 meter in real world = smaller in AR)
    const scaledDistance = Math.min(distance / 10, 5); // Cap at 5 units for visibility
    const x = Math.sin(relativeAngle) * scaledDistance;
    const z = -Math.cos(relativeAngle) * scaledDistance - 1;

    mesh.position.set(x, -0.5, z);

    // Add rotation animation for star type
    if (mesh.userData.id.includes('star')) {
      mesh.rotation.y += 0.01;
    }
  });
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

  // Update decoration positions based on orientation
  updateDecorations();

  renderer.render(scene, camera);
}
