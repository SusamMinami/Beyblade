import * as THREE from "three";

// World-space surface relief for the authored battle worlds. No UV unwrap,
// raster download, displacement geometry, or changes to the collision surface.
const noise = /* glsl */`
  varying vec3 vSurfaceWorld;
  float surfaceHash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float surfaceNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(surfaceHash(i), surfaceHash(i + vec3(1,0,0)), f.x),
          mix(surfaceHash(i + vec3(0,1,0)), surfaceHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(surfaceHash(i + vec3(0,0,1)), surfaceHash(i + vec3(1,0,1)), f.x),
          mix(surfaceHash(i + vec3(0,1,1)), surfaceHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float surfaceGrain(vec3 p) {
    // Fade unresolved grit instead of turning it into temporal sparkle.
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    return mix(surfaceNoise(p), .5, smoothstep(.65, 2.0, footprint));
  }
  float surfaceLine(float distanceToLine, float width) {
    float aa = max(fwidth(distanceToLine), .0001);
    return 1.0 - smoothstep(width, width + aa, abs(distanceToLine));
  }
  vec3 surfaceRelief(vec3 n, float height) {
    vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
    vec3 rx = cross(dy, n), ry = cross(n, dx);
    float determinant = dot(dx, rx);
    vec3 gradient = sign(determinant) * (dFdx(height) * rx + dFdy(height) * ry);
    return normalize(max(abs(determinant), 1e-8) * n - gradient);
  }
`;

