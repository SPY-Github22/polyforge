import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';
import { applySubdivisionRefinement } from './geometry';

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
 * Evaluates standard cubic Catmull-Rom spline interpolation for scalar values.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Interpolates key loft cross-sectional rings using C1 continuous Catmull-Rom splines,
 * generating high-density intermediate anatomical rings without polygonal flat ridges.
 */
export function interpolateLoftRings(keyRings: LoftRing[], subdivisionsPerSpan = 3): LoftRing[] {
  if (keyRings.length < 2 || subdivisionsPerSpan <= 1) return keyRings;
  const result: LoftRing[] = [];
  const n = keyRings.length;

  for (let i = 0; i < n - 1; i++) {
    const r0 = keyRings[Math.max(0, i - 1)];
    const r1 = keyRings[i];
    const r2 = keyRings[i + 1];
    const r3 = keyRings[Math.min(n - 1, i + 2)];

    for (let s = 0; s < subdivisionsPerSpan; s++) {
      const t = s / subdivisionsPerSpan;
      if (t === 0) {
        result.push(r1);
      } else {
        const cx = catmullRom(r0.center.x, r1.center.x, r2.center.x, r3.center.x, t);
        const cy = catmullRom(r0.center.y, r1.center.y, r2.center.y, r3.center.y, t);
        const cz = catmullRom(r0.center.z, r1.center.z, r2.center.z, r3.center.z, t);
        const rx = catmullRom(r0.rx, r1.rx, r2.rx, r3.rx, t);
        const rz = catmullRom(r0.rz, r1.rz, r2.rz, r3.rz, t);
        const fo = catmullRom(r0.frontOffset || 0, r1.frontOffset || 0, r2.frontOffset || 0, r3.frontOffset || 0, t);
        const bo = catmullRom(r0.backOffset || 0, r1.backOffset || 0, r2.backOffset || 0, r3.backOffset || 0, t);

        let rot: THREE.Euler | undefined;
        if (r1.rot && r2.rot) {
          rot = new THREE.Euler(
            catmullRom(r0.rot?.x || 0, r1.rot.x, r2.rot.x, r3.rot?.x || 0, t),
            catmullRom(r0.rot?.y || 0, r1.rot.y, r2.rot.y, r3.rot?.y || 0, t),
            catmullRom(r0.rot?.z || 0, r1.rot.z, r2.rot.z, r3.rot?.z || 0, t)
          );
        }

        result.push({
          center: new THREE.Vector3(cx, cy, cz),
          rx: Math.max(0.001, rx),
          rz: Math.max(0.001, rz),
          frontOffset: Math.abs(fo) > 1e-5 ? fo : undefined,
          backOffset: Math.abs(bo) > 1e-5 ? bo : undefined,
          rot,
        });
      }
    }
  }
  result.push(keyRings[n - 1]);
  return result;
}

function getItemStats(item?: SceneItem): { verts: number; tris: number } {
  if (!item?.geometryParams?.customGeometry?.positions) return { verts: 0, tris: 0 };
  const pos = item.geometryParams.customGeometry.positions;
  const idx = item.geometryParams.customGeometry.indices;
  const verts = pos.length / 3;
  const tris = idx ? idx.length / 3 : verts / 3;
  return { verts, tris };
}

/**
 * Sweeps an organic loft across a sequence of anatomical cross-sectional rings with
 * high-resolution radial discretization and consistent outward triangle winding.
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
 * Optionally applies Catmull-Clark / subdivision refinement if requested.
 */
function bufferToSceneItem(
  id: string,
  name: string,
  buf: GeometryBuffer,
  material: MaterialProperties,
  subdivide = false
): SceneItem {
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  if (buf.colors && buf.colors.length === buf.positions.length) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  }
  geo.setIndex(buf.indices);
  geo.computeVertexNormals();
  geo.normalizeNormals();

  if (subdivide) {
    geo = applySubdivisionRefinement(geo, 1);
  }

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const positionsArr = Array.from(posAttr.array as Float32Array);
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  const normalsArr = Array.from(normAttr.array as Float32Array);

  const colorsAttr = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  const colorsArr = colorsAttr ? Array.from(colorsAttr.array as Float32Array) : undefined;

  let indicesArr: number[] | undefined;
  if (geo.index) {
    indicesArr = Array.from(geo.index.array as Uint16Array | Uint32Array);
  } else {
    indicesArr = Array.from({ length: posAttr.count }, (_, i) => i);
  }

  const uvsArr =
    buf.uvs.length === (buf.positions.length / 3) * 2 && !subdivide
      ? buf.uvs
      : new Array((positionsArr.length / 3) * 2).fill(0);

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
        positions: positionsArr,
        normals: normalsArr,
        uvs: uvsArr,
        indices: indicesArr,
        colors: colorsArr && colorsArr.length === positionsArr.length ? colorsArr : undefined,
      },
    },
    visible: true,
    locked: false,
  };
}

/**
 * Generates an ultra-realistic, anatomically proportioned procedural 3D human model.
 * Proportions: 7.8 heads tall, total height ~1.78m, standing firmly grounded on the floor (y = 0).
 * Features high polygon & vertex density (35,000 - 70,000+ vertices), continuous enclosed garments,
 * sculpted facial anatomy, articulated 5-finger hands, and PBR textures.
 */
