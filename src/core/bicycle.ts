import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';

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

  // 6 faces: normal, u-axis, v-axis
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
    curN.sub(new THREE.Vector3().copy(curT).multiplyScalar(curN.dot(curT))).normalize();
    normals.push(curN);
    binormals.push(new THREE.Vector3().crossVectors(curT, curN).normalize());
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

  // Bore hole rings front and back
  const boreSteps = Math.min(24, toothCount * 2);
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

  // Front face quads connecting outer teeth to bore
  const stride = steps + 1;
  for (let i = 0; i < steps; i++) {
    const bIdx = Math.floor((i / steps) * boreSteps);
    const bNext = (bIdx + 1) % (boreSteps + 1);

    // Front face
    buf.indices.push(startV + i, startV + i + 1, boreStartV + bIdx);
    buf.indices.push(startV + i + 1, boreStartV + bNext, boreStartV + bIdx);

    // Back face (reverse winding)
    const backOuter = startV + stride;
    const backBore = boreStartV + (boreSteps + 1);
    buf.indices.push(backOuter + i + 1, backOuter + i, backBore + bIdx);
    buf.indices.push(backBore + bNext, backOuter + i + 1, backBore + bIdx);
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
}

/**
 * Appends a torus/ring (used for rims, tires, headset bearing races).
 */
