import * as THREE from 'three';
import { AnimationTrack, Keyframe, MaterialProperties, SceneItem } from '../types';
import {
  ClosedCircuitOptions,
  KinematicTrajectoryPoint,
  generateClosedCircuitTrajectory,
} from './animation';

export interface BicycleOptions {
  frameColor?: string;             // Frame paint color, default '#c01525' (Racing Carmine Red)
  frameMaterial?: 'gloss' | 'matte' | 'carbon'; // default 'gloss'
  componentsColor?: string;        // Anodized aluminum/chrome, default '#e2e8f0'
  handlebarStyle?: 'drop' | 'flat';// default 'drop'
  pedalStyle?: 'platform' | 'clipless'; // default 'platform'
  wheelSize?: number;              // 700c outer tire radius ~0.34m
  spokeCount?: number;             // Spokes per wheel (24, 28, 32), default 32
  includeCables?: boolean;         // Control cable housing, default true
  includeDiscBrakes?: boolean;     // 160mm vented disc rotors, default true
  includeReflectors?: boolean;     // Amber pedal reflectors, default true
  seed?: number;                   // Deterministic seed
}

export interface BicycleResult {
  frameItem: SceneItem;
  forkAndCockpitItem: SceneItem;
  wheelsItem: SceneItem;
  drivetrainItem: SceneItem;
  saddleAndSeatpostItem: SceneItem;
  accessoriesItem: SceneItem;
  allItems: SceneItem[];
  stats: {
    frameVertices: number;
    frameTriangles: number;
    forkCockpitVertices: number;
    forkCockpitTriangles: number;
    wheelsVertices: number;
    wheelsTriangles: number;
    drivetrainVertices: number;
    drivetrainTriangles: number;
    saddleSeatpostVertices: number;
    saddleSeatpostTriangles: number;
    accessoriesVertices: number;
    accessoriesTriangles: number;
    totalVertices: number;
    totalTriangles: number;
    componentsCount: number;
  };
}

export interface ModularBicycleResult {
  frameItem: SceneItem;
  cockpitItem: SceneItem;
  frontWheelItem: SceneItem;
  rearWheelItem: SceneItem;
  cranksetItem: SceneItem;
  leftPedalItem: SceneItem;
  rightPedalItem: SceneItem;
  allItems: SceneItem[];
  stats: {
    frameTriangles: number;
    cockpitTriangles: number;
    frontWheelTriangles: number;
    rearWheelTriangles: number;
    cranksetTriangles: number;
    pedalsTriangles: number;
    totalTriangles: number;
    totalVertices: number;
    componentsCount: number;
  };
}

export interface BicycleCircuitResult {
  modularBicycle: ModularBicycleResult;
  items: SceneItem[];
  tracks: AnimationTrack[];
  trajectory: KinematicTrajectoryPoint[];
  totalFrames: number;
  fps: number;
}

interface GeometryBuffer {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  colors?: number[];
}

function createBuffer(): GeometryBuffer {
  return {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    colors: [],
  };
}

/**
 * Appends a 3D cylinder/frustum between two points with radial segments and end caps.
 */
function addCylinder(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  r1: number,
  r2: number,
  segments: number,
  buf: GeometryBuffer,
  capStart: boolean = true,
  capEnd: boolean = true,
  tint: number = 1.0
): void {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  if (len < 0.0001) return;
  dir.normalize();

  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(up)) > 0.98) {
    up.set(1, 0, 0);
  }
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const norm = new THREE.Vector3().crossVectors(side, dir).normalize();

  const startVIdx = buf.positions.length / 3;

  for (let ring = 0; ring <= 1; ring++) {
    const center = ring === 0 ? p1 : p2;
    const rad = ring === 0 ? r1 : r2;
    const vCoord = ring;

    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const radialVec = new THREE.Vector3()
        .copy(side).multiplyScalar(cosT)
        .addScaledVector(norm, sinT);

      const vx = center.x + radialVec.x * rad;
      const vy = center.y + radialVec.y * rad;
      const vz = center.z + radialVec.z * rad;

      buf.positions.push(vx, vy, vz);
      buf.normals.push(radialVec.x, radialVec.y, radialVec.z);
      buf.uvs.push(s / segments, vCoord);
      if (buf.colors) {
        buf.colors.push(tint, tint, tint);
      }
    }
  }

  const stride = segments + 1;
  for (let s = 0; s < segments; s++) {
    const a = startVIdx + s;
    const b = startVIdx + stride + s;
    const c = startVIdx + stride + s + 1;
    const d = startVIdx + s + 1;

    buf.indices.push(a, b, d);
    buf.indices.push(b, c, d);
  }

  // Cap start
  if (capStart) {
    const cIdx = buf.positions.length / 3;
    buf.positions.push(p1.x, p1.y, p1.z);
    buf.normals.push(-dir.x, -dir.y, -dir.z);
    buf.uvs.push(0.5, 0.5);
    if (buf.colors) buf.colors.push(tint, tint, tint);

    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, startVIdx + s + 1, startVIdx + s);
    }
  }

  // Cap end
  if (capEnd) {
    const cIdx = buf.positions.length / 3;
    buf.positions.push(p2.x, p2.y, p2.z);
    buf.normals.push(dir.x, dir.y, dir.z);
    buf.uvs.push(0.5, 0.5);
    if (buf.colors) buf.colors.push(tint, tint, tint);

    const endRingStart = startVIdx + stride;
    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, endRingStart + s, endRingStart + s + 1);
    }
  }
}

/**
 * Appends an oriented 3D cuboid/box to a geometry buffer.
 */
function addBox(
  center: THREE.Vector3,
  size: THREE.Vector3,
  rot: THREE.Euler,
  buf: GeometryBuffer,
  tint: number = 1.0
): void {
  const hx = size.x * 0.5;
  const hy = size.y * 0.5;
  const hz = size.z * 0.5;

  const faces = [
    { norm: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0), su: hz, sv: hy, dist: hx },
    { norm: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0), su: hz, sv: hy, dist: hx },
    { norm: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1), su: hx, sv: hz, dist: hy },
    { norm: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1), su: hx, sv: hz, dist: hy },
    { norm: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0), su: hx, sv: hy, dist: hz },
    { norm: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0), su: hx, sv: hy, dist: hz },
  ];

  const q = new THREE.Quaternion().setFromEuler(rot);

  for (const face of faces) {
    const fvStart = buf.positions.length / 3;
    const worldNorm = face.norm.clone().applyQuaternion(q);
    const worldU = face.u.clone().applyQuaternion(q);
    const worldV = face.v.clone().applyQuaternion(q);
    const faceCenter = center.clone().addScaledVector(worldNorm, face.dist);

    const corners = [
      faceCenter.clone().addScaledVector(worldU, -face.su).addScaledVector(worldV, -face.sv),
      faceCenter.clone().addScaledVector(worldU, face.su).addScaledVector(worldV, -face.sv),
      faceCenter.clone().addScaledVector(worldU, face.su).addScaledVector(worldV, face.sv),
      faceCenter.clone().addScaledVector(worldU, -face.su).addScaledVector(worldV, face.sv),
    ];

    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];

    for (let c = 0; c < 4; c++) {
      buf.positions.push(corners[c].x, corners[c].y, corners[c].z);
      buf.normals.push(worldNorm.x, worldNorm.y, worldNorm.z);
      buf.uvs.push(uvs[c][0], uvs[c][1]);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }

    buf.indices.push(fvStart, fvStart + 1, fvStart + 2);
    buf.indices.push(fvStart, fvStart + 2, fvStart + 3);
  }
}

/**
 * Appends a swept smooth tube along an arbitrary 3D curve path.
 */
function addSweptTube(
  path: THREE.Vector3[],
  radiusFn: (t: number) => number,
  segments: number,
  buf: GeometryBuffer,
  capStart: boolean = true,
  capEnd: boolean = true,
  tint: number = 1.0
): void {
  if (path.length < 2) return;

  const numRings = path.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < numRings; i++) {
    let t: THREE.Vector3;
    if (i === 0) {
      t = new THREE.Vector3().subVectors(path[1], path[0]).normalize();
    } else if (i === numRings - 1) {
      t = new THREE.Vector3().subVectors(path[numRings - 1], path[numRings - 2]).normalize();
    } else {
      t = new THREE.Vector3().subVectors(path[i + 1], path[i - 1]).normalize();
    }
    if (t.lengthSq() < 0.0001) t.set(0, 1, 0);
    tangents.push(t);
  }

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];

  let n0 = new THREE.Vector3(0, 0, 1).cross(tangents[0]);
  if (n0.lengthSq() < 0.001) {
    n0 = new THREE.Vector3(1, 0, 0).cross(tangents[0]);
  }
  n0.normalize();
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], n0).normalize());

  for (let i = 1; i < numRings; i++) {
    const prevN = normals[i - 1];
    const prevT = tangents[i - 1];
    const curT = tangents[i];

    const axis = new THREE.Vector3().crossVectors(prevT, curT);
    const curN = prevN.clone();
    if (axis.lengthSq() > 0.0001) {
      axis.normalize();
      const dot = Math.max(-1, Math.min(1, prevT.dot(curT)));
      const angle = Math.acos(dot);
      curN.applyAxisAngle(axis, angle);
    }
    const proj = curN.sub(new THREE.Vector3().copy(curT).multiplyScalar(curN.dot(curT)));
    if (proj.lengthSq() > 0.0001) {
      curN.copy(proj.normalize());
    } else {
      curN.copy(prevN);
    }
    normals.push(curN);

    const binorm = new THREE.Vector3().crossVectors(curT, curN);
    if (binorm.lengthSq() > 0.0001) {
      binorm.normalize();
    } else {
      binorm.copy(binormals[i - 1]);
    }
    binormals.push(binorm);
  }

  const startVIdx = buf.positions.length / 3;

  for (let i = 0; i < numRings; i++) {
    const pt = path[i];
    const n = normals[i];
    const b = binormals[i];
    const progress = i / (numRings - 1);
    const rad = Math.max(0.0005, radiusFn(progress));

    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const nx = n.x * cosA + b.x * sinA;
      const ny = n.y * cosA + b.y * sinA;
      const nz = n.z * cosA + b.z * sinA;

      buf.positions.push(pt.x + nx * rad, pt.y + ny * rad, pt.z + nz * rad);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(j / segments, progress * 4);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const stride = segments + 1;
  for (let i = 0; i < numRings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = startVIdx + i * stride + j;
      const b = startVIdx + (i + 1) * stride + j;
      const c = startVIdx + (i + 1) * stride + (j + 1);
      const d = startVIdx + i * stride + (j + 1);

      buf.indices.push(a, b, d);
      buf.indices.push(b, c, d);
    }
  }

  if (capStart) {
    const cIdx = buf.positions.length / 3;
    const pt = path[0];
    const tan = tangents[0];
    buf.positions.push(pt.x, pt.y, pt.z);
    buf.normals.push(-tan.x, -tan.y, -tan.z);
    buf.uvs.push(0.5, 0.5);
    if (buf.colors) buf.colors.push(tint, tint, tint);

    for (let j = 0; j < segments; j++) {
      buf.indices.push(cIdx, startVIdx + j + 1, startVIdx + j);
    }
  }

  if (capEnd) {
    const cIdx = buf.positions.length / 3;
    const pt = path[numRings - 1];
    const tan = tangents[numRings - 1];
    buf.positions.push(pt.x, pt.y, pt.z);
    buf.normals.push(tan.x, tan.y, tan.z);
    buf.uvs.push(0.5, 0.5);
    if (buf.colors) buf.colors.push(tint, tint, tint);

    const lastRingStart = startVIdx + (numRings - 1) * stride;
    for (let j = 0; j < segments; j++) {
      buf.indices.push(cIdx, lastRingStart + j, lastRingStart + j + 1);
    }
  }
}

/**
 * Appends a mechanical gear sprocket with chamfered cog teeth and central hole.
 * Generates planar manifold quads and a solid inner bore cylinder wall.
 */
