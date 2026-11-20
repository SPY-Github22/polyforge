import * as THREE from 'three';
import { PrimitiveType, GeometryParameters, Modifier } from '../types';

/**
 * Creates a base BufferGeometry for a given primitive type and parameters.
 */
export function createPrimitiveGeometry(
  type: PrimitiveType,
  params: GeometryParameters = {}
): THREE.BufferGeometry {
  const p = {
    width: params.width ?? 1,
    height: params.height ?? 1,
    depth: params.depth ?? 1,
    radius: params.radius ?? 0.7,
    tube: params.tube ?? 0.25,
    radialSegments: params.radialSegments ?? 32,
    tubularSegments: params.tubularSegments ?? 48,
    widthSegments: params.widthSegments ?? 16,
    heightSegments: params.heightSegments ?? 16,
  };

  let geo: THREE.BufferGeometry;

  switch (type) {
    case 'box':
      geo = new THREE.BoxGeometry(
        p.width,
        p.height,
        p.depth,
        p.widthSegments,
        p.heightSegments,
        p.widthSegments
      );
      break;

    case 'sphere':
      geo = new THREE.SphereGeometry(
        p.radius,
        p.radialSegments,
        p.radialSegments
      );
      break;

    case 'cylinder':
      geo = new THREE.CylinderGeometry(
        p.radius,
        p.radius,
        p.height,
        p.radialSegments
      );
      break;

    case 'cone':
      geo = new THREE.ConeGeometry(
        p.radius,
        p.height,
        p.radialSegments
      );
      break;

    case 'torus':
      geo = new THREE.TorusGeometry(
        p.radius,
        p.tube,
        p.radialSegments,
        p.tubularSegments
      );
      break;

    case 'plane':
      geo = new THREE.PlaneGeometry(
        p.width * 2,
        p.height * 2,
        p.widthSegments,
        p.heightSegments
      );
      break;

    case 'dodecahedron':
      geo = new THREE.DodecahedronGeometry(p.radius, 0);
      break;

    case 'capsule':
      geo = new THREE.CapsuleGeometry(
        p.radius * 0.6,
        p.height,
        p.radialSegments,
        p.radialSegments
      );
      break;

    case 'custom': {
      if (params.customGeometry && params.customGeometry.positions && params.customGeometry.positions.length >= 9) {
        geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(params.customGeometry.positions), 3));
        if (params.customGeometry.normals && params.customGeometry.normals.length === params.customGeometry.positions.length) {
          geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(params.customGeometry.normals), 3));
        } else {
          geo.computeVertexNormals();
        }
        if (params.customGeometry.uvs && params.customGeometry.uvs.length > 0) {
          geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(params.customGeometry.uvs), 2));
        }
        if (params.customGeometry.colors && params.customGeometry.colors.length > 0) {
          geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(params.customGeometry.colors), 3));
        }
        if (params.customGeometry.indices && params.customGeometry.indices.length > 0) {
          geo.setIndex(params.customGeometry.indices);
        }
      } else {
        geo = new THREE.BoxGeometry(1, 1, 1);
      }
      break;
    }

    default:
      geo = new THREE.BoxGeometry(1, 1, 1);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Applies procedural geometric modifiers (Noise displacement, Twist, Smooth, Subdivide).
 */
