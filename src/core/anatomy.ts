import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';

export interface AnatomicalMeshBuffer {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  colors?: number[];
}

/**
 * Creates a smooth lofted tubular manifold mesh between elliptical rings.
 * Supports convex dome joint caps for articulated anatomical kinematics and physics.
 */
export function buildLoftSegment(
  rings: {
    y: number;
    centerX: number;
    centerZ: number;
    radiusX: number;
    radiusZ: number;
    deform?: (angle: number, rx: number, rz: number) => [number, number];
  }[],
  radialSegments: number = 32,
  capBottom: boolean | number = false,
  capTop: boolean | number = false
): AnatomicalMeshBuffer {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const ringVertIndices: number[][] = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const ringIndices: number[] = [];
    const vCoord = r / Math.max(1, rings.length - 1);

    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * Math.PI * 2;
      const uCoord = s / radialSegments;

      let rx = Math.cos(angle) * ring.radiusX;
      let rz = Math.sin(angle) * ring.radiusZ;

      if (ring.deform) {
        [rx, rz] = ring.deform(angle, rx, rz);
      }

      const x = ring.centerX + rx;
      const y = ring.y;
      const z = ring.centerZ + rz;

      const vIdx = positions.length / 3;
      positions.push(x, y, z);
      uvs.push(uCoord, vCoord);
      ringIndices.push(vIdx);
    }
    ringVertIndices.push(ringIndices);
  }

  // Quads between successive rings
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      const i0 = ringVertIndices[r][s];
      const i1 = ringVertIndices[r][nextS];
      const i2 = ringVertIndices[r + 1][nextS];
      const i3 = ringVertIndices[r + 1][s];
      indices.push(i0, i1, i2, i0, i2, i3);
    }
  }

  // Cap bottom if requested (flat disc if true, convex rounded dome if number)
  if (capBottom !== false && rings.length > 0) {
    const bottomCenterIdx = positions.length / 3;
    const bRing = rings[0];
    const domeOffset = typeof capBottom === 'number' ? capBottom : 0;
    positions.push(bRing.centerX, bRing.y - domeOffset, bRing.centerZ);
    uvs.push(0.5, 0.5);
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      indices.push(bottomCenterIdx, ringVertIndices[0][nextS], ringVertIndices[0][s]);
    }
  }

  // Cap top if requested (flat disc if true, convex rounded dome if number)
  if (capTop !== false && rings.length > 0) {
    const topIdx = rings.length - 1;
    const topCenterIdx = positions.length / 3;
    const tRing = rings[topIdx];
    const domeOffset = typeof capTop === 'number' ? capTop : 0;
    positions.push(tRing.centerX, tRing.y + domeOffset, tRing.centerZ);
    uvs.push(0.5, 0.5);
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      indices.push(topCenterIdx, ringVertIndices[topIdx][s], ringVertIndices[topIdx][nextS]);
    }
  }

  // Compute normals
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normals = Array.from(geo.getAttribute('normal').array as Float32Array);

  return { positions, normals, uvs, indices };
}

/**
 * Generates an organic female or male thoracic torso (chest, breasts, ribcage, shoulders).
 * Vertical span: y = 1.01m to 1.34m.
 */
