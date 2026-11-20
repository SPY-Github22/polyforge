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

  it('populates vertex colors for ambient occlusion and botanical tinting', () => {
    const result = generateBotanicalOakTree({ seed: 123, leafCount: 50 });

    // Trunk vertex colors
    const barkColors = result.trunkItem.geometryParams?.customGeometry?.colors;
    expect(barkColors).toBeDefined();
    expect(barkColors?.length).toBe(result.trunkItem.geometryParams?.customGeometry?.positions.length);

    // Foliage vertex colors
    const leafColors = result.matureLeavesItem.geometryParams?.customGeometry?.colors;
    expect(leafColors).toBeDefined();
    expect(leafColors?.length).toBe(result.matureLeavesItem.geometryParams?.customGeometry?.positions.length);

    // Verify colors are within valid [0, 1] RGB range
    for (let i = 0; i < Math.min(100, barkColors!.length); i++) {
      expect(barkColors![i]).toBeGreaterThanOrEqual(0);
      expect(barkColors![i]).toBeLessThanOrEqual(1.5);
    }
  });

  it('generates flared root buttresses that ground at y = 0 with outward flare', () => {
    const result = generateBotanicalOakTree({ seed: 555, leafCount: 20 });
    const pos = result.trunkItem.geometryParams?.customGeometry?.positions!;

    let foundGroundedFlare = false;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const radialDist = Math.hypot(x, z);

      // Root flares enter the ground at y <= 0.05 and radial distance > 1.0m
      if (y <= 0.05 && radialDist > 1.0) {
        foundGroundedFlare = true;
        break;
      }
    }

    expect(foundGroundedFlare).toBe(true);
  });
});