function addGearWheel(
  center: THREE.Vector3,
  toothCount: number,
  pitchRadius: number,
  thickness: number,
  boreRadius: number,
  buf: GeometryBuffer,
  normalAxis: 'x' | 'y' | 'z' = 'z',
  tint: number = 0.95
): void {
  const rootRadius = pitchRadius * 0.88;
  const tipRadius = pitchRadius * 1.08;
  const steps = toothCount * 4;

  const halfT = thickness * 0.5;
  const startV = buf.positions.length / 3;

  // Front (+halfT) and Back (-halfT) rings of contour
  for (let side = 0; side <= 1; side++) {
    const zOffset = side === 0 ? halfT : -halfT;
    const sideNorm = side === 0 ? 1 : -1;

    for (let i = 0; i <= steps; i++) {
      const stepIdx = i % 4;
      const toothIdx = Math.floor(i / 4);
      const angle = (toothIdx / toothCount) * Math.PI * 2 + (stepIdx / (toothCount * 4)) * Math.PI * 2;

      let r = rootRadius;
      if (stepIdx === 1 || stepIdx === 2) {
        r = tipRadius;
      }

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let px = center.x + cosA * r;
      let py = center.y + sinA * r;
      let pz = center.z + zOffset;

      let nx = 0, ny = 0, nz = sideNorm;
      if (normalAxis === 'x') {
        px = center.x + zOffset;
        py = center.y + sinA * r;
        pz = center.z + cosA * r;
        nx = sideNorm; ny = 0; nz = 0;
      }

      buf.positions.push(px, py, pz);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(0.5 + cosA * 0.5, 0.5 + sinA * 0.5);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  // Bore hole rings front and back matched 1:1 with steps to prevent crossed faces
  const boreSteps = steps;
  const boreStartV = buf.positions.length / 3;
  for (let side = 0; side <= 1; side++) {
    const zOffset = side === 0 ? halfT : -halfT;
    const sideNorm = side === 0 ? 1 : -1;

    for (let i = 0; i <= boreSteps; i++) {
      const angle = (i / boreSteps) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let px = center.x + cosA * boreRadius;
      let py = center.y + sinA * boreRadius;
      let pz = center.z + zOffset;

      let nx = 0, ny = 0, nz = sideNorm;
      if (normalAxis === 'x') {
        px = center.x + zOffset;
        py = center.y + sinA * boreRadius;
        pz = center.z + cosA * boreRadius;
        nx = sideNorm; ny = 0; nz = 0;
      }

      buf.positions.push(px, py, pz);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(0.5 + cosA * 0.2, 0.5 + sinA * 0.2);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const stride = steps + 1;
  const boreStride = boreSteps + 1;
  const backOuter = startV + stride;
  const frontBore = boreStartV;
  const backBore = boreStartV + boreStride;

  // Front and Back faces
  for (let i = 0; i < steps; i++) {
    // Front face
    buf.indices.push(startV + i, startV + i + 1, frontBore + i);
    buf.indices.push(startV + i + 1, frontBore + i + 1, frontBore + i);

    // Back face (reverse winding)
    buf.indices.push(backOuter + i + 1, backOuter + i, backBore + i);
    buf.indices.push(backBore + i + 1, backOuter + i + 1, backBore + i);
  }

  // Tooth perimeter side walls
  for (let i = 0; i < steps; i++) {
    const fA = startV + i;
    const fB = startV + i + 1;
    const bA = startV + stride + i;
    const bB = startV + stride + i + 1;

    buf.indices.push(fA, bA, bB);
    buf.indices.push(fA, bB, fB);
  }

  // Inner bore cylinder side wall (watertight solid)
  for (let i = 0; i < boreSteps; i++) {
    const fA = frontBore + i;
    const fB = frontBore + i + 1;
    const bA = backBore + i;
    const bB = backBore + i + 1;

    buf.indices.push(fA, bB, bA);
    buf.indices.push(fA, fB, bB);
  }
}

/**
 * Appends a torus/ring (used for tires, headset bearing races).
 * Supports realistic tire UV mapping with tread center at u=0.5 and lateral sidewalls.
 */
function addTorus(
  center: THREE.Vector3,
  radius: number,
  tubeRadius: number,
  radialSeg: number,
  tubularSeg: number,
  buf: GeometryBuffer,
  normalAxis: 'x' | 'y' | 'z' = 'z',
  tint: number = 1.0,
  isTire: boolean = false
): void {
  const startV = buf.positions.length / 3;

  for (let i = 0; i <= tubularSeg; i++) {
    const uAngle = (i / tubularSeg) * Math.PI * 2;
    const cosU = Math.cos(uAngle);
    const sinU = Math.sin(uAngle);

    for (let j = 0; j <= radialSeg; j++) {
      const vAngle = (j / radialSeg) * Math.PI * 2;
      const cosV = Math.cos(vAngle);
      const sinV = Math.sin(vAngle);

      const r = radius + tubeRadius * cosV;
      const z = tubeRadius * sinV;

      let px = center.x + cosU * r;
      let py = center.y + sinU * r;
      let pz = center.z + z;

      let nx = cosU * cosV;
      let ny = sinU * cosV;
      let nz = sinV;

      if (normalAxis === 'x') {
        px = center.x + z;
        py = center.y + sinU * r;
        pz = center.z + cosU * r;
        nx = sinV;
        ny = sinU * cosV;
        nz = cosU * cosV;
      }

      buf.positions.push(px, py, pz);
      buf.normals.push(nx, ny, nz);

      if (isTire) {
        // Map cross section so vAngle=0 (outer road contact) is u=0.5,
        // and lateral sidewalls are at u=0.75 and u=0.25.
        const crossU = (vAngle / (Math.PI * 2) + 0.5) % 1.0;
        buf.uvs.push(crossU, i / tubularSeg);
      } else {
        buf.uvs.push(i / tubularSeg, j / radialSeg);
      }

      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const stride = radialSeg + 1;
  for (let i = 0; i < tubularSeg; i++) {
    for (let j = 0; j < radialSeg; j++) {
      const a = startV + i * stride + j;
      const b = startV + (i + 1) * stride + j;
      const c = startV + (i + 1) * stride + (j + 1);
      const d = startV + i * stride + (j + 1);

      buf.indices.push(a, b, d);
      buf.indices.push(b, c, d);
    }
  }
}

/**
 * Appends an authentic 45mm deep-section carbon aerodynamic rim.
 * Features tire bead bed, vertical brake tracks, and aerodynamic V-taper to the spoke bed.
 */
function addAeroRim(
  center: THREE.Vector3,
  beadRadius: number,
  depth: number,
  outerWidth: number,
  spokeBedWidth: number,
  segments: number,
  buf: GeometryBuffer,
  tint: number = 0.16
): void {
  const innerRadius = beadRadius - depth;
  const halfOuterW = outerWidth * 0.5;
  const halfInnerW = spokeBedWidth * 0.5;

  const profile = [
    { r: beadRadius, z: -halfOuterW },
    { r: beadRadius - 0.010, z: -halfOuterW }, // Brake track
    { r: innerRadius + 0.006, z: -halfInnerW }, // Aero taper
    { r: innerRadius, z: 0 },                  // Inner spoke apex
    { r: innerRadius + 0.006, z: halfInnerW },  // Aero taper other side
    { r: beadRadius - 0.010, z: halfOuterW },  // Brake track
    { r: beadRadius, z: halfOuterW },
  ];

  const numProfilePts = profile.length;
  const startV = buf.positions.length / 3;

  for (let s = 0; s <= segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let p = 0; p < numProfilePts; p++) {
      const pt = profile[p];
      const px = center.x + cosA * pt.r;
      const py = center.y + sinA * pt.r;
      const pz = center.z + pt.z;

      const prevPt = profile[Math.max(0, p - 1)];
      const nextPt = profile[Math.min(numProfilePts - 1, p + 1)];
      const dr = nextPt.r - prevPt.r;
      const dz = nextPt.z - prevPt.z;
      let nr = -dz;
      let nz = dr;
      const nlen = Math.hypot(nr, nz);
      if (nlen > 0.0001) { nr /= nlen; nz /= nlen; }

      buf.positions.push(px, py, pz);
      buf.normals.push(cosA * nr, sinA * nr, nz);
      buf.uvs.push(p / (numProfilePts - 1), (s / segments) * 6);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const stride = numProfilePts;
  for (let s = 0; s < segments; s++) {
    for (let p = 0; p < numProfilePts - 1; p++) {
      const a = startV + s * stride + p;
      const b = startV + (s + 1) * stride + p;
      const c = startV + (s + 1) * stride + (p + 1);
      const d = startV + s * stride + (p + 1);

      buf.indices.push(a, b, d);
      buf.indices.push(b, c, d);
    }
  }
}

/**
 * Appends an authentic 160mm vented stainless steel disc brake rotor.
 * Features circular braking track with ventilation slots, 6-bolt mounting spider,
 * and 6 stainless Torx bolts.
 */
function addDiscBrakeRotor(
  center: THREE.Vector3,
  radius: number = 0.080,
  buf: GeometryBuffer,
  tint: number = 0.95
): void {
  const outerR = radius;
  const innerTrackR = radius * 0.80; // 16mm wide braking band
  const spiderR = radius * 0.44;     // Central mounting spider
  const boltCircleR = radius * 0.30; // 6-bolt mounting circle
  const centerHoleR = radius * 0.18; // Hub bore hole
  const thickness = 0.002;
  const halfT = thickness * 0.5;

  // 1. Braking track ring
  const trackSegs = 36;
  const trackStartV = buf.positions.length / 3;

  for (let side = 0; side <= 1; side++) {
    const zOffset = side === 0 ? halfT : -halfT;
    const normZ = side === 0 ? 1 : -1;

    for (let s = 0; s <= trackSegs; s++) {
      const angle = (s / trackSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Inner track ring
      buf.positions.push(center.x + cosA * innerTrackR, center.y + sinA * innerTrackR, center.z + zOffset);
      buf.normals.push(0, 0, normZ);
      buf.uvs.push(0.5 + cosA * 0.38, 0.5 + sinA * 0.38);
      if (buf.colors) buf.colors.push(tint, tint, tint);

      // Outer track ring
      buf.positions.push(center.x + cosA * outerR, center.y + sinA * outerR, center.z + zOffset);
      buf.normals.push(0, 0, normZ);
      buf.uvs.push(0.5 + cosA * 0.5, 0.5 + sinA * 0.5);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const ptsPerSide = (trackSegs + 1) * 2;
  const frontTrack = trackStartV;
  const backTrack = trackStartV + ptsPerSide;

  for (let s = 0; s < trackSegs; s++) {
    const fInA = frontTrack + s * 2;
    const fOutA = frontTrack + s * 2 + 1;
    const fInB = frontTrack + (s + 1) * 2;
    const fOutB = frontTrack + (s + 1) * 2 + 1;

    buf.indices.push(fInA, fOutA, fOutB);
    buf.indices.push(fInA, fOutB, fInB);

    const bInA = backTrack + s * 2;
    const bOutA = backTrack + s * 2 + 1;
    const bInB = backTrack + (s + 1) * 2;
    const bOutB = backTrack + (s + 1) * 2 + 1;

    buf.indices.push(bInA, bInB, bOutB);
    buf.indices.push(bInA, bOutB, bOutA);

    // Outer edge
    buf.indices.push(fOutA, bOutA, bOutB);
    buf.indices.push(fOutA, bOutB, fOutB);

    // Inner track edge
    buf.indices.push(fInA, fInB, bInB);
    buf.indices.push(fInA, bInB, bInA);
  }

  // 2. Central hub mounting ring
  addGearWheel(center, 12, spiderR, thickness, centerHoleR, buf, 'z', tint * 0.9);

  // 3. 6 Spider Arms connecting hub ring to braking track
  for (let arm = 0; arm < 6; arm++) {
    const armAngle = (arm / 6) * Math.PI * 2;
    const cosA = Math.cos(armAngle);
    const sinA = Math.sin(armAngle);

    const innerArmPt = new THREE.Vector3(center.x + cosA * (spiderR - 0.002), center.y + sinA * (spiderR - 0.002), center.z);
    const outerArmPt = new THREE.Vector3(
      center.x + Math.cos(armAngle + 0.12) * innerTrackR,
      center.y + Math.sin(armAngle + 0.12) * innerTrackR,
      center.z
    );

    addCylinder(innerArmPt, outerArmPt, 0.0035, 0.004, 8, buf, true, true, tint);

    // 6 Torx Mounting Bolts
    const boltPt = new THREE.Vector3(
      center.x + Math.cos(armAngle) * boltCircleR,
      center.y + Math.sin(armAngle) * boltCircleR,
      center.z + halfT + 0.001
    );
    addCylinder(boltPt, new THREE.Vector3(boltPt.x, boltPt.y, boltPt.z + 0.002), 0.003, 0.003, 8, buf, true, true, 0.98);
  }
}

/**
 * Generates an ultra-realistic, mechanically precise 3D model of a bicycle.
 * Contains diamond road frame, aero fork, cockpit, laced wheels, 11-speed drivetrain,
 * solid anatomical saddle & seatpost, and realistic routed control cables.
 */
export function generateRealisticBicycle(options: BicycleOptions = {}): BicycleResult {
  const frameColor = options.frameColor ?? '#c01525';
  const frameMatType = options.frameMaterial ?? 'gloss';
  const componentsColor = options.componentsColor ?? '#dce3eb';
  const handlebarStyle = options.handlebarStyle ?? 'drop';
  const pedalStyle = options.pedalStyle ?? 'platform';
  const wheelRadius = Math.max(0.20, options.wheelSize ?? 0.340);
  const spokeCount = Math.max(0, Math.floor((options.spokeCount ?? 32) / 2) * 2);
  const includeCables = options.includeCables ?? true;
  const includeDiscBrakes = options.includeDiscBrakes ?? true;
  const includeReflectors = options.includeReflectors ?? true;

  // Geometry buffers for 6 primary assemblies
  const frameBuf = createBuffer();
  const forkCockpitBuf = createBuffer();
  const wheelsBuf = createBuffer();
  const drivetrainBuf = createBuffer();
  const saddleBuf = createBuffer();
  const accessoriesBuf = createBuffer();

  // ==========================================
  // KEY MECHANICAL DATUMS (ISO 4210 Proportions)
  // All units in meters. y = 0 is ground plane.
  // ==========================================
  const rearAxle = new THREE.Vector3(-0.430, wheelRadius, 0.0);
  const frontAxle = new THREE.Vector3(0.570, wheelRadius, 0.0); // 1.00m wheelbase
  const bbCenter = new THREE.Vector3(0.000, wheelRadius - 0.060, 0.0); // 60mm BB drop
  const seatCluster = new THREE.Vector3(-0.160, wheelRadius + 0.430, 0.0); // 73.5° seat tube angle
  const headTubeBottom = new THREE.Vector3(0.460, wheelRadius + 0.350, 0.0);
  const headTubeTop = new THREE.Vector3(0.415, wheelRadius + 0.545, 0.0); // 73° head tube angle
  const stemClamp = new THREE.Vector3(0.408, headTubeTop.y + 0.035, 0.0);
  const handlebarCenter = new THREE.Vector3(0.505, headTubeTop.y + 0.065, 0.0);

  // ==========================================
  // 1. FRAME ASSEMBLY
  // ==========================================
  // Bottom Bracket Shell (threaded English 68mm BB shell)
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.034),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.034),
    0.021, 0.021, 16, frameBuf
  );

  // Seat Tube (connects BB shell to seat cluster)
  addCylinder(bbCenter, seatCluster, 0.017, 0.015, 16, frameBuf);

  // Seat Tube extension & clamp collar boss above top tube
  addCylinder(
    seatCluster,
    new THREE.Vector3().copy(seatCluster).add(new THREE.Vector3(-0.007, 0.035, 0)),
    0.016, 0.016, 16, frameBuf
  );

  // Head Tube (hydroformed with flared integrated bearing cups)
  addCylinder(headTubeBottom, headTubeTop, 0.025, 0.023, 16, frameBuf);
  addTorus(headTubeBottom, 0.025, 0.004, 8, 16, frameBuf, 'y');
  addTorus(headTubeTop, 0.023, 0.004, 8, 16, frameBuf, 'y');

  // Top Tube (sloping aero diamond profile from seat cluster to head tube top)
  addCylinder(seatCluster, headTubeTop, 0.018, 0.019, 16, frameBuf);

  // Down Tube (heavy-duty hydroformed oval tube resisting pedaling torque)
  const dtSteps = 8;
  const dtPath: THREE.Vector3[] = [];
  for (let i = 0; i <= dtSteps; i++) {
    const f = i / dtSteps;
    const pt = new THREE.Vector3().lerpVectors(bbCenter, headTubeBottom, f);
    pt.y += Math.sin(f * Math.PI) * 0.008;
    dtPath.push(pt);
  }
  addSweptTube(dtPath, (t) => 0.022 + 0.006 * Math.sin(t * Math.PI), 14, frameBuf);

  // Dual Chainstays (BB shell to rear dropouts, dimpled for tire & chainring clearance)
  for (const side of [-1, 1]) {
    const startPt = new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.030);
    const midPt = new THREE.Vector3(-0.210, bbCenter.y + 0.025, side * 0.045);
    const endPt = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.065);
    addSweptTube([startPt, midPt, endPt], (t) => 0.014 - 0.004 * t, 12, frameBuf);
  }

  // Dual Seatstays (Seat cluster down to rear dropouts)
  for (const side of [-1, 1]) {
    const startPt = new THREE.Vector3(seatCluster.x, seatCluster.y - 0.015, side * 0.018);
    const endPt = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.065);
    addCylinder(startPt, endPt, 0.011, 0.008, 12, frameBuf);
  }

  // Seatstay Brake/Stiffener Bridge
  const bridgeY = (seatCluster.y + rearAxle.y) * 0.48;
  addCylinder(
    new THREE.Vector3(-0.355, bridgeY, -0.032),
    new THREE.Vector3(-0.355, bridgeY, 0.032),
    0.006, 0.006, 10, frameBuf
  );

  // Rear CNC Dropouts & Derailleur Hanger
  for (const side of [-1, 1]) {
    const dropCenter = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.066);
    addBox(dropCenter, new THREE.Vector3(0.042, 0.032, 0.006), new THREE.Euler(0, 0, -0.2), frameBuf, 0.85);

    if (side === 1) {
      const hangerPos = new THREE.Vector3(rearAxle.x + 0.008, rearAxle.y - 0.028, 0.068);
      addBox(hangerPos, new THREE.Vector3(0.016, 0.030, 0.005), new THREE.Euler(0, 0, 0.15), frameBuf, 0.80);
    }
  }

  // Bottle cage bolts on Down Tube
  for (const offset of [0.15, 0.26]) {
    const pt = new THREE.Vector3().lerpVectors(bbCenter, headTubeBottom, offset);
    pt.y += 0.022;
    addCylinder(pt, new THREE.Vector3(pt.x - 0.003, pt.y + 0.006, pt.z), 0.004, 0.004, 8, frameBuf, true, true, 0.95);
  }

  // ==========================================
  // 2. FORK & COCKPIT ASSEMBLY
  // ==========================================
  // Steerer Tube & Headset Spacers
  addCylinder(headTubeTop, stemClamp, 0.014, 0.014, 14, forkCockpitBuf, true, true, 0.2);
  // Top Cap with M5 preload bolt
  addCylinder(
    stemClamp,
    new THREE.Vector3(stemClamp.x - 0.002, stemClamp.y + 0.008, stemClamp.z),
    0.016, 0.016, 14, forkCockpitBuf, true, true, 0.9
  );

  // Fork Crown
  const forkCrown = new THREE.Vector3(headTubeBottom.x + 0.005, headTubeBottom.y - 0.018, 0);
  addCylinder(
    new THREE.Vector3(forkCrown.x, forkCrown.y, -0.028),
    new THREE.Vector3(forkCrown.x, forkCrown.y, 0.028),
    0.016, 0.016, 12, forkCockpitBuf, true, true, 0.85
  );

  // Dual Aerodynamic Fork Blades (forward rake curve to front dropouts)
  for (const side of [-1, 1]) {
    const bladeStart = new THREE.Vector3(forkCrown.x, forkCrown.y, side * 0.024);
    const bladeMid = new THREE.Vector3(0.525, wheelRadius + 0.150, side * 0.038);
    const bladeEnd = new THREE.Vector3(frontAxle.x, frontAxle.y, side * 0.052);
    addSweptTube([bladeStart, bladeMid, bladeEnd], (t) => 0.016 - 0.007 * t, 12, forkCockpitBuf);

    addBox(bladeEnd, new THREE.Vector3(0.030, 0.024, 0.006), new THREE.Euler(0, 0, 0.35), forkCockpitBuf, 0.85);
  }

  // Handlebar Stem (110mm CNC alloy body + steerer collar + 4-bolt faceplate)
  addCylinder(stemClamp, handlebarCenter, 0.018, 0.016, 14, forkCockpitBuf, true, true, 0.88);
  // Stem steerer clamp collar
  addCylinder(
    new THREE.Vector3(stemClamp.x, stemClamp.y - 0.012, 0),
    new THREE.Vector3(stemClamp.x, stemClamp.y + 0.012, 0),
    0.019, 0.019, 14, forkCockpitBuf, true, true, 0.90
  );
  // Stem Faceplate clamping handlebar
  addCylinder(
    new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, -0.022),
    new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0.022),
    0.019, 0.019, 14, forkCockpitBuf, true, true, 0.92
  );
  // 4 Stem Faceplate hex bolts
  for (const dx of [-0.008, 0.008]) {
    for (const dz of [-0.014, 0.014]) {
      const boltPt = new THREE.Vector3(handlebarCenter.x + 0.018, handlebarCenter.y + dx, dz);
      addCylinder(boltPt, new THREE.Vector3(boltPt.x + 0.004, boltPt.y, boltPt.z), 0.003, 0.003, 8, forkCockpitBuf, true, true, 0.98);
    }
  }

  // Handlebars & Controls (Supports both 'drop' and 'flat' styles)
  let leftLeverPos: THREE.Vector3;
  let rightLeverPos: THREE.Vector3;

  if (handlebarStyle === 'flat') {
    // Flat / Commuter Riser Handlebar (660mm width with 5° backsweep and 15mm rise)
    const flatBarHalf = 0.330;
    for (const side of [-1, 1]) {
      const sign = side;
      const b0 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0);
      const b1 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, sign * 0.050);
      const b2 = new THREE.Vector3(handlebarCenter.x - 0.015, handlebarCenter.y + 0.012, sign * 0.180);
      const b3 = new THREE.Vector3(handlebarCenter.x - 0.035, handlebarCenter.y + 0.015, sign * flatBarHalf);

      addSweptTube([b0, b1, b2, b3], () => 0.011, 12, forkCockpitBuf, false, true, 0.90);

      // Lock-on ergonomic rubber grips on bar ends (130mm long)
      const gripStart = new THREE.Vector3(handlebarCenter.x - 0.022, handlebarCenter.y + 0.014, sign * (flatBarHalf - 0.130));
      const gripEnd = b3;
      addCylinder(gripStart, gripEnd, 0.015, 0.015, 12, forkCockpitBuf, true, true, 0.12);
      // Aluminum lock-on collar rings
      addCylinder(gripStart, new THREE.Vector3().lerpVectors(gripStart, gripEnd, 0.06), 0.016, 0.016, 12, forkCockpitBuf, true, true, 0.85);
      addCylinder(new THREE.Vector3().lerpVectors(gripEnd, gripStart, 0.06), gripEnd, 0.016, 0.016, 12, forkCockpitBuf, true, true, 0.85);

      // Flat-bar 2-finger brake levers
      const leverClampPos = new THREE.Vector3(handlebarCenter.x - 0.020, handlebarCenter.y + 0.013, sign * (flatBarHalf - 0.145));
      addCylinder(
        new THREE.Vector3(leverClampPos.x, leverClampPos.y, leverClampPos.z - 0.008),
        new THREE.Vector3(leverClampPos.x, leverClampPos.y, leverClampPos.z + 0.008),
        0.014, 0.014, 10, forkCockpitBuf, true, true, 0.80
      );
      // Lever blade extending forward and angled down
      const leverTip = new THREE.Vector3(leverClampPos.x + 0.065, leverClampPos.y - 0.020, sign * (flatBarHalf - 0.125));
      addCylinder(leverClampPos, leverTip, 0.006, 0.004, 8, forkCockpitBuf, true, true, 0.95);
    }

    leftLeverPos = new THREE.Vector3(handlebarCenter.x + 0.035, handlebarCenter.y - 0.005, -0.180);
    rightLeverPos = new THREE.Vector3(handlebarCenter.x + 0.035, handlebarCenter.y - 0.005, 0.180);
  } else {
    // Road Drop Handlebars (420mm width with reach, drops, and bar tape)
    const barWidth = 0.420;
    const halfBar = barWidth * 0.5;

    for (const side of [-1, 1]) {
      const sign = side;
      const p0 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0);
      const p1 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, sign * 0.120);
      const p2 = new THREE.Vector3(handlebarCenter.x + 0.025, handlebarCenter.y, sign * (halfBar - 0.025));
      const p3 = new THREE.Vector3(handlebarCenter.x + 0.075, handlebarCenter.y - 0.020, sign * halfBar);
      const p4 = new THREE.Vector3(handlebarCenter.x + 0.065, handlebarCenter.y - 0.090, sign * halfBar);
      const p5 = new THREE.Vector3(handlebarCenter.x - 0.035, handlebarCenter.y - 0.125, sign * halfBar);

      addSweptTube([p0, p1, p2, p3, p4, p5], () => 0.0125, 12, forkCockpitBuf, false, true, 0.15);

      // Bar end plug
      addCylinder(p5, new THREE.Vector3(p5.x - 0.008, p5.y, p5.z), 0.011, 0.011, 10, forkCockpitBuf, true, true, 0.85);

      // Dual Brake/Shift Hoods & Levers (STI Ergonomic Shifters)
      const hoodBase = new THREE.Vector3(p3.x - 0.010, p3.y + 0.015, sign * halfBar);
      const hoodNose = new THREE.Vector3(p3.x + 0.055, p3.y + 0.030, sign * halfBar);
      addCylinder(hoodBase, hoodNose, 0.018, 0.014, 10, forkCockpitBuf, true, true, 0.12);

      // Contoured aluminum brake lever blade
      const leverPivot = new THREE.Vector3(hoodNose.x - 0.015, hoodNose.y - 0.010, sign * (halfBar + 0.006 * sign));
      const leverTip = new THREE.Vector3(leverPivot.x - 0.025, leverPivot.y - 0.095, leverPivot.z);
      addCylinder(leverPivot, leverTip, 0.007, 0.004, 10, forkCockpitBuf, true, true, 0.95);
    }

    leftLeverPos = new THREE.Vector3(handlebarCenter.x + 0.045, handlebarCenter.y + 0.025, -halfBar);
    rightLeverPos = new THREE.Vector3(handlebarCenter.x + 0.045, handlebarCenter.y + 0.025, halfBar);
  }

  // ==========================================
  // 3. WHEELS ASSEMBLY (FRONT & REAR)
  // ==========================================
  const rimRadius = wheelRadius - 0.028; // Bead radius
  const tireCrossRad = 0.020;            // 28c tire cross section

  const wheels = [
    { name: 'front', center: frontAxle, isRear: false },
    { name: 'rear', center: rearAxle, isRear: true },
  ];

  for (const w of wheels) {
    const c = w.center;

    // 700c Rubber Clincher Tire with tread and competition tan sidewalls
    addTorus(c, rimRadius + tireCrossRad * 0.9, tireCrossRad, 14, 48, wheelsBuf, 'z', 1.0, true);

    // Deep-Section 45mm Aero Carbon Rim
    addAeroRim(c, rimRadius, 0.045, 0.025, 0.014, 48, wheelsBuf, 0.16);

    // Presta Valve Stem & Knurled Brass Nut
    const valveBase = new THREE.Vector3(c.x, c.y + rimRadius - 0.012, c.z);
    const valveTip = new THREE.Vector3(c.x, c.y + rimRadius - 0.052, c.z);
    addCylinder(valveBase, valveTip, 0.003, 0.003, 8, wheelsBuf, true, true, 0.90);
    addCylinder(valveTip, new THREE.Vector3(c.x, c.y + rimRadius - 0.062, c.z), 0.0035, 0.0035, 8, wheelsBuf, true, true, 0.85);

    // Wheel Hub (CNC alloy central barrel, high spoke flanges, thru-axle)
    const flangeOffset = w.isRear ? 0.028 : 0.035;
    const hubShellRad = 0.016;
    const flangeRad = 0.032;

    addCylinder(
      new THREE.Vector3(c.x, c.y, -flangeOffset),
      new THREE.Vector3(c.x, c.y, flangeOffset),
      hubShellRad, hubShellRad, 16, wheelsBuf, true, true, 0.92
    );

    for (const side of [-1, 1]) {
      const flgZ = side * (w.isRear && side === 1 ? flangeOffset * 0.75 : flangeOffset);
      addCylinder(
        new THREE.Vector3(c.x, c.y, flgZ - 0.002),
        new THREE.Vector3(c.x, c.y, flgZ + 0.002),
        flangeRad, flangeRad, 16, wheelsBuf, true, true, 0.95
      );
    }

    addCylinder(
      new THREE.Vector3(c.x, c.y, -0.068),
      new THREE.Vector3(c.x, c.y, 0.068),
      0.007, 0.007, 12, wheelsBuf, true, true, 0.88
    );

    // Laced Tangent & Radial Spokes with Brass Nipples
    const numSpokes = spokeCount;
    for (let s = 0; s < numSpokes; s++) {
      const isRightFlange = s % 2 === 0;
      const flgSign = isRightFlange ? 1 : -1;
      const flgZ = flgSign * (w.isRear && isRightFlange ? flangeOffset * 0.75 : flangeOffset);

      const isCrossPush = Math.floor(s / 2) % 2 === 0;
      const tangentOffset = isCrossPush ? 0.22 : -0.22;

      const spokeFrac = s / numSpokes;
      const rimAngle = spokeFrac * Math.PI * 2;
      const hubAngle = rimAngle + tangentOffset;

      const hubX = c.x + Math.cos(hubAngle) * (flangeRad - 0.003);
      const hubY = c.y + Math.sin(hubAngle) * (flangeRad - 0.003);
      const hubPt = new THREE.Vector3(hubX, hubY, flgZ);

      const rimX = c.x + Math.cos(rimAngle) * (rimRadius - 0.040);
      const rimY = c.y + Math.sin(rimAngle) * (rimRadius - 0.040);
      const rimPt = new THREE.Vector3(rimX, rimY, flgSign * 0.003);

      addCylinder(hubPt, rimPt, 0.0009, 0.0009, 6, wheelsBuf, false, false, 0.98);

      const nippleBase = new THREE.Vector3().lerpVectors(rimPt, hubPt, 0.035);
      addCylinder(rimPt, nippleBase, 0.0022, 0.0022, 6, wheelsBuf, true, true, 0.85);
    }

    // 160mm Vented Stainless Steel Disc Brake Rotors & Calipers
    if (includeDiscBrakes) {
      const rotorZ = -0.028;
      const rotorCenter = new THREE.Vector3(c.x, c.y, rotorZ);
      addDiscBrakeRotor(rotorCenter, 0.080, wheelsBuf, 0.95);

      const caliperPos = w.isRear
        ? new THREE.Vector3(c.x + 0.045, c.y + 0.055, rotorZ - 0.005)
        : new THREE.Vector3(c.x - 0.045, c.y + 0.055, rotorZ - 0.005);
      addBox(caliperPos, new THREE.Vector3(0.040, 0.035, 0.022), new THREE.Euler(0, 0, w.isRear ? 0.7 : -0.7), wheelsBuf, 0.25);
    }
  }

  // ==========================================
  // 4. DRIVETRAIN ASSEMBLY
  // ==========================================
  // Full-width Bottom Bracket Spindle connecting seamlessly into both crank arms
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.075),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.075),
    0.012, 0.012, 14, drivetrainBuf, true, true, 0.92
  );
  // Splined BB External Cups
  for (const side of [-1, 1]) {
    addCylinder(
      new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.034),
      new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.045),
      0.022, 0.022, 16, drivetrainBuf, true, true, 0.80
    );
  }

  // Dual 172.5mm Forged Aluminum Crank Arms
  const crankLen = 0.1725;
  const crankAngle = -0.45;

  // Right Drive Crank (Spindle boss, forged beam, pedal eye)
  const rightCrankBase = new THREE.Vector3(bbCenter.x, bbCenter.y, 0.070);
  const rightCrankTip = new THREE.Vector3(
    bbCenter.x + Math.cos(crankAngle) * crankLen,
    bbCenter.y + Math.sin(crankAngle) * crankLen,
    0.075
  );
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.060),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.078),
    0.020, 0.020, 14, drivetrainBuf, true, true, 0.94
  );
  addCylinder(rightCrankBase, rightCrankTip, 0.018, 0.013, 12, drivetrainBuf, true, true, 0.95);
  addCylinder(
    new THREE.Vector3(rightCrankTip.x, rightCrankTip.y, 0.068),
    new THREE.Vector3(rightCrankTip.x, rightCrankTip.y, 0.082),
    0.015, 0.015, 12, drivetrainBuf, true, true, 0.92
  );

  // Left Non-Drive Crank (180° opposite)
  const leftCrankAngle = crankAngle + Math.PI;
  const leftCrankBase = new THREE.Vector3(bbCenter.x, bbCenter.y, -0.070);
  const leftCrankTip = new THREE.Vector3(
    bbCenter.x + Math.cos(leftCrankAngle) * crankLen,
    bbCenter.y + Math.sin(leftCrankAngle) * crankLen,
    -0.075
  );
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.078),
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.060),
    0.020, 0.020, 14, drivetrainBuf, true, true, 0.94
  );
  addCylinder(leftCrankBase, leftCrankTip, 0.018, 0.013, 12, drivetrainBuf, true, true, 0.95);
  addCylinder(
    new THREE.Vector3(leftCrankTip.x, leftCrankTip.y, -0.082),
    new THREE.Vector3(leftCrankTip.x, leftCrankTip.y, -0.068),
    0.015, 0.015, 12, drivetrainBuf, true, true, 0.92
  );

  // 4-Arm Chainring Spider on Right Crank
  for (let a = 0; a < 4; a++) {
    const spiderAngle = crankAngle + (a / 4) * Math.PI * 2;
    const spEnd = new THREE.Vector3(
      bbCenter.x + Math.cos(spiderAngle) * 0.065,
      bbCenter.y + Math.sin(spiderAngle) * 0.065,
      0.048
    );
    addCylinder(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.052), spEnd, 0.010, 0.007, 8, drivetrainBuf, true, true, 0.92);
    addCylinder(spEnd, new THREE.Vector3(spEnd.x, spEnd.y, 0.042), 0.005, 0.005, 8, drivetrainBuf, true, true, 0.85);
  }

  // Double Chainrings: Outer 50T and Inner 34T with cog teeth
  addGearWheel(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.048), 50, 0.101, 0.003, 0.060, drivetrainBuf, 'z', 0.96);
  addGearWheel(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.041), 34, 0.069, 0.003, 0.040, drivetrainBuf, 'z', 0.92);

  // 11-Speed Rear Cassette (Ordered largest 28T inboard to smallest 11T outboard)
  const cassetteCogs = [28, 25, 23, 21, 19, 17, 15, 14, 13, 12, 11];
  const cogStartZ = 0.024;
  const cogSpacing = 0.0038;

  for (let c = 0; c < cassetteCogs.length; c++) {
    const toothNum = cassetteCogs[c];
    const pitchR = (toothNum / 50) * 0.101;
    const cogZ = cogStartZ + c * cogSpacing;
    addGearWheel(new THREE.Vector3(rearAxle.x, rearAxle.y, cogZ), toothNum, pitchR, 0.002, 0.018, drivetrainBuf, 'z', 0.95);
  }

  // Cassette lockring on outer end
  const lockringZ = cogStartZ + cassetteCogs.length * cogSpacing;
  addCylinder(
    new THREE.Vector3(rearAxle.x, rearAxle.y, lockringZ),
    new THREE.Vector3(rearAxle.x, rearAxle.y, lockringZ + 0.003),
    0.018, 0.018, 16, drivetrainBuf, true, true, 0.88
  );

  // Rear Derailleur Assembly (Derailleur body, cage, dual 11T jockey pulleys)
  const derailleurHanger = new THREE.Vector3(rearAxle.x + 0.008, rearAxle.y - 0.038, 0.068);
  const upperJockey = new THREE.Vector3(rearAxle.x + 0.025, rearAxle.y - 0.065, 0.045);
  const lowerJockey = new THREE.Vector3(rearAxle.x + 0.060, rearAxle.y - 0.125, 0.045);

  addCylinder(derailleurHanger, upperJockey, 0.009, 0.007, 10, drivetrainBuf, true, true, 0.30);
  addCylinder(upperJockey, lowerJockey, 0.008, 0.008, 8, drivetrainBuf, true, true, 0.25);

  addGearWheel(upperJockey, 11, 0.022, 0.004, 0.006, drivetrainBuf, 'z', 0.20);
  addGearWheel(lowerJockey, 11, 0.022, 0.004, 0.006, drivetrainBuf, 'z', 0.20);
  addCylinder(new THREE.Vector3(upperJockey.x, upperJockey.y, 0.038), new THREE.Vector3(upperJockey.x, upperJockey.y, 0.052), 0.004, 0.004, 8, drivetrainBuf, true, true, 0.98);
  addCylinder(new THREE.Vector3(lowerJockey.x, lowerJockey.y, 0.038), new THREE.Vector3(lowerJockey.x, lowerJockey.y, 0.052), 0.004, 0.004, 8, drivetrainBuf, true, true, 0.98);

  // Continuous Closed-Loop Roller Chain (Loops over front 50T, rear cog, pulleys, and returns)
  const chainPath: THREE.Vector3[] = [];
  const middleCogPitchR = (cassetteCogs[5] / 50) * 0.101; // ~17T cog
  const chainZ = 0.045;

  // 1. Top chain run: front chainring top to rear cog top
  const frontTop = new THREE.Vector3(bbCenter.x, bbCenter.y + 0.101, chainZ);
  const rearTop = new THREE.Vector3(rearAxle.x, rearAxle.y + middleCogPitchR, chainZ);
  const numTopSteps = 16;
  for (let i = 0; i < numTopSteps; i++) {
    chainPath.push(new THREE.Vector3().lerpVectors(frontTop, rearTop, i / numTopSteps));
  }

  // 2. Wrap around rear cog
  const numRearWrap = 8;
  for (let i = 0; i < numRearWrap; i++) {
    const angle = Math.PI * 0.5 + (i / numRearWrap) * Math.PI * 0.6;
    chainPath.push(new THREE.Vector3(
      rearAxle.x + Math.cos(angle) * middleCogPitchR,
      rearAxle.y + Math.sin(angle) * middleCogPitchR,
      chainZ
    ));
  }

  // 3. Curve into upper jockey pulley
  chainPath.push(new THREE.Vector3(upperJockey.x + 0.015, upperJockey.y + 0.018, chainZ));
  chainPath.push(new THREE.Vector3(upperJockey.x - 0.015, upperJockey.y, chainZ));

  // 4. Snake through lower tension pulley
  chainPath.push(new THREE.Vector3(lowerJockey.x - 0.015, lowerJockey.y, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x, lowerJockey.y - 0.022, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x + 0.018, lowerJockey.y - 0.018, chainZ));

  // 5. Bottom chain run: lower pulley back to bottom of front chainring
  const frontBottom = new THREE.Vector3(bbCenter.x, bbCenter.y - 0.101, chainZ);
  const numBottomSteps = 16;
  const lastDerailleurPt = chainPath[chainPath.length - 1];
  for (let i = 1; i < numBottomSteps; i++) {
    chainPath.push(new THREE.Vector3().lerpVectors(lastDerailleurPt, frontBottom, i / numBottomSteps));
  }

  // 6. Wrap around front chainring back to top (seamlessly closing the loop)
  const numFrontWrap = 12;
  for (let i = 0; i < numFrontWrap; i++) {
    const angle = -Math.PI * 0.5 + (i / numFrontWrap) * Math.PI;
    chainPath.push(new THREE.Vector3(
      bbCenter.x + Math.cos(angle) * 0.101,
      bbCenter.y + Math.sin(angle) * 0.101,
      chainZ
    ));
  }

  // Synthesize closed continuous roller chain links with side plates and roller pins
  const totalChainNodes = chainPath.length;
  for (let i = 0; i < totalChainNodes; i++) {
    const ptA = chainPath[i];
    const ptB = chainPath[(i + 1) % totalChainNodes];
    const isOuter = i % 2 === 0;
    const linkLen = ptA.distanceTo(ptB);

    if (linkLen > 0.001) {
      // Central roller sleeve
      addCylinder(ptA, ptB, 0.0042, 0.0042, 6, drivetrainBuf, true, true, 0.88);

      // Outer or inner parallel side link plates
      const plateZOffset = isOuter ? 0.0035 : 0.0024;
      for (const pSign of [-1, 1]) {
        const plateA = new THREE.Vector3(ptA.x, ptA.y, chainZ + pSign * plateZOffset);
        const plateB = new THREE.Vector3(ptB.x, ptB.y, chainZ + pSign * plateZOffset);
        addCylinder(plateA, plateB, 0.0048, 0.0048, 6, drivetrainBuf, true, true, isOuter ? 0.98 : 0.85);
      }

      // Roller pin rivet through center
      addCylinder(
        new THREE.Vector3(ptA.x, ptA.y, chainZ - 0.0045),
        new THREE.Vector3(ptA.x, ptA.y, chainZ + 0.0045),
        0.0022, 0.0022, 6, drivetrainBuf, true, true, 0.95
      );
    }
  }

  // Pedals (Supports both 'platform' and 'clipless' styles)
  const pedals = [
    { tip: rightCrankTip, sign: 1 },
    { tip: leftCrankTip, sign: -1 },
  ];

  for (const p of pedals) {
    const axleStart = p.tip;
    const axleEnd = new THREE.Vector3(axleStart.x, axleStart.y, axleStart.z + p.sign * 0.075);
    // 9/16" Pedal spindle
    addCylinder(axleStart, axleEnd, 0.006, 0.006, 10, drivetrainBuf, true, true, 0.95);

    const bodyCenter = new THREE.Vector3().lerpVectors(axleStart, axleEnd, 0.65);

    if (pedalStyle === 'clipless') {
      // Road Racing Clipless Pedal (Look Keo / Shimano SPD-SL style compact body)
      addBox(bodyCenter, new THREE.Vector3(0.065, 0.015, 0.048), new THREE.Euler(0, 0, 0), drivetrainBuf, 0.25);
      // Stainless steel cleat wear plate
      addBox(
        new THREE.Vector3(bodyCenter.x, bodyCenter.y + 0.008, bodyCenter.z),
        new THREE.Vector3(0.040, 0.002, 0.036),
        new THREE.Euler(0, 0, 0),
        drivetrainBuf,
        0.95
      );
      // Spring-loaded retention binding claw at rear
      const clawPos = new THREE.Vector3(bodyCenter.x - 0.028, bodyCenter.y + 0.010, bodyCenter.z);
      addBox(clawPos, new THREE.Vector3(0.014, 0.018, 0.040), new THREE.Euler(0, 0, 0.2), drivetrainBuf, 0.40);
      // Tension adjustment screw
      addCylinder(
        new THREE.Vector3(clawPos.x - 0.006, clawPos.y, clawPos.z),
        new THREE.Vector3(clawPos.x - 0.012, clawPos.y, clawPos.z),
        0.003, 0.003, 8, drivetrainBuf, true, true, 0.98
      );
    } else {
      // Platform Pedal with perimeter traction pins
      addBox(bodyCenter, new THREE.Vector3(0.082, 0.016, 0.065), new THREE.Euler(0, 0, 0), drivetrainBuf, 0.35);

      // Amber Pedal Reflectors
      if (includeReflectors) {
        for (const fwd of [-1, 1]) {
          const refPos = new THREE.Vector3(bodyCenter.x + fwd * 0.043, bodyCenter.y, bodyCenter.z);
          addBox(refPos, new THREE.Vector3(0.006, 0.012, 0.042), new THREE.Euler(0, 0, 0), accessoriesBuf, 0.98);
        }
      }
    }
  }

  // ==========================================
  // 5. COCKPIT SEATING & SADDLE ASSEMBLY
  // ==========================================
  const saddleClampPos = new THREE.Vector3(seatCluster.x - 0.035, seatCluster.y + 0.125, 0.0);
  addCylinder(seatCluster, saddleClampPos, 0.0135, 0.0135, 14, saddleBuf, true, true, 0.88);

  // Seatpost Collar Clamp with M5 Hex pinch bolt
  addCylinder(
    new THREE.Vector3(seatCluster.x, seatCluster.y + 0.005, 0),
    new THREE.Vector3(seatCluster.x - 0.004, seatCluster.y + 0.025, 0),
    0.017, 0.017, 14, saddleBuf, true, true, 0.95
  );
  addCylinder(
    new THREE.Vector3(seatCluster.x - 0.018, seatCluster.y + 0.015, -0.010),
    new THREE.Vector3(seatCluster.x - 0.018, seatCluster.y + 0.015, 0.010),
    0.0035, 0.0035, 8, saddleBuf, true, true, 0.98
  );

  // Micro-Adjust Two-Bolt Saddle Rail Clamp
  addBox(saddleClampPos, new THREE.Vector3(0.032, 0.018, 0.038), new THREE.Euler(0, 0, 0), saddleBuf, 0.85);

  // Dual Parallel Chrome Saddle Rails (7mm standard road rails)
  for (const side of [-1, 1]) {
    const railZ = side * 0.022;
    const rStart = new THREE.Vector3(saddleClampPos.x - 0.105, saddleClampPos.y + 0.025, railZ);
    const rMid = new THREE.Vector3(saddleClampPos.x, saddleClampPos.y + 0.012, railZ);
    const rEnd = new THREE.Vector3(saddleClampPos.x + 0.095, saddleClampPos.y + 0.028, railZ);
    addSweptTube([rStart, rMid, rEnd], () => 0.0035, 8, saddleBuf, true, true, 0.98);
  }

  // Aerodynamic Road Racing Saddle: Solid Contoured Shell with Perineal Relief Channel
  const saddleLen = 0.265;
  const saddleBaseX = saddleClampPos.x - 0.120;
  const saddleStations = 14;
  const crossPtsPerStation = 7; // Left skirt, left wing, left relief, center groove, right relief, right wing, right skirt
  const saddleStartV = saddleBuf.positions.length / 3;

  for (let i = 0; i <= saddleStations; i++) {
    const f = i / saddleStations; // 0 = rear cantle, 1 = front nose
    const sx = saddleBaseX + (1.0 - f) * saddleLen;
    const sy = saddleClampPos.y + 0.035 + (f > 0.7 ? (f - 0.7) * 0.020 : Math.pow(0.7 - f, 1.8) * 0.032);

    // Width flares at rear sit-bones (f=0) and narrows at nose (f=1)
    const halfW = f > 0.6 ? 0.014 + (1.0 - f) * 0.025 : 0.024 + Math.pow(0.6 - f, 1.3) * 0.095;

    // 7 cross-section coordinates across saddle width
    const offsets = [
      { yOff: -0.014, zOff: -halfW },             // Left lower skirt
      { yOff: -0.001, zOff: -halfW * 0.82 },      // Left upper sit wing
      { yOff: -0.003, zOff: -halfW * 0.28 },      // Left relief channel edge
      { yOff: -0.010, zOff: 0.0 },                // Center perineal relief groove
      { yOff: -0.003, zOff: halfW * 0.28 },       // Right relief channel edge
      { yOff: -0.001, zOff: halfW * 0.82 },       // Right upper sit wing
      { yOff: -0.014, zOff: halfW },              // Right lower skirt
    ];

    for (let c = 0; c < crossPtsPerStation; c++) {
      const off = offsets[c];
      const px = sx;
      const py = sy + off.yOff;
      const pz = off.zOff;

      // Surface normal
      let nx = f > 0.8 ? 0.3 : (f < 0.2 ? -0.3 : 0);
      let ny = 1.0;
      let nz = off.zOff / Math.max(0.001, halfW);
      const nlen = Math.hypot(nx, ny, nz);
      nx /= nlen; ny /= nlen; nz /= nlen;

      saddleBuf.positions.push(px, py, pz);
      saddleBuf.normals.push(nx, ny, nz);
      saddleBuf.uvs.push(c / (crossPtsPerStation - 1), f * 4);
      if (saddleBuf.colors) saddleBuf.colors.push(0.20, 0.20, 0.20);
    }
  }

  // Triangulate saddle top shell surface
  for (let i = 0; i < saddleStations; i++) {
    for (let c = 0; c < crossPtsPerStation - 1; c++) {
      const a = saddleStartV + i * crossPtsPerStation + c;
      const b = saddleStartV + (i + 1) * crossPtsPerStation + c;
      const d = saddleStartV + i * crossPtsPerStation + (c + 1);
      const e = saddleStartV + (i + 1) * crossPtsPerStation + (c + 1);

      saddleBuf.indices.push(a, b, d);
      saddleBuf.indices.push(b, e, d);
    }
  }

  // Rounded front nose cap
  const nosePt = new THREE.Vector3(saddleBaseX, saddleClampPos.y + 0.038, 0);
  const noseStartRing = saddleStartV + saddleStations * crossPtsPerStation;
  const noseCenterV = saddleBuf.positions.length / 3;
  saddleBuf.positions.push(nosePt.x - 0.008, nosePt.y - 0.004, nosePt.z);
  saddleBuf.normals.push(-1, 0, 0);
  saddleBuf.uvs.push(0.5, 0.5);
  if (saddleBuf.colors) saddleBuf.colors.push(0.20, 0.20, 0.20);

  for (let c = 0; c < crossPtsPerStation - 1; c++) {
    saddleBuf.indices.push(noseCenterV, noseStartRing + c, noseStartRing + c + 1);
  }

  // ==========================================
  // 6. ROUTED CONTROL CABLES & ACCESSORIES
  // ==========================================
  if (includeCables) {
    const cableRad = 0.0022;

    // Front Brake Cable: from left handlebar lever to front disc caliper
    const fb0 = leftLeverPos;
    const fb1 = new THREE.Vector3(headTubeTop.x + 0.050, headTubeTop.y - 0.020, -0.045);
    const fb2 = new THREE.Vector3(forkCrown.x + 0.015, forkCrown.y - 0.060, -0.035);
    const fb3 = new THREE.Vector3(frontAxle.x - 0.040, frontAxle.y + 0.065, -0.032);
    addSweptTube([fb0, fb1, fb2, fb3], () => cableRad, 8, accessoriesBuf, true, true, 0.12);

    // Rear Brake Cable: from right handlebar lever through top tube to rear caliper
    const rb0 = rightLeverPos;
    const rb1 = new THREE.Vector3(headTubeTop.x + 0.050, headTubeTop.y - 0.020, 0.045);
    const rb2 = new THREE.Vector3(seatCluster.x + 0.040, seatCluster.y + 0.005, 0.020);
    const rb3 = new THREE.Vector3(seatCluster.x - 0.030, seatCluster.y - 0.040, -0.025);
    const rb4 = new THREE.Vector3(rearAxle.x + 0.050, rearAxle.y + 0.065, -0.032);
    addSweptTube([rb0, rb1, rb2, rb3, rb4], () => cableRad, 8, accessoriesBuf, true, true, 0.12);

    // Rear Shifter Cable: from right handlebar along down tube to rear derailleur
    const rs0 = new THREE.Vector3(rightLeverPos.x - 0.015, rightLeverPos.y - 0.010, rightLeverPos.z * 0.90);
    const rs1 = new THREE.Vector3(headTubeBottom.x + 0.020, headTubeBottom.y + 0.040, 0.035);
    const rs2 = new THREE.Vector3(bbCenter.x + 0.040, bbCenter.y - 0.015, 0.032);
    const rs3 = new THREE.Vector3(rearAxle.x + 0.035, rearAxle.y - 0.035, 0.065);
    addSweptTube([rs0, rs1, rs2, rs3], () => cableRad, 8, accessoriesBuf, true, true, 0.12);
  }

  // ==========================================
  // MATERIALS CONFIGURATION
  // ==========================================
  const frameMat: MaterialProperties = {
    color: frameMatType === 'carbon' ? '#ffffff' : frameColor,
    roughness: frameMatType === 'matte' ? 0.65 : 0.18,
    metalness: frameMatType === 'carbon' ? 0.10 : 0.40,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: frameMatType === 'carbon' ? 'carbon_fiber' : 'none',
    vertexColors: false,
  };

  const forkCockpitMat: MaterialProperties = {
    color: componentsColor,
    roughness: 0.28,
    metalness: 0.85,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'brushed_metal',
    vertexColors: true,
  };

  const wheelsMat: MaterialProperties = {
    color: '#ffffff', // Set to white so DataTexture colors (tan sidewalls & black tread) show purely
    roughness: 0.82,
    metalness: 0.08,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'tire_tread',
    vertexColors: true,
  };

  const drivetrainMat: MaterialProperties = {
    color: '#e2e8f0',
    roughness: 0.22,
    metalness: 0.92,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'brushed_metal',
    vertexColors: true,
  };

  const saddleMat: MaterialProperties = {
    color: '#1c1917',
    roughness: 0.68,
    metalness: 0.12,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'leather_perforated',
    vertexColors: true,
  };

  const accessoriesMat: MaterialProperties = {
    color: '#f59e0b',
    roughness: 0.25,
    metalness: 0.20,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'reflector_amber',
    vertexColors: true,
  };

  // ==========================================
  // ASSEMBLE SCENE ITEMS
  // ==========================================
  const frameItem: SceneItem = {
    id: 'bicycle_frame',
    name: 'Bicycle - Diamond Road Frame',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: frameMat,
    geometryParams: {
      customGeometry: {
        positions: frameBuf.positions,
        normals: frameBuf.normals,
        uvs: frameBuf.uvs,
        indices: frameBuf.indices,
        colors: frameBuf.colors,
      },
    },
    visible: true,
    locked: false,
  };

  const forkCockpitItem: SceneItem = {
    id: 'bicycle_fork_cockpit',
    name: handlebarStyle === 'flat' ? 'Bicycle - Fork, Stem & Flat Handlebars' : 'Bicycle - Fork, Stem & Drop Handlebars',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: forkCockpitMat,
    geometryParams: {
      customGeometry: {
        positions: forkCockpitBuf.positions,
        normals: forkCockpitBuf.normals,
        uvs: forkCockpitBuf.uvs,
        indices: forkCockpitBuf.indices,
        colors: forkCockpitBuf.colors,
      },
    },
    visible: true,
    locked: false,
  };

  const wheelsItem: SceneItem = {
    id: 'bicycle_wheels',
    name: 'Bicycle - Wheels, Aero Rims, Spokes & Disc Rotors',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: wheelsMat,
    geometryParams: {
      customGeometry: {
        positions: wheelsBuf.positions,
        normals: wheelsBuf.normals,
        uvs: wheelsBuf.uvs,
        indices: wheelsBuf.indices,
        colors: wheelsBuf.colors,
      },
    },
    visible: true,
    locked: false,
  };

  const drivetrainItem: SceneItem = {
    id: 'bicycle_drivetrain',
    name: 'Bicycle - Drivetrain, Cranks, Cassette, Derailleur & Chain',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: drivetrainMat,
    geometryParams: {
      customGeometry: {
        positions: drivetrainBuf.positions,
        normals: drivetrainBuf.normals,
        uvs: drivetrainBuf.uvs,
        indices: drivetrainBuf.indices,
        colors: drivetrainBuf.colors,
      },
    },
    visible: true,
    locked: false,
  };

  const saddleAndSeatpostItem: SceneItem = {
    id: 'bicycle_saddle_seatpost',
    name: 'Bicycle - Aerodynamic Road Saddle & Seatpost',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: saddleMat,
    geometryParams: {
      customGeometry: {
        positions: saddleBuf.positions,
        normals: saddleBuf.normals,
        uvs: saddleBuf.uvs,
        indices: saddleBuf.indices,
        colors: saddleBuf.colors,
      },
    },
    visible: true,
    locked: false,
  };

  const accessoriesItem: SceneItem = {
    id: 'bicycle_accessories',
    name: 'Bicycle - Routed Control Cables & Pedal Reflectors',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: accessoriesMat,
    geometryParams: {
      customGeometry: {
        positions: accessoriesBuf.positions,
        normals: accessoriesBuf.normals,
        uvs: accessoriesBuf.uvs,
        indices: accessoriesBuf.indices,
        colors: accessoriesBuf.colors,
      },
    },
    visible: true,
    locked: false,
  };

  const allItems = [
    frameItem,
    forkCockpitItem,
    wheelsItem,
    drivetrainItem,
    saddleAndSeatpostItem,
    accessoriesItem,
  ];

  const frameVerts = frameBuf.positions.length / 3;
  const frameTris = frameBuf.indices.length / 3;
  const forkCockpitVerts = forkCockpitBuf.positions.length / 3;
  const forkCockpitTris = forkCockpitBuf.indices.length / 3;
  const wheelsVerts = wheelsBuf.positions.length / 3;
  const wheelsTris = wheelsBuf.indices.length / 3;
  const drivetrainVerts = drivetrainBuf.positions.length / 3;
  const drivetrainTris = drivetrainBuf.indices.length / 3;
  const saddleVerts = saddleBuf.positions.length / 3;
  const saddleTris = saddleBuf.indices.length / 3;
  const accessoriesVerts = accessoriesBuf.positions.length / 3;
  const accessoriesTris = accessoriesBuf.indices.length / 3;

  const totalVertices = frameVerts + forkCockpitVerts + wheelsVerts + drivetrainVerts + saddleVerts + accessoriesVerts;
  const totalTriangles = frameTris + forkCockpitTris + wheelsTris + drivetrainTris + saddleTris + accessoriesTris;

  return {
    frameItem,
    forkAndCockpitItem: forkCockpitItem,
    wheelsItem,
    drivetrainItem,
    saddleAndSeatpostItem,
    accessoriesItem,
    allItems,
    stats: {
      frameVertices: frameVerts,
      frameTriangles: frameTris,
      forkCockpitVertices: forkCockpitVerts,
      forkCockpitTriangles: forkCockpitTris,
      wheelsVertices: wheelsVerts,
      wheelsTriangles: wheelsTris,
      drivetrainVertices: drivetrainVerts,
      drivetrainTriangles: drivetrainTris,
      saddleSeatpostVertices: saddleVerts,
      saddleSeatpostTriangles: saddleTris,
      accessoriesVertices: accessoriesVerts,
      accessoriesTriangles: accessoriesTris,
      totalVertices,
      totalTriangles,
      componentsCount: allItems.length,
    },
  };
}

