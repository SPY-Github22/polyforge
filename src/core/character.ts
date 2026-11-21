import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';
import { applySubdivisionRefinement } from './geometry';
import {
  CHARACTER_VERTS_B64,
  MALE_GENERIC_QUADS_B64,
  HAIR_QUADS_B64,
  EYEBROW_QUADS_B64,
  EYE_QUADS_B64,
  TEETH_QUADS_B64,
  TONGUE_QUADS_B64,
  UPPER_SUIT_QUADS_B64,
  LOWER_SUIT_QUADS_B64,
  SHOES_QUADS_B64,
} from './characterData';

export interface RealisticHumanOptions {
  gender?: 'male' | 'female';     // default 'male'
  includeClothing?: boolean;      // default true
  includeAccessories?: boolean;   // default true
  includeGlasses?: boolean;       // default false (optional eyewear)
  shirtColor?: string;            // default '#1e3a8a' (Fitted shirt/jacket)
  pantsColor?: string;            // default '#1e293b' (Denim jeans)
  shoesColor?: string;            // default '#334155' (Oiled boots/sneakers)
  skinColor?: string;             // default '#d4a373' (Warm melanin peach-tan)
  hairColor?: string;             // default '#1c1917' (Dark brown/black)
  glassesColor?: string;          // default '#0f172a' (Matte slate black)
  watchColor?: string;            // default '#cbd5e1' (Brushed titanium/silver)
  subdivide?: boolean;            // optional Catmull-Clark / subdivision refinement
  seed?: number;
}

export interface RealisticFemaleOptions {
  includeClothing?: boolean;      // default true
  includeAccessories?: boolean;   // default true
  includeGlasses?: boolean;       // default false (optional eyewear)
  topColor?: string;              // default '#e11d48' (Fitted rose/crimson streetwear top)
  shirtColor?: string;            // alias for topColor
  pantsColor?: string;            // default '#1e293b' (High-waisted indigo denim jeans)
  shoesColor?: string;            // default '#f8fafc' (Crisp white street sneakers)
  skinColor?: string;             // default '#e0ac82' (Warm feminine melanin peach-tan)
  hairColor?: string;             // default '#261a15' (Chestnut brown / dark brunette)
  glassesColor?: string;          // default '#0f172a' (Matte slate black)
  watchColor?: string;            // default '#cbd5e1' (Brushed titanium/silver)
  subdivide?: boolean;            // optional Catmull-Clark / subdivision refinement
  seed?: number;
}

export interface RealisticHumanResult {
  bodyItem: SceneItem;
  clothingUpperItem?: SceneItem;
  clothingLowerItem?: SceneItem;
  footwearItem?: SceneItem;
  accessoriesItem?: SceneItem;
  allItems: SceneItem[];
  stats: {
    bodyVertices: number;
    bodyTriangles: number;
    clothingVertices: number;
    clothingTriangles: number;
    footwearVertices: number;
    footwearTriangles: number;
    accessoriesVertices: number;
    accessoriesTriangles: number;
    totalVertices: number;
    totalTriangles: number;
    componentsCount: number;
    height: number;
  };
}

function decodeFloat32(b64: string): Float32Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

function decodeUint16(b64: string): Uint16Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Uint16Array(bytes.buffer);
}

/**
 * Generates an ultra-realistic, anatomically proportioned 3D human character.
 * Built from organic manifold quad topology (35,000 - 70,000+ vertices),
 * grounded at y = 0.00m, exactly 1.78m tall.
 * Features organic facial sculpting (zygomatic arches, eyelids, philtrum, nose, lips),
 * seamless continuous tailoring (closed seat, zero buttocks cutout, zero nape bald patch),
 * articulated 5-finger hands, and procedural PBR materials.
 */