export function generateRealisticHumanScene(
  options: RealisticHumanOptions = {}
): RealisticHumanResult {
  const includeClothing = options.includeClothing ?? true;
  const includeAccessories = options.includeAccessories ?? true;
  const shouldSubdivide = options.subdivide ?? false;

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
  const vermilionLips = skinColorObj.clone().lerp(new THREE.Color('#b91c1c'), 0.45);

  // --- Anatomically Sculpted Cranium, Jawline, & Facial Mesh ---
  // Smoothly lofted domed cranial hemisphere (rx = 0.082, ry = 0.098, rz = 0.095)
  // Continuous jawline transitioning organically into neck and clavicular base.
  const cranialFaceKeyRings: LoftRing[] = [
    // 1. Crown apex cap (highest point y = 1.760, normal pointing +y)
    { center: new THREE.Vector3(0, 1.760, -0.015), rx: 0.020, rz: 0.024 },
    // 2. Superior cranial vault (lofting domed hemisphere rx=0.082, ry=0.098, rz=0.095)
    { center: new THREE.Vector3(0, 1.748, -0.015), rx: 0.048, rz: 0.056 },
    // 3. Parietal eminence / upper cranial curve
    { center: new THREE.Vector3(0, 1.730, -0.014), rx: 0.068, rz: 0.078 },
    // 4. Upper forehead / frontal squama
    { center: new THREE.Vector3(0, 1.705, -0.012), rx: 0.078, rz: 0.088 },
    // 5. Brow ridge (superciliary arches & glabella)
    { center: new THREE.Vector3(0, 1.675, -0.008), rx: 0.082, rz: 0.095, frontOffset: 0.004 },
    // 6. Recessed orbit plane & eye sockets
    { center: new THREE.Vector3(0, 1.650, -0.006), rx: 0.076, rz: 0.082 },
    // 7. Zygomatic arches (cheekbones) & mid-face
    { center: new THREE.Vector3(0, 1.625, -0.004), rx: 0.070, rz: 0.074, frontOffset: 0.006 },
    // 8. Subnasale & upper maxilla base
    { center: new THREE.Vector3(0, 1.602, -0.002), rx: 0.062, rz: 0.066, frontOffset: 0.006 },
    // 9. Mouth & upper jaw / philtrum
    { center: new THREE.Vector3(0, 1.580, 0.004), rx: 0.052, rz: 0.060, frontOffset: 0.006 },
    // 10. Mentolabial sulcus & curved mandibular jaw arch
    { center: new THREE.Vector3(0, 1.560, 0.008), rx: 0.044, rz: 0.052 },
    // 11. Chin apex (downward vertex cap at y = 1.542, meeting neck loft cleanly)
    { center: new THREE.Vector3(0, 1.542, 0.012), rx: 0.030, rz: 0.038, frontOffset: 0.008 },
  ];
  const cranialFaceRings = interpolateLoftRings(cranialFaceKeyRings, 4);
  addLoftRings(cranialFaceRings, 56, bodyBuf, true, true, skinColorObj);

  // Recessed Eye Sockets & Sculpted Eyes (Left and Right)
  for (const side of [1, -1]) {
    const xEye = side * 0.034;
    // High-resolution White Sclera / Eyeball (24 x 18 segments)
    addEllipsoid(
      new THREE.Vector3(xEye, 1.650, 0.064),
      0.0095,
      0.0080,
      0.0075,
      24,
      18,
      bodyBuf,
      new THREE.Color('#f8fafc')
    );
    // Deep dark iris disk (20 x 16 segments)
    addEllipsoid(
      new THREE.Vector3(xEye, 1.650, 0.070),
      0.0052,
      0.0052,
      0.0025,
      20,
      16,
      bodyBuf,
      new THREE.Color('#1e293b')
    );
    // Forward pupil aperture
    addEllipsoid(
      new THREE.Vector3(xEye, 1.650, 0.0715),
      0.0026,
      0.0026,
      0.0015,
      16,
      12,
      bodyBuf,
      new THREE.Color('#020617')
    );
    // Corneal specular glint highlight
    addEllipsoid(
      new THREE.Vector3(xEye + side * 0.0018, 1.652, 0.0722),
      0.0015,
      0.0015,
      0.0010,
      10,
      8,
      bodyBuf,
      new THREE.Color('#ffffff')
    );
    // Sculpted upper eyelid fold arch
    addEllipsoid(
      new THREE.Vector3(xEye, 1.656, 0.067),
      0.0130,
      0.0042,
      0.0065,
      20,
      12,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.96)
    );
    // Sculpted lower eyelid margin
    addEllipsoid(
      new THREE.Vector3(xEye, 1.644, 0.067),
      0.0120,
      0.0032,
      0.0060,
      18,
      10,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.95)
    );
    // Supraorbital Eyebrow arch
    addCylinder(
      new THREE.Vector3(side * 0.018, 1.666, 0.076),
      new THREE.Vector3(side * 0.052, 1.664, 0.068),
      0.0025,
      0.0015,
      12,
      bodyBuf,
      true,
      true,
      hairColorObj
    );
  }

  // Streamlined Anatomical Nose: Dorsal bridge, supratip break, apex lobule, and alar wings
  // Protrudes forward from face plane (z = 0.072 to 0.090m)
  addCylinder(
    new THREE.Vector3(0, 1.660, 0.072), // Root at brow
    new THREE.Vector3(0, 1.616, 0.088), // Dorsal apex
    0.0048,
    0.0068,
    16,
    bodyBuf,
    true,
    true,
    skinColorObj.clone().multiplyScalar(0.99)
  );
  // Nose tip lobule (apex)
  addEllipsoid(
    new THREE.Vector3(0, 1.614, 0.089),
    0.0075,
    0.0065,
    0.0075,
    20,
    16,
    bodyBuf,
    skinColorObj.clone().multiplyScalar(0.98)
  );
  // Alar base / nostril flares & apertures
  for (const side of [1, -1]) {
    addEllipsoid(
      new THREE.Vector3(side * 0.010, 1.610, 0.078),
      0.0050,
      0.0040,
      0.0055,
      16,
      12,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.97)
    );
    // Subnasal aperture facing down into nostril base
    addEllipsoid(
      new THREE.Vector3(side * 0.005, 1.606, 0.078),
      0.0020,
      0.0014,
      0.0028,
      12,
      10,
      bodyBuf,
      new THREE.Color('#0f172a') // Dark nostril aperture
    );
  }
  // Columella tissue pillar separating nostrils
  addCylinder(
    new THREE.Vector3(0, 1.606, 0.078),
    new THREE.Vector3(0, 1.612, 0.085),
    0.0024,
    0.0024,
    10,
    bodyBuf,
    true,
    true,
    skinColorObj.clone().multiplyScalar(0.97)
  );

  // Naturally Proportioned Vermilion Lips & Philtrum Column
  // Philtrum column ridges
  for (const side of [1, -1]) {
    addCylinder(
      new THREE.Vector3(side * 0.0035, 1.606, 0.073),
      new THREE.Vector3(side * 0.0035, 1.585, 0.073),
      0.0012,
      0.0012,
      8,
      bodyBuf,
      true,
      true,
      skinColorObj.clone().multiplyScalar(0.98)
    );
  }
  // Upper lip (Cupid's bow with central tubercle)
  addEllipsoid(
    new THREE.Vector3(0, 1.583, 0.074),
    0.016,
    0.0042,
    0.0055,
    24,
    14,
    bodyBuf,
    vermilionLips
  );
  addEllipsoid(
    new THREE.Vector3(0, 1.581, 0.076),
    0.0045,
    0.0035,
    0.0035,
    14,
    10,
    bodyBuf,
    vermilionLips
  );
  // Lower lip (fuller with natural cushion)
  addEllipsoid(
    new THREE.Vector3(0, 1.572, 0.073),
    0.015,
    0.0052,
    0.0060,
    24,
    14,
    bodyBuf,
    vermilionLips
  );
  for (const side of [1, -1]) {
    addEllipsoid(
      new THREE.Vector3(side * 0.006, 1.572, 0.074),
      0.0055,
      0.0045,
      0.0048,
      14,
      10,
      bodyBuf,
      vermilionLips
    );
  }

  // Chin pad prominence (softened natural chin)
  addEllipsoid(
    new THREE.Vector3(0, 1.545, 0.046),
    0.014,
    0.010,
    0.012,
    18,
    14,
    bodyBuf,
    skinColorObj.clone().multiplyScalar(0.99)
  );

  // Anatomical Pinna & Ear Lobes (Helix, Antihelix, Tragus, Concha, Lobule)
  for (const side of [1, -1]) {
    const earCenter = new THREE.Vector3(side * 0.076, 1.634, -0.010);
    // Outer helix & antihelix
    addEllipsoid(
      earCenter,
      0.009,
      0.024,
      0.016,
      20,
      16,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.96),
      new THREE.Euler(0.12, 0, -side * 0.18)
    );
    // Inner concha hollow
    addEllipsoid(
      new THREE.Vector3(side * 0.074, 1.634, -0.007),
      0.0055,
      0.014,
      0.009,
      16,
      12,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.91),
      new THREE.Euler(0.12, 0, -side * 0.18)
    );
    // Tragus prominence
    addEllipsoid(
      new THREE.Vector3(side * 0.068, 1.632, 0.004),
      0.0035,
      0.0050,
      0.0040,
      12,
      10,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.96)
    );
    // Ear lobule
    addEllipsoid(
      new THREE.Vector3(side * 0.075, 1.616, -0.008),
      0.0065,
      0.0080,
      0.0070,
      14,
      12,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.95),
      new THREE.Euler(0.12, 0, -side * 0.18)
    );
  }

  // Modern Styled Layered Hair Mesh: Organically conforms to skull with natural textured flow
  // 1. Conforming cranial hair dome loft from crown (y=1.768) to upper hairline (y=1.704)
  const hairCrownKeyRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.768, -0.015), rx: 0.038, rz: 0.046 }, // Crown top
    { center: new THREE.Vector3(0, 1.750, -0.015), rx: 0.066, rz: 0.078 }, // Mid crown
    { center: new THREE.Vector3(0, 1.730, -0.014), rx: 0.084, rz: 0.094 }, // Upper cranium
    { center: new THREE.Vector3(0, 1.708, -0.012), rx: 0.085, rz: 0.095 }, // Hairline perimeter
    { center: new THREE.Vector3(0, 1.704, -0.012), rx: 0.076, rz: 0.088 }, // Conforms flush to scalp
  ];
  const hairCrownRings = interpolateLoftRings(hairCrownKeyRings, 4);
  addLoftRings(hairCrownRings, 48, bodyBuf, true, false, hairColorObj);

  // 2. Posterior & Temporal Hair Volume (hugging back and sides down to neck nape, keeping forehead/eyes clear)
  const hairNapeKeyRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.705, -0.022), rx: 0.086, rz: 0.076, backOffset: 0.020 },
    { center: new THREE.Vector3(0, 1.665, -0.028), rx: 0.084, rz: 0.070, backOffset: 0.020 },
    { center: new THREE.Vector3(0, 1.625, -0.034), rx: 0.080, rz: 0.062, backOffset: 0.018 },
    { center: new THREE.Vector3(0, 1.590, -0.038), rx: 0.070, rz: 0.052, backOffset: 0.016 },
  ];
  const hairNapeRings = interpolateLoftRings(hairNapeKeyRings, 4);
  addLoftRings(hairNapeRings, 40, bodyBuf, false, true, hairColorObj);

  // 3. Modern styled layered locks:
  // Front hair fringe sweep: angled textured quiff lock conforming cleanly along hairline
  addEllipsoid(
    new THREE.Vector3(0.008, 1.716, 0.048),
    0.042,
    0.012,
    0.018,
    22,
    16,
    bodyBuf,
    hairColorObj,
    new THREE.Euler(0.14, 0.06, -0.04)
  );
  // Parietal layered crown sweeps
  addEllipsoid(
    new THREE.Vector3(0.032, 1.748, -0.010),
    0.046,
    0.018,
    0.042,
    20,
    14,
    bodyBuf,
    hairColorObj,
    new THREE.Euler(0.12, 0.10, -0.08)
  );
  addEllipsoid(
    new THREE.Vector3(-0.032, 1.748, -0.010),
    0.046,
    0.018,
    0.042,
    20,
    14,
    bodyBuf,
    hairColorObj,
    new THREE.Euler(0.12, -0.10, 0.08)
  );

  // Sideburn tapers conforming flush to skull
  for (const side of [1, -1]) {
    addEllipsoid(
      new THREE.Vector3(side * 0.074, 1.636, 0.004),
      0.004,
      0.015,
      0.008,
      14,
      10,
      bodyBuf,
      hairColorObj
    );
  }

  // Cylindrical Neck Loft with Sternocleidomastoid taper and Thyroid prominence
  // Continuous bridge from deep submental / jaw base (y=1.575) down to clavicular base (y=1.445)
  // ZERO floating gap between head and torso!
  const neckKeyRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.575, -0.005), rx: 0.038, rz: 0.044 },                      // Deep submental / Internal pharyngeal base inside skull
    { center: new THREE.Vector3(0, 1.540, 0.002), rx: 0.042, rz: 0.048, frontOffset: 0.004 },   // Hyoid bridge under chin
    { center: new THREE.Vector3(0, 1.495, 0.003), rx: 0.052, rz: 0.058, frontOffset: 0.006 },   // Adam's apple (thyroid prominence)
    { center: new THREE.Vector3(0, 1.465, -0.002), rx: 0.066, rz: 0.066 },                      // Lower cervical
    { center: new THREE.Vector3(0, 1.445, -0.006), rx: 0.088, rz: 0.078 },                      // Clavicular base meeting torso
  ];
  const neckRings = interpolateLoftRings(neckKeyRings, 4);
  addLoftRings(neckRings, 40, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.98));

  // Submental soft tissue cushion sealing underside of chin to neck
  addEllipsoid(
    new THREE.Vector3(0, 1.536, 0.020),
    0.020,
    0.012,
    0.016,
    18,
    14,
    bodyBuf,
    skinColorObj.clone().multiplyScalar(0.98)
  );

  // --- Torso & Pelvis (Anatomical Chest, Clavicles, Abdomen, Gluteals) ---
  const torsoKeyRings: LoftRing[] = [
    { center: new THREE.Vector3(0, 1.450, -0.010), rx: 0.178, rz: 0.112 },                     // Clavicles / Shoulders
    { center: new THREE.Vector3(0, 1.360, -0.008), rx: 0.165, rz: 0.118, frontOffset: 0.022 }, // Pectoral line
    { center: new THREE.Vector3(0, 1.250, -0.005), rx: 0.152, rz: 0.108 },                     // Lower ribcage
    { center: new THREE.Vector3(0, 1.120, -0.002), rx: 0.138, rz: 0.098, frontOffset: 0.006 }, // Waist & navel
    { center: new THREE.Vector3(0, 0.980, -0.005), rx: 0.150, rz: 0.115, backOffset: 0.024 },  // Iliac crest / Gluteal start
    { center: new THREE.Vector3(0, 0.880, -0.010), rx: 0.158, rz: 0.125, backOffset: 0.032 },  // Hips / Greater trochanters
    { center: new THREE.Vector3(0, 0.820, -0.008), rx: 0.142, rz: 0.110 },                     // Crotch / Pelvic floor
  ];
  const torsoRings = interpolateLoftRings(torsoKeyRings, 4);
  addLoftRings(torsoRings, 48, bodyBuf, true, true, skinColorObj);

  // Gluteal muscle volume (left and right buttocks)
  addEllipsoid(new THREE.Vector3(0.074, 0.910, -0.088), 0.072, 0.085, 0.065, 24, 18, bodyBuf, skinColorObj.clone().multiplyScalar(0.98));
  addEllipsoid(new THREE.Vector3(-0.074, 0.910, -0.088), 0.072, 0.085, 0.065, 24, 18, bodyBuf, skinColorObj.clone().multiplyScalar(0.98));

  // --- Upper Limbs (Natural Relaxed A-Pose: 13° Arm Abduction, Softened Elbows, Sculpted Hands) ---
  const armSides = [1, -1]; // 1 = Right, -1 = Left
  for (const side of armSides) {
    const shoulderX = side * 0.198;
    // Deltoid cap smoothly integrating into shoulder yoke (enclosed within cloth shell)
    addEllipsoid(new THREE.Vector3(shoulderX, 1.415, -0.008), 0.046, 0.042, 0.046, 24, 18, bodyBuf, skinColorObj);

    // Upper Arm (Brachium) lofted along a 13° outward abduction
    const upperArmKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.208, 1.400, -0.008), rx: 0.048, rz: 0.048 },
      { center: new THREE.Vector3(side * 0.228, 1.280, -0.008), rx: 0.045, rz: 0.046, frontOffset: 0.008 },
      { center: new THREE.Vector3(side * 0.248, 1.160, -0.012), rx: 0.040, rz: 0.042 }, // Elbow joint
    ];
    const upperArmRings = interpolateLoftRings(upperArmKeyRings, 4);
    addLoftRings(upperArmRings, 32, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.99));

    // Olecranon elbow prominence
    addEllipsoid(new THREE.Vector3(side * 0.248, 1.155, -0.044), 0.016, 0.018, 0.014, 16, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));

    // Forearm (Antebrachium) tapering naturally to wrist
    const forearmKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.248, 1.150, -0.012), rx: 0.038, rz: 0.040 },
      { center: new THREE.Vector3(side * 0.272, 1.020, -0.010), rx: 0.035, rz: 0.034 },
      { center: new THREE.Vector3(side * 0.288, 0.895, -0.008), rx: 0.028, rz: 0.025 },
      { center: new THREE.Vector3(side * 0.290, 0.875, -0.007), rx: 0.026, rz: 0.022 }, // Wrist base
    ];
    const forearmRings = interpolateLoftRings(forearmKeyRings, 4);
    addLoftRings(forearmRings, 32, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.99));

    // Radial & ulnar styloid process prominences (natural anatomical wrist bones)
    addEllipsoid(new THREE.Vector3(side * 0.298, 0.880, -0.014), 0.008, 0.012, 0.008, 14, 10, bodyBuf, skinColorObj.clone().multiplyScalar(0.97));
    addEllipsoid(new THREE.Vector3(side * 0.282, 0.880, 0.008), 0.007, 0.010, 0.007, 14, 10, bodyBuf, skinColorObj.clone().multiplyScalar(0.97));

    // --- Sculpted Articulated 5-Finger Hand in Natural Relaxed A-Pose ---
    // Broad anatomical palm (carpal base seamlessly transitioning into metacarpal arch)
    const palmKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(side * 0.290, 0.875, -0.007), rx: 0.018, rz: 0.022 },
      { center: new THREE.Vector3(side * 0.292, 0.850, -0.005), rx: 0.017, rz: 0.024, frontOffset: 0.002 },
      { center: new THREE.Vector3(side * 0.294, 0.825, -0.003), rx: 0.016, rz: 0.026 },
      { center: new THREE.Vector3(side * 0.296, 0.808, -0.002), rx: 0.015, rz: 0.026 },
    ];
    const palmRings = interpolateLoftRings(palmKeyRings, 4);
    addLoftRings(palmRings, 28, bodyBuf, false, true, skinColorObj.clone().multiplyScalar(0.98));

    // Mid-palm dorsal/palmar bridging cushion
    addEllipsoid(
      new THREE.Vector3(side * 0.296, 0.812, -0.002),
      0.014,
      0.014,
      0.024,
      18,
      14,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.97)
    );

    // Muscular thenar eminence (prominent thumb pad cushion)
    addEllipsoid(
      new THREE.Vector3(side * 0.284, 0.840, 0.012),
      0.014,
      0.020,
      0.014,
      18,
      14,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.97)
    );
    // Hypothenar eminence (pinky pad cushion)
    addEllipsoid(
      new THREE.Vector3(side * 0.300, 0.832, -0.010),
      0.012,
      0.018,
      0.012,
      16,
      12,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(0.97)
    );

    // 1. Abducted Opposed Thumb: 3 articulated segments curving naturally toward index
    const thumbMcp = new THREE.Vector3(side * 0.278, 0.835, 0.016);
    const thumbIp = new THREE.Vector3(side * 0.274, 0.806, 0.022);
    const thumbTip = new THREE.Vector3(side * 0.278, 0.780, 0.018);

    addEllipsoid(thumbMcp, 0.0090, 0.0090, 0.0090, 14, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.97));
    addCylinder(thumbMcp, thumbIp, 0.0084, 0.0076, 14, bodyBuf, true, true, skinColorObj.clone().multiplyScalar(0.97));
    addEllipsoid(thumbIp, 0.0080, 0.0080, 0.0080, 14, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));
    addCylinder(thumbIp, thumbTip, 0.0076, 0.0066, 14, bodyBuf, true, true, skinColorObj.clone().multiplyScalar(0.96));
    addEllipsoid(thumbTip, 0.0072, 0.0072, 0.0072, 14, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));
    // Dorsal thumb nail plate
    addEllipsoid(
      new THREE.Vector3(side * 0.280, 0.783, 0.013),
      0.0055,
      0.0020,
      0.0055,
      10,
      8,
      bodyBuf,
      skinColorObj.clone().multiplyScalar(1.05)
    );

    // 4 Distinct Articulated Fingers in Relaxed Natural Resting Posture:
    // Knuckles form curved metacarpal arch; fingers softly cascade-curled toward medial palm
    const fingerDefs = [
      {
        name: 'index',
        kX: side * 0.293, kY: 0.806, kZ: 0.015,
        p1End: new THREE.Vector3(side * 0.290, 0.772, 0.018),
        p2End: new THREE.Vector3(side * 0.286, 0.744, 0.016),
        p3End: new THREE.Vector3(side * 0.282, 0.724, 0.012),
        rad: 0.0080,
      },
      {
        name: 'middle',
        kX: side * 0.297, kY: 0.804, kZ: 0.004,
        p1End: new THREE.Vector3(side * 0.294, 0.766, 0.006),
        p2End: new THREE.Vector3(side * 0.289, 0.736, 0.004),
        p3End: new THREE.Vector3(side * 0.284, 0.714, 0.001),
        rad: 0.0084,
      },
      {
        name: 'ring',
        kX: side * 0.301, kY: 0.806, kZ: -0.006,
        p1End: new THREE.Vector3(side * 0.298, 0.770, -0.005),
        p2End: new THREE.Vector3(side * 0.293, 0.740, -0.006),
        p3End: new THREE.Vector3(side * 0.287, 0.720, -0.008),
        rad: 0.0078,
      },
      {
        name: 'pinky',
        kX: side * 0.304, kY: 0.810, kZ: -0.016,
        p1End: new THREE.Vector3(side * 0.301, 0.778, -0.015),
        p2End: new THREE.Vector3(side * 0.297, 0.752, -0.015),
        p3End: new THREE.Vector3(side * 0.292, 0.734, -0.016),
        rad: 0.0068,
      },
    ];

    for (const finger of fingerDefs) {
      const knucklePos = new THREE.Vector3(finger.kX, finger.kY, finger.kZ);

      // Metacarpal shaft bridging palm base to MCP knuckle
      const metacarpalBase = new THREE.Vector3(
        side * 0.292 + (finger.kX - side * 0.292) * 0.50,
        0.812,
        finger.kZ * 0.80
      );
      addCylinder(
        metacarpalBase,
        knucklePos,
        finger.rad * 1.15,
        finger.rad * 1.05,
        12,
        bodyBuf,
        true,
        true,
        skinColorObj.clone().multiplyScalar(0.98)
      );

      // Metacarpophalangeal (MCP) knuckle condyle
      addEllipsoid(
        knucklePos,
        finger.rad * 1.12,
        finger.rad * 1.12,
        finger.rad * 1.12,
        14,
        12,
        bodyBuf,
        skinColorObj.clone().multiplyScalar(0.97)
      );

      // Proximal phalanx
      addCylinder(
        knucklePos,
        finger.p1End,
        finger.rad,
        finger.rad * 0.92,
        12,
        bodyBuf,
        true,
        true,
        skinColorObj.clone().multiplyScalar(0.97)
      );

      // Proximal interphalangeal (PIP) joint
      addEllipsoid(
        finger.p1End,
        finger.rad * 1.04,
        finger.rad * 1.04,
        finger.rad * 1.04,
        12,
        10,
        bodyBuf,
        skinColorObj.clone().multiplyScalar(0.96)
      );

      // Intermediate phalanx
      addCylinder(
        finger.p1End,
        finger.p2End,
        finger.rad * 0.92,
        finger.rad * 0.84,
        12,
        bodyBuf,
        true,
        true,
        skinColorObj.clone().multiplyScalar(0.96)
      );

      // Distal interphalangeal (DIP) joint
      addEllipsoid(
        finger.p2End,
        finger.rad * 0.94,
        finger.rad * 0.94,
        finger.rad * 0.94,
        12,
        10,
        bodyBuf,
        skinColorObj.clone().multiplyScalar(0.95)
      );

      // Distal phalanx & rounded fingertip pulp
      addCylinder(
        finger.p2End,
        finger.p3End,
        finger.rad * 0.84,
        finger.rad * 0.74,
        12,
        bodyBuf,
        true,
        true,
        skinColorObj.clone().multiplyScalar(0.96)
      );
      addEllipsoid(
        finger.p3End,
        finger.rad * 0.82,
        finger.rad * 0.82,
        finger.rad * 0.82,
        12,
        10,
        bodyBuf,
        skinColorObj.clone().multiplyScalar(0.95)
      );

      // Dorsal keratin fingernail plate
      addEllipsoid(
        new THREE.Vector3(finger.p3End.x, finger.p3End.y + 0.002, finger.p3End.z + 0.002),
        finger.rad * 0.65,
        finger.rad * 0.22,
        finger.rad * 0.65,
        10,
        8,
        bodyBuf,
        skinColorObj.clone().multiplyScalar(1.05)
      );
    }
  }

  // --- Lower Limbs (Quadriceps, Patellar Knees, Calves, Ankles, Arched Feet with 5° Stance Flare) ---
  const legSides = [1, -1];
  for (const side of legSides) {
    const xLeg = side * 0.092;

    // Thigh & Quadriceps loft (high resolution)
    const thighKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(xLeg, 0.860, -0.008), rx: 0.088, rz: 0.095 },
      { center: new THREE.Vector3(xLeg, 0.720, -0.006), rx: 0.082, rz: 0.086, frontOffset: 0.012 },
      { center: new THREE.Vector3(xLeg, 0.580, -0.004), rx: 0.068, rz: 0.072 },
      { center: new THREE.Vector3(xLeg, 0.500, -0.002), rx: 0.058, rz: 0.060 }, // Knee joint
    ];
    const thighRings = interpolateLoftRings(thighKeyRings, 4);
    addLoftRings(thighRings, 36, bodyBuf, false, false, skinColorObj);

    // Patella (kneecap) ridge
    addEllipsoid(new THREE.Vector3(xLeg, 0.495, 0.055), 0.025, 0.030, 0.020, 20, 16, bodyBuf, skinColorObj.clone().multiplyScalar(0.98));

    // Lower Leg & Calves (Gastrocnemius & Soleus taper to Achilles tendon)
    const calfKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(xLeg, 0.480, -0.002), rx: 0.056, rz: 0.058 },
      { center: new THREE.Vector3(xLeg, 0.360, -0.008), rx: 0.062, rz: 0.068, backOffset: 0.022 }, // Calf belly
      { center: new THREE.Vector3(xLeg, 0.220, -0.008), rx: 0.046, rz: 0.048 },
      { center: new THREE.Vector3(xLeg, 0.100, -0.005), rx: 0.036, rz: 0.038 }, // Above ankle
    ];
    const calfRings = interpolateLoftRings(calfKeyRings, 4);
    addLoftRings(calfRings, 36, bodyBuf, false, false, skinColorObj.clone().multiplyScalar(0.99));

    // Ankle malleoli (lateral and medial prominence)
    addEllipsoid(new THREE.Vector3(xLeg + side * 0.032, 0.082, -0.005), 0.014, 0.016, 0.015, 16, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));
    addEllipsoid(new THREE.Vector3(xLeg - side * 0.028, 0.086, -0.005), 0.014, 0.016, 0.015, 16, 12, bodyBuf, skinColorObj.clone().multiplyScalar(0.96));

    // Arched foot (grounded firmly at y = 0 with natural 5° toe flare)
    const footRot = new THREE.Euler(0, -side * 0.087, 0); // 5° outward flare
    // Heel (calcaneus)
    addEllipsoid(new THREE.Vector3(xLeg, 0.045, -0.052), 0.034, 0.038, 0.045, 20, 16, bodyBuf, skinColorObj.clone().multiplyScalar(0.98), footRot);
    // Midfoot arch & instep
    addEllipsoid(new THREE.Vector3(xLeg, 0.042, 0.025), 0.038, 0.034, 0.060, 20, 16, bodyBuf, skinColorObj.clone().multiplyScalar(0.98), footRot);
    // Forefoot & grouped toes
    addEllipsoid(new THREE.Vector3(xLeg, 0.022, 0.105), 0.042, 0.020, 0.038, 20, 14, bodyBuf, skinColorObj.clone().multiplyScalar(0.96), footRot);
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
    },
    shouldSubdivide
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
  // 2. LAYERED CLOTHING & GARMENTS (Solid Enclosed Jacket & Continuous Trousers)
  // =========================================================================
  if (includeClothing) {
    // --- Upper Body: Solid Fully-Enclosed Fitted Jacket / Shirt ---
    const upperBuf = createBuffer();
    const shirtColorObj = new THREE.Color(shirtColor);

    // 1. Unified Torso Shell & Shoulder Yoke Loft:
    // Continuous loft from integrated stand-up collar (y=1.520) down through shoulder yoke,
    // thoracic chest, waist, and hip hem (y=0.940) overlapping trousers waistband cleanly.
    const jacketTorsoKeyRings: LoftRing[] = [
      // Integrated Collar Rim hugging neck base snugly
      { center: new THREE.Vector3(0, 1.505, -0.005), rx: 0.076, rz: 0.078 },
      // Collar Base / Neckline junction
      { center: new THREE.Vector3(0, 1.480, -0.006), rx: 0.120, rz: 0.098 },
      // Clavicular slope bridging smoothly over clavicles
      { center: new THREE.Vector3(0, 1.458, -0.007), rx: 0.205, rz: 0.124 },
      // Shoulder Yoke: Spans continuously across shoulders and deltoids
      { center: new THREE.Vector3(0, 1.430, -0.008), rx: 0.252, rz: 0.138 },
      // Thoracic chest & underarm junction
      { center: new THREE.Vector3(0, 1.350, -0.008), rx: 0.218, rz: 0.144, frontOffset: 0.020 },
      // Mid-chest / ribcage
      { center: new THREE.Vector3(0, 1.230, -0.004), rx: 0.190, rz: 0.132 },
      // Mid-waist
      { center: new THREE.Vector3(0, 1.110, -0.003), rx: 0.174, rz: 0.124, frontOffset: 0.006 },
      // Lower waist / jacket hem meeting trousers waistband cleanly without belt collision
      { center: new THREE.Vector3(0, 1.010, -0.004), rx: 0.180, rz: 0.138, backOffset: 0.020 },
    ];
    const jacketTorsoRings = interpolateLoftRings(jacketTorsoKeyRings, 4);
    addLoftRings(jacketTorsoRings, 48, upperBuf, false, false, shirtColorObj);

    // Integrated Deltoid Shoulder Cap Cloth Shells:
    // Extends continuously over clavicles and around deltoids, completely enclosing shoulder balls in cloth.
    // ZERO exposed shoulder spheres!
    for (const side of armSides) {
      addEllipsoid(
        new THREE.Vector3(side * 0.208, 1.425, -0.008),
        0.065,
        0.052,
        0.065,
        28,
        20,
        upperBuf,
        shirtColorObj
      );
    }

    // Front placket seam, zipper teeth strip, and metallic slider
    // Starts at neckline (y=1.470) and STOPS cleanly right above waistband and belt (y=1.015)
    addBox(
      new THREE.Vector3(0, 1.2425, 0.142),
      new THREE.Vector3(0.022, 0.455, 0.008),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      shirtColorObj.clone().multiplyScalar(0.85)
    );
    // Metallic zipper teeth
    addBox(
      new THREE.Vector3(0, 1.2425, 0.147),
      new THREE.Vector3(0.006, 0.445, 0.004),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      new THREE.Color('#cbd5e1')
    );
    // Metallic zipper slider pull
    addBox(
      new THREE.Vector3(0, 1.340, 0.151),
      new THREE.Vector3(0.016, 0.026, 0.010),
      new THREE.Euler(0, 0, 0),
      upperBuf,
      new THREE.Color('#94a3b8')
    );

    // Left and right chest pockets with flaps and metallic snap rivets
    for (const side of armSides) {
      addBox(
        new THREE.Vector3(side * 0.078, 1.275, 0.138),
        new THREE.Vector3(0.058, 0.068, 0.006),
        new THREE.Euler(-0.04, side * 0.06, 0),
        upperBuf,
        shirtColorObj.clone().multiplyScalar(0.92)
      );
      addBox(
        new THREE.Vector3(side * 0.078, 1.312, 0.142),
        new THREE.Vector3(0.062, 0.016, 0.008),
        new THREE.Euler(-0.04, side * 0.06, 0),
        upperBuf,
        shirtColorObj.clone().multiplyScalar(0.85)
      );
      addEllipsoid(
        new THREE.Vector3(side * 0.078, 1.306, 0.147),
        0.0032,
        0.0032,
        0.0020,
        12,
        10,
        upperBuf,
        new THREE.Color('#cbd5e1')
      );
    }

    // 2. Seamless Sleeves in Relaxed A-Pose:
    // Connects directly into the shoulder yoke perimeter; ZERO open armpit voids or gaps!
    for (const side of armSides) {
      const sleeveKeyRings: LoftRing[] = [
        { center: new THREE.Vector3(side * 0.205, 1.430, -0.008), rx: 0.070, rz: 0.070 }, // Directly inside shoulder yoke / deltoid cap
        { center: new THREE.Vector3(side * 0.218, 1.360, -0.008), rx: 0.066, rz: 0.066 },
        { center: new THREE.Vector3(side * 0.235, 1.275, -0.008), rx: 0.060, rz: 0.060 },
        { center: new THREE.Vector3(side * 0.252, 1.155, -0.012), rx: 0.054, rz: 0.054 }, // Elbow
        { center: new THREE.Vector3(side * 0.272, 1.020, -0.010), rx: 0.046, rz: 0.046 },
        { center: new THREE.Vector3(side * 0.290, 0.900, -0.008), rx: 0.038, rz: 0.038 }, // Wrist cuff
      ];
      const sleeveRings = interpolateLoftRings(sleeveKeyRings, 4);
      addLoftRings(sleeveRings, 36, upperBuf, false, false, shirtColorObj.clone().multiplyScalar(0.98));

      // Continuous axillary armpit gusset sealing armpit void cleanly
      addEllipsoid(
        new THREE.Vector3(side * 0.168, 1.365, -0.008),
        0.052,
        0.044,
        0.056,
        18,
        14,
        upperBuf,
        shirtColorObj
      );

      // Folded sleeve cuff band at wrist
      const armDir = new THREE.Vector3(side * 0.088, -0.520, 0).normalize();
      const armRot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), armDir)
      );
      addTorus(
        new THREE.Vector3(side * 0.288, 0.900, -0.008),
        0.038,
        0.005,
        14,
        24,
        armRot,
        upperBuf,
        shirtColorObj.clone().multiplyScalar(0.88)
      );

      // Realistic cloth drape wrinkles at the posterior elbow
      addEllipsoid(
        new THREE.Vector3(side * 0.250, 1.155, -0.048),
        0.022,
        0.015,
        0.016,
        16,
        12,
        upperBuf,
        shirtColorObj.clone().multiplyScalar(0.92)
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
      },
      shouldSubdivide
    );
    allItems.push(clothingUpperItem);

    // --- Lower Body: Unified Continuous Trousers (Denim Jeans) ---
    const lowerBuf = createBuffer();
    const pantsColorObj = new THREE.Color(pantsColor);

    // 1. Pelvic Shell & Waistband (Starts at y=1.010m down to crotch bifurcation y=0.790m)
    // Seamless continuous loft: ZERO lateral hip cutouts, zero exposed skin or void under belt!
    const pelvicPantsKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(0, 1.010, -0.004), rx: 0.176, rz: 0.136 },                     // Waistband top
      { center: new THREE.Vector3(0, 0.960, -0.006), rx: 0.186, rz: 0.144, backOffset: 0.026 },  // Waistband lower seam
      { center: new THREE.Vector3(0, 0.900, -0.008), rx: 0.198, rz: 0.154, backOffset: 0.034 },  // Hips & gluteals
      { center: new THREE.Vector3(0, 0.850, -0.008), rx: 0.192, rz: 0.148, backOffset: 0.024 },  // Lower pelvic seat
      { center: new THREE.Vector3(0, 0.810, -0.008), rx: 0.178, rz: 0.138 },                     // Crotch bifurcation fork
      { center: new THREE.Vector3(0, 0.785, -0.008), rx: 0.152, rz: 0.122 },                     // Perineal taper smoothly meeting legs
    ];
    const pelvicPantsRings = interpolateLoftRings(pelvicPantsKeyRings, 4);
    addLoftRings(pelvicPantsRings, 48, lowerBuf, false, false, pantsColorObj.clone().multiplyScalar(0.96));

    // Continuous crotch saddle / perineal bridge gusset:
    addEllipsoid(
      new THREE.Vector3(0, 0.800, -0.008),
      0.058,
      0.032,
      0.076,
      22,
      16,
      lowerBuf,
      pantsColorObj.clone().multiplyScalar(0.92)
    );

    // Front fly seam & brass button
    addBox(
      new THREE.Vector3(0, 0.940, 0.140),
      new THREE.Vector3(0.018, 0.120, 0.006),
      new THREE.Euler(0, 0, 0),
      lowerBuf,
      pantsColorObj.clone().multiplyScalar(0.85)
    );
    addEllipsoid(new THREE.Vector3(0, 1.000, 0.136), 0.008, 0.008, 0.005, 12, 10, lowerBuf, new THREE.Color('#d97706'));

    // 5 Flush rectangular belt loops sitting snugly on waistband perimeter
    const beltLoops = [
      { pos: new THREE.Vector3(-0.068, 0.985, 0.140), rot: new THREE.Euler(0, 0.18, 0) },
      { pos: new THREE.Vector3(0.068, 0.985, 0.140), rot: new THREE.Euler(0, -0.18, 0) },
      { pos: new THREE.Vector3(-0.176, 0.985, -0.005), rot: new THREE.Euler(0, Math.PI / 2, 0) },
      { pos: new THREE.Vector3(0.176, 0.985, -0.005), rot: new THREE.Euler(0, -Math.PI / 2, 0) },
      { pos: new THREE.Vector3(0, 0.985, -0.140), rot: new THREE.Euler(0, 0, 0) },
    ];
    for (const loop of beltLoops) {
      addBox(
        loop.pos,
        new THREE.Vector3(0.012, 0.042, 0.006),
        loop.rot,
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.88)
      );
    }

    // Front curved scoop pockets, copper rivets, and rear patch pockets
    for (const side of legSides) {
      addCylinder(
        new THREE.Vector3(side * 0.070, 0.965, 0.132),
        new THREE.Vector3(side * 0.148, 0.930, 0.074),
        0.0018,
        0.0018,
        10,
        lowerBuf,
        true,
        true,
        pantsColorObj.clone().multiplyScalar(0.82)
      );
      addEllipsoid(
        new THREE.Vector3(side * 0.148, 0.930, 0.076),
        0.0035,
        0.0035,
        0.0025,
        10,
        8,
        lowerBuf,
        new THREE.Color('#b45309')
      );
      addBox(
        new THREE.Vector3(side * 0.076, 0.880, -0.148),
        new THREE.Vector3(0.068, 0.082, 0.006),
        new THREE.Euler(0.08, -side * 0.06, 0),
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.90)
      );
    }

    // 2. Continuous Left & Right Trouser Legs:
    // Bifurcates cleanly from pelvic seat with ZERO open hip cutouts
    for (const side of legSides) {
      const xLeg = side * 0.092;

      const legKeyRings: LoftRing[] = [
        { center: new THREE.Vector3(xLeg, 0.875, -0.008), rx: 0.106, rz: 0.110 },                  // Upper thigh socket overlapping inside pelvic shell
        { center: new THREE.Vector3(xLeg, 0.815, -0.008), rx: 0.098, rz: 0.102 },                  // Bifurcation overlap zone
        { center: new THREE.Vector3(xLeg, 0.720, -0.006), rx: 0.092, rz: 0.098, frontOffset: 0.014 },
        { center: new THREE.Vector3(xLeg, 0.600, -0.004), rx: 0.082, rz: 0.086 },
        // Knee flexion crease folds
        { center: new THREE.Vector3(xLeg, 0.520, -0.002), rx: 0.076, rz: 0.080, frontOffset: 0.012 },
        { center: new THREE.Vector3(xLeg, 0.480, -0.002), rx: 0.074, rz: 0.078, frontOffset: 0.010 },
        { center: new THREE.Vector3(xLeg, 0.360, -0.006), rx: 0.076, rz: 0.082, backOffset: 0.020 },
        { center: new THREE.Vector3(xLeg, 0.220, -0.006), rx: 0.062, rz: 0.064 },
        { center: new THREE.Vector3(xLeg, 0.110, -0.004), rx: 0.054, rz: 0.056 }, // Ankle hem
      ];
      const legRings = interpolateLoftRings(legKeyRings, 4);
      addLoftRings(legRings, 36, lowerBuf, false, true, pantsColorObj);

      // Knee fabric flexion crease folds
      addEllipsoid(
        new THREE.Vector3(xLeg, 0.505, 0.066),
        0.038,
        0.012,
        0.018,
        18,
        12,
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.92)
      );
      addEllipsoid(
        new THREE.Vector3(xLeg, 0.475, 0.064),
        0.036,
        0.010,
        0.016,
        18,
        12,
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.92)
      );

      // Trouser rolled bottom cuff hem
      addTorus(
        new THREE.Vector3(xLeg, 0.110, -0.004),
        0.054,
        0.006,
        14,
        24,
        new THREE.Euler(Math.PI / 2, 0, 0),
        lowerBuf,
        pantsColorObj.clone().multiplyScalar(0.88)
      );

      // Lateral outseam running down outside of trousers
      addCylinder(
        new THREE.Vector3(xLeg + side * 0.096, 0.880, -0.008),
        new THREE.Vector3(xLeg + side * 0.052, 0.110, -0.004),
        0.004,
        0.004,
        10,
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
      },
      shouldSubdivide
    );
    allItems.push(clothingLowerItem);

    const upperStats = getItemStats(clothingUpperItem);
    const lowerStats = getItemStats(clothingLowerItem);
    clothingVerts = upperStats.verts + lowerStats.verts;
    clothingTris = upperStats.tris + lowerStats.tris;
  }

  // --- Footwear: Sculpted Street Sneakers with Bevelled Outsole & Contoured Midsole ---
  if (includeClothing) {
    const shoesBuf = createBuffer();
    const shoesColorObj = new THREE.Color(shoesColor);

    for (const side of legSides) {
      const xFoot = side * 0.092;
      const footRot = new THREE.Euler(0, -side * 0.087, 0); // 5° toe flare matching foot stance

      // 1. Curved bevelled vulcanized rubber outsole (flat ground contact plane at y = 0.00m)
      addBox(
        new THREE.Vector3(xFoot, 0.006, 0.038),
        new THREE.Vector3(0.092, 0.012, 0.252),
        footRot,
        shoesBuf,
        new THREE.Color('#1e293b') // Dark vulcanized tread
      );

      // 2. Sculpted cushioned EVA midsole wedge (cushioning wedge elevating heel to y = 0.034m)
      addBox(
        new THREE.Vector3(xFoot, 0.022, 0.036),
        new THREE.Vector3(0.088, 0.020, 0.246),
        footRot,
        shoesBuf,
        new THREE.Color('#f8fafc') // Crisp contrast sail midsole
      );

      // 3. Contoured sneaker upper loft encasing foot from midsole to padded ankle collar
      const sneakerUpperKeyRings: LoftRing[] = [
        { center: new THREE.Vector3(xFoot, 0.120, -0.004), rx: 0.048, rz: 0.052, rot: footRot }, // Padded collar
        { center: new THREE.Vector3(xFoot, 0.086, 0.010), rx: 0.048, rz: 0.068, rot: footRot },
        { center: new THREE.Vector3(xFoot, 0.050, 0.035), rx: 0.046, rz: 0.112, frontOffset: 0.022, rot: footRot },
        { center: new THREE.Vector3(xFoot, 0.032, 0.042), rx: 0.045, rz: 0.122, rot: footRot },
      ];
      const sneakerUpperRings = interpolateLoftRings(sneakerUpperKeyRings, 4);
      addLoftRings(sneakerUpperRings, 36, shoesBuf, false, true, shoesColorObj);

      // 4. Curved structured toe cap rand
      const toeRandCenter = new THREE.Vector3(0, 0.032, 0.134).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
      addEllipsoid(
        toeRandCenter,
        0.044,
        0.022,
        0.034,
        18,
        14,
        shoesBuf,
        shoesColorObj.clone().multiplyScalar(0.85),
        footRot
      );

      // 5. Padded shoe tongue rising up the instep
      const tongueCenter = new THREE.Vector3(0, 0.086, 0.044).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
      addBox(
        tongueCenter,
        new THREE.Vector3(0.034, 0.082, 0.014),
        new THREE.Euler(0.46, -side * 0.087, 0, 'YXZ'),
        shoesBuf,
        shoesColorObj.clone().multiplyScalar(0.92)
      );

      // 6. Cross-laced eyelets and crisp laces
      for (let laceIdx = 0; laceIdx < 5; laceIdx++) {
        const lz = 0.028 + laceIdx * 0.020;
        const ly = 0.050 + laceIdx * 0.016;
        const pLace1 = new THREE.Vector3(-0.018, ly, lz).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
        const pLace2 = new THREE.Vector3(+0.018, ly, lz).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
        addCylinder(
          pLace1,
          pLace2,
          0.003,
          0.003,
          10,
          shoesBuf,
          true,
          true,
          new THREE.Color('#f1f5f9')
        );
      }

      // 7. Sneaker heel counter support overlay
      const heelCounterCenter = new THREE.Vector3(0, 0.048, -0.054).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
      addEllipsoid(
        heelCounterCenter,
        0.046,
        0.036,
        0.046,
        18,
        14,
        shoesBuf,
        shoesColorObj.clone().multiplyScalar(0.88),
        footRot
      );

      // 8. Outsole traction tread bars (5 transverse grip grooves)
      for (let tIdx = -2; tIdx <= 2; tIdx++) {
        const tz = 0.040 + tIdx * 0.038;
        const pTread = new THREE.Vector3(0, 0.003, tz).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
        addBox(
          pTread,
          new THREE.Vector3(0.086, 0.005, 0.012),
          footRot,
          shoesBuf,
          new THREE.Color('#0f172a')
        );
      }

      // 9. Sneaker lace tied bow loops at top of tongue (draping naturally over instep)
      const bowCenter = new THREE.Vector3(0, 0.108, 0.055).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0));
      const laceRot = new THREE.Euler(0.46, -side * 0.087, 0, 'YXZ');
      addTorus(
        new THREE.Vector3(-0.010, 0.108, 0.056).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0)),
        0.009,
        0.0025,
        10,
        14,
        laceRot,
        shoesBuf,
        new THREE.Color('#f8fafc')
      );
      addTorus(
        new THREE.Vector3(0.010, 0.108, 0.056).applyEuler(footRot).add(new THREE.Vector3(xFoot, 0, 0)),
        0.009,
        0.0025,
        10,
        14,
        laceRot,
        shoesBuf,
        new THREE.Color('#f8fafc')
      );
      addEllipsoid(bowCenter, 0.005, 0.004, 0.004, 12, 10, shoesBuf, new THREE.Color('#f1f5f9'), footRot);
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
      },
      shouldSubdivide
    );
    allItems.push(footwearItem);

    const shoesStats = getItemStats(footwearItem);
    footwearVerts = shoesStats.verts;
    footwearTris = shoesStats.tris;
  }

  // =========================================================================
  // 3. HIGH-PRECISION ACCESSORIES (Sleek Eyewear, Smartwatch & Fitted Belt)
  // =========================================================================
  if (includeAccessories) {
    const accBuf = createBuffer();

    const glassesColorObj = new THREE.Color(glassesColor);
    const watchColorObj = new THREE.Color(watchColor);

    // --- Sleek Modern Eyewear ---
    // Refined wayfarer frames framing the eyes with clear optical visibility of sclera & iris
    // Temple arms extending back over ears without intersecting cheek flesh
    for (const side of [1, -1]) {
      const xEye = side * 0.035;
      const eyeZ = 0.076;

      // Top wayfarer brow bar
      addBox(
        new THREE.Vector3(xEye, 1.662, eyeZ),
        new THREE.Vector3(0.032, 0.0028, 0.0035),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );
      // Bottom rim bar
      addBox(
        new THREE.Vector3(xEye, 1.638, eyeZ),
        new THREE.Vector3(0.030, 0.0024, 0.003),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );
      // Lateral outer hinge rim
      addBox(
        new THREE.Vector3(side * 0.052, 1.650, eyeZ),
        new THREE.Vector3(0.0028, 0.024, 0.003),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );
      // Medial inner bridge rim
      addBox(
        new THREE.Vector3(side * 0.018, 1.650, eyeZ),
        new THREE.Vector3(0.0024, 0.022, 0.003),
        new THREE.Euler(0, 0, 0),
        accBuf,
        glassesColorObj
      );

      // Outer wayfarer brow extension (hinge lug meeting cranium width rx=0.076)
      addCylinder(
        new THREE.Vector3(side * 0.052, 1.662, eyeZ),
        new THREE.Vector3(side * 0.068, 1.658, eyeZ - 0.004),
        0.0018,
        0.0018,
        10,
        accBuf,
        true,
        true,
        glassesColorObj
      );

      // Sleek temple arms extending back naturally along skull over the ears
      addCylinder(
        new THREE.Vector3(side * 0.068, 1.658, eyeZ - 0.004),
        new THREE.Vector3(side * 0.075, 1.636, -0.010),
        0.0016,
        0.0016,
        10,
        accBuf,
        true,
        true,
        glassesColorObj
      );
      // Temple earpiece resting gently over the ear helix
      addCylinder(
        new THREE.Vector3(side * 0.075, 1.636, -0.010),
        new THREE.Vector3(side * 0.073, 1.618, -0.022),
        0.0016,
        0.0014,
        10,
        accBuf,
        true,
        true,
        glassesColorObj
      );
    }

    // Nasal bridge connector bridging across nasal bone
    addBox(
      new THREE.Vector3(0, 1.656, 0.080),
      new THREE.Vector3(0.038, 0.0028, 0.0035),
      new THREE.Euler(0, 0, 0),
      accBuf,
      glassesColorObj
    );

    // --- Smart Watch / Wristwatch (on Left Wrist in Relaxed A-Pose) ---
    // Sits snugly on left wrist right below jacket sleeve cuff
    const watchCenter = new THREE.Vector3(-0.290, 0.880, -0.007);
    // Metallic bezel casing on dorsal wrist
    addBox(
      new THREE.Vector3(-0.290, 0.880, 0.016),
      new THREE.Vector3(0.024, 0.026, 0.006),
      new THREE.Euler(0, 0, 0),
      accBuf,
      watchColorObj
    );

    // Sapphire display glass screen
    addBox(
      new THREE.Vector3(-0.290, 0.880, 0.0195),
      new THREE.Vector3(0.020, 0.022, 0.002),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#0f172a')
    );

    // Crown dial button on side
    addCylinder(
      new THREE.Vector3(-0.278, 0.880, 0.016),
      new THREE.Vector3(-0.275, 0.880, 0.016),
      0.0025,
      0.0025,
      10,
      accBuf,
      true,
      true,
      watchColorObj.clone().multiplyScalar(1.2)
    );

    // Fitted wrist strap wrapping snugly around wrist circumference
    const leftArmDir = new THREE.Vector3(-0.088, -0.520, 0).normalize();
    const leftArmRot = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), leftArmDir)
    );
    addTorus(
      watchCenter,
      0.027,
      0.004,
      12,
      24,
      leftArmRot,
      accBuf,
      new THREE.Color('#1e293b')
    );

    // --- Fitted Leather Belt & Metallic Buckle ---
    // Loft an elliptical belt band matching the waistband curvature (rx = 0.174, rz = 0.134)
    // from y = 0.978 to y = 1.002, fitting snugly around the waist with zero floating
    const beltKeyRings: LoftRing[] = [
      { center: new THREE.Vector3(0, 1.002, -0.005), rx: 0.174, rz: 0.134, backOffset: 0.026 },
      { center: new THREE.Vector3(0, 0.978, -0.005), rx: 0.175, rz: 0.135, backOffset: 0.026 },
    ];
    const beltRings = interpolateLoftRings(beltKeyRings, 2);
    addLoftRings(beltRings, 48, accBuf, false, false, new THREE.Color('#451a03'));

    // Rectangular metallic buckle at center front, sitting flush against the belt
    const buckleCenter = new THREE.Vector3(0, 0.990, 0.138);
    // Outer rectangular buckle frame
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y + 0.015, buckleCenter.z),
      new THREE.Vector3(0.044, 0.005, 0.005),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y - 0.015, buckleCenter.z),
      new THREE.Vector3(0.044, 0.005, 0.005),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    addBox(
      new THREE.Vector3(buckleCenter.x + 0.020, buckleCenter.y, buckleCenter.z),
      new THREE.Vector3(0.005, 0.035, 0.005),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    addBox(
      new THREE.Vector3(buckleCenter.x - 0.020, buckleCenter.y, buckleCenter.z),
      new THREE.Vector3(0.005, 0.035, 0.005),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#f1f5f9')
    );
    // Buckle prong / tongue
    addBox(
      new THREE.Vector3(buckleCenter.x, buckleCenter.y, buckleCenter.z + 0.002),
      new THREE.Vector3(0.004, 0.030, 0.004),
      new THREE.Euler(0, 0, 0),
      accBuf,
      new THREE.Color('#cbd5e1')
    );

    accessoriesItem = bufferToSceneItem(
      'human-accessories',
      'Accessories (Eyewear, Smartwatch & Belt)',
      accBuf,
      {
        color: glassesColor,
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
      shouldSubdivide
    );
    allItems.push(accessoriesItem);

    const accStats = getItemStats(accessoriesItem);
    accessoriesVerts = accStats.verts;
    accessoriesTris = accStats.tris;
  }

  const bodyStats = getItemStats(bodyItem);
  const bodyVerts = bodyStats.verts;
  const bodyTris = bodyStats.tris;

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
