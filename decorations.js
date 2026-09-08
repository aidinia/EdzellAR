// ---------------------------------------------------------------------------
// Halloween decorations config — shared by both the main AR.js site and the
// geo/ WebXR build (geo/index.html loads this same file via ../decorations.js
// — don't duplicate it there).
//
// Each entry is one decoration placed at a real-world GPS coordinate, using
// EITHER a placeholder primitive shape OR a real downloaded model:
//
//   shape/color — Phase 1 placeholder. `shape` is an A-Frame primitive name
//     (box, sphere, cone, octahedron, ...) with `color` as a hex string.
//
//   model — a real 3D model instead, e.g. a Sketchfab .glb download. Set
//     this to the file's path (e.g. 'models/pumpkin.glb') and drop `shape`/
//     `color` — they're ignored once `model` is present. Optionally add a
//     `rotation` string ('x y z' degrees) if the model isn't upright as
//     exported.
//
//   scale — applies either way. Sketchfab exports aren't guaranteed to come
//     out at any particular real-world size, so this usually needs tuning
//     by eye once you actually see the model in AR (start around '1 1 1'
//     and adjust, rather than assuming the placeholder shapes' '2 2 2'-ish
//     values carry over).
//
// Decorations can be swapped one at a time — anything without a `model`
// field keeps rendering as its placeholder shape.
//
// HOW TO GET REAL COORDINATES FOR YOUR NEIGHBOURHOOD:
//   1. Open Google Maps, find the exact spot (a specific porch, tree, gate).
//   2. Long-press (mobile) or right-click (desktop) the spot on the map.
//   3. Tap the coordinates that pop up (e.g. "56.849123, -2.644012") to
//      copy them — that's lat, lon in the format below.
//   Alternatively, stand at the spot with your phone and use any GPS/compass
//   app that shows live coordinates.
//
// The five entries below are placeholder points scattered 15–40m around a
// single base coordinate near Edzell — close enough to walk between during
// testing, spread in different compass directions so you can confirm
// decorations show up in the correct direction as you turn. Replace them
// with your real spots once the mock-up is confirmed working.
// ---------------------------------------------------------------------------

const decorations = [
  {
    id: 'pumpkin-1',
    lat: 56.815539, 
    lon: -2.619037,
    shape: 'sphere',
    color: '#ff7518', // pumpkin orange
    scale: '2 2 2',
    label: 'Pumpkin Patch'
  },
  {
    id: 'ghost-1',
    lat: 56.815751, 
    lon: -2.619502,
    shape: 'cone',
    color: '#f5f5f5',
    scale: '2 3 2',
    label: 'Ghost'
  },
  {
    id: 'spider-1',
    lat: 56.815245, 
    lon: -2.618543,
    shape: 'octahedron',
    color: '#1a1a1a',
    scale: '2 2 2',
    label: 'Giant Spider'
  },
  {
    id: 'witchhat-1',
    lat: 56.815713, 
    lon: -2.618906,
   // shape: 'cone',
     model: 'models/witchs_hat.glb',
    //color: '#4b0082',
    scale: '2 3 2',
    label: 'Witch Hat'
  },
  {
    id: 'skeleton-1',
    lat: 56.8494727,
    lon: -2.6443776,
    shape: 'box',
    color: '#eeeeee',
    scale: '1.5 3 1',
    label: 'Skeleton'
  }
];