export function applyModifiers(
  baseGeometry: THREE.BufferGeometry,
  modifiers: Modifier[] = []
): THREE.BufferGeometry {
  let geo = baseGeometry.clone();

  for (const mod of modifiers) {
    if (!mod.enabled || mod.factor === 0) continue;

    switch (mod.type) {
      case 'noise_displace':
        geo = applyNoiseDisplacement(geo, mod.factor);
        break;
      case 'twist':
        geo = applyTwist(geo, mod.factor);
        break;
      case 'smooth':
        geo.computeVertexNormals();
        break;
      case 'subdivide':
        geo = applySubdivisionRefinement(geo, Math.min(3, Math.max(1, Math.round(mod.factor))));
        break;
      case 'bark_furrow':
        geo = applyBarkFurrow(geo, mod.factor);
        break;
      case 'taper':
        geo = applyTaper(geo, mod.factor);
        break;
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Applies procedural organic bark furrow displacement along vertex normals.
 * Uses cylindrical azimuth and longitudinal harmonics to create realistic fissures and ridges.
 */
export function applyBarkFurrow(
  geometry: THREE.BufferGeometry,
  factor: number
): THREE.BufferGeometry {
  const cloned = geometry.clone();
  cloned.computeVertexNormals();

  const posAttr = cloned.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = cloned.getAttribute('normal') as THREE.BufferAttribute;
  if (!posAttr || !normAttr) return cloned;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);

    const theta = Math.atan2(z, x);
    // Deep longitudinal furrows modulated by spiral twist and height frequency
    const ridgeNoise =
      Math.sin(theta * 14.0 + y * 2.5) * 0.45 +
      Math.sin(theta * 28.0 - y * 4.2) * 0.25 +
      Math.cos(y * 8.0 + theta * 6.0) * 0.15;

    const disp = ridgeNoise * factor * 0.1;
    posAttr.setXYZ(i, x + nx * disp, y + ny * disp * 0.2, z + nz * disp);
  }

  posAttr.needsUpdate = true;
  cloned.computeVertexNormals();
  return cloned;
}

/**
 * Applies axial tapering deformation along Y-axis.
 */
export function applyTaper(
  geometry: THREE.BufferGeometry,
  taperRatio: number
): THREE.BufferGeometry {
  const cloned = geometry.clone();
  const posAttr = cloned.getAttribute('position') as THREE.BufferAttribute;
  if (!posAttr) return cloned;

  cloned.computeBoundingBox();
  const bbox = cloned.boundingBox || new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  const minY = bbox.min.y;
  const height = Math.max(0.001, bbox.max.y - minY);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const normalizedY = (y - minY) / height;
    const scale = Math.max(0.01, 1.0 - normalizedY * taperRatio);

    posAttr.setXYZ(i, x * scale, y, z * scale);
  }

  posAttr.needsUpdate = true;
  cloned.computeVertexNormals();
  return cloned;
}

/**
 * Applies procedural 3D Simplex-like pseudo-noise displacement along vertex normals.
 */
export function applyNoiseDisplacement(
  geometry: THREE.BufferGeometry,
  amplitude: number
): THREE.BufferGeometry {
  const cloned = geometry.clone();
  cloned.computeVertexNormals();

  const posAttr = cloned.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = cloned.getAttribute('normal') as THREE.BufferAttribute;

  if (!posAttr || !normAttr) return cloned;

  const count = posAttr.count;
  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);

    // Procedural multi-frequency sine turbulence
    const noise =
      Math.sin(x * 3.5 + y * 2.1) * Math.cos(y * 3.7 + z * 2.3) * Math.sin(z * 4.1 + x * 1.9) * 0.5 +
      Math.sin(x * 7.3 - z * 5.1) * 0.25;

    const disp = noise * amplitude;

    posAttr.setXYZ(i, x + nx * disp, y + ny * disp, z + nz * disp);
  }

  posAttr.needsUpdate = true;
  cloned.computeVertexNormals();
  return cloned;
}

/**
 * Applies axial twist deformation around Y-axis.
 */
export function applyTwist(
  geometry: THREE.BufferGeometry,
  twistAngleRadians: number
): THREE.BufferGeometry {
  const cloned = geometry.clone();
  const posAttr = cloned.getAttribute('position') as THREE.BufferAttribute;
  if (!posAttr) return cloned;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const angle = y * twistAngleRadians;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const newX = x * cosA - z * sinA;
    const newZ = x * sinA + z * cosA;

    posAttr.setXYZ(i, newX, y, newZ);
  }

  posAttr.needsUpdate = true;
  cloned.computeVertexNormals();
  return cloned;
}

/**
 * Midpoint face subdivision for triangle meshes, preserving UV coordinates and normals.
 */
