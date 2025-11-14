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
            document.getElementById('status-overlay').style.display = 'block';
            document.getElementById('debug-overlay').style.display = 'block';
            document.getElementById('debug-overlay').innerHTML = `AR STARTED<br>Location: ${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`;
            console.log('AR Scene and overlays displayed');
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
                console.log('GPS Accuracy:', position.coords.accuracy, 'meters');
                resolve();
            },
            (error) => {
                console.error('Geolocation error:', error);
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
    updateStatus('TAP SCREEN to place decoration at your location!');

    // Update debug overlay
    document.getElementById('debug-overlay').innerHTML = `
        TAP ANYWHERE<br>
        to place decoration!<br>
        <small>Your location: ${userLocation.lat.toFixed(6)}, ${userLocation.lon.toFixed(6)}</small>
    `;

    // Add tap listener to place decorations
    document.addEventListener('click', placeDecorationAtCurrentLocation);

    startLocationTracking();
}

function updateStatus(message) {
    // Update A-Frame text entity
    const infoText = document.getElementById('info-text');
    if (infoText) {
        infoText.setAttribute('text', 'value', message);
    }

    // Update HTML overlay (backup)
    const statusOverlay = document.getElementById('status-overlay');
    if (statusOverlay) {
        statusOverlay.innerHTML = message.replace(/\n/g, '<br>');
    }

    console.log('STATUS:', message);
}

let placedDecorationCount = 0;

function placeDecorationAtCurrentLocation() {
    if (userLocation.lat === 0 || userLocation.lon === 0) {
        alert('Waiting for GPS lock...');
        return;
    }

    // Use the first decoration as template, cycle through types
    const decorationTypes = ['tree', 'santa', 'snowman', 'present', 'star'];
    const colors = ['#0f0', '#f00', '#fff', '#ff0', '#ffd700'];
    const typeIndex = placedDecorationCount % decorationTypes.length;

    const decoration = {
        id: `placed-${placedDecorationCount}`,
        lat: userLocation.lat,
        lon: userLocation.lon,
        type: decorationTypes[typeIndex],
        scale: '10 10 10',
        name: decorationTypes[typeIndex].charAt(0).toUpperCase() + decorationTypes[typeIndex].slice(1),
        color: colors[typeIndex]
    };

    placeDecoration(decoration, 0);
    placedDecorationCount++;
}

function placeDecoration(decoration, index) {
    const lat = decoration.lat;
    const lon = decoration.lon;

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

    const distance = calculateDistance(userLocation.lat, userLocation.lon, lat, lon);
    console.log(`Added decoration: ${decoration.name} at ${lat}, ${lon}`);
    console.log(`Distance from user: ${Math.round(distance)}m`);

    // Update debug overlay
    document.getElementById('debug-overlay').innerHTML = `
        DECORATION PLACED!<br>
        ${decoration.name} #${placedDecorationCount}<br>
        Your Pos: ${userLocation.lat.toFixed(6)}, ${userLocation.lon.toFixed(6)}<br>
        Decor Pos: ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>
        Distance: ${Math.round(distance)}m<br>
        <small>TAP AGAIN to place another!</small>
    `;

    updateStatus(`Placed: ${decoration.name}\nDistance: ${Math.round(distance)}m\nTap to place more!`);
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

    const mode = TEST_MODE ? '🧪 TEST' : '📍 LIVE';
    let statusText = `${mode} | Decorations: ${christmasDecorations.length}`;

    if (nearestDecoration && minDistance < 1000) {
        statusText += `\nNearest: ${nearestDecoration.name}\nDistance: ${Math.round(minDistance)}m`;
    } else if (nearestDecoration) {
        statusText += `\nNearest: ${Math.round(minDistance)}m away`;
    }

    updateStatus(statusText);
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
