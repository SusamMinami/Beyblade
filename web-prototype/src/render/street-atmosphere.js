import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { applySurfaceFinish } from "./surface-finish.js";
import layout from "../../../resources/battle_worlds/street_layout.json";

// A single reflected scene is shared by all the puddles. These positions match
// the authored road, outside the unchanged radius-6.7 combat dish.
const puddleShader = {
  name: "Street rainwater",
  uniforms: {
    color: { value: new THREE.Color("#182b37") },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },
    time: { value: 0 },
    texel: { value: new THREE.Vector2(1 / 768, 1 / 768) },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vMirror;
    varying vec3 vWorld;
    void main() {
      vMirror = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 color;
    uniform float time;
    uniform vec2 texel;
    varying vec4 vMirror;
    varying vec3 vWorld;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float pool(vec2 p, vec2 center, vec2 radius) {
      float edge = length((p-center)/radius);
      float irregularity = (noise(p*1.1)-.5)*.3 + (noise(p*4.3)-.5)*.045;
      return 1.0-smoothstep(.73, 1.0, edge+irregularity);
    }
    void main() {
      vec2 p = vWorld.xz;
      float mask = max(pool(p,vec2(-4.4,-8.9),vec2(4.6,1.8)),
                       pool(p,vec2(5.7,-8.5),vec2(3.5,1.5)));
      mask = max(mask,pool(p,vec2(-8.4,-2.8),vec2(1.2,3.7)));
      mask = max(mask,pool(p,vec2(8.4,-.4),vec2(1.25,3.7)));
      mask *= smoothstep(7.35,7.65,length(p));
      mask *= smoothstep(.18,.52,noise(p*vec2(1.7,.8)));
      if(mask < .015) discard;
      // Sub-pixel drift from runoff, with soft rough reflections rather than
      // a perfectly flat mirror. Animation has its own pausable clock.
      vec2 wave = vec2(noise(p*.7+vec2(time*.035,0)),
                       noise(p*.9-vec2(0,time*.027)))-.5;
      vec2 uv = vMirror.xy/vMirror.w + wave*.00028;
      // The shutter's real slats need softer reflection than the cafe glow.
      float coolPool = smoothstep(1.0,5.0,p.x);
      vec2 blur = texel*(1.2+noise(p*.8)*2.2)*mix(1.0,3.5,coolPool);
      vec3 reflected = texture2D(tDiffuse,uv).rgb*.25;
      reflected += texture2D(tDiffuse,uv+vec2(blur.x,0)).rgb*.125;
      reflected += texture2D(tDiffuse,uv-vec2(blur.x,0)).rgb*.125;
      reflected += texture2D(tDiffuse,uv+vec2(0,blur.y)).rgb*.125;
      reflected += texture2D(tDiffuse,uv-vec2(0,blur.y)).rgb*.125;
      reflected += texture2D(tDiffuse,uv+blur).rgb*.0625;
      reflected += texture2D(tDiffuse,uv-blur).rgb*.0625;
      reflected += texture2D(tDiffuse,uv+vec2(blur.x,-blur.y)).rgb*.0625;
      reflected += texture2D(tDiffuse,uv+vec2(-blur.x,blur.y)).rgb*.0625;
      float fresnel = pow(1.0-abs(normalize(cameraPosition-vWorld).y),3.0);
      gl_FragColor = vec4(mix(color,reflected,.68+fresnel*.18),
        mask*mix(.72,.43,coolPool));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// Fine mineral noise has no directional sine bands. Its normal perturbation
// and roughness live on the asphalt only, not the battle surface.
function finishAsphalt(material) {
  material.userData.streetFinish = "wet-asphalt";
  material.customProgramCacheKey = () => "street-asphalt-v1";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRoad;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRoad = (modelMatrix * vec4(position,1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
      #include <common>
      varying vec3 vRoad;
      float roadHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float roadNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(roadHash(i),roadHash(i+vec2(1,0)),f.x),
          mix(roadHash(i+vec2(0,1)),roadHash(i+vec2(1,1)),f.x),f.y);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
      #include <roughnessmap_fragment>
      float damp = roadNoise(vRoad.xz*.8);
      float grit = roadNoise(vRoad.xz*12.0);
      diffuseColor.rgb *= .94+grit*.05+damp*.06;
      roughnessFactor = clamp(.36+damp*.16+(grit-.5)*.05,.3,.65);`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
      #include <normal_fragment_maps>
      float gritHeight = roadNoise(vRoad.xz*12.0);
      vec3 sx = dFdx(vViewPosition), sy = dFdy(vViewPosition);
      vec3 rx = cross(sy,normal), ry = cross(normal,sx);
      float det = dot(sx,rx);
      normal = normalize(abs(det)*normal - sign(det)*.0015*
        (dFdx(gritHeight)*rx+dFdy(gritHeight)*ry));`);
  };
  material.needsUpdate = true;
}

function finishPlastic(material) {
  material.customProgramCacheKey = () => "street-worn-plastic-v1";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPlastic;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPlastic = (modelMatrix * vec4(position,1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPlastic;")
      .replace("#include <roughnessmap_fragment>", `
        #include <roughnessmap_fragment>
        float polishedRim = smoothstep(3.2,6.5,length(vPlastic.xz));
        roughnessFactor = mix(.40,.17,polishedRim);
        diffuseColor.rgb *= mix(vec3(.93,.95,.96),vec3(1.0,.97,.91),polishedRim);`);
  };
  material.needsUpdate = true;
}

function plasticReflection(renderer, day = false) {
  // Art-directed soft light cards: dark surroundings keep diffuse plastic calm,
  // while the warm shop-side strip and cool sky opening shape its clear coat.
  const room = new THREE.Scene();
  room.background = new THREE.Color(day ? "#a8bfc5" : "#101923");
  const cards = day ? [
    { p: [-5, 12, 6], size: [5, 4], color: [4, 3.7, 3.1] },
    { p: [8, 9, -4], size: [7, 10], color: [1.4, 1.9, 2.3] },
  ] : [
    { p: [-3, 8, -10], size: [8, 1.8], color: [7, 4.7, 2.7] },
    { p: [7, 10, -5], size: [3, 7], color: [1.8, 3.1, 4.4] },
  ];
  for (const card of cards) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...card.size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(...card.color),
        side: THREE.DoubleSide, toneMapped: false,
      }));
    mesh.position.set(...card.p);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room, .035);
  generator.dispose();
  room.traverse((mesh) => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
  return target;
}

