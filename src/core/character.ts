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

  const normAttr = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;

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

    // Slender arms shift inward with smooth continuous falloff (zero step tearing)
    if (y < 1.34 && absX > 0.18) {
      const armWeight = Math.min(1.0, (absX - 0.18) / 0.06);
      const shiftX = armWeight * 0.018;
      x -= side * shiftX;
      const armCx = side * 0.26;
      x = armCx + (x - armCx) * (1.0 - armWeight * 0.06);
      z *= (1.0 - armWeight * 0.06);
    }

    // 5. Slender Graceful Neck Contour (y in [1.32, 1.42])
    if (y >= 1.32 && y <= 1.42 && absX < 0.09) {
      x *= 0.92;
      z *= 0.92;
    }

    // 6. Ultra-Realistic Feminine Facial Morphology (Youthful, harmonious, beautiful)
    // Note: only deform skin surface vertices (i < 7990), keeping eyeballs/teeth pristine
    if (i < 7990 && y >= 1.44 && y <= 1.66) {
      // 6a. Gentle tapered V-line jawline & delicate rounded feminine chin
      const jawT = Math.max(0, Math.min(1, (y - 1.44) / 0.10));
      const taperX = 0.86 + jawT * 0.08;
      x *= taperX;
      if (y < 1.485) {
        const chinT = (1.485 - y) / 0.045;
        z *= (1.0 - chinT * 0.06);
        if (absX < 0.022 && z > 0.042) {
          z = 0.042 + (z - 0.042) * (1.0 - chinT * 0.25);
        }
      }

      // 6b. Soft feminine cheek volume & buccal fullness (eradicates hollow gauntness)
      if (y >= 1.470 && y <= 1.565 && absX >= 0.020 && absX <= 0.070 && z > 0.030) {
        const uX = Math.sin(((absX - 0.020) / 0.050) * Math.PI);
        const uY = Math.sin(((y - 1.470) / 0.095) * Math.PI);
        z += 0.0080 * uX * uY;
        if (absX >= 0.035 && absX <= 0.065 && y >= 1.480 && y <= 1.530) {
          x += side * 0.0035 * Math.sin(((absX - 0.035) / 0.030) * Math.PI);
        }
      }

      // 6c. Total eradication of nasolabial creases and hollow cheek grooves
      if (y >= 1.465 && y <= 1.545 && absX >= 0.010 && absX <= 0.048 && z > 0.038) {
        const smoothZ = 0.0505 + (y - 1.465) * 0.042 - (absX - 0.010) * 0.075;
        if (z < smoothZ) {
          z = smoothZ;
        }
      }

      // 6d. Smooth feminine forehead & complete elimination of heavy brow overhang
      if (y >= 1.560 && y <= 1.645 && z > 0.032) {
        const maxBrowZ = 0.0420 + Math.max(0, y - 1.565) * 0.060;
        if (z > maxBrowZ) {
          z = maxBrowZ;
        }
        // Smooth glabella / nasion (bridge between eyebrows and nose)
        if (absX < 0.016 && y >= 1.565 && y <= 1.585) {
          const smoothNasionZ = 0.0440 + (y - 1.565) * 0.020;
          if (z > smoothNasionZ) z = smoothNasionZ;
        }
        if (absX > 0.040 && absX < 0.075) {
          z *= 0.96;
        }
      }

      // 6e. Natural upper eyelid drape & smooth infraorbital under-eye fill (zero eye bags)
      if (y >= 1.520 && y <= 1.560 && absX >= 0.014 && absX <= 0.042 && z > 0.036) {
        const smoothUnderZ = 0.0475 + (y - 1.520) * 0.055;
        if (z < smoothUnderZ) {
          z = smoothUnderZ;
        }
      }

      // 6f. Sculpted vermilion lips: defined Cupid's bow and plump lower cushion
      if (absX < 0.026 && y >= 1.472 && y <= 1.518 && z > 0.042) {
        if (y >= 1.492) {
          // Upper lip Cupid's bow peaks at |x| = 0.007
          const bowFactor = Math.cos(((Math.min(0.015, Math.abs(absX - 0.007))) / 0.015) * (Math.PI / 2));
          z += 0.0040 * bowFactor;
        } else {
          // Lower lip plump cushion
          const lowerFactor = Math.cos((absX / 0.018) * (Math.PI / 2)) * Math.sin(((y - 1.472) / 0.020) * Math.PI);
          z += 0.0052 * Math.max(0, lowerFactor);
        }
        // Relax mouth corners gently upward (+0.0025m) for warm approachable expression
        if (absX >= 0.016 && absX <= 0.025 && y >= 1.488 && y <= 1.498) {
          y += 0.0025;
        }
      }
    }

    // 7. Feminine Shoulder-Length Contoured Layered Hair (Anchored 100% to skull)
    if (i >= 7990 && i <= 10973) {
      // Natural cranial volumetric body (subtle 3.5mm radial expansion from cranium center at z = -0.046)
      const headCenterY = 1.58;
      const headCenterZ = -0.046;
      const radHead = Math.hypot(x, y - headCenterY, z - headCenterZ);
      if (radHead > 0.04) {
        const exp = 1.0 + 0.0035 / radHead;
        x *= exp;
        z = headCenterZ + (z - headCenterZ) * exp;
      }

      // Smooth flowing layered drape framing face and nape (zero detachment or floating helmet gaps)
      if (y < 1.64) {
        const drapeDist = (1.64 - y);
        y -= drapeDist * 0.18;
        x *= (1.0 + drapeDist * 0.05);
        if (z < -0.03) {
          z *= (1.0 + drapeDist * 0.04);
        }
      }

      // Gentle temple and forehead framing
      if (z > 0.03 && y >= 1.54 && y <= 1.62) {
        z += 0.002;
      }
    }

    // 8. Delicate Feminine Eyebrow Contouring (verts 11070..11193)
    if (i >= 11070 && i <= 11193) {
      const browCenterY = 1.572;
      y = browCenterY + (y - browCenterY) * 0.45;
      y += 0.0035; // Lift brow arch slightly higher
      if (absX > 0.024 && absX < 0.052) {
        y += 0.0040 * Math.sin(((absX - 0.024) / 0.028) * Math.PI);
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
  // For female character: generate an ultra-realistic, volumetric feminine layered hairstyle & athletic ponytail
  const hairVertIndices = new Set<number>();

  // 1. Skull-Conformal Hair Hairstyle from HAIR_QUADS_B64 (1,839 quads perfectly anchored to the cranium)
  const hairQuads = decodeUint16(HAIR_QUADS_B64);
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

  // 2. Athletic Sleek Ponytail / Cascade flowing down the back
  const ponyStartIdx = allPos.length / 3;
  const ponyRings = 14;
  const ponySegs = 16;
  const ponyRoot = new THREE.Vector3(0, 1.558, -0.092);
  const ponyTip = new THREE.Vector3(0, 1.360, -0.110);

  for (let r = 0; r <= ponyRings; r++) {
    const t = r / ponyRings;
    const curCenter = new THREE.Vector3().lerpVectors(ponyRoot, ponyTip, t);
    // Natural subtle S-curve flow
    curCenter.z += Math.sin(t * Math.PI) * -0.018;

    // Taper radius from 0.022m at root down to 0.008m at tip
    const curRad = 0.022 * (1.0 - t * 0.65);

    for (let s = 0; s < ponySegs; s++) {
      const angle = (s / ponySegs) * Math.PI * 2;
      const px = curCenter.x + Math.cos(angle) * curRad;
      const py = curCenter.y + Math.sin(angle) * curRad * 0.4;
      const pz = curCenter.z + Math.sin(angle) * curRad;

      const vIdx = allPos.length / 3;
      allPos.push(px, py, pz);
      hairVertIndices.add(vIdx);
    }
  }

  for (let r = 0; r < ponyRings; r++) {
    for (let s = 0; s < ponySegs; s++) {
      const nextS = (s + 1) % ponySegs;
      const i0 = ponyStartIdx + r * ponySegs + s;
      const i1 = ponyStartIdx + r * ponySegs + nextS;
      const i2 = ponyStartIdx + (r + 1) * ponySegs + nextS;
      const i3 = ponyStartIdx + (r + 1) * ponySegs + s;
      bodyTriangles.push(i0, i1, i2, i0, i2, i3);
    }
  }

  // 3. Eyebrows, Eyes, Teeth, and Tongue geometry
  const eyebrowQuads = decodeUint16(EYEBROW_QUADS_B64);
  const eyeQuads = decodeUint16(EYE_QUADS_B64);
  const teethQuads = decodeUint16(TEETH_QUADS_B64);
  const tongueQuads = decodeUint16(TONGUE_QUADS_B64);

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

  // Remap unique vertices for compact BufferGeometry
  const bodyUniqueVerts = Array.from(new Set(bodyTriangles));
  const bodyRemap = new Map<number, number>();
  const bodyPositions: number[] = [];
  const bodyColors: number[] = [];

  const skinColorObj = new THREE.Color(skinColor);
  const hairColorObj = new THREE.Color(hairColor);
  const browColorObj = new THREE.Color('#2b1912'); // Deep natural brunette eyebrow
  const scleraColorObj = new THREE.Color('#f0edf2');
  const scleraCornerColorObj = new THREE.Color('#e8c6c3');
  const irisCoreColorObj = new THREE.Color('#382014');
  const irisOuterColorObj = new THREE.Color('#663e24');
  const limbalRingColorObj = new THREE.Color('#140c08');
  const pupilColorObj = new THREE.Color('#0a080a');
  const blushColorObj = new THREE.Color('#d98075');
  const teethColorObj = new THREE.Color('#fcfcfd');
  const tongueColorObj = new THREE.Color('#cf606e');
  const lipColorObj = new THREE.Color('#b8384e'); // Rich natural rose-red vermilion

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
      // Natural feminine eyebrow: eliminate medial unibrow bridge (x < 0.019) with soft feathering
      const absX = Math.abs(px);
      if (absX < 0.019 || absX > 0.054) {
        bodyColors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
      } else {
        const t = Math.sin(((absX - 0.019) / (0.054 - 0.019)) * Math.PI);
        const curBrow = skinColorObj.clone().lerp(browColorObj, t * 0.82);
        bodyColors.push(curBrow.r, curBrow.g, curBrow.b);
      }
    } else if (eyeVertIndices.has(oldIdx)) {
      // High-Fidelity Anatomical Eye Shading: pupil, specular catchlight, iris, limbal ring, sclera, and eyelid cast shadow
      const eyeCenterX = Math.abs(px) - 0.0282;
      const eyeCenterY = py - 1.5594;
      const eyeDist = Math.hypot(eyeCenterX, eyeCenterY);

      // Upper eyelid coverage & shadow: eliminate demonic wide-eyed staring
      if (py >= 1.5630 && pz > 0.044) {
        // Upper eyelid skin fold covering top of eyeball
        bodyColors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
      } else if (py >= 1.5615 && py < 1.5630 && pz > 0.044) {
        // Upper eyeliner / dense lash line (defines beautiful feminine eyes)
        bodyColors.push(0.10, 0.06, 0.05);
      } else {
        // Specular lively catchlight highlight on front-upper pupil margin
        const specDist = Math.hypot(Math.abs(px) - 0.0268, py - 1.5616);
        if (specDist < 0.0016 && pz > 0.050) {
          bodyColors.push(1.0, 1.0, 1.0); // Radiant lively catchlight
        } else if (eyeDist < 0.0036 && pz > 0.046) {
          bodyColors.push(pupilColorObj.r, pupilColorObj.g, pupilColorObj.b); // Deep obsidian pupil
        } else if (eyeDist < 0.0090 && pz > 0.043) {
          // Warm glowing multi-tone iris gradient
          const irisT = Math.max(0, Math.min(1, (eyeDist - 0.0036) / (0.0090 - 0.0036)));
          const curIris = irisCoreColorObj.clone().lerp(irisOuterColorObj, irisT);
          bodyColors.push(curIris.r, curIris.g, curIris.b);
        } else if (eyeDist < 0.0102 && pz > 0.041) {
          // Soft dark limbal ring (adds youthful depth and definition)
          bodyColors.push(limbalRingColorObj.r, limbalRingColorObj.g, limbalRingColorObj.b);
        } else {
          // Natural sclera with soft corner warmth & eyelash cast shadow
          const cornerFactor = Math.min(1.0, Math.abs(eyeCenterX) / 0.015);
          let curSclera = scleraColorObj.clone().lerp(scleraCornerColorObj, cornerFactor * 0.45);
          if (py > 1.5585) {
            const shadowT = Math.min(1.0, (py - 1.5585) / 0.0045);
            curSclera = curSclera.lerp(new THREE.Color('#4a3c38'), shadowT * 0.65);
          }
          bodyColors.push(curSclera.r, curSclera.g, curSclera.b);
        }
      }
    } else if (teethVertIndices.has(oldIdx)) {
      bodyColors.push(teethColorObj.r, teethColorObj.g, teethColorObj.b);
    } else if (tongueVertIndices.has(oldIdx)) {
      bodyColors.push(tongueColorObj.r, tongueColorObj.g, tongueColorObj.b);
    } else {
      // Facial skin shading: soft cheek blush, sculpted lips, and scalp protection
      const absPx = Math.abs(px);

      // Scalp shading under hair to prevent any visible pale skin
      if ((py >= 1.60 && pz < 0.046) || py >= 1.635 || (py > 1.55 && pz < 0.025)) {
        bodyColors.push(hairColorObj.r * 0.7, hairColorObj.g * 0.7, hairColorObj.b * 0.7);
      }
      // Sculpted vermilion lips with soft gradient
      else {
        const lipX = absPx / 0.0185;
        const lipY = Math.abs(py - 1.492) / 0.011;
        const lipDistSq = lipX * lipX + lipY * lipY;
        if (lipDistSq < 1.0 && pz > 0.045) {
          const lipAlpha = Math.max(0, 1.0 - lipDistSq);
          const curLip = skinColorObj.clone().lerp(lipColorObj, 0.45 + 0.50 * lipAlpha);
          bodyColors.push(curLip.r, curLip.g, curLip.b);
        }
        // Soft peach-rose blush on cheekbones (healthy youthful glow)
        else if (absPx >= 0.026 && absPx <= 0.055 && py >= 1.505 && py <= 1.545 && pz > 0.041) {
          const blushDist = Math.hypot((absPx - 0.040) / 0.015, (py - 1.525) / 0.020);
          if (blushDist < 1.0) {
            const bAlpha = (1.0 - blushDist) * 0.22;
            const blushed = skinColorObj.clone().lerp(blushColorObj, bAlpha);
            bodyColors.push(blushed.r, blushed.g, blushed.b);
          } else {
            bodyColors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
          }
        } else {
          bodyColors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
        }
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

  const normAttr = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;

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

      // Tailor shirt: clean neckline, relaxed feminine shoulders, smooth hemline
      if (id === 'female-top') {
        // Relax masculine shoulder pads
        if (py >= 1.28 && py <= 1.38 && Math.abs(px) > 0.14) {
          py -= 0.012;
        }
        // Neat hem welt overlapping jeans waistband
        if (py < 0.965 && Math.abs(px) < 0.22) {
          if (py < 0.942) {
            py = 0.938;
          }
          const rad = Math.hypot(px, pz);
          if (rad > 0.05) {
            const exp = 1.0 + 0.0045 / rad;
            px *= exp;
            pz *= exp;
          }
        }
        // Smooth sleeve wrinkles along the arms
        if (Math.abs(px) > 0.18 && py >= 0.90 && py <= 1.25) {
          pz = pz * 0.95;
        }
      }

      // Jeans: seamless pelvic seat & 100% gluteal coverage (zero butt cutout or skin poke-through)
      if (id === 'female-jeans') {
        if (py > 0.952 && Math.abs(px) < 0.22) {
          py = 0.962;
        }
        // Expand gluteals backward and radially to guarantee complete enclosure over skin
        if (py >= 0.70 && py <= 0.96) {
          if (pz < 0) {
            pz -= 0.007; // 7mm posterior expansion
          }
          const rad = Math.hypot(px, pz);
          if (rad > 0.05) {
            const exp = 1.0 + 0.005 / rad;
            px *= exp;
            pz *= exp;
          }
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