export function applySubdivisionRefinement(
  geometry: THREE.BufferGeometry,
  levels: number
): THREE.BufferGeometry {
  if (!geometry.getAttribute('position') || levels <= 0) {
    return geometry.clone();
  }

  let currentGeo = geometry.toNonIndexed();

  for (let lvl = 0; lvl < levels; lvl++) {
    const pos = currentGeo.getAttribute('position') as THREE.BufferAttribute;
    if (!pos || pos.count === 0) break;

    const uvAttr = currentGeo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const triCount = Math.floor(pos.count / 3);
    const newPos = new Float32Array(triCount * 4 * 3 * 3);
    const newUv = uvAttr ? new Float32Array(triCount * 4 * 3 * 2) : null;

    let outPosIdx = 0;
    let outUvIdx = 0;

    for (let t = 0; t < triCount; t++) {
      const idx = t * 3;
      const v0 = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
      const v1 = new THREE.Vector3(pos.getX(idx + 1), pos.getY(idx + 1), pos.getZ(idx + 1));
      const v2 = new THREE.Vector3(pos.getX(idx + 2), pos.getY(idx + 2), pos.getZ(idx + 2));

      // Compute midpoints of triangle edges
      const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
      const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5);

      const addTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
        newPos[outPosIdx++] = a.x; newPos[outPosIdx++] = a.y; newPos[outPosIdx++] = a.z;
        newPos[outPosIdx++] = b.x; newPos[outPosIdx++] = b.y; newPos[outPosIdx++] = b.z;
        newPos[outPosIdx++] = c.x; newPos[outPosIdx++] = c.y; newPos[outPosIdx++] = c.z;
      };

      // 4 sub-triangles
      addTri(v0, m01, m20);
      addTri(m01, v1, m12);
      addTri(m20, m12, v2);
      addTri(m01, m12, m20);

      // Handle UV interpolation if present
      if (uvAttr && newUv) {
        const u0: [number, number] = [uvAttr.getX(idx), uvAttr.getY(idx)];
        const u1: [number, number] = [uvAttr.getX(idx + 1), uvAttr.getY(idx + 1)];
        const u2: [number, number] = [uvAttr.getX(idx + 2), uvAttr.getY(idx + 2)];

        const mu01: [number, number] = [(u0[0] + u1[0]) * 0.5, (u0[1] + u1[1]) * 0.5];
        const mu12: [number, number] = [(u1[0] + u2[0]) * 0.5, (u1[1] + u2[1]) * 0.5];
        const mu20: [number, number] = [(u2[0] + u0[0]) * 0.5, (u2[1] + u0[1]) * 0.5];

        const addUvTri = (a: [number, number], b: [number, number], c: [number, number]) => {
          newUv[outUvIdx++] = a[0]; newUv[outUvIdx++] = a[1];
          newUv[outUvIdx++] = b[0]; newUv[outUvIdx++] = b[1];
          newUv[outUvIdx++] = c[0]; newUv[outUvIdx++] = c[1];
        };

        addUvTri(u0, mu01, mu20);
        addUvTri(mu01, u1, mu12);
        addUvTri(mu20, mu12, u2);
        addUvTri(mu01, mu12, mu20);
      }
    }

    const nextGeo = new THREE.BufferGeometry();
    nextGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    if (newUv) {
      nextGeo.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
    }
    nextGeo.computeVertexNormals();
    currentGeo = nextGeo;
  }

  return currentGeo;
}

/**
 * Calculates polycount stats (triangles and vertices count).
 */
export function calculateGeometryStats(geometry: THREE.BufferGeometry): { vertices: number; triangles: number } {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return { vertices: 0, triangles: 0 };

  const vertices = posAttr.count;
  const triangles = geometry.index ? geometry.index.count / 3 : vertices / 3;

  return {
    vertices,
    triangles: Math.round(triangles),
  };
}

export interface SweptTubeOptions {
  points: THREE.Vector3[];
  radius?: number | ((progress: number) => number);
  radialSegments?: number;
  closed?: boolean;
  capStart?: boolean;
  capEnd?: boolean;
}

/**
 * Sweeps a circular or variable-radius tube along an arbitrary 3D curve using
 * rotation-minimizing Bishop frames, with smooth normals, UV mapping, and end caps.
 */
