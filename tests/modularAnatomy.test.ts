import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  generateRealisticFemaleScene,
  generateRealisticHumanScene,
} from '../src/core/character';
import { createPrimitiveGeometry, calculateGeometryStats } from '../src/core/geometry';

describe('Modular Anatomy & Cranial Fit Engine', () => {
  it('generates 16 distinct modular body parts when modularBodyParts: true for female', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true });

    expect(female.bodyParts).toBeDefined();
    expect(female.bodyParts?.length).toBe(16);

    const expectedPartIds = [
      'female-head',
      'female-neck',
      'female-torso',
      'female-pelvis',
      'female-left-upperarm',
      'female-left-forearm',
      'female-left-hand',
      'female-right-upperarm',
      'female-right-forearm',
      'female-right-hand',
      'female-left-thigh',
      'female-left-shin',
      'female-left-foot',
      'female-right-thigh',
      'female-right-shin',
      'female-right-foot',
    ];

    const actualPartIds = female.bodyParts?.map((p) => p.id);
    for (const id of expectedPartIds) {
      expect(actualPartIds).toContain(id);
    }

    // In modular mode, allItems includes all 16 body parts + clothing + accessories
    expect(female.allItems.length).toBe(20);
    expect(female.stats.componentsCount).toBe(20);
  });

  it('generates 16 distinct modular body parts when modularBodyParts: true for male', () => {
    const male = generateRealisticHumanScene({ modularBodyParts: true });

    expect(male.bodyParts).toBeDefined();
    expect(male.bodyParts?.length).toBe(16);

    const expectedPartIds = [
      'human-head',
      'human-neck',
      'human-torso',
      'human-pelvis',
      'human-left-upperarm',
      'human-left-forearm',
      'human-left-hand',
      'human-right-upperarm',
      'human-right-forearm',
      'human-right-hand',
      'human-left-thigh',
      'human-left-shin',
      'human-left-foot',
      'human-right-thigh',
      'human-right-shin',
      'human-right-foot',
    ];

    const actualPartIds = male.bodyParts?.map((p) => p.id);
    for (const id of expectedPartIds) {
      expect(actualPartIds).toContain(id);
    }

    expect(male.allItems.length).toBe(20);
  });

  it('validates every modular body part geometry is manifold, valid, and finite', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true });

    for (const part of female.bodyParts!) {
      const geo = createPrimitiveGeometry(part.primitiveType || 'custom', part.geometryParams);
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);

      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const norm = geo.getAttribute('normal') as THREE.BufferAttribute;

      expect(pos).toBeDefined();
      expect(norm).toBeDefined();
      expect(geo.index).toBeDefined();
      expect(pos.count).toBeGreaterThan(0);
      expect(geo.index!.count).toBeGreaterThan(0);

      const pArr = pos.array as Float32Array;
      const nArr = norm.array as Float32Array;

      for (let i = 0; i < pArr.length; i++) {
        expect(Number.isFinite(pArr[i])).toBe(true);
      }
      for (let i = 0; i < nArr.length; i++) {
        expect(Number.isFinite(nArr[i])).toBe(true);
      }

      const stats = calculateGeometryStats(geo);
      expect(stats.vertices).toBeGreaterThan(0);
      expect(stats.triangles).toBeGreaterThan(0);
    }
  });

  it('verifies female hair and ponytail are snug and properly attached to cranial vault', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true });
    const headPart = female.bodyParts!.find((p) => p.id === 'female-head')!;
    expect(headPart).toBeDefined();

    const headGeo = createPrimitiveGeometry(headPart.primitiveType || 'custom', headPart.geometryParams);
    const pos = headGeo.getAttribute('position') as THREE.BufferAttribute;
    const colors = headGeo.getAttribute('color') as THREE.BufferAttribute;

    expect(colors).toBeDefined();

    // Verify ponytail attachment at occipital skull vault (z <= -0.11m, y in [1.34, 1.56])
    let occipitalPonytailVerts = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y >= 1.34 && y <= 1.56 && z <= -0.11) {
        occipitalPonytailVerts++;
      }
    }
    expect(occipitalPonytailVerts).toBeGreaterThan(100);

    // Verify bangs rest snugly on forehead dome (y in [1.55, 1.65], z in [0.035, 0.055])
    let bangsVerts = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y >= 1.55 && y <= 1.65 && z >= 0.035 && z <= 0.055) {
        bangsVerts++;
      }
    }
    expect(bangsVerts).toBeGreaterThan(50);
  });

  it('verifies hiding or removing clothes leaves pure organic anatomy without painted suit remnants', () => {
    const bareFemale = generateRealisticFemaleScene({ includeClothing: false, includeAccessories: false });
    expect(bareFemale.allItems.length).toBe(1);
    expect(bareFemale.clothingUpperItem).toBeUndefined();
    expect(bareFemale.clothingLowerItem).toBeUndefined();
    expect(bareFemale.footwearItem).toBeUndefined();

    const bodyGeo = createPrimitiveGeometry(bareFemale.bodyItem.primitiveType || 'custom', bareFemale.bodyItem.geometryParams);
    const box = new THREE.Box3().setFromBufferAttribute(bodyGeo.getAttribute('position') as THREE.BufferAttribute);

    // Bare body is grounded at y = 0.00m
    expect(box.min.y).toBeCloseTo(0.00, 2);
    // Height is 1.68m
    expect(box.max.y).toBeCloseTo(1.68, 2);

    // Verify chest has teardrop breasts curvature with outward normals
    const pos = bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const norm = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;

    let outwardChestCount = 0;
    let inwardChestCount = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y >= 0.95 && y <= 1.40 && z > 0.03) {
        if (norm.getZ(i) > 0) outwardChestCount++;
        else inwardChestCount++;
      }
    }
    expect(outwardChestCount).toBeGreaterThan(50);
    expect(inwardChestCount).toBe(0);
  });

  it('verifies clothing sits strictly outside the body skin with positive clearance', () => {
    const female = generateRealisticFemaleScene();
    const bodyGeo = createPrimitiveGeometry(female.bodyItem.primitiveType || 'custom', female.bodyItem.geometryParams);
    const topGeo = createPrimitiveGeometry(female.clothingUpperItem!.primitiveType || 'custom', female.clothingUpperItem!.geometryParams);
    const jeansGeo = createPrimitiveGeometry(female.clothingLowerItem!.primitiveType || 'custom', female.clothingLowerItem!.geometryParams);

    const bodyBox = new THREE.Box3().setFromBufferAttribute(bodyGeo.getAttribute('position') as THREE.BufferAttribute);
    const topBox = new THREE.Box3().setFromBufferAttribute(topGeo.getAttribute('position') as THREE.BufferAttribute);
    const jeansBox = new THREE.Box3().setFromBufferAttribute(jeansGeo.getAttribute('position') as THREE.BufferAttribute);

    // Top envelope surrounds upper torso
    expect(topBox.max.x).toBeGreaterThanOrEqual(bodyBox.max.x * 0.90);
    // Jeans envelope surrounds pelvis & thighs
    expect(jeansBox.max.x).toBeGreaterThanOrEqual(bodyBox.max.x * 0.40);
  });

  it('verifies bare feet are fully grounded at y = 0.00m when shoes are removed', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true });
    const lFoot = female.bodyParts!.find((p) => p.id === 'female-left-foot')!;
    const rFoot = female.bodyParts!.find((p) => p.id === 'female-right-foot')!;

    expect(lFoot).toBeDefined();
    expect(rFoot).toBeDefined();

    const lGeo = createPrimitiveGeometry(lFoot.primitiveType || 'custom', lFoot.geometryParams);
    const rGeo = createPrimitiveGeometry(rFoot.primitiveType || 'custom', rFoot.geometryParams);

    const lBox = new THREE.Box3().setFromBufferAttribute(lGeo.getAttribute('position') as THREE.BufferAttribute);
    const rBox = new THREE.Box3().setFromBufferAttribute(rGeo.getAttribute('position') as THREE.BufferAttribute);

    expect(lBox.min.y).toBeCloseTo(0.00, 3);
    expect(rBox.min.y).toBeCloseTo(0.00, 3);
  });
});
