// ---------------------------------------------------------------------------
// Halloween decorations config — Phase 1 mock-up
//
// Each entry is one decoration placed at a real-world GPS coordinate.
// `shape`/`color`/`scale` are stand-ins for now (Phase 1: prove positions
// work). Later phases swap `shape` for a `model` field pointing at a
// downloaded Sketchfab .glb file — the loader in script.js is already
// written to handle either.
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
    lat: 56.8493829,
    lon: -2.6442137,
    shape: 'sphere',
    color: '#ff7518', // pumpkin orange
    scale: '2 2 2',
    label: 'Pumpkin Patch'
  },
  {
    id: 'ghost-1',
    lat: 56.8494278,
    lon: -2.6438858,
    shape: 'cone',
    color: '#f5f5f5',
    scale: '2 3 2',
    label: 'Ghost'
  },
  {
    id: 'spider-1',
    lat: 56.8490685,
    lon: -2.6447055,
    shape: 'octahedron',
    color: '#1a1a1a',
    scale: '2 2 2',
    label: 'Giant Spider'
  },
  {
    id: 'witchhat-1',
    lat: 56.8492032,
    lon: -2.6437219,
    shape: 'cone',
    color: '#4b0082',
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
