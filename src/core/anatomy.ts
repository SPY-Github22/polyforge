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
  radialSegments: number = 36,
  capBottom: boolean | number = false,
  capTop: boolean | number = false,
  vertexColor?: THREE.Color | [number, number, number]
): AnatomicalMeshBuffer {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  const [colR, colG, colB] =
    vertexColor instanceof THREE.Color
      ? [vertexColor.r, vertexColor.g, vertexColor.b]
      : Array.isArray(vertexColor)
      ? vertexColor
      : [0.88, 0.67, 0.51];

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
      colors.push(colR, colG, colB);
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
    colors.push(colR, colG, colB);
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
    colors.push(colR, colG, colB);
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

  return { positions, normals, uvs, indices, colors };
}

function resolveSkinColor(skinColor?: string | THREE.Color, isFemale: boolean = true): THREE.Color {
  if (skinColor instanceof THREE.Color) return skinColor.clone();
  if (typeof skinColor === 'string') return new THREE.Color(skinColor);
  return new THREE.Color(isFemale ? '#e0ac82' : '#d4a373');
}

/**
 * Generates an organic female or male thoracic torso (chest, breasts, ribcage, shoulders).
 * Vertical span:
 * Female: y = 0.950m to 1.265m (connects to pelvis at y = 0.95m and neck at y = 1.26m).
 * Male: y = 1.010m to 1.340m.
 */
