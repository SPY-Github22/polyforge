import * as THREE from 'three';
import { MaterialProperties, ShadingMode, TexturePreset } from '../types';

// Cache generated procedural textures to avoid redundant renders
const textureCache = new Map<TexturePreset, THREE.Texture>();

/**
 * Creates pure DataTexture procedural checkerboard (256x256)
 */
function createCheckerTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const tileSize = 32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isEven = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
      const val = isEven ? 235 : 35;
      data[idx] = val;
      data[idx + 1] = isEven ? 240 : 45;
      data[idx + 2] = isEven ? 248 : 60;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates pure DataTexture procedural UV grid (256x256)
 */
function createUVGridTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      const isGrid = x % 32 === 0 || y % 32 === 0;

      if (isBorder) {
        data[idx] = 244;
        data[idx + 1] = 63;
        data[idx + 2] = 94;
      } else if (isGrid) {
        data[idx] = 56;
        data[idx + 1] = 189;
        data[idx + 2] = 248;
      } else {
        data[idx] = 15;
        data[idx + 1] = 23;
        data[idx + 2] = 42;
      }
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates pure DataTexture procedural stripes (256x256)
 */
function createStripesTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const stripeWidth = 32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isLight = Math.floor(x / stripeWidth) % 2 === 0;
      data[idx] = isLight ? 129 : 30;
      data[idx + 1] = isLight ? 140 : 27;
      data[idx + 2] = isLight ? 248 : 75;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates photorealistic oak bark DataTexture (512x512)
 * Features longitudinal furrows, deep crevice shadows, multi-frequency wood grain,
 * and subtle lichen flecks. Works headlessly without DOM canvas.
 */
