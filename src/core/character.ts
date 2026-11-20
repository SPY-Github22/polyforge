import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';

export interface RealisticHumanOptions {
  includeClothing?: boolean;      // default true
  includeAccessories?: boolean;   // default true
  shirtColor?: string;            // default '#1e3a8a' (Fitted shirt/jacket)
  pantsColor?: string;            // default '#1e293b' (Denim jeans)
  shoesColor?: string;            // default '#334155' (Oiled boots/sneakers)
  skinColor?: string;             // default '#d4a373' (Warm melanin peach-tan)
  hairColor?: string;             // default '#1c1917' (Dark brown/black)
  glassesColor?: string;          // default '#0f172a' (Matte slate black)
  watchColor?: string;            // default '#cbd5e1' (Brushed titanium/silver)
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

interface LoftRing {
  center: THREE.Vector3;
  rx: number;
  rz: number;
  frontOffset?: number; // Forward protrusion (e.g. pectorals, belly, toe)
  backOffset?: number;  // Backward protrusion (e.g. gluteals, calves)
}

/**
 * Sweeps an organic loft across a sequence of anatomical cross-sectional rings.
 */
function addLoftRings(
  rings: LoftRing[],
  segments: number,
  buf: GeometryBuffer,
  capTop = false,
  capBottom = false,
  tint = 1.0
): void {
  if (rings.length < 2) return;
  const startVIdx = buf.positions.length / 3;

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const vCoord = r / (rings.length - 1);

    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Anatomical shape deformation: front and back protrusion
      let zOffset = 0;
      if (sinT > 0 && ring.frontOffset) {
        zOffset = ring.frontOffset * sinT;
      } else if (sinT < 0 && ring.backOffset) {
        zOffset = ring.backOffset * (-sinT);
      }

      const vx = ring.center.x + ring.rx * cosT;
      const vy = ring.center.y;
      const vz = ring.center.z + ring.rz * sinT + zOffset;

      buf.positions.push(vx, vy, vz);
      // Rough initial normal pointing outward from ring center
      const nx = cosT;
      const ny = 0;
      const nz = sinT;
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(s / segments, vCoord);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const stride = segments + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    const ring1 = startVIdx + r * stride;
    const ring2 = startVIdx + (r + 1) * stride;

    for (let s = 0; s < segments; s++) {
      const a = ring1 + s;
      const b = ring2 + s;
      const c = ring2 + s + 1;
      const d = ring1 + s + 1;

      buf.indices.push(a, b, d);
      buf.indices.push(b, c, d);
    }
  }

  // Cap top
  if (capTop) {
    const topRing = rings[0];
    const topVStart = startVIdx;
    const cIdx = buf.positions.length / 3;
    buf.positions.push(topRing.center.x, topRing.center.y, topRing.center.z);
    buf.normals.push(0, 1, 0);
    buf.uvs.push(0.5, 0.5);
    if (buf.colors) buf.colors.push(tint, tint, tint);

    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, topVStart + s, topVStart + s + 1);
    }
  }

  // Cap bottom
  if (capBottom) {
    const botRing = rings[rings.length - 1];
    const botVStart = startVIdx + (rings.length - 1) * stride;
    const cIdx = buf.positions.length / 3;
    buf.positions.push(botRing.center.x, botRing.center.y, botRing.center.z);
    buf.normals.push(0, -1, 0);
    buf.uvs.push(0.5, 0.5);
    if (buf.colors) buf.colors.push(tint, tint, tint);

    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, botVStart + s + 1, botVStart + s);
    }
  }
}

/**
 * Appends an ellipsoid with custom semi-axes to a geometry buffer.
 */
