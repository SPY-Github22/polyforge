import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
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

  it('populates vertex colors for ambient occlusion scalar values centered around 1.0', () => {
    const result = generateBotanicalOakTree({ seed: 123, leafCount: 50 });

    // Verify materials use white color to preserve texture diffuse without triple multiplication
    expect(result.trunkItem.material.color).toBe('#ffffff');
    expect(result.matureLeavesItem.material.color).toBe('#ffffff');
    expect(result.youngLeavesItem.material.color).toBe('#ffffff');

    // Trunk vertex colors represent AO scalars (r === g === b)
    const barkColors = result.trunkItem.geometryParams?.customGeometry?.colors;
    expect(barkColors).toBeDefined();
    expect(barkColors?.length).toBe(result.trunkItem.geometryParams?.customGeometry?.positions.length);

    // Foliage vertex colors represent AO scalars (r === g === b)
    const leafColors = result.matureLeavesItem.geometryParams?.customGeometry?.colors;
    expect(leafColors).toBeDefined();
    expect(leafColors?.length).toBe(result.matureLeavesItem.geometryParams?.customGeometry?.positions.length);

    // Verify colors are valid AO scalars (r === g === b) centered around 1.0
    for (let i = 0; i < Math.min(90, barkColors!.length); i += 3) {
      expect(barkColors![i]).toBeGreaterThanOrEqual(0.65);
      expect(barkColors![i]).toBeLessThanOrEqual(1.25);
      expect(barkColors![i]).toBeCloseTo(barkColors![i + 1], 4);
      expect(barkColors![i + 1]).toBeCloseTo(barkColors![i + 2], 4);
    }

    for (let i = 0; i < Math.min(90, leafColors!.length); i += 3) {
      expect(leafColors![i]).toBeGreaterThanOrEqual(0.70);
      expect(leafColors![i]).toBeLessThanOrEqual(1.15);
      expect(leafColors![i]).toBeCloseTo(leafColors![i + 1], 4);
      expect(leafColors![i + 1]).toBeCloseTo(leafColors![i + 2], 4);
    }
  });

  it('generates dense canopy foliage with default 3800 leaf sprays across all branch tiers', () => {
    const result = generateBotanicalOakTree({ seed: 42 }); // Uses default leafCount 3800
    expect(result.stats.leafTriangles).toBeGreaterThanOrEqual(3500 * 4); // each spray has multiple triangles
    expect(result.stats.totalVertices).toBeGreaterThan(50000);
    expect(result.matureLeavesItem.material.transmission).toBe(0);
    expect(result.youngLeavesItem.material.transmission).toBe(0);

    // Verify leaf triangle winding aligns with vertex normals (dot product > 0)
    const positions = result.matureLeavesItem.geometryParams?.customGeometry?.positions!;
    const normals = result.matureLeavesItem.geometryParams?.customGeometry?.normals!;
    const indices = result.matureLeavesItem.geometryParams?.customGeometry?.indices!;

    let positiveDotCount = 0;
    const testCount = Math.min(100, indices.length / 3);
    for (let t = 0; t < testCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];

      const p0 = new THREE.Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const p1 = new THREE.Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const p2 = new THREE.Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

      const e1 = new THREE.Vector3().subVectors(p1, p0);
      const e2 = new THREE.Vector3().subVectors(p2, p0);
      const faceNormal = new THREE.Vector3().crossVectors(e1, e2).normalize();

      const vNormal = new THREE.Vector3(normals[i0 * 3], normals[i0 * 3 + 1], normals[i0 * 3 + 2]).normalize();
      const dot = faceNormal.dot(vNormal);
      if (dot > 0.5) {
        positiveDotCount++;
      }
    }
    // 100% of tested leaf faces have face normal pointing along vertex normal
    expect(positiveDotCount).toBe(testCount);
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
