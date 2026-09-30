import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import launcherUrl from "../../../resources/launcher/performance/launcher-performance.glb?url";
import layout from "../../../resources/launcher/performance/parts.json";
import { applySurfaceFinish } from "./surface-finish.js";
import { normalizeLauncher, getLauncherPart } from "../core/launcher-state.js";

// Keep a CPU-only template. Live rounds and speculative preparation each own
// their geometry and materials, so cancellation never disposes another round.
const templates = new Map();
const urls = import.meta.glob("../../../resources/launcher/performance/*.glb", {
  query: "?url", import: "default", eager: true,
});
function loadTemplate(url = launcherUrl) {
  if (!templates.has(url)) templates.set(url, new GLTFLoader().loadAsync(url).then(({ scene }) => scene)
    .catch(error => {
      templates.delete(url);
      throw error;
    }));
  return templates.get(url);
}

function cloneOwned(template) {
  const model = template.clone(true);
  model.traverse(o => { if (o.isMesh) {
    o.geometry = o.geometry.clone(); o.material = o.material.clone();
  } });
  return model;
}
export function disposeLauncherModel(model) {
  model.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  model.removeFromParent();
}

export async function createLauncherPart(id) {
  const part = getLauncherPart(id);
  const url = urls[`../../../resources/launcher/performance/${part.code.toLowerCase()}.glb`];
  const template = await loadTemplate(url);
  return cloneOwned(template.children[0]);
}

export async function createLauncherModel(raw) {
  const config = normalizeLauncher(raw);
  const template = await loadTemplate();
  const model = cloneOwned(template);
  const slots = {};
  model.traverse(o => { if (o.userData.slotId && !o.isMesh && !o.userData.inspectionGroup)
    slots[o.userData.slotId] = o; });
  try {
    for (const [slot, id] of Object.entries(config.build)) {
      if (slots[slot]?.userData.partId === id) continue;
      const next = await createLauncherPart(id);
      slots[slot].parent.add(next);
      disposeLauncherModel(slots[slot]);
      slots[slot] = next;
    }
  } catch (error) { disposeLauncherModel(model); throw error; }
  model.name = "GearDriveLauncher";
  model.userData.topMount = new THREE.Vector3(...layout.topMount);
  model.userData.slots = slots;
  model.userData.config = config;
  prepareLauncherMaterials(model);
  paintLauncher(model, config.colors);
  captureLauncherPose(model);
  return model;
}

export function prepareLauncherMaterials(model) {
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = !material.transparent;
    if (material.name.includes("Smoked_PC")) {
      // Thin tinted polycarbonate, using alpha rather than a second scene pass.
      material.depthWrite = false;
      material.side = THREE.FrontSide;
      mesh.renderOrder = 2;
    } else if (material.name.includes("Steel")) {
      applySurfaceFinish(material, "machined", .55);
    } else if (material.name.includes("TPE")) {
      applySurfaceFinish(material, "rubber", .75);
    } else {
      applySurfaceFinish(material, "polymer", .75);
    }
  });
}

export function paintLauncher(model, colors) {
  model.traverse(o => {
    if (!o.isMesh) return;
    const zone = { primary: "accent", secondary: "shell", chassis: "grip", grip: "grip" }[o.userData.paintZone];
    if (zone && colors[zone]) o.material.color.set(colors[zone]);
  });
}

export function captureLauncherPose(model) {
  model.traverse(o => {
    o.userData.assembledPosition ??= o.position.clone();
    o.userData.assembledQuaternion ??= o.quaternion.clone();
  });
}

export function poseLauncher(model, { explode = 0, pull = 0, release = 0 } = {}) {
  const ratio = getLauncherPart(model.userData.config.build.transmission).ratio;
  const angle = pull / (layout.geometry.rackPitch * 36 / (2 * Math.PI));
  model.userData.outputAngle = angle * ratio;
  model.traverse(o => {
    const base = o.userData.assembledPosition;
    if (!base) return;
    o.position.copy(base); o.quaternion.copy(o.userData.assembledQuaternion);
    const slot = o.userData.slotId, group = o.userData.inspectionGroup;
    if (model.userData.slots[slot] === o) {
      o.position.addScaledVector(new THREE.Vector3(...layout.inspection.moduleExplode[slot]), explode);
      if (slot === "rack" || slot === "pull_handle") o.position.x += pull;
      if (slot === "release") o.position.x += release * .1;
    }
    if (o.userData.detailExplode) o.position.addScaledVector(new THREE.Vector3(...o.userData.detailExplode), explode);
    if (group === "input_rotor") o.rotateY(-angle);
    if (group === "output_rotor" || group === "coupler_rotor") o.rotateY(angle * ratio);
    if (o.userData.releaseVector) o.position.addScaledVector(new THREE.Vector3(...o.userData.releaseVector), release);
  });
}

export function launcherMotion(elapsed, releaseMs = 160) {
  const pullTime = .32, releaseTime = releaseMs / 1000;
  const pull = Math.min(1, elapsed / pullTime);
  const opening = THREE.MathUtils.clamp((elapsed - pullTime) / releaseTime, 0, 1);
  return { pull: 1.1 * (1 - (1 - pull) ** 2), release: opening,
    done: elapsed >= pullTime + releaseTime };
}