const patterns = {
  titanium: /* glsl */`
    float radius = length(p.xz);
    float angle = atan(p.z, p.x);
    float sector = floor((angle + 3.14159265) / .52359878);
    float radialJoin = surfaceLine(sin(angle * 6.0) * radius / 6.0, .007);
    radialJoin *= smoothstep(4.85, 5.0, radius) * (1.0-smoothstep(6.35,6.48,radius));
    float arcJoin = surfaceLine(radius - (4.85 + mod(sector,2.0)*.35), .004);
    float perimeter = surfaceLine(radius-6.48,.012);
    vec2 hexGrid = vec2(1.0,1.7320508);
    vec2 hexA = mod(p.xz/1.3,hexGrid)-hexGrid*.5;
    vec2 hexB = mod(p.xz/1.3-hexGrid*.5,hexGrid)-hexGrid*.5;
    vec2 hexP = abs(dot(hexA,hexA)<dot(hexB,hexB) ? hexA : hexB);
    float hexEdge = .5-max(dot(hexP,vec2(.5,.8660254)),hexP.x);
    float etch = surfaceLine(hexEdge,.002)*.28*(1.0-smoothstep(4.4,4.8,radius));
    float join = max(etch,max(perimeter, max(radialJoin, arcJoin)));
    float grain = surfaceGrain(vec3(radius*210.0,p.y*3.0,0.0));
    float polish = smoothstep(5.95,6.85,radius);
    float wear = surfaceNoise(p * 2.2);
    float scuff = surfaceLine(radius + surfaceNoise(p*.75)*.05-5.45,.014);
    scuff *= smoothstep(.52,.72,wear);
    float plate = surfaceHash(vec3(sector, floor(radius/3.8), 7.0));
    diffuseColor.rgb *= .89 + plate*.10 + grain*.035;
    diffuseColor.rgb *= 1.0-join*.16;
    roughnessFactor = mix(.28,.19,polish) + (grain-.5)*.09 + scuff*.15;
    surfaceHeight = grain*.00055 - join*.00065 - scuff*.0009;
    surfaceCavity = 1.0-join*.08;
    surfaceCoat = mix(.16,.32,polish);
    surfaceCoatRoughness = .24;
  `,
  enamel: /* glsl */`
    float grain = surfaceGrain(p*120.0);
    float coating = surfaceNoise(p*5.0);
    diffuseColor.rgb *= .94 + coating*.07 + grain*.035;
    roughnessFactor = roughness + (grain-.5)*.07 + (coating-.5)*.045;
    surfaceHeight = grain*.0008;
    surfaceCoat = .38;
    surfaceCoatRoughness = .23;
  `,
  polished: /* glsl */`
    float grain = surfaceGrain(p*vec3(145.0,4.0,4.0));
    diffuseColor.rgb *= .96 + grain*.07;
    roughnessFactor = roughness + (grain-.5)*.045;
    surfaceHeight = grain*.00025;
    surfaceCoat = .18;
    surfaceCoatRoughness = .13;
  `,
  acrylic: /* glsl */`
    float angle = atan(p.z,p.x);
    float seam = surfaceLine(sin(angle*6.0)*length(p.xz)/6.0,.012);
    float edges = max(surfaceLine(p.y-.37,.018),surfaceLine(p.y-.89,.012));
    float grazing = pow(1.0-abs(dot(normalize(vec3(p.x,0.0,p.z)),
      normalize(cameraPosition-p))),3.0);
    float edge = max(seam,edges);
    diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.36,.55,.62),edge*.30);
    diffuseColor.a *= .36+grazing*.64+edge*.65;
    roughnessFactor = .12 + edge*.08;
    surfaceCoat = .72;
    surfaceCoatRoughness = .09;
  `,
  slate: /* glsl */`
    vec2 tile = fract(p.xz / 1.33);
    vec3 cell = vec3(floor(p.xz / 1.33), 4.7);
    float edge = min(min(tile.x, 1.0-tile.x), min(tile.y, 1.0-tile.y));
    float rim = 1.0-smoothstep(.025, .11, edge);
    float strata = surfaceNoise(p * vec3(3.8, 22.0, 3.8));
    float mineral = surfaceGrain(p * 54.0);
    float wetPatch = surfaceNoise(p * 1.35 + strata * .3);
    float wet = smoothstep(.40, .72, wetPatch) * (1.0-rim*.75);
    float crackPath = tile.y - (.24 + tile.x*.37 + sin(tile.x*17.0)*.022);
    float crack = surfaceLine(crackPath, .0035) * step(.65, surfaceHash(cell));
    float pits = smoothstep(.68, .85, mineral);
    diffuseColor.rgb *= (.72 + strata*.36 + mineral*.16) * (1.0-wet*.22);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.018,.032,.031), rim*.23+crack*.67);
    roughnessFactor = mix(.83, .25, wet) + pits*.10;
    surfaceHeight = strata*.022 + mineral*.009 - pits*.012 - crack*.014;
    surfaceCavity = 1.0 - rim*.16 - crack*.28;
    surfaceCoat = wet*.32;
    surfaceCoatRoughness = .19;
  `,
  stone: /* glsl */`
    float strata = surfaceNoise(p * vec3(3.0, 6.0, 3.0));
    float grain = surfaceGrain(p * 44.0);
    float weather = surfaceNoise(p * 1.7);
    float pits = smoothstep(.67, .87, grain);
    float damp = (1.0-smoothstep(-.2, 1.5, p.y)) * smoothstep(.35,.75,weather);
    diffuseColor.rgb *= .67 + strata*.35 + grain*.25;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.034,.063,.054), damp*.32);
    roughnessFactor = mix(.88, .46, damp);
    surfaceHeight = strata*.014 + grain*.007 - pits*.009;
    surfaceCavity = 1.0-pits*.16;
  `,
  bronze: /* glsl */`
    float casting = surfaceNoise(p * 8.0);
    float grain = surfaceGrain(p * 100.0);
    float oxidation = smoothstep(.37,.68,surfaceNoise(p*3.1)+casting*.17);
    float scratches = surfaceGrain(p * vec3(4.0, 80.0, 4.0));
    diffuseColor.rgb = mix(vec3(.32,.205,.081) * (.8+grain*.3),
      vec3(.038,.097,.078), oxidation*.85);
    roughnessFactor = mix(.25,.76,oxidation) + scratches*.06;
    surfaceMetalness = mix(.88,.25,oxidation);
    surfaceHeight = casting*.005 + grain*.002 + oxidation*.004;
    surfaceCavity = 1.0-oxidation*.15;
  `,
  asphalt: /* glsl */`
    float aggregate = surfaceGrain(p * 23.0);
    float micro = surfaceGrain(p * 88.0);
    float wetPatch = surfaceNoise(p * .58);
    float wet = smoothstep(.39,.67,wetPatch);
    float stones = smoothstep(.58,.79,aggregate);
    float pits = 1.0-smoothstep(.18,.35,aggregate);
    diffuseColor.rgb = mix(vec3(.028,.032,.033), vec3(.078,.073,.064), stones*.52);
    diffuseColor.rgb *= .78 + micro*.32;
    diffuseColor.rgb *= 1.0-wet*.34;
    roughnessFactor = mix(.88,.38,wet) + stones*.08;
    surfaceMetalness = 0.0;
    surfaceHeight = aggregate*.012 + micro*.002 - pits*.005;
    surfaceCavity = 1.0-pits*.28;
    surfaceCoat = wet*.3;
    surfaceCoatRoughness = .26;
  `,
  plastic: /* glsl */`
    float radius = length(p.xz);
    float rim = smoothstep(4.4,6.45,radius);
    float grain = surfaceGrain(p * 110.0);
    float wear = surfaceNoise(p * 2.8);
    float arcRadius = radius + surfaceNoise(p*.8)*.07;
    float arcs = max(surfaceLine(arcRadius-2.32,.005),
      max(surfaceLine(arcRadius-3.71,.007),surfaceLine(arcRadius-5.12,.005)));
    arcs *= smoothstep(.48,.68,surfaceNoise(p*1.4));
    float scuffs = surfaceLine(p.x*.6+p.z-1.25,.009);
    scuffs *= smoothstep(.54,.76,wear) * (1.0-rim);
    float worn = arcs*.42+scuffs*.26;
    diffuseColor.rgb *= vec3(1.0,.985,.95) * (.97+grain*.03-worn*.13);
    roughnessFactor = mix(.35,.145,rim) + worn*.27 + (wear-.5)*.055;
    surfaceHeight = grain*.00035 - worn*.0008;
    surfaceCoat = mix(.32,.78,rim) * (1.0-worn*.72);
    surfaceCoatRoughness = mix(.27,.11,rim) + worn*.18;
  `,
  glaze: /* glsl */`
    float glaze = surfaceNoise(p * 2.2);
    float grain = surfaceGrain(p * 38.0);
    diffuseColor.rgb *= .9 + glaze*.16;
    roughnessFactor = roughness * (.8+glaze*.4);
    surfaceHeight = glaze*.007 + grain*.0009;
    surfaceCoat = .65;
    surfaceCoatRoughness = .13;
  `,
  terracotta: /* glsl */`
    float grain = surfaceGrain(p * 25.0);
    float clay = surfaceNoise(p * 2.2);
    float rings = sin(p.y*38.0) / (1.0+pow(fwidth(p.y*38.0),2.0));
    float damp = (1.0-smoothstep(-.5,2.0,p.y)) * .35;
    diffuseColor.rgb *= (.73+clay*.29+grain*.20) * (1.0-damp);
    roughnessFactor = .82+grain*.13;
    surfaceHeight = grain*.018 + rings*.0025;
  `,
  rubber: /* glsl */`
    float grain = surfaceGrain(p*55.0);
    float dust = smoothstep(.43,.76,surfaceNoise(p*2.7));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.08,.067,.047), dust*.25);
    roughnessFactor = .82 + grain*.15;
    surfaceMetalness = 0.0;
    surfaceHeight = grain*.008;
  `,
  metal: /* glsl */`
    float stain = surfaceNoise(p*3.4);
    float grain = surfaceGrain(p*vec3(150.0,3.0,4.0));
    diffuseColor.rgb *= .82+stain*.22+grain*.09;
    roughnessFactor = roughness + (grain-.5)*.12 + smoothstep(.65,.85,stain)*.18;
    surfaceHeight = grain*.0014;
  `,
  wood: /* glsl */`
    float fibres = surfaceGrain(p*vec3(15.0,.35,15.0));
    float pores = surfaceGrain(p*vec3(73.0,1.4,73.0));
    diffuseColor.rgb *= .67+fibres*.47+pores*.13;
    roughnessFactor = .52+fibres*.23;
    surfaceHeight = fibres*.018+pores*.004;
  `,
  fabric: /* glsl */`
    float weave = surfaceGrain(p*vec3(60.0,60.0,3.0));
    float dust = surfaceNoise(p*.65);
    diffuseColor.rgb *= .8+dust*.22+weave*.10;
    roughnessFactor = .94;
    surfaceHeight = weave*.006;
  `,
  crystal: /* glsl */`
    float veins = surfaceNoise(p*vec3(17.0,3.0,17.0));
    diffuseColor.rgb *= .42+veins*.44;
    roughnessFactor = .13+veins*.07;
    surfaceMetalness = .08;
    surfaceCoat = .85;
    surfaceCoatRoughness = .09;
  `,
};

