import * as THREE from "three";

const SPARK_COUNT = 192;
const TRAIL_COUNT = 48;

export class BattleEffects {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.cursor = 0;
    this.sparks = Array.from({ length: SPARK_COUNT }, () => ({
      life: 0, duration: 1, position: new THREE.Vector3(), velocity: new THREE.Vector3(),
    }));
    this.sparkGeometry = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(SPARK_COUNT * 6);
    this.sparkColors = new Float32Array(SPARK_COUNT * 6);
    this.sparkGeometry.setAttribute("position",
      new THREE.BufferAttribute(this.sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeometry.setAttribute("color",
      new THREE.BufferAttribute(this.sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkMesh = new THREE.LineSegments(this.sparkGeometry, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    this.sparkMesh.frustumCulled = false;
    this.root.add(this.sparkMesh);
    this.flash = new THREE.PointLight(0xffb45e, 0, 5, 2);
    this.root.add(this.flash);
    this.time=0;
    this.halos=[0x43edff,0xff9147].map(color=>{
      const group=new THREE.Group();
      for (let i=0;i<3;i++) {
        const arc=new THREE.Mesh(new THREE.TorusGeometry(.65+i*.11,.014+i*.004,5,48,Math.PI*(1.2-i*.18)),
          new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7-i*.17,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
        arc.rotation.x=Math.PI/2;
        arc.rotation.z=i*2.1;
        arc.position.y=i*.035;
        group.add(arc);
      }
      this.root.add(group);
      return group;
    });
    this.trails = [0x38dac6, 0xff795c].map((hex) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(TRAIL_COUNT * 6);
      const colors = new Float32Array(TRAIL_COUNT * 6);
      const indices = [];
      for (let i = 0; i < TRAIL_COUNT - 1; i += 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geometry.setAttribute("position",
        new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("color",
        new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(indices);
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.DoubleSide, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      const ribbon = new THREE.Mesh(geometry, material);
      ribbon.frustumCulled = false;
      ribbon.visible = false;
      this.root.add(ribbon);
      return {
        ribbon, geometry, positions, colors, color: new THREE.Color(hex), count: 0,
        history: Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3()),
      };
    });
  }

  reset() {
    this.sparks.forEach((spark) => { spark.life = 0; });
    this.sparkColors.fill(0);
    this.sparkGeometry.attributes.color.needsUpdate = true;
    this.flash.intensity = 0;
    this.halos.forEach(halo=>{halo.visible=false;});
    this.trails.forEach((trail) => {
      trail.count = 0;
      trail.ribbon.visible = false;
    });
  }

  impact(position, intensity, reducedMotion) {
    this.flash.position.copy(position);
    this.flash.intensity = reducedMotion ? 0 : 14 + intensity * 26;
    if (reducedMotion) return;
    const count = 16 + Math.round(Math.min(intensity, 1) * 34);
    for (let index = 0; index < count; index += 1) {
      const spark = this.sparks[this.cursor++ % SPARK_COUNT];
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * (2 + intensity * 4);
      spark.position.copy(position);
      spark.velocity.set(Math.cos(angle) * speed, 1 + Math.random() * 3,
        Math.sin(angle) * speed);
      spark.duration = 0.22 + Math.random() * 0.3;
      spark.life = spark.duration;
    }
  }

  update(delta, models, running, reducedMotion) {
    this.time+=delta;
    this.halos.forEach((halo,i)=>{
      const model=models[i];
      halo.visible=Boolean(model && running && !reducedMotion);
      if (!halo.visible) return;
      halo.position.copy(model.position);
      halo.position.y=(model.userData.groundHeight??0)+.16;
      halo.rotation.y=this.time*(i ? -11 : 12);
      const spin=model.userData.spinRatio??1;
      halo.scale.setScalar(.85+spin*.3);
      halo.children.forEach((arc,j)=>{arc.material.opacity=(.68-j*.16)*spin;});
    });
    this.flash.intensity *= Math.exp(-delta * 18);
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const spark = this.sparks[index];
      spark.life = Math.max(0, spark.life - delta);
      const offset = index * 6;
      const strength = spark.life / spark.duration;
      if (strength > 0) {
        spark.velocity.y -= delta * 9.8;
        spark.position.addScaledVector(spark.velocity, delta);
      }
      for (let axis = 0; axis < 3; axis += 1) {
        const position = spark.position.getComponent(axis);
        this.sparkPositions[offset + axis] = position;
        this.sparkPositions[offset + axis + 3] =
          position - spark.velocity.getComponent(axis) * 0.025 * strength;
        this.sparkColors[offset + axis] = strength * [1, 0.68, 0.22][axis] * 2;
        this.sparkColors[offset + axis + 3] = strength * [1, 0.32, 0.04][axis];
      }
    }
    this.sparkGeometry.attributes.position.needsUpdate = true;
    this.sparkGeometry.attributes.color.needsUpdate = true;
    this.trails.forEach((trail, index) => {
      const model = models[index];
      trail.ribbon.visible = Boolean(model && running && !reducedMotion);
      if (!trail.ribbon.visible) {
        trail.count = 0;
        return;
      }
      const position = model.position;
      const distance = Math.hypot(position.x - trail.history[0].x,
        position.z - trail.history[0].z);
      if (delta > 0 && (trail.count === 0 || distance > 0.02)) {
        for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
          trail.history[i].copy(trail.history[i - 1]);
        }
        trail.history[0].copy(position);
        trail.history[0].y = (model.userData.groundHeight ?? position.y
          - model.userData.contactOffset * model.scale.y) + 0.045;
        trail.count = Math.min(TRAIL_COUNT, trail.count + 1);
      }
      const last = Math.max(0, trail.count - 1);
      for (let i = 0; i < TRAIL_COUNT; i += 1) {
        const point = trail.history[Math.min(i, last)];
        const next = trail.history[Math.min(i + 1, last)];
        const dx = next.x - point.x;
        const dz = next.z - point.z;
        const length = Math.max(Math.hypot(dx, dz), 0.001);
        const fade = (1 - i / Math.max(trail.count, 1)) ** 2;
        const width = 0.16 * fade;
        for (let side = 0; side < 2; side += 1) {
          const offset = i * 6 + side * 3;
          const sign = side === 0 ? -1 : 1;
          trail.positions[offset] = point.x + dz / length * width * sign;
          trail.positions[offset + 1] = point.y;
          trail.positions[offset + 2] = point.z - dx / length * width * sign;
          trail.colors[offset] = trail.color.r * fade * 1.7;
          trail.colors[offset + 1] = trail.color.g * fade * 1.7;
          trail.colors[offset + 2] = trail.color.b * fade * 1.7;
        }
      }
      trail.geometry.setDrawRange(0, Math.max(0, trail.count - 1) * 6);
      trail.geometry.attributes.position.needsUpdate = true;
      trail.geometry.attributes.color.needsUpdate = true;
    });
  }

  dispose() {
    this.root.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    this.root.removeFromParent();
  }
}