export function generateOrganicTorso(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const ringsCount = 28;
  const radialSegs = 36;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const minY = 1.01 * scale;
  const maxY = 1.34 * scale;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    // Base torso dimensions: narrows at waist (t = 0), broadens at thoracic chest (t ~ 0.75), shoulders at t ~ 0.90, and curves smoothly inward to neck collar at t = 1.0 (matching neck base)
    let rX: number;
    let rZ: number;
    if (t <= 0.88) {
      const ut = t / 0.88;
      rX = (0.112 + ut * 0.058) * scale;
      rZ = (0.071 + ut * 0.024) * scale;
    } else {
      // Clavicular shoulder shelf sloping inward to neck collar
      const nt = (t - 0.88) / 0.12;
      rX = (0.170 - nt * 0.120) * scale; // Reaches 0.050 * scale (matches neck base!)
      rZ = (0.095 - nt * 0.043) * scale; // Reaches 0.052 * scale (matches neck base!)
    }

    // Female slender waist narrowing at t in [0.0, 0.25]
    if (isFemale && t < 0.25) {
      rX *= 0.96;
      rZ *= 0.95;
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: -0.005 * scale,
      radiusX: rX,
      radiusZ: rZ,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Breasts (Front: defZ > 0, y in [1.11, 1.28] * scale)
        if (isFemale && defZ > 0 && y >= 1.11 * scale && y <= 1.285 * scale) {
          const bustT = Math.sin(((y - 1.11 * scale) / (0.175 * scale)) * Math.PI);
          const breastCx = 0.075 * scale;
          const absX = Math.abs(defX);
          const breastDist = Math.abs(absX - breastCx);

          if (breastDist < 0.075 * scale) {
            const wX = Math.cos((breastDist / (0.075 * scale)) * (Math.PI / 2)) ** 2;
            // Gentle natural teardrop hang without sharp angular protrusion
            const hang = y < 1.20 * scale ? 1.0 + (1.20 * scale - y) * 1.2 : 1.0;
            defZ += wX * bustT * 0.032 * scale * hang;
            defX += Math.sign(defX) * wX * bustT * 0.005 * scale;
          }
        }

        // Male pectorals
        if (!isFemale && defZ > 0 && y >= 1.16 * scale && y <= 1.30 * scale) {
          const pecT = Math.sin(((y - 1.16 * scale) / (0.14 * scale)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX < 0.14 * scale) {
            const wPec = Math.cos((absX / (0.14 * scale)) * (Math.PI / 2));
            defZ += wPec * pecT * 0.022 * scale;
          }
        }

        // Clavicle collarbone horizontal definition at upper chest
        if (defZ > 0 && y >= 1.305 * scale && y <= 1.335 * scale) {
          const cT = Math.sin(((y - 1.305 * scale) / (0.030 * scale)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX > 0.025 * scale && absX < 0.155 * scale) {
            defZ += cT * 0.007 * scale;
          }
        }

        // Midline cleavage/sternum furrow (defZ > 0, |defX| < 0.02)
        if (defZ > 0 && Math.abs(defX) < 0.024 * scale && y >= 1.13 * scale && y <= 1.27 * scale) {
          const fT = Math.cos((Math.abs(defX) / (0.024 * scale)) * (Math.PI / 2));
          defZ -= fT * 0.008 * scale;
        }

        // Back: Thoracic spine groove along midline (defZ < 0, |defX| < 0.022)
        if (defZ < 0 && Math.abs(defX) < 0.022 * scale) {
          const sT = Math.cos((Math.abs(defX) / (0.022 * scale)) * (Math.PI / 2));
          defZ += sT * 0.005 * scale; // Inset into torso
        }

        return [defX, defZ];
      },
    });
  }

  const loft = buildLoftSegment(rings, radialSegs, false, false);

  // Force forward-pointing normals on chest to ensure beautiful shading
  const p = loft.positions;
  const n = loft.normals;
  for (let i = 0; i < p.length / 3; i++) {
    const py = p[i * 3 + 1];
    const pz = p[i * 3 + 2];
    if (py >= 1.00 * scale && py <= 1.38 * scale && pz > 0.03 * scale) {
      if (n[i * 3 + 2] <= 0) {
        n[i * 3 + 2] = 0.10;
        const len = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
        n[i * 3] /= len;
        n[i * 3 + 1] /= len;
        n[i * 3 + 2] /= len;
      }
    }
  }

  return loft;
}

/**
 * Generates an organic female or male pelvis (hips, waist, abdomen, gluteal curvature, perineum).
 * Vertical span: y = 0.72m to 1.02m.
 */
