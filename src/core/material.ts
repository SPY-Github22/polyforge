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
        data[idx] = 88;
        data[idx + 1] = 112;
        data[idx + 2] = 68;
      } else {
        // Rich warm oak wood gradient from dark crevice (#26180f) to outer bark ridge (#734d31)
        data[idx] = Math.floor(38 + furrow * 77);
        data[idx + 1] = Math.floor(24 + furrow * 53);
        data[idx + 2] = Math.floor(15 + furrow * 34);
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

  // Base colors: rich lush chlorophyll tones for mature and fresh golden-green for young foliage
  const baseR = isYoung ? 82 : 52;
  const baseG = isYoung ? 165 : 120;
  const baseB = isYoung ? 42 : 35;

  const veinR = isYoung ? 128 : 85;
  const veinG = isYoung ? 210 : 168;
  const veinB = isYoung ? 68 : 50;

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
 * Creates photorealistic 2x2 twill weave carbon fiber DataTexture (256x256).
 * Features orthogonal yarn tows with arched specular highlights and bundle crevices.
 */
function createCarbonFiberTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const cellSize = 32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const inCellX = (x % cellSize) / cellSize;
      const inCellY = (y % cellSize) / cellSize;

      const isHorizontalTow = ((cellX + cellY) % 2 === 0);

      let brightness: number;
      if (isHorizontalTow) {
        const arch = Math.sin(inCellY * Math.PI);
        const micro = 0.85 + 0.15 * Math.sin(y * 4.0);
        brightness = (45 + arch * 40) * micro;
      } else {
        const arch = Math.sin(inCellX * Math.PI);
        const micro = 0.85 + 0.15 * Math.sin(x * 4.0);
        brightness = (30 + arch * 35) * micro;
      }

      const isCrease = inCellX < 0.04 || inCellX > 0.96 || inCellY < 0.04 || inCellY > 0.96;
      if (isCrease) brightness *= 0.6;

      const val = Math.max(10, Math.min(255, Math.floor(brightness)));
      data[idx] = val;
      data[idx + 1] = Math.floor(val * 1.02);
      data[idx + 2] = Math.floor(val * 1.06);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates realistic vulcanized rubber bicycle tire tread DataTexture (512x512).
 * Features smooth rolling center strip, directional herringbone sipes, and bead groove.
 */
function createTireTreadTexture(): THREE.DataTexture {
  const width = 512;
  const height = 512;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;

      const distFromCenter = Math.abs(u - 0.5);

      let baseTone = 38;
      let isGroove = false;

      if (distFromCenter < 0.12) {
        const micro = Math.sin(x * 0.8) * Math.cos(y * 0.8) * 3;
        baseTone += micro;
      } else if (distFromCenter < 0.38) {
        const sipeFrequency = 24.0;
        const sipeAngle = (u > 0.5 ? 1 : -1) * (distFromCenter - 0.12) * 6.0;
        const sipePhase = Math.sin((v * sipeFrequency + sipeAngle) * Math.PI * 2);

        if (sipePhase > 0.72) {
          isGroove = true;
        } else {
          const pebble = Math.sin(x * 0.9) * Math.cos(y * 0.9);
          baseTone += pebble * 6;
        }
      } else {
        const isBeadLine = Math.abs(distFromCenter - 0.46) < 0.015;
        if (isBeadLine) {
          baseTone = 20;
        } else {
          baseTone = 32;
        }
      }

      if (isGroove) {
        baseTone = 14;
      }

      const val = Math.max(10, Math.min(255, Math.floor(baseTone)));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates high-frequency anisotropic brushed metal DataTexture (256x256).
 * Simulates CNC-lathed and brushed aluminum/titanium bicycle components.
 */
function createBrushedMetalTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);

  const streakNoise: number[] = new Array(width);
  for (let x = 0; x < width; x++) {
    streakNoise[x] =
      Math.sin(x * 0.45) * 0.35 +
      Math.sin(x * 1.83) * 0.25 +
      Math.sin(x * 5.71) * 0.20 +
      Math.sin(x * 17.3) * 0.20;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const microY = Math.sin(y * 0.1) * 0.08;
      const val = Math.max(160, Math.min(245, Math.floor(200 + (streakNoise[x] + microY) * 45)));

      data[idx] = val;
      data[idx + 1] = Math.floor(val * 0.99);
      data[idx + 2] = Math.floor(val * 1.01);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates micro-perforated saddle leather DataTexture (256x256).
 * Features staggered breathable perforation holes with beveled edges.
 */
function createLeatherPerforatedTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const holeSpacing = 16;
  const holeRadiusSq = 3.2 * 3.2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const row = Math.floor(y / holeSpacing);
      const xOffset = (row % 2 === 1) ? holeSpacing / 2 : 0;
      const localX = (x + xOffset) % holeSpacing - holeSpacing / 2;
      const localY = (y % holeSpacing) - holeSpacing / 2;
      const distSq = localX * localX + localY * localY;

      let tone = 36;
      const grain = Math.sin(x * 0.6) * Math.cos(y * 0.6) * 5;
      tone += grain;

      if (distSq < holeRadiusSq) {
        tone = 10;
      } else if (distSq < holeRadiusSq * 1.8) {
        tone += 16;
      }

      const val = Math.max(0, Math.min(255, Math.floor(tone)));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates micro-prismatic amber retroreflector DataTexture (256x256).
 * Features corner-cube reflective facets for pedals and safety reflectors.
 */
function createReflectorTexture(): THREE.DataTexture {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const cellSize = 16;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cellX = (x % cellSize) / cellSize - 0.5;
      const cellY = (y % cellSize) / cellSize - 0.5;

      const facet = Math.abs(cellX) + Math.abs(cellY);
      const highlight = Math.max(0, 1.0 - facet * 1.6);

      data[idx] = Math.min(255, Math.floor(230 + highlight * 25));
      data[idx + 1] = Math.min(255, Math.floor(130 + highlight * 75));
      data[idx + 2] = Math.min(255, Math.floor(15 + highlight * 45));
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedurally generates 2D textures (Checkerboard, UV Grid, Stripes, Oak Bark, Oak Foliage, Carbon Fiber, Tire Tread, Brushed Metal, Perforated Leather, Reflector)
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
    case 'carbon_fiber':
      tex = createCarbonFiberTexture();
      break;
    case 'tire_tread':
      tex = createTireTreadTexture();
      break;
    case 'brushed_metal':
      tex = createBrushedMetalTexture();
      break;
    case 'leather_perforated':
      tex = createLeatherPerforatedTexture();
      break;
    case 'reflector_amber':
      tex = createReflectorTexture();
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

      // For textured materials with vertex colors (e.g. bark and oak foliage),
      // Three.js multiplies material.color * vertexColors * textureMap.
      // Setting a dark material.color causes triple color multiplication that extinguishes light to pitch black.
      // For textured materials with vertex colors, material.color must be #ffffff (white) to preserve texture diffuse.
      const isTexturedWithVertexColors = !!texture && vertexColors;
      const effectiveColor = isTexturedWithVertexColors ? '#ffffff' : props.color;

      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(effectiveColor),
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
    const texture = getProceduralTexture(props.texturePreset);
    const isTexturedWithVertexColors = !!texture && (!!material.vertexColors || !!props.vertexColors);
    const effectiveColor = isTexturedWithVertexColors ? '#ffffff' : props.color;

    material.color.set(effectiveColor);
    material.roughness = props.roughness;
    material.metalness = props.metalness;
    material.emissive.set(props.emissive);
    material.emissiveIntensity = props.emissiveIntensity;
    material.transmission = props.transmission;
    material.opacity = props.opacity;
    const alphaTest = typeof props.alphaTest === 'number' ? props.alphaTest : 0;
    material.transparent = props.transparent || (alphaTest === 0 && (props.transmission > 0 || props.opacity < 1.0));
    material.wireframe = props.wireframe;
    material.map = texture;
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