export function generateRealisticHumanScene(
  options: RealisticHumanOptions = {}
): RealisticHumanResult {
  if (options.gender === 'female') {
    return generateRealisticFemaleScene(options);
  }

  const includeClothing = options.includeClothing ?? true;
  const includeAccessories = options.includeAccessories ?? true;
  const includeGlasses =
    options.includeGlasses !== undefined
      ? options.includeGlasses
      : options.glassesColor !== undefined;
  const shouldSubdivide = options.subdivide ?? false;

  const skinColor = options.skinColor || '#d4a373';
  const hairColor = options.hairColor || '#1c1917';
  const shirtColor = options.shirtColor || '#1e3a8a';
  const pantsColor = options.pantsColor || '#1e293b';
  const shoesColor = options.shoesColor || '#334155';
  const glassesColor = options.glassesColor || '#0f172a';
  const watchColor = options.watchColor || '#cbd5e1';

  // 1. Decode base reference geometry
  const baseVerts = decodeFloat32(CHARACTER_VERTS_B64);
  const allPos: number[] = Array.from(baseVerts);
  const edgeMap = new Map<number, number>();

  function getEdgeMidpoint(i1: number, i2: number): number {
    const minI = i1 < i2 ? i1 : i2;
    const maxI = i1 < i2 ? i2 : i1;
    const key = minI * 100000 + maxI;
    const existing = edgeMap.get(key);
    if (existing !== undefined) return existing;

    const idx = allPos.length / 3;
    allPos.push(
      (allPos[i1 * 3] + allPos[i2 * 3]) * 0.5,
      (allPos[i1 * 3 + 1] + allPos[i2 * 3 + 1]) * 0.5,
      (allPos[i1 * 3 + 2] + allPos[i2 * 3 + 2]) * 0.5
    );
    edgeMap.set(key, idx);
    return idx;
  }

  // 2. High-Fidelity Organic Human Body (Face, Head, Hair, Eyes, Hands, Body)
  const mgQuads = decodeUint16(MALE_GENERIC_QUADS_B64);
  const numMgQuads = mgQuads.length / 4;
  const bodyTriangles: number[] = [];

  // Linear quad subdivision on body mesh to achieve smooth organic contours (> 35,000 verts)
  for (let q = 0; q < numMgQuads; q++) {
    const v0 = mgQuads[q * 4];
    const v1 = mgQuads[q * 4 + 1];
    const v2 = mgQuads[q * 4 + 2];
    const v3 = mgQuads[q * 4 + 3];

    const m01 = getEdgeMidpoint(v0, v1);
    const m12 = getEdgeMidpoint(v1, v2);
    const m23 = getEdgeMidpoint(v2, v3);
    const m30 = getEdgeMidpoint(v3, v0);

    const cIdx = allPos.length / 3;
    allPos.push(
      (allPos[v0 * 3] + allPos[v1 * 3] + allPos[v2 * 3] + allPos[v3 * 3]) * 0.25,
      (allPos[v0 * 3 + 1] + allPos[v1 * 3 + 1] + allPos[v2 * 3 + 1] + allPos[v3 * 3 + 1]) * 0.25,
      (allPos[v0 * 3 + 2] + allPos[v1 * 3 + 2] + allPos[v2 * 3 + 2] + allPos[v3 * 3 + 2]) * 0.25
    );

    // Triangulate the 4 subdivided sub-quads
    bodyTriangles.push(v0, m01, cIdx, v0, cIdx, m30);
    bodyTriangles.push(m01, v1, m12, m01, m12, cIdx);
    bodyTriangles.push(cIdx, m12, v2, cIdx, v2, m23);
    bodyTriangles.push(m30, cIdx, m23, m30, m23, v3);
  }

  // Hair, Eyebrows, Eyes, Teeth, and Tongue geometry
  const hairQuads = decodeUint16(HAIR_QUADS_B64);
  const eyebrowQuads = decodeUint16(EYEBROW_QUADS_B64);
  const eyeQuads = decodeUint16(EYE_QUADS_B64);
  const teethQuads = decodeUint16(TEETH_QUADS_B64);
  const tongueQuads = decodeUint16(TONGUE_QUADS_B64);

  const hairVertIndices = new Set<number>();
  for (let i = 0; i < hairQuads.length; i += 4) {
    const v0 = hairQuads[i];
    const v1 = hairQuads[i + 1];
    const v2 = hairQuads[i + 2];
    const v3 = hairQuads[i + 3];
    hairVertIndices.add(v0);
    hairVertIndices.add(v1);
    hairVertIndices.add(v2);
    hairVertIndices.add(v3);
    bodyTriangles.push(v0, v1, v2, v0, v2, v3);
  }

  const eyebrowVertIndices = new Set<number>();
  for (let i = 0; i < eyebrowQuads.length; i += 4) {
    const v0 = eyebrowQuads[i];
    const v1 = eyebrowQuads[i + 1];
    const v2 = eyebrowQuads[i + 2];
    const v3 = eyebrowQuads[i + 3];
    eyebrowVertIndices.add(v0);
    eyebrowVertIndices.add(v1);
    eyebrowVertIndices.add(v2);
    eyebrowVertIndices.add(v3);
    bodyTriangles.push(v0, v1, v2, v0, v2, v3);
  }

  const eyeVertIndices = new Set<number>();
  for (let i = 0; i < eyeQuads.length; i += 4) {
    const v0 = eyeQuads[i];
    const v1 = eyeQuads[i + 1];
    const v2 = eyeQuads[i + 2];
    const v3 = eyeQuads[i + 3];
    eyeVertIndices.add(v0);
    eyeVertIndices.add(v1);
    eyeVertIndices.add(v2);
    eyeVertIndices.add(v3);
    bodyTriangles.push(v0, v1, v2, v0, v2, v3);
  }

  const teethVertIndices = new Set<number>();
  for (let i = 0; i < teethQuads.length; i += 4) {
    teethVertIndices.add(teethQuads[i]);
    teethVertIndices.add(teethQuads[i + 1]);
    teethVertIndices.add(teethQuads[i + 2]);
    teethVertIndices.add(teethQuads[i + 3]);
    bodyTriangles.push(teethQuads[i], teethQuads[i + 1], teethQuads[i + 2], teethQuads[i], teethQuads[i + 2], teethQuads[i + 3]);
  }

  const tongueVertIndices = new Set<number>();
  for (let i = 0; i < tongueQuads.length; i += 4) {
    tongueVertIndices.add(tongueQuads[i]);
    tongueVertIndices.add(tongueQuads[i + 1]);
    tongueVertIndices.add(tongueQuads[i + 2]);
    tongueVertIndices.add(tongueQuads[i + 3]);
    bodyTriangles.push(tongueQuads[i], tongueQuads[i + 1], tongueQuads[i + 2], tongueQuads[i], tongueQuads[i + 2], tongueQuads[i + 3]);
  }

  // Watkins cranium vault crown cap vertex at y = 1.760, normal pointing +y
  // Chin apex cap vertex at y = 1.542, normal pointing -y
  const crownApexIdx = allPos.length / 3;
  allPos.push(0.000, 1.760, -0.014);
  const crownB1 = allPos.length / 3;
  allPos.push(-0.001, 1.759, -0.015);
  const crownB2 = allPos.length / 3;
  allPos.push(0.001, 1.759, -0.015);
  bodyTriangles.push(crownApexIdx, crownB1, crownB2);

  const chinApexIdx = allPos.length / 3;
  allPos.push(0.000, 1.542, 0.012);
  const chinB1 = allPos.length / 3;
  allPos.push(0.001, 1.543, 0.013);
  const chinB2 = allPos.length / 3;
  allPos.push(-0.001, 1.543, 0.013);
  bodyTriangles.push(chinApexIdx, chinB1, chinB2);

  // Remap unique vertices for compact BufferGeometry
  const bodyUniqueVerts = Array.from(new Set(bodyTriangles));
  const bodyRemap = new Map<number, number>();
  const bodyPositions: number[] = [];
  const bodyColors: number[] = [];

  const skinColorObj = new THREE.Color(skinColor);
  const hairColorObj = new THREE.Color(hairColor);
  const browColorObj = new THREE.Color(hairColor).lerp(skinColorObj, 0.15);
  const scleraColorObj = new THREE.Color('#f4f4f7');
  const irisColorObj = new THREE.Color('#1f1915');
  const teethColorObj = new THREE.Color('#fcfcfd');
  const tongueColorObj = new THREE.Color('#cf606e');
  const lipColorObj = new THREE.Color(skinColor).lerp(new THREE.Color('#be5462'), 0.38);

  for (let i = 0; i < bodyUniqueVerts.length; i++) {
    const oldIdx = bodyUniqueVerts[i];
    bodyRemap.set(oldIdx, i);
    const px = allPos[oldIdx * 3];
    const py = allPos[oldIdx * 3 + 1];
    const pz = allPos[oldIdx * 3 + 2];
    bodyPositions.push(px, py, pz);

    if (hairVertIndices.has(oldIdx)) {
      bodyColors.push(hairColorObj.r, hairColorObj.g, hairColorObj.b);
    } else if (eyebrowVertIndices.has(oldIdx)) {
      bodyColors.push(browColorObj.r, browColorObj.g, browColorObj.b);
    } else if (eyeVertIndices.has(oldIdx)) {
      const eyeDist = Math.hypot(Math.abs(px) - 0.0285, py - 1.653);
      if (eyeDist < 0.0030 && pz > 0.050) {
        bodyColors.push(0.04, 0.04, 0.05);
      } else if (eyeDist < 0.0070 && pz > 0.050) {
        bodyColors.push(irisColorObj.r, irisColorObj.g, irisColorObj.b);
      } else {
        bodyColors.push(scleraColorObj.r, scleraColorObj.g, scleraColorObj.b);
      }
    } else if (teethVertIndices.has(oldIdx)) {
      bodyColors.push(teethColorObj.r, teethColorObj.g, teethColorObj.b);
    } else if (tongueVertIndices.has(oldIdx)) {
      bodyColors.push(tongueColorObj.r, tongueColorObj.g, tongueColorObj.b);
    } else {
      const lipX = Math.abs(px) / 0.019;
      const lipY = Math.abs(py - 1.583) / 0.010;
      const lipDistSq = lipX * lipX + lipY * lipY;
      if (lipDistSq < 1.0 && pz > 0.050) {
        const lipAlpha = Math.max(0, 1.0 - lipDistSq);
        const blendedLip = skinColorObj.clone().lerp(lipColorObj, 0.22 + 0.48 * lipAlpha);
        bodyColors.push(blendedLip.r, blendedLip.g, blendedLip.b);
      } else {
        bodyColors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
      }
    }
  }

  const bodyIndices: number[] = bodyTriangles.map((oldIdx) => bodyRemap.get(oldIdx)!);

  let bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPositions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyColors, 3));
  bodyGeo.setIndex(bodyIndices);
  bodyGeo.computeVertexNormals();

  if (shouldSubdivide) {
    bodyGeo = applySubdivisionRefinement(bodyGeo, 1);
  }

  // Ensure anatomical cap normal directions
  const normAttr = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;
  const remapCrown = bodyRemap.get(crownApexIdx);
  if (remapCrown !== undefined && remapCrown < normAttr.count) {
    normAttr.setXYZ(remapCrown, 0, 1.0, 0);
  }
  const remapChin = bodyRemap.get(chinApexIdx);
  if (remapChin !== undefined && remapChin < normAttr.count) {
    normAttr.setXYZ(remapChin, 0, -1.0, 0);
  }

  const finalBodyPositions = Array.from(bodyGeo.getAttribute('position').array as Float32Array);
  const finalBodyNormals = Array.from(normAttr.array as Float32Array);
  const finalBodyColors = bodyGeo.getAttribute('color')
    ? Array.from(bodyGeo.getAttribute('color').array as Float32Array)
    : bodyColors;
  const finalBodyIndices = Array.from(bodyGeo.index!.array as Uint16Array | Uint32Array);
  const finalBodyUvs = new Array((finalBodyPositions.length / 3) * 2).fill(0);

  const bodyItem: SceneItem = {
    id: 'human-body',
    name: 'Human Anatomy (Body)',
    type: 'mesh',
    primitiveType: 'custom',
    geometryParams: {
      customGeometry: {
        positions: finalBodyPositions,
        normals: finalBodyNormals,
        uvs: finalBodyUvs,
        colors: finalBodyColors,
        indices: finalBodyIndices,
      },
    },
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    material: {
      color: skinColor,
      roughness: 0.65,
      metalness: 0.02,
      emissive: '#000000',
      emissiveIntensity: 0,
      transmission: 0,
      opacity: 1,
      transparent: false,
      wireframe: false,
      texturePreset: 'skin_tone',
      vertexColors: true,
    },
    visible: true,
    locked: false,
  };

  const allItems: SceneItem[] = [bodyItem];

  // Helper to build clothing & footwear SceneItems from quads
  function buildItemFromQuads(
    id: string,
    name: string,
    quads: Uint16Array,
    material: MaterialProperties
  ): SceneItem {
    const tris: number[] = [];
    for (let i = 0; i < quads.length; i += 4) {
      tris.push(quads[i], quads[i + 1], quads[i + 2], quads[i], quads[i + 2], quads[i + 3]);
    }
    const uSet = Array.from(new Set(tris));
    const remap = new Map<number, number>();
    const positions: number[] = [];
    for (let i = 0; i < uSet.length; i++) {
      const oldIdx = uSet[i];
      remap.set(oldIdx, i);
      positions.push(baseVerts[oldIdx * 3], baseVerts[oldIdx * 3 + 1], baseVerts[oldIdx * 3 + 2]);
    }
    const indices = tris.map((oldIdx) => remap.get(oldIdx)!);

    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    if (shouldSubdivide) {
      geo = applySubdivisionRefinement(geo, 1);
    }

    const finalPos = Array.from(geo.getAttribute('position').array as Float32Array);
    const finalNorm = Array.from(geo.getAttribute('normal').array as Float32Array);
    const finalIdx = Array.from(geo.index!.array as Uint16Array | Uint32Array);
    const finalUvs = new Array((finalPos.length / 3) * 2).fill(0);

    return {
      id,
      name,
      type: 'mesh',
      primitiveType: 'custom',
      geometryParams: {
        customGeometry: {
          positions: finalPos,
          normals: finalNorm,
          uvs: finalUvs,
          indices: finalIdx,
        },
      },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material,
      visible: true,
      locked: false,
    };
  }

  let clothingUpperItem: SceneItem | undefined;
  let clothingLowerItem: SceneItem | undefined;
  let footwearItem: SceneItem | undefined;
  let accessoriesItem: SceneItem | undefined;

  const upperQuads = decodeUint16(UPPER_SUIT_QUADS_B64);
  const lowerQuads = decodeUint16(LOWER_SUIT_QUADS_B64);
  const shoesQuads = decodeUint16(SHOES_QUADS_B64);

  // 3. Tailored Garments: Jacket / Shirt and Continuous Trousers
  if (includeClothing) {
    // Upper Body: Tailored Jacket / Shirt
    clothingUpperItem = buildItemFromQuads(
      'human-shirt',
      'Upper Garment (Tailored Jacket / Shirt)',
      upperQuads,
      {
        color: shirtColor,
        roughness: 0.70,
        metalness: 0.05,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'knit_cotton',
        vertexColors: false,
      }
    );
    allItems.push(clothingUpperItem);

    // Lower Body: Continuous Denim Jeans / Trousers (zero cutout, seamless seat encasement)
    clothingLowerItem = buildItemFromQuads(
      'human-pants',
      'Lower Garment (Denim Jeans / Trousers)',
      lowerQuads,
      {
        color: pantsColor,
        roughness: 0.80,
        metalness: 0.0,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'denim_fabric',
        vertexColors: false,
      }
    );
    allItems.push(clothingLowerItem);

    // Footwear: Leather Dress Shoes (grounded at y = 0.00m)
    footwearItem = buildItemFromQuads(
      'human-shoes',
      'Footwear (Leather Dress Shoes)',
      shoesQuads,
      {
        color: shoesColor,
        roughness: 0.45,
        metalness: 0.15,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'leather_boot',
        vertexColors: false,
      }
    );
    allItems.push(footwearItem);
  }

  // 4. Accessories: Smartwatch & Optional Spectacles
  if (includeAccessories) {
    // Smartwatch strap torus around left wrist at x ~ -0.281, y ~ 0.883, z ~ 0.055
    // 20 x 36 segments gives 777 vertices and 1440 triangles with downward wrist normals
    const torus = new THREE.TorusGeometry(0.024, 0.007, 20, 36);
    torus.rotateX(Math.PI / 2);
    torus.translate(-0.281, 0.883, 0.055);

    const torusPos = Array.from(torus.getAttribute('position').array as Float32Array);
    const torusNorm = Array.from(torus.getAttribute('normal').array as Float32Array);
    const torusIdx = Array.from(torus.index!.array as Uint16Array);
    const torusColors = new Array(torusPos.length).fill(0.8); // Brushed metal

    // Optional modern spectacles (only included when explicitly requested or glassesColor specified)
    if (includeGlasses) {
      const gColor = new THREE.Color(glassesColor);
      const glassBox = new THREE.BoxGeometry(0.065, 0.022, 0.012, 4, 4, 4);
      glassBox.translate(0, 1.650, 0.082);
      const gbPos = Array.from(glassBox.getAttribute('position').array as Float32Array);
      const gbNorm = Array.from(glassBox.getAttribute('normal').array as Float32Array);
      const gbIdx = Array.from(glassBox.index!.array as Uint16Array);

      const offsetIdx = torusPos.length / 3;
      for (const idx of gbIdx) {
        torusIdx.push(idx + offsetIdx);
      }
      torusPos.push(...gbPos);
      torusNorm.push(...gbNorm);
      for (let i = 0; i < gbPos.length / 3; i++) {
        torusColors.push(gColor.r, gColor.g, gColor.b);
      }
    }

    const accUvs = new Array((torusPos.length / 3) * 2).fill(0);

    accessoriesItem = {
      id: 'human-accessories',
      name: 'Accessories (Smartwatch & Eyewear)',
      type: 'mesh',
      primitiveType: 'custom',
      geometryParams: {
        customGeometry: {
          positions: torusPos,
          normals: torusNorm,
          uvs: accUvs,
          colors: torusColors,
          indices: torusIdx,
        },
      },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material: {
        color: watchColor,
        roughness: 0.25,
        metalness: 0.85,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'brushed_metal',
        vertexColors: true,
      },
      visible: true,
      locked: false,
    };
    allItems.push(accessoriesItem);
  }

  const getStats = (item?: SceneItem) => {
    if (!item?.geometryParams?.customGeometry?.positions) return { verts: 0, tris: 0 };
    return {
      verts: item.geometryParams.customGeometry.positions.length / 3,
      tris: (item.geometryParams.customGeometry.indices?.length ?? 0) / 3,
    };
  };

  const bStat = getStats(bodyItem);
  const uStat = getStats(clothingUpperItem);
  const lStat = getStats(clothingLowerItem);
  const fStat = getStats(footwearItem);
  const aStat = getStats(accessoriesItem);

  const totalVerts = bStat.verts + uStat.verts + lStat.verts + fStat.verts + aStat.verts;
  const totalTris = bStat.tris + uStat.tris + lStat.tris + fStat.tris + aStat.tris;

  return {
    bodyItem,
    clothingUpperItem,
    clothingLowerItem,
    footwearItem,
    accessoriesItem,
    allItems,
    stats: {
      bodyVertices: bStat.verts,
      bodyTriangles: bStat.tris,
      clothingVertices: uStat.verts + lStat.verts,
      clothingTriangles: uStat.tris + lStat.tris,
      footwearVertices: fStat.verts,
      footwearTriangles: fStat.tris,
      accessoriesVertices: aStat.verts,
      accessoriesTriangles: aStat.tris,
      totalVertices: totalVerts,
      totalTriangles: totalTris,
      componentsCount: allItems.length,
      height: 1.78,
    },
  };
}

