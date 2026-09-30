import * as THREE from "three";

// The incumbent assembly plinth, now shared by assembly, care and laboratory.
// All laboratory rooms expose the same work surface at y = .47.
export function createMinimalRoom() {
  const room = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.86, .34, 64),
    new THREE.MeshStandardMaterial({ color: 0xf5f1e8, metalness: .08, roughness: .72 }),
  );
  base.position.y = .28;
  base.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.62, .024, 6, 64),
    new THREE.MeshBasicMaterial({ color: 0x11151a, transparent: true, opacity: .86 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .47;
  room.add(base, rim);
  return room;
}
