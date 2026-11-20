import { describe, it, expect } from 'vitest';
import {
  createPrimitiveGeometry,
  applyModifiers,
  applyNoiseDisplacement,
  applyTwist,
  applySubdivisionRefinement,
  calculateGeometryStats,
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
  });

  it('returns cloned geometry if modifiers array is empty or disabled', () => {
    const base = createPrimitiveGeometry('sphere');
    const baseCount = base.getAttribute('position').count;

    const result = applyModifiers(base, [
      { id: '1', type: 'twist', factor: 0, enabled: false },
    ]);
    expect(result.getAttribute('position').count).toBe(baseCount);
  });
});
