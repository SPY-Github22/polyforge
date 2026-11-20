import { describe, it, expect } from 'vitest';
import { generateBotanicalOakTree } from '../src/core/botany';
import { createPrimitiveGeometry, calculateGeometryStats } from '../src/core/geometry';
import { exportSceneToOBJString } from '../src/core/io';

describe('Botanical Engine & High-Poly Tree Generator', () => {
  it('generates high-poly oak tree with trunk and dual-canopy foliage', () => {
    const result = generateBotanicalOakTree({
      seed: 42,
      leafCount: 400, // small leaf count for fast test
      scaffoldBranches: 5,
    });

    expect(result.trunkItem).toBeDefined();
    expect(result.matureLeavesItem).toBeDefined();
    expect(result.youngLeavesItem).toBeDefined();
    expect(result.allItems.length).toBe(3);

    expect(result.stats.barkVertices).toBeGreaterThan(500);
    expect(result.stats.leafVertices).toBeGreaterThan(1000);
    expect(result.stats.totalVertices).toBeGreaterThan(1500);
    expect(result.stats.totalTriangles).toBeGreaterThan(1000);

    // Verify trunk geometry converts to BufferGeometry
    const barkGeo = createPrimitiveGeometry(
      result.trunkItem.primitiveType || 'custom',
      result.trunkItem.geometryParams
    );
    expect(barkGeo.getAttribute('position')).toBeDefined();
    expect(barkGeo.getAttribute('normal')).toBeDefined();
    expect(barkGeo.getAttribute('uv')).toBeDefined();
    expect(barkGeo.index).toBeDefined();

    const barkStats = calculateGeometryStats(barkGeo);
    expect(barkStats.vertices).toBe(result.stats.barkVertices);
    expect(barkStats.triangles).toBe(result.stats.barkTriangles);

    // Verify leaves geometry converts to BufferGeometry
    const leafGeo = createPrimitiveGeometry(
      result.matureLeavesItem.primitiveType || 'custom',
      result.matureLeavesItem.geometryParams
    );
    expect(leafGeo.getAttribute('position')).toBeDefined();
    expect(leafGeo.getAttribute('normal')).toBeDefined();
    expect(leafGeo.getAttribute('uv')).toBeDefined();
    expect(leafGeo.index).toBeDefined();
  });

  it('exports botanical oak tree scene to OBJ format cleanly', () => {
    const result = generateBotanicalOakTree({
      seed: 99,
      leafCount: 100,
    });

    const objString = exportSceneToOBJString(result.allItems);
    expect(objString).toContain('o Wood - Bark');
    expect(objString).toContain('o Leaf Oak');
    expect(objString).toContain('v ');
    expect(objString).toContain('vn ');
    expect(objString).toContain('vt ');
    expect(objString).toContain('f ');
  });

  it('deterministic generation matches with identical seeds', () => {
    const resA = generateBotanicalOakTree({ seed: 777, leafCount: 200 });
    const resB = generateBotanicalOakTree({ seed: 777, leafCount: 200 });

    expect(resA.stats.totalVertices).toBe(resB.stats.totalVertices);
    expect(resA.stats.totalTriangles).toBe(resB.stats.totalTriangles);
    expect(resA.trunkItem.geometryParams?.customGeometry?.positions[0])
      .toBeCloseTo(resB.trunkItem.geometryParams?.customGeometry?.positions[0]!);
  });
});
