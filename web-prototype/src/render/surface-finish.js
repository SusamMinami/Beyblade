// Object-space finishes remain attached to each interchangeable part.
export function applySurfaceFinish(material, finish = "machined", scale = 1) {
  material.userData.surfaceFinish = { finish, scale };
  material.customProgramCacheKey = () => `surface-v1-${finish}-${scale}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFinishPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFinishPosition = position;");
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vFinishPosition;
      float finishBand(float phase) {
        return sin(phase) / (1.0 + fwidth(phase) * fwidth(phase));
      }`,
    );
    const pattern = {
      machined: `float grain = finishBand(length(p.xz) * 920.0) * 0.5;
        float tint = 1.0 + grain * 0.055;`,
      polymer: `float grain = finishBand(p.x * 380.0) * finishBand(p.z * 380.0);
        float tint = 1.0 + grain * 0.018;`,
      rubber: `float grain = finishBand(p.x * 210.0) * finishBand(p.z * 210.0);
        float tint = 0.96 + grain * 0.045;`,
      carbon: `float warp = finishBand((p.x + p.z) * 110.0);
        float weft = finishBand((p.x - p.z) * 110.0);
        float grain = warp * weft;
        float tint = 0.86 + grain * 0.17;`,
      wood: `float grain = finishBand(p.x * 65.0 + sin(p.z * 9.0) * 2.4
          + sin(p.y * 13.0) * 1.8);
        float tint = 0.88 + grain * 0.13;`,
      arena: `float radius = length(p.xz);
        float grain = finishBand(radius * 420.0);
        float scuff = finishBand(p.x * 83.0 + sin(p.z * 17.0) * 3.0);
        float tint = 0.97 + grain * 0.022 + scuff * 0.015;`,
      stone: `float grain = finishBand(p.x * 123.0 + sin(p.z * 37.0) * 4.0)
          * finishBand(p.z * 139.0 + sin(p.x * 31.0) * 3.0);
        float broad = sin(p.x * 5.7 + sin(p.z * 3.4)) * sin(p.z * 8.3);
        float tint = 0.84 + grain * 0.17 + broad * 0.1;`,
    }[finish] ?? "float grain = 0.0; float tint = 1.0;";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      vec3 p = vFinishPosition * ${Number(scale).toFixed(3)};
      ${pattern}
      diffuseColor.rgb *= tint;
      roughnessFactor = clamp(roughnessFactor + grain * 0.07, 0.08, 1.0);`,
    );
  };
  return material;
}

export function cloneSurfaceMaterial(material) {
  const clone = material.clone();
  const surface = material.userData.surfaceFinish;
  if (surface) applySurfaceFinish(clone, surface.finish, surface.scale);
  return clone;
}
