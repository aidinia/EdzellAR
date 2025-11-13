// Christmas Decorations Configuration
// Replace these coordinates with actual locations in your neighborhood

const christmasDecorations = [
    {
        id: 'tree-1',
        lat: 0, // REPLACE WITH YOUR LATITUDE
        lon: 0, // REPLACE WITH YOUR LONGITUDE
        type: 'tree',
        scale: '10 10 10',
        name: 'Giant Christmas Tree',
        color: '#0f0'
    },
    {
        id: 'santa-1',
        lat: 0.0001, // REPLACE - Example: offset from first location
        lon: 0.0001, // REPLACE
        type: 'santa',
        scale: '5 5 5',
        name: 'Santa Claus',
        color: '#f00'
    },
    {
        id: 'snowman-1',
        lat: -0.0001, // REPLACE
        lon: 0.0001, // REPLACE
        type: 'snowman',
        scale: '4 4 4',
        name: 'Snowman',
        color: '#fff'
    },
    {
        id: 'present-1',
        lat: 0.0001, // REPLACE
        lon: -0.0001, // REPLACE
        type: 'present',
        scale: '3 3 3',
        name: 'Gift Box',
        color: '#ff0'
    },
    {
        id: 'star-1',
        lat: -0.0001, // REPLACE
        lon: -0.0001, // REPLACE
        type: 'star',
        scale: '2 2 2',
        name: 'Christmas Star',
        color: '#ffd700'
    }
];

// Get decoration model based on type
function getDecorationModel(type, color, scale) {
    switch(type) {
        case 'tree':
            return `
                <a-entity>
                    <a-cone position="0 0 0" radius-bottom="2" radius-top="0" height="6" color="${color}"></a-cone>
                    <a-cone position="0 -1.5 0" radius-bottom="2.5" radius-top="0" height="5" color="${color}"></a-cone>
                    <a-cone position="0 -2.5 0" radius-bottom="3" radius-top="0" height="4" color="${color}"></a-cone>
                    <a-cylinder position="0 -5 0" radius="0.5" height="2" color="#8b4513"></a-cylinder>
                    <a-sphere position="0 3 0" radius="0.5" color="#ffd700"></a-sphere>
                    <!-- Ornaments -->
                    <a-sphere position="1 0 0" radius="0.3" color="#ff0000"></a-sphere>
                    <a-sphere position="-1 -1 0" radius="0.3" color="#0000ff"></a-sphere>
                    <a-sphere position="0.5 -2 0.5" radius="0.3" color="#ff00ff"></a-sphere>
                </a-entity>
            `;

        case 'santa':
            return `
                <a-entity>
                    <!-- Body -->
                    <a-sphere position="0 0 0" radius="1.5" color="${color}"></a-sphere>
                    <a-sphere position="0 2 0" radius="1" color="#ffc0cb"></a-sphere>
                    <!-- Hat -->
                    <a-cone position="0 3.5 0" radius-bottom="1" radius-top="0.2" height="2" color="${color}"></a-cone>
                    <a-sphere position="0 4.5 0" radius="0.3" color="#ffffff"></a-sphere>
                    <!-- Belt -->
                    <a-cylinder position="0 0 0" radius="1.6" height="0.5" color="#000000"></a-cylinder>
                    <a-box position="0 0 1.6" width="0.6" height="0.6" depth="0.3" color="#ffd700"></a-box>
                </a-entity>
            `;

        case 'snowman':
            return `
                <a-entity>
                    <!-- Snowballs -->
                    <a-sphere position="0 0 0" radius="2" color="${color}"></a-sphere>
                    <a-sphere position="0 2.5 0" radius="1.5" color="${color}"></a-sphere>
                    <a-sphere position="0 4.5 0" radius="1" color="${color}"></a-sphere>
                    <!-- Eyes -->
                    <a-sphere position="0.3 5 1" radius="0.15" color="#000000"></a-sphere>
                    <a-sphere position="-0.3 5 1" radius="0.15" color="#000000"></a-sphere>
                    <!-- Nose -->
                    <a-cone position="0 4.7 1.2" radius-bottom="0.15" radius-top="0" height="0.8" rotation="90 0 0" color="#ff6600"></a-cone>
                    <!-- Hat -->
                    <a-cylinder position="0 6 0" radius="0.8" height="1" color="#000000"></a-cylinder>
                    <a-cylinder position="0 6.5 0" radius="1.2" height="0.2" color="#000000"></a-cylinder>
                    <!-- Buttons -->
                    <a-sphere position="0 3 1.4" radius="0.2" color="#000000"></a-sphere>
                    <a-sphere position="0 2.5 1.4" radius="0.2" color="#000000"></a-sphere>
                </a-entity>
            `;

        case 'present':
            return `
                <a-entity>
                    <!-- Box -->
                    <a-box position="0 0 0" width="2" height="2" depth="2" color="${color}"></a-box>
                    <!-- Ribbon vertical -->
                    <a-box position="0 0 0" width="0.3" height="2.1" depth="2.1" color="#ff0000"></a-box>
                    <!-- Ribbon horizontal -->
                    <a-box position="0 0 0" width="2.1" height="0.3" depth="2.1" color="#ff0000"></a-box>
                    <!-- Bow -->
                    <a-sphere position="0 1.2 0" radius="0.5" color="#ff0000"></a-sphere>
                    <a-sphere position="0.4 1.2 0" radius="0.3" color="#ff0000"></a-sphere>
                    <a-sphere position="-0.4 1.2 0" radius="0.3" color="#ff0000"></a-sphere>
                </a-entity>
            `;

        case 'star':
            return `
                <a-entity>
                    <!-- Center -->
                    <a-sphere position="0 0 0" radius="0.5" color="${color}"></a-sphere>
                    <!-- Points -->
                    <a-cone position="0 2 0" radius-bottom="0.5" radius-top="0" height="2" color="${color}"></a-cone>
                    <a-cone position="0 -2 0" radius-bottom="0.5" radius-top="0" height="2" rotation="180 0 0" color="${color}"></a-cone>
                    <a-cone position="2 0 0" radius-bottom="0.5" radius-top="0" height="2" rotation="0 0 -90" color="${color}"></a-cone>
                    <a-cone position="-2 0 0" radius-bottom="0.5" radius-top="0" height="2" rotation="0 0 90" color="${color}"></a-cone>
                    <a-cone position="0 0 2" radius-bottom="0.5" radius-top="0" height="2" rotation="-90 0 0" color="${color}"></a-cone>
                    <a-cone position="0 0 -2" radius-bottom="0.5" radius-top="0" height="2" rotation="90 0 0" color="${color}"></a-cone>
                    <!-- Animation -->
                    <a-animation attribute="rotation" dur="5000" to="0 360 0" repeat="indefinite"></a-animation>
                </a-entity>
            `;

        default:
            return '<a-box color="${color}"></a-box>';
    }
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