export function generateOrganicTorso(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0,
  skinColor?: string | THREE.Color
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const skinColorObj = resolveSkinColor(skinColor, isFemale);
  const ringsCount = 36;
  const radialSegs = 48;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  // Multiplier relative to natural gender baseline
  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  const minY = isFemale ? 1.010 * mult : 1.070 * mult;
  const maxY = isFemale ? 1.350 * mult : 1.430 * mult;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    let rX: number;
    let rZ: number;

    if (isFemale) {
      // Slender athletic female waist at t = 0 (y = 1.01m), graceful clavicular slope to petite shoulders at x = ±0.144 (y = 1.335m)
      if (t <= 0.88) {
        const ut = t / 0.88;
        rX = (0.106 + ut * 0.038) * mult; // Reaches 0.144 * mult at shoulders (slender athletic span)
        rZ = (0.066 + ut * 0.012) * mult; // Reaches 0.078 * mult (petite upper back, zero bulk)
      } else {
        const nt = (t - 0.88) / 0.12;
        rX = (0.144 - nt * 0.096) * mult; // Reaches 0.048 * mult (matches neck base!)
        rZ = (0.078 - nt * 0.030) * mult; // Reaches 0.048 * mult (matches neck base!)
      }
      // Pronounced feminine waist taper in lower torso
      if (t < 0.30) {
        const wT = Math.cos((t / 0.30) * (Math.PI / 2));
        rX *= 1.0 - wT * 0.05;
        rZ *= 1.0 - wT * 0.05;
      }
    } else {
      // Male broad V-taper
      if (t <= 0.88) {
        const ut = t / 0.88;
        rX = (0.125 + ut * 0.060) * mult;
        rZ = (0.078 + ut * 0.028) * mult;
      } else {
        const nt = (t - 0.88) / 0.12;
        rX = (0.185 - nt * 0.129) * mult; // Reaches 0.056 * mult (matches male neck base)
        rZ = (0.106 - nt * 0.050) * mult;
      }
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: -0.008 * mult,
      radiusX: rX,
      radiusZ: rZ,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Female Breasts: full teardrop curvature, natural lateral cant, and inframammary fold
        if (isFemale && defZ > 0 && y >= 1.140 * mult && y <= 1.300 * mult) {
          const bustT = Math.sin(((y - 1.140 * mult) / (0.160 * mult)) * Math.PI);
          const breastCx = 0.076 * mult;
          const absX = Math.abs(defX);
          const breastDist = Math.abs(absX - breastCx);

          if (breastDist < 0.078 * mult) {
            const wX = Math.cos((breastDist / (0.078 * mult)) * (Math.PI / 2)) ** 2;
            const hang = y < 1.23 * mult ? 1.0 + (1.23 * mult - y) * 1.5 : 1.0;
            defZ += wX * bustT * 0.038 * mult * hang;
            defX += Math.sign(defX) * wX * bustT * 0.006 * mult;
          }
        }

        // Male Pectorals
        if (!isFemale && defZ > 0 && y >= 1.22 * mult && y <= 1.38 * mult) {
          const pecT = Math.sin(((y - 1.22 * mult) / (0.16 * mult)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX < 0.145 * mult) {
            const wPec = Math.cos((absX / (0.145 * mult)) * (Math.PI / 2));
            defZ += wPec * pecT * 0.024 * mult;
          }
        }

        // Clavicle collarbone horizontal definition at upper chest
        const clavMinY = isFemale ? 1.330 * mult : 1.400 * mult;
        const clavMaxY = isFemale ? 1.350 * mult : 1.430 * mult;
        if (defZ > 0 && y >= clavMinY && y <= clavMaxY) {
          const cT = Math.sin(((y - clavMinY) / (clavMaxY - clavMinY)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX > 0.025 * mult && absX < 0.155 * mult) {
            defZ += cT * 0.008 * mult;
          }
        }

        // Midline cleavage/sternum furrow (defZ > 0, |defX| < 0.022)
        const furrowMinY = isFemale ? 1.16 * mult : 1.22 * mult;
        const furrowMaxY = isFemale ? 1.30 * mult : 1.36 * mult;
        if (defZ > 0 && Math.abs(defX) < 0.024 * mult && y >= furrowMinY && y <= furrowMaxY) {
          const fT = Math.cos((Math.abs(defX) / (0.024 * mult)) * (Math.PI / 2));
          defZ -= fT * 0.008 * mult;
        }

        // Back: Thoracic spine groove along midline
        if (defZ < 0 && Math.abs(defX) < 0.022 * mult) {
          const sT = Math.cos((Math.abs(defX) / (0.022 * mult)) * (Math.PI / 2));
          defZ += sT * 0.005 * mult;
        }

        return [defX, defZ];
      },
    });
  }

  const loft = buildLoftSegment(rings, radialSegs, false, false, skinColorObj);

  // Force forward-pointing outward normals on chest for flawless lighting
  const p = loft.positions;
  const n = loft.normals;
  for (let i = 0; i < p.length / 3; i++) {
    const py = p[i * 3 + 1];
    const pz = p[i * 3 + 2];
    if (py >= 0.95 * mult && py <= 1.38 * mult && pz > 0.03 * mult) {
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
 * Generates an organic female or male pelvis (hips, waist, gluteals, hip sockets).
 * Vertical span:
 * Female: y = 0.700m to 0.960m (connects to thighs at y = 0.70m and torso waist at y = 0.95m).
 * Male: y = 0.740m to 1.020m.
 */
export function generateOrganicPelvis(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0,
  skinColor?: string | THREE.Color
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const skinColorObj = resolveSkinColor(skinColor, isFemale);
  const ringsCount = 36;
  const radialSegs = 48;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  const minY = isFemale ? 0.730 * mult : 0.770 * mult;
  const maxY = isFemale ? 1.020 * mult : 1.080 * mult;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    let rX: number;
    let rZ: number;

    if (isFemale) {
      // Natural athletic feminine gynoid pelvis: slender waist (y = 1.01m), natural hips (y ~ 0.88m), non-bulky rear
      if (t < 0.35) {
        // Lower pelvis / perineum / hip socket shelf connecting to thighs at y = 0.74m
        const lt = t / 0.35;
        rX = (0.130 + lt * 0.024) * mult;
        rZ = (0.076 + lt * 0.016) * mult;
      } else {
        // Mid hips tapering to slender waist
        const ut = (t - 0.35) / 0.65;
        const hipFactor = Math.sin(ut * Math.PI);
        rX = (0.154 * (1.0 - ut * 0.30) + hipFactor * 0.008) * mult; // Waist rX ~ 0.108 * mult
        rZ = (0.092 * (1.0 - ut * 0.31)) * mult; // Waist rZ ~ 0.063 * mult (exact match with torso base!)
      }
    } else {
      if (t < 0.35) {
        const lt = t / 0.35;
        rX = (0.138 + lt * 0.030) * mult;
        rZ = (0.098 + lt * 0.024) * mult;
      } else {
        const ut = (t - 0.35) / 0.65;
        rX = (0.168 * (1.0 - ut * 0.25)) * mult;
        rZ = (0.122 * (1.0 - ut * 0.35)) * mult;
      }
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: (isFemale ? -0.008 : -0.012) * mult,
      radiusX: rX,
      radiusZ: rZ,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Gluteal Curvature in back (defZ < 0)
        const gMinY = isFemale ? 0.740 * mult : 0.780 * mult;
        const gMaxY = isFemale ? 0.940 * mult : 0.980 * mult;
        if (defZ < 0 && y >= gMinY && y <= gMaxY) {
          const gT = Math.sin(((y - gMinY) / (gMaxY - gMinY)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX >= 0.015 * mult && absX <= 0.160 * mult) {
            const wX = Math.sin(((absX - 0.015 * mult) / (0.145 * mult)) * Math.PI);
            const buttockProj = isFemale ? 0.018 : 0.026;
            defZ -= wX * gT * buttockProj * mult; // Subtle, athletic curvature (zero rear bulge)
          }
          // Intergluteal cleft at midline x = 0
          if (absX < 0.022 * mult) {
            const cT = Math.cos((absX / (0.022 * mult)) * (Math.PI / 2));
            defZ += cT * 0.012 * mult; // Inset crease
          }
        }

        // Lower abdominal curvature (defZ > 0)
        const abMinY = isFemale ? 0.780 * mult : 0.820 * mult;
        const abMaxY = isFemale ? 0.960 * mult : 1.000 * mult;
        if (defZ > 0 && y >= abMinY && y <= abMaxY) {
          const abT = Math.sin(((y - abMinY) / (abMaxY - abMinY)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX < 0.12 * mult) {
            const wAb = Math.cos((absX / (0.12 * mult)) * (Math.PI / 2));
            defZ += wAb * abT * (isFemale ? 0.014 : 0.009) * mult;
          }
        }

        // Navel depression
        const navelY = isFemale ? 0.960 * mult : 1.020 * mult;
        if (defZ > 0 && Math.abs(y - navelY) < 0.016 * mult && Math.abs(defX) < 0.016 * mult) {
          const navelDist = Math.hypot(defX, y - navelY) / (0.016 * mult);
          if (navelDist < 1.0) {
            const nFactor = Math.cos(navelDist * (Math.PI / 2)) ** 2;
            defZ -= nFactor * 0.006 * mult;
          }
        }

        return [defX, defZ];
      },
    });
  }

  // Capped bottom at perineum floor with convex seal
  return buildLoftSegment(rings, radialSegs, 0.014 * mult, false, skinColorObj);
}

/**
 * Generates an organic arm segment (upperarm or forearm).
 * Seamless joint connectivity:
 * Female: Shoulder at (±0.170, 1.240, -0.010), Elbow at (±0.220, 1.040, -0.025), Wrist at (±0.260, 0.895, 0.028).
 * Male: Shoulder at (±0.185, 1.320, -0.010), Elbow at (±0.235, 1.100, -0.025), Wrist at (±0.280, 0.950, 0.030).
 */
export function generateOrganicArm(
  type: 'upperarm' | 'forearm',
  side: 'left' | 'right',
  scale: number = 1.0,
  gender: 'male' | 'female' = (scale < 0.98 ? 'female' : 'male'),
  skinColor?: string | THREE.Color
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const skinColorObj = resolveSkinColor(skinColor, isFemale);
  const sign = side === 'right' ? 1 : -1;
  const ringsCount = 24;
  const radialSegs = 32;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  let start: THREE.Vector3;
  let end: THREE.Vector3;
  let startR: number;
  let endR: number;

  if (isFemale) {
    if (type === 'upperarm') {
      // Plugs directly into slender shoulder socket at (±0.145, 1.335, -0.010)
      start = new THREE.Vector3(sign * 0.145 * mult, 1.335 * mult, -0.010 * mult);
      end = new THREE.Vector3(sign * 0.195 * mult, 1.120 * mult, -0.020 * mult);
      startR = 0.028 * mult;
      endR = 0.022 * mult;
    } else {
      // Plugs from elbow down to delicate female wrist meeting hand anchors seamlessly
      start = new THREE.Vector3(sign * 0.195 * mult, 1.120 * mult, -0.020 * mult);
      const wristX = side === 'right' ? 0.265 : -0.245;
      const wristY = side === 'right' ? 0.902 : 0.895;
      const wristZ = side === 'right' ? 0.027 : 0.028;
      end = new THREE.Vector3(wristX * mult, wristY * mult, wristZ * mult);
      startR = 0.022 * mult;
      endR = 0.017 * mult; // Petite, delicate female wrist
    }
  } else {
    if (type === 'upperarm') {
      start = new THREE.Vector3(sign * 0.185 * mult, 1.410 * mult, -0.010 * mult);
      end = new THREE.Vector3(sign * 0.235 * mult, 1.180 * mult, -0.025 * mult);
      startR = 0.038 * mult;
      endR = 0.028 * mult;
    } else {
      start = new THREE.Vector3(sign * 0.235 * mult, 1.180 * mult, -0.025 * mult);
      const wristX = side === 'right' ? 0.308 : -0.286;
      const wristY = side === 'right' ? 0.958 : 0.950;
      const wristZ = side === 'right' ? 0.032 : 0.034;
      end = new THREE.Vector3(wristX * mult, wristY * mult, wristZ * mult);
      startR = 0.028 * mult;
      endR = 0.022 * mult;
    }
  }

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const curP = new THREE.Vector3().lerpVectors(start, end, t);

    let curR = startR + (endR - startR) * t;
    if (type === 'upperarm' && t > 0.25 && t < 0.75) {
      curR += Math.sin((t - 0.25) * 2 * Math.PI) * 0.003 * mult;
    }
    if (type === 'forearm' && t < 0.45) {
      curR += Math.sin((t / 0.45) * Math.PI) * 0.004 * mult;
    }

    rings.push({
      y: curP.y,
      centerX: curP.x,
      centerZ: curP.z,
      radiusX: curR,
      radiusZ: curR * 0.95,
    });
  }

  // Rounded dome caps for smooth articulation
  const capB = type === 'upperarm' ? 0.012 * mult : 0.010 * mult;
  const capT = type === 'upperarm' ? 0.020 * mult : 0.012 * mult;
  return buildLoftSegment(rings, radialSegs, capB, capT, skinColorObj);
}