/**
 * Helper to offset all vertex positions in a geometry buffer relative to a local pivot point.
 */
function offsetBuffer(buf: GeometryBuffer, offset: THREE.Vector3): GeometryBuffer {
  const newPositions: number[] = new Array(buf.positions.length);
  for (let i = 0; i < buf.positions.length; i += 3) {
    newPositions[i] = buf.positions[i] - offset.x;
    newPositions[i + 1] = buf.positions[i + 1] - offset.y;
    newPositions[i + 2] = buf.positions[i + 2] - offset.z;
  }
  return {
    positions: newPositions,
    normals: [...buf.normals],
    uvs: [...buf.uvs],
    indices: [...buf.indices],
    colors: buf.colors ? [...buf.colors] : [],
  };
}

/**
 * Aerodynamic Road Racing Saddle: Solid Contoured Shell with Perineal Relief Channel
 */
function addSaddle(seatCluster: THREE.Vector3, saddleClampPos: THREE.Vector3, buf: GeometryBuffer): void {
  // Seatpost
  addCylinder(seatCluster, saddleClampPos, 0.0135, 0.0135, 14, buf, true, true, 0.88);
  // Seatpost Collar Clamp with M5 Hex pinch bolt
  addCylinder(
    new THREE.Vector3(seatCluster.x, seatCluster.y + 0.005, 0),
    new THREE.Vector3(seatCluster.x - 0.004, seatCluster.y + 0.025, 0),
    0.017, 0.017, 14, buf, true, true, 0.95
  );
  addCylinder(
    new THREE.Vector3(seatCluster.x - 0.018, seatCluster.y + 0.015, -0.010),
    new THREE.Vector3(seatCluster.x - 0.018, seatCluster.y + 0.015, 0.010),
    0.0035, 0.0035, 8, buf, true, true, 0.98
  );

  // Micro-Adjust Two-Bolt Saddle Rail Clamp
  addBox(saddleClampPos, new THREE.Vector3(0.032, 0.018, 0.038), new THREE.Euler(0, 0, 0), buf, 0.85);

  // Dual Parallel Chrome Saddle Rails (7mm standard road rails)
  for (const side of [-1, 1]) {
    const railZ = side * 0.022;
    const rStart = new THREE.Vector3(saddleClampPos.x - 0.105, saddleClampPos.y + 0.025, railZ);
    const rMid = new THREE.Vector3(saddleClampPos.x, saddleClampPos.y + 0.012, railZ);
    const rEnd = new THREE.Vector3(saddleClampPos.x + 0.095, saddleClampPos.y + 0.028, railZ);
    addSweptTube([rStart, rMid, rEnd], () => 0.0035, 8, buf, true, true, 0.98);
  }

  // Aerodynamic Road Racing Saddle Shell
  const saddleLen = 0.265;
  const saddleBaseX = saddleClampPos.x - 0.120;
  const saddleStations = 14;
  const crossPtsPerStation = 7;
  const saddleStartV = buf.positions.length / 3;

  for (let i = 0; i <= saddleStations; i++) {
    const f = i / saddleStations;
    const sx = saddleBaseX + (1.0 - f) * saddleLen;
    const sy = saddleClampPos.y + 0.035 + (f > 0.7 ? (f - 0.7) * 0.020 : Math.pow(0.7 - f, 1.8) * 0.032);
    const halfW = f > 0.6 ? 0.014 + (1.0 - f) * 0.025 : 0.024 + Math.pow(0.6 - f, 1.3) * 0.095;

    const offsets = [
      { yOff: -0.014, zOff: -halfW },
      { yOff: -0.001, zOff: -halfW * 0.82 },
      { yOff: -0.003, zOff: -halfW * 0.28 },
      { yOff: -0.010, zOff: 0.0 },
      { yOff: -0.003, zOff: halfW * 0.28 },
      { yOff: -0.001, zOff: halfW * 0.82 },
      { yOff: -0.014, zOff: halfW },
    ];

    for (let c = 0; c < crossPtsPerStation; c++) {
      const off = offsets[c];
      const px = sx;
      const py = sy + off.yOff;
      const pz = off.zOff;

      let nx = f > 0.8 ? 0.3 : (f < 0.2 ? -0.3 : 0);
      let ny = 1.0;
      let nz = off.zOff / Math.max(0.001, halfW);
      const nlen = Math.hypot(nx, ny, nz);
      nx /= nlen; ny /= nlen; nz /= nlen;

      buf.positions.push(px, py, pz);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(c / (crossPtsPerStation - 1), f * 4);
      if (buf.colors) buf.colors.push(0.20, 0.20, 0.20);
    }
  }

  for (let i = 0; i < saddleStations; i++) {
    for (let c = 0; c < crossPtsPerStation - 1; c++) {
      const a = saddleStartV + i * crossPtsPerStation + c;
      const b = saddleStartV + (i + 1) * crossPtsPerStation + c;
      const d = saddleStartV + i * crossPtsPerStation + (c + 1);
      const e = saddleStartV + (i + 1) * crossPtsPerStation + (c + 1);

      buf.indices.push(a, b, d);
      buf.indices.push(b, e, d);
    }
  }

  const nosePt = new THREE.Vector3(saddleBaseX, saddleClampPos.y + 0.038, 0);
  const noseStartRing = saddleStartV + saddleStations * crossPtsPerStation;
  const noseCenterV = buf.positions.length / 3;
  buf.positions.push(nosePt.x - 0.008, nosePt.y - 0.004, nosePt.z);
  buf.normals.push(-1, 0, 0);
  buf.uvs.push(0.5, 0.5);
  if (buf.colors) buf.colors.push(0.20, 0.20, 0.20);

  for (let c = 0; c < crossPtsPerStation - 1; c++) {
    buf.indices.push(noseCenterV, noseStartRing + c, noseStartRing + c + 1);
  }
}