export function physicalSurface(source, parameters = {}) {
  const material = new THREE.MeshPhysicalMaterial();
  if (source.isMeshPhysicalMaterial) material.copy(source);
  else THREE.MeshStandardMaterial.prototype.copy.call(material, source);
  // Standard.copy resets defines. Keep actual and precompiled physical
  // variants identical, including dielectric IOR/specular support.
  material.defines = { STANDARD: "", PHYSICAL: "" };
  Object.assign(material, parameters);
  return material;
}

export function applyWorldSurface(material, kind) {
  if (!patterns[kind]) throw new Error(`Unknown world surface: ${kind}`);
  delete material.userData.surfaceFinish;
  material.userData.worldSurface = kind;
  material.customProgramCacheKey = () => `world-surface-v1-${kind}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSurfaceWorld;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vSurfaceWorld = (modelMatrix * vec4(position, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${noise}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        vec3 p = vSurfaceWorld;
        float surfaceHeight = 0.0, surfaceCavity = 1.0;
        float surfaceMetalness = metalness;
        float surfaceCoat = 0.0, surfaceCoatRoughness = .2;
        ${patterns[kind]}
        roughnessFactor = clamp(roughnessFactor, .10, 1.0);`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
        metalnessFactor = surfaceMetalness;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        normal = surfaceRelief(normal, surfaceHeight);`)
      .replace("#include <clearcoat_normal_fragment_maps>", `#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = surfaceRelief(clearcoatNormal, surfaceHeight*.18);
        #endif`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat = surfaceCoat;
          material.clearcoatRoughness = max(surfaceCoatRoughness, geometryRoughness);
        #endif`)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= surfaceCavity;`);
    if (kind === "crystal") {
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `
        #include <emissivemap_fragment>
        float crystalRadiance = .24 + surfaceNoise(p*vec3(11.0,2.0,11.0))*.34;
        if (p.z < -8.8 && abs(p.x) < .65) {
          float diamond = abs(p.x)*1.5 + abs(fract(p.y*1.2)-.5)*.64 - .24;
          float glyph = surfaceLine(diamond,.016);
          float spine = surfaceLine(p.x,.018);
          float border = surfaceLine(abs(p.x)-.48,.012);
          crystalRadiance = .11 + max(glyph,max(spine*.65,border)) * 1.4;
        }
        totalEmissiveRadiance *= crystalRadiance;`);
    }
  };
  material.needsUpdate = true;
  return material;
}
