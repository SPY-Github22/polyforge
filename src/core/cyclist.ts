import * as THREE from 'three';
import { AnimationTrack, Keyframe, SceneItem } from '../types';
import {
  ClosedCircuitOptions,
  KinematicTrajectoryPoint,
  generateClosedCircuitTrajectory,
} from './animation';
import {
  BicycleOptions,
  ModularBicycleResult,
  generateModularBicycle,
} from './bicycle';
import {
  RealisticFemaleOptions,
  RealisticHumanOptions,
  RealisticHumanResult,
  generateRealisticFemaleScene,
  generateRealisticHumanScene,
} from './character';

export interface CyclistOptions extends BicycleOptions, ClosedCircuitOptions {
  gender?: 'female' | 'male';
  characterOptions?: RealisticFemaleOptions | RealisticHumanOptions;
  articulated?: boolean; // default true for dynamic kinematic leg pedaling
}

export interface CyclistCircuitResult {
  modularBicycle: ModularBicycleResult;
  cyclistCharacter: RealisticHumanResult;
  bicycleItems: SceneItem[];
  cyclistItems: SceneItem[];
  allItems: SceneItem[];
  tracks: AnimationTrack[];
  trajectory: KinematicTrajectoryPoint[];
  totalFrames: number;
  fps: number;
  stats: {
    bicycleVertices: number;
    bicycleTriangles: number;
    cyclistVertices: number;
    cyclistTriangles: number;
    totalVertices: number;
    totalTriangles: number;
    totalItems: number;
  };
}

/**
 * Poses a realistic character model into an authentic athletic cycling posture:
 * - Ischial tuberosities (pelvis) grounded directly on the saddle sweet-spot at (-0.150, 0.890, 0.0)
 * - Torso inclined forward (~36°) towards the cockpit
 * - Cervical spine extended so the face and gaze point forward along the road
 * - Arms extended forward with natural elbow flexion to grasp the handlebar grips at (0.420, 0.900, ±0.180)
 * - Legs articulated with biomechanical cycling fit: right leg slightly bent on forward pedal, left leg flexed at top of stroke
 */
