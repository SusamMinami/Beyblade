import * as THREE from "three";
import { driveZoneState } from "../core/drive-zones.js";

const LETTERS = {
  A: [[-.18,.22],[0,-.22],[.18,.22],[.1,.04],[-.1,.04]],
  B: [[-.16,.22],[-.16,-.22],[.08,-.22],[.18,-.12],[.08,0],[-.16,0],[.08,0],[.18,.12],[.08,.22],[-.16,.22]],
  C: [[.16,-.18],[0,-.23],[-.17,-.1],[-.17,.1],[0,.23],[.16,.18]],
};

export function createDriveZoneModel(arena, heightAt) {
  const root = new THREE.Group();
  root.name = "drive-zones";
  for (const zone of driveZoneState(arena, 0).zones) {
    const group = new THREE.Group();
    group.userData.zoneId = zone.id;
    const surface = (geometry) => {
      geometry.rotateX(-Math.PI / 2);
      const position = geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) + zone.x, z = position.getZ(i) + zone.y;
        position.setXYZ(i, x, heightAt(x, z) + 0.032, z);
      }
      return geometry;
    };
    const border = new THREE.Mesh(surface(new THREE.RingGeometry(zone.radius - .06, zone.radius, 80)),
      new THREE.MeshBasicMaterial({ color: "#e9cb68", side: THREE.DoubleSide, depthWrite: false }));
    const outline = new THREE.Mesh(surface(new THREE.RingGeometry(zone.radius, zone.radius + .055, 80)),
      new THREE.MeshBasicMaterial({ color: "#293f42", side: THREE.DoubleSide, transparent: true, opacity: .4, depthWrite: false }));
    const fill = new THREE.Mesh(surface(new THREE.CircleGeometry(zone.radius - .09, 80)),
      new THREE.MeshBasicMaterial({ color: "#e9cb68", transparent: true, opacity: .08, depthWrite: false }));
    const letter = new THREE.Line(new THREE.BufferGeometry().setFromPoints(LETTERS[zone.id].map(([x,z]) =>
      new THREE.Vector3(x + zone.x, heightAt(x + zone.x, z + zone.y) + .045, z + zone.y))),
    new THREE.LineBasicMaterial({ color: "#ffe9a2" }));
    group.add(border, fill, letter, outline);
    root.add(group);
  }
  return root;
}

export function updateDriveZoneModel(root, simulation) {
  if (!root) return;
  const state = simulation.driveZone;
  const contested = simulation.player.zone.contested || simulation.enemy.zone.contested;
  for (const group of root.children) {
    const active = group.userData.zoneId === state.active?.id && !state.cooling;
    const color = active ? contested ? "#ff805f" : "#ffd34e" : "#789799";
    group.children[0].material.color.set(color);
    group.children[1].material.color.set(color);
    group.children[2].material.color.set(active ? "#293f42" : "#5c797b");
    group.children[3].material.opacity = active ? .9 : .18;
    group.children[1].material.opacity = active ? .32 : .035;
    group.children[0].material.transparent = true;
    group.children[0].material.opacity = active ? 1 : .38;
  }
}
