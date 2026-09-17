import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createTopModel, disposeTopModel, setActivePart, updateTopPartFocus } from "./top-model.js";
import { applySurfaceFinish } from "./surface-finish.js";
import { loadoutVisualKey } from "./loadout-visual-key.js";
import { prepareScene } from "./prepare-scene.js";
import holoUrl from "../../../resources/showroom/holo.glb?url";
import arenaUrl from "../../../resources/showroom/arena.glb?url";

const ease = (t) => t * t * (3 - 2 * t);

export class ShowroomStage {
  constructor(container, sharedLab) {
    this.container = container;
    this.shared = sharedLab;
    this.renderer = sharedLab.renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#08151d");
    this.scene.fog = new THREE.Fog("#08151d", 12, 24);
    this.scene.environment = sharedLab.environment.texture;
    this.scene.environmentIntensity = 0.36;
    this.camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 40);
    this.camera.position.set(0.12, 4.6, 9.8);
    this.camera.lookAt(0, 0.3, 0);
    this.scene.add(new THREE.HemisphereLight(0xa2d0ed, 0x162d38, 0.45));
    const key = new THREE.DirectionalLight(0xe6f2ff, 2.2);
    key.position.set(-2.5, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -4, near: 0.3, far: 16 });
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    this.accent = new THREE.PointLight(0x32ddff, 12, 8, 2);
    this.accent.position.set(1.8, 2.5, -1.2);
    this.scene.add(this.accent);
    const fill = new THREE.PointLight(0x7fd4ef, 12, 7, 2);
    fill.position.set(-2, 1.2, 2);
    this.scene.add(fill);
    this.lift = new THREE.Group();
    this.scene.add(this.lift);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(.932, .932, .06, 96),
      new THREE.MeshStandardMaterial({ color: 0x263e4a, metalness: .8, roughness: .31 }));
    deck.position.y = .38;
    deck.receiveShadow = true;
    this.lift.add(deck);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.89, .009, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x82e8f2 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .417;
    this.lift.add(ring);
    this.liftRing = ring;
    this.specimen = new THREE.Group();
    this.lift.add(this.specimen);
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.405);
    this.elapsed = 0;
    this.active = false;
    this.sets = {};
    this.setLoads = {};
    this.createEffects();
    this.inspection = false;
    this.orbit = { yaw: 0, pitch: .34, radius: 5.8 };
    this.cameraTarget = new THREE.Vector3(0, .3, 0);
    this.bindInspection();
    this.observer = new ResizeObserver(() => { if (this.active) this.resize(); });
    this.observer.observe(container);
    this.ready = Promise.resolve(this);
  }

  loadSet(id) {
    if (this.sets[id]) return Promise.resolve(this);
    if (this.setLoads[id]) return this.setLoads[id];
    this.setLoads[id] = new GLTFLoader().loadAsync(id === "arena" ? arenaUrl : holoUrl).then(asset => {
      asset.scene.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material.metalness > .4) applySurfaceFinish(mesh.material, "machined", .55);
        mesh.material.envMapIntensity = .65;
      });
      asset.scene.visible = this.stageId === id;
      this.scene.add(asset.scene);
      this.sets[id] = asset.scene;
      return this;
    }).finally(() => {
      delete this.setLoads[id];
    });
    return this.setLoads[id];
  }

  createEffects() {
    this.hologram = new THREE.Mesh(new THREE.CylinderGeometry(1.43, 1.43, 2.72, 96, 1, true),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { time: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec2 vUv;uniform float time;
          void main(){
            float edge=pow(abs(vUv.x-.5)*2.,10.)*.03;
            float grid=step(.982,fract(vUv.y*70.))*step(.7,fract(vUv.x*48.));
            float scan=pow(max(0.,1.-abs(vUv.y-fract(time*.12))*45.),2.);
            gl_FragColor=vec4(.10,.82,.95,.025+grid*.14+scan*.08+edge);
          }`,
      }));
    this.hologram.position.y = 1.765;
    this.scene.add(this.hologram);
    this.beams = new THREE.Group();
    this.scene.add(this.beams);
    this.spots = [];
    for (const x of [-1.3, -.65, 0, .65, 1.3]) {
      const origin = new THREE.Vector3(x, 4.35, -1.45);
      const target = new THREE.Vector3(x*.28, .45, .25);
      const axis = origin.clone().sub(target);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(.50, axis.length(), 32, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xc3e9ff, transparent: true, opacity: .032, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.position.copy(origin).add(target).multiplyScalar(.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
      this.beams.add(beam);
      const spot = new THREE.SpotLight(0xb6ecff, 22, 10, .27, .85, 2);
      spot.position.copy(origin);
      spot.target.position.copy(target);
      this.scene.add(spot, spot.target);
      this.spots.push({ spot, beam, origin, length: origin.distanceTo(target), phase: this.spots.length * 1.3 });
    }
    const particles = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      particles.set([Math.sin(i*2.399)*1.65, .4+(i%27)*.115, Math.cos(i*1.72)*1.3], i*3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(particles, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0x80efff, size: .014, transparent: true, opacity: .4, depthWrite: false,
    }));
    this.scene.add(this.particles);
  }

  setStage(id) {
    this.stageId = id;
    Object.entries(this.sets).forEach(([key, node]) => { node.visible = key === id; });
    this.hologram.visible = id === "holo";
    this.beams.visible = true;
    this.accent.color.set(id === "holo" ? 0x32ddff : 0xffcc7a);
    this.liftRing.material.color.set(id === "holo" ? 0x82e8f2 : 0xffdf93);
    this.particles.material.color.set(id === "holo" ? 0x80efff : 0xffd68c);
    this.spots.forEach(({ spot, beam }, i) => {
      const color = id === "holo" ? (i % 2 ? 0x81bfff : 0x79fff0) : (i % 2 ? 0xffdc94 : 0xb2e1ff);
      spot.color.setHex(color);
      beam.material.color.setHex(color);
    });
    const token = this.prepareToken = (this.prepareToken ?? 0) + 1;
    this.frameReady = false;
    this.ready = this.loadSet(id).then(async () => {
      const key = `${id}:${this.specimenKey}`;
      if (token !== this.prepareToken || !this.active) return this;
      if (key === this.preparedKey) {
        this.frameReady = true;
        return this;
      }
      await prepareScene(this.renderer, this.scene, this.camera, {
        current: () => token === this.prepareToken && this.active,
        draw: () => {
          this.renderer.render(this.scene, this.camera);
          this.frameReady = true;
          this.preparedKey = key;
        },
      });
      return this;
    });
    return this.ready;
  }

  bindInspection() {
    const canvas = this.renderer.domElement;
    const pointers = new Map();
    const ray = new THREE.Raycaster();
    const pick = (event) => {
      if (!this.top) return null;
      const b = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((event.clientX-b.left)/b.width*2-1,
        1-(event.clientY-b.top)/b.height*2), this.camera);
      return ray.intersectObject(this.top, true)[0];
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active || this.transition) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.gesture = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY,
        moved: 0, hit: pick(e), cancelled: false };
      this.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [a,b] = [...pointers.values()];
        this.pinch = Math.hypot(a.x-b.x,a.y-b.y);
        this.gesture.cancelled = true;
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.active || !pointers.has(e.pointerId) || !this.gesture) return;
      const g = this.gesture;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dx=e.clientX-g.lastX, dy=e.clientY-g.lastY;
      g.moved += Math.hypot(dx,dy);
      if (this.inspection && pointers.size === 2) {
        const [a,b] = [...pointers.values()];
        const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
        this.orbit.radius=THREE.MathUtils.clamp(this.orbit.radius*this.pinch/d,4.8,8);
        this.pinch=d;
      } else if (this.inspection) {
        this.orbit.yaw -= dx*.007;
        this.orbit.pitch=THREE.MathUtils.clamp(this.orbit.pitch+dy*.006,.08,1.15);
      }
      g.lastX=e.clientX; g.lastY=e.clientY;
    });
    const release = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      const g=this.gesture;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      this.dragging=pointers.size>0;
      if (!this.active || !g || e.type === "pointercancel") { this.gesture=null; return; }
      if (!g.cancelled && g.moved<8 && g.hit) {
        if (!this.inspection) this.setInspection(true);
        else {
          let part=g.hit.object;
          while (part.parent && part.parent !== this.top) part=part.parent;
          if (this.top.userData.partGroups?.[part.name]) {
            this.activePart=this.activePart === part.name ? null : part.name;
            setActivePart(this.top,this.activePart);
            this.container.dispatchEvent(new CustomEvent("inspectpart", { detail: { slot: this.activePart } }));
          }
        }
      } else if (!g.cancelled && !this.inspection && Math.abs(e.clientX-g.x)>65 &&
        Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)*1.3) {
        this.container.dispatchEvent(new CustomEvent("topswipe",{ detail: { direction: e.clientX<g.x ? 1 : -1 } }));
      }
      if (!pointers.size) this.gesture=null;
    };
    canvas.addEventListener("pointerup",release);
    canvas.addEventListener("pointercancel",release);
    canvas.addEventListener("wheel",(e)=>{
      if (!this.active || !this.inspection) return;
      e.preventDefault();
      this.orbit.radius=THREE.MathUtils.clamp(this.orbit.radius*Math.exp(e.deltaY*.001),4.8,8);
    },{passive:false});
  }

  setInspection(value) {
    if (this.transition) return;
    this.inspection=value;
    this.activePart=null;
    if (this.top) setActivePart(this.top,null);
    if (value) this.orbit={yaw:0,pitch:.34,radius:5.8};
    this.container.dispatchEvent(new CustomEvent("inspectionchange",{detail:{active:value}}));
  }

  focusPart(slot) {
    if (!this.inspection || !this.top) return;
    this.activePart=slot;
    setActivePart(this.top,slot);
  }

  attach() {
    this.active = true;
    this.container.append(this.renderer.domElement);
    this.resize();
  }

  detach() {
    if (this.transition) this.advanceLift(this.transition.duration);
    this.setInspection(false);
    this.active = false;
  }

  resize() {
    if (!this.active) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.frameReady) this.renderer.render(this.scene, this.camera);
  }

  setSpecimen(loadout) {
    const key = loadoutVisualKey(loadout);
    if (this.top && this.specimenKey === key) return;
    this.specimenKey = key;
    if (this.top) {
      this.specimen.remove(this.top);
      disposeTopModel(this.top);
    }
    this.top = createTopModel(loadout.build, loadout.colors, loadout.customizations);
    const bounds = new THREE.Box3().setFromObject(this.top);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = Math.min(1.96 / Math.max(size.x, size.z), 1.65 / size.y);
    this.specimen.scale.setScalar(scale);
    this.specimen.position.set(0, .72 - bounds.min.y * scale, 0);
    this.top.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.material.clippingPlanes = [this.clipPlane];
      mesh.material.clipShadows = true;
    });
    this.specimen.add(this.top);
  }

  switchSpecimen(loadout, { onHidden, onComplete, reducedMotion }) {
    if (this.transition) return false;
    this.setInspection(false);
    this.transition = { age: 0, duration: reducedMotion ? .22 : 1.05, loadout, onHidden, onComplete, swapped: false };
    return true;
  }

  advanceLift(delta) {
    const transition = this.transition;
    if (!transition) return;
    transition.age += delta;
    const t = Math.min(1, transition.age / transition.duration);
    const phase = .38;
    this.lift.position.y = t < phase ? -2.5 * ease(t / phase) : -2.5 * (1 - ease((t-phase)/(1-phase)));
    if (t >= phase && !transition.swapped) {
      transition.swapped = true;
      const accepted = transition.onHidden();
      if (accepted !== false) this.setSpecimen(transition.loadout);
    }
    if (t >= 1) {
      this.lift.position.y = 0;
      this.transition = null;
      transition.onComplete();
    }
  }

  update(delta, reducedMotion) {
    if (!this.active) return;
    this.elapsed += delta;
    this.advanceLift(delta);
    if (!reducedMotion && !this.transition && !this.inspection) this.specimen.rotation.y += delta * .16;
    if (this.top) updateTopPartFocus(this.top, delta);
    const t=reducedMotion ? 0 : this.elapsed;
    this.spots.forEach(({spot,beam,origin,length,phase})=>{
      const target=new THREE.Vector3(Math.sin(t*.42+phase)*1.3,.44,Math.cos(t*.31+phase)*.85);
      spot.target.position.copy(target);
      spot.intensity=(this.inspection ? 12 : 24)*(1+Math.sin(t*.7+phase)*.22);
      const axis=origin.clone().sub(target);
      beam.position.copy(origin).add(target).multiplyScalar(.5);
      beam.scale.y=axis.length()/length;
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
      beam.material.opacity=this.inspection ? .012 : .026;
    });
    this.hologram.visible=this.stageId==="holo" && !this.inspection;
    const target=this.inspection ? new THREE.Vector3(0,1.28,0) : new THREE.Vector3(0,.3,0);
    const {yaw,pitch,radius}=this.orbit;
    const position=this.inspection ? new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*radius,
      1.28+Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius) : new THREE.Vector3(.12,4.6,9.8);
    const alpha=reducedMotion ? 1 : 1-Math.exp(-delta*5);
    this.camera.position.lerp(position,alpha);
    this.cameraTarget.lerp(target,alpha);
    this.camera.lookAt(this.cameraTarget);
    this.hologram.material.uniforms.time.value = reducedMotion ? 0 : this.elapsed;
    this.particles.rotation.y = reducedMotion ? 0 : this.elapsed * .018;
    if (this.frameReady) this.renderer.render(this.scene, this.camera);
  }
}
