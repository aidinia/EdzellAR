// Main Application Logic
let scene;
let camera;
let userLocation = { lat: 0, lon: 0 };
let decorationsLoaded = false;

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
         var p = document.createElement("p");
                p.innerText = "Requesting Location";
                document.getElementById("splash-screen").appendChild(p);
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
                var p = document.createElement("p");
                p.innerText = position.coords.latitude; + " --- " + position.coords.longitude;
                document.getElementById("splash-screen").appendChild(p);
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

    christmasDecorations.forEach((decoration, index) => {
        // Skip decorations with default 0,0 coordinates
        if (decoration.lat === 0 && decoration.lon === 0 && index > 0) {
            console.warn(`Skipping ${decoration.name} - please set GPS coordinates`);
            return;
        }

        // Create container for the decoration
        const entity = document.createElement('a-entity');
        entity.setAttribute('id', decoration.id);
        entity.setAttribute('gps-entity-place', `latitude: ${decoration.lat}; longitude: ${decoration.lon}`);
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
        console.log(`Added decoration: ${decoration.name} at ${decoration.lat}, ${decoration.lon}`);
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
        `;
        distanceInfo.style.display = 'block';
    } else {
        distanceInfo.style.display = 'none';
    }
}

function updateDecorationCount() {
    const countElement = document.getElementById('decoration-count');
    const validDecorations = christmasDecorations.filter(d => d.lat !== 0 || d.lon !== 0).length;
    countElement.textContent = `Decorations in neighborhood: ${validDecorations}`;
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