export class StreetAtmosphere {
  constructor(scene, model, { renderer, reflectionSize = 768, exclude = [], period = "night" } = {}) {
    if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
    this.time = 0;
    this.disposed = false;
    this.root = new THREE.Group();
    this.root.name = "Street atmosphere";
    this.luminaires = [];
    this.materials = [];
    this.period = period;
    this.plasticEnvironments = {
      day: plasticReflection(renderer, true),
      night: plasticReflection(renderer),
    };
    this.plastics = [];
    const seen = new Set();
    const coated = new Map();
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      let material = mesh.material;
      if (/Street (glazed|oxblood|smoked|cafe glazing)/.test(material.name)) {
        if (!coated.has(material)) {
          const finish = new THREE.MeshPhysicalMaterial();
          THREE.MeshStandardMaterial.prototype.copy.call(finish, material);
          finish.clearcoat = .42;
          finish.clearcoatRoughness = .19;
          coated.set(material, finish);
        }
        mesh.material = coated.get(material);
        material = mesh.material;
      }
      if (seen.has(material)) return;
      seen.add(material);
      const name = material.name;
      material.envMapIntensity = .62;
      if (/Street bowl ivory/.test(name)) {
        this.plastics.push(material);
        material.envMapIntensity = 1.15;
        finishPlastic(material);
      }
      if (/asphalt/i.test(name)) finishAsphalt(material);
      else if (/oak/i.test(name)) applySurfaceFinish(material, "wood", .65);
      else if (/plaster|paver|curb/i.test(name)) applySurfaceFinish(material, "stone", .32);
      if (/Street (lightbox|vending|lantern|window) glow|Street cafe interior/.test(name)) {
        this.materials.push({ material, base: material.emissiveIntensity,
          channel: name.includes("vending") ? "vending" : name.includes("lantern") ? "lantern" : "shop" });
      }
    });
    coated.forEach((replacement, original) => original.dispose());
    const addLight = (name, position, color, intensity, distance, channel) => {
      const light = new THREE.PointLight(color, intensity, distance, 2);
      light.name = name;
      light.position.set(...position);
      this.root.add(light);
      this.luminaires.push({ light, base: intensity, channel });
    };
    // Local warm spill meets cool sky fill. No omnipresent orange wash.
    const lights = layout.lights;
    const power = layout.humanScale ** 2 * .33;
    addLight("Cafe spill left", lights.cafeLeft, 0xffb665, 44 * power, 192, "shop");
    addLight("Cafe spill door", lights.cafeDoor, 0xffad58, 34 * power, 160, "shop");
    addLight("Vending spill", lights.vending, 0x96dce6, 17 * power, 112, "vending");
    addLight("Street lamp spill", lights.lamp, 0xffd19a, 70 * power, 288, "shop");
    addLight("Paper lantern spill", lights.lantern, 0xffa85c, 6 * power, 64, "lantern");
    addLight("Cafe interior pendant", lights.pendant, 0xffc785, 8 * power, 80, "shop");
    const addArea = (name, position, target, color, intensity, width, height, channel) => {
      const light = new THREE.RectAreaLight(color, intensity, width, height);
      light.name = name;
      light.position.set(...position);
      light.lookAt(...target);
      this.root.add(light);
      this.luminaires.push({ light, base: intensity, channel });
    };
    addArea("Cafe window reflected light", lights.window, [0, -.4, 0],
      0xffc58e, .75, 116.8, 43.2, "shop");
    addArea("Vending reflected light", lights.vending, [0, -.3, 0],
      0xb5e8ef, 1.2, 22.4, 40, "vending");
    addArea("Street lamp soft lens", lights.lamp, [0, -.3, 0],
      0xffcf97, 1.5, 32, 16, "shop");
    addArea("Open sky soft reflection", [30, 85, 10], [0, -.3, 0],
      0xb9ddeb, .9, 96, 64, "sky");
    this.puddles = new Reflector(new THREE.PlaneGeometry(80, 80), {
      textureWidth: reflectionSize, textureHeight: reflectionSize,
      clipBias: .001, multisample: 0, shader: puddleShader, color: "#182b37",
    });
    this.puddles.name = "Street reflected puddles";
    this.puddles.rotation.x = -Math.PI / 2;
    this.puddles.position.set(0, -.916, -3);
    this.puddles.material.transparent = true;
    this.puddles.material.depthWrite = false;
    this.puddles.material.uniforms.texel.value.setScalar(1 / reflectionSize);
    this.puddles.renderOrder = 1;
    const reflect = this.puddles.onBeforeRender;
    this.puddles.onBeforeRender = (...args) => {
      const visibility = exclude.map((object) => object.visible);
      exclude.forEach((object) => { object.visible = false; });
      try { reflect.apply(this.puddles, args); }
      finally { exclude.forEach((object, i) => { object.visible = visibility[i]; }); }
    };
    this.root.add(this.puddles);
    scene.add(this.root);
    this.setPeriod(period);
  }

  setPeriod(period) {
    this.period = period === "day" ? "day" : "night";
    const day = this.period === "day";
    this.plastics.forEach(material => {
      material.envMap = this.plasticEnvironments[this.period].texture;
      material.envMapIntensity = day ? .68 : 1.15;
      material.needsUpdate = true;
    });
    this.puddles.material.uniforms.color.value.set(day ? "#617b83" : "#182b37");
    this.update(0);
  }

  update(delta, reducedMotion = false) {
    if (this.disposed) return;
    if (!reducedMotion) this.time += Math.max(0, delta);
    const t = this.time;
    // Continuous, low-amplitude modulation; no random per-frame strobe.
    const levels = reducedMotion ? { shop: 1, vending: 1, lantern: 1, sky: 1 } : {
      sky: 1,
      shop: 1 + Math.sin(t * 1.3) * .012 + Math.sin(t * 3.1) * .008
        - Math.pow(Math.max(0, Math.sin(t * .43)), 28) * .032,
      vending: 1 + Math.sin(t * .71 + 1.7) * .014,
      lantern: 1 + Math.sin(t * .48) * .016,
    };
    this.materials.forEach(({ material, base, channel }) => {
      material.emissiveIntensity = base * levels[channel] * (this.period === "day" ? .06 : 1);
    });
    this.luminaires.forEach(({ light, base, channel }) => {
      light.intensity = base * levels[channel] *
        (this.period === "day" ? channel === "sky" ? 1.9 : .04 : 1);
    });
    this.puddles.material.uniforms.time.value = reducedMotion ? 0 : t;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.puddles.geometry.dispose();
    this.puddles.dispose();
    Object.values(this.plasticEnvironments).forEach(target => target.dispose());
    this.luminaires.forEach(({ light }) => light.dispose());
    this.root.clear();
    this.materials = [];
    this.luminaires = [];
  }
}
