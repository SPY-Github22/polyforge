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

function pushColor(buf: GeometryBuffer, colorOrTint: THREE.Color | string | number): void {
  if (!buf.colors) return;
  if (typeof colorOrTint === 'string') {
    const c = new THREE.Color(colorOrTint);
    buf.colors.push(c.r, c.g, c.b);
  } else if (colorOrTint instanceof THREE.Color) {
    buf.colors.push(colorOrTint.r, colorOrTint.g, colorOrTint.b);
  } else {
    buf.colors.push(colorOrTint, colorOrTint, colorOrTint);
  }
}

export interface LoftRing {
  center: THREE.Vector3;
  rx: number;
  rz: number;
  frontOffset?: number; // Forward protrusion (e.g. pectorals, belly, toe)
  backOffset?: number;  // Backward protrusion (e.g. gluteals, calves)
  rot?: THREE.Euler;    // Optional ring orientation
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
  colorOrTint: THREE.Color | string | number = 1.0
): void {
  if (rings.length < 2) return;
  const startVIdx = buf.positions.length / 3;

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const vCoord = r / (rings.length - 1);
    const rotMatrix = ring.rot ? new THREE.Matrix4().makeRotationFromEuler(ring.rot) : null;

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

      let lx = ring.rx * cosT;
      let ly = 0;
      let lz = ring.rz * sinT + zOffset;

      let nx = cosT;
      let ny = 0;
      let nz = sinT;

      if (rotMatrix) {
        const v = new THREE.Vector3(lx, ly, lz).applyMatrix4(rotMatrix);
        lx = v.x;
        ly = v.y;
        lz = v.z;

        const n = new THREE.Vector3(nx, ny, nz).applyMatrix4(rotMatrix).normalize();
        nx = n.x;
        ny = n.y;
        nz = n.z;
      }

      const vx = ring.center.x + lx;
      const vy = ring.center.y + ly;
      const vz = ring.center.z + lz;

      buf.positions.push(vx, vy, vz);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(s / segments, vCoord);
      pushColor(buf, colorOrTint);
    }
  }

  const stride = segments + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    const ring1 = startVIdx + r * stride;
    const ring2 = startVIdx + (r + 1) * stride;
    const dy = rings[r + 1].center.y - rings[r].center.y;
    const upward = dy > 0;

    for (let s = 0; s < segments; s++) {
      const a = ring1 + s;
      const b = ring2 + s;
      const c = ring2 + s + 1;
      const d = ring1 + s + 1;

      // Ensure outward-facing triangle winding regardless of top-to-bottom or bottom-to-top loft order
      if (upward) {
        buf.indices.push(a, b, d);
        buf.indices.push(b, c, d);
      } else {
        buf.indices.push(a, d, b);
        buf.indices.push(b, d, c);
      }
    }
  }

  const isDescending = rings[0].center.y >= rings[rings.length - 1].center.y;

  // Cap top (highest Y, faces outward +y)
  if (capTop) {
    const topRingIdx = isDescending ? 0 : rings.length - 1;
    const topRing = rings[topRingIdx];
    const topVStart = startVIdx + topRingIdx * stride;
    const cIdx = buf.positions.length / 3;
    buf.positions.push(topRing.center.x, topRing.center.y, topRing.center.z);
    buf.normals.push(0, 1, 0);
    buf.uvs.push(0.5, 0.5);
    pushColor(buf, colorOrTint);

    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, topVStart + s + 1, topVStart + s);
    }
  }

  // Cap bottom (lowest Y, faces outward -y)
  if (capBottom) {
    const botRingIdx = isDescending ? rings.length - 1 : 0;
    const botRing = rings[botRingIdx];
    const botVStart = startVIdx + botRingIdx * stride;
    const cIdx = buf.positions.length / 3;
    buf.positions.push(botRing.center.x, botRing.center.y, botRing.center.z);
    buf.normals.push(0, -1, 0);
    buf.uvs.push(0.5, 0.5);
    pushColor(buf, colorOrTint);

    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, botVStart + s, botVStart + s + 1);
    }
  }
}

/**
 * Appends an ellipsoid with custom semi-axes to a geometry buffer.
 * Uses dedicated top and bottom pole vertices with triangular fans to prevent collapsed degenerate quads.
 */