export function generateOrganicPelvis(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const ringsCount = 26;
  const radialSegs = 36;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const minY = 0.725 * scale;
  const maxY = 1.020 * scale;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    // Base pelvis radii: wide at hips (y ~ 0.82 - 0.88), tapering to waist (y ~ 1.01)
    let rX: number;
    let rZ: number;

    if (t < 0.40) {
      // Lower pelvis / perineum
      const lt = t / 0.40;
      rX = (0.135 + lt * 0.032) * scale;
      rZ = (0.095 + lt * 0.025) * scale;
    } else {
      // Mid hips to waist
      const ut = (t - 0.40) / 0.60;
      const hipFactor = Math.sin(ut * Math.PI);
      rX = (0.167 * (1.0 - ut * 0.28) + (isFemale ? hipFactor * 0.015 : 0)) * scale;
      rZ = (0.120 * (1.0 - ut * 0.36)) * scale;
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: -0.010 * scale,
      radiusX: rX,
      radiusZ: rZ,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Buttocks / Gluteal curvature in back (defZ < 0, y in [0.73, 0.90] * scale)
        if (defZ < 0 && y >= 0.73 * scale && y <= 0.91 * scale) {
          const gT = Math.sin(((y - 0.73 * scale) / (0.18 * scale)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX >= 0.015 * scale && absX <= 0.155 * scale) {
            const wX = Math.sin(((absX - 0.015 * scale) / (0.140 * scale)) * Math.PI);
            const buttockProj = isFemale ? 0.038 : 0.025;
            defZ -= wX * gT * buttockProj * scale; // Project backward
          }
          // Intergluteal cleft at midline x = 0
          if (absX < 0.020 * scale) {
            const cT = Math.cos((absX / (0.020 * scale)) * (Math.PI / 2));
            defZ += cT * 0.010 * scale; // Inset crease
          }
        }

        // Gentle lower abdominal curvature (defZ > 0, y in [0.76, 0.92] * scale)
        if (defZ > 0 && y >= 0.76 * scale && y <= 0.92 * scale) {
          const abT = Math.sin(((y - 0.76 * scale) / (0.16 * scale)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX < 0.12 * scale) {
            const wAb = Math.cos((absX / (0.12 * scale)) * (Math.PI / 2));
            defZ += wAb * abT * (isFemale ? 0.012 : 0.008) * scale;
          }
        }

        // Navel depression at y ~ 1.00 * scale, x = 0, z > 0
        if (defZ > 0 && Math.abs(y - 1.00 * scale) < 0.015 * scale && Math.abs(defX) < 0.015 * scale) {
          const navelDist = Math.hypot(defX, y - 1.00 * scale) / (0.015 * scale);
          if (navelDist < 1.0) {
            const nFactor = Math.cos(navelDist * (Math.PI / 2)) ** 2;
            defZ -= nFactor * 0.006 * scale;
          }
        }

        return [defX, defZ];
      },
    });
  }

  // Capped bottom at perineum floor with convex pelvic seal
  return buildLoftSegment(rings, radialSegs, 0.012 * scale, false);
}

/**
 * Generates an organic arm segment (upperarm or forearm).
 */
export function generateOrganicArm(
  type: 'upperarm' | 'forearm',
  side: 'left' | 'right',
  scale: number = 1.0
): AnatomicalMeshBuffer {
  const sign = side === 'right' ? 1 : -1;
  const ringsCount = 18;
  const radialSegs = 24;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  let start: THREE.Vector3;
  let end: THREE.Vector3;
  let startR: number;
  let endR: number;

  if (type === 'upperarm') {
    start = new THREE.Vector3(sign * 0.186 * scale, 1.300 * scale, -0.074 * scale);
    end = new THREE.Vector3(sign * 0.214 * scale, 1.050 * scale, -0.041 * scale);
    startR = 0.034 * scale;
    endR = 0.026 * scale;
  } else {
    start = new THREE.Vector3(sign * 0.214 * scale, 1.050 * scale, -0.041 * scale);
    end = new THREE.Vector3(sign * 0.267 * scale, 0.880 * scale, 0.005 * scale);
    startR = 0.026 * scale;
    endR = 0.020 * scale; // Matches slender wrist of scanned hand
  }

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const curP = new THREE.Vector3().lerpVectors(start, end, t);

    // Anatomical muscle contouring
    let curR = startR + (endR - startR) * t;
    if (type === 'upperarm' && t > 0.25 && t < 0.75) {
      curR += Math.sin((t - 0.25) * 2 * Math.PI) * 0.003 * scale; // Subtle bicep/tricep fullness
    }
    if (type === 'forearm' && t < 0.45) {
      curR += Math.sin((t / 0.45) * Math.PI) * 0.004 * scale; // Brachioradialis fullness
    }

    rings.push({
      y: curP.y,
      centerX: curP.x,
      centerZ: curP.z,
      radiusX: curR,
      radiusZ: curR * 0.94,
    });
  }

  const capB = type === 'upperarm' ? 0.012 * scale : 0.010 * scale;
  const capT = type === 'upperarm' ? 0.022 * scale : 0.012 * scale;
  return buildLoftSegment(rings, radialSegs, capB, capT);
}

