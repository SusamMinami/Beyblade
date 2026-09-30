import { Quaternion, Vector3 } from "three";

const UP = new Vector3(0, 1, 0);
const axis = new Vector3();
const spin = new Quaternion();

export function applyBattlePose(model, state, phase = state.spinPhase) {
  const lean = state.tiltVector ?? { x: state.tilt, y: 0 };
  const length = Math.hypot(lean.x, lean.y);
  const tilt = state.tilt ?? length;
  const ratio = Math.sin(tilt) / Math.max(length, 1e-12);
  axis.set(lean.x * ratio, Math.cos(tilt), lean.y * ratio).normalize();
  model.quaternion.setFromUnitVectors(UP, axis);
  spin.setFromAxisAngle(UP, phase);
  model.quaternion.multiply(spin);
}

// Screen Y points down. Keep camera-dependent conversion outside the solver.
export function screenControlToWorld(camera, input) {
  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0;
  if (right.lengthSq() < 1e-10) right.set(1, 0, 0);
  right.normalize();
  return { x: right.x * input.x - right.z * input.y,
    y: right.z * input.x + right.x * input.y };
}
