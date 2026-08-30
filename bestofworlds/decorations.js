// Christmas Decorations Configuration — "Best of Worlds"
//
// Unlike the original versions (root/mixed/arjs), positions here are NOT
// hardcoded absolute GPS coordinates. They're defined RELATIVE to wherever
// the AR session starts: a distance in meters + a compass bearing in degrees
// from true north (0 = north, 90 = east, 180 = south, 270 = west).
//
// script.js resolves these to real lat/lon once it has your first GPS fix,
// so the demo works wherever you actually test it — no editing coordinates
// before every test run.
const christmasDecorations = [
  { id: 'tree-1',    type: 'tree',    distance: 4,   bearing: 0,   scale: '10 10 10', name: 'Giant Christmas Tree', color: '#0f0' },
  { id: 'santa-1',   type: 'santa',   distance: 3,   bearing: 60,  scale: '5 5 5',    name: 'Santa Claus',          color: '#f00' },
  { id: 'snowman-1', type: 'snowman', distance: 3,   bearing: 130, scale: '4 4 4',    name: 'Snowman',              color: '#fff' },
  { id: 'present-1', type: 'present', distance: 2.5, bearing: 200, scale: '3 3 3',    name: 'Gift Box',             color: '#ff0' },
  { id: 'star-1',    type: 'star',    distance: 5,   bearing: 280, scale: '2 2 2',    name: 'Christmas Star',       color: '#ffd700' }
];

// Build a Three.js mesh for a given decoration type. (Ported from the
// original root/mixed decorations — the richest-looking of the five
// versions — unchanged geometry, just pulled out for reuse from both the
// GPS mode and the WebXR precision mode.)
function createDecorationMesh(type, color, scale) {
  const group = new THREE.Group();

  const scaleValues = scale.split(' ').map(s => parseFloat(s) * 0.01); // scale down for AR view
  const scaleX = scaleValues[0] || 0.1;
  const scaleY = scaleValues[1] || 0.1;
  const scaleZ = scaleValues[2] || 0.1;

  const colorHex = parseInt(color.replace('#', '0x'));

  switch (type) {
    case 'tree': {
      const foliage1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 * scaleX, 0.6 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(foliage1);

      const foliage2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.25 * scaleX, 0.5 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      foliage2.position.y = -0.15 * scaleY;
      group.add(foliage2);

      const foliage3 = new THREE.Mesh(
        new THREE.ConeGeometry(0.3 * scaleX, 0.4 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      foliage3.position.y = -0.25 * scaleY;
      group.add(foliage3);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scaleX, 0.05 * scaleX, 0.2 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: 0x8b4513 })
      );
      trunk.position.y = -0.5 * scaleY;
      group.add(trunk);

      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scaleX, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xffd700 })
      );
      star.position.y = 0.3 * scaleY;
      group.add(star);
      break;
    }

    case 'santa': {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xffc0cb })
      );
      head.position.y = 0.2 * scaleY;
      group.add(head);

      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.1 * scaleX, 0.2 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      hat.position.y = 0.35 * scaleY;
      group.add(hat);
      break;
    }

    case 'snowman': {
      const bottom = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(bottom);

      const middle = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      middle.position.y = 0.25 * scaleY;
      group.add(middle);

      const top = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      top.position.y = 0.45 * scaleY;
      group.add(top);

      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.015 * scaleX, 0.08 * scaleY, 8),
        new THREE.MeshPhongMaterial({ color: 0xff6600 })
      );
      nose.position.set(0, 0.47 * scaleY, 0.1 * scaleZ);
      nose.rotation.x = Math.PI / 2;
      group.add(nose);
      break;
    }

    case 'present': {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.2 * scaleX, 0.2 * scaleY, 0.2 * scaleZ),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(box);

      const ribbon1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.03 * scaleX, 0.21 * scaleY, 0.21 * scaleZ),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      group.add(ribbon1);

      const ribbon2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.21 * scaleX, 0.03 * scaleY, 0.21 * scaleZ),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      group.add(ribbon2);

      const bow = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scaleX, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      bow.position.y = 0.12 * scaleY;
      group.add(bow);
      break;
    }

    case 'star': {
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * scaleX, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(center);

      for (let i = 0; i < 6; i++) {
        const point = new THREE.Mesh(
          new THREE.ConeGeometry(0.05 * scaleX, 0.2 * scaleY, 8),
          new THREE.MeshPhongMaterial({ color: colorHex })
        );

        if (i === 0) {
          point.position.y = 0.2 * scaleY;
        } else if (i === 1) {
          point.position.y = -0.2 * scaleY;
          point.rotation.x = Math.PI;
        } else if (i === 2) {
          point.position.x = 0.2 * scaleX;
          point.rotation.z = -Math.PI / 2;
        } else if (i === 3) {
          point.position.x = -0.2 * scaleX;
          point.rotation.z = Math.PI / 2;
        } else if (i === 4) {
          point.position.z = 0.2 * scaleZ;
          point.rotation.x = -Math.PI / 2;
        } else {
          point.position.z = -0.2 * scaleZ;
          point.rotation.x = Math.PI / 2;
        }

        group.add(point);
      }
      break;
    }

    default: {
      const defaultBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.2 * scaleX, 0.2 * scaleY, 0.2 * scaleZ),
        new THREE.MeshPhongMaterial({ color: colorHex })
      );
      group.add(defaultBox);
    }
  }

  return group;
}
