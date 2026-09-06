import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { applySurfaceFinish } from "./surface-finish.js";

function mesh(group, geometry, material, y = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.y = y;
  item.castShadow = true;
  item.receiveShadow = true;
  group.add(item);
  return item;
}

function circularInstances(group, geometry, material, count, radius, y) {
  const instances = new THREE.InstancedMesh(geometry, material, count);
  const transform = new THREE.Object3D();
  for (let index = 0; index < count; index += 1) {
    const angle = index / count * Math.PI * 2;
    transform.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    transform.rotation.y = -angle;
    transform.updateMatrix();
    instances.setMatrixAt(index, transform.matrix);
  }
  instances.castShadow = true;
  instances.receiveShadow = true;
  group.add(instances);
  return instances;
}

export function addArenaArchitecture(group, arena, heightAt) {
  const radius = arena.wallRadius;
  const rimY = heightAt(arena, radius);
  const graphite = applySurfaceFinish(new THREE.MeshStandardMaterial({
    color: 0x252b2d, metalness: 0.65, roughness: 0.38,
  }), "machined");
  const silver = applySurfaceFinish(new THREE.MeshStandardMaterial({
    color: 0x9aa8aa, metalness: 0.82, roughness: 0.28,
  }));
  const accent = new THREE.MeshStandardMaterial({
    color: arena.accent, metalness: 0.48, roughness: 0.32,
  });
  const led = new THREE.MeshStandardMaterial({
    color: 0xe6fffa, emissive: arena.accent, emissiveIntensity: 2.2,
    metalness: 0.18, roughness: 0.3,
  });
  const profile = [
    [radius - 0.05, rimY - 0.09], [radius + 0.42, rimY - 0.09],
    [radius + 0.63, rimY - 0.28], [radius + 0.65, -0.72],
    [radius + 0.5, -0.97], [radius - 0.25, -0.97],
  ].reverse().map(([x, y]) => new THREE.Vector2(x, y));
  mesh(group, new THREE.LatheGeometry(profile, 192), graphite);
  const base = mesh(group, new THREE.CylinderGeometry(radius + 0.8, radius + 0.95, 0.16, 192),
    graphite, -1.04);
  base.receiveShadow = true;

  for (const [r, y, thickness, material] of [
    [radius + 0.47, rimY - 0.12, 0.048, silver],
    [radius + 0.6, -0.73, 0.035, led],
    [radius + 0.75, -0.97, 0.045, silver],
  ]) {
    const ring = mesh(group, new THREE.TorusGeometry(r, thickness, 10, 192), material, y);
    ring.rotation.x = Math.PI / 2;
  }

  circularInstances(group, new RoundedBoxGeometry(0.38, 0.48, 0.55, 2, 0.045),
    graphite, 24, radius + 0.51, rimY - 0.4);
  circularInstances(group, new THREE.BoxGeometry(0.39, 0.035, 0.31),
    accent, 24, radius + 0.48, rimY - 0.13);
  circularInstances(group, new THREE.CylinderGeometry(0.048, 0.048, 0.028, 6),
    silver, 48, radius + 0.27, rimY - 0.07);
  circularInstances(group, new THREE.BoxGeometry(0.035, 0.12, 0.25),
    led, 24, radius + 0.705, rimY - 0.42);

  const floor = mesh(group, new THREE.CylinderGeometry(24, 24, 0.15, 128),
    new THREE.MeshStandardMaterial({
      color: 0x454a49, roughness: 0.84, metalness: 0.18,
    }), -1.24);
  floor.castShadow = false;
  circularInstances(group, new THREE.BoxGeometry(0.8, 0.008, 0.045),
    silver, 48, radius + 2, -1.16);

  // Thin surface-following inlays: unlike raised rails these do not imply obstacles.
  const markings = [];
  const addSegment = (r1, a1, r2, a2) => {
    markings.push(
      Math.cos(a1) * r1, heightAt(arena, r1, a1) + 0.009, Math.sin(a1) * r1,
      Math.cos(a2) * r2, heightAt(arena, r2, a2) + 0.009, Math.sin(a2) * r2,
    );
  };
  for (let index = 0; index < 96; index += 1) {
    const angle = index / 96 * Math.PI * 2;
    addSegment(radius - 0.1, angle, radius - (index % 4 === 0 ? 0.36 : 0.2), angle);
  }
  for (let sector = 0; sector < 12; sector += 1) {
    const angle = sector / 12 * Math.PI * 2;
    for (let step = 0; step < 20; step += 1) {
      addSegment(0.85 + step * 0.27, angle, 0.85 + (step + 1) * 0.27, angle);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(markings, 3));
  group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xcad4cf, transparent: true, opacity: 0.22,
  })));

  const sweep = mesh(group, new THREE.TorusGeometry(radius + 0.15, 0.028, 8, 40, Math.PI * 0.18),
    led, rimY + 0.055);
  sweep.rotation.x = Math.PI / 2;
  sweep.castShadow = false;
  group.userData.sweep = sweep;

  // Four visible fixtures give the arena a physical setting and directional cues.
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    const fixture = new THREE.Group();
    fixture.position.set(Math.cos(angle) * (radius + 1.35), -1.1,
      Math.sin(angle) * (radius + 1.35));
    fixture.rotation.y = -angle;
    mesh(fixture, new RoundedBoxGeometry(0.5, 0.24, 1.15, 2, 0.06), graphite, 0.12);
    mesh(fixture, new THREE.CylinderGeometry(0.06, 0.08, 2.5, 12), silver, 1.3);
    mesh(fixture, new RoundedBoxGeometry(0.35, 0.26, 1.15, 2, 0.035), graphite, 2.56);
    const panel = mesh(fixture, new THREE.BoxGeometry(0.22, 0.025, 0.94), led, 2.4);
    panel.castShadow = false;
    group.add(fixture);
  }
}
