import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import layout from "../../../resources/battle_worlds/championship_layout.json";
import { applyWorldSurface, physicalSurface } from "./world-surface.js";

const down = new THREE.Vector3(0, -1, 0);
const beamVertex = `
  varying vec2 vUv;
  varying vec3 vNormal, vWorld;
  void main() {
    vUv = uv;
    vWorld = (modelMatrix * vec4(position, 1.)).xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
  }`;
const beamFragment = `
  uniform vec3 color;
  uniform float strength;
  varying vec2 vUv;
  varying vec3 vNormal, vWorld;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld)));
    float edge = pow(smoothstep(0., .85, facing), 1.6);
    float end = smoothstep(0., .3, vUv.y);
    float source = .3 + .7 * pow(vUv.y, 2.);
    gl_FragColor = vec4(color, strength * edge * end * source);
  }`;

// All six fixture anchors and both light-track heights come from Blender.
// No additional shadow maps, reflection captures or frame-time geometry.
export class ChampionshipAtmosphere {
  constructor(scene, model, { period = "night" } = {}) {
    if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
    this.root = new THREE.Group();
    this.root.name = "Championship moving lighting";
    scene.add(this.root);
    this.time = 0;
    this.period = period;
    this.disposed = false;
    this.direction = new THREE.Vector3();
    this.materials = [];
    this.scene = scene;
    this.surfaces = new Set();
    const replacements = new Map();
    const finishes = {
      "Arena satin titanium": { kind: "titanium", color: "#687780", metalness: .86, roughness: .32, env: .72 },
      "Deck graphite enamel": { kind: "enamel", color: "#27333b", metalness: .38, roughness: .38, env: .58 },
      "Graphite": { kind: "enamel", color: "#1a252d", metalness: .48, roughness: .36, env: .5 },
      "Brushed aluminium": { kind: "polished", color: "#627881", metalness: .88, roughness: .25, env: .9 },
      "Edge polished aluminium": { kind: "polished", color: "#b1c4cc", metalness: .94, roughness: .15, env: 1.05 },
      "Acrylic guard": { kind: "acrylic", color: "#a2c1cc", metalness: 0, roughness: .12, env: 1.15 },
    };
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      const old = mesh.material;
      const finish = finishes[old.name];
      if (finish) {
        if (!replacements.has(old)) {
          const material = physicalSurface(old, {
            metalness: finish.metalness, roughness: finish.roughness,
            clearcoat: old.name === "Acrylic guard" ? .72 : .38,
            clearcoatRoughness: .23, envMapIntensity: finish.env,
          });
          material.color.set(finish.color);
          if (old.name === "Acrylic guard") {
            // Fresnel opacity and actual specular lighting keep the playable
            // surface visible; no transmission render target or extra pass.
            material.opacity = .48;
            material.depthWrite = false;
            material.side = THREE.FrontSide;
            material.ior = 1.49;
          }
          applyWorldSurface(material, finish.kind);
          replacements.set(old, material);
        }
        mesh.material = replacements.get(old);
      }
      if (this.surfaces.has(mesh.material)) return;
      this.surfaces.add(mesh.material);
      if (old.name === "Championship display ink") {
        mesh.material.color.set("#07151c");
        mesh.material.roughness = .19;
        mesh.material.metalness = .15;
        mesh.material.envMapIntensity = .35;
      } else if (old.name === "Surface hairlines") {
        mesh.material.color.set("#49585d");
        mesh.material.roughness = .54;
        mesh.material.metalness = .65;
      }
      if (old.name.startsWith("Championship")) {
        this.materials.push({ material: mesh.material, base: mesh.material.emissiveIntensity });
      }
    });
    // Replaced GLB materials are owned here until mounting; ThreeStage owns
    // their live replacements and disposes them together with the model.
    replacements.forEach((replacement, source) => source.dispose());
    // Broad reflected highlights from the side rig; shared LTC lookup textures,
    // no new shadow maps, PMREM captures or per-frame render targets.
    this.softboxes = [-1, 1].map(side => {
      const light = new THREE.RectAreaLight(side < 0 ? 0xbfeaff : 0x72b9d5, 1, 1.3, 6);
      light.position.set(side*6.4, 4.7, -4.8);
      light.lookAt(side*1.1, -.2, .8);
      light.name = "Championship side rig soft light";
      this.root.add(light);
      return light;
    });
    const headGeometry = new THREE.CylinderGeometry(.24, .29, .42, 20);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x203441, metalness: .7, roughness: .3 });
    const lensGeometry = new THREE.CircleGeometry(.19, 24);
    const beamGeometry = new THREE.CylinderGeometry(.055, 1, 1, 32, 1, true);
    beamGeometry.translate(0, -.5, 0);
    this.fixtures = layout.fixtures.map(({ position, phase, color }) => {
      const light = new THREE.SpotLight(color, 200, 25, .24, .85, 2);
      light.position.fromArray(position);
      this.root.add(light, light.target);
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.copy(light.position);
      const lens = new THREE.Mesh(lensGeometry,
        new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide }));
      lens.rotation.x = Math.PI / 2;
      lens.position.y = -.216;
      head.add(lens);
      const beam = new THREE.Mesh(beamGeometry, new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(color) }, strength: { value: .13 } },
        vertexShader: beamVertex, fragmentShader: beamFragment,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }));
      beam.position.copy(light.position);
      this.root.add(head, beam);
      return { light, head, beam, phase };
    });
    this.runners = layout.runners.map(({ radius, y }, index) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius-.045, radius+.045, 256),
        new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          uniforms: { time: { value: 0 }, level: { value: 1 }, direction: { value: index ? -1 : 1 } },
          vertexShader: `varying vec2 p;
            void main() { p = position.xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `varying vec2 p; uniform float time, level, direction;
            void main() {
              float angle = atan(p.y, p.x);
              float packet = pow(max(0., cos(angle * 3. - time * .85 * direction)), 16.);
              float cells = step(.14, fract((angle / 6.2831853 + .5) * 96.));
              vec3 color = mix(vec3(.06,.48,.68), vec3(.65,.94,1.), packet);
              gl_FragColor = vec4(color * (1. + packet * 2.), cells * level * (.22 + packet * .78));
            }`,
        }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y;
      this.root.add(ring);
      return ring;
    });
    this.setPeriod(period);
  }

  setPeriod(period) {
    this.period = period;
    this.surfaces.forEach(material => {
      if (material.name === "Arena satin titanium") {
        material.envMapIntensity = period === "day" ? .86 : .48;
      }
      if (material.envMap !== this.scene.environment) {
        material.envMap = this.scene.environment;
        material.needsUpdate = true;
      }
    });
    this.update(0, this.reducedMotion);
  }

  update(delta, reducedMotion = false, pulse = 0) {
    if (this.disposed) return;
    this.reducedMotion = reducedMotion;
    if (!reducedMotion && !document.hidden) this.time += Math.max(0, delta);
    const t = reducedMotion ? 0 : this.time;
    const day = this.period === "day";
    const response = reducedMotion ? 0 : Math.min(1, pulse);
    for (const { light, head, beam, phase } of this.fixtures) {
      light.target.position.set(
        Math.sin(t * .32 + phase) * 3.65,
        -.12,
        Math.cos(t * .23 + phase) * 3.1,
      );
      light.intensity = (day ? 55 : 380) * (1 + response * .22);
      this.direction.subVectors(light.target.position, light.position);
      const length = this.direction.length();
      this.direction.normalize();
      head.quaternion.setFromUnitVectors(down, this.direction);
      beam.quaternion.copy(head.quaternion);
      beam.scale.set(length * Math.tan(light.angle), length, length * Math.tan(light.angle));
      beam.material.uniforms.strength.value = (day ? .012 : .085) * (reducedMotion ? .5 : 1);
    }
    this.runners.forEach(ring => {
      ring.material.uniforms.time.value = t;
      ring.material.uniforms.level.value = (day ? .28 : .9) * (1 + response * .25);
    });
    this.softboxes.forEach(light => { light.intensity = day ? 1.25 : 2.1; });
    this.materials.forEach(({ material, base }) => {
      material.emissiveIntensity = base * (day ? .25 : 1);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    const geometries = new Set(), materials = new Set();
    this.root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
      if (object.isLight) object.dispose();
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.root.clear();
    this.surfaces.clear();
    this.materials.length = 0;
  }
}
