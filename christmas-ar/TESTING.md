# Testing Your AR Christmas Decorations

## Test Mode vs Live Mode

The app now has two modes controlled by the `TEST_MODE` variable in [app.js](app.js):

### Test Mode (DEFAULT - `TEST_MODE = true`)
- **Use this for testing on your phone**
- Decorations are automatically placed around your **current location**
- You'll see decorations within 10-50 meters of where you are
- Great for testing without walking to specific coordinates

### Live Mode (`TEST_MODE = false`)
- Uses the exact GPS coordinates from [decorations.js](decorations.js)
- You must physically be near those locations to see decorations
- Use this when deploying to your actual neighborhood

## How to Switch Modes

Open [app.js](app.js) and change line 9:

**For Testing:**
```javascript
const TEST_MODE = true;  // Decorations follow you
```

**For Production:**
```javascript
const TEST_MODE = false; // Use exact GPS coordinates
```

## Testing on Your Phone

1. **Enable Test Mode** (should already be enabled)

2. **Start a local server:**
   ```bash
   cd christmas-ar
   python3 -m http.server 8000
   ```

3. **Find your computer's IP address:**
   - Mac/Linux: `ifconfig | grep inet`
   - Windows: `ipconfig`
   - Look for something like `192.168.1.x`

4. **On your phone's browser, visit:**
   ```
   http://YOUR_IP:8000
   ```

5. **Allow permissions:**
   - Camera access
   - Location access

6. **Look around:**
   - Point your camera in different directions
   - The decorations should appear around you
   - Look at the info panel at the top to see:
     - 🧪 TEST MODE indicator
     - Number of decorations loaded
     - Distance to nearest decoration

## Troubleshooting

### Can't see decorations on phone?

1. **Check the browser console** (on Android Chrome):
   - Visit `chrome://inspect` on your computer
   - Select your phone's browser tab
   - Look for errors or debug messages

2. **Check permissions:**
   - Make sure both camera and location are allowed
   - Try refreshing the page

3. **Check GPS signal:**
   - Go outside or near a window
   - Wait 10-30 seconds for GPS to lock

4. **Look in all directions:**
   - Decorations are placed in a circle around you
   - Turn 360° slowly

5. **Check the info panel:**
   - Should show "🧪 TEST MODE" if test mode is active
   - Should show "Decorations: 5"
   - Should show your position and distance when near a decoration

### Decorations appear but are too far/close?

Adjust the offset in [app.js](app.js) line 103-104:

```javascript
// Smaller offset = closer decorations (5-10 meters)
const offsetLat = (index - 2) * 0.00005;
const offsetLon = (index % 2 === 0 ? 1 : -1) * 0.00005;

// Larger offset = farther decorations (20-30 meters)
const offsetLat = (index - 2) * 0.0002;
const offsetLon = (index % 2 === 0 ? 1 : -1) * 0.0002;
```

### Decorations are too small/large?

Adjust the `scale` in [decorations.js](decorations.js):

```javascript
scale: '5 5 5',    // Smaller
scale: '10 10 10', // Medium
scale: '20 20 20', // Larger
```

## When You're Ready to Deploy

1. **Get actual GPS coordinates** for each decoration location:
   - Use Google Maps
   - Right-click → click coordinates
   - Update [decorations.js](decorations.js)

2. **Disable test mode** in [app.js](app.js):
   ```javascript
   const TEST_MODE = false;
   ```

3. **Deploy to a hosting service:**
   - GitHub Pages
   - Netlify
   - Vercel

4. **Share the URL** with your neighborhood!

## Debug Information

The app logs helpful information to the console:
- User's current GPS position
- Each decoration's position
- Distance calculations
- AR.js events

To view console logs on mobile:
- **Android Chrome:** Use `chrome://inspect` on desktop
- **iOS Safari:** Enable Web Inspector in Settings → Safari → Advanced

## Known Issues

- **GPS accuracy:** Phone GPS is typically accurate to 5-15 meters
- **First load:** May take 10-30 seconds for GPS to lock
- **Indoor use:** GPS doesn't work well indoors, go outside
- **Compass calibration:** Wave your phone in a figure-8 pattern to calibrate
- **Battery:** AR uses camera + GPS + sensors, so battery drain is faster

## Browser Compatibility

Works best on:
- **iOS:** Safari 13+ (iPhone 8 or newer)
- **Android:** Chrome 80+ (Android 8 or newer)

Doesn't work on:
- Desktop browsers (no GPS or phone sensors)
- Very old phones
- Browsers without WebGL support