function addEllipsoid(
  center: THREE.Vector3,
  rx: number,
  ry: number,
  rz: number,
  widthSegs: number,
  heightSegs: number,
  buf: GeometryBuffer,
  tint = 1.0,
  rot?: THREE.Euler
): void {
  const startVIdx = buf.positions.length / 3;
  const rotMatrix = rot ? new THREE.Matrix4().makeRotationFromEuler(rot) : null;

  for (let y = 0; y <= heightSegs; y++) {
    const phi = (y / heightSegs) * Math.PI; // 0 (top pole) to PI (bottom pole)
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x <= widthSegs; x++) {
      const theta = (x / widthSegs) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      let lx = rx * sinPhi * cosTheta;
      let ly = ry * cosPhi;
      let lz = rz * sinPhi * sinTheta;

      let nx = (sinPhi * cosTheta) / Math.max(0.001, rx);
      let ny = cosPhi / Math.max(0.001, ry);
      let nz = (sinPhi * sinTheta) / Math.max(0.001, rz);
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      if (rotMatrix) {
        const v = new THREE.Vector3(lx, ly, lz).applyMatrix4(rotMatrix);
        lx = v.x;
        ly = v.y;
        lz = v.z;

        const n = new THREE.Vector3(nx, ny, nz).applyMatrix4(rotMatrix);
        nx = n.x;
        ny = n.y;
        nz = n.z;
      }

      buf.positions.push(center.x + lx, center.y + ly, center.z + lz);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(x / widthSegs, y / heightSegs);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  const stride = widthSegs + 1;
  for (let y = 0; y < heightSegs; y++) {
    for (let x = 0; x < widthSegs; x++) {
      const a = startVIdx + y * stride + x;
      const b = startVIdx + (y + 1) * stride + x;
      const c = startVIdx + (y + 1) * stride + x + 1;
      const d = startVIdx + y * stride + x + 1;

      buf.indices.push(a, b, d);
      buf.indices.push(b, c, d);
    }
  }
}

/**
 * Appends a cylinder between two points with radial segments and end caps.
 */
function addCylinder(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  r1: number,
  r2: number,
  segments: number,
  buf: GeometryBuffer,
  capStart = true,
  capEnd = true,
  tint = 1.0
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
      if (buf.colors) buf.colors.push(tint, tint, tint);
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
  tint = 1.0
): void {
  const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(rot);
  const hx = size.x / 2;
  const hy = size.y / 2;
  const hz = size.z / 2;

  // 6 faces
  const faces = [
    { n: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0), d: hz },
    { n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0), d: hz },
    { n: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0), d: hx },
    { n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0), d: hx },
    { n: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1), d: hy },
    { n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1), d: hy },
  ];

  for (const f of faces) {
    const startVIdx = buf.positions.length / 3;
    const nRot = f.n.clone().applyMatrix4(rotMatrix).normalize();
    const uRot = f.u.clone().applyMatrix4(rotMatrix);
    const vRot = f.v.clone().applyMatrix4(rotMatrix);

    const uDim = Math.abs(f.n.x) > 0.5 ? size.z / 2 : size.x / 2;
    const vDim = Math.abs(f.n.y) > 0.5 ? size.z / 2 : size.y / 2;

    const corners = [
      new THREE.Vector3().copy(center).addScaledVector(nRot, f.d).addScaledVector(uRot, -uDim).addScaledVector(vRot, -vDim),
      new THREE.Vector3().copy(center).addScaledVector(nRot, f.d).addScaledVector(uRot, uDim).addScaledVector(vRot, -vDim),
      new THREE.Vector3().copy(center).addScaledVector(nRot, f.d).addScaledVector(uRot, uDim).addScaledVector(vRot, vDim),
      new THREE.Vector3().copy(center).addScaledVector(nRot, f.d).addScaledVector(uRot, -uDim).addScaledVector(vRot, vDim),
    ];

    for (const c of corners) {
      buf.positions.push(c.x, c.y, c.z);
      buf.normals.push(nRot.x, nRot.y, nRot.z);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
    buf.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    buf.indices.push(startVIdx, startVIdx + 1, startVIdx + 2);
    buf.indices.push(startVIdx, startVIdx + 2, startVIdx + 3);
  }
}

/**
 * Appends a 3D torus ring (for glasses rims, collar trim, watch bezel, etc.)
 */
function addTorus(
  center: THREE.Vector3,
  radius: number,
  tubeRadius: number,
  radialSegs: number,
  tubularSegs: number,
  rot: THREE.Euler,
  buf: GeometryBuffer,
  tint = 1.0
): void {
  const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(rot);
  const startVIdx = buf.positions.length / 3;

  for (let j = 0; j <= radialSegs; j++) {
    for (let i = 0; i <= tubularSegs; i++) {
      const u = (i / tubularSegs) * Math.PI * 2;
      const v = (j / radialSegs) * Math.PI * 2;

      let x = (radius + tubeRadius * Math.cos(v)) * Math.cos(u);
      let y = (radius + tubeRadius * Math.cos(v)) * Math.sin(u);
      let z = tubeRadius * Math.sin(v);

      let nx = Math.cos(v) * Math.cos(u);
      let ny = Math.cos(v) * Math.sin(u);
      let nz = Math.sin(v);

      const pVec = new THREE.Vector3(x, y, z).applyMatrix4(rotMatrix).add(center);
      const nVec = new THREE.Vector3(nx, ny, nz).applyMatrix4(rotMatrix).normalize();

      buf.positions.push(pVec.x, pVec.y, pVec.z);
      buf.normals.push(nVec.x, nVec.y, nVec.z);
      buf.uvs.push(i / tubularSegs, j / radialSegs);
      if (buf.colors) buf.colors.push(tint, tint, tint);
    }
  }

  for (let j = 1; j <= radialSegs; j++) {
    for (let i = 1; i <= tubularSegs; i++) {
      const a = startVIdx + (tubularSegs + 1) * j + i - 1;
      const b = startVIdx + (tubularSegs + 1) * (j - 1) + i - 1;
      const c = startVIdx + (tubularSegs + 1) * (j - 1) + i;
      const d = startVIdx + (tubularSegs + 1) * j + i;

      buf.indices.push(a, b, d);
      buf.indices.push(b, c, d);
    }
  }
}

/**
 * Builds SceneItem from buffer with smooth vertex normals and calculated UVs.
 */