/**
 * Generates an ultra-realistic, anatomically proportioned 3D female human character.
 * Built from organic manifold quad topology (35,000 - 70,000+ vertices),
 * grounded at y = 0.00m, exactly 1.68m tall.
 * Features feminine facial sculpting (delicate nose, soft jaw, refined chin),
 * shoulder-length contoured layered hair, gynoid waist-to-hip hourglass ratio,
 * casual streetwear (fitted scoop top, high-waisted denim jeans, sculpted sneakers),
 * articulated 5-finger hands, and procedural PBR materials.
 */
export function generateRealisticFemaleScene(
  options: RealisticFemaleOptions = {}
): RealisticHumanResult {
  const includeClothing = options.includeClothing ?? true;
  const includeAccessories = options.includeAccessories ?? true;
  const includeGlasses =
    options.includeGlasses !== undefined
      ? options.includeGlasses
      : options.glassesColor !== undefined;
  const shouldSubdivide = options.subdivide ?? false;

  const skinColor = options.skinColor || '#e0ac82';
  const hairColor = options.hairColor || '#261a15';
  const topColor = options.topColor || options.shirtColor || '#e11d48';
  const pantsColor = options.pantsColor || '#1e293b';
  const shoesColor = options.shoesColor || '#f8fafc';
  const glassesColor = options.glassesColor || '#0f172a';
  const watchColor = options.watchColor || '#cbd5e1';

  // 1. Decode base reference geometry and apply female morphological transformation
  const rawBaseVerts = decodeFloat32(CHARACTER_VERTS_B64);
  const nVerts = rawBaseVerts.length / 3;
  const fScale = 1.68 / 1.78; // Scale from male 1.78m base to 1.68m female height
  const baseVerts = new Float32Array(rawBaseVerts.length);

  for (let i = 0; i < nVerts; i++) {
    let x = rawBaseVerts[i * 3] * fScale;
    let y = rawBaseVerts[i * 3 + 1] * fScale;
    let z = rawBaseVerts[i * 3 + 2] * fScale;

    const side = x >= 0 ? 1.0 : -1.0;
    const absX = Math.abs(x);

    // 1. Bust Volume: organic forward projection around left and right breast centers
    if (y >= 1.08 && y <= 1.30 && z > 0.01) {
      const cx = side * 0.076;
      const cy = 1.205;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < 0.088) {
        const w = Math.cos((dist / 0.088) * (Math.PI / 2)) ** 2;
        z += w * 0.038;
        x += side * w * 0.006;
      }
    }

    // 2. Natural Waist Narrowing (y in [0.90, 1.06])
    if (y >= 0.90 && y <= 1.06 && absX < 0.22) {
      const distY = Math.abs(y - 0.98);
      if (distY < 0.08) {
        const wFactor = Math.cos((distY / 0.08) * (Math.PI / 2)) ** 2;
        x *= (1.0 - wFactor * 0.15);
        z *= (1.0 - wFactor * 0.08);
      }
    }

    // 3. Pelvic Hips & Gluteal Curvature (Gynoid hourglass flare: y in [0.70, 0.92])
    if (y >= 0.70 && y <= 0.92 && absX < 0.25) {
      const distY = Math.abs(y - 0.82);
      if (distY < 0.11) {
        const hFactor = Math.cos((distY / 0.11) * (Math.PI / 2)) ** 2;
        x *= (1.0 + hFactor * 0.12);
        if (z < 0) {
          z *= (1.0 + hFactor * 0.14);
        }
      }
    }

    // 4. Narrower Biacromial Shoulder Width (y in [1.26, 1.42])
    if (y >= 1.26 && y <= 1.42 && absX > 0.12 && absX <= 0.26) {
      const distY = Math.abs(y - 1.34);
      if (distY < 0.08) {
        const sFactor = Math.cos((distY / 0.08) * (Math.PI / 2)) ** 2;
        x -= side * sFactor * 0.018;
      }
    }

    // Arms shift inward to align concentric with narrower shoulders
    if (y < 1.34 && absX > 0.20) {
      x -= side * 0.018;
      const armCx = side * 0.26;
      x = armCx + (x - armCx) * 0.94;
      z *= 0.94;
    }

    // 5. Slender Neck Contour (y in [1.32, 1.42])
    if (y >= 1.32 && y <= 1.42 && absX < 0.09) {
      x *= 0.92;
      z *= 0.92;
    }

    // 6. Feminine Facial Harmony: Soft youthful cheeks, gentle tapered jawline, refined chin
    if (y >= 1.44 && y <= 1.62) {
      if (y < 1.49) {
        // Soft rounded chin and smooth tapered jawline (gentle 5% taper, zero hollows)
        x *= 0.95;
        z *= 0.97;
      } else if (y < 1.53) {
        // Smooth transition to midface
        x *= 0.96;
      }
      // Cheeks and zygomatic arches (y in [1.50, 1.57]):
      // Youthful, soft feminine cheek volume - smooth convex curve, avoiding gaunt hollows
      if (y >= 1.50 && y <= 1.57 && z > 0.04) {
        const cheekFactor = Math.sin(((y - 1.50) / 0.07) * Math.PI);
        z += 0.0035 * cheekFactor;
      }
      // Fill nasolabial crease / fold to eliminate harsh aged hollows around the mouth
      if (y >= 1.47 && y <= 1.53 && absX >= 0.015 && absX <= 0.038 && z > 0.042) {
        const nFactor = Math.sin(((y - 1.47) / 0.06) * Math.PI);
        z += 0.0045 * nFactor;
      }
    }

    // 6b. Eye & Brow Orbit Refinement: Soften brow overhang, fill under-eye hollows, illuminate eyes
    if (y >= 1.52 && y <= 1.63 && z > 0.038) {
      // Soften heavy brow overhang (y in [1.57, 1.63])
      if (y >= 1.57 && y <= 1.63 && absX < 0.05) {
        z -= 0.006;
      }
      // Fill infraorbital tear-trough hollows to eliminate dark demonic eye-bag shadows
      if (y >= 1.525 && y <= 1.560 && absX >= 0.015 && absX <= 0.045 && z > 0.038) {
        z += 0.0055;
      }
      // Bring eye sphere forward to catch natural catchlight reflection
      if (y >= 1.545 && y <= 1.575 && absX >= 0.018 && absX <= 0.040) {
        z += 0.005;
      }
    }

    // 6c. Natural Vermilion Lip Fullness
    if (y >= 1.475 && y <= 1.515 && absX < 0.025 && z > 0.048) {
      z += 0.0035;
    }

    // 7. Feminine Shoulder-Length Contoured Layered Hair (short01 verts: 7990..10973)
    if (i >= 7990 && i <= 10973) {
      // Crown & temple volume
      x *= 1.04;
      if (z < 0) {
        z *= 1.05;
      }
      // Draping sides (absX > 0.04) and back (z < 0.01) down past the jawline and nape
      if (absX > 0.04 || z < 0.01) {
        if (y < 1.63) {
          const drop = (1.63 - y) * 0.85;
          y -= drop;
          x *= (1.0 + drop * 0.22);
          if (z < 0) {
            z *= (1.0 + drop * 0.18);
          }
        }
      }
      // Forehead framing
      if (z > 0.03 && y >= 1.54 && y <= 1.62) {
        y -= 0.005;
        z += 0.004;
      }
    }

    // 8. Delicate Feminine Eyebrow Contouring (verts 11070..11193)
    if (i >= 11070 && i <= 11193) {
      const browCenterY = 1.568;
      y = browCenterY + (y - browCenterY) * 0.55;
      if (absX > 0.024 && absX < 0.052) {
        y += 0.0035 * Math.sin(((absX - 0.024) / 0.028) * Math.PI);
      }
    }

    baseVerts[i * 3] = x;
    baseVerts[i * 3 + 1] = y;
    baseVerts[i * 3 + 2] = z;
  }

  const allPos: number[] = Array.from(baseVerts);
  const edgeMap = new Map<number, number>();

  function getEdgeMidpoint(i1: number, i2: number): number {
    const minI = i1 < i2 ? i1 : i2;
    const maxI = i1 < i2 ? i2 : i1;
    const key = minI * 100000 + maxI;
    const existing = edgeMap.get(key);
    if (existing !== undefined) return existing;

    const idx = allPos.length / 3;
    allPos.push(
      (allPos[i1 * 3] + allPos[i2 * 3]) * 0.5,
      (allPos[i1 * 3 + 1] + allPos[i2 * 3 + 1]) * 0.5,
      (allPos[i1 * 3 + 2] + allPos[i2 * 3 + 2]) * 0.5
    );
    edgeMap.set(key, idx);
    return idx;
  }

  // 2. High-Fidelity Female Body Mesh (Subdivided for smooth organic skin)
  const mgQuads = decodeUint16(MALE_GENERIC_QUADS_B64);
  const numMgQuads = mgQuads.length / 4;
  const bodyTriangles: number[] = [];

  for (let q = 0; q < numMgQuads; q++) {
    const v0 = mgQuads[q * 4];
    const v1 = mgQuads[q * 4 + 1];
    const v2 = mgQuads[q * 4 + 2];
    const v3 = mgQuads[q * 4 + 3];

    const m01 = getEdgeMidpoint(v0, v1);
    const m12 = getEdgeMidpoint(v1, v2);
    const m23 = getEdgeMidpoint(v2, v3);
    const m30 = getEdgeMidpoint(v3, v0);

    const cIdx = allPos.length / 3;
    allPos.push(
      (allPos[v0 * 3] + allPos[v1 * 3] + allPos[v2 * 3] + allPos[v3 * 3]) * 0.25,
      (allPos[v0 * 3 + 1] + allPos[v1 * 3 + 1] + allPos[v2 * 3 + 1] + allPos[v3 * 3 + 1]) * 0.25,
      (allPos[v0 * 3 + 2] + allPos[v1 * 3 + 2] + allPos[v2 * 3 + 2] + allPos[v3 * 3 + 2]) * 0.25
    );

    bodyTriangles.push(v0, m01, cIdx, v0, cIdx, m30);
    bodyTriangles.push(m01, v1, m12, m01, m12, cIdx);
    bodyTriangles.push(cIdx, m12, v2, cIdx, v2, m23);
    bodyTriangles.push(m30, cIdx, m23, m30, m23, v3);
  }

  // Hair, Eyebrows, Eyes, Teeth, and Tongue geometry
  const hairQuads = decodeUint16(HAIR_QUADS_B64);
  const eyebrowQuads = decodeUint16(EYEBROW_QUADS_B64);
  const eyeQuads = decodeUint16(EYE_QUADS_B64);
  const teethQuads = decodeUint16(TEETH_QUADS_B64);
  const tongueQuads = decodeUint16(TONGUE_QUADS_B64);

  const hairVertIndices = new Set<number>();
  for (let i = 0; i < hairQuads.length; i += 4) {
    const v0 = hairQuads[i];
    const v1 = hairQuads[i + 1];
    const v2 = hairQuads[i + 2];
    const v3 = hairQuads[i + 3];
    hairVertIndices.add(v0);
    hairVertIndices.add(v1);
    hairVertIndices.add(v2);
    hairVertIndices.add(v3);
    bodyTriangles.push(v0, v1, v2, v0, v2, v3);
  }

  const eyebrowVertIndices = new Set<number>();
  for (let i = 0; i < eyebrowQuads.length; i += 4) {
    const v0 = eyebrowQuads[i];
    const v1 = eyebrowQuads[i + 1];
    const v2 = eyebrowQuads[i + 2];
    const v3 = eyebrowQuads[i + 3];
    eyebrowVertIndices.add(v0);
    eyebrowVertIndices.add(v1);
    eyebrowVertIndices.add(v2);
    eyebrowVertIndices.add(v3);
    bodyTriangles.push(v0, v1, v2, v0, v2, v3);
  }

  const eyeVertIndices = new Set<number>();
  for (let i = 0; i < eyeQuads.length; i += 4) {
    const v0 = eyeQuads[i];
    const v1 = eyeQuads[i + 1];
    const v2 = eyeQuads[i + 2];
    const v3 = eyeQuads[i + 3];
    eyeVertIndices.add(v0);
    eyeVertIndices.add(v1);
    eyeVertIndices.add(v2);
    eyeVertIndices.add(v3);
    bodyTriangles.push(v0, v1, v2, v0, v2, v3);
  }

  const teethVertIndices = new Set<number>();
  for (let i = 0; i < teethQuads.length; i += 4) {
    teethVertIndices.add(teethQuads[i]);
    teethVertIndices.add(teethQuads[i + 1]);
    teethVertIndices.add(teethQuads[i + 2]);
    teethVertIndices.add(teethQuads[i + 3]);
    bodyTriangles.push(teethQuads[i], teethQuads[i + 1], teethQuads[i + 2], teethQuads[i], teethQuads[i + 2], teethQuads[i + 3]);
  }

  const tongueVertIndices = new Set<number>();
  for (let i = 0; i < tongueQuads.length; i += 4) {
    tongueVertIndices.add(tongueQuads[i]);
    tongueVertIndices.add(tongueQuads[i + 1]);
    tongueVertIndices.add(tongueQuads[i + 2]);
    tongueVertIndices.add(tongueQuads[i + 3]);
    bodyTriangles.push(tongueQuads[i], tongueQuads[i + 1], tongueQuads[i + 2], tongueQuads[i], tongueQuads[i + 2], tongueQuads[i + 3]);
  }

  // Watkins cranium vault crown cap vertex at y = 1.660m, chin apex cap at y = 1.455m
  const crownApexIdx = allPos.length / 3;
  allPos.push(0.000, 1.660, -0.013);
  const crownB1 = allPos.length / 3;
  allPos.push(-0.001, 1.659, -0.014);
  const crownB2 = allPos.length / 3;
  allPos.push(0.001, 1.659, -0.014);
  bodyTriangles.push(crownApexIdx, crownB1, crownB2);

  const chinApexIdx = allPos.length / 3;
  allPos.push(0.000, 1.455, 0.011);
  const chinB1 = allPos.length / 3;
  allPos.push(0.001, 1.456, 0.012);
  const chinB2 = allPos.length / 3;
  allPos.push(-0.001, 1.456, 0.012);
  bodyTriangles.push(chinApexIdx, chinB1, chinB2);

  // Remap unique vertices for compact BufferGeometry
  const bodyUniqueVerts = Array.from(new Set(bodyTriangles));
  const bodyRemap = new Map<number, number>();
  const bodyPositions: number[] = [];
  const bodyColors: number[] = [];

  const skinColorObj = new THREE.Color(skinColor);
  const hairColorObj = new THREE.Color(hairColor);
  const browColorObj = new THREE.Color(hairColor).lerp(skinColorObj, 0.22);
  const scleraColorObj = new THREE.Color('#f4f4f7');
  const irisColorObj = new THREE.Color('#221712');
  const teethColorObj = new THREE.Color('#fcfcfd');
  const tongueColorObj = new THREE.Color('#cf606e');
  const lipColorObj = new THREE.Color(skinColor).lerp(new THREE.Color('#d94862'), 0.48);

  for (let i = 0; i < bodyUniqueVerts.length; i++) {
    const oldIdx = bodyUniqueVerts[i];
    bodyRemap.set(oldIdx, i);
    const px = allPos[oldIdx * 3];
    const py = allPos[oldIdx * 3 + 1];
    const pz = allPos[oldIdx * 3 + 2];
    bodyPositions.push(px, py, pz);

    if (hairVertIndices.has(oldIdx)) {
      bodyColors.push(hairColorObj.r, hairColorObj.g, hairColorObj.b);
    } else if (eyebrowVertIndices.has(oldIdx)) {
      bodyColors.push(browColorObj.r, browColorObj.g, browColorObj.b);
    } else if (eyeVertIndices.has(oldIdx)) {
      const eyeDist = Math.hypot(Math.abs(px) - 0.0268, py - 1.5604);
      if (eyeDist < 0.0028 && pz > 0.048) {
        bodyColors.push(0.04, 0.04, 0.05);
      } else if (eyeDist < 0.0068 && pz > 0.048) {
        bodyColors.push(irisColorObj.r, irisColorObj.g, irisColorObj.b);
      } else {
        bodyColors.push(scleraColorObj.r, scleraColorObj.g, scleraColorObj.b);
      }
    } else if (teethVertIndices.has(oldIdx)) {
      bodyColors.push(teethColorObj.r, teethColorObj.g, teethColorObj.b);
    } else if (tongueVertIndices.has(oldIdx)) {
      bodyColors.push(tongueColorObj.r, tongueColorObj.g, tongueColorObj.b);
    } else {
      const lipX = Math.abs(px) / 0.0175;
      const lipY = Math.abs(py - 1.493) / 0.009;
      const lipDistSq = lipX * lipX + lipY * lipY;
      if (lipDistSq < 1.0 && pz > 0.046) {
        const lipAlpha = Math.max(0, 1.0 - lipDistSq);
        const blendedLip = skinColorObj.clone().lerp(lipColorObj, 0.25 + 0.55 * lipAlpha);
        bodyColors.push(blendedLip.r, blendedLip.g, blendedLip.b);
      } else {
        bodyColors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
      }
    }
  }

  const bodyIndices: number[] = bodyTriangles.map((oldIdx) => bodyRemap.get(oldIdx)!);

  let bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPositions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyColors, 3));
  bodyGeo.setIndex(bodyIndices);
  bodyGeo.computeVertexNormals();

  if (shouldSubdivide) {
    bodyGeo = applySubdivisionRefinement(bodyGeo, 1);
  }

  // Ensure anatomical cap normal directions
  const normAttr = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;
  const remapCrown = bodyRemap.get(crownApexIdx);
  if (remapCrown !== undefined && remapCrown < normAttr.count) {
    normAttr.setXYZ(remapCrown, 0, 1.0, 0);
  }
  const remapChin = bodyRemap.get(chinApexIdx);
  if (remapChin !== undefined && remapChin < normAttr.count) {
    normAttr.setXYZ(remapChin, 0, -1.0, 0);
  }

  const finalBodyPositions = Array.from(bodyGeo.getAttribute('position').array as Float32Array);
  const finalBodyNormals = Array.from(normAttr.array as Float32Array);
  const finalBodyColors = bodyGeo.getAttribute('color')
    ? Array.from(bodyGeo.getAttribute('color').array as Float32Array)
    : bodyColors;
  const finalBodyIndices = Array.from(bodyGeo.index!.array as Uint16Array | Uint32Array);
  const finalBodyUvs = new Array((finalBodyPositions.length / 3) * 2).fill(0);

  const bodyItem: SceneItem = {
    id: 'female-body',
    name: 'Female Anatomy (Body)',
    type: 'mesh',
    primitiveType: 'custom',
    geometryParams: {
      customGeometry: {
        positions: finalBodyPositions,
        normals: finalBodyNormals,
        uvs: finalBodyUvs,
        colors: finalBodyColors,
        indices: finalBodyIndices,
      },
    },
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    material: {
      color: skinColor,
      roughness: 0.48,
      metalness: 0.0,
      emissive: '#000000',
      emissiveIntensity: 0,
      transmission: 0,
      opacity: 1,
      transparent: false,
      wireframe: false,
      texturePreset: 'skin_tone',
      vertexColors: true,
    },
    visible: true,
    locked: false,
  };

  const allItems: SceneItem[] = [bodyItem];

  // Helper to build clothing & footwear SceneItems from quads
  function buildItemFromQuads(
    id: string,
    name: string,
    quads: Uint16Array,
    material: MaterialProperties
  ): SceneItem {
    const tris: number[] = [];
    for (let i = 0; i < quads.length; i += 4) {
      tris.push(quads[i], quads[i + 1], quads[i + 2], quads[i], quads[i + 2], quads[i + 3]);
    }
    const uSet = Array.from(new Set(tris));
    const remap = new Map<number, number>();
    const positions: number[] = [];
    for (let i = 0; i < uSet.length; i++) {
      const oldIdx = uSet[i];
      remap.set(oldIdx, i);
      let px = baseVerts[oldIdx * 3];
      let py = baseVerts[oldIdx * 3 + 1];
      let pz = baseVerts[oldIdx * 3 + 2];

      // Tailor shirt hem to drape smoothly over jeans (eliminating gap and ragged sawtooth spikes)
      if (id === 'female-top') {
        if (py < 0.965 && Math.abs(px) < 0.22) {
          if (py < 0.942) {
            py = 0.938;
          }
          // Soft radial folded hem welt (+0.0035m radial expansion)
          const rad = Math.hypot(px, pz);
          if (rad > 0.05) {
            const exp = 1.0 + 0.0035 / rad;
            px *= exp;
            pz *= exp;
          }
        }
        // Smooth sleeve wrinkles along the arms
        if (Math.abs(px) > 0.18 && py >= 0.90 && py <= 1.25) {
          pz = pz * 0.95;
        }
      }

      // Jeans waistband extension to guarantee smooth 2.4cm overlap under shirt
      if (id === 'female-jeans') {
        if (py > 0.952 && Math.abs(px) < 0.22) {
          py = 0.960;
        }
      }

      positions.push(px, py, pz);
    }
    const indices = tris.map((oldIdx) => remap.get(oldIdx)!);

    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    if (shouldSubdivide) {
      geo = applySubdivisionRefinement(geo, 1);
    }

    const finalPos = Array.from(geo.getAttribute('position').array as Float32Array);
    const finalNorm = Array.from(geo.getAttribute('normal').array as Float32Array);
    const finalIdx = Array.from(geo.index!.array as Uint16Array | Uint32Array);
    const finalUvs = new Array((finalPos.length / 3) * 2).fill(0);

    return {
      id,
      name,
      type: 'mesh',
      primitiveType: 'custom',
      geometryParams: {
        customGeometry: {
          positions: finalPos,
          normals: finalNorm,
          uvs: finalUvs,
          indices: finalIdx,
        },
      },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material,
      visible: true,
      locked: false,
    };
  }

  let clothingUpperItem: SceneItem | undefined;
  let clothingLowerItem: SceneItem | undefined;
  let footwearItem: SceneItem | undefined;
  let accessoriesItem: SceneItem | undefined;

  const upperQuads = decodeUint16(UPPER_SUIT_QUADS_B64);
  const lowerQuads = decodeUint16(LOWER_SUIT_QUADS_B64);
  const shoesQuads = decodeUint16(SHOES_QUADS_B64);

  // 3. Casual Streetwear: Fitted Top, High-Waisted Jeans, and Sculpted Sneakers
  if (includeClothing) {
    // Upper Garment: Fitted Streetwear Top (Clean tailored folded hemline)
    clothingUpperItem = buildItemFromQuads(
      'female-top',
      'Upper Garment (Fitted Streetwear Top)',
      upperQuads,
      {
        color: topColor,
        roughness: 0.78,
        metalness: 0.0,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'knit_cotton',
        vertexColors: false,
      }
    );
    allItems.push(clothingUpperItem);

    // Lower Garment: High-Waisted Denim Jeans (100% closed pelvic seat, zero cutout)
    clothingLowerItem = buildItemFromQuads(
      'female-jeans',
      'Lower Garment (High-Waisted Denim Jeans)',
      lowerQuads,
      {
        color: pantsColor,
        roughness: 0.82,
        metalness: 0.0,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'denim_fabric',
        vertexColors: false,
      }
    );
    allItems.push(clothingLowerItem);

    // Footwear: Sculpted Street Sneakers (grounded at y = 0.00m)
    footwearItem = buildItemFromQuads(
      'female-sneakers',
      'Footwear (Sculpted Street Sneakers)',
      shoesQuads,
      {
        color: shoesColor,
        roughness: 0.35,
        metalness: 0.05,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'leather_boot',
        vertexColors: false,
      }
    );
    allItems.push(footwearItem);
  }

  // 4. Accessories: Sleek Wrist Smartwatch & Optional Spectacles
  if (includeAccessories) {
    // Smartwatch strap torus around left wrist at x ~ -0.252, y ~ 0.852, z ~ 0.047 (scaled for female arm)
    // 20 x 36 segments gives 777 vertices and 1440 triangles with downward wrist normals
    const torus = new THREE.TorusGeometry(0.021, 0.006, 20, 36);
    torus.rotateX(Math.PI / 2);
    torus.translate(-0.252, 0.852, 0.047);

    const torusPos = Array.from(torus.getAttribute('position').array as Float32Array);
    const torusNorm = Array.from(torus.getAttribute('normal').array as Float32Array);
    const torusIdx = Array.from(torus.index!.array as Uint16Array);
    const torusColors = new Array(torusPos.length).fill(0.8); // Brushed metal

    if (includeGlasses) {
      const gColor = new THREE.Color(glassesColor);
      const glassBox = new THREE.BoxGeometry(0.060, 0.020, 0.011, 4, 4, 4);
      glassBox.translate(0, 1.558, 0.077);
      const gbPos = Array.from(glassBox.getAttribute('position').array as Float32Array);
      const gbNorm = Array.from(glassBox.getAttribute('normal').array as Float32Array);
      const gbIdx = Array.from(glassBox.index!.array as Uint16Array);

      const offsetIdx = torusPos.length / 3;
      for (const idx of gbIdx) {
        torusIdx.push(idx + offsetIdx);
      }
      torusPos.push(...gbPos);
      torusNorm.push(...gbNorm);
      for (let i = 0; i < gbPos.length / 3; i++) {
        torusColors.push(gColor.r, gColor.g, gColor.b);
      }
    }

    const accUvs = new Array((torusPos.length / 3) * 2).fill(0);

    accessoriesItem = {
      id: 'female-accessories',
      name: 'Accessories (Smartwatch & Eyewear)',
      type: 'mesh',
      primitiveType: 'custom',
      geometryParams: {
        customGeometry: {
          positions: torusPos,
          normals: torusNorm,
          uvs: accUvs,
          colors: torusColors,
          indices: torusIdx,
        },
      },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material: {
        color: watchColor,
        roughness: 0.25,
        metalness: 0.85,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'brushed_metal',
        vertexColors: true,
      },
      visible: true,
      locked: false,
    };
    allItems.push(accessoriesItem);
  }

  const getStats = (item?: SceneItem) => {
    if (!item?.geometryParams?.customGeometry?.positions) return { verts: 0, tris: 0 };
    return {
      verts: item.geometryParams.customGeometry.positions.length / 3,
      tris: (item.geometryParams.customGeometry.indices?.length ?? 0) / 3,
    };
  };

  const bStat = getStats(bodyItem);
  const uStat = getStats(clothingUpperItem);
  const lStat = getStats(clothingLowerItem);
  const fStat = getStats(footwearItem);
  const aStat = getStats(accessoriesItem);

  const totalVerts = bStat.verts + uStat.verts + lStat.verts + fStat.verts + aStat.verts;
  const totalTris = bStat.tris + uStat.tris + lStat.tris + fStat.tris + aStat.tris;

  return {
    bodyItem,
    clothingUpperItem,
    clothingLowerItem,
    footwearItem,
    accessoriesItem,
    allItems,
    stats: {
      bodyVertices: bStat.verts,
      bodyTriangles: bStat.tris,
      clothingVertices: uStat.verts + lStat.verts,
      clothingTriangles: uStat.tris + lStat.tris,
      footwearVertices: fStat.verts,
      footwearTriangles: fStat.tris,
      accessoriesVertices: aStat.verts,
      accessoriesTriangles: aStat.tris,
      totalVertices: totalVerts,
      totalTriangles: totalTris,
      componentsCount: allItems.length,
      height: 1.68,
    },
  };
}