/**
 * Generates an organic leg segment (thigh or shin).
 */
export function generateOrganicLeg(
  type: 'thigh' | 'shin',
  side: 'left' | 'right',
  scale: number = 1.0
): AnatomicalMeshBuffer {
  const sign = side === 'right' ? 1 : -1;
  const ringsCount = 22;
  const radialSegs = 28;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  let start: THREE.Vector3;
  let end: THREE.Vector3;
  let startRx: number;
  let startRz: number;
  let endRx: number;
  let endRz: number;

  if (type === 'thigh') {
    start = new THREE.Vector3(sign * 0.108 * scale, 0.725 * scale, -0.035 * scale);
    end = new THREE.Vector3(sign * 0.145 * scale, 0.440 * scale, -0.055 * scale);
    startRx = 0.062 * scale;
    startRz = 0.066 * scale;
    endRx = 0.042 * scale;
    endRz = 0.044 * scale;
  } else {
    start = new THREE.Vector3(sign * 0.145 * scale, 0.440 * scale, -0.055 * scale);
    end = new THREE.Vector3(sign * 0.178 * scale, 0.078 * scale, -0.056 * scale);
    startRx = 0.042 * scale;
    startRz = 0.044 * scale;
    endRx = 0.024 * scale; // Slender ankle
    endRz = 0.026 * scale;
  }

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const curP = new THREE.Vector3().lerpVectors(start, end, t);

    // Anatomical curvature: shin curves slightly posterior around gastrocnemius calf (matching jeans)
    if (type === 'shin') {
      curP.z -= Math.sin(t * Math.PI) * 0.012 * scale;
    }

    let curRx = startRx + (endRx - startRx) * t;
    let curRz = startRz + (endRz - startRz) * t;

    rings.push({
      y: curP.y,
      centerX: curP.x,
      centerZ: curP.z,
      radiusX: curRx,
      radiusZ: curRz,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Thigh: Quadriceps anterior projection
        if (type === 'thigh' && defZ > 0 && t < 0.70) {
          defZ += Math.sin((t / 0.70) * Math.PI) * 0.005 * scale;
        }

        // Shin: Patellar tendon / knee cap at t < 0.15
        if (type === 'shin' && defZ > 0 && t < 0.15) {
          defZ += Math.sin((t / 0.15) * Math.PI) * 0.005 * scale;
        }

        // Shin: Gastrocnemius calf fullness in back (defZ < 0, t in [0.20, 0.65])
        if (type === 'shin' && defZ < 0 && t >= 0.20 && t <= 0.65) {
          const calfT = Math.sin(((t - 0.20) / 0.45) * Math.PI);
          defZ -= calfT * 0.008 * scale; // Bulge backward
        }

        return [defX, defZ];
      },
    });
  }

  const capB = type === 'thigh' ? 0.016 * scale : 0.010 * scale;
  const capT = type === 'thigh' ? 0.022 * scale : 0.016 * scale;
  return buildLoftSegment(rings, radialSegs, capB, capT);
}

/**
 * Generates an organic human bare foot with calcaneus heel, arch, instep, and 5 toes.
 * Grounded at y = 0.00m.
 */