function addTorus(
  center: THREE.Vector3,
  radius: number,
  tubeRadius: number,
  radialSeg: number,
  tubularSeg: number,
  buf: GeometryBuffer,
  normalAxis: 'x' | 'y' | 'z' = 'z',
  tint: number = 1.0
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
      buf.uvs.push(i / tubularSeg, j / radialSeg);
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
 * Generates an ultra-realistic, mechanically precise 3D model of a bicycle.
 * Contains diamond frame, aero fork, cockpit, laced wheels, 11-speed drivetrain,
 * saddle & seatpost, and realistic routed control cables.
 */
export function generateRealisticBicycle(options: BicycleOptions = {}): BicycleResult {
  const frameColor = options.frameColor ?? '#c01525'; // Classic racing carmine red
  const frameMatType = options.frameMaterial ?? 'gloss';
  const componentsColor = options.componentsColor ?? '#dce3eb';
  const spokeCount = options.spokeCount ?? 32;
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
  const wheelRadius = 0.340; // 700x28c wheel outer radius touches ground at y = 0
  const rearAxle = new THREE.Vector3(-0.430, wheelRadius, 0.0);
  const frontAxle = new THREE.Vector3(0.570, wheelRadius, 0.0); // 1.00m wheelbase
  const bbCenter = new THREE.Vector3(0.000, 0.280, 0.0); // 60mm BB drop
  const seatCluster = new THREE.Vector3(-0.160, 0.770, 0.0); // 73.5° seat tube angle
  const headTubeBottom = new THREE.Vector3(0.460, 0.690, 0.0);
  const headTubeTop = new THREE.Vector3(0.415, 0.885, 0.0); // 73° head tube angle
  const stemClamp = new THREE.Vector3(0.408, 0.920, 0.0);
  const handlebarCenter = new THREE.Vector3(0.505, 0.950, 0.0);

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
  // Upper & lower headset bearing race flares
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
    pt.y += Math.sin(f * Math.PI) * 0.008; // Subtle ergonomic curve
    dtPath.push(pt);
  }
  addSweptTube(dtPath, (t) => 0.022 + 0.006 * Math.sin(t * Math.PI), 14, frameBuf);

  // Dual Chainstays (BB shell to rear dropouts, dimpled for tire & 50T chainring clearance)
  for (const side of [-1, 1]) {
    const startPt = new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.030);
    const midPt = new THREE.Vector3(-0.210, 0.305, side * 0.045);
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
  addCylinder(
    new THREE.Vector3(-0.355, 0.465, -0.032),
    new THREE.Vector3(-0.355, 0.465, 0.032),
    0.006, 0.006, 10, frameBuf
  );

  // Rear CNC Dropouts (axle clamping plates + drive-side derailleur hanger)
  for (const side of [-1, 1]) {
    const dropCenter = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.066);
    addBox(dropCenter, new THREE.Vector3(0.042, 0.032, 0.006), new THREE.Euler(0, 0, -0.2), frameBuf, 0.85);

    if (side === 1) {
      // Rear Derailleur Hanger extending down from right dropout
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
  addCylinder(headTubeTop, stemClamp, 0.014, 0.014, 14, forkCockpitBuf, true, true, 0.2); // Carbon spacers
  // Top Cap with M5 preload bolt
  addCylinder(
    stemClamp,
    new THREE.Vector3(stemClamp.x - 0.002, stemClamp.y + 0.008, stemClamp.z),
    0.016, 0.016, 14, forkCockpitBuf, true, true, 0.9
  );

  // Fork Crown (just below head tube bottom)
  const forkCrown = new THREE.Vector3(headTubeBottom.x + 0.005, headTubeBottom.y - 0.018, 0);
  addCylinder(
    new THREE.Vector3(forkCrown.x, forkCrown.y, -0.028),
    new THREE.Vector3(forkCrown.x, forkCrown.y, 0.028),
    0.016, 0.016, 12, forkCockpitBuf, true, true, 0.85
  );

  // Dual Aerodynamic Fork Blades (smooth forward rake curve to front axle)
  for (const side of [-1, 1]) {
    const bladeStart = new THREE.Vector3(forkCrown.x, forkCrown.y, side * 0.024);
    const bladeMid = new THREE.Vector3(0.525, 0.490, side * 0.038);
    const bladeEnd = new THREE.Vector3(frontAxle.x, frontAxle.y, side * 0.052);
    addSweptTube([bladeStart, bladeMid, bladeEnd], (t) => 0.016 - 0.007 * t, 12, forkCockpitBuf);

    // Front Dropouts at fork blade tips
    addBox(bladeEnd, new THREE.Vector3(0.030, 0.024, 0.006), new THREE.Euler(0, 0, 0.35), forkCockpitBuf, 0.85);
  }

  // Handlebar Stem (110mm CNC alloy body + 4-bolt faceplate)
  addCylinder(stemClamp, handlebarCenter, 0.018, 0.016, 14, forkCockpitBuf, true, true, 0.88);
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

  // Road Drop Handlebars (31.8mm clamp, tops, reach, drops, and bar tape)
  const barWidth = 0.420;
  const halfBar = barWidth * 0.5;

  for (const side of [-1, 1]) {
    const sign = side;
    // Handlebar curve points: center -> top out -> forward bend -> downward drop -> tail
    const p0 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, 0);
    const p1 = new THREE.Vector3(handlebarCenter.x, handlebarCenter.y, sign * 0.120);
    const p2 = new THREE.Vector3(handlebarCenter.x + 0.025, handlebarCenter.y, sign * (halfBar - 0.025));
    const p3 = new THREE.Vector3(handlebarCenter.x + 0.075, handlebarCenter.y - 0.020, sign * halfBar);
    const p4 = new THREE.Vector3(handlebarCenter.x + 0.065, handlebarCenter.y - 0.090, sign * halfBar);
    const p5 = new THREE.Vector3(handlebarCenter.x - 0.035, handlebarCenter.y - 0.125, sign * halfBar);

    addSweptTube([p0, p1, p2, p3, p4, p5], () => 0.0125, 12, forkCockpitBuf, false, true, 0.15); // Black textured tape

    // Bar end plug
    addCylinder(p5, new THREE.Vector3(p5.x - 0.008, p5.y, p5.z), 0.011, 0.011, 10, forkCockpitBuf, true, true, 0.85);

    // Dual Brake/Shift Hoods & Levers (STI Ergonomic Shifters)
    const hoodBase = new THREE.Vector3(p3.x - 0.010, p3.y + 0.015, sign * halfBar);
    const hoodNose = new THREE.Vector3(p3.x + 0.055, p3.y + 0.030, sign * halfBar);
    // Rubber hood body
    addCylinder(hoodBase, hoodNose, 0.018, 0.014, 10, forkCockpitBuf, true, true, 0.12);

    // Contoured aluminum brake lever blade
    const leverPivot = new THREE.Vector3(hoodNose.x - 0.015, hoodNose.y - 0.010, sign * (halfBar + 0.006 * sign));
    const leverTip = new THREE.Vector3(leverPivot.x - 0.025, leverPivot.y - 0.095, leverPivot.z);
    addCylinder(leverPivot, leverTip, 0.007, 0.004, 10, forkCockpitBuf, true, true, 0.95);
  }

  // ==========================================
  // 3. WHEELS ASSEMBLY (FRONT & REAR)
  // ==========================================
  const rimRadius = 0.312; // 700c bead seat radius
  const rimCrossRad = 0.016; // Deep section rim profile
  const tireCrossRad = 0.020; // 28c tire cross section

  const wheels = [
    { name: 'front', center: frontAxle, isRear: false },
    { name: 'rear', center: rearAxle, isRear: true },
  ];

  for (const w of wheels) {
    const c = w.center;

    // 700c Rubber Clincher Tire with tread
    addTorus(c, rimRadius + tireCrossRad * 0.9, tireCrossRad, 14, 48, wheelsBuf, 'z', 0.20);

    // Deep-Section 45mm Aero Carbon Rim
    addTorus(c, rimRadius, rimCrossRad, 12, 48, wheelsBuf, 'z', 0.15);

    // Presta Valve Stem & Knurled Brass Nut
    const valveBase = new THREE.Vector3(c.x, c.y + rimRadius - 0.012, c.z);
    const valveTip = new THREE.Vector3(c.x, c.y + rimRadius - 0.052, c.z);
    addCylinder(valveBase, valveTip, 0.003, 0.003, 8, wheelsBuf, true, true, 0.90);
    // Valve cap
    addCylinder(valveTip, new THREE.Vector3(c.x, c.y + rimRadius - 0.062, c.z), 0.0035, 0.0035, 8, wheelsBuf, true, true, 0.85);

    // Wheel Hub (CNC alloy central barrel, left & right high spoke flanges, thru-axle)
    const flangeOffset = w.isRear ? 0.028 : 0.035;
    const hubShellRad = 0.016;
    const flangeRad = 0.032;

    // Center hub barrel
    addCylinder(
      new THREE.Vector3(c.x, c.y, -flangeOffset),
      new THREE.Vector3(c.x, c.y, flangeOffset),
      hubShellRad, hubShellRad, 16, wheelsBuf, true, true, 0.92
    );

    // High spoke flanges (left and right)
    for (const side of [-1, 1]) {
      const flgZ = side * (w.isRear && side === 1 ? flangeOffset * 0.75 : flangeOffset);
      addCylinder(
        new THREE.Vector3(c.x, c.y, flgZ - 0.002),
        new THREE.Vector3(c.x, c.y, flgZ + 0.002),
        flangeRad, flangeRad, 16, wheelsBuf, true, true, 0.95
      );
    }

    // Thru-axle & end caps
    addCylinder(
      new THREE.Vector3(c.x, c.y, -0.068),
      new THREE.Vector3(c.x, c.y, 0.068),
      0.007, 0.007, 12, wheelsBuf, true, true, 0.88
    );

    // 32 Laced Tangent & Radial Spokes with Brass Nipples
    const numSpokes = spokeCount;
    for (let s = 0; s < numSpokes; s++) {
      const isRightFlange = s % 2 === 0;
      const flgSign = isRightFlange ? 1 : -1;
      const flgZ = flgSign * (w.isRear && isRightFlange ? flangeOffset * 0.75 : flangeOffset);

      // Flange angle with cross-lacing tangent offset
      const isCrossPush = Math.floor(s / 2) % 2 === 0;
      const tangentOffset = isCrossPush ? 0.22 : -0.22;

      const spokeFrac = s / numSpokes;
      const rimAngle = spokeFrac * Math.PI * 2;
      const hubAngle = rimAngle + tangentOffset;

      const hubX = c.x + Math.cos(hubAngle) * (flangeRad - 0.003);
      const hubY = c.y + Math.sin(hubAngle) * (flangeRad - 0.003);
      const hubPt = new THREE.Vector3(hubX, hubY, flgZ);

      const rimX = c.x + Math.cos(rimAngle) * (rimRadius - 0.010);
      const rimY = c.y + Math.sin(rimAngle) * (rimRadius - 0.010);
      const rimPt = new THREE.Vector3(rimX, rimY, flgSign * 0.003);

      // Stainless steel spoke wire (1.8mm gauge)
      addCylinder(hubPt, rimPt, 0.0009, 0.0009, 6, wheelsBuf, false, false, 0.98);

      // Brass spoke nipple at rim bed
      const nippleBase = new THREE.Vector3().lerpVectors(rimPt, hubPt, 0.025);
      addCylinder(rimPt, nippleBase, 0.0022, 0.0022, 6, wheelsBuf, true, true, 0.85);
    }

    // 160mm Vented Stainless Steel Disc Brake Rotors & Calipers
    if (includeDiscBrakes) {
      const rotorZ = -0.028; // Disc brake mounted on non-drive side (left)
      const rotorCenter = new THREE.Vector3(c.x, c.y, rotorZ);
      addGearWheel(rotorCenter, 18, 0.080, 0.002, 0.038, wheelsBuf, 'z', 0.95);

      // Disc Brake Caliper
      const caliperPos = w.isRear
        ? new THREE.Vector3(c.x + 0.045, c.y + 0.055, rotorZ - 0.005)
        : new THREE.Vector3(c.x - 0.045, c.y + 0.055, rotorZ - 0.005);
      addBox(caliperPos, new THREE.Vector3(0.040, 0.035, 0.022), new THREE.Euler(0, 0, w.isRear ? 0.7 : -0.7), wheelsBuf, 0.25);
    }
  }

  // ==========================================
  // 4. DRIVETRAIN ASSEMBLY
  // ==========================================
  // Bottom Bracket Spindle & Outboard Sealed Cups
  addCylinder(
    new THREE.Vector3(bbCenter.x, bbCenter.y, -0.050),
    new THREE.Vector3(bbCenter.x, bbCenter.y, 0.050),
    0.012, 0.012, 14, drivetrainBuf, true, true, 0.92
  );
  // Splined BB Cups
  for (const side of [-1, 1]) {
    addCylinder(
      new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.034),
      new THREE.Vector3(bbCenter.x, bbCenter.y, side * 0.045),
      0.022, 0.022, 16, drivetrainBuf, true, true, 0.80
    );
  }

  // Dual 172.5mm Forged Aluminum Crank Arms
  const crankLen = 0.1725;
  const crankAngle = -0.45; // Drive side crank pointing forward-down

  // Right Drive Crank
  const rightCrankBase = new THREE.Vector3(bbCenter.x, bbCenter.y, 0.070);
  const rightCrankTip = new THREE.Vector3(
    bbCenter.x + Math.cos(crankAngle) * crankLen,
    bbCenter.y + Math.sin(crankAngle) * crankLen,
    0.075
  );
  addCylinder(rightCrankBase, rightCrankTip, 0.018, 0.013, 12, drivetrainBuf, true, true, 0.95);

  // Left Non-Drive Crank (180° opposite)
  const leftCrankAngle = crankAngle + Math.PI;
  const leftCrankBase = new THREE.Vector3(bbCenter.x, bbCenter.y, -0.070);
  const leftCrankTip = new THREE.Vector3(
    bbCenter.x + Math.cos(leftCrankAngle) * crankLen,
    bbCenter.y + Math.sin(leftCrankAngle) * crankLen,
    -0.075
  );
  addCylinder(leftCrankBase, leftCrankTip, 0.018, 0.013, 12, drivetrainBuf, true, true, 0.95);

  // 4-Arm Chainring Spider on Right Crank
  for (let a = 0; a < 4; a++) {
    const spiderAngle = crankAngle + (a / 4) * Math.PI * 2;
    const spEnd = new THREE.Vector3(
      bbCenter.x + Math.cos(spiderAngle) * 0.065,
      bbCenter.y + Math.sin(spiderAngle) * 0.065,
      0.048
    );
    addCylinder(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.052), spEnd, 0.010, 0.007, 8, drivetrainBuf, true, true, 0.92);
    // Chainring bolt
    addCylinder(spEnd, new THREE.Vector3(spEnd.x, spEnd.y, 0.042), 0.005, 0.005, 8, drivetrainBuf, true, true, 0.85);
  }

  // 2x Road Double Chainrings: Outer 50T and Inner 34T with gear teeth
  // Outer 50T (pitch radius ~0.101m)
  addGearWheel(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.048), 50, 0.101, 0.003, 0.060, drivetrainBuf, 'z', 0.96);
  // Inner 34T (pitch radius ~0.069m)
  addGearWheel(new THREE.Vector3(bbCenter.x, bbCenter.y, 0.041), 34, 0.069, 0.003, 0.040, drivetrainBuf, 'z', 0.92);

  // 11-Speed Rear Cassette (11 cogs stacked from 11T to 28T on rear freehub)
  const cassetteCogs = [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28];
  const cogStartZ = 0.024;
  const cogSpacing = 0.0038;

  for (let c = 0; c < cassetteCogs.length; c++) {
    const toothNum = cassetteCogs[c];
    const pitchR = (toothNum / 50) * 0.101; // Scaled to standard bicycle pitch
    const cogZ = cogStartZ + c * cogSpacing;
    addGearWheel(new THREE.Vector3(rearAxle.x, rearAxle.y, cogZ), toothNum, pitchR, 0.002, 0.018, drivetrainBuf, 'z', 0.95);
  }
  // Cassette lockring
  addCylinder(
    new THREE.Vector3(rearAxle.x, rearAxle.y, cogStartZ + cassetteCogs.length * cogSpacing),
    new THREE.Vector3(rearAxle.x, rearAxle.y, cogStartZ + cassetteCogs.length * cogSpacing + 0.003),
    0.018, 0.018, 16, drivetrainBuf, true, true, 0.88
  );

  // Rear Derailleur Assembly (B-knuckle, parallelogram, cage, 2x 11T jockey pulley wheels)
  const derailleurHanger = new THREE.Vector3(rearAxle.x + 0.008, rearAxle.y - 0.038, 0.068);
  const upperJockey = new THREE.Vector3(rearAxle.x + 0.025, rearAxle.y - 0.065, 0.045);
  const lowerJockey = new THREE.Vector3(rearAxle.x + 0.060, rearAxle.y - 0.125, 0.045);

  // Derailleur body parallelogram links
  addCylinder(derailleurHanger, upperJockey, 0.009, 0.007, 10, drivetrainBuf, true, true, 0.30);
  // Derailleur pulley cage plates
  addCylinder(upperJockey, lowerJockey, 0.008, 0.008, 8, drivetrainBuf, true, true, 0.25);

  // 11T Upper Guide Pulley & 11T Lower Tension Pulley Wheels
  addGearWheel(upperJockey, 11, 0.022, 0.004, 0.006, drivetrainBuf, 'z', 0.20);
  addGearWheel(lowerJockey, 11, 0.022, 0.004, 0.006, drivetrainBuf, 'z', 0.20);
  // Center pulley pivot bolts
  addCylinder(new THREE.Vector3(upperJockey.x, upperJockey.y, 0.038), new THREE.Vector3(upperJockey.x, upperJockey.y, 0.052), 0.004, 0.004, 8, drivetrainBuf, true, true, 0.98);
  addCylinder(new THREE.Vector3(lowerJockey.x, lowerJockey.y, 0.038), new THREE.Vector3(lowerJockey.x, lowerJockey.y, 0.052), 0.004, 0.004, 8, drivetrainBuf, true, true, 0.98);

  // Continuous Roller Chain (Loops over front 50T, rear cog, upper pulley, lower pulley, and returns)
  const chainPath: THREE.Vector3[] = [];
  const selectedRearPitchR = (cassetteCogs[5] / 50) * 0.101; // In middle cog (~17T)
  const chainZ = 0.046;

  // 1. Top chainstay run: from front chainring top to rear cog top
  const frontTop = new THREE.Vector3(bbCenter.x, bbCenter.y + 0.101, chainZ);
  const rearTop = new THREE.Vector3(rearAxle.x, rearAxle.y + selectedRearPitchR, chainZ);
  const numTopSteps = 16;
  for (let i = 0; i <= numTopSteps; i++) {
    chainPath.push(new THREE.Vector3().lerpVectors(frontTop, rearTop, i / numTopSteps));
  }

  // 2. Wrap around rear cassette cog
  const numRearWrap = 8;
  for (let i = 1; i <= numRearWrap; i++) {
    const angle = Math.PI * 0.5 + (i / numRearWrap) * Math.PI * 0.6;
    chainPath.push(new THREE.Vector3(
      rearAxle.x + Math.cos(angle) * selectedRearPitchR,
      rearAxle.y + Math.sin(angle) * selectedRearPitchR,
      chainZ
    ));
  }

  // 3. Curve into upper guide jockey pulley
  chainPath.push(new THREE.Vector3(upperJockey.x + 0.015, upperJockey.y + 0.018, chainZ));
  chainPath.push(new THREE.Vector3(upperJockey.x - 0.015, upperJockey.y, chainZ));

  // 4. Snake down to lower tension pulley
  chainPath.push(new THREE.Vector3(lowerJockey.x - 0.015, lowerJockey.y, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x, lowerJockey.y - 0.022, chainZ));
  chainPath.push(new THREE.Vector3(lowerJockey.x + 0.018, lowerJockey.y - 0.018, chainZ));

  // 5. Bottom chainstay return run: to bottom of front chainring
  const frontBottom = new THREE.Vector3(bbCenter.x, bbCenter.y - 0.101, chainZ);
  const numBottomSteps = 16;
  const lastDerailleurPt = chainPath[chainPath.length - 1];
  for (let i = 1; i <= numBottomSteps; i++) {
    chainPath.push(new THREE.Vector3().lerpVectors(lastDerailleurPt, frontBottom, i / numBottomSteps));
  }

  // 6. Wrap around front chainring back to top
  const numFrontWrap = 12;
  for (let i = 1; i < numFrontWrap; i++) {
    const angle = -Math.PI * 0.5 + (i / numFrontWrap) * Math.PI;
    chainPath.push(new THREE.Vector3(
      bbCenter.x + Math.cos(angle) * 0.101,
      bbCenter.y + Math.sin(angle) * 0.101,
      chainZ
    ));
  }

  // Synthesize realistic alternating roller chain links along the loop
  for (let i = 0; i < chainPath.length - 1; i++) {
    const ptA = chainPath[i];
    const ptB = chainPath[i + 1];
    const isOuter = i % 2 === 0;
    const linkRadius = isOuter ? 0.0055 : 0.0048;
    const linkLen = ptA.distanceTo(ptB);
    if (linkLen > 0.001) {
      addCylinder(ptA, ptB, linkRadius, linkRadius, 6, drivetrainBuf, true, true, isOuter ? 0.98 : 0.85);
      // Roller pin rivet
      addCylinder(
        new THREE.Vector3(ptA.x, ptA.y, chainZ - 0.004),
        new THREE.Vector3(ptA.x, ptA.y, chainZ + 0.004),
        0.0022, 0.0022, 6, drivetrainBuf, true, true, 0.92
      );
    }
  }

  // Pedals (Dual platform/road clip pedals with axles and grip body)
  const pedals = [
    { tip: rightCrankTip, sign: 1 },
    { tip: leftCrankTip, sign: -1 },
  ];

  for (const p of pedals) {
    const axleStart = p.tip;
    const axleEnd = new THREE.Vector3(axleStart.x, axleStart.y, axleStart.z + p.sign * 0.075);
    // 9/16" Pedal spindle
    addCylinder(axleStart, axleEnd, 0.006, 0.006, 10, drivetrainBuf, true, true, 0.95);

    // Pedal cage / body
    const bodyCenter = new THREE.Vector3().lerpVectors(axleStart, axleEnd, 0.65);
    addBox(bodyCenter, new THREE.Vector3(0.082, 0.016, 0.065), new THREE.Euler(0, 0, 0), drivetrainBuf, 0.35);

    // Amber Pedal Reflectors (Front & rear of each pedal body)
    if (includeReflectors) {
      for (const fwd of [-1, 1]) {
        const refPos = new THREE.Vector3(bodyCenter.x + fwd * 0.043, bodyCenter.y, bodyCenter.z);
        addBox(refPos, new THREE.Vector3(0.006, 0.012, 0.042), new THREE.Euler(0, 0, 0), accessoriesBuf, 0.98);
      }
    }
  }

  // ==========================================
  // 5. COCKPIT SEATING & SADDLE ASSEMBLY
  // ==========================================
  // Seatpost (inserted into seat tube, extending to saddle clamp at ~0.86m height)
  const saddleClampPos = new THREE.Vector3(seatCluster.x - 0.035, seatCluster.y + 0.125, 0.0);
  addCylinder(seatCluster, saddleClampPos, 0.0135, 0.0135, 14, saddleBuf, true, true, 0.88);

  // Seatpost Collar Clamp with M5 Hex pinch bolt
  addCylinder(
    new THREE.Vector3(seatCluster.x, seatCluster.y + 0.005, 0),
    new THREE.Vector3(seatCluster.x - 0.004, seatCluster.y + 0.025, 0),
    0.017, 0.017, 14, saddleBuf, true, true, 0.95
  );
  // Hex bolt on collar
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

  // Aerodynamic Road Racing Saddle Shell & Cushion
  // Modeled with anatomical perineal pressure-relief cutout and flared rear wings
  const saddleSteps = 12;
  const saddleBaseX = saddleClampPos.x - 0.120;
  const saddleLen = 0.265;
  const saddlePath: THREE.Vector3[] = [];

  for (let i = 0; i <= saddleSteps; i++) {
    const f = i / saddleSteps;
    const sx = saddleBaseX + f * saddleLen;
    // Ergonomic dipped profile (nose slightly down, center dipped, rear flared)
    const sy = saddleClampPos.y + 0.035 + (f < 0.3 ? (0.3 - f) * 0.025 : Math.pow(f - 0.3, 1.8) * 0.030);
    saddlePath.push(new THREE.Vector3(sx, sy, 0));
  }

  // Sweep saddle top shell with variable width (narrow nose 0.020m -> flared rear 0.075m)
  for (let i = 0; i < saddleSteps; i++) {
    const f = i / saddleSteps;
    const fNext = (i + 1) / saddleSteps;
    const p1 = saddlePath[i];
    const p2 = saddlePath[i + 1];

    const w1 = f < 0.4 ? 0.016 + f * 0.020 : 0.024 + Math.pow(f - 0.4, 1.4) * 0.085;
    const w2 = fNext < 0.4 ? 0.016 + fNext * 0.020 : 0.024 + Math.pow(fNext - 0.4, 1.4) * 0.085;

    // Left and right saddle wings
    for (const side of [-1, 1]) {
      const sp1 = new THREE.Vector3(p1.x, p1.y, side * w1);
      const sp2 = new THREE.Vector3(p2.x, p2.y, side * w2);
      addCylinder(sp1, sp2, 0.008, 0.008, 8, saddleBuf, true, true, 0.20);
    }
  }

  // ==========================================
  // 6. ROUTED CONTROL CABLES & ACCESSORIES
  // ==========================================
  if (includeCables) {
    const cableRad = 0.0022;

    // Front Brake Cable: from left handlebar lever to front disc caliper
    const fb0 = new THREE.Vector3(handlebarCenter.x + 0.045, handlebarCenter.y + 0.025, -barWidth * 0.5);
    const fb1 = new THREE.Vector3(headTubeTop.x + 0.060, headTubeTop.y - 0.030, -0.045);
    const fb2 = new THREE.Vector3(forkCrown.x + 0.015, forkCrown.y - 0.060, -0.035);
    const fb3 = new THREE.Vector3(frontAxle.x - 0.040, frontAxle.y + 0.065, -0.032);
    addSweptTube([fb0, fb1, fb2, fb3], () => cableRad, 8, accessoriesBuf, true, true, 0.12);

    // Rear Brake Cable: from right handlebar lever, through top tube to rear caliper
    const rb0 = new THREE.Vector3(handlebarCenter.x + 0.045, handlebarCenter.y + 0.025, barWidth * 0.5);
    const rb1 = new THREE.Vector3(headTubeTop.x + 0.050, headTubeTop.y - 0.020, 0.045);
    const rb2 = new THREE.Vector3(seatCluster.x + 0.040, seatCluster.y + 0.005, 0.020);
    const rb3 = new THREE.Vector3(seatCluster.x - 0.030, seatCluster.y - 0.040, -0.025);
    const rb4 = new THREE.Vector3(rearAxle.x + 0.050, rearAxle.y + 0.065, -0.032);
    addSweptTube([rb0, rb1, rb2, rb3, rb4], () => cableRad, 8, accessoriesBuf, true, true, 0.12);

    // Rear Shifter Cable: from right handlebar down along down tube to rear derailleur
    const rs0 = new THREE.Vector3(handlebarCenter.x + 0.035, handlebarCenter.y + 0.015, barWidth * 0.45);
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
    color: '#1a1d20',
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
    color: '#f59e0b', // Amber safety reflector & black cable housing
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
    name: 'Bicycle - Fork, Stem & Drop Handlebars',
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
