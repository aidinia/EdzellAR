// Main Application Logic
let scene;
let camera;
let userLocation = { lat: 0, lon: 0 };
let decorationsLoaded = false;

// TEST MODE: Set to true to place decorations relative to your current location
// Set to false to use the exact GPS coordinates in decorations.js
const TEST_MODE = true;

// Initialize the AR experience
document.getElementById('start-btn').addEventListener('click', startARExperience);

async function startARExperience() {
    const splashScreen = document.getElementById('splash-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const arScene = document.getElementById('ar-scene');

    splashScreen.style.display = 'none';
    loadingScreen.style.display = 'flex';

    try {
        // Request location permission
        await requestLocationPermission();

        // Wait a moment for AR.js to initialize
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            arScene.style.display = 'block';
            initializeAR();
        }, 2000);
    } catch (error) {
        console.error('Error starting AR:', error);
        alert('Please allow camera and location permissions to use this experience.');
        splashScreen.style.display = 'flex';
        loadingScreen.style.display = 'none';
    }
}

async function requestLocationPermission() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation.lat = position.coords.latitude;
                userLocation.lon = position.coords.longitude;
                console.log('User location:', userLocation);
                resolve();
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

function initializeAR() {
    scene = document.querySelector('a-scene');
    camera = document.querySelector('[gps-camera]');

    // Wait for scene to load
    if (scene.hasLoaded) {
        onSceneLoaded();
    } else {
        scene.addEventListener('loaded', onSceneLoaded);
    }
}

function onSceneLoaded() {
    console.log('AR Scene loaded');
    loadDecorations();
    startLocationTracking();
}

function loadDecorations() {
    if (decorationsLoaded) return;

    console.log('Loading decorations...');
    console.log('TEST_MODE:', TEST_MODE);
    console.log('User location:', userLocation);

    // In test mode, wait for valid GPS coordinates
    if (TEST_MODE && (userLocation.lat === 0 || userLocation.lon === 0)) {
        console.warn('Waiting for GPS lock in TEST_MODE...');
        setTimeout(loadDecorations, 1000);
        return;
    }

    christmasDecorations.forEach((decoration, index) => {
        // Skip decorations with default 0,0 coordinates
        if (decoration.lat === 0 && decoration.lon === 0 && index > 0) {
            console.warn(`Skipping ${decoration.name} - please set GPS coordinates`);
            return;
        }

        let lat, lon;

        if (TEST_MODE) {
            // In test mode, place decorations around the user's current location
            // Each decoration is offset by ~10-20 meters in different directions
            const offsetLat = (index - 2) * 0.0001; // ~11 meters per 0.0001 degrees latitude
            const offsetLon = (index % 2 === 0 ? 1 : -1) * 0.0001;

            lat = userLocation.lat + offsetLat;
            lon = userLocation.lon + offsetLon;

            console.log(`TEST MODE: Placing ${decoration.name} at offset (${offsetLat}, ${offsetLon})`);
        } else {
            // Use exact coordinates from decorations.js
            lat = decoration.lat;
            lon = decoration.lon;
        }

        // Create container for the decoration
        const entity = document.createElement('a-entity');
        entity.setAttribute('id', decoration.id);
        entity.setAttribute('gps-entity-place', `latitude: ${lat}; longitude: ${lon}`);
        entity.setAttribute('scale', decoration.scale);

        // Add the decoration model
        const model = getDecorationModel(decoration.type, decoration.color, decoration.scale);
        entity.innerHTML = model;

        // Add animation
        entity.setAttribute('animation', {
            property: 'rotation',
            to: '0 360 0',
            loop: true,
            dur: 10000,
            easing: 'linear'
        });

        // Add look-at behavior (face the user)
        entity.setAttribute('look-at', '[gps-camera]');

        // Add click event for info
        entity.addEventListener('click', () => {
            showDecorationInfo(decoration);
        });

        scene.appendChild(entity);
        console.log(`Added decoration: ${decoration.name} at ${lat}, ${lon}`);
    });

    decorationsLoaded = true;
    updateDecorationCount();
}

function startLocationTracking() {
    // Update user location periodically
    navigator.geolocation.watchPosition(
        (position) => {
            userLocation.lat = position.coords.latitude;
            userLocation.lon = position.coords.longitude;
            updateDistanceInfo();
        },
        (error) => {
            console.error('Location tracking error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 27000
        }
    );

    // Update distance info every 2 seconds
    setInterval(updateDistanceInfo, 2000);
}

function updateDistanceInfo() {
    const distanceInfo = document.getElementById('distance-info');

    // Find nearest decoration
    let nearestDecoration = null;
    let minDistance = Infinity;

    christmasDecorations.forEach(decoration => {
        if (decoration.lat === 0 && decoration.lon === 0) return;

        const distance = calculateDistance(
            userLocation.lat,
            userLocation.lon,
            decoration.lat,
            decoration.lon
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestDecoration = decoration;
        }
    });

    if (nearestDecoration && minDistance < 1000) {
        distanceInfo.innerHTML = `
            <strong>Nearest:</strong> ${nearestDecoration.name}<br>
            <strong>Distance:</strong> ${Math.round(minDistance)}m away
            <br><br>
             <strong>Your position:</strong> ${userLocation.lat} - 
            ${userLocation.lon}<br> 
            <strong>Decoration:</strong> ${ decoration.lat} - 
            ${decoration.lon}
        `;
        distanceInfo.style.display = 'block';
    } else {
        distanceInfo.style.display = 'none';
    }
}

function updateDecorationCount() {
    const countElement = document.getElementById('decoration-count');
    const validDecorations = christmasDecorations.filter(d => d.lat !== 0 || d.lon !== 0).length;
    const mode = TEST_MODE ? '🧪 TEST MODE' : '📍 LIVE MODE';
    countElement.textContent = `${mode} | Decorations: ${validDecorations}`;
}

function showDecorationInfo(decoration) {
    const distance = calculateDistance(
        userLocation.lat,
        userLocation.lon,
        decoration.lat,
        decoration.lon
    );

    alert(`${decoration.name}\n\nDistance: ${Math.round(distance)}m away\n\nMerry Christmas!`);
}

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    location.reload();
});

// Debug info
console.log('Christmas AR App initialized');
console.log('Total decorations configured:', christmasDecorations.length);
