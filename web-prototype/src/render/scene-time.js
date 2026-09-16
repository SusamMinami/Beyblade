import * as THREE from "three";

export function normalizeSceneTime(value) {
  return ["auto", "day", "night"].includes(value) ? value : "auto";
}

export function resolveSceneTime(value, date = new Date()) {
  if (value === "day" || value === "night") return value;
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

// Generated radiance, not a background image. Sun, open sky and bounced ground
// light give metal/glazing a different reflection environment in each period.
export function createOutdoorEnvironment(renderer, period) {
  const day = period === "day";
  const room = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        upper: { value: new THREE.Color(day ? "#86b9d0" : "#182d47") },
        lower: { value: new THREE.Color(day ? "#99907b" : "#111b25") },
        horizon: { value: new THREE.Color(day ? "#dae9e6" : "#34414c") },
      },
      vertexShader: `varying vec3 direction;
        void main() { direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 direction;
        uniform vec3 upper, lower, horizon;
        void main() {
          float h = normalize(direction).y;
          vec3 color = mix(horizon, h > 0.0 ? upper : lower, pow(abs(h), .45));
          gl_FragColor = vec4(color, 1.0);
        }`,
    }));
  room.add(sky);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(day ? 4 : 9, day ? 4 : 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(...(day ? [5, 4.5, 3.5] : [2.6, 1.5, .65])),
      side: THREE.DoubleSide, toneMapped: false,
    }));
  card.position.set(day ? -12 : 0, day ? 19 : 9, day ? 11 : -19);
  card.lookAt(0, 0, 0);
  room.add(card);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room, .05);
  generator.dispose();
  room.traverse(mesh => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
  return target;
}