/**
 * Generates an organic leg segment (thigh or shin).
 * Seamless joint connectivity:
 * Female: Pelvis hip socket at (±0.100, 0.700, -0.025), Knee at (±0.138, 0.420, -0.040), Shin to foot at (±0.168, 0.075, -0.045).
 * Male: Hip socket at (±0.110, 0.740, -0.025), Knee at (±0.145, 0.450, -0.040), Shin to foot at (±0.178, 0.080, -0.045).
 */
export function generateOrganicLeg(
  type: 'thigh' | 'shin',
  side: 'left' | 'right',
  scale: number = 1.0,
  gender: 'male' | 'female' = (scale < 0.98 ? 'female' : 'male'),
  skinColor?: string | THREE.Color
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const skinColorObj = resolveSkinColor(skinColor, isFemale);
  const sign = side === 'right' ? 1 : -1;
  const ringsCount = 30;
  const radialSegs = 36;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  let start: THREE.Vector3;
  let end: THREE.Vector3;
  let startRx: number;
  let startRz: number;
  let endRx: number;
  let endRz: number;

  if (isFemale) {
    if (type === 'thigh') {
      // Connects directly to pelvis hip sockets at (±0.100, 0.740, -0.025) down to knees at y = 0.440
      start = new THREE.Vector3(sign * 0.100 * mult, 0.740 * mult, -0.025 * mult);
      end = new THREE.Vector3(sign * 0.138 * mult, 0.440 * mult, -0.040 * mult);
      startRx = 0.060 * mult;
      startRz = 0.064 * mult;
      endRx = 0.040 * mult;
      endRz = 0.042 * mult;
    } else {
      // Connects from knees at y = 0.440 down to slender ankles meeting feet at y = 0.075
      start = new THREE.Vector3(sign * 0.138 * mult, 0.440 * mult, -0.040 * mult);
      end = new THREE.Vector3(sign * 0.168 * mult, 0.075 * mult, -0.045 * mult);
      startRx = 0.040 * mult;
      startRz = 0.042 * mult;
      endRx = 0.022 * mult;
      endRz = 0.024 * mult;
    }
  } else {
    if (type === 'thigh') {
      start = new THREE.Vector3(sign * 0.110 * mult, 0.780 * mult, -0.025 * mult);
      end = new THREE.Vector3(sign * 0.145 * mult, 0.470 * mult, -0.040 * mult);
      startRx = 0.064 * mult;
      startRz = 0.068 * mult;
      endRx = 0.044 * mult;
      endRz = 0.046 * mult;
    } else {
      start = new THREE.Vector3(sign * 0.145 * mult, 0.470 * mult, -0.040 * mult);
      end = new THREE.Vector3(sign * 0.178 * mult, 0.080 * mult, -0.045 * mult);
      startRx = 0.044 * mult;
      startRz = 0.046 * mult;
      endRx = 0.024 * mult;
      endRz = 0.026 * mult;
    }
  }

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const curP = new THREE.Vector3().lerpVectors(start, end, t);

    if (type === 'shin') {
      curP.z -= Math.sin(t * Math.PI) * 0.010 * mult;
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

        // Thigh: Quadriceps anterior curve
        if (type === 'thigh' && defZ > 0 && t < 0.75) {
          defZ += Math.sin((t / 0.75) * Math.PI) * 0.006 * mult;
        }

        // Shin: Patellar tendon / kneecap at top
        if (type === 'shin' && defZ > 0 && t < 0.16) {
          defZ += Math.sin((t / 0.16) * Math.PI) * 0.005 * mult;
        }

        // Shin: Gastrocnemius calf fullness in back
        if (type === 'shin' && defZ < 0 && t >= 0.20 && t <= 0.65) {
          const calfT = Math.sin(((t - 0.20) / 0.45) * Math.PI);
          defZ -= calfT * (isFemale ? 0.009 : 0.012) * mult;
        }

        return [defX, defZ];
      },
    });
  }

  const capB = type === 'thigh' ? 0.016 * mult : 0.010 * mult;
  const capT = type === 'thigh' ? 0.022 * mult : 0.016 * mult;
  return buildLoftSegment(rings, radialSegs, capB, capT, skinColorObj);
}