export function poseCharacterAsCyclist(
  character: RealisticHumanResult,
  gender: 'female' | 'male' = 'female',
  articulated = false
): RealisticHumanResult {
  const isFemale = gender === 'female';
  const saddlePos = new THREE.Vector3(-0.150, 0.890, 0.0);
  // Grip coordinates locked directly onto road bike STI brake hoods at (0.570, 0.945, ±0.200)
  const leftGrip = new THREE.Vector3(0.570, 0.945, -0.200);
  const rightGrip = new THREE.Vector3(0.570, 0.945, 0.200);

  // Pedal coordinates at neutral crank angle (-0.45 rad)
  const leftPedal = new THREE.Vector3(-0.155, 0.355, -0.075);
  const rightPedal = new THREE.Vector3(0.155, 0.205, 0.075);

  // Anatomical reference landmarks
  const standingCrotchY = isFemale ? 0.78 : 0.82;
  const standingPelvisY = isFemale ? 0.86 : 0.92;
  const standingShoulderY = isFemale ? 1.30 : 1.38;
  const torsoHeight = standingShoulderY - standingPelvisY;

  // Lean angle of thoracic spine
  const torsoLeanRad = 0.63; // ~36° forward lean
  const cosLean = Math.cos(torsoLeanRad);
  const sinLean = Math.sin(torsoLeanRad);

  // Posed shoulder positions
  const shoulderX = saddlePos.x + torsoHeight * sinLean;
  const shoulderY = saddlePos.y + torsoHeight * cosLean;
  const shoulderZOffset = isFemale ? 0.19 : 0.21;
  const leftShoulder = new THREE.Vector3(shoulderX, shoulderY, -shoulderZOffset);
  const rightShoulder = new THREE.Vector3(shoulderX, shoulderY, shoulderZOffset);

  // Elbow natural flexion positions
  const leftElbow = new THREE.Vector3(
    (leftShoulder.x + leftGrip.x) * 0.5 - 0.01,
    (leftShoulder.y + leftGrip.y) * 0.5 - 0.03,
    -shoulderZOffset - 0.02
  );
  const rightElbow = new THREE.Vector3(
    (rightShoulder.x + rightGrip.x) * 0.5 - 0.01,
    (rightShoulder.y + rightGrip.y) * 0.5 - 0.03,
    shoulderZOffset + 0.02
  );

  // Posed hip and knee positions
  const leftHip = new THREE.Vector3(saddlePos.x, saddlePos.y - 0.01, -0.09);
  const rightHip = new THREE.Vector3(saddlePos.x, saddlePos.y - 0.01, 0.09);

  // Left leg contracted (crank near top), right leg extended (crank near bottom)
  const leftKnee = new THREE.Vector3(-0.060, 0.640, -0.095);
  const rightKnee = new THREE.Vector3(0.045, 0.570, 0.095);

  const armStartY = standingShoulderY + 0.04;
  const wristLevelY = isFemale ? 0.84 : 0.88;
  const handEndY = isFemale ? 0.68 : 0.72;

  function getArmPos(x0: number, y0: number, z0: number): [number, number, number] {
    const absX = Math.abs(x0);
    const side = x0 < 0 ? -1 : 1;
    const shoulder = side < 0 ? leftShoulder : rightShoulder;
    const elbow = side < 0 ? leftElbow : rightElbow;
    const grip = side < 0 ? leftGrip : rightGrip;

    const elbowLevelY = isFemale ? 1.05 : 1.10;

    if (y0 >= elbowLevelY) {
      // Upper arm: shoulder -> elbow
      const t = Math.max(0, Math.min(1, (armStartY - y0) / (armStartY - elbowLevelY)));
      const cx = shoulder.x + (elbow.x - shoulder.x) * t;
      const cy = shoulder.y + (elbow.y - shoulder.y) * t;
      const cz = shoulder.z + (elbow.z - shoulder.z) * t;

      const outX = cx + z0 * 0.9;
      const outY = cy - z0 * 0.15;
      const outZ = cz + (absX - (isFemale ? 0.24 : 0.26)) * side * 0.9;
      return [outX, outY, outZ];
    } else if (y0 >= wristLevelY) {
      // Forearm: elbow -> wrist
      const t = Math.max(0, Math.min(1, (elbowLevelY - y0) / (elbowLevelY - wristLevelY)));
      const wristTargetX = grip.x - 0.04;
      const wristTargetY = grip.y + 0.03;
      const wristTargetZ = grip.z;

      const cx = elbow.x + (wristTargetX - elbow.x) * t;
      const cy = elbow.y + (wristTargetY - elbow.y) * t;
      const cz = elbow.z + (wristTargetZ - elbow.z) * t;

      const outX = cx + z0 * 0.85;
      const outY = cy;
      const outZ = cz + (absX - (isFemale ? 0.24 : 0.26)) * side * 0.85;
      return [outX, outY, outZ];
    } else {
      // Hand & Fingers: grasping the handlebar grips
      const handOffset = Math.max(0, Math.min(1, (wristLevelY - y0) / (wristLevelY - handEndY)));
      const gripCurlX = grip.x + (handOffset - 0.5) * 0.05 + z0 * 0.6;
      const gripCurlY = grip.y - handOffset * 0.02;
      const gripCurlZ = grip.z + (absX - (isFemale ? 0.24 : 0.26)) * side * 0.7;
      return [gripCurlX, gripCurlY, gripCurlZ];
    }
  }

  function getNeckHeadPos(x0: number, y0: number, z0: number): [number, number, number] {
    const neckBaseX = saddlePos.x + torsoHeight * sinLean;
    const neckBaseY = saddlePos.y + torsoHeight * cosLean;
    const h = y0 - standingShoulderY;
    const neckLen = 0.085;
    const headPitch = 0.08; // Level forward gaze along the racetrack

    let spinePtX = neckBaseX;
    let spinePtY = neckBaseY;
    let localAngle = torsoLeanRad;

    if (h <= neckLen) {
      // Cervical neck: smooth Hermite blend from torso lean (~36°) to head gaze (~5°)
      const v = Math.max(0, Math.min(1, h / neckLen));
      const t = v * v * (3 - 2 * v);
      localAngle = (1 - t) * torsoLeanRad + t * headPitch;
      const avgAngle = (torsoLeanRad + localAngle) * 0.5;
      spinePtX = neckBaseX + h * Math.sin(avgAngle);
      spinePtY = neckBaseY + h * Math.cos(avgAngle);
    } else {
      // Head & Cranium: continuous extension along gaze line from skull base
      const avgNeckAngle = (torsoLeanRad + headPitch) * 0.5;
      const skullBaseX = neckBaseX + neckLen * Math.sin(avgNeckAngle);
      const skullBaseY = neckBaseY + neckLen * Math.cos(avgNeckAngle);
      const headDist = h - neckLen;
      localAngle = headPitch;
      spinePtX = skullBaseX + headDist * Math.sin(headPitch);
      spinePtY = skullBaseY + headDist * Math.cos(headPitch);
    }

    const headX = spinePtX + z0 * Math.cos(localAngle);
    const headY = spinePtY - z0 * Math.sin(localAngle);
    const headZ = saddlePos.z + x0;

    return [headX, headY, headZ];
  }

  function getTorsoPos(x0: number, y0: number, z0: number): [number, number, number] {
    if (y0 > standingShoulderY) {
      return getNeckHeadPos(x0, y0, z0);
    }
    const u = Math.max(0, Math.min(1, (y0 - standingPelvisY) / torsoHeight));
    const currentLean = 0.28 + u * (torsoLeanRad - 0.28);
    const spineDist = (y0 - standingPelvisY);

    const spineX = saddlePos.x + spineDist * Math.sin(currentLean);
    const spineY = saddlePos.y + spineDist * Math.cos(currentLean);

    const outX = spineX + z0 * Math.cos(currentLean);
    const outY = spineY - z0 * Math.sin(currentLean);
    const outZ = saddlePos.z + x0;
    return [outX, outY, outZ];
  }

  /**
   * Transforms a single 3D vertex from standing posture into cycling posture.
   * Input: (x0, y0, z0) in character space (facing +Z, lateral ±X, vertical +Y).
   * Output: (xb, yb, zb) in bicycle frame space (facing +X, lateral ±Z, vertical +Y).
   */
  function deformVertex(
    x0: number,
    y0: number,
    z0: number,
    itemId: string,
    isArm = false
  ): [number, number, number] {
    const absX = Math.abs(x0);
    const side = x0 < 0 ? -1 : 1; // -1 = Left, +1 = Right

    const isLowerGarment = itemId.includes('jeans') || itemId.includes('pants');
    const isFootwear = itemId.includes('shoes') || itemId.includes('sneakers');
    const isUpperGarment = itemId.includes('shirt') || itemId.includes('top');
    const isAccessory = itemId.includes('accessories');
    const isBody = itemId.includes('body');

    // 0. Footwear: strictly placed on pedal platforms
    if (isFootwear) {
      const pedal = side < 0 ? leftPedal : rightPedal;
      const ankleLevelY = isFemale ? 0.10 : 0.12;
      const t = Math.max(0, Math.min(1, (ankleLevelY - y0) / (ankleLevelY - 0.0)));
      const footAngle = side < 0 ? -0.15 : 0.12;
      const footCenterX = pedal.x + (z0 - 0.03) * Math.cos(footAngle) - t * 0.01;
      const footCenterY = pedal.y + 0.02 + (z0 - 0.03) * Math.sin(footAngle) + (ankleLevelY - y0) * 0.4;
      const footCenterZ = pedal.z + (absX - (isFemale ? 0.07 : 0.09)) * side * 0.85;
      return [footCenterX, footCenterY, footCenterZ];
    }

    // 1. Upper Garment & Body Skin: topological arm segmentation
    if (isUpperGarment || isBody) {
      if (isArm) {
        return getArmPos(x0, y0, z0);
      }
      if (y0 > standingShoulderY) {
        return getNeckHeadPos(x0, y0, z0);
      }
      if (y0 >= standingPelvisY) {
        return getTorsoPos(x0, y0, z0);
      }
      // Lower torso / pelvic seat
      const dy = y0 - standingPelvisY;
      const pelvicTilt = 0.26;
      const cx = saddlePos.x + z0 * Math.cos(pelvicTilt) + dy * Math.sin(pelvicTilt);
      const cy = saddlePos.y + dy * Math.cos(pelvicTilt) - z0 * Math.sin(pelvicTilt);
      const cz = saddlePos.z + x0;
      return [cx, cy, cz];
    } else if (isAccessory) {
      return getArmPos(x0, y0, z0);
    }

    // 3. Pelvic Seat & Hip Girdle (resting directly on saddle sweet-spot)
    if (isLowerGarment ? y0 >= standingCrotchY : (y0 >= standingCrotchY && y0 <= standingPelvisY + 0.08)) {
      const dy = y0 - standingPelvisY;
      const pelvicTilt = 0.26; // ~15° anterior pelvic tilt

      const cx = saddlePos.x + z0 * Math.cos(pelvicTilt) + dy * Math.sin(pelvicTilt);
      const cy = saddlePos.y + dy * Math.cos(pelvicTilt) - z0 * Math.sin(pelvicTilt);
      const cz = saddlePos.z + x0;
      return [cx, cy, cz];
    }

    // 4. Lower Body: Legs and Feet (y0 < standingCrotchY)
    if (y0 < standingCrotchY) {
      const hip = side < 0 ? leftHip : rightHip;
      const knee = side < 0 ? leftKnee : rightKnee;
      const pedal = side < 0 ? leftPedal : rightPedal;

      const kneeLevelY = isFemale ? 0.46 : 0.50;
      const ankleLevelY = isFemale ? 0.10 : 0.12;

      if (y0 >= kneeLevelY) {
        // Thigh segment: hip -> knee
        const t = (standingCrotchY - y0) / (standingCrotchY - kneeLevelY);
        const clampedT = Math.max(0, Math.min(1, t));

        const cx = hip.x + (knee.x - hip.x) * clampedT;
        const cy = hip.y + (knee.y - hip.y) * clampedT;
        const cz = hip.z + (knee.z - hip.z) * clampedT;

        const radThick = 0.92;
        const outX = cx + z0 * radThick;
        const outY = cy - z0 * 0.2;
        const outZ = cz + (absX - (isFemale ? 0.10 : 0.12)) * side * radThick;
        return [outX, outY, outZ];
      } else if (y0 >= ankleLevelY) {
        // Shin/Calf segment: knee -> ankle
        const t = (kneeLevelY - y0) / (kneeLevelY - ankleLevelY);
        const clampedT = Math.max(0, Math.min(1, t));

        const ankleTargetX = pedal.x - 0.04;
        const ankleTargetY = pedal.y + 0.08;
        const ankleTargetZ = pedal.z;

        const cx = knee.x + (ankleTargetX - knee.x) * clampedT;
        const cy = knee.y + (ankleTargetY - knee.y) * clampedT;
        const cz = knee.z + (ankleTargetZ - knee.z) * clampedT;

        const radThick = 0.88;
        const outX = cx + z0 * radThick;
        const outY = cy;
        const outZ = cz + (absX - (isFemale ? 0.09 : 0.11)) * side * radThick;
        return [outX, outY, outZ];
      } else {
        // Foot / Sneaker: firmly planted on pedal platform with realistic ankle pitch
        const t = (ankleLevelY - y0) / ankleLevelY;
        const clampedT = Math.max(0, Math.min(1, t));

        const footAngle = side < 0 ? -0.15 : 0.12;
        const footCenterX = pedal.x + (z0 - 0.03) * Math.cos(footAngle) - clampedT * 0.01;
        const footCenterY = pedal.y + 0.02 + (z0 - 0.03) * Math.sin(footAngle) + (ankleLevelY - y0) * 0.4;
        const footCenterZ = pedal.z + (absX - (isFemale ? 0.07 : 0.09)) * side * 0.85;

        return [footCenterX, footCenterY, footCenterZ];
      }
    }

    // 5. Torso & Spine: inclined forward ~36°
    if (y0 <= standingShoulderY) {
      return getTorsoPos(x0, y0, z0);
    }

    // 6. Neck and Head: continuous cervical spine curvature extending smoothly from shoulders to cranium (zero tearing)
    return getNeckHeadPos(x0, y0, z0);
  }

  // Deform all SceneItems in the character result
  const posedItems: SceneItem[] = character.allItems.map((item) => {
    if (!item.geometryParams?.customGeometry) return item;

    const custom = item.geometryParams.customGeometry;
    const origPositions = custom.positions;
    const numVerts = origPositions.length / 3;
    const newPositions = new Float32Array(origPositions.length);

    const isUpperGarment = item.id.includes('shirt') || item.id.includes('top');
    const isLowerGarment = item.id.includes('jeans') || item.id.includes('pants');
    const isBody = item.id.includes('body');

    // Topological arm segmentation: cleanly identify all vertices belonging to the arm kinematic chain
    const armVerts = new Set<number>();
    if ((isBody || isUpperGarment) && custom.indices && custom.indices.length > 0) {
      const adj = new Map<number, Set<number>>();
      for (let t = 0; t < custom.indices.length; t += 3) {
        const a = custom.indices[t];
        const b = custom.indices[t + 1];
        const c = custom.indices[t + 2];
        for (const [v1, v2] of [[a, b], [b, c], [c, a]]) {
          let s1 = adj.get(v1);
          if (!s1) { s1 = new Set(); adj.set(v1, s1); }
          s1.add(v2);
          let s2 = adj.get(v2);
          if (!s2) { s2 = new Set(); adj.set(v2, s2); }
          s2.add(v1);
        }
      }

      // Seed vertices from the hands / sleeve cuffs
      const seedMinX = isBody ? 0.235 : 0.18;
      for (let i = 0; i < numVerts; i++) {
        const x = origPositions[i * 3];
        const y = origPositions[i * 3 + 1];
        if (y < 0.92 && Math.abs(x) > seedMinX) {
          armVerts.add(i);
        }
      }

      // Grow topological arm BFS across sleeve cylinder up to the shoulder seam
      const queue = Array.from(armVerts);
      while (queue.length > 0) {
        const u = queue.shift()!;
        const ux = origPositions[u * 3];
        const isRight = ux > 0;
        for (const v of adj.get(u) || []) {
          if (!armVerts.has(v)) {
            const vx = origPositions[v * 3];
            const vy = origPositions[v * 3 + 1];
            const sideCheck = isRight ? vx > 0 : vx < 0;
            const ribCheck = Math.abs(vx) >= 0.155 && vy <= 1.34;
            if (sideCheck && ribCheck) {
              armVerts.add(v);
              queue.push(v);
            }
          }
        }
      }
    }

    for (let i = 0; i < numVerts; i++) {
      const x0 = origPositions[i * 3];
      const y0 = origPositions[i * 3 + 1];
      const z0 = origPositions[i * 3 + 2];

      const isArm = armVerts.has(i);
      const [xb, yb, zb] = deformVertex(x0, y0, z0, item.id, isArm);
      newPositions[i * 3] = xb;
      newPositions[i * 3 + 1] = yb;
      newPositions[i * 3 + 2] = zb;
    }

    let finalIndices = custom.indices;
    if (custom.indices && custom.indices.length > 0) {
      const keptIndices: number[] = [];
      const legCullY = isFemale ? 0.68 : 0.70;
      const maxAllowedEdge = 0.12; // 12cm max triangle edge length to prevent degenerate stretched webbing across joints

      for (let t = 0; t < custom.indices.length; t += 3) {
        const i0 = custom.indices[t];
        const i1 = custom.indices[t + 1];
        const i2 = custom.indices[t + 2];

        // 1. Articulated leg culling: remove lower leg / shin triangles replaced by articulated limbs
        if (articulated && (isBody || isLowerGarment)) {
          const y0_0 = origPositions[i0 * 3 + 1];
          const y0_1 = origPositions[i1 * 3 + 1];
          const y0_2 = origPositions[i2 * 3 + 1];
          if (y0_0 < legCullY || y0_1 < legCullY || y0_2 < legCullY) {
            continue;
          }
        }

        // 2. Anti-stretching filter for upper garment and body: cull any degenerate stretched triangles
        if (isBody || isUpperGarment) {
          const x0 = newPositions[i0 * 3], y0 = newPositions[i0 * 3 + 1], z0 = newPositions[i0 * 3 + 2];
          const x1 = newPositions[i1 * 3], y1 = newPositions[i1 * 3 + 1], z1 = newPositions[i1 * 3 + 2];
          const x2 = newPositions[i2 * 3], y2 = newPositions[i2 * 3 + 1], z2 = newPositions[i2 * 3 + 2];

          const d01 = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
          const d12 = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
          const d20 = Math.hypot(x0 - x2, y0 - y2, z0 - z2);
          if (Math.max(d01, d12, d20) > maxAllowedEdge) {
            continue;
          }
        }

        keptIndices.push(i0, i1, i2);
      }
      finalIndices = keptIndices;
    }

    // Construct Three.js BufferGeometry to recalculate smooth surface normals
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    if (finalIndices && finalIndices.length > 0) {
      geo.setIndex(finalIndices);
    }
    geo.computeVertexNormals();

    const newNormals = Array.from(geo.getAttribute('normal').array as Float32Array);

    return {
      ...item,
      geometryParams: {
        ...item.geometryParams,
        customGeometry: {
          ...custom,
          positions: Array.from(newPositions),
          normals: newNormals,
          indices: finalIndices,
        },
      },
    };
  });

  const bodyItem = posedItems.find((it) => it.id === 'female-body' || it.id === 'male-body') || posedItems[0];
  const clothingUpperItem = posedItems.find((it) => it.id.includes('top') || it.id.includes('shirt'));
  const clothingLowerItem = posedItems.find((it) => it.id.includes('jeans') || it.id.includes('pants'));
  const footwearItem = posedItems.find((it) => it.id.includes('sneakers') || it.id.includes('shoes'));
  const accessoriesItem = posedItems.find((it) => it.id.includes('accessories'));

  return {
    ...character,
    bodyItem,
    clothingUpperItem,
    clothingLowerItem,
    footwearItem,
    accessoriesItem,
    allItems: posedItems,
  };
}