function bufferToSceneItem(
  id: string,
  name: string,
  buf: GeometryBuffer,
  material: MaterialProperties
): SceneItem {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setIndex(buf.indices);
  geo.computeVertexNormals();
  geo.normalizeNormals();

  const normalsArr = Array.from(geo.attributes.normal.array as Float32Array);
  const uvsArr =
    buf.uvs.length === (buf.positions.length / 3) * 2
      ? buf.uvs
      : new Array((buf.positions.length / 3) * 2).fill(0);

  return {
    id,
    name,
    type: 'mesh',
    primitiveType: 'custom',
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    material,
    geometryParams: {
      customGeometry: {
        positions: buf.positions,
        normals: normalsArr,
        uvs: uvsArr,
        indices: buf.indices,
        colors:
          buf.colors && buf.colors.length === buf.positions.length ? buf.colors : undefined,
      },
    },
    visible: true,
    locked: false,
  };
}

/**
 * Generates an ultra-realistic, anatomically proportioned procedural 3D human model.
 * Proportions: 7.8 heads tall, total height ~1.78m, standing firmly grounded on the floor (y = 0).
 */
export function generateRealisticHumanScene(
  options: RealisticHumanOptions = {}
): RealisticHumanResult {
  const includeClothing = options.includeClothing ?? true;
  const includeAccessories = options.includeAccessories ?? true;

  const skinColor = options.skinColor || '#d4a373';
  const hairColor = options.hairColor || '#1c1917';
  const shirtColor = options.shirtColor || '#1e3a8a';
  const pantsColor = options.pantsColor || '#1e293b';
  const shoesColor = options.shoesColor || '#334155';
  const glassesColor = options.glassesColor || '#0f172a';
  const watchColor = options.watchColor || '#cbd5e1';

  // =========================================================================
  // 1. ANATOMICAL HUMAN BODY (Skin, Head, Torso, Limbs, Hands, Feet)
  // =========================================================================
  const bodyBuf = createBuffer();

  // --- Head, Cranium & Facial Structure ---
  // Cranium vault
  addEllipsoid(new THREE.Vector3(0, 1.685, -0.015), 0.088, 0.098, 0.095, 20, 16, bodyBuf, 1.0);

  // Defined jawline, chin and cheekbones
  addEllipsoid(new THREE.Vector3(0, 1.58, 0.025), 0.068, 0.055, 0.062, 16, 12, bodyBuf, 0.98); // Lower jaw base
  addEllipsoid(new THREE.Vector3(0, 1.545, 0.068), 0.024, 0.018, 0.022, 12, 10, bodyBuf, 0.97); // Prominent chin

  // Brow ridge & cheekbones (zygomatic arches)
  addEllipsoid(new THREE.Vector3(0.042, 1.625, 0.052), 0.024, 0.018, 0.022, 10, 8, bodyBuf, 0.98);
  addEllipsoid(new THREE.Vector3(-0.042, 1.625, 0.052), 0.024, 0.018, 0.022, 10, 8, bodyBuf, 0.98);

  // Nose bridge and tip
  addCylinder(
    new THREE.Vector3(0, 1.65, 0.075),
    new THREE.Vector3(0, 1.61, 0.096),
    0.009,
    0.012,
    10,
    bodyBuf,
    true,
    true,
    0.98
  );
  addEllipsoid(new THREE.Vector3(0, 1.608, 0.098), 0.012, 0.009, 0.011, 8, 8, bodyBuf, 0.97); // Nose tip

  // Lips (Upper and lower vermilion)
  addEllipsoid(new THREE.Vector3(0, 1.582, 0.075), 0.020, 0.006, 0.008, 10, 6, bodyBuf, 0.93);
  addEllipsoid(new THREE.Vector3(0, 1.568, 0.073), 0.018, 0.007, 0.009, 10, 6, bodyBuf, 0.92);

  // Ear lobes & pinna
  addEllipsoid(
    new THREE.Vector3(0.088, 1.628, -0.012),
    0.012,
    0.026,
    0.015,
    10,
    10,
    bodyBuf,
    0.95,
    new THREE.Euler(0.1, 0, -0.2)
  );
  addEllipsoid(
    new THREE.Vector3(-0.088, 1.628, -0.012),
    0.012,
    0.026,
    0.015,
    10,
    10,
    bodyBuf,
    0.95,
    new THREE.Euler(0.1, 0, 0.2)
  );

  // Stylized modern coiffure / hair volume
  const hairColorObj = new THREE.Color(hairColor);
  const hairTint = Math.max(0.05, Math.min(0.9, hairColorObj.r * 0.3 + hairColorObj.g * 0.59 + hairColorObj.b * 0.11));

  addEllipsoid(
    new THREE.Vector3(0, 1.708, -0.018),
    0.093,
    0.082,
    0.098,
    20,
    16,
    bodyBuf,
    hairTint
  );
  // Hair fringe / styled front sweep
  addEllipsoid(
    new THREE.Vector3(0, 1.735, 0.042),
    0.076,
    0.038,
    0.048,
    14,
    10,
    bodyBuf,
    hairTint
  );

  // Neck cylinder with sternocleidomastoid taper
  const neckRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.54, -0.005), rx: 0.052, rz: 0.056 },
    { center: new THREE.Vector3(0, 1.50, -0.005), rx: 0.054, rz: 0.058, frontOffset: 0.006 }, // Adam's apple / thyroid
    { center: new THREE.Vector3(0, 1.45, -0.005), rx: 0.070, rz: 0.068 },
  ];
  addLoftRings(neckRings, 16, bodyBuf, false, false, 0.98);

  // --- Torso & Shoulders ---
  // Broad clavicle line, pectoral contours, latissimus dorsi, ribcage taper, waist, and hips
  const torsoRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.45, -0.01), rx: 0.178, rz: 0.112 },                     // Clavicles / Shoulders
    { center: new THREE.Vector3(0, 1.36, -0.008), rx: 0.165, rz: 0.118, frontOffset: 0.018 }, // Pectoral line
    { center: new THREE.Vector3(0, 1.25, -0.005), rx: 0.152, rz: 0.108 },                     // Lower ribcage
    { center: new THREE.Vector3(0, 1.12, -0.002), rx: 0.138, rz: 0.098, frontOffset: 0.004 }, // Waist & navel
    { center: new THREE.Vector3(0, 0.98, -0.005), rx: 0.150, rz: 0.115, backOffset: 0.024 },  // Iliac crest / Gluteal start
    { center: new THREE.Vector3(0, 0.88, -0.010), rx: 0.158, rz: 0.125, backOffset: 0.032 },  // Hips / Greater trochanters
    { center: new THREE.Vector3(0, 0.83, -0.008), rx: 0.142, rz: 0.110 },                     // Crotch / Pelvic floor
  ];
  addLoftRings(torsoRings, 24, bodyBuf, true, true, 1.0);

  // Gluteal muscle volume (left and right buttocks)
  addEllipsoid(new THREE.Vector3(0.074, 0.91, -0.088), 0.072, 0.085, 0.065, 14, 12, bodyBuf, 0.98);
  addEllipsoid(new THREE.Vector3(-0.074, 0.91, -0.088), 0.072, 0.085, 0.065, 14, 12, bodyBuf, 0.98);

  // --- Upper Limbs (Deltoids, Biceps, Elbows, Forearms, Wrists, Hands) ---
  const armSides = [1, -1]; // 1 = Right, -1 = Left
  for (const side of armSides) {
    const xDeltoid = side * 0.198;
    // Deltoid shoulder cap
    addEllipsoid(new THREE.Vector3(xDeltoid, 1.425, -0.008), 0.062, 0.074, 0.062, 14, 12, bodyBuf, 1.0);

    // Biceps / Brachii (Upper arm)
    const upperArmRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.208, 1.40, -0.008), rx: 0.048, rz: 0.048 },
      { center: new THREE.Vector3(side * 0.224, 1.28, -0.008), rx: 0.045, rz: 0.046, frontOffset: 0.008 }, // Bicep peak
      { center: new THREE.Vector3(side * 0.238, 1.16, -0.012), rx: 0.040, rz: 0.042 },                     // Elbow joint
    ];
    addLoftRings(upperArmRings, 16, bodyBuf, false, false, 0.99);

    // Olecranon elbow prominence
    addEllipsoid(new THREE.Vector3(side * 0.238, 1.155, -0.046), 0.016, 0.018, 0.014, 8, 8, bodyBuf, 0.96);

    // Forearm (Brachioradialis taper to wrist)
    const forearmRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.238, 1.15, -0.012), rx: 0.038, rz: 0.040 },
      { center: new THREE.Vector3(side * 0.252, 1.02, -0.010), rx: 0.035, rz: 0.034 },
      { center: new THREE.Vector3(side * 0.264, 0.89, -0.008), rx: 0.028, rz: 0.024 }, // Wrist
    ];
    addLoftRings(forearmRings, 16, bodyBuf, false, false, 0.99);

    // Palm and modeled hand
    const palmCenter = new THREE.Vector3(side * 0.272, 0.825, -0.006);
    addBox(palmCenter, new THREE.Vector3(0.022, 0.095, 0.045), new THREE.Euler(0, 0, side * 0.08), bodyBuf, 0.98);

    // Abducted thumb
    addCylinder(
      new THREE.Vector3(side * 0.268, 0.84, 0.012),
      new THREE.Vector3(side * 0.272, 0.795, 0.032),
      0.010,
      0.008,
      8,
      bodyBuf,
      true,
      true,
      0.97
    );

    // Grouped 4 fingers curling naturally downward
    addCylinder(
      new THREE.Vector3(side * 0.274, 0.78, -0.004),
      new THREE.Vector3(side * 0.276, 0.715, -0.002),
      0.016,
      0.012,
      10,
      bodyBuf,
      true,
      true,
      0.96
    );
  }

  // --- Lower Limbs (Quadriceps, Knees, Calves, Ankles, Arched Feet) ---
  const legSides = [1, -1];
  for (const side of legSides) {
    const xLeg = side * 0.092;

    // Thigh & Quadriceps loft
    const thighRings: LoftRing[] = [
      { center: new THREE.Vector3(xLeg, 0.86, -0.008), rx: 0.088, rz: 0.095 },
      { center: new THREE.Vector3(xLeg, 0.72, -0.006), rx: 0.082, rz: 0.086, frontOffset: 0.012 }, // Quad curve
      { center: new THREE.Vector3(xLeg, 0.58, -0.004), rx: 0.068, rz: 0.072 },
      { center: new THREE.Vector3(xLeg, 0.50, -0.002), rx: 0.058, rz: 0.060 }, // Knee joint
    ];
    addLoftRings(thighRings, 18, bodyBuf, false, false, 1.0);

    // Patella (kneecap) ridge
    addEllipsoid(new THREE.Vector3(xLeg, 0.495, 0.055), 0.024, 0.028, 0.018, 10, 10, bodyBuf, 0.98);

    // Lower Leg & Calves (Gastrocnemius & Soleus taper to Achilles)
    const calfRings: LoftRing[] = [
      { center: new THREE.Vector3(xLeg, 0.48, -0.002), rx: 0.056, rz: 0.058 },
      { center: new THREE.Vector3(xLeg, 0.36, -0.008), rx: 0.062, rz: 0.068, backOffset: 0.022 }, // Calf belly
      { center: new THREE.Vector3(xLeg, 0.22, -0.008), rx: 0.046, rz: 0.048 },
      { center: new THREE.Vector3(xLeg, 0.10, -0.005), rx: 0.036, rz: 0.038 }, // Above ankle
    ];
    addLoftRings(calfRings, 18, bodyBuf, false, false, 0.99);

    // Ankle malleoli (lateral and medial prominence)
    addEllipsoid(new THREE.Vector3(xLeg + side * 0.032, 0.082, -0.005), 0.012, 0.015, 0.014, 8, 8, bodyBuf, 0.96);
    addEllipsoid(new THREE.Vector3(xLeg - side * 0.028, 0.086, -0.005), 0.012, 0.015, 0.014, 8, 8, bodyBuf, 0.96);

    // Arched foot (standing flat on the ground plane with bottom at y = 0)
    // Heel (calcaneus)
    addEllipsoid(new THREE.Vector3(xLeg, 0.045, -0.052), 0.034, 0.038, 0.045, 12, 10, bodyBuf, 0.98);
    // Midfoot arch & instep
    addEllipsoid(new THREE.Vector3(xLeg, 0.042, 0.025), 0.038, 0.034, 0.060, 12, 10, bodyBuf, 0.98);
    // Ball of foot & grouped toes
    addEllipsoid(new THREE.Vector3(xLeg, 0.022, 0.105), 0.042, 0.020, 0.038, 12, 8, bodyBuf, 0.96);
  }

  const bodyItem = bufferToSceneItem(
    'human-body',
    'Human Anatomy (Body)',
    bodyBuf,
    {
      color: skinColor,
      roughness: 0.55,
      metalness: 0.05,
      emissive: '#000000',
      emissiveIntensity: 0,
      transmission: 0,
      opacity: 1,
      transparent: false,
      wireframe: false,
      texturePreset: 'skin_tone',
    }
  );

  const allItems: SceneItem[] = [bodyItem];
  let clothingUpperItem: SceneItem | undefined;
  let clothingLowerItem: SceneItem | undefined;
  let footwearItem: SceneItem | undefined;
  let accessoriesItem: SceneItem | undefined;

  let clothingVerts = 0;
  let clothingTris = 0;
  let footwearVerts = 0;
  let footwearTris = 0;
  let accessoriesVerts = 0;
  let accessoriesTris = 0;

  // =========================================================================
  // 2. LAYERED CLOTHING & GARMENTS
  // =========================================================================
  if (includeClothing) {
    // --- Upper Body: Jacket / Fitted Shirt ---
    const upperBuf = createBuffer();

    // Shirt / Jacket Torso Shell cleanly encasing the torso with realistic textile offset
    const shirtRings: LoftRing[] = [
      { center: new THREE.Vector3(0, 1.48, -0.008), rx: 0.188, rz: 0.124 },                    // Neck collar base
      { center: new THREE.Vector3(0, 1.37, -0.008), rx: 0.178, rz: 0.132, frontOffset: 0.022 }, // Chest
      { center: new THREE.Vector3(0, 1.24, -0.004), rx: 0.164, rz: 0.122 },                    // Ribs
      { center: new THREE.Vector3(0, 1.10, -0.002), rx: 0.152, rz: 0.114, frontOffset: 0.008 }, // Waist
      { center: new THREE.Vector3(0, 0.97, -0.005), rx: 0.165, rz: 0.130, backOffset: 0.026 }, // Hip hem
      { center: new THREE.Vector3(0, 0.94, -0.006), rx: 0.168, rz: 0.132, backOffset: 0.026 }, // Thickened bottom hem
    ];
    addLoftRings(shirtRings, 24, upperBuf, false, true, 1.0);

    // Collar trim around neck
    addTorus(
      new THREE.Vector3(0, 1.485, -0.006),
      0.082,
      0.010,
      12,
      24,
      new THREE.Euler(Math.PI / 2 + 0.15, 0, 0),
      upperBuf,
      0.92
    );

    // Front placket seam / zipper closure
    addBox(
      new THREE.Vector3(0, 1.22, 0.134),
      new THREE.Vector3(0.022, 0.48, 0.008),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      0.88
    );
    // Metallic zipper slider pull
    addBox(
      new THREE.Vector3(0, 1.34, 0.142),
      new THREE.Vector3(0.016, 0.028, 0.012),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      0.45 // Metallic dark zipper
    );

    // Jacket Sleeves (encasing upper arms down to wrists)
    for (const side of armSides) {
      const sleeveRings: LoftRing[] = [
        { center: new THREE.Vector3(side * 0.205, 1.41, -0.008), rx: 0.060, rz: 0.060 },
        { center: new THREE.Vector3(side * 0.224, 1.28, -0.008), rx: 0.054, rz: 0.054 },
        { center: new THREE.Vector3(side * 0.238, 1.16, -0.012), rx: 0.048, rz: 0.050 }, // Elbow
        { center: new THREE.Vector3(side * 0.252, 1.02, -0.010), rx: 0.044, rz: 0.044 },
        { center: new THREE.Vector3(side * 0.264, 0.895, -0.008), rx: 0.038, rz: 0.036 }, // Wrist cuff
      ];
      addLoftRings(sleeveRings, 16, upperBuf, false, false, 0.98);

      // Folded sleeve cuff band at wrist
      addTorus(
        new THREE.Vector3(side * 0.264, 0.898, -0.008),
        0.036,
        0.006,
        10,
        16,
        new THREE.Euler(0, 0, side * 0.12),
        upperBuf,
        0.90
      );
    }

    clothingUpperItem = bufferToSceneItem(
      'human-shirt',
      'Upper Garment (Fitted Jacket / Shirt)',
      upperBuf,
      {
        color: shirtColor,
        roughness: 0.85,
        metalness: 0.0,
        emissive: '#000000',
        emissiveIntensity: 0,
        transmission: 0,
        opacity: 1,
        transparent: false,
        wireframe: false,
        texturePreset: 'knit_cotton',
      }
    );
    allItems.push(clothingUpperItem);

    // --- Lower Body: Jeans / Trousers ---
    const lowerBuf = createBuffer();

    // Waistband & Pelvis shell
    const waistbandRings: LoftRing[] = [
      { center: new THREE.Vector3(0, 1.01, -0.004), rx: 0.164, rz: 0.124 },
      { center: new THREE.Vector3(0, 0.96, -0.006), rx: 0.168, rz: 0.130, backOffset: 0.024 },
      { center: new THREE.Vector3(0, 0.87, -0.008), rx: 0.174, rz: 0.136, backOffset: 0.032 },
    ];
    addLoftRings(waistbandRings, 24, lowerBuf, true, false, 0.95);

    // Front fly seam & button on jeans
    addBox(
      new THREE.Vector3(0, 0.94, 0.138),
      new THREE.Vector3(0.018, 0.12, 0.006),
      new THREE.Euler(0, 0, 0),
      lowerBuf,
      0.85
    );
    addEllipsoid(new THREE.Vector3(0, 1.00, 0.134), 0.008, 0.008, 0.005, 8, 8, lowerBuf, 0.4); // Brass button

    // 5 Belt loops
    const beltLoopAngles = [0.45, -0.45, 1.45, -1.45, Math.PI];
    for (const ang of beltLoopAngles) {
      const lx = 0.162 * Math.cos(ang);
      const lz = 0.124 * Math.sin(ang);
      addBox(
        new THREE.Vector3(lx, 0.985, lz),
        new THREE.Vector3(0.012, 0.045, 0.006),
        new THREE.Euler(0, -ang, 0),
        lowerBuf,
        0.88
      );
    }

    // Individual Trouser Legs with knee flexion folds and ankle cuffs
    for (const side of legSides) {
      const xLeg = side * 0.092;

      const legRings: LoftRing[] = [
        { center: new THREE.Vector3(xLeg, 0.86, -0.008), rx: 0.098, rz: 0.104 },
        { center: new THREE.Vector3(xLeg, 0.72, -0.006), rx: 0.090, rz: 0.096, frontOffset: 0.012 },
        { center: new THREE.Vector3(xLeg, 0.58, -0.004), rx: 0.076, rz: 0.082 },
        // Knee flexion crease folds (textile wrinkles around knee)
        { center: new THREE.Vector3(xLeg, 0.52, -0.002), rx: 0.070, rz: 0.074, frontOffset: 0.010 },
        { center: new THREE.Vector3(xLeg, 0.48, -0.002), rx: 0.068, rz: 0.072, frontOffset: 0.008 },
        { center: new THREE.Vector3(xLeg, 0.36, -0.006), rx: 0.070, rz: 0.076, backOffset: 0.018 },
        { center: new THREE.Vector3(xLeg, 0.22, -0.006), rx: 0.056, rz: 0.058 },
        { center: new THREE.Vector3(xLeg, 0.12, -0.004), rx: 0.050, rz: 0.052 }, // Ankle hem
      ];
      addLoftRings(legRings, 18, lowerBuf, false, true, 1.0);

      // Trouser bottom cuff hem
      addTorus(
        new THREE.Vector3(xLeg, 0.12, -0.004),
        0.050,
        0.006,
        10,
        16,
        new THREE.Euler(Math.PI / 2, 0, 0),
        lowerBuf,
        0.90
      );

      // Lateral outseam running down outside of trousers
      addCylinder(
        new THREE.Vector3(xLeg + side * 0.092, 0.85, -0.008),
        new THREE.Vector3(xLeg + side * 0.048, 0.12, -0.004),
        0.004,
        0.004,
        6,
        lowerBuf,
        true,
        true,
        0.82
      );
    }

    clothingLowerItem = bufferToSceneItem(
      'human-pants',
      'Lower Garment (Denim Jeans / Trousers)',
      lowerBuf,
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
      }
    );
    allItems.push(clothingLowerItem);

    clothingVerts = (upperBuf.positions.length + lowerBuf.positions.length) / 3;
    clothingTris = (upperBuf.indices.length + lowerBuf.indices.length) / 3;

    // --- Footwear: Street Boots / Structured Sneakers ---
    const shoesBuf = createBuffer();

    for (const side of legSides) {
      const xFoot = side * 0.092;

      // 1. Thick rubber outsole with flat ground contact plane at y = 0
      // Dimensions: length ~0.26m (from z = -0.09 to +0.17), width 0.094m, thickness 0.016m
      addBox(
        new THREE.Vector3(xFoot, 0.008, 0.040),
        new THREE.Vector3(0.094, 0.016, 0.255),
        new THREE.Euler(0, 0, 0),
        shoesBuf,
        0.25 // Dark vulcanized rubber
      );

      // 2. Midsole wedge (cushioning wedge elevating heel to y = 0.038)
      addBox(
        new THREE.Vector3(xFoot, 0.024, 0.038),
        new THREE.Vector3(0.090, 0.018, 0.245),
        new THREE.Euler(0, 0, 0),
        shoesBuf,
        0.85 // Crisp contrast midsole
      );

      // 3. Leather boot upper encasing foot from midsole to ankle collar
      const shoeUpperRings: LoftRing[] = [
        { center: new THREE.Vector3(xFoot, 0.13, -0.004), rx: 0.048, rz: 0.052 }, // Ankle collar
        { center: new THREE.Vector3(xFoot, 0.09, 0.008), rx: 0.048, rz: 0.065 },
        { center: new THREE.Vector3(xFoot, 0.05, 0.035), rx: 0.046, rz: 0.110, frontOffset: 0.022 },
        { center: new THREE.Vector3(xFoot, 0.032, 0.042), rx: 0.045, rz: 0.120 },
      ];
      addLoftRings(shoeUpperRings, 16, shoesBuf, false, true, 0.95);

      // 4. Structured toe cap rand
      addEllipsoid(
        new THREE.Vector3(xFoot, 0.032, 0.132),
        0.045,
        0.022,
        0.034,
        12,
        8,
        shoesBuf,
        0.85
      );

      // 5. Padded shoe tongue rising up the instep
      addBox(
        new THREE.Vector3(xFoot, 0.088, 0.042),
        new THREE.Vector3(0.034, 0.082, 0.014),
        new THREE.Euler(0.48, 0, 0),
        shoesBuf,
        0.90
      );

      // 6. Cross-laced eyelets and laces
      for (let laceIdx = 0; laceIdx < 4; laceIdx++) {
        const lz = 0.035 + laceIdx * 0.022;
        const ly = 0.055 + laceIdx * 0.018;
        // Horizontal lace bar
        addCylinder(
          new THREE.Vector3(xFoot - 0.018, ly, lz),
          new THREE.Vector3(xFoot + 0.018, ly, lz),
          0.003,
          0.003,
          6,
          shoesBuf,
          true,
          true,
          0.98
        );
      }
    }

    footwearItem = bufferToSceneItem(
      'human-footwear',
      'Footwear (Oiled Leather Boots / Sneakers)',
      shoesBuf,
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
      }
    );
    allItems.push(footwearItem);

    footwearVerts = shoesBuf.positions.length / 3;
    footwearTris = shoesBuf.indices.length / 3;
  }

  // =========================================================================
  // 3. DETAILED ACCESSORIES (Eyewear, Smart Watch, Leather Belt)
  // =========================================================================
  if (includeAccessories) {
    const accBuf = createBuffer();

    // --- Eyewear (Glasses / Sunglasses) ---
    const glassesColorObj = new THREE.Color(glassesColor);
    const glassesTint = Math.max(0.1, Math.min(0.9, glassesColorObj.r * 0.3 + glassesColorObj.g * 0.59 + glassesColorObj.b * 0.11));

    // Rims around each eye (left & right)
    for (const side of [1, -1]) {
      const xEye = side * 0.036;
      // Frame rim
      addTorus(
        new THREE.Vector3(xEye, 1.648, 0.086),
        0.020,
        0.003,
        8,
        18,
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesTint
      );

      // Tinted glass lens
      addEllipsoid(
        new THREE.Vector3(xEye, 1.648, 0.086),
        0.018,
        0.015,
        0.002,
        10,
        8,
        accBuf,
        0.4
      );

      // Temple arm extending back to sit over ear
      addCylinder(
        new THREE.Vector3(xEye + side * 0.022, 1.648, 0.084),
        new THREE.Vector3(side * 0.088, 1.638, -0.015),
        0.0025,
        0.0025,
        6,
        accBuf,
        true,
        true,
        glassesTint
      );
    }

    // Nose bridge connector
    addCylinder(
      new THREE.Vector3(-0.018, 1.650, 0.088),
      new THREE.Vector3(0.018, 1.650, 0.088),
      0.0025,
      0.0025,
      6,
      accBuf,
      true,
      true,
      0.3
    );

    // --- Smart Watch / Wristwatch (on Left Wrist) ---
    const watchCenter = new THREE.Vector3(-0.264, 0.912, -0.008);
    // Metallic bezel casing
    addCylinder(
      new THREE.Vector3(-0.264, 0.912, -0.014),
      new THREE.Vector3(-0.264, 0.912, -0.002),
      0.018,
      0.018,
      18,
      accBuf,
      true,
      true,
      0.85 // Brushed silver/titanium
    );

    // Display glass screen
    addEllipsoid(
      new THREE.Vector3(-0.264, 0.912, -0.001),
      0.015,
      0.015,
      0.002,
      12,
      10,
      accBuf,
      0.15 // Dark sapphire display glass
    );

    // Crown dial button on side
    addCylinder(
      new THREE.Vector3(-0.264, 0.928, -0.008),
      new THREE.Vector3(-0.264, 0.934, -0.008),
      0.004,
      0.004,
      8,
      accBuf,
      true,
      true,
      0.90
    );

    // Fitted wrist strap wrapping around wrist circumference
    addTorus(
      watchCenter,
      0.034,
      0.006,
      8,
      18,
      new THREE.Euler(0, 0, -0.12),
      accBuf,
      0.35 // Dark strap
    );

    // --- Leather Belt & Metallic Buckle ---
    // Waist belt band wrapping around jeans waistband
    addTorus(
      new THREE.Vector3(0, 0.995, -0.005),
      0.158,
      0.010,
      10,
      24,
      new THREE.Euler(Math.PI / 2, 0, 0),
      accBuf,
      0.30 // Rich leather belt
    );

    // Rectangular metallic buckle at center front
    const buckleCenter = new THREE.Vector3(0, 0.995, 0.148);
    // Outer frame (4 border bars)
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y + 0.020, buckleCenter.z),
      new THREE.Vector3(0.046, 0.006, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      0.95 // Chrome/nickel buckle
    );
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y - 0.020, buckleCenter.z),
      new THREE.Vector3(0.046, 0.006, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      0.95
    );
    addBox(
      new THREE.Vector3(buckleCenter.x - 0.022, buckleCenter.y, buckleCenter.z),
      new THREE.Vector3(0.006, 0.036, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      0.95
    );
    addBox(
      new THREE.Vector3(buckleCenter.x + 0.022, buckleCenter.y, buckleCenter.z),
      new THREE.Vector3(0.006, 0.036, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      0.95
    );
    // Buckle center prong
    addCylinder(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y, buckleCenter.z - 0.006),
      new THREE.Vector3(buckleCenter.x, buckleCenter.y, buckleCenter.z + 0.007),
      0.0025,
      0.0025,
      6,
      accBuf,
      true,
      true,
      0.95
    );

    accessoriesItem = bufferToSceneItem(
      'human-accessories',
      'Accessories (Eyewear, Watch & Belt)',
      accBuf,
      {
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
      }
    );
    allItems.push(accessoriesItem);

    accessoriesVerts = accBuf.positions.length / 3;
    accessoriesTris = accBuf.indices.length / 3;
  }

  const bodyVerts = bodyBuf.positions.length / 3;
  const bodyTris = bodyBuf.indices.length / 3;
  const totalVertices = bodyVerts + clothingVerts + footwearVerts + accessoriesVerts;
  const totalTriangles = bodyTris + clothingTris + footwearTris + accessoriesTris;

  return {
    bodyItem,
    clothingUpperItem,
    clothingLowerItem,
    footwearItem,
    accessoriesItem,
    allItems,
    stats: {
      bodyVertices: bodyVerts,
      bodyTriangles: bodyTris,
      clothingVertices: clothingVerts,
      clothingTriangles: clothingTris,
      footwearVertices: footwearVerts,
      footwearTriangles: footwearTris,
      accessoriesVertices: accessoriesVerts,
      accessoriesTriangles: accessoriesTris,
      totalVertices,
      totalTriangles,
      componentsCount: allItems.length,
      height: 1.78,
    },
  };
}
