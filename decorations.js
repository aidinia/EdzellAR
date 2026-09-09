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
//     this to the file's path WRITTEN RELATIVE TO THIS FILE'S OWN FOLDER
//     (the project root, e.g. 'models/pumpkin.glb') — not relative to
//     whichever page happens to load it. geo/script.js automatically
//     prepends '../' since it's one folder down; don't add that yourself,
//     and don't write these paths as if relative to geo/. Drop `shape`/
//     `color` once `model` is set — they're ignored. Optionally add a
//     `rotation` string ('x y z' degrees) if the model isn't upright as
//     exported. If the model has an embedded animation, it plays
//     automatically (all clips, looped) via animation-mixer — no extra
//     field needed for that.
//
//   credit — attribution info for a downloaded `model`, shown on
//     credits.html (linked from both start screens). Either a plain string:
//       credit: "Witch's Hat by kolodzey"
//     or an object if you want a clickable source link:
//       credit: { author: 'Jane Doe', url: 'https://sketchfab.com/3d-models/...', license: 'CC-BY 4.0' }
//     Any decoration with a `model` but no `credit` shows up on that page
//     flagged as needing attribution info — fill this in as you add each
//     model rather than leaving it for later, even for CC0 models (still
//     worth recording the source). Multiple decorations sharing the same
//     `model` file (e.g. two witch hats) are credited once, not once per
//     placement — write the same path both times (with or without a
//     leading './', credits.html treats those the same).
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
    lat: 56.815505, 
    lon: -2.620957,
    shape: 'sphere',
    color: '#ff7518', // pumpkin orange
    scale: '2 2 2',
    label: 'Pumpkin Patch',
    model: './models/halloween_pumpkin.glb',
    credit: 'Halloween Pumpkin by KIRE'
  },
  {
    id: 'ghost-1',
    lat: 56.814982, 
    lon: -2.623312,
    shape: 'cone',
    color: '#f5f5f5',
    scale: '2 3 2',
    label: 'Ghost',
    credit: 'Ghost w/ Tophat by Noby Grand',
    model: './models/ghost_w_tophat.glb'
  },
  {
    id: 'spider-1',
    lat: 56.815528,
    lon: -2.623951,
    shape: 'octahedron',
    color: '#1a1a1a',
    scale: '2 2 2',
    label: 'Giant Spider',
    credit:'Spooky Spider by Bart',
    model: './models/spooky_spider.glb'
  },

  {
    id: 'witchhat-1',
    lat: 56.815713, 
    lon: -2.618906,
   // shape: 'cone',
    model: './models/jack_skellington.glb',
    credit: "Witch's Hat by kolodzey ",
    //color: '#4b0082',
    scale: '2 3 2',
    label: 'Witch Hat'
  },
  {
    id: 'witchhat-2',
    lat: 56.816938,
    lon: -2.624491,
   // shape: 'cone',
    model: 'models/witchs_hat.glb',
    credit: "Witch's Hat by kolodzey ",
    //color: '#4b0082',
    scale: '2 3 2',
    label: 'Witch Hat'
  },
  {
    id: 'skeleton-1',
    lat: 56.817070, 
    lon: -2.621830,
    shape: 'box',
    color: '#eeeeee',
    scale: '1.5 3 1',
    label: 'Skeleton',
    credit: 'Cartoon Skeleton by Overaction',
    model: './models/free_animated_low_poly_cartoon_skeleton.glb'
  }
];