export function generateOrganicFoot(
  side: 'left' | 'right',
  scale: number = 1.0
): AnatomicalMeshBuffer {
  const sign = side === 'right' ? 1 : -1;
  const ankleX = sign * 0.178 * scale;
  const ankleZ = -0.056 * scale;
  const centerX = ankleX;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Foot cross-section slices along length (from calcaneus heel to toes)
  // Aligned precisely with ankle at (sign * 0.178, 0.078, -0.056)
  const zSlices = 16;
  const ringSegs = 20;
  const ringVerts: number[][] = [];

  const minZ = ankleZ - 0.052 * scale;
  const maxZ = ankleZ + 0.165 * scale;

  for (let i = 0; i < zSlices; i++) {
    const t = i / (zSlices - 1);
    const z = minZ + (maxZ - minZ) * t;

    // Height & width profile along foot length
    let halfW: number;
    let topY: number;
    let botY: number = 0.000; // Ground plane

    if (t < 0.25) {
      // Heel (calcaneus) rising toward ankle joint (y = 0.078)
      const ht = t / 0.25;
      halfW = (0.024 + ht * 0.008) * scale;
      topY = (0.045 + ht * 0.033) * scale;
      botY = 0.000;
    } else if (t < 0.65) {
      // Midfoot & instep / longitudinal arch
      const mt = (t - 0.25) / 0.40;
      halfW = (0.032 + mt * 0.010) * scale;
      topY = (0.078 - mt * 0.033) * scale;
      botY = 0.000;
    } else {
      // Forefoot ball & 5 toes
      const ft = (t - 0.65) / 0.35;
      halfW = (0.042 * (1.0 - ft * 0.35)) * scale;
      topY = (0.045 * (1.0 - ft * 0.65)) * scale;
      botY = 0.000;
    }

    const ringIndices: number[] = [];
    for (let s = 0; s < ringSegs; s++) {
      const angle = (s / ringSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let px = centerX + cosA * halfW;
      let py: number;

      if (sinA >= 0) {
        // Upper instep dome
        py = botY + sinA * (topY - botY);
      } else {
        // Sole of foot (flat on ground at y = 0.00)
        py = botY;
        // Subtle medial arch lift on inner side (inner side is -X for right foot, +X for left foot)
        const isMedial = sign > 0 ? cosA < 0 : cosA > 0;
        if (isMedial && t >= 0.25 && t <= 0.65) {
          py += Math.abs(cosA) * Math.sin(((t - 0.25) / 0.40) * Math.PI) * 0.016 * scale;
        }
      }

      // Sculpt individual toe bumps near tip (t > 0.85)
      if (t > 0.85) {
        const toeFactor = Math.sin(((px - centerX) / halfW) * Math.PI * 2.5);
        py += Math.max(0, toeFactor) * 0.003 * scale;
      }

      const vIdx = positions.length / 3;
      positions.push(px, Math.max(0.000, py), z);
      uvs.push(s / ringSegs, t);
      ringIndices.push(vIdx);
    }
    ringVerts.push(ringIndices);
  }

  for (let i = 0; i < zSlices - 1; i++) {
    for (let s = 0; s < ringSegs; s++) {
      const nextS = (s + 1) % ringSegs;
      const i0 = ringVerts[i][s];
      const i1 = ringVerts[i][nextS];
      const i2 = ringVerts[i + 1][nextS];
      const i3 = ringVerts[i + 1][s];
      indices.push(i0, i1, i2, i0, i2, i3);
    }
  }

  // Heel cap
  const heelCenterIdx = positions.length / 3;
  positions.push(centerX, 0.020 * scale, minZ);
  uvs.push(0.5, 0.5);
  for (let s = 0; s < ringSegs; s++) {
    const nextS = (s + 1) % ringSegs;
    indices.push(heelCenterIdx, ringVerts[0][nextS], ringVerts[0][s]);
  }

  // Toe tips cap
  const toeCenterIdx = positions.length / 3;
  positions.push(centerX, 0.008 * scale, maxZ);
  uvs.push(0.5, 0.5);
  for (let s = 0; s < ringSegs; s++) {
    const nextS = (s + 1) % ringSegs;
    indices.push(toeCenterIdx, ringVerts[zSlices - 1][s], ringVerts[zSlices - 1][nextS]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normals = Array.from(geo.getAttribute('normal').array as Float32Array);

  return { positions, normals, uvs, indices };
}

/**
 * Generates an organic neck segment.
 * Vertical span: y = 1.34m to 1.45m.
 */
export function generateOrganicNeck(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const ringsCount = 12;
  const radialSegs = 28;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const minY = 1.335 * scale;
  const maxY = 1.450 * scale;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    // Tapering from clavicle base up to throat / jawline
    let rX = (0.052 - t * 0.007) * (isFemale ? 0.92 : 1.0) * scale;
    let rZ = (0.054 - t * 0.006) * (isFemale ? 0.92 : 1.0) * scale;

    rings.push({
      y,
      centerX: 0,
      centerZ: (-0.008 + t * 0.004) * scale,
      radiusX: rX,
      radiusZ: rZ,
    });
  }

  return buildLoftSegment(rings, radialSegs, false, false);
}

/**
 * Combines multiple AnatomicalMeshBuffers into a single unified buffer.
 */
export function mergeMeshBuffers(buffers: AnatomicalMeshBuffer[]): AnatomicalMeshBuffer {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  let hasColors = false;
  for (const b of buffers) {
    if (b.colors && b.colors.length > 0) hasColors = true;
  }

  for (const b of buffers) {
    const vOffset = positions.length / 3;
    positions.push(...b.positions);
    normals.push(...b.normals);
    uvs.push(...b.uvs);

    if (b.indices) {
      for (const idx of b.indices) {
        indices.push(idx + vOffset);
      }
    }

    if (hasColors) {
      if (b.colors && b.colors.length === b.positions.length) {
        colors.push(...b.colors);
      } else {
        // Default skin tone
        for (let i = 0; i < b.positions.length / 3; i++) {
          colors.push(0.88, 0.67, 0.51);
        }
      }
    }
  }

  return {
    positions,
    normals,
    uvs,
    indices,
    colors: hasColors ? colors : undefined,
  };
}

/**
 * Extracts a self-contained sub-mesh buffer from a subset of triangle indices.
 */
export function extractSubmeshBuffer(
  tris: number[],
  allPos: number[],
  allCols?: number[]
): AnatomicalMeshBuffer {
  const uSet = Array.from(new Set(tris));
  const remap = new Map<number, number>();
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i < uSet.length; i++) {
    const oldIdx = uSet[i];
    remap.set(oldIdx, i);
    positions.push(allPos[oldIdx * 3], allPos[oldIdx * 3 + 1], allPos[oldIdx * 3 + 2]);
    if (allCols && allCols.length >= (oldIdx + 1) * 3) {
      colors.push(allCols[oldIdx * 3], allCols[oldIdx * 3 + 1], allCols[oldIdx * 3 + 2]);
    }
  }

  const indices = tris.map((oldIdx) => remap.get(oldIdx)!);
  const uvs = new Array((positions.length / 3) * 2).fill(0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normals = Array.from(geo.getAttribute('normal').array as Float32Array);

  return {
    positions,
    normals,
    uvs,
    indices,
    colors: colors.length === positions.length ? colors : undefined,
  };
}

/**
 * Helper to build a SceneItem from an AnatomicalMeshBuffer.
 */
export function createSceneItemFromBuffer(
  id: string,
  name: string,
  buffer: AnatomicalMeshBuffer,
  material: MaterialProperties
): SceneItem {
  return {
    id,
    name,
    type: 'mesh',
    primitiveType: 'custom',
    geometryParams: {
      customGeometry: {
        positions: buffer.positions,
        normals: buffer.normals,
        uvs: buffer.uvs,
        colors: buffer.colors,
        indices: buffer.indices,
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