/**
 * Creates a SceneItem from a GeometryBuffer.
 */
function createSceneItemFromBuffer(
  id: string,
  name: string,
  buf: GeometryBuffer,
  material: MaterialProperties,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0]
): SceneItem {
  return {
    id,
    name,
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position, rotation, scale: [1, 1, 1] },
    material,
    geometryParams: {
      customGeometry: {
        positions: buf.positions,
        normals: buf.normals,
        uvs: buf.uvs,
        indices: buf.indices,
        colors: buf.colors,
      },
    },
    visible: true,
    locked: false,
  };
}

/**
 * Generates an ultra-realistic, modular bicycle with 7 independently articulatable sub-assemblies:
 * 1. Frame Assembly (frame, saddle & seatpost, derailleur, chain, routed cables)
 * 2. Steerable Fork & Cockpit (stem, handlebars, brake levers, fork blades, steerer tube)
 * 3. Front Wheel Assembly (rim, tire, spokes, axle, disc rotor)
 * 4. Rear Wheel Assembly (rim, tire, spokes, axle, cassette cogs, disc rotor)
 * 5. Crankset (bottom bracket spindle, crank arms, 50T & 34T chainrings, spider)
 * 6. Left Pedal (spindle, pedal body, reflectors)
 * 7. Right Pedal (spindle, pedal body, reflectors)
 */