function buildLimbItem(
  id: string,
  name: string,
  length: number,
  radiusTop: number,
  radiusBottom: number,
  color = '#1e293b'
): SceneItem {
  const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 16, 4, false);
  geom.translate(0, -length / 2, 0);
  const pos = Array.from(geom.getAttribute('position').array as Float32Array);
  const norm = Array.from(geom.getAttribute('normal').array as Float32Array);
  const idx = Array.from(geom.index!.array as Uint16Array);
  const uvs = new Array((pos.length / 3) * 2).fill(0);

  return {
    id,
    name,
    type: 'mesh',
    primitiveType: 'custom',
    geometryParams: {
      customGeometry: {
        positions: pos,
        normals: norm,
        uvs,
        indices: idx,
      },
    },
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    material: {
      color,
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
    },
    visible: true,
    locked: false,
  };
}

function buildShoeItem(
  id: string,
  name: string,
  color = '#f8fafc'
): SceneItem {
  const geom = new THREE.BoxGeometry(0.24, 0.07, 0.08, 6, 3, 3);
  geom.translate(0.03, 0.035, 0);
  const posAttr = geom.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    let px = posAttr.getX(i);
    let py = posAttr.getY(i);
    let pz = posAttr.getZ(i);

    // Contoured road cycling shoe silhouette
    // Toe taper: narrow aerodynamic toe box for px > 0.04
    if (px > 0.04) {
      const taper = 1.0 - ((px - 0.04) / 0.12) * 0.35;
      pz *= Math.max(0.65, taper);
      // Slight toe spring curve upward
      py += Math.pow((px - 0.04) / 0.11, 2) * 0.012;
    }
    // Heel cup taper: px < -0.04
    if (px < -0.04) {
      const heelTaper = 1.0 - ((-0.04 - px) / 0.06) * 0.25;
      pz *= Math.max(0.75, heelTaper);
    }
    // Ankle cuff collar contour: dip collar under malleolus
    if (py > 0.05 && px > -0.03 && px < 0.05) {
      py -= 0.010;
    }
    posAttr.setXYZ(i, px, py, pz);
  }
  geom.computeVertexNormals();

  const pos = Array.from(geom.getAttribute('position').array as Float32Array);
  const norm = Array.from(geom.getAttribute('normal').array as Float32Array);
  const idx = Array.from(geom.index!.array as Uint16Array);
  const uvs = new Array((pos.length / 3) * 2).fill(0);

  return {
    id,
    name,
    type: 'mesh',
    primitiveType: 'custom',
    geometryParams: {
      customGeometry: {
        positions: pos,
        normals: norm,
        uvs,
        indices: idx,
      },
    },
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    material: {
      color,
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
    },
    visible: true,
    locked: false,
  };
}

