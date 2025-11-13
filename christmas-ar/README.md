# Christmas AR Neighborhood Decorations

A location-based augmented reality web experience that places virtual Christmas decorations at specific GPS coordinates around your neighborhood.

## Features

- Location-based AR using GPS coordinates
- 5 different Christmas decoration types:
  - Christmas Tree with ornaments
  - Santa Claus
  - Snowman
  - Gift Box
  - Christmas Star
- Distance tracking to nearest decoration
- Mobile-friendly interface
- Works directly in the browser (no app required!)

## Setup Instructions

### 1. Configure GPS Coordinates

Open `decorations.js` and replace the placeholder coordinates with actual locations in your neighborhood:

```javascript
const christmasDecorations = [
    {
        id: 'tree-1',
        lat: 40.7128,  // REPLACE with your latitude
        lon: -74.0060, // REPLACE with your longitude
        type: 'tree',
        scale: '10 10 10',
        name: 'Giant Christmas Tree',
        color: '#0f0'
    },
    // ... more decorations
];
```

**How to get GPS coordinates:**

1. **Using Google Maps:**
   - Open Google Maps on your computer
   - Right-click on the location where you want to place a decoration
   - Click on the coordinates at the top (they will be copied)
   - Paste them into your decorations.js file

2. **Using your phone:**
   - Open Google Maps on your phone
   - Press and hold on the location
   - The coordinates will appear at the top
   - Tap them to copy

3. **Tips for placing decorations:**
   - Place decorations at least 10-20 meters apart for best visibility
   - Consider placing them at recognizable landmarks (mailboxes, trees, corners)
   - Test the coordinates by visiting the location

### 2. Serve the Website

You need to serve the website over HTTPS for camera and location access to work.

**Option 1: Using Python (Simple)**
```bash
cd christmas-ar
python3 -m http.server 8000
```
Then open: `http://localhost:8000`

**Option 2: Using Node.js with http-server**
```bash
npm install -g http-server
cd christmas-ar
http-server -p 8000
```

**Option 3: Deploy to a hosting service**
- GitHub Pages (free, HTTPS enabled)
- Netlify (free, easy drag-and-drop)
- Vercel (free, automatic HTTPS)

### 3. Access on Mobile

1. Find your computer's local IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` or `ip addr`

2. On your phone's browser, visit:
   ```
   http://YOUR_IP_ADDRESS:8000
   ```

3. For production, deploy to a hosting service and share the URL

## Usage

1. Visit the website on a mobile device
2. Click "Start AR Experience"
3. Allow camera and location permissions
4. Point your camera around to see decorations
5. Walk around your neighborhood to discover more decorations!

## Browser Compatibility

Works best on:
- iOS Safari (iOS 13+)
- Chrome for Android (Android 8+)
- Firefox for Android

**Note:** Location-based AR requires:
- HTTPS connection (or localhost for testing)
- GPS/Location services enabled
- Camera permissions
- Gyroscope/accelerometer (most modern phones have these)

## Customization

### Adding More Decorations

Add new decoration objects to the `christmasDecorations` array in `decorations.js`:

```javascript
{
    id: 'unique-id',
    lat: YOUR_LATITUDE,
    lon: YOUR_LONGITUDE,
    type: 'tree', // or 'santa', 'snowman', 'present', 'star'
    scale: '10 10 10', // Adjust size
    name: 'Display Name',
    color: '#00ff00' // Hex color code
}
```

### Adjusting Decoration Size

Modify the `scale` parameter:
- Small: `'3 3 3'`
- Medium: `'5 5 5'`
- Large: `'10 10 10'`
- Extra Large: `'15 15 15'`

### Changing Colors

Modify the `color` parameter with any hex color:
- Red: `'#ff0000'`
- Green: `'#00ff00'`
- Blue: `'#0000ff'`
- Gold: `'#ffd700'`
- White: `'#ffffff'`

## Troubleshooting

### Decorations not appearing
- Make sure you've replaced the default 0,0 coordinates
- Verify GPS coordinates are correct
- Check that location permissions are granted
- Try moving closer to the decoration location (within 100m)

### Camera not working
- Ensure HTTPS is enabled (or using localhost)
- Check camera permissions in browser settings
- Try a different browser

### Location not accurate
- Make sure GPS is enabled on your device
- Use the phone outdoors for better GPS signal
- Wait a few seconds for GPS to calibrate

### Performance issues
- Reduce the `scale` values of decorations
- Decrease the number of decorations
- Use a newer phone with better hardware

## Technical Details

- Built with [A-Frame](https://aframe.io/) - Web VR/AR framework
- Uses [AR.js](https://ar-js-org.github.io/AR.js/) - Location-based AR
- Pure HTML/CSS/JavaScript - No build process required
- Client-side only - No server needed

## Privacy

- All location data stays on your device
- No data is sent to any server
- No tracking or analytics
- Open source and transparent

## License

Feel free to use and modify for your neighborhood!

## Credits

Created with A-Frame and AR.js
Merry Christmas! 🎄