function createBarkDataTexture(): THREE.DataTexture {
  const width = 512;
  const height = 512;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Longitudinal crevice harmonics
      const nx = (x / width) * Math.PI * 2 * 6; // 6 main vertical columns
      const ny = (y / height) * Math.PI * 2;

      const f1 = Math.sin(nx + Math.sin(ny * 2.0) * 0.4);
      const f2 = Math.cos(nx * 2.3 + Math.cos(ny * 3.5) * 0.3) * 0.5;
      const f3 = Math.sin(nx * 5.1 + ny * 0.5) * 0.25;
      const microGrain = Math.sin(x * 1.8 + Math.cos(y * 0.2) * 4.0) * 0.12;

      const furrow = Math.max(0, Math.min(1, 0.45 + (f1 + f2 + f3) * 0.35 + microGrain));

      // Lichen / moss spots in crevices
      const mossNoise = Math.sin(x * 0.08) * Math.cos(y * 0.06);
      const hasMoss = mossNoise > 0.65 && furrow < 0.4;

      if (hasMoss) {
        // Subtle sage-green lichen
        data[idx] = 68;
        data[idx + 1] = 88;
        data[idx + 2] = 52;
      } else {
        // Deep oak wood gradient from dark crevice (#1d1109) to outer bark ridge (#5c3e29)
        data[idx] = Math.floor(25 + furrow * 68);
        data[idx + 1] = Math.floor(16 + furrow * 46);
        data[idx + 2] = Math.floor(10 + furrow * 30);
      }
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates photorealistic oak leaf sprite atlas (512x512)
 * Contains two distinct oak leaves (mature or young) with rounded lobes,
 * central midrib rachis, lateral veins, and crisp alpha cutout channel.
 */
function createFoliageDataTexture(variant: 'mature' | 'young'): THREE.DataTexture {
  const width = 512;
  const height = 512;
  const data = new Uint8Array(width * height * 4);

  const isYoung = variant === 'young';

  // Base colors
  const baseR = isYoung ? 65 : 34;
  const baseG = isYoung ? 132 : 78;
  const baseB = isYoung ? 36 : 24;

  const veinR = isYoung ? 102 : 62;
  const veinG = isYoung ? 175 : 124;
  const veinB = isYoung ? 54 : 38;

  // We draw 2 oak leaves side-by-side in the texture atlas
  const leaves = [
    { centerU: 0.26, scaleU: 0.22, centerV: 0.5, scaleV: 0.44, lobePhase: 0.0 },
    { centerU: 0.74, scaleU: 0.21, centerV: 0.5, scaleV: 0.43, lobePhase: 0.8 },
  ];

  for (let y = 0; y < height; y++) {
    const v = y / height;

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;

      let inLeaf = false;
      let onVein = false;
      let distToMarginFrac = 0;

      for (const lf of leaves) {
        const dv = (v - (lf.centerV - lf.scaleV)) / (lf.scaleV * 2.0); // 0 at petiole, 1 at tip
        if (dv < 0.02 || dv > 0.98) continue;

        const du = (u - lf.centerU) / lf.scaleU; // -1 to 1 across leaf width
        const absDu = Math.abs(du);

        // Oak lobe profile: 3 distinct lobes on each side
        const lobeWave = Math.sin(dv * Math.PI * 6.0 + lf.lobePhase);
        const profile = Math.sin(dv * Math.PI);
        const halfWidth = profile * (0.65 + 0.32 * lobeWave);

        if (absDu <= halfWidth) {
          inLeaf = true;
          distToMarginFrac = absDu / Math.max(0.001, halfWidth);

          // Central midrib spine
          const distToMidrib = Math.abs(du);
          if (distToMidrib < 0.04) {
            onVein = true;
          }

          // Lateral pinnate veins branching out toward lobe peaks (3 on each side)
          for (let k = 1; k <= 3; k++) {
            const lobeV = (k - 0.2) / 3.0;
            const veinLineV = lobeV + absDu * 0.18;
            if (Math.abs(dv - veinLineV) < 0.022) {
              onVein = true;
            }
          }
          break;
        }
      }

      if (inLeaf) {
        const chlorophyllGradient = 1.0 - distToMarginFrac * 0.35;

        if (onVein) {
          data[idx] = Math.min(255, Math.floor(veinR * 1.15));
          data[idx + 1] = Math.min(255, Math.floor(veinG * 1.15));
          data[idx + 2] = Math.min(255, Math.floor(veinB * 1.15));
        } else {
          // Cellular micro-variation
          const cellNoise = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 6;
          data[idx] = Math.max(0, Math.min(255, Math.floor(baseR * chlorophyllGradient + cellNoise)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.floor(baseG * chlorophyllGradient + cellNoise)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.floor(baseB * chlorophyllGradient + cellNoise)));
        }
        data[idx + 3] = 255; // Fully opaque inside leaf
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0; // Fully transparent outside leaf
      }
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedurally generates 2D textures (Checkerboard, UV Grid, Stripes, Oak Bark, Oak Foliage)
 * Operates purely in memory using Three.js DataTexture; works identically in browser and Node.js CLI.
 */
export function getProceduralTexture(type: TexturePreset): THREE.Texture | null {
  if (type === 'none') return null;
  if (textureCache.has(type)) return textureCache.get(type)!;

  let tex: THREE.Texture | null = null;
  switch (type) {
    case 'checker':
      tex = createCheckerTexture();
      break;
    case 'uv_grid':
      tex = createUVGridTexture();
      break;
    case 'stripes':
      tex = createStripesTexture();
      break;
    case 'bark':
    case 'bark_oak':
      tex = createBarkDataTexture();
      break;
    case 'foliage':
    case 'leaf_oak_mature':
      tex = createFoliageDataTexture('mature');
      break;
    case 'leaf_oak_young':
      tex = createFoliageDataTexture('young');
      break;
    default:
      return null;
  }

  if (tex) {
    textureCache.set(type, tex);
  }
  return tex;
}

/**
 * Creates a Three.js material configured for the selected shading mode & properties.
 */
export function createMaterial(
  props: MaterialProperties,
  shadingMode: ShadingMode = 'rendered'
): THREE.Material {
  const side = props.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  const vertexColors = !!props.vertexColors;

  switch (shadingMode) {
    case 'wireframe':
      return new THREE.MeshBasicMaterial({
        color: new THREE.Color(props.color),
        wireframe: true,
        side,
        vertexColors,
      });

    case 'normals':
      return new THREE.MeshNormalMaterial({
        wireframe: props.wireframe,
        side,
      });

    case 'solid':
      return new THREE.MeshLambertMaterial({
        color: new THREE.Color(props.color),
        wireframe: props.wireframe,
        side,
        vertexColors,
      });

    case 'rendered':
    default: {
      const texture = getProceduralTexture(props.texturePreset);
      const alphaTest = typeof props.alphaTest === 'number' ? props.alphaTest : 0;
      const isTransparent = props.transparent || (alphaTest === 0 && (props.transmission > 0 || props.opacity < 1.0));
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(props.color),
        roughness: props.roughness,
        metalness: props.metalness,
        emissive: new THREE.Color(props.emissive),
        emissiveIntensity: props.emissiveIntensity,
        transmission: props.transmission,
        opacity: props.opacity,
        transparent: isTransparent,
        wireframe: props.wireframe,
        map: texture,
        alphaTest: alphaTest,
        depthWrite: true,
        clearcoat: 0.1,
        clearcoatRoughness: 0.1,
        ior: 1.5,
        side,
        vertexColors,
      });
      return mat;
    }
  }
}

/**
 * Updates an existing Three.js material in-place to avoid rebuild overhead.
 */
export function updateMaterial(
  material: THREE.Material,
  props: MaterialProperties,
  shadingMode: ShadingMode = 'rendered'
): void {
  const side = props.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  material.side = side;

  if (material instanceof THREE.MeshPhysicalMaterial && shadingMode === 'rendered') {
    material.color.set(props.color);
    material.roughness = props.roughness;
    material.metalness = props.metalness;
    material.emissive.set(props.emissive);
    material.emissiveIntensity = props.emissiveIntensity;
    material.transmission = props.transmission;
    material.opacity = props.opacity;
    const alphaTest = typeof props.alphaTest === 'number' ? props.alphaTest : 0;
    material.transparent = props.transparent || (alphaTest === 0 && (props.transmission > 0 || props.opacity < 1.0));
    material.wireframe = props.wireframe;
    material.map = getProceduralTexture(props.texturePreset);
    if (typeof props.alphaTest === 'number') {
      material.alphaTest = props.alphaTest;
    }
    material.depthWrite = true;
    material.needsUpdate = true;
  } else if (material instanceof THREE.MeshStandardMaterial) {
    material.color.set(props.color);
    material.roughness = props.roughness;
    material.metalness = props.metalness;
    material.wireframe = props.wireframe;
    material.needsUpdate = true;
  }
}