function addEllipsoid(
  center: THREE.Vector3,
  rx: number,
  ry: number,
  rz: number,
  widthSegs: number,
  heightSegs: number,
  buf: GeometryBuffer,
  colorOrTint: THREE.Color | string | number = 1.0,
  rot?: THREE.Euler
): void {
  const rotMatrix = rot ? new THREE.Matrix4().makeRotationFromEuler(rot) : null;

  // 1. Top Pole vertex (phi = 0)
  const topPoleIdx = buf.positions.length / 3;
  const topPos = new THREE.Vector3(0, ry, 0);
  const topNorm = new THREE.Vector3(0, 1, 0);
  if (rotMatrix) {
    topPos.applyMatrix4(rotMatrix);
    topNorm.applyMatrix4(rotMatrix).normalize();
  }
  buf.positions.push(center.x + topPos.x, center.y + topPos.y, center.z + topPos.z);
  buf.normals.push(topNorm.x, topNorm.y, topNorm.z);
  buf.uvs.push(0.5, 0.0);
  pushColor(buf, colorOrTint);

  // 2. Intermediate rings (phi from y=1 to heightSegs-1)
  const ringStarts: number[] = [];
  for (let y = 1; y < heightSegs; y++) {
    const phi = (y / heightSegs) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    ringStarts.push(buf.positions.length / 3);

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

        const n = new THREE.Vector3(nx, ny, nz).applyMatrix4(rotMatrix).normalize();
        nx = n.x;
        ny = n.y;
        nz = n.z;
      }

      buf.positions.push(center.x + lx, center.y + ly, center.z + lz);
      buf.normals.push(nx, ny, nz);
      buf.uvs.push(x / widthSegs, y / heightSegs);
      pushColor(buf, colorOrTint);
    }
  }

  // 3. Bottom Pole vertex (phi = PI)
  const botPoleIdx = buf.positions.length / 3;
  const botPos = new THREE.Vector3(0, -ry, 0);
  const botNorm = new THREE.Vector3(0, -1, 0);
  if (rotMatrix) {
    botPos.applyMatrix4(rotMatrix);
    botNorm.applyMatrix4(rotMatrix).normalize();
  }
  buf.positions.push(center.x + botPos.x, center.y + botPos.y, center.z + botPos.z);
  buf.normals.push(botNorm.x, botNorm.y, botNorm.z);
  buf.uvs.push(0.5, 1.0);
  pushColor(buf, colorOrTint);

  // 4. Triangles: Top fan (outward winding)
  const firstRingStart = ringStarts[0];
  for (let x = 0; x < widthSegs; x++) {
    buf.indices.push(topPoleIdx, firstRingStart + x + 1, firstRingStart + x);
  }

  // 5. Triangles: Intermediate quads (outward winding)
  for (let y = 0; y < heightSegs - 2; y++) {
    const r1 = ringStarts[y];
    const r2 = ringStarts[y + 1];
    for (let x = 0; x < widthSegs; x++) {
      const a = r1 + x;
      const b = r2 + x;
      const c = r2 + x + 1;
      const d = r1 + x + 1;

      buf.indices.push(a, d, b);
      buf.indices.push(b, d, c);
    }
  }

  // 6. Triangles: Bottom fan (outward winding)
  const lastRingStart = ringStarts[ringStarts.length - 1];
  for (let x = 0; x < widthSegs; x++) {
    buf.indices.push(botPoleIdx, lastRingStart + x, lastRingStart + x + 1);
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
  colorOrTint: THREE.Color | string | number = 1.0
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
      pushColor(buf, colorOrTint);
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
    pushColor(buf, colorOrTint);

    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, startVIdx + s, startVIdx + s + 1);
    }
  }

  if (capEnd) {
    const cIdx = buf.positions.length / 3;
    buf.positions.push(p2.x, p2.y, p2.z);
    buf.normals.push(dir.x, dir.y, dir.z);
    buf.uvs.push(0.5, 0.5);
    pushColor(buf, colorOrTint);

    const endRingStart = startVIdx + stride;
    for (let s = 0; s < segments; s++) {
      buf.indices.push(cIdx, endRingStart + s + 1, endRingStart + s);
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
  colorOrTint: THREE.Color | string | number = 1.0
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
      pushColor(buf, colorOrTint);
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
  colorOrTint: THREE.Color | string | number = 1.0
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
      pushColor(buf, colorOrTint);
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
  // 1. ANATOMICAL HUMAN BODY (Head, Cranium, Face, Torso, Limbs, Hands, Feet)
  // =========================================================================
  const bodyBuf = createBuffer();

  const skinColorObj = new THREE.Color(skinColor);
  const hairColorObj = new THREE.Color(hairColor);
  const vermilionLips = skinColorObj.clone().lerp(new THREE.Color('#b91c1c'), 0.38);

  // --- Anatomically Sculpted Cranium, Jawline, & Facial Mesh ---
  // A single continuous loft from crown to chin apex eliminates disjointed primitives.
  const cranialFaceRings: LoftRing[] = [
    // 1. Crown of head (vertex)
    { center: new THREE.Vector3(0, 1.760, -0.020), rx: 0.052, rz: 0.064 },
    // 2. Cranial vault / parietal apex
    { center: new THREE.Vector3(0, 1.735, -0.018), rx: 0.076, rz: 0.088 },
    // 3. Forehead & frontal bone
    { center: new THREE.Vector3(0, 1.700, -0.014), rx: 0.081, rz: 0.092 },
    // 4. Brow ridge (superciliary arches)
    { center: new THREE.Vector3(0, 1.670, -0.010), rx: 0.080, rz: 0.088, frontOffset: 0.006 },
    // 5. Recessed orbit plane & eye sockets
    { center: new THREE.Vector3(0, 1.652, -0.006), rx: 0.078, rz: 0.085 },
    // 6. Zygomatic arches (cheekbones) & mid-nose
    { center: new THREE.Vector3(0, 1.634, -0.002), rx: 0.074, rz: 0.080, frontOffset: 0.014 },
    // 7. Subnasale & nasal base
    { center: new THREE.Vector3(0, 1.610, 0.005), rx: 0.066, rz: 0.072, frontOffset: 0.016 },
    // 8. Mouth & upper jaw / philtrum
    { center: new THREE.Vector3(0, 1.584, 0.012), rx: 0.058, rz: 0.062, frontOffset: 0.012 },
    // 9. Mentolabial sulcus & lower jaw base
    { center: new THREE.Vector3(0, 1.562, 0.024), rx: 0.046, rz: 0.050 },
    // 10. Chin apex
    { center: new THREE.Vector3(0, 1.542, 0.038), rx: 0.024, rz: 0.026 },
  ];
  addLoftRings(cranialFaceRings, 24, bodyBuf, true, true, skinColorObj);

  // Recessed Eye Sockets & Sculpted Eyes (Left and Right)
  for (const side of [1, -1]) {
    const xEye = side * 0.034;
    // Sclera / Eyeball
    addEllipsoid(
      new THREE.Vector3(xEye, 1.652, 0.066),
      0.009,
      0.007,
      0.006,
      12,
      10,
      bodyBuf,
      new THREE.Color('#f8fafc') // White sclera
    );
    // Iris & Pupil (forward-facing dark center)
    addEllipsoid(
      new THREE.Vector3(xEye, 1.652, 0.071),
      0.0045,
      0.0045,
      0.002,
      8,
      8,
      bodyBuf,
      new THREE.Color('#1e293b') // Deep dark iris
    );
    // Upper eyelid fold
    addEllipsoid(
      new THREE.Vector3(xEye, 1.657, 0.068),
      0.011,
      0.003,
      0.005,
      10,
      6,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.96)
    );
  }

  // Streamlined Anatomical Nose: Dorsal bridge, refined apex, and natural nostril wings
  // Tapers cleanly forward by ~16mm (from eye plane z=0.072 to tip z=0.088)
  addCylinder(
    new THREE.Vector3(0, 1.655, 0.074), // Root at brow
    new THREE.Vector3(0, 1.618, 0.088), // Dorsal apex
    0.0045,
    0.0065,
    10,
    bodyBuf,
    true,
    true,
    skinColorObj.clone().multiplyScalar(0.99)
  );
  // Nose tip lobule
  addEllipsoid(
    new THREE.Vector3(0, 1.616, 0.088),
    0.0065,
    0.0055,
    0.0060,
    10,
    8,
    bodyBuf,
    skinColorObj.clone().multiplyScalar(0.98)
  );
  // Alar base / nostril flares
  for (const side of [1, -1]) {
    addEllipsoid(
      new THREE.Vector3(side * 0.0075, 1.613, 0.082),
      0.0040,
      0.0035,
      0.0045,
      8,
      6,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.97)
    );
  }

  // Naturally Proportioned Vermilion Lips (Cupid's bow upper lip & fuller lower lip)
  addEllipsoid(
    new THREE.Vector3(0, 1.583, 0.072),
    0.015,
    0.0045,
    0.0060,
    12,
    8,
    bodyBuf,
    vermilionLips
  );
  addEllipsoid(
    new THREE.Vector3(0, 1.572, 0.070),
    0.014,
    0.0055,
    0.0065,
    12,
    8,
    bodyBuf,
    vermilionLips
  );

  // Anatomical Pinna & Ear Lobes (Aligned precisely on eye-to-nose horizontal band)
  for (const side of [1, -1]) {
    const earCenter = new THREE.Vector3(side * 0.076, 1.634, -0.010);
    // Outer helix & antihelix
    addEllipsoid(
      earCenter,
      0.008,
      0.022,
      0.014,
      12,
      10,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.96),
      new THREE.Euler(0.12, 0, -side * 0.18)
    );
    // Inner concha hollow
    addEllipsoid(
      new THREE.Vector3(side * 0.074, 1.634, -0.007),
      0.005,
      0.012,
      0.008,
      8,
      8,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.91),
      new THREE.Euler(0.12, 0, -side * 0.18)
    );
  }

  // Modern Styled Haircut (Textured Crop & Tapered Fringe conforming to cranium)
  // Conforms organically to the skull contours with realistic layered volume
  const hairRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.765, -0.020), rx: 0.058, rz: 0.070 }, // Crown top
    { center: new THREE.Vector3(0, 1.745, -0.018), rx: 0.082, rz: 0.092 }, // Mid crown
    { center: new THREE.Vector3(0, 1.715, -0.014), rx: 0.085, rz: 0.095, frontOffset: 0.010 }, // Temples & hairline
    { center: new THREE.Vector3(0, 1.675, -0.012), rx: 0.083, rz: 0.092 }, // Above ears / upper taper
    { center: new THREE.Vector3(0, 1.635, -0.016), rx: 0.079, rz: 0.086 }, // Nape fade line
  ];
  addLoftRings(hairRings, 22, bodyBuf, true, false, hairColorObj);

  // Textured front fringe sweep
  addEllipsoid(
    new THREE.Vector3(0, 1.720, 0.052),
    0.058,
    0.024,
    0.038,
    14,
    10,
    bodyBuf,
    hairColorObj,
    new THREE.Euler(0.20, 0, 0)
  );

  // Sideburn tapers
  for (const side of [1, -1]) {
    addBox(
      new THREE.Vector3(side * 0.076, 1.642, 0.008),
      new THREE.Vector3(0.006, 0.028, 0.014),
      new THREE.Euler(0, 0, 0),
      bodyBuf,
      hairColorObj
    );
  }

  // Cylindrical Neck Loft with Sternocleidomastoid taper and Thyroid prominence
  const neckRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.542, -0.005), rx: 0.052, rz: 0.056 },
    { center: new THREE.Vector3(0, 1.500, -0.005), rx: 0.054, rz: 0.058, frontOffset: 0.006 }, // Adam's apple
    { center: new THREE.Vector3(0, 1.450, -0.005), rx: 0.072, rz: 0.068 },                      // Clavicle base
  ];
  addLoftRings(neckRings, 18, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.98));

  // --- Torso & Pelvis (Anatomical Chest, Clavicles, Abdomen, Gluteals) ---
  const torsoRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.450, -0.010), rx: 0.178, rz: 0.112 },                     // Clavicles / Shoulders
    { center: new THREE.Vector3(0, 1.360, -0.008), rx: 0.165, rz: 0.118, frontOffset: 0.022 }, // Pectoral line
    { center: new THREE.Vector3(0, 1.250, -0.005), rx: 0.152, rz: 0.108 },                     // Lower ribcage
    { center: new THREE.Vector3(0, 1.120, -0.002), rx: 0.138, rz: 0.098, frontOffset: 0.006 }, // Waist & navel
    { center: new THREE.Vector3(0, 0.980, -0.005), rx: 0.150, rz: 0.115, backOffset: 0.024 },  // Iliac crest / Gluteal start
    { center: new THREE.Vector3(0, 0.880, -0.010), rx: 0.158, rz: 0.125, backOffset: 0.032 },  // Hips / Greater trochanters
    { center: new THREE.Vector3(0, 0.820, -0.008), rx: 0.142, rz: 0.110 },                     // Crotch / Pelvic floor
  ];
  addLoftRings(torsoRings, 24, bodyBuf, true, true, skinColorObj);

  // Gluteal muscle volume (left and right buttocks)
  addEllipsoid(new THREE.Vector3(0.074, 0.910, -0.088), 0.072, 0.085, 0.065, 14, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.98));
  addEllipsoid(new THREE.Vector3(-0.074, 0.910, -0.088), 0.072, 0.085, 0.065, 14, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.98));

  // --- Upper Limbs (Natural Relaxed A-Pose: 13° Arm Abduction, Softened Elbows, Sculpted Hands) ---
  const armSides = [1, -1]; // 1 = Right, -1 = Left
  for (const side of armSides) {
    const shoulderX = side * 0.198;
    // Deltoid cap smoothly integrating into shoulder yoke
    addEllipsoid(new THREE.Vector3(shoulderX, 1.425, -0.008), 0.062, 0.074, 0.062, 16, 12, bodyBuf, skinColorObj);

    // Upper Arm (Brachium) lofted along a 13° outward abduction
    const upperArmRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.208, 1.400, -0.008), rx: 0.048, rz: 0.048 },
      { center: new THREE.Vector3(side * 0.228, 1.280, -0.008), rx: 0.045, rz: 0.046, frontOffset: 0.008 },
      { center: new THREE.Vector3(side * 0.248, 1.160, -0.012), rx: 0.040, rz: 0.042 }, // Elbow joint
    ];
    addLoftRings(upperArmRings, 16, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.99));

    // Olecranon elbow prominence
    addEllipsoid(new THREE.Vector3(side * 0.248, 1.155, -0.044), 0.016, 0.018, 0.014, 8, 8, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));

    // Forearm (Antebrachium) tapering naturally to wrist
    const forearmRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.248, 1.150, -0.012), rx: 0.038, rz: 0.040 },
      { center: new THREE.Vector3(side * 0.272, 1.020, -0.010), rx: 0.035, rz: 0.034 },
      { center: new THREE.Vector3(side * 0.292, 0.890, -0.008), rx: 0.028, rz: 0.024 }, // Wrist
    ];
    addLoftRings(forearmRings, 16, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.99));

    // Sculpted Hand (Palm wedge with thenar eminence & 5 distinct articulated fingers in relaxed resting curl)
    const palmCenter = new THREE.Vector3(side * 0.306, 0.825, -0.006);
    // Contoured palm wedge
    addBox(
      palmCenter,
      new THREE.Vector3(0.022, 0.088, 0.044),
      new THREE.Euler(0, 0, side * 0.14),
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.98)
    );
    // Muscular thenar eminence (thumb pad)
    addEllipsoid(
      new THREE.Vector3(side * 0.298, 0.835, 0.016),
      0.012,
      0.018,
      0.012,
      8,
      8,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.97)
    );

    // Abducted Opposed Thumb (2 articulated phalanx segments curving gently toward index)
    addCylinder(
      new THREE.Vector3(side * 0.298, 0.835, 0.016),
      new THREE.Vector3(side * 0.306, 0.795, 0.028),
      0.008,
      0.007,
      8,
      bodyBuf,
      true,
      true,
      skinColorObj.clone().multiplyScalar(0.97)
    );
    addCylinder(
      new THREE.Vector3(side * 0.306, 0.795, 0.028),
      new THREE.Vector3(side * 0.312, 0.765, 0.024),
      0.007,
      0.0055,
      8,
      bodyBuf,
      true,
      true,
      skinColorObj.clone().multiplyScalar(0.96)
    );

    // 4 Articulated Fingers in Relaxed Postural Curl:
    // Index, Middle, Ring, Pinky
    const fingerOffsets = [
      { name: 'index', z: 0.014, len: 0.075, rad: 0.0058, curlZ: -0.006 },
      { name: 'middle', z: 0.004, len: 0.082, rad: 0.0060, curlZ: -0.008 },
      { name: 'ring', z: -0.006, len: 0.076, rad: 0.0056, curlZ: -0.010 },
      { name: 'pinky', z: -0.015, len: 0.064, rad: 0.0050, curlZ: -0.012 },
    ];

    for (const finger of fingerOffsets) {
      const knuckleY = 0.780;
      const knuckleX = side * (0.308 + (finger.z * 0.05));
      const midJointY = knuckleY - finger.len * 0.55;
      const tipY = knuckleY - finger.len;

      // Proximal phalanx
      addCylinder(
        new THREE.Vector3(knuckleX, knuckleY, finger.z),
        new THREE.Vector3(knuckleX + side * 0.003, midJointY, finger.z + finger.curlZ * 0.4),
        finger.rad,
        finger.rad * 0.9,
        8,
        bodyBuf,
        true,
        true,
        skinColorObj.clone().multiplyScalar(0.97)
      );

      // Intermediate & Distal phalanx (soft inward curl)
      addCylinder(
        new THREE.Vector3(knuckleX + side * 0.003, midJointY, finger.z + finger.curlZ * 0.4),
        new THREE.Vector3(knuckleX + side * 0.006, tipY, finger.z + finger.curlZ),
        finger.rad * 0.9,
        finger.rad * 0.75,
        8,
        bodyBuf,
        true,
        true,
        skinColorObj.clone().multiplyScalar(0.96)
      );
    }
  }

  // --- Lower Limbs (Quadriceps, Patellar Knees, Calves, Ankles, Arched Feet with 5° Stance Flare) ---
  const legSides = [1, -1];
  for (const side of legSides) {
    const xLeg = side * 0.092;

    // Thigh & Quadriceps loft
    const thighRings: LoftRing[] = [
      { center: new THREE.Vector3(xLeg, 0.860, -0.008), rx: 0.088, rz: 0.095 },
      { center: new THREE.Vector3(xLeg, 0.720, -0.006), rx: 0.082, rz: 0.086, frontOffset: 0.012 },
      { center: new THREE.Vector3(xLeg, 0.580, -0.004), rx: 0.068, rz: 0.072 },
      { center: new THREE.Vector3(xLeg, 0.500, -0.002), rx: 0.058, rz: 0.060 }, // Knee joint
    ];
    addLoftRings(thighRings, 18, bodyBuf, false, false, skinColorObj);

    // Patella (kneecap) ridge
    addEllipsoid(new THREE.Vector3(xLeg, 0.495, 0.055), 0.024, 0.028, 0.018, 10, 10, bodyBuf, skinColorObj.clone().multiplyScalar(0.98));

    // Lower Leg & Calves (Gastrocnemius & Soleus taper to Achilles tendon)
    const calfRings: LoftRing[] = [
      { center: new THREE.Vector3(xLeg, 0.480, -0.002), rx: 0.056, rz: 0.058 },
      { center: new THREE.Vector3(xLeg, 0.360, -0.008), rx: 0.062, rz: 0.068, backOffset: 0.022 }, // Calf belly
      { center: new THREE.Vector3(xLeg, 0.220, -0.008), rx: 0.046, rz: 0.048 },
      { center: new THREE.Vector3(xLeg, 0.100, -0.005), rx: 0.036, rz: 0.038 }, // Above ankle
    ];
    addLoftRings(calfRings, 18, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.99));

    // Ankle malleoli (lateral and medial prominence)
    addEllipsoid(new THREE.Vector3(xLeg + side * 0.032, 0.082, -0.005), 0.012, 0.015, 0.014, 8, 8, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));
    addEllipsoid(new THREE.Vector3(xLeg - side * 0.028, 0.086, -0.005), 0.012, 0.015, 0.014, 8, 8, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));

    // Arched foot (grounded firmly at y = 0 with natural 5° toe flare)
    const footRot = new THREE.Euler(0, -side * 0.087, 0); // 5° outward flare
    // Heel (calcaneus)
    addEllipsoid(new THREE.Vector3(xLeg, 0.045, -0.052), 0.034, 0.038, 0.045, 12, 10, bodyBuf, skinColorObj.clone().multiplyScalar(0.98), footRot);
    // Midfoot arch & instep
    addEllipsoid(new THREE.Vector3(xLeg, 0.042, 0.025), 0.038, 0.034, 0.060, 12, 10, bodyBuf, skinColorObj.clone().multiplyScalar(0.98), footRot);
    // Forefoot & grouped toes
    addEllipsoid(new THREE.Vector3(xLeg, 0.022, 0.105), 0.042, 0.020, 0.038, 12, 8, bodyBuf, skinColorObj.clone().multiplyScalar(0.96), footRot);
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
      vertexColors: true,
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
  // 2. LAYERED CLOTHING & GARMENTS (Seamless Jacket & Continuous Trousers)
  // =========================================================================
  if (includeClothing) {
    // --- Upper Body: Unified Seamless Fitted Jacket / Shirt ---
    // Seamless full-coverage jacket mesh: bridges continuously across torso, shoulder yoke,
    // integrated neckline collar, and sleeves with zero floating shoulder balls and zero armpit voids.
    const upperBuf = createBuffer();
    const shirtColorObj = new THREE.Color(shirtColor);

    // 1. Unified Torso Shell & Shoulder Yoke Loft:
    // Extends continuously from integrated stand-up neckline collar (y=1.52) through
    // shoulder yoke (y=1.45), thoracic chest, waist, and hip hem (y=0.90) overlapping trousers.
    const jacketTorsoRings: LoftRing[] = [
      // Collar Top Rim
      { center: new THREE.Vector3(0, 1.520, -0.005), rx: 0.066, rz: 0.068 },
      // Integrated Neckline / Collar Base (sits flush against the neck cylinder, radius 0.068m)
      { center: new THREE.Vector3(0, 1.505, -0.005), rx: 0.068, rz: 0.070 },
      // Trapezoid transition
      { center: new THREE.Vector3(0, 1.488, -0.006), rx: 0.138, rz: 0.088 },
      // Clavicular slope bridging into neck base
      { center: new THREE.Vector3(0, 1.465, -0.007), rx: 0.210, rz: 0.112 },
      // Shoulder Yoke: Spans continuously across both shoulders (-0.22m to +0.22m)
      { center: new THREE.Vector3(0, 1.435, -0.008), rx: 0.224, rz: 0.126 },
      // Thoracic chest & underarm junction
      { center: new THREE.Vector3(0, 1.370, -0.008), rx: 0.182, rz: 0.134, frontOffset: 0.022 },
      // Mid-chest / ribcage
      { center: new THREE.Vector3(0, 1.240, -0.004), rx: 0.168, rz: 0.124 },
      // Waist
      { center: new THREE.Vector3(0, 1.100, -0.002), rx: 0.154, rz: 0.116, frontOffset: 0.008 },
      // Lower waist & hips
      { center: new THREE.Vector3(0, 0.960, -0.005), rx: 0.166, rz: 0.130, backOffset: 0.024 },
      // Hip hem (overlaps trousers waistband cleanly)
      { center: new THREE.Vector3(0, 0.900, -0.006), rx: 0.170, rz: 0.134, backOffset: 0.026 },
    ];
    addLoftRings(jacketTorsoRings, 26, upperBuf, false, false, shirtColorObj);

    // Integrated folded collar trim (snugly hugs the neckline at y=1.505)
    addTorus(
      new THREE.Vector3(0, 1.508, -0.005),
      0.067,
      0.007,
      12,
      26,
      new THREE.Euler(Math.PI / 2 + 0.10, 0, 0),
      upperBuf,
      shirtColorObj.clone().multiplyScalar(0.90)
    );

    // Front placket seam & metallic zipper closure
    addBox(
      new THREE.Vector3(0, 1.205, 0.136),
      new THREE.Vector3(0.022, 0.590, 0.008),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      shirtColorObj.clone().multiplyScalar(0.85)
    );
    // Metallic zipper slider pull
    addBox(
      new THREE.Vector3(0, 1.340, 0.144),
      new THREE.Vector3(0.016, 0.028, 0.012),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      new THREE.Color('#94a3b8')
    );

    // 2. Seamless Sleeves in Relaxed A-Pose:
    // Starts directly at shoulder seam (y=1.430, x=±0.210), nested seamlessly into the shoulder yoke,
    // and tapers smoothly down to wrist cuffs with zero gaps.
    for (const side of armSides) {
      const sleeveRings: LoftRing[] = [
        // Shoulder armhole seam (fully nested inside shoulder yoke rx=0.224)
        { center: new THREE.Vector3(side * 0.210, 1.430, -0.008), rx: 0.066, rz: 0.066 },
        { center: new THREE.Vector3(side * 0.232, 1.280, -0.008), rx: 0.058, rz: 0.058 },
        { center: new THREE.Vector3(side * 0.252, 1.155, -0.012), rx: 0.052, rz: 0.054 }, // Elbow
        { center: new THREE.Vector3(side * 0.276, 1.020, -0.010), rx: 0.046, rz: 0.046 },
        { center: new THREE.Vector3(side * 0.296, 0.895, -0.008), rx: 0.040, rz: 0.038 }, // Wrist cuff
      ];
      addLoftRings(sleeveRings, 18, upperBuf, false, false, shirtColorObj.clone().multiplyScalar(0.98));

      // Calculate orientation quaternion aligning circular cross-section with the relaxed A-pose arm trajectory
      const armDir = new THREE.Vector3(side * 0.086, -0.535, 0).normalize();
      const armRot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), armDir)
      );

      // Shoulder armhole piping welt seam (cleanly delineates shoulder and sleeve, perpendicular to arm axis)
      addTorus(
        new THREE.Vector3(side * 0.212, 1.428, -0.008),
        0.064,
        0.005,
        10,
        20,
        armRot,
        upperBuf,
        shirtColorObj.clone().multiplyScalar(0.88)
      );

      // Folded sleeve cuff band at wrist (perpendicular to arm axis, cleanly encircling wrist)
      addTorus(
        new THREE.Vector3(side * 0.296, 0.895, -0.008),
        0.038,
        0.006,
        10,
        18,
        armRot,
        upperBuf,
        shirtColorObj.clone().multiplyScalar(0.88)
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
        vertexColors: true,
      }
    );
    allItems.push(clothingUpperItem);

    // --- Lower Body: Unified Continuous Trousers (Denim Jeans) ---
    // Continuous crotch junction: Pelvis waistband starts at y=1.01m, encases the hips and seat
    // continuously down to y=0.82m where it seamlessly bifurcates into the left and right legs.
    // Zero horizontal gaps, zero exposed thigh gaps.
    const lowerBuf = createBuffer();
    const pantsColorObj = new THREE.Color(pantsColor);

    // 1. Pelvic Shell & Waistband (Starts at y=1.01m down to crotch fork y=0.81m)
    const pelvicPantsRings: LoftRing[] = [
      { center: new THREE.Vector3(0, 1.010, -0.004), rx: 0.165, rz: 0.126 },                     // Waistband top (open for torso)
      { center: new THREE.Vector3(0, 0.960, -0.006), rx: 0.169, rz: 0.132, backOffset: 0.024 },  // Waistband lower seam
      { center: new THREE.Vector3(0, 0.890, -0.008), rx: 0.176, rz: 0.138, backOffset: 0.032 },  // Hips & gluteals
      { center: new THREE.Vector3(0, 0.840, -0.008), rx: 0.170, rz: 0.132, backOffset: 0.020 },  // Lower pelvic seat
      { center: new THREE.Vector3(0, 0.810, -0.008), rx: 0.156, rz: 0.120 },                     // Crotch bifurcation fork
    ];
    addLoftRings(pelvicPantsRings, 26, lowerBuf, false, false, pantsColorObj.clone().multiplyScalar(0.96));

    // Continuous crotch saddle / perineal bridge gusset:
    // Smoothly and seamlessly seals the crotch junction between the legs with 100% outward-facing curvature
    addEllipsoid(
      new THREE.Vector3(0, 0.815, -0.008),
      0.055,
      0.032,
      0.075,
      14,
      10,
      lowerBuf,
      pantsColorObj.clone().multiplyScalar(0.92)
    );

    // Front fly seam & brass button
    addBox(
      new THREE.Vector3(0, 0.940, 0.138),
      new THREE.Vector3(0.018, 0.120, 0.006),
      new THREE.Euler(0, 0, 0),
      lowerBuf,
      pantsColorObj.clone().multiplyScalar(0.85)
    );
    addEllipsoid(new THREE.Vector3(0, 1.000, 0.134), 0.008, 0.008, 0.005, 8, 8, lowerBuf, new THREE.Color('#d97706'));

    // 5 Belt loops
    const beltLoopAngles = [0.45, -0.45, 1.45, -1.45, Math.PI];
    for (const ang of beltLoopAngles) {
      const lx = 0.163 * Math.cos(ang);
      const lz = 0.125 * Math.sin(ang);
      addBox(
        new THREE.Vector3(lx, 0.985, lz),
        new THREE.Vector3(0.012, 0.045, 0.006),
        new THREE.Euler(0, -ang, 0),
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.88)
      );
    }

    // 2. Continuous Left & Right Trouser Legs:
    // Starts at y=0.840m (fully overlapping inside the pelvic seat and crotch saddle),
    // extending down through thighs, knees with flexion folds, calves, and ankle cuffs at y=0.10m.
    for (const side of legSides) {
      const xLeg = side * 0.090;

      const legRings: LoftRing[] = [
        // Upper leg base deeply nested in pelvic seat (rx=0.096 reaches past midline x=0 to seal crotch fork)
        { center: new THREE.Vector3(xLeg, 0.840, -0.008), rx: 0.098, rz: 0.104 },
        { center: new THREE.Vector3(xLeg, 0.720, -0.006), rx: 0.090, rz: 0.096, frontOffset: 0.012 },
        { center: new THREE.Vector3(xLeg, 0.580, -0.004), rx: 0.076, rz: 0.082 },
        // Knee flexion crease folds
        { center: new THREE.Vector3(xLeg, 0.520, -0.002), rx: 0.070, rz: 0.074, frontOffset: 0.010 },
        { center: new THREE.Vector3(xLeg, 0.480, -0.002), rx: 0.068, rz: 0.072, frontOffset: 0.008 },
        { center: new THREE.Vector3(xLeg, 0.360, -0.006), rx: 0.070, rz: 0.076, backOffset: 0.018 },
        { center: new THREE.Vector3(xLeg, 0.220, -0.006), rx: 0.056, rz: 0.058 },
        { center: new THREE.Vector3(xLeg, 0.110, -0.004), rx: 0.050, rz: 0.052 }, // Ankle hem
      ];
      addLoftRings(legRings, 18, lowerBuf, false, true, pantsColorObj);

      // Trouser rolled bottom cuff hem
      addTorus(
        new THREE.Vector3(xLeg, 0.110, -0.004),
        0.050,
        0.006,
        10,
        18,
        new THREE.Euler(Math.PI / 2, 0, 0),
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.88)
      );

      // Lateral outseam running down outside of trousers
      addCylinder(
        new THREE.Vector3(xLeg + side * 0.092, 0.840, -0.008),
        new THREE.Vector3(xLeg + side * 0.048, 0.110, -0.004),
        0.004,
        0.004,
        6,
        lowerBuf,
        true,
        true,
        pantsColorObj.clone().multiplyScalar(0.80)
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
        vertexColors: true,
      }
    );
    allItems.push(clothingLowerItem);

    clothingVerts = (upperBuf.positions.length + lowerBuf.positions.length) / 3;
    clothingTris = (upperBuf.indices.length + lowerBuf.indices.length) / 3;

    // --- Footwear: Sculpted Street Sneakers with Bevelled Outsole & Contoured Midsole ---
    const shoesBuf = createBuffer();
    const shoesColorObj = new THREE.Color(shoesColor);

    for (const side of legSides) {
      const xFoot = side * 0.092;
      const footRot = new THREE.Euler(0, -side * 0.087, 0); // 5° toe flare matching foot stance

      // 1. Curved bevelled vulcanized rubber outsole (flat ground contact plane at y = 0.00m)
      addBox(
        new THREE.Vector3(xFoot, 0.007, 0.038),
        new THREE.Vector3(0.092, 0.014, 0.252),
        footRot,
        shoesBuf,
        new THREE.Color('#1e293b') // Dark vulcanized tread
      );

      // 2. Sculpted cushioned EVA midsole wedge (cushioning wedge elevating heel to y = 0.038m)
      addBox(
        new THREE.Vector3(xFoot, 0.024, 0.036),
        new THREE.Vector3(0.088, 0.020, 0.246),
        footRot,
        shoesBuf,
        new THREE.Color('#f8fafc') // Crisp contrast sail midsole
      );

      // 3. Contoured sneaker upper loft encasing foot from midsole to padded ankle collar
      const sneakerUpperRings: LoftRing[] = [
        { center: new THREE.Vector3(xFoot, 0.125, -0.004), rx: 0.048, rz: 0.052, rot: footRot }, // Padded collar
        { center: new THREE.Vector3(xFoot, 0.088, 0.010), rx: 0.048, rz: 0.068, rot: footRot },
        { center: new THREE.Vector3(xFoot, 0.052, 0.035), rx: 0.046, rz: 0.112, frontOffset: 0.022, rot: footRot },
        { center: new THREE.Vector3(xFoot, 0.034, 0.042), rx: 0.045, rz: 0.122, rot: footRot },
      ];
      addLoftRings(sneakerUpperRings, 18, shoesBuf, false, true, shoesColorObj);

      // 4. Curved structured toe cap rand (rotated cleanly around foot stance center)
      const toeRandCenter = new THREE.Vector3(0, 0.034, 0.134).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
      addEllipsoid(
        toeRandCenter,
        0.044,
        0.022,
        0.034,
        12,
        10,
        shoesBuf,
        shoesColorObj.clone().multiplyScalar(0.85),
        footRot
      );

      // 5. Padded shoe tongue rising up the instep (aligned with foot flare)
      const tongueCenter = new THREE.Vector3(0, 0.088, 0.044).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
      addBox(
        tongueCenter,
        new THREE.Vector3(0.034, 0.082, 0.014),
        new THREE.Euler(0.46, -side * 0.087, 0, 'YXZ'),
        shoesBuf,
        shoesColorObj.clone().multiplyScalar(0.92)
      );

      // 6. Cross-laced eyelets and crisp laces (angled with 5° foot flare)
      for (let laceIdx = 0; laceIdx < 4; laceIdx++) {
        const lz = 0.036 + laceIdx * 0.022;
        const ly = 0.055 + laceIdx * 0.018;
        const pLace1 = new THREE.Vector3(-0.018, ly, lz).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
        const pLace2 = new THREE.Vector3(+0.018, ly, lz).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
        addCylinder(
          pLace1,
          pLace2,
          0.003,
          0.003,
          6,
          shoesBuf,
          true,
          true,
          new THREE.Color('#f1f5f9')
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
        vertexColors: true,
      }
    );
    allItems.push(footwearItem);

    footwearVerts = shoesBuf.positions.length / 3;
    footwearTris = shoesBuf.indices.length / 3;
  }

  // =========================================================================
  // 3. HIGH-PRECISION ACCESSORIES (Sleek Eyewear, Smartwatch & Leather Belt)
  // =========================================================================
  if (includeAccessories) {
    const accBuf = createBuffer();

    const glassesColorObj = new THREE.Color(glassesColor);
    const watchColorObj = new THREE.Color(watchColor);

    // --- Sleek Modern Eyewear (Wayfarer / Rectangular frames hugging face at realistic depth) ---
    // Sits naturally at z=0.082m (~15mm in front of eye plane), resting securely on nasal bridge and ears
    for (const side of [1, -1]) {
      const xEye = side * 0.034;
      const eyeZ = 0.082; // Exactly 15mm forward from anatomical eye plane (z=0.067m)

      // Modern sleek frame rim (4 rounded rectangular border segments)
      // Top bar
      addBox(
        new THREE.Vector3(xEye, 1.662, eyeZ),
        new THREE.Vector3(0.032, 0.003, 0.004),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );
      // Bottom bar
      addBox(
        new THREE.Vector3(xEye, 1.642, eyeZ),
        new THREE.Vector3(0.032, 0.003, 0.004),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );
      // Lateral outer bar
      addBox(
        new THREE.Vector3(xEye + side * 0.016, 1.652, eyeZ),
        new THREE.Vector3(0.003, 0.020, 0.004),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );
      // Medial inner bar
      addBox(
        new THREE.Vector3(xEye - side * 0.016, 1.652, eyeZ),
        new THREE.Vector3(0.003, 0.020, 0.004),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );

      // Sleek Tinted Glass Lens
      addEllipsoid(
        new THREE.Vector3(xEye, 1.652, eyeZ),
        0.014,
        0.009,
        0.0015,
        10,
        8,
        accBuf,
        new THREE.Color('#334155') // Deep polarized tint
      );

      // Thin streamlined temple arms running back to rest over the ear pinnae
      addCylinder(
        new THREE.Vector3(xEye + side * 0.016, 1.660, eyeZ - 0.002),
        new THREE.Vector3(side * 0.076, 1.642, -0.010),
        0.0018,
        0.0018,
        6,
        accBuf,
        true,
        true,
        glassesColorObj
      );
    }

    // Sleek contoured nasal bridge connector (sits naturally on dorsal nose apex)
    addBox(
      new THREE.Vector3(0, 1.658, 0.082),
      new THREE.Vector3(0.018, 0.0025, 0.003),
      new THREE.Euler(0, 0, 0),
      accBuf,
      glassesColorObj
    );

    // --- Smart Watch / Wristwatch (on Left Wrist in Relaxed A-Pose) ---
    // Positioned at the relaxed forearm wrist center (-0.292, 0.902, -0.008)
    const watchCenter = new THREE.Vector3(-0.292, 0.902, -0.008);
    // Metallic bezel casing
    addCylinder(
      new THREE.Vector3(-0.292, 0.902, -0.014),
      new THREE.Vector3(-0.292, 0.902, -0.002),
      0.018,
      0.018,
      18,
      accBuf,
      true,
      true,
      watchColorObj // Brushed titanium/silver
    );

    // Sapphire display glass screen
    addEllipsoid(
      new THREE.Vector3(-0.292, 0.902, -0.001),
      0.015,
      0.015,
      0.002,
      12,
      10,
      accBuf,
      new THREE.Color('#0f172a') // Dark sapphire display glass
    );

    // Crown dial button on side
    addCylinder(
      new THREE.Vector3(-0.292, 0.918, -0.008),
      new THREE.Vector3(-0.292, 0.924, -0.008),
      0.0035,
      0.0035,
      8,
      accBuf,
      true,
      true,
      watchColorObj.clone().multiplyScalar(1.1)
    );

    // Fitted wrist strap wrapping around wrist circumference, perpendicular to left arm trajectory
    const leftArmDir = new THREE.Vector3(-0.086, -0.535, 0).normalize();
    const leftArmRot = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), leftArmDir)
    );
    addTorus(
      watchCenter,
      0.035,
      0.006,
      8,
      18,
      leftArmRot,
      accBuf,
      new THREE.Color('#1e293b') // Dark silicone/leather strap
    );

    // --- Leather Belt & Metallic Buckle ---
    // Waist belt band wrapping around jeans waistband at y=0.995m
    addTorus(
      new THREE.Vector3(0, 0.995, -0.005),
      0.158,
      0.010,
      10,
      26,
      new THREE.Euler(Math.PI / 2, 0, 0),
      accBuf,
      new THREE.Color('#451a03') // Rich dark leather belt
    );

    // Rectangular metallic buckle at center front
    const buckleCenter = new THREE.Vector3(0, 0.995, 0.148);
    // Outer frame (4 border bars)
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y + 0.020, buckleCenter.z),
      new THREE.Vector3(0.046, 0.006, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y - 0.020, buckleCenter.z),
      new THREE.Vector3(0.046, 0.006, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    addBox(
      new THREE.Vector3(buckleCenter.x - 0.022, buckleCenter.y, buckleCenter.z),
      new THREE.Vector3(0.006, 0.036, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    addBox(
      new THREE.Vector3(buckleCenter.x + 0.022, buckleCenter.y, buckleCenter.z),
      new THREE.Vector3(0.006, 0.036, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
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
      new THREE.Color('#cbd5e1')
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