function solveLegIK(
  hip: THREE.Vector3,
  pedal: THREE.Vector3,
  crankAngle: number,
  L1 = 0.420,
  L2 = 0.400
) {
  const ankle = new THREE.Vector3(pedal.x - 0.040, pedal.y + 0.070, hip.z);
  const D = new THREE.Vector3().subVectors(ankle, hip);
  const d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.005, D.length()));

  const cosAlpha = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const alpha = Math.acos(cosAlpha);

  const u = D.clone().normalize();
  let n = new THREE.Vector3(-u.y, u.x, 0).normalize();
  if (n.x < 0) n.negate();

  const K = hip.clone().addScaledVector(u, L1 * Math.cos(alpha)).addScaledVector(n, L1 * Math.sin(alpha));

  const dirThigh = new THREE.Vector3().subVectors(K, hip).normalize();
  const Q_thigh = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirThigh);

  const dirShin = new THREE.Vector3().subVectors(ankle, K).normalize();
  const Q_shin = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirShin);

  const anklePitch = 0.12 * Math.cos(crankAngle);
  const Q_shoe = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), anklePitch);

  return { K, Q_thigh, Q_shin, Q_shoe };
}

/**
 * Generates an end-to-end simulation of an ultra-realistic character actively riding
 * the high-performance road bicycle along the 360-frame closed-circuit racetrack loop.
 *
 * Features dynamic kinematic 2-bone analytical IK pedaling, cadence sway, wheel spin,
 * inward centripetal lean, and raked cockpit steering.
 */