/**
 * Generates an organic human bare foot with calcaneus heel, arch, instep, and 5 toes.
 * Grounded at y = 0.000m. Ankle meets shin at y = 0.075m (female) / 0.080m (male).
 */
export function generateOrganicFoot(
  side: 'left' | 'right',
  scale: number = 1.0,
  gender: 'male' | 'female' = (scale < 0.98 ? 'female' : 'male'),
  skinColor?: string | THREE.Color
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const skinColorObj = resolveSkinColor(skinColor, isFemale);
  const sign = side === 'right' ? 1 : -1;

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  const ankleX = sign * (isFemale ? 0.181 : 0.192) * mult;
  const ankleZ = (isFemale ? -0.044 : -0.047) * mult;
  const ankleY = (isFemale ? 0.075 : 0.080) * mult;
  const centerX = ankleX;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  const zSlices = 24;
  const ringSegs = 28;
  const ringVerts: number[][] = [];

  const minZ = ankleZ - 0.048 * mult;
  const maxZ = ankleZ + 0.150 * mult;

  for (let i = 0; i < zSlices; i++) {
    const t = i / (zSlices - 1);
    const z = minZ + (maxZ - minZ) * t;

    let halfW: number;
    let topY: number;
    const botY = 0.000; // Flat ground plane

    if (t < 0.25) {
      // Calcaneus heel rising to ankle joint
      const ht = t / 0.25;
      halfW = (0.018 + ht * 0.006) * mult;
      topY = (0.045 + ht * (ankleY - 0.045)) * mult;
    } else if (t < 0.65) {
      // Longitudinal arch & instep dome
      const mt = (t - 0.25) / 0.40;
      halfW = (0.024 + mt * 0.007) * mult;
      topY = (ankleY - mt * (ankleY - 0.042 * mult));
    } else {
      // Forefoot ball & 5 toes
      const ft = (t - 0.65) / 0.35;
      halfW = (0.034 * (1.0 - ft * 0.30)) * mult;
      topY = (0.042 * (1.0 - ft * 0.65)) * mult;
    }

    const ringIndices: number[] = [];
    for (let s = 0; s < ringSegs; s++) {
      const angle = (s / ringSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let px = centerX + cosA * halfW;
      let py: number;

      if (sinA >= 0) {
        py = botY + sinA * (topY - botY);
      } else {
        py = botY;
        const isMedial = sign > 0 ? cosA < 0 : cosA > 0;
        if (isMedial && t >= 0.25 && t <= 0.65) {
          py += Math.abs(cosA) * Math.sin(((t - 0.25) / 0.40) * Math.PI) * 0.016 * mult;
        }
      }

      if (t > 0.85) {
        const toeFactor = Math.sin(((px - centerX) / halfW) * Math.PI * 2.5);
        py += Math.max(0, toeFactor) * 0.003 * mult;
      }

      const vIdx = positions.length / 3;
      positions.push(px, Math.max(0.000, py), z);
      uvs.push(s / ringSegs, t);
      colors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
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
  positions.push(centerX, 0.020 * mult, minZ);
  uvs.push(0.5, 0.5);
  colors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
  for (let s = 0; s < ringSegs; s++) {
    const nextS = (s + 1) % ringSegs;
    indices.push(heelCenterIdx, ringVerts[0][nextS], ringVerts[0][s]);
  }

  // Toe tips cap
  const toeCenterIdx = positions.length / 3;
  positions.push(centerX, 0.008 * mult, maxZ);
  uvs.push(0.5, 0.5);
  colors.push(skinColorObj.r, skinColorObj.g, skinColorObj.b);
  for (let s = 0; s < ringSegs; s++) {
    const nextS = (s + 1) % ringSegs;
    indices.push(toeCenterIdx, ringVerts[zSlices - 1][s], ringVerts[zSlices - 1][nextS]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normals = Array.from(geo.getAttribute('normal').array as Float32Array);

  return { positions, normals, uvs, indices, colors };
}

/**
 * Generates an organic neck segment.
 * Vertical span:
 * Female: y = 1.260m (clavicles) to 1.440m (jawline base). Plugs smoothly with zero gap.
 * Male: y = 1.335m to 1.520m.
 */
export function generateOrganicNeck(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0,
  skinColor?: string | THREE.Color
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const skinColorObj = resolveSkinColor(skinColor, isFemale);
  const ringsCount = 18;
  const radialSegs = 36;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  const minY = isFemale ? 1.350 * mult : 1.430 * mult;
  const maxY = isFemale ? 1.450 * mult : 1.530 * mult;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    // Tapering from clavicle base up to throat / jawline base
    let rX: number;
    let rZ: number;

    if (isFemale) {
      // Bottom at y = 1.35m matches torso top (rX = 0.048, rZ = 0.048); top at y = 1.45m matches jawline base (rX = 0.044, rZ = 0.046)
      rX = (0.048 - t * 0.004) * mult;
      rZ = (0.048 - t * 0.002) * mult;
    } else {
      rX = (0.056 - t * 0.006) * mult;
      rZ = (0.056 - t * 0.004) * mult;
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: -0.006 * mult,
      radiusX: rX,
      radiusZ: rZ,
    });
  }

  return buildLoftSegment(rings, radialSegs, false, false, skinColorObj);
}

/**
 * Generates high-poly, form-fitted inner garments (athletic top / sports bra for female; undershirt for male).
 * Sits conformally between organic skin and outer garments (+2.0mm positive clearance over skin).
 */
export function generateInnerGarmentTop(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0,
  color: string = gender === 'female' ? '#2b2d42' : '#f1f5f9'
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const garmentColor = new THREE.Color(color);
  const ringsCount = 30;
  const radialSegs = 48;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  // Clearance offset: +2.5mm over body skin
  const clearance = 0.0025 * mult;

  // Conformal vertical bounds matching torso coordinates
  const torsoMinY = isFemale ? 1.010 * mult : 1.070 * mult;
  const torsoMaxY = isFemale ? 1.350 * mult : 1.430 * mult;

  const minY = isFemale ? 1.130 * mult : 1.040 * mult;
  const maxY = isFemale ? 1.345 * mult : 1.425 * mult;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    // Evaluate exact torso profile at this elevation
    const torsoT = Math.max(0, Math.min(1, (y - torsoMinY) / (torsoMaxY - torsoMinY)));
    let rX: number;
    let rZ: number;

    if (isFemale) {
      if (torsoT <= 0.88) {
        const ut = torsoT / 0.88;
        rX = (0.106 + ut * 0.038) * mult + clearance;
        rZ = (0.066 + ut * 0.012) * mult + clearance;
      } else {
        const nt = (torsoT - 0.88) / 0.12;
        rX = (0.144 - nt * 0.096) * mult + clearance;
        rZ = (0.078 - nt * 0.030) * mult + clearance;
      }
      if (torsoT < 0.30) {
        const wT = Math.cos((torsoT / 0.30) * (Math.PI / 2));
        rX *= 1.0 - wT * 0.05;
        rZ *= 1.0 - wT * 0.05;
      }
    } else {
      if (torsoT <= 0.88) {
        const ut = torsoT / 0.88;
        rX = (0.125 + ut * 0.060) * mult + clearance;
        rZ = (0.078 + ut * 0.028) * mult + clearance;
      } else {
        const nt = (torsoT - 0.88) / 0.12;
        rX = (0.185 - nt * 0.129) * mult + clearance;
        rZ = (0.106 - nt * 0.050) * mult + clearance;
      }
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: -0.008 * mult,
      radiusX: rX,
      radiusZ: rZ,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Female Breasts support with +2.5mm clearance
        if (isFemale && defZ > 0 && y >= 1.140 * mult && y <= 1.300 * mult) {
          const bustT = Math.sin(((y - 1.140 * mult) / (0.160 * mult)) * Math.PI);
          const breastCx = 0.076 * mult;
          const absX = Math.abs(defX);
          const breastDist = Math.abs(absX - breastCx);

          if (breastDist < 0.080 * mult) {
            const wX = Math.cos((breastDist / (0.080 * mult)) * (Math.PI / 2)) ** 2;
            const hang = y < 1.23 * mult ? 1.0 + (1.23 * mult - y) * 1.5 : 1.0;
            defZ += (wX * bustT * 0.038 * mult * hang) + clearance;
            defX += Math.sign(defX) * (wX * bustT * 0.006 * mult + clearance * 0.5);
          }
        }

        // Male Pectorals support
        if (!isFemale && defZ > 0 && y >= 1.22 * mult && y <= 1.38 * mult) {
          const pecT = Math.sin(((y - 1.22 * mult) / (0.16 * mult)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX < 0.145 * mult) {
            const wPec = Math.cos((absX / (0.145 * mult)) * (Math.PI / 2));
            defZ += (wPec * pecT * 0.024 * mult) + clearance;
          }
        }

        return [defX, defZ];
      },
    });
  }

  return buildLoftSegment(rings, radialSegs, false, false, garmentColor);
}

/**
 * Generates high-poly, form-fitted inner garments (athletic briefs / panties for female; boxer briefs for male).
 * Sits conformally between organic skin and outer trousers (+2.5mm positive clearance over skin).
 */
export function generateInnerGarmentBottom(
  gender: 'male' | 'female' = 'female',
  scale: number = 1.0,
  color: string = gender === 'female' ? '#2b2d42' : '#1e293b'
): AnatomicalMeshBuffer {
  const isFemale = gender === 'female';
  const garmentColor = new THREE.Color(color);
  const ringsCount = 28;
  const radialSegs = 48;
  const rings: Parameters<typeof buildLoftSegment>[0] = [];

  const mult = isFemale
    ? (Math.abs(scale - 1.68 / 1.78) < 0.02 ? 1.0 : scale / (1.68 / 1.78))
    : scale;

  const clearance = 0.0025 * mult;

  // Exact vertical span of the underlying pelvis
  const pelvisMinY = isFemale ? 0.730 * mult : 0.770 * mult;
  const pelvisMaxY = isFemale ? 1.020 * mult : 1.080 * mult;

  // Female briefs span y = 0.730m to 0.950m (waistband); Male boxer briefs span y = 0.670m to 1.040m
  const minY = isFemale ? 0.730 * mult : 0.670 * mult;
  const maxY = isFemale ? 0.950 * mult : 1.040 * mult;

  for (let r = 0; r < ringsCount; r++) {
    const t = r / (ringsCount - 1);
    const y = minY + (maxY - minY) * t;

    let rX: number;
    let rZ: number;

    if (isFemale) {
      const pelvisT = Math.max(0, Math.min(1, (y - pelvisMinY) / (pelvisMaxY - pelvisMinY)));
      if (pelvisT < 0.35) {
        const lt = pelvisT / 0.35;
        rX = (0.130 + lt * 0.024) * mult + clearance;
        rZ = (0.076 + lt * 0.016) * mult + clearance;
      } else {
        const ut = (pelvisT - 0.35) / 0.65;
        const hipFactor = Math.sin(ut * Math.PI);
        rX = (0.154 * (1.0 - ut * 0.30) + hipFactor * 0.008) * mult + clearance;
        rZ = (0.092 * (1.0 - ut * 0.31)) * mult + clearance;
      }
    } else {
      if (y < pelvisMinY) {
        // Upper thigh encasement for boxer briefs
        const utT = (y - minY) / (pelvisMinY - minY);
        rX = (0.132 + utT * 0.012) * mult + clearance;
        rZ = (0.092 + utT * 0.010) * mult + clearance;
      } else {
        const pelvisT = (y - pelvisMinY) / (pelvisMaxY - pelvisMinY);
        if (pelvisT < 0.35) {
          const lt = pelvisT / 0.35;
          rX = (0.138 + lt * 0.030) * mult + clearance;
          rZ = (0.098 + lt * 0.024) * mult + clearance;
        } else {
          const ut = (pelvisT - 0.35) / 0.65;
          rX = (0.168 * (1.0 - ut * 0.25)) * mult + clearance;
          rZ = (0.122 * (1.0 - ut * 0.35)) * mult + clearance;
        }
      }
    }

    rings.push({
      y,
      centerX: 0,
      centerZ: (isFemale ? -0.008 : -0.012) * mult,
      radiusX: rX,
      radiusZ: rZ,
      deform: (_angle, rx, rz) => {
        let defZ = rz;
        let defX = rx;

        // Gluteal encasement with +2.5mm clearance
        const gMinY = isFemale ? 0.710 * mult : 0.750 * mult;
        const gMaxY = isFemale ? 0.880 * mult : 0.920 * mult;
        if (defZ < 0 && y >= gMinY && y <= gMaxY) {
          const gT = Math.sin(((y - gMinY) / (gMaxY - gMinY)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX >= 0.015 * mult && absX <= 0.160 * mult) {
            const wX = Math.sin(((absX - 0.015 * mult) / (0.145 * mult)) * Math.PI);
            const buttockProj = isFemale ? 0.018 : 0.026;
            defZ -= (wX * gT * buttockProj * mult) + clearance;
          }
          if (absX < 0.022 * mult) {
            const cT = Math.cos((absX / (0.022 * mult)) * (Math.PI / 2));
            defZ += cT * 0.010 * mult;
          }
        }

        // Lower abdominal curvature with +2.5mm clearance
        const abMinY = isFemale ? 0.740 * mult : 0.780 * mult;
        const abMaxY = isFemale ? 0.890 * mult : 0.930 * mult;
        if (defZ > 0 && y >= abMinY && y <= abMaxY) {
          const abT = Math.sin(((y - abMinY) / (abMaxY - abMinY)) * Math.PI);
          const absX = Math.abs(defX);
          if (absX < 0.12 * mult) {
            const wAb = Math.cos((absX / (0.12 * mult)) * (Math.PI / 2));
            defZ += (wAb * abT * (isFemale ? 0.014 : 0.009) * mult) + clearance;
          }
        }

        return [defX, defZ];
      },
    });
  }

  return buildLoftSegment(rings, radialSegs, false, false, garmentColor);
}

/**
 * Combines multiple AnatomicalMeshBuffers into a single unified buffer.
 * Preserves skin colors uniformly matching the character skin tone.
 */
export function mergeMeshBuffers(
  buffers: AnatomicalMeshBuffer[],
  defaultSkinColor?: THREE.Color | string
): AnatomicalMeshBuffer {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  const fallbackColor = defaultSkinColor
    ? defaultSkinColor instanceof THREE.Color
      ? defaultSkinColor
      : new THREE.Color(defaultSkinColor)
    : new THREE.Color('#e0ac82');

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
        for (let i = 0; i < b.positions.length / 3; i++) {
          colors.push(fallbackColor.r, fallbackColor.g, fallbackColor.b);
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
