import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createPrimitiveGeometry,
  applyModifiers,
  applyNoiseDisplacement,
  applyTwist,
  applySubdivisionRefinement,
  calculateGeometryStats,
  createSweptTubeGeometry,
  createGearSprocketGeometry,
} from '../src/core/geometry';
import { PrimitiveType } from '../src/types';

describe('Geometry Engine', () => {
  const primitiveTypes: PrimitiveType[] = [
    'box',
    'sphere',
    'cylinder',
    'cone',
    'torus',
    'plane',
    'dodecahedron',
    'capsule',
  ];

  it('creates valid BufferGeometry with normals for all primitive types', () => {
    for (const type of primitiveTypes) {
      const geo = createPrimitiveGeometry(type);
      expect(geo).toBeDefined();

      const pos = geo.getAttribute('position');
      const normal = geo.getAttribute('normal');

      expect(pos).toBeDefined();
      expect(pos.count).toBeGreaterThan(0);
      expect(normal).toBeDefined();
      expect(normal.count).toBe(pos.count);

      const stats = calculateGeometryStats(geo);
      expect(stats.vertices).toBeGreaterThan(0);
      expect(stats.triangles).toBeGreaterThan(0);
    }
  });

  it('applies procedural noise displacement modifying vertex positions', () => {
    const baseBox = createPrimitiveGeometry('box');
    const origPos = (baseBox.getAttribute('position').clone());

    const displaced = applyNoiseDisplacement(baseBox, 0.5);
    const newPos = displaced.getAttribute('position');

    expect(newPos.count).toBe(origPos.count);

    let hasChanged = false;
    for (let i = 0; i < newPos.count; i++) {
      if (
        Math.abs(newPos.getX(i) - origPos.getX(i)) > 0.001 ||
        Math.abs(newPos.getY(i) - origPos.getY(i)) > 0.001 ||
        Math.abs(newPos.getZ(i) - origPos.getZ(i)) > 0.001
      ) {
        hasChanged = true;
        break;
      }
    }
    expect(hasChanged).toBe(true);
  });

  it('applies axial twist correctly', () => {
    const cylinder = createPrimitiveGeometry('cylinder');
    const origPos = cylinder.getAttribute('position').clone();

    const twisted = applyTwist(cylinder, Math.PI / 2);
    const newPos = twisted.getAttribute('position');

    expect(newPos.count).toBe(origPos.count);
    // At y != 0, vertices should rotate around Y
    let rotationFound = false;
    for (let i = 0; i < newPos.count; i++) {
      const y = origPos.getY(i);
      if (Math.abs(y) > 0.1) {
        const origX = origPos.getX(i);
        const newX = newPos.getX(i);
        if (Math.abs(newX - origX) > 0.001) {
          rotationFound = true;
          break;
        }
      }
    }
    expect(rotationFound).toBe(true);
  });

  it('subdivides triangle faces increasing triangle resolution', () => {
    const box = createPrimitiveGeometry('box');
    const baseStats = calculateGeometryStats(box);

    const subdivided = applySubdivisionRefinement(box, 1);
    const newStats = calculateGeometryStats(subdivided);

    // Each triangle gets divided into 4 subtriangles
    expect(newStats.triangles).toBe(baseStats.triangles * 4);
    expect(newStats.vertices).toBe(baseStats.triangles * 4 * 3);

    // UVs must be preserved for texturing to work
    const uvAttr = subdivided.getAttribute('uv');
    expect(uvAttr).toBeDefined();
    expect(uvAttr.count).toBe(newStats.vertices);
  });

  it('returns cloned geometry if modifiers array is empty or disabled', () => {
    const base = createPrimitiveGeometry('sphere');
    const baseCount = base.getAttribute('position').count;

    const result = applyModifiers(base, [
      { id: '1', type: 'twist', factor: 0, enabled: false },
    ]);
    expect(result.getAttribute('position').count).toBe(baseCount);
  });

  it('handles subdivision edge cases cleanly (levels=0 or empty geometry)', () => {
    const box = createPrimitiveGeometry('box');
    const zeroSub = applySubdivisionRefinement(box, 0);
    expect(zeroSub.getAttribute('position').count).toBe(box.getAttribute('position').count);

    const empty = new (box.constructor as typeof import('three').BufferGeometry)();
    const emptySub = applySubdivisionRefinement(empty, 1);
    expect(emptySub).toBeDefined();
  });

  it('creates custom geometry from vertex positions, uvs, and indices', () => {
    const customGeo = createPrimitiveGeometry('custom', {
      customGeometry: {
        positions: [
          0, 0, 0,
          1, 0, 0,
          0, 1, 0,
        ],
        uvs: [
          0, 0,
          1, 0,
          0, 1,
        ],
        indices: [0, 1, 2],
      },
    });

    expect(customGeo.getAttribute('position')).toBeDefined();
    expect(customGeo.getAttribute('position').count).toBe(3);
    expect(customGeo.getAttribute('uv')).toBeDefined();
    expect(customGeo.getAttribute('normal')).toBeDefined();
    expect(customGeo.index).toBeDefined();
    expect(customGeo.index!.count).toBe(3);
  });

  it('applies bark furrow and taper modifiers modifying vertex coordinates', () => {
    const cylinder = createPrimitiveGeometry('cylinder', { radialSegments: 16, heightSegments: 16 });
    const origPos = cylinder.getAttribute('position').clone();

    const furrowed = applyModifiers(cylinder, [
      { id: 'm1', type: 'bark_furrow', factor: 1.0, enabled: true },
      { id: 'm2', type: 'taper', factor: 0.5, enabled: true },
    ]);

    const modifiedPos = furrowed.getAttribute('position');
    expect(modifiedPos.count).toBe(origPos.count);

    let changed = false;
    for (let i = 0; i < modifiedPos.count; i++) {
      if (Math.abs(modifiedPos.getX(i) - origPos.getX(i)) > 0.001) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });

  it('generates swept tube geometry along a 3D spline with end caps', () => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 2, 0),
      new THREE.Vector3(2, 2, 0),
    ];
    const tubeGeo = createSweptTubeGeometry({
      points,
      radius: (t) => 0.05 * (1 - 0.3 * t),
      radialSegments: 10,
      capStart: true,
      capEnd: true,
    });

    expect(tubeGeo).toBeDefined();
    expect(tubeGeo.getAttribute('position')).toBeDefined();
    expect(tubeGeo.getAttribute('normal')).toBeDefined();
    expect(tubeGeo.getAttribute('uv')).toBeDefined();
    expect(tubeGeo.index).toBeDefined();
    expect(tubeGeo.getAttribute('position').count).toBeGreaterThan(40);
    expect(tubeGeo.index!.count).toBeGreaterThan(60);
  });

  it('generates mechanical gear sprocket geometry with teeth and center bore', () => {
    const sprocketGeo = createGearSprocketGeometry({
      toothCount: 16,
      pitchRadius: 0.08,
      toothHeight: 0.012,
      thickness: 0.003,
      boreRadius: 0.02,
    });

    expect(sprocketGeo).toBeDefined();
    expect(sprocketGeo.getAttribute('position')).toBeDefined();
    expect(sprocketGeo.getAttribute('normal')).toBeDefined();
    expect(sprocketGeo.getAttribute('position').count).toBeGreaterThan(50);
    expect(sprocketGeo.index ? sprocketGeo.index.count : sprocketGeo.getAttribute('position').count).toBeGreaterThan(50);
  });
});