export function generateModularBicycle(options: BicycleOptions = {}): ModularBicycleResult {
  const frameColor = options.frameColor ?? '#c01525';
  const frameMatType = options.frameMaterial ?? 'gloss';
  const componentsColor = options.componentsColor ?? '#dce3eb';
  const handlebarStyle = options.handlebarStyle ?? 'drop';
  const pedalStyle = options.pedalStyle ?? 'platform';
  const wheelRadius = Math.max(0.20, options.wheelSize ?? 0.340);
  const spokeCount = Math.max(0, Math.floor((options.spokeCount ?? 32) / 2) * 2);
  const includeCables = options.includeCables ?? true;
  const includeDiscBrakes = options.includeDiscBrakes ?? true;
  const includeReflectors = options.includeReflectors ?? true;

  // Geometry buffers for modular components
  const frameBuf = createBuffer();
  const cockpitBuf = createBuffer();
  const frontWheelBuf = createBuffer();
  const rearWheelBuf = createBuffer();
  const cranksetBuf = createBuffer();
  const leftPedalBuf = createBuffer();
  const rightPedalBuf = createBuffer();

  // Key mechanical datums (ISO 4210 Proportions)
  const rearAxle = new THREE.Vector3(-0.430, wheelRadius, 0.0);
  const frontAxle = new THREE.Vector3(0.570, wheelRadius, 0.0);
  const bbCenter = new THREE.Vector3(0.000, wheelRadius - 0.060, 0.0);
  const seatCluster = new THREE.Vector3(-0.160, wheelRadius + 0.430, 0.0);
  const headTubeBottom = new THREE.Vector3(0.460, wheelRadius + 0.350, 0.0);
  const headTubeTop = new THREE.Vector3(0.415, wheelRadius + 0.545, 0.0);
  const stemClamp = new THREE.Vector3(0.408, headTubeTop.y + 0.035, 0.0);
  const handlebarCenter = new THREE.Vector3(0.505, headTubeTop.y + 0.065, 0.0);
  const crankLen = 0.1725;
  const crankAngle = -0.45;
  const rightCrankTip0 = new THREE.Vector3(
    bbCenter.x + Math.cos(crankAngle) * crankLen,
    bbCenter.y + Math.sin(crankAngle) * crankLen,
    0.075
  );
  const leftCrankAngle = crankAngle + Math.PI;
  const leftCrankTip0 = new THREE.Vector3(
    bbCenter.x + Math.cos(leftCrankAngle) * crankLen,
    bbCenter.y + Math.sin(leftCrankAngle) * crankLen,
    -0.075
  );

  // -------------------------------------------------------------
  // 1. FRAME ASSEMBLY (Frame, Seatpost, Saddle, Derailleur, Chain, Cables)
  // -------------------------------------------------------------
  // Bottom Bracket Shell
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.034),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.034),
    0.021, 0.021, 16, frameBuf
  );
  // Seat Tube
  addCylinder(bbCenter, seatCluster, 0.017, 0.015, 16, frameBuf);
  // Seat Tube extension & clamp collar
  addCylinder(
    seatCluster,
    new THREE.Vector3().copy(seatCluster).add(new THREE.Vector3(-0.007, 0.035, 0)),
    0.016, 0.016, 16, frameBuf
  );
  // Head Tube
  addCylinder(headTubeBottom, headTubeTop, 0.025, 0.023, 16, frameBuf);
  addTorus(headTubeBottom, 0.025, 0.004, 8, 16, frameBuf, 'y');
  addTorus(headTubeTop, 0.023, 0.004, 8, 16, frameBuf, 'y');
  // Top Tube
  addCylinder(seatCluster, headTubeTop, 0.018, 0.019, 16, frameBuf);
  // Down Tube
  const dtSteps = 8;
  const dtPath: THREE.Vector3[] = [];
  for (let i = 0; i <= dtSteps; i++) {
    const f = i / dtSteps;
    const pt = new THREE.Vector3().lerpVectors(bbCenter, headTubeBottom, f);
    pt.y += Math.sin(f * Math.PI) * 0.008;
    dtPath.push(pt);
  }
  addSweptTube(dtPath, (t) => 0.022 + 0.006 * Math.sin(t * Math.PI), 14, frameBuf);
  // Dual Chainstays
  for (const side of [-1, 1]) {
    const startPt = new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.030);
    const midPt = new THREE.Vector3(-0.210, bbCenter.y + 0.025, side * 0.045);
    const endPt = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.065);
    addSweptTube([startPt, midPt, endPt], (t) => 0.014 - 0.004 * t, 12, frameBuf);
  }
  // Dual Seatstays
  for (const side of [-1, 1]) {
    const startPt = new THREE.Vector3(seatCluster.x, seatCluster.y - 0.015, side * 0.018);
    const endPt = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.065);
    addCylinder(startPt, endPt, 0.011, 0.008, 12, frameBuf);
  }
  // Seatstay Bridge
  const bridgeY = (seatCluster.y + rearAxle.y) * 0.48;
  addCylinder(
    new THREE.Vector3(-0.355, bridgeY, -0.032),
    new THREE.Vector3(-0.355, bridgeY, 0.032),
    0.006, 0.006, 10, frameBuf
  );
  // Rear Dropouts & Derailleur Hanger
  for (const side of [-1, 1]) {
    const dropCenter = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.066);
    addBox(dropCenter, new THREE.Vector3(0.042, 0.032, 0.006), new THREE.Euler(0, 0, -0.2), frameBuf, 0.85);
    if (side === 1) {
      const hangerPos = new THREE.Vector3(rearAxle.x + 0.008, rearAxle.y - 0.028, 0.068);
      addBox(hangerPos, new THREE.Vector3(0.016, 0.030, 0.005), new THREE.Euler(0, 0, 0.15), frameBuf, 0.80);
    }
  }
  // Bottle Cage Bolts
  for (const offset of [0.15, 0.26]) {
    const pt = new THREE.Vector3().lerpVectors(bbCenter, headTubeBottom, offset);
    pt.y += 0.022;
    addCylinder(pt, new THREE.Vector3(pt.x - 0.003, pt.y + 0.006, pt.z), 0.004, 0.004, 8, frameBuf, true, true, 0.95);
  }
  // Saddle & Seatpost
  const saddleClampPos = new THREE.Vector3(seatCluster.x - 0.035, seatCluster.y + 0.125, 0.0);
  addSaddle(seatCluster, saddleClampPos, frameBuf);

  // Rear Derailleur Assembly
  const derailleurHanger = new THREE.Vector3(rearAxle.x + 0.008, rearAxle.y - 0.038, 0.068);
  const upperJockey = new THREE.Vector3(rearAxle.x + 0.025, rearAxle.y - 0.065, 0.045);
  const lowerJockey = new THREE.Vector3(rearAxle.x + 0.060, rearAxle.y - 0.125, 0.045);
  addCylinder(derailleurHanger, upperJockey, 0.009, 0.007, 10, frameBuf, true, true, 0.30);
  addCylinder(upperJockey, lowerJockey, 0.008, 0.008, 8, frameBuf, true, true, 0.25);
  addGearWheel(upperJockey, 11, 0.022, 0.004, 0.006, frameBuf, 'z', 0.20);
  addGearWheel(lowerJockey, 11, 0.022, 0.004, 0.006, frameBuf, 'z', 0.20);
  addCylinder(new THREE.Vector3(upperJockey.x, upperJockey.y, 0.038), new THREE.Vector3(upperJockey.x, upperJockey.y, 0.052), 0.004, 0.004, 8, frameBuf, true, true, 0.98);
  addCylinder(new THREE.Vector3(lowerJockey.x, lowerJockey.y, 0.038), new THREE.Vector3(lowerJockey.x, lowerJockey.y, 0.052), 0.004, 0.004, 8, frameBuf, true, true, 0.98);

  // Continuous Closed Roller Chain
  const chainPath: THREE.Vector3[] = [];
  const middleCogPitchR = (17 / 50) * 0.101;
  const chainZ = 0.045;
  const frontTop = new THREE.Vector3(bbCenter.x, bbCenter.y + 0.101, chainZ);
  const rearTop = new THREE.Vector3(rearAxle.x, rearAxle.y + middleCogPitchR, chainZ);
  for (let i = 0; i < 16; i++) {
    chainPath.push(new THREE.Vector3().lerpVectors(frontTop, rearTop, i / 16));
  }
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI * 0.5 + (i / 8) * Math.PI * 0.6;
    chainPath.push(new THREE.Vector3(
      rearAxle.x + Math.cos(angle) * middleCogPitchR,
      rearAxle.y + Math.sin(angle) * middleCogPitchR,
      chainZ
    ));
  }
  chainPath.push(new THREE.Vector3(upperJockey.x + 0.015, upperJockey.y + 0.018, chainZ));
  chainPath.push(new THREE.Vector3(upperJockey.x - 0.015, upperJockey.y, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x - 0.015, lowerJockey.y, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x, lowerJockey.y - 0.022, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x + 0.018, lowerJockey.y - 0.018, chainZ));
  const frontBottom = new THREE.Vector3(bbCenter.x, bbCenter.y - 0.101, chainZ);
  const lastDerailleurPt = chainPath[chainPath.length - 1];
  for (let i = 1; i < 16; i++) {
    chainPath.push(new THREE.Vector3().lerpVectors(lastDerailleurPt, frontBottom, i / 16));
  }
  for (let i = 0; i < 12; i++) {
    const angle = -Math.PI * 0.5 + (i / 12) * Math.PI;
    chainPath.push(new THREE.Vector3(
      bbCenter.x + Math.cos(angle) * 0.101,
      bbCenter.y + Math.sin(angle) * 0.101,
      chainZ
    ));
  }
  for (let i = 0; i < chainPath.length; i++) {
    const ptA = chainPath[i];
    const ptB = chainPath[(i + 1) % chainPath.length];
    const isOuter = i % 2 === 0;
    if (ptA.distanceTo(ptB) > 0.001) {
      addCylinder(ptA, ptB, 0.0042, 0.0042, 6, frameBuf, true, true, 0.88);
      const plateZOffset = isOuter ? 0.0035 : 0.0024;
      for (const pSign of [-1, 1]) {
        const plateA = new THREE.Vector3(ptA.x, ptA.y, chainZ + pSign * plateZOffset);
        const plateB = new THREE.Vector3(ptB.x, ptB.y, chainZ + pSign * plateZOffset);
        addCylinder(plateA, plateB, 0.0048, 0.0048, 6, frameBuf, true, true, isOuter ? 0.98 : 0.85);
      }
      addCylinder(
        new THREE.Vector3(ptA.x, ptA.y, chainZ - 0.0045),
        new THREE.Vector3(ptA.x, ptA.y, chainZ + 0.0045),
        0.0022, 0.0022, 6, frameBuf, true, true, 0.95
      );
    }
  }

  // Frame Routed Control Cables
  if (includeCables) {
    const rb1 = new THREE.Vector3(headTubeTop.x + 0.020, headTubeTop.y - 0.040, -0.024);
    const rb2 = new THREE.Vector3(seatCluster.x + 0.030, seatCluster.y - 0.010, -0.022);
    const rb3 = new THREE.Vector3(rearAxle.x + 0.080, rearAxle.y + 0.120, -0.028);
    const rb4 = new THREE.Vector3(rearAxle.x + 0.050, rearAxle.y + 0.065, -0.032);
    addSweptTube([rb1, rb2, rb3, rb4], () => 0.0025, 8, frameBuf, true, true, 0.18);

    const rs1 = new THREE.Vector3(headTubeTop.x + 0.025, headTubeTop.y - 0.050, 0.024);
    const rs2 = new THREE.Vector3(bbCenter.x + 0.030, bbCenter.y + 0.025, 0.035);
    const rs3 = new THREE.Vector3(rearAxle.x + 0.035, rearAxle.y - 0.035, 0.065);
    addSweptTube([rs1, rs2, rs3], () => 0.0025, 8, frameBuf, true, true, 0.18);
  }

  // -------------------------------------------------------------
  // 2. STEERABLE FORK & COCKPIT ASSEMBLY
  // -------------------------------------------------------------
  addCylinder(headTubeTop, stemClamp, 0.014, 0.014, 14, cockpitBuf, true, true, 0.2);
  addCylinder(
    stemClamp,
    new THREE.Vector3(stemClamp.x - 0.002, stemClamp.y + 0.008, stemClamp.z),
    0.016, 0.016, 14, cockpitBuf, true, true, 0.9
  );
  const forkCrown = new THREE.Vector3(headTubeBottom.x + 0.005, headTubeBottom.y - 0.018, 0);
  addCylinder(
    new THREE.Vector3(forkCrown.x, forkCrown.y, -0.028),
    new THREE.Vector3(forkCrown.x, forkCrown.y, 0.028),
    0.016, 0.016, 12, cockpitBuf, true, true, 0.85
  );
  for (const side of [-1, 1]) {
    const bladeStart = new THREE.Vector3(forkCrown.x, forkCrown.y, side * 0.024);
    const bladeMid = new THREE.Vector3(0.525, wheelRadius + 0.150, side * 0.038);
    const bladeEnd = new THREE.Vector3(frontAxle.x, frontAxle.y, side * 0.052);
    addSweptTube([bladeStart, bladeMid, bladeEnd], (t) => 0.016 - 0.007 * t, 12, cockpitBuf);
    addBox(bladeEnd, new THREE.Vector3(0.030, 0.024, 0.006), new THREE.Euler(0, 0, 0.35), cockpitBuf, 0.85);
  }
  addCylinder(stemClamp, handlebarCenter, 0.018, 0.016, 14, cockpitBuf, true, true, 0.88);
  addCylinder(
    new THREE.Vector3(stemClamp.x, stemClamp.y - 0.012, 0),
    new THREE.Vector3(stemClamp.x, stemClamp.y + 0.012, 0),
    0.019, 0.019, 14, cockpitBuf, true, true, 0.90
  );
  addCylinder(
    new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, -0.022),
    new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0.022),
    0.019, 0.019, 14, cockpitBuf, true, true, 0.92
  );
  for (const dx of [-0.008, 0.008]) {
    for (const dz of [-0.014, 0.014]) {
      const boltPt = new THREE.Vector3(handlebarCenter.x + 0.018, handlebarCenter.y + dx, dz);
      addCylinder(boltPt, new THREE.Vector3(boltPt.x + 0.004, boltPt.y, boltPt.z), 0.003, 0.003, 8, cockpitBuf, true, true, 0.98);
    }
  }
  if (handlebarStyle === 'flat') {
    const flatBarHalf = 0.330;
    for (const side of [-1, 1]) {
      const sign = side;
      const b0 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0);
      const b1 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, sign * 0.050);
      const b2 = new THREE.Vector3(handlebarCenter.x - 0.015, handlebarCenter.y + 0.012, sign * 0.180);
      const b3 = new THREE.Vector3(handlebarCenter.x - 0.035, handlebarCenter.y + 0.015, sign * flatBarHalf);
      addSweptTube([b0, b1, b2, b3], () => 0.011, 12, cockpitBuf, false, true, 0.90);
      const gripStart = new THREE.Vector3(handlebarCenter.x - 0.022, handlebarCenter.y + 0.014, sign * (flatBarHalf - 0.130));
      addCylinder(gripStart, b3, 0.015, 0.015, 12, cockpitBuf, true, true, 0.12);
      addCylinder(gripStart, new THREE.Vector3().lerpVectors(gripStart, b3, 0.06), 0.016, 0.016, 12, cockpitBuf, true, true, 0.85);
      addCylinder(new THREE.Vector3().lerpVectors(b3, gripStart, 0.06), b3, 0.016, 0.016, 12, cockpitBuf, true, true, 0.85);
      const leverClampPos = new THREE.Vector3(handlebarCenter.x - 0.020, handlebarCenter.y + 0.013, sign * (flatBarHalf - 0.145));
      addCylinder(
        new THREE.Vector3(leverClampPos.x, leverClampPos.y, leverClampPos.z - 0.008),
        new THREE.Vector3(leverClampPos.x, leverClampPos.y, leverClampPos.z + 0.008),
        0.014, 0.014, 10, cockpitBuf, true, true, 0.80
      );
      const leverTip = new THREE.Vector3(leverClampPos.x + 0.065, leverClampPos.y - 0.020, sign * (flatBarHalf - 0.125));
      addCylinder(leverClampPos, leverTip, 0.006, 0.004, 8, cockpitBuf, true, true, 0.95);
    }
  } else {
    const barWidth = 0.420;
    const halfBar = barWidth * 0.5;
    for (const side of [-1, 1]) {
      const sign = side;
      const p0 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0);
      const p1 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, sign * 0.120);
      const p2 = new THREE.Vector3(handlebarCenter.x + 0.025, handlebarCenter.y, sign * (halfBar - 0.025));
      const p3 = new THREE.Vector3(handlebarCenter.x + 0.075, handlebarCenter.y - 0.020, sign * halfBar);
      const p4 = new THREE.Vector3(handlebarCenter.x + 0.065, handlebarCenter.y - 0.090, sign * halfBar);
      const p5 = new THREE.Vector3(handlebarCenter.x - 0.035, handlebarCenter.y - 0.125, sign * halfBar);
      addSweptTube([p0, p1, p2, p3, p4, p5], () => 0.0125, 12, cockpitBuf, false, true, 0.15);
      addCylinder(p5, new THREE.Vector3(p5.x - 0.008, p5.y, p5.z), 0.011, 0.011, 10, cockpitBuf, true, true, 0.85);
      const hoodBase = new THREE.Vector3(p3.x - 0.010, p3.y + 0.015, sign * halfBar);
      const hoodNose = new THREE.Vector3(p3.x + 0.055, p3.y + 0.030, sign * halfBar);
      addCylinder(hoodBase, hoodNose, 0.018, 0.014, 10, cockpitBuf, true, true, 0.12);
      const leverPivot = new THREE.Vector3(hoodNose.x - 0.015, hoodNose.y - 0.010, sign * (halfBar + 0.006 * sign));
      const leverTip = new THREE.Vector3(leverPivot.x - 0.025, leverPivot.y - 0.095, leverPivot.z);
      addCylinder(leverPivot, leverTip, 0.007, 0.004, 10, cockpitBuf, true, true, 0.95);
    }
  }

  // -------------------------------------------------------------
  // 3. WHEELS (FRONT & REAR)
  // -------------------------------------------------------------
  const rimRadius = wheelRadius - 0.028;
  const tireCrossRad = 0.020;

  const buildSingleWheel = (center: THREE.Vector3, isRear: boolean, targetBuf: GeometryBuffer) => {
    addTorus(center, rimRadius + tireCrossRad * 0.9, tireCrossRad, 14, 48, targetBuf, 'z', 1.0, true);
    addAeroRim(center, rimRadius, 0.045, 0.025, 0.014, 48, targetBuf, 0.16);
    const valveBase = new THREE.Vector3(center.x, center.y + rimRadius - 0.012, center.z);
    const valveTip = new THREE.Vector3(center.x, center.y + rimRadius - 0.052, center.z);
    addCylinder(valveBase, valveTip, 0.003, 0.003, 8, targetBuf, true, true, 0.90);
    addCylinder(valveTip, new THREE.Vector3(center.x, center.y + rimRadius - 0.062, center.z), 0.0035, 0.0035, 8, targetBuf, true, true, 0.85);

    const flangeOffset = isRear ? 0.028 : 0.035;
    const hubShellRad = 0.016;
    const flangeRad = 0.032;

    addCylinder(
      new THREE.Vector3(center.x, center.y, -flangeOffset),
      new THREE.Vector3(center.x, center.y, flangeOffset),
      hubShellRad, hubShellRad, 16, targetBuf, true, true, 0.92
    );

    for (const side of [-1, 1]) {
      const flgZ = side * (isRear && side === 1 ? flangeOffset * 0.75 : flangeOffset);
      addCylinder(
        new THREE.Vector3(center.x, center.y, flgZ - 0.002),
        new THREE.Vector3(center.x, center.y, flgZ + 0.002),
        flangeRad, flangeRad, 16, targetBuf, true, true, 0.95
      );
    }

    addCylinder(
      new THREE.Vector3(center.x, center.y, -0.068),
      new THREE.Vector3(center.x, center.y, 0.068),
      0.007, 0.007, 12, targetBuf, true, true, 0.88
    );

    for (let s = 0; s < spokeCount; s++) {
      const isRightFlange = s % 2 === 0;
      const flgSign = isRightFlange ? 1 : -1;
      const flgZ = flgSign * (isRear && isRightFlange ? flangeOffset * 0.75 : flangeOffset);
      const isCrossPush = Math.floor(s / 2) % 2 === 0;
      const tangentOffset = isCrossPush ? 0.22 : -0.22;
      const spokeFrac = s / spokeCount;
      const rimAngle = spokeFrac * Math.PI * 2;
      const hubAngle = rimAngle + tangentOffset;

      const hubPt = new THREE.Vector3(
        center.x + Math.cos(hubAngle) * (flangeRad - 0.003),
        center.y + Math.sin(hubAngle) * (flangeRad - 0.003),
        flgZ
      );
      const rimPt = new THREE.Vector3(
        center.x + Math.cos(rimAngle) * (rimRadius - 0.040),
        center.y + Math.sin(rimAngle) * (rimRadius - 0.040),
        flgSign * 0.003
      );
      addCylinder(hubPt, rimPt, 0.0009, 0.0009, 6, targetBuf, false, false, 0.98);
      const nippleBase = new THREE.Vector3().lerpVectors(rimPt, hubPt, 0.035);
      addCylinder(rimPt, nippleBase, 0.0022, 0.0022, 6, targetBuf, true, true, 0.85);
    }

    if (includeDiscBrakes) {
      const rotorZ = -0.028;
      const rotorCenter = new THREE.Vector3(center.x, center.y, rotorZ);
      addDiscBrakeRotor(rotorCenter, 0.080, targetBuf, 0.95);
    }
  };

  buildSingleWheel(frontAxle, false, frontWheelBuf);
  buildSingleWheel(rearAxle, true, rearWheelBuf);

  // 11-Speed Cassette Cogs & Lockring on Rear Wheel
  const cassetteCogs = [28, 25, 23, 21, 19, 17, 15, 14, 13, 12, 11];
  const cogStartZ = 0.024;
  const cogSpacing = 0.0038;
  for (let c = 0; c < cassetteCogs.length; c++) {
    const toothNum = cassetteCogs[c];
    const pitchR = (toothNum / 50) * 0.101;
    const cogZ = cogStartZ + c * cogSpacing;
    addGearWheel(new THREE.Vector3(rearAxle.x, rearAxle.y, cogZ), toothNum, pitchR, 0.002, 0.018, rearWheelBuf, 'z', 0.95);
  }
  const lockringZ = cogStartZ + cassetteCogs.length * cogSpacing;
  addCylinder(
    new THREE.Vector3(rearAxle.x, rearAxle.y, lockringZ),
    new THREE.Vector3(rearAxle.x, rearAxle.y, lockringZ + 0.003),
    0.018, 0.018, 16, rearWheelBuf, true, true, 0.88
  );

  // -------------------------------------------------------------
  // 4. CRANKSET ASSEMBLY
  // -------------------------------------------------------------
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.075),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.075),
    0.012, 0.012, 14, cranksetBuf, true, true, 0.92
  );
  for (const side of [-1, 1]) {
    addCylinder(
      new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.034),
      new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.045),
      0.022, 0.022, 16, cranksetBuf, true, true, 0.80
    );
  }
  // Right Drive Crank
  const rightCrankBase = new THREE.Vector3(bbCenter.x, bbCenter.y, 0.070);
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.060),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.078),
    0.020, 0.020, 14, cranksetBuf, true, true, 0.94
  );
  addCylinder(rightCrankBase, rightCrankTip0, 0.018, 0.013, 12, cranksetBuf, true, true, 0.95);
  addCylinder(
    new THREE.Vector3(rightCrankTip0.x, rightCrankTip0.y, 0.068),
    new THREE.Vector3(rightCrankTip0.x, rightCrankTip0.y, 0.082),
    0.015, 0.015, 12, cranksetBuf, true, true, 0.92
  );
  // Left Non-Drive Crank
  const leftCrankBase = new THREE.Vector3(bbCenter.x, bbCenter.y, -0.070);
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.078),
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.060),
    0.020, 0.020, 14, cranksetBuf, true, true, 0.94
  );
  addCylinder(leftCrankBase, leftCrankTip0, 0.018, 0.013, 12, cranksetBuf, true, true, 0.95);
  addCylinder(
    new THREE.Vector3(leftCrankTip0.x, leftCrankTip0.y, -0.082),
    new THREE.Vector3(leftCrankTip0.x, leftCrankTip0.y, -0.068),
    0.015, 0.015, 12, cranksetBuf, true, true, 0.92
  );
  // 4-Arm Chainring Spider
  for (let a = 0; a < 4; a++) {
    const spiderAngle = crankAngle + (a / 4) * Math.PI * 2;
    const spEnd = new THREE.Vector3(
      bbCenter.x + Math.cos(spiderAngle) * 0.065,
      bbCenter.y + Math.sin(spiderAngle) * 0.065,
      0.048
    );
    addCylinder(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.052), spEnd, 0.010, 0.007, 8, cranksetBuf, true, true, 0.92);
    addCylinder(spEnd, new THREE.Vector3(spEnd.x, spEnd.y, 0.042), 0.005, 0.005, 8, cranksetBuf, true, true, 0.85);
  }
  // Double Chainrings: Outer 50T and Inner 34T
  addGearWheel(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.048), 50, 0.101, 0.003, 0.060, cranksetBuf, 'z', 0.96);
  addGearWheel(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.041), 34, 0.069, 0.003, 0.040, cranksetBuf, 'z', 0.92);

  // -------------------------------------------------------------
  // 5. PEDALS (LEFT & RIGHT)
  // -------------------------------------------------------------
  const buildSinglePedal = (tip: THREE.Vector3, sign: number, targetBuf: GeometryBuffer) => {
    const axleStart = tip;
    const axleEnd = new THREE.Vector3(axleStart.x, axleStart.y, axleStart.z + sign * 0.075);
    addCylinder(axleStart, axleEnd, 0.006, 0.006, 10, targetBuf, true, true, 0.95);
    const bodyCenter = new THREE.Vector3().lerpVectors(axleStart, axleEnd, 0.65);

    if (pedalStyle === 'clipless') {
      addBox(bodyCenter, new THREE.Vector3(0.065, 0.015, 0.048), new THREE.Euler(0, 0, 0), targetBuf, 0.25);
      addBox(
        new THREE.Vector3(bodyCenter.x, bodyCenter.y + 0.008, bodyCenter.z),
        new THREE.Vector3(0.040, 0.002, 0.036),
        new THREE.Euler(0, 0, 0),
        targetBuf,
        0.95
      );
      const clawPos = new THREE.Vector3(bodyCenter.x - 0.028, bodyCenter.y + 0.010, bodyCenter.z);
      addBox(clawPos, new THREE.Vector3(0.014, 0.018, 0.040), new THREE.Euler(0, 0, 0.2), targetBuf, 0.40);
      addCylinder(
        new THREE.Vector3(clawPos.x - 0.006, clawPos.y, clawPos.z),
        new THREE.Vector3(clawPos.x - 0.012, clawPos.y, clawPos.z),
        0.003, 0.003, 8, targetBuf, true, true, 0.98
      );
    } else {
      addBox(bodyCenter, new THREE.Vector3(0.082, 0.016, 0.065), new THREE.Euler(0, 0, 0), targetBuf, 0.35);
      if (includeReflectors) {
        for (const fwd of [-1, 1]) {
          const refPos = new THREE.Vector3(bodyCenter.x + fwd * 0.043, bodyCenter.y, bodyCenter.z);
          addBox(refPos, new THREE.Vector3(0.006, 0.012, 0.042), new THREE.Euler(0, 0, 0), targetBuf, 0.98);
        }
      }
    }
  };

  buildSinglePedal(leftCrankTip0, -1, leftPedalBuf);
  buildSinglePedal(rightCrankTip0, 1, rightPedalBuf);

  // -------------------------------------------------------------
  // Offset Modular Buffers Relative to Their Component Pivot Datums
  // -------------------------------------------------------------
  const localizedCockpitBuf = offsetBuffer(cockpitBuf, headTubeBottom);
  const localizedFrontWheelBuf = offsetBuffer(frontWheelBuf, frontAxle);
  const localizedRearWheelBuf = offsetBuffer(rearWheelBuf, rearAxle);
  const localizedCranksetBuf = offsetBuffer(cranksetBuf, bbCenter);
  const localizedLeftPedalBuf = offsetBuffer(leftPedalBuf, leftCrankTip0);
  const localizedRightPedalBuf = offsetBuffer(rightPedalBuf, rightCrankTip0);

  // Materials
  const frameMat: MaterialProperties = {
    color: frameColor,
    roughness: frameMatType === 'gloss' ? 0.18 : (frameMatType === 'matte' ? 0.70 : 0.40),
    metalness: frameMatType === 'carbon' ? 0.10 : 0.35,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: frameMatType === 'carbon' ? 'carbon_fiber' : 'none',
  };

  const cockpitMat: MaterialProperties = {
    color: componentsColor,
    roughness: 0.32,
    metalness: 0.75,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'brushed_metal',
  };

  const wheelsMat: MaterialProperties = {
    color: '#1a1f26',
    roughness: 0.65,
    metalness: 0.20,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'tire_tread',
  };

  const drivetrainMat: MaterialProperties = {
    color: '#e2e8f0',
    roughness: 0.28,
    metalness: 0.88,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'brushed_metal',
  };

  const pedalMat: MaterialProperties = {
    color: '#2a2f38',
    roughness: 0.45,
    metalness: 0.60,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: includeReflectors ? 'reflector_amber' : 'brushed_metal',
  };

  // Construct Modular SceneItems with local pivots
  const frameItem = createSceneItemFromBuffer(
    'bicycle_frame',
    'Bicycle - Diamond Road Frame, Seating & Fixed Drivetrain',
    frameBuf,
    frameMat,
    [0, 0, 0]
  );

  const cockpitItem = createSceneItemFromBuffer(
    'bicycle_cockpit',
    handlebarStyle === 'flat' ? 'Bicycle - Steerable Cockpit & Flat Handlebars' : 'Bicycle - Steerable Cockpit & Drop Handlebars',
    localizedCockpitBuf,
    cockpitMat,
    [headTubeBottom.x, headTubeBottom.y, headTubeBottom.z]
  );

  const frontWheelItem = createSceneItemFromBuffer(
    'bicycle_front_wheel',
    'Bicycle - Front Wheel Assembly (Rim, Tire, Spokes & Rotor)',
    localizedFrontWheelBuf,
    wheelsMat,
    [frontAxle.x, frontAxle.y, frontAxle.z]
  );

  const rearWheelItem = createSceneItemFromBuffer(
    'bicycle_rear_wheel',
    'Bicycle - Rear Wheel Assembly (Rim, Tire, Spokes, Cassette & Rotor)',
    localizedRearWheelBuf,
    wheelsMat,
    [rearAxle.x, rearAxle.y, rearAxle.z]
  );

  const cranksetItem = createSceneItemFromBuffer(
    'bicycle_crankset',
    'Bicycle - Crankset (Spindle, Cranks, Spider & Dual Chainrings)',
    localizedCranksetBuf,
    drivetrainMat,
    [bbCenter.x, bbCenter.y, bbCenter.z]
  );

  const leftPedalItem = createSceneItemFromBuffer(
    'bicycle_left_pedal',
    'Bicycle - Left Pedal Assembly',
    localizedLeftPedalBuf,
    pedalMat,
    [leftCrankTip0.x, leftCrankTip0.y, leftCrankTip0.z]
  );

  const rightPedalItem = createSceneItemFromBuffer(
    'bicycle_right_pedal',
    'Bicycle - Right Pedal Assembly',
    localizedRightPedalBuf,
    pedalMat,
    [rightCrankTip0.x, rightCrankTip0.y, rightCrankTip0.z]
  );

  const allItems = [
    frameItem,
    cockpitItem,
    frontWheelItem,
    rearWheelItem,
    cranksetItem,
    leftPedalItem,
    rightPedalItem,
  ];

  const frameTris = frameBuf.indices.length / 3;
  const cockpitTris = cockpitBuf.indices.length / 3;
  const frontWheelTris = frontWheelBuf.indices.length / 3;
  const rearWheelTris = rearWheelBuf.indices.length / 3;
  const cranksetTris = cranksetBuf.indices.length / 3;
  const pedalsTris = (leftPedalBuf.indices.length + rightPedalBuf.indices.length) / 3;
  const totalTris = frameTris + cockpitTris + frontWheelTris + rearWheelTris + cranksetTris + pedalsTris;

  const totalVerts =
    (frameBuf.positions.length +
      cockpitBuf.positions.length +
      frontWheelBuf.positions.length +
      rearWheelBuf.positions.length +
      cranksetBuf.positions.length +
      leftPedalBuf.positions.length +
      rightPedalBuf.positions.length) /
    3;

  return {
    frameItem,
    cockpitItem,
    frontWheelItem,
    rearWheelItem,
    cranksetItem,
    leftPedalItem,
    rightPedalItem,
    allItems,
    stats: {
      frameTriangles: frameTris,
      cockpitTriangles: cockpitTris,
      frontWheelTriangles: frontWheelTris,
      rearWheelTriangles: rearWheelTris,
      cranksetTriangles: cranksetTris,
      pedalsTriangles: pedalsTris,
      totalTriangles: totalTris,
      totalVertices: totalVerts,
      componentsCount: allItems.length,
    },
  };
}

