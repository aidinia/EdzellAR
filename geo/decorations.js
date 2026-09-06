// ---------------------------------------------------------------------------
// Same 5 placeholder points as the main project's decorations.js — kept as
// its own copy (see README.md) so this experiment stays fully independent.
// Deliberately identical coordinates so the two approaches (AR.js/compass
// vs. this WebXR build) can be tested side by side from the same spot.
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