export function generateAnimatedCyclistCircuit(
  options: CyclistOptions = {}
): CyclistCircuitResult {
  const gender = options.gender ?? 'female';
  const isArticulated = options.articulated !== false;

  // 1. Generate Modular Bicycle (7 sub-assemblies)
  const modularBicycle = generateModularBicycle(options);

  // 2. Generate Base Realistic Character
  const baseCharacter =
    gender === 'female'
      ? generateRealisticFemaleScene(options.characterOptions as RealisticFemaleOptions)
      : generateRealisticHumanScene(options.characterOptions as RealisticHumanOptions);

  // 3. Pose Character into Ergonomic Cycling Posture
  const posedCharacter = poseCharacterAsCyclist(baseCharacter, gender, isArticulated);

  const pantsColor = (options.characterOptions as any)?.pantsColor || '#1e293b';
  const shoesColor = (options.characterOptions as any)?.shoesColor || '#f8fafc';

  // 4. Generate Articulated Pedaling Limbs or Monolithic Items
  let cyclistItems: SceneItem[] = [];
  let rThighItem: SceneItem | undefined;
  let rShinItem: SceneItem | undefined;
  let rShoeItem: SceneItem | undefined;
  let lThighItem: SceneItem | undefined;
  let lShinItem: SceneItem | undefined;
  let lShoeItem: SceneItem | undefined;

  if (isArticulated) {
    rThighItem = buildLimbItem('cyclist-right-thigh', 'Right Thigh (Articulated)', 0.420, 0.075, 0.058, pantsColor);
    rShinItem = buildLimbItem('cyclist-right-shin', 'Right Shin (Articulated)', 0.400, 0.058, 0.042, pantsColor);
    rShoeItem = buildShoeItem('cyclist-right-shoe', 'Right Sneaker (Pedal Planted)', shoesColor);

    lThighItem = buildLimbItem('cyclist-left-thigh', 'Left Thigh (Articulated)', 0.420, 0.075, 0.058, pantsColor);
    lShinItem = buildLimbItem('cyclist-left-shin', 'Left Shin (Articulated)', 0.400, 0.058, 0.042, pantsColor);
    lShoeItem = buildShoeItem('cyclist-left-shoe', 'Left Sneaker (Pedal Planted)', shoesColor);

    // Torso items (filter out static footwear since shoes are dynamically pedal-planted)
    const torsoItems = posedCharacter.allItems.filter((it) => !it.id.includes('shoes') && !it.id.includes('sneakers'));
    cyclistItems = [...torsoItems, rThighItem, rShinItem, rShoeItem, lThighItem, lShinItem, lShoeItem];
  } else {
    cyclistItems = posedCharacter.allItems;
  }

  // 5. Generate Closed-Circuit Kinematic Trajectory (360 frames @ 30 fps)
  const trajectory = generateClosedCircuitTrajectory(options);
  const totalFrames = trajectory.length - 1;
  const fps = options.fps ?? 30;

  const wheelRadius = Math.max(0.20, options.wheelSize ?? 0.340);
  const rearAxle = new THREE.Vector3(-0.430, wheelRadius, 0.0);
  const frontAxle = new THREE.Vector3(0.570, wheelRadius, 0.0);
  const bbCenter = new THREE.Vector3(0.000, wheelRadius - 0.060, 0.0);
  const headTubeBottom = new THREE.Vector3(0.460, wheelRadius + 0.350, 0.0);
  const headTubeTop = new THREE.Vector3(0.415, wheelRadius + 0.545, 0.0);
  const crankLen = 0.1725;
  const crankAngle = -0.45;

  const steerAxis = new THREE.Vector3().subVectors(headTubeTop, headTubeBottom).normalize();
  const frontAxleRelSteer = new THREE.Vector3().subVectors(frontAxle, headTubeBottom);

  // Keyframe buffers for 8 bicycle items
  const frameKeyframes: Keyframe[] = [];
  const saddleKeyframes: Keyframe[] = [];
  const cockpitKeyframes: Keyframe[] = [];
  const frontWheelKeyframes: Keyframe[] = [];
  const rearWheelKeyframes: Keyframe[] = [];
  const cranksetKeyframes: Keyframe[] = [];
  const leftPedalKeyframes: Keyframe[] = [];
  const rightPedalKeyframes: Keyframe[] = [];

  // Keyframe buffers for cyclist items
  const cyclistKeyframeMap = new Map<string, Keyframe[]>();
  for (const item of cyclistItems) {
    cyclistKeyframeMap.set(item.id, []);
  }

  const Hr = new THREE.Vector3(-0.150, 0.880, 0.085);
  const Hl = new THREE.Vector3(-0.150, 0.880, -0.085);

  for (const pt of trajectory) {
    const f = pt.frame;

    // Bicycle Frame World Transform
    const P_frame = new THREE.Vector3(pt.position[0], pt.position[1], pt.position[2]);
    const rollAngle = pt.leanAngle + pt.swayRoll;
    const yawAngle = pt.heading;
    const pitchAngle = pt.jitterPitch;

    const Q_frame = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rollAngle, yawAngle, pitchAngle, 'YXZ')
    );

    frameKeyframes.push({
      frame: f,
      transform: {
        position: [P_frame.x, P_frame.y, P_frame.z],
        rotation: [rollAngle, yawAngle, pitchAngle],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    saddleKeyframes.push({
      frame: f,
      transform: {
        position: [P_frame.x, P_frame.y, P_frame.z],
        rotation: [rollAngle, yawAngle, pitchAngle],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 1. Cockpit: Fork & Handlebars steer into turn
    const steerRotAngle = -pt.steeringAngle;
    const Q_steer = new THREE.Quaternion().setFromAxisAngle(steerAxis, steerRotAngle);
    const Q_cockpit = Q_frame.clone().multiply(Q_steer);
    const eCockpit = new THREE.Euler().setFromQuaternion(Q_cockpit, 'YXZ');

    const P_cockpit = new THREE.Vector3()
      .copy(headTubeBottom)
      .applyQuaternion(Q_frame)
      .add(P_frame);

    cockpitKeyframes.push({
      frame: f,
      transform: {
        position: [P_cockpit.x, P_cockpit.y, P_cockpit.z],
        rotation: [eCockpit.x, eCockpit.y, eCockpit.z],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 2. Front Wheel: Steers and rolls
    const P_frontWheel = frontAxleRelSteer
      .clone()
      .applyQuaternion(Q_cockpit)
      .add(P_cockpit);

    frontWheelKeyframes.push({
      frame: f,
      transform: {
        position: [P_frontWheel.x, P_frontWheel.y, P_frontWheel.z],
        rotation: [eCockpit.x, eCockpit.y, pt.wheelRotation + eCockpit.z],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 3. Rear Wheel: Spins along axle
    const P_rearWheel = rearAxle.clone().applyQuaternion(Q_frame).add(P_frame);

    rearWheelKeyframes.push({
      frame: f,
      transform: {
        position: [P_rearWheel.x, P_rearWheel.y, P_rearWheel.z],
        rotation: [rollAngle, yawAngle, pt.wheelRotation + pitchAngle],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 4. Crankset: Rotates around bottom bracket spindle
    const P_crankset = bbCenter.clone().applyQuaternion(Q_frame).add(P_frame);

    cranksetKeyframes.push({
      frame: f,
      transform: {
        position: [P_crankset.x, P_crankset.y, P_crankset.z],
        rotation: [rollAngle, yawAngle, pt.crankRotation + pitchAngle],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 5. Right Pedal: Orbits crank arm tip, stays level
    const curRightCrankAngle = crankAngle + pt.crankRotation;
    const r_rightPedal_frame = new THREE.Vector3(
      bbCenter.x + Math.cos(curRightCrankAngle) * crankLen,
      bbCenter.y + Math.sin(curRightCrankAngle) * crankLen,
      0.075
    );
    const P_rightPedal = r_rightPedal_frame.clone().applyQuaternion(Q_frame).add(P_frame);

    rightPedalKeyframes.push({
      frame: f,
      transform: {
        position: [P_rightPedal.x, P_rightPedal.y, P_rightPedal.z],
        rotation: [rollAngle, yawAngle, 0],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 6. Left Pedal: Orbits crank arm tip, stays level
    const curLeftCrankAngle = crankAngle + Math.PI + pt.crankRotation;
    const r_leftPedal_frame = new THREE.Vector3(
      bbCenter.x + Math.cos(curLeftCrankAngle) * crankLen,
      bbCenter.y + Math.sin(curLeftCrankAngle) * crankLen,
      -0.075
    );
    const P_leftPedal = r_leftPedal_frame.clone().applyQuaternion(Q_frame).add(P_frame);

    leftPedalKeyframes.push({
      frame: f,
      transform: {
        position: [P_leftPedal.x, P_leftPedal.y, P_leftPedal.z],
        rotation: [rollAngle, yawAngle, 0],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 7. Rider Kinematics (Dynamic Leg Pedaling IK & Torso Cadence Sway)
    if (isArticulated && rThighItem && rShinItem && rShoeItem && lThighItem && lShinItem && lShoeItem) {
      // Analytical 2-Bone IK for Right Leg
      const rightIK = solveLegIK(Hr, r_rightPedal_frame, curRightCrankAngle);
      const P_rthigh = Hr.clone().applyQuaternion(Q_frame).add(P_frame);
      const Q_rthigh = Q_frame.clone().multiply(rightIK.Q_thigh);
      const eRthigh = new THREE.Euler().setFromQuaternion(Q_rthigh, 'YXZ');

      cyclistKeyframeMap.get(rThighItem.id)!.push({
        frame: f,
        transform: {
          position: [P_rthigh.x, P_rthigh.y, P_rthigh.z],
          rotation: [eRthigh.x, eRthigh.y, eRthigh.z],
          scale: [1, 1, 1],
        },
        interpolation: 'linear',
      });

      const P_rshin = rightIK.K.clone().applyQuaternion(Q_frame).add(P_frame);
      const Q_rshin = Q_frame.clone().multiply(rightIK.Q_shin);
      const eRshin = new THREE.Euler().setFromQuaternion(Q_rshin, 'YXZ');

      cyclistKeyframeMap.get(rShinItem.id)!.push({
        frame: f,
        transform: {
          position: [P_rshin.x, P_rshin.y, P_rshin.z],
          rotation: [eRshin.x, eRshin.y, eRshin.z],
          scale: [1, 1, 1],
        },
        interpolation: 'linear',
      });

      const P_rshoe = r_rightPedal_frame.clone().applyQuaternion(Q_frame).add(P_frame);
      const Q_rshoe = Q_frame.clone().multiply(rightIK.Q_shoe);
      const eRshoe = new THREE.Euler().setFromQuaternion(Q_rshoe, 'YXZ');

      cyclistKeyframeMap.get(rShoeItem.id)!.push({
        frame: f,
        transform: {
          position: [P_rshoe.x, P_rshoe.y, P_rshoe.z],
          rotation: [eRshoe.x, eRshoe.y, eRshoe.z],
          scale: [1, 1, 1],
        },
        interpolation: 'linear',
      });

      // Analytical 2-Bone IK for Left Leg
      const leftIK = solveLegIK(Hl, r_leftPedal_frame, curLeftCrankAngle);
      const P_lthigh = Hl.clone().applyQuaternion(Q_frame).add(P_frame);
      const Q_lthigh = Q_frame.clone().multiply(leftIK.Q_thigh);
      const eLthigh = new THREE.Euler().setFromQuaternion(Q_lthigh, 'YXZ');

      cyclistKeyframeMap.get(lThighItem.id)!.push({
        frame: f,
        transform: {
          position: [P_lthigh.x, P_lthigh.y, P_lthigh.z],
          rotation: [eLthigh.x, eLthigh.y, eLthigh.z],
          scale: [1, 1, 1],
        },
        interpolation: 'linear',
      });

      const P_lshin = leftIK.K.clone().applyQuaternion(Q_frame).add(P_frame);
      const Q_lshin = Q_frame.clone().multiply(leftIK.Q_shin);
      const eLshin = new THREE.Euler().setFromQuaternion(Q_lshin, 'YXZ');

      cyclistKeyframeMap.get(lShinItem.id)!.push({
        frame: f,
        transform: {
          position: [P_lshin.x, P_lshin.y, P_lshin.z],
          rotation: [eLshin.x, eLshin.y, eLshin.z],
          scale: [1, 1, 1],
        },
        interpolation: 'linear',
      });

      const P_lshoe = r_leftPedal_frame.clone().applyQuaternion(Q_frame).add(P_frame);
      const Q_lshoe = Q_frame.clone().multiply(leftIK.Q_shoe);
      const eLshoe = new THREE.Euler().setFromQuaternion(Q_lshoe, 'YXZ');

      cyclistKeyframeMap.get(lShoeItem.id)!.push({
        frame: f,
        transform: {
          position: [P_lshoe.x, P_lshoe.y, P_lshoe.z],
          rotation: [eLshoe.x, eLshoe.y, eLshoe.z],
          scale: [1, 1, 1],
        },
        interpolation: 'linear',
      });

      // Upper body & torso items: dynamic pedaling cadence sway
      const cadenceSwayRoll = 0.015 * Math.sin(curRightCrankAngle);
      const cadenceSwayZ = 0.005 * Math.sin(curRightCrankAngle);
      const P_torso = new THREE.Vector3(0, 0, cadenceSwayZ).applyQuaternion(Q_frame).add(P_frame);
      const Q_torso = Q_frame.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), cadenceSwayRoll)
      );
      const eTorso = new THREE.Euler().setFromQuaternion(Q_torso, 'YXZ');

      for (const item of cyclistItems) {
        if (
          item.id === rThighItem.id ||
          item.id === rShinItem.id ||
          item.id === rShoeItem.id ||
          item.id === lThighItem.id ||
          item.id === lShinItem.id ||
          item.id === lShoeItem.id
        ) {
          continue; // Already keyed with IK transforms
        }
        cyclistKeyframeMap.get(item.id)!.push({
          frame: f,
          transform: {
            position: [P_torso.x, P_torso.y, P_torso.z],
            rotation: [eTorso.x, eTorso.y, eTorso.z],
            scale: [1, 1, 1],
          },
          interpolation: 'linear',
        });
      }
    } else {
      // Monolithic fallback
      for (const item of cyclistItems) {
        cyclistKeyframeMap.get(item.id)!.push({
          frame: f,
          transform: {
            position: [P_frame.x, P_frame.y, P_frame.z],
            rotation: [rollAngle, yawAngle, pitchAngle],
            scale: [1, 1, 1],
          },
          interpolation: 'linear',
        });
      }
    }
  }

  const tracks: AnimationTrack[] = [
    { objectId: modularBicycle.frameItem.id, keyframes: frameKeyframes },
    { objectId: modularBicycle.saddleItem.id, keyframes: saddleKeyframes },
    { objectId: modularBicycle.cockpitItem.id, keyframes: cockpitKeyframes },
    { objectId: modularBicycle.frontWheelItem.id, keyframes: frontWheelKeyframes },
    { objectId: modularBicycle.rearWheelItem.id, keyframes: rearWheelKeyframes },
    { objectId: modularBicycle.cranksetItem.id, keyframes: cranksetKeyframes },
    { objectId: modularBicycle.leftPedalItem.id, keyframes: leftPedalKeyframes },
    { objectId: modularBicycle.rightPedalItem.id, keyframes: rightPedalKeyframes },
  ];

  for (const item of cyclistItems) {
    tracks.push({
      objectId: item.id,
      keyframes: cyclistKeyframeMap.get(item.id)!,
    });
  }

  const allItems: SceneItem[] = [...modularBicycle.allItems, ...cyclistItems];

  // Synchronize initial item transforms with Frame 0 keyframes
  for (const track of tracks) {
    if (track.keyframes.length > 0) {
      const targetItem = allItems.find((it) => it.id === track.objectId);
      if (targetItem) {
        targetItem.transform = {
          position: [...track.keyframes[0].transform.position] as [number, number, number],
          rotation: [...track.keyframes[0].transform.rotation] as [number, number, number],
          scale: [...track.keyframes[0].transform.scale] as [number, number, number],
        };
      }
    }
  }

  const bStats = modularBicycle.stats;
  let totalCyclistVerts = 0;
  let totalCyclistTris = 0;
  for (const it of cyclistItems) {
    totalCyclistVerts += (it.geometryParams?.customGeometry?.positions.length ?? 0) / 3;
    totalCyclistTris += (it.geometryParams?.customGeometry?.indices?.length ?? 0) / 3;
  }

  return {
    modularBicycle,
    cyclistCharacter: posedCharacter,
    bicycleItems: modularBicycle.allItems,
    cyclistItems,
    allItems,
    tracks,
    trajectory,
    totalFrames,
    fps,
    stats: {
      bicycleVertices: bStats.totalVertices,
      bicycleTriangles: bStats.totalTriangles,
      cyclistVertices: totalCyclistVerts,
      cyclistTriangles: totalCyclistTris,
      totalVertices: bStats.totalVertices + totalCyclistVerts,
      totalTriangles: bStats.totalTriangles + totalCyclistTris,
      totalItems: allItems.length,
    },
  };
}