/**
 * Generates an end-to-end, physically animated bicycle simulation traversing a closed-circuit
 * racetrack loop with synchronized pedaling, wheel rotation, inward lean, handlebar steering,
 * pedaling cadence sway, and road micro-vibration.
 */
export function generateAnimatedBicycleCircuit(
  options: BicycleOptions & ClosedCircuitOptions = {}
): BicycleCircuitResult {
  const modularBicycle = generateModularBicycle(options);
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

  // Steering axis unit vector (fork rake angle ~13° from vertical)
  const steerAxis = new THREE.Vector3().subVectors(headTubeTop, headTubeBottom).normalize();
  const frontAxleRelSteer = new THREE.Vector3().subVectors(frontAxle, headTubeBottom);

  // Animation Tracks for 7 modular components
  const frameKeyframes: Keyframe[] = [];
  const cockpitKeyframes: Keyframe[] = [];
  const frontWheelKeyframes: Keyframe[] = [];
  const rearWheelKeyframes: Keyframe[] = [];
  const cranksetKeyframes: Keyframe[] = [];
  const leftPedalKeyframes: Keyframe[] = [];
  const rightPedalKeyframes: Keyframe[] = [];

  for (const pt of trajectory) {
    const f = pt.frame;

    // Bicycle Frame World Transform
    const P_frame = new THREE.Vector3(pt.position[0], pt.position[1], pt.position[2]);
    const rollAngle = pt.leanAngle + pt.swayRoll;
    const yawAngle = pt.heading;
    const pitchAngle = pt.jitterPitch;

    // Orientation quaternion for frame: Yaw -> Roll (lean/sway) -> Pitch
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

    // 1. Cockpit: Fork & Handlebars steer into the turn
    const P_cockpit = new THREE.Vector3()
      .copy(headTubeBottom)
      .applyQuaternion(Q_frame)
      .add(P_frame);

    cockpitKeyframes.push({
      frame: f,
      transform: {
        position: [P_cockpit.x, P_cockpit.y, P_cockpit.z],
        rotation: [rollAngle, yawAngle + pt.steeringAngle, pitchAngle],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 2. Front Wheel: Steers with fork, spins along axle
    const Q_steer = new THREE.Quaternion().setFromAxisAngle(steerAxis, pt.steeringAngle);
    const steeredFrontAxleOffset = frontAxleRelSteer.clone().applyQuaternion(Q_steer);
    const r_front_frame = headTubeBottom.clone().add(steeredFrontAxleOffset);
    const P_frontWheel = r_front_frame.applyQuaternion(Q_frame).add(P_frame);

    frontWheelKeyframes.push({
      frame: f,
      transform: {
        position: [P_frontWheel.x, P_frontWheel.y, P_frontWheel.z],
        rotation: [rollAngle, yawAngle + pt.steeringAngle, pt.wheelRotation],
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 3. Rear Wheel: Aligned with frame, spins along axle
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

    // 5. Right Pedal: Follows right crank arm tip, stays level under gravity
    const curRightCrankAngle = crankAngle + pt.crankRotation;
    const r_rightPedal_frame = new THREE.Vector3(
      bbCenter.x + Math.cos(curRightCrankAngle) * crankLen,
      bbCenter.y + Math.sin(curRightCrankAngle) * crankLen,
      0.075
    );
    const P_rightPedal = r_rightPedal_frame.applyQuaternion(Q_frame).add(P_frame);

    rightPedalKeyframes.push({
      frame: f,
      transform: {
        position: [P_rightPedal.x, P_rightPedal.y, P_rightPedal.z],
        rotation: [rollAngle, yawAngle, 0], // Counter-rotates to stay level!
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });

    // 6. Left Pedal: Follows left crank arm tip (180° opposite), stays level under gravity
    const curLeftCrankAngle = crankAngle + Math.PI + pt.crankRotation;
    const r_leftPedal_frame = new THREE.Vector3(
      bbCenter.x + Math.cos(curLeftCrankAngle) * crankLen,
      bbCenter.y + Math.sin(curLeftCrankAngle) * crankLen,
      -0.075
    );
    const P_leftPedal = r_leftPedal_frame.applyQuaternion(Q_frame).add(P_frame);

    leftPedalKeyframes.push({
      frame: f,
      transform: {
        position: [P_leftPedal.x, P_leftPedal.y, P_leftPedal.z],
        rotation: [rollAngle, yawAngle, 0], // Counter-rotates to stay level!
        scale: [1, 1, 1],
      },
      interpolation: 'linear',
    });
  }

  const tracks: AnimationTrack[] = [
    { objectId: modularBicycle.frameItem.id, keyframes: frameKeyframes },
    { objectId: modularBicycle.cockpitItem.id, keyframes: cockpitKeyframes },
    { objectId: modularBicycle.frontWheelItem.id, keyframes: frontWheelKeyframes },
    { objectId: modularBicycle.rearWheelItem.id, keyframes: rearWheelKeyframes },
    { objectId: modularBicycle.cranksetItem.id, keyframes: cranksetKeyframes },
    { objectId: modularBicycle.leftPedalItem.id, keyframes: leftPedalKeyframes },
    { objectId: modularBicycle.rightPedalItem.id, keyframes: rightPedalKeyframes },
  ];

  return {
    modularBicycle,
    items: modularBicycle.allItems,
    tracks,
    trajectory,
    totalFrames,
    fps,
  };
}
