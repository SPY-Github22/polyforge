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
    }
  }

  geo.computeVertexNormals();
  return geo;
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
 * Midpoint face subdivision for triangle meshes.
 */
export function applySubdivisionRefinement(
  geometry: THREE.BufferGeometry,
  levels: number
): THREE.BufferGeometry {
  let currentGeo = geometry.toNonIndexed();

  for (let lvl = 0; lvl < levels; lvl++) {
    const pos = currentGeo.getAttribute('position') as THREE.BufferAttribute;
    const triCount = pos.count / 3;
    const newPos = new Float32Array(triCount * 4 * 3 * 3);
    let outIdx = 0;

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
        newPos[outIdx++] = a.x; newPos[outIdx++] = a.y; newPos[outIdx++] = a.z;
        newPos[outIdx++] = b.x; newPos[outIdx++] = b.y; newPos[outIdx++] = b.z;
        newPos[outIdx++] = c.x; newPos[outIdx++] = c.y; newPos[outIdx++] = c.z;
      };

      // 4 sub-triangles
      addTri(v0, m01, m20);
      addTri(m01, v1, m12);
      addTri(m20, m12, v2);
      addTri(m01, m12, m20);
    }

    const nextGeo = new THREE.BufferGeometry();
    nextGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
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