export function createSweptTubeGeometry(options: SweptTubeOptions): THREE.BufferGeometry {
  const points = options.points;
  if (!points || points.length < 2) {
    return new THREE.BufferGeometry();
  }

  const radialSegments = Math.max(3, options.radialSegments ?? 12);
  const closed = !!options.closed;
  const capStart = options.capStart ?? !closed;
  const capEnd = options.capEnd ?? !closed;
  const radiusFn = typeof options.radius === 'function'
    ? options.radius
    : () => (typeof options.radius === 'number' ? options.radius : 0.05);

  const numRings = points.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < numRings; i++) {
    let t: THREE.Vector3;
    if (i === 0) {
      t = closed
        ? new THREE.Vector3().subVectors(points[1], points[numRings - 1]).normalize()
        : new THREE.Vector3().subVectors(points[1], points[0]).normalize();
    } else if (i === numRings - 1) {
      t = closed
        ? new THREE.Vector3().subVectors(points[0], points[numRings - 2]).normalize()
        : new THREE.Vector3().subVectors(points[numRings - 1], points[numRings - 2]).normalize();
    } else {
      t = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();
    }
    if (t.lengthSq() < 0.0001) t.set(0, 1, 0);
    tangents.push(t);
  }

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];

  let n0 = new THREE.Vector3(0, 1, 0).cross(tangents[0]);
  if (n0.lengthSq() < 0.001) {
    n0 = new THREE.Vector3(0, 0, 1).cross(tangents[0]);
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

  const positions: number[] = [];
  const vertexNormals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < numRings; i++) {
    const pt = points[i];
    const n = normals[i];
    const b = binormals[i];
    const progress = i / (numRings - 1);
    const rad = Math.max(0.0001, radiusFn(progress));

    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const nx = n.x * cosA + b.x * sinA;
      const ny = n.y * cosA + b.y * sinA;
      const nz = n.z * cosA + b.z * sinA;

      positions.push(pt.x + nx * rad, pt.y + ny * rad, pt.z + nz * rad);
      vertexNormals.push(nx, ny, nz);
      uvs.push(j / radialSegments, progress);
    }
  }

  const stride = radialSegments + 1;
  const ringCount = closed ? numRings : numRings - 1;
  for (let i = 0; i < ringCount; i++) {
    const nextRing = (i + 1) % numRings;
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = nextRing * stride + j;
      const c = nextRing * stride + (j + 1);
      const d = i * stride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart && !closed) {
    const centerIdx = positions.length / 3;
    const pt = points[0];
    const tan = tangents[0];
    positions.push(pt.x, pt.y, pt.z);
    vertexNormals.push(-tan.x, -tan.y, -tan.z);
    uvs.push(0.5, 0.5);

    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd && !closed) {
    const centerIdx = positions.length / 3;
    const pt = points[numRings - 1];
    const tan = tangents[numRings - 1];
    positions.push(pt.x, pt.y, pt.z);
    vertexNormals.push(tan.x, tan.y, tan.z);
    uvs.push(0.5, 0.5);

    const lastRingStart = (numRings - 1) * stride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, lastRingStart + j, lastRingStart + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertexNormals), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  return geo;
}

export interface GearSprocketOptions {
  toothCount: number;
  pitchRadius: number;
  toothHeight?: number;
  thickness?: number;
  boreRadius?: number;
}

/**
 * Procedurally generates an involute/trapezoidal mechanical cog wheel with chamfered teeth and center bore.
 */
export function createGearSprocketGeometry(options: GearSprocketOptions): THREE.BufferGeometry {
  const toothCount = Math.max(6, options.toothCount);
  const pitchRadius = Math.max(0.01, options.pitchRadius);
  const toothHeight = options.toothHeight ?? pitchRadius * 0.15;
  const thickness = options.thickness ?? 0.003;
  const boreRadius = options.boreRadius ?? pitchRadius * 0.35;

  const shape = new THREE.Shape();
  const rootRadius = pitchRadius - toothHeight * 0.5;
  const tipRadius = pitchRadius + toothHeight * 0.5;
  const totalSteps = toothCount * 4;

  for (let i = 0; i <= totalSteps; i++) {
    const toothIdx = Math.floor(i / 4);
    const subStep = i % 4;
    const baseAngle = (toothIdx / toothCount) * Math.PI * 2;
    const stepAngle = (1 / (toothCount * 4)) * Math.PI * 2;
    const angle = baseAngle + subStep * stepAngle;

    let r: number;
    switch (subStep) {
      case 0:
        r = rootRadius;
        break;
      case 1:
        r = tipRadius;
        break;
      case 2:
        r = tipRadius;
        break;
      case 3:
      default:
        r = rootRadius;
        break;
    }

    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  if (boreRadius > 0.001) {
    const holePath = new THREE.Path();
    const holeSteps = 24;
    for (let i = 0; i <= holeSteps; i++) {
      const a = (i / holeSteps) * Math.PI * 2;
      const hx = Math.cos(a) * boreRadius;
      const hy = Math.sin(a) * boreRadius;
      if (i === 0) holePath.moveTo(hx, hy);
      else holePath.lineTo(hx, hy);
    }
    shape.holes.push(holePath);
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: Math.min(thickness * 0.25, 0.0015),
    bevelThickness: Math.min(thickness * 0.25, 0.0015),
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}
