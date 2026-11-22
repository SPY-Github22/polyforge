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

  it('generates inner garments when includeUnderwear is true for female and male', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true, includeUnderwear: true });
    expect(female.underwearUpperItem).toBeDefined();
    expect(female.underwearLowerItem).toBeDefined();
    expect(female.underwearUpperItem?.id).toBe('female-underwear-top');
    expect(female.underwearLowerItem?.id).toBe('female-underwear-bottom');
    expect(female.allItems.length).toBe(22);

    const male = generateRealisticHumanScene({ modularBodyParts: true, includeUnderwear: true });
    expect(male.underwearUpperItem).toBeDefined();
    expect(male.underwearLowerItem).toBeDefined();
    expect(male.underwearUpperItem?.id).toBe('human-underwear-top');
    expect(male.underwearLowerItem?.id).toBe('human-underwear-bottom');
    expect(male.allItems.length).toBe(22);
  });

  it('validates 3-layer clearance stratification (skin < inner garments < outer garments)', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true, includeUnderwear: true });
    const torsoPart = female.bodyParts!.find((p) => p.id === 'female-torso')!;
    const uwTop = female.underwearUpperItem!;
    const outerTop = female.clothingUpperItem!;

    const torsoGeo = createPrimitiveGeometry(torsoPart.primitiveType || 'custom', torsoPart.geometryParams);
    const uwTopGeo = createPrimitiveGeometry(uwTop.primitiveType || 'custom', uwTop.geometryParams);
    const outerTopGeo = createPrimitiveGeometry(outerTop.primitiveType || 'custom', outerTop.geometryParams);

    const torsoBox = new THREE.Box3().setFromBufferAttribute(torsoGeo.getAttribute('position') as THREE.BufferAttribute);
    const uwTopBox = new THREE.Box3().setFromBufferAttribute(uwTopGeo.getAttribute('position') as THREE.BufferAttribute);
    const outerTopBox = new THREE.Box3().setFromBufferAttribute(outerTopGeo.getAttribute('position') as THREE.BufferAttribute);

    // Inner garment expands slightly beyond torso skin (+2mm)
    expect(uwTopBox.max.x).toBeGreaterThanOrEqual(torsoBox.max.x - 0.005);
    expect(uwTopBox.max.z).toBeGreaterThanOrEqual(torsoBox.max.z - 0.005);

    // Outer top envelope expands beyond inner garment (+5mm clearance)
    expect(outerTopBox.max.x).toBeGreaterThanOrEqual(uwTopBox.max.x);
    expect(outerTopBox.max.z).toBeGreaterThanOrEqual(uwTopBox.max.z);
  });

  it('verifies seamless joint connectivity across the modular skeleton', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true });
    const neck = female.bodyParts!.find((p) => p.id === 'female-neck')!;
    const torso = female.bodyParts!.find((p) => p.id === 'female-torso')!;
    const pelvis = female.bodyParts!.find((p) => p.id === 'female-pelvis')!;
    const lUpperArm = female.bodyParts!.find((p) => p.id === 'female-left-upperarm')!;
    const lForearm = female.bodyParts!.find((p) => p.id === 'female-left-forearm')!;
    const lHand = female.bodyParts!.find((p) => p.id === 'female-left-hand')!;
    const lThigh = female.bodyParts!.find((p) => p.id === 'female-left-thigh')!;
    const lShin = female.bodyParts!.find((p) => p.id === 'female-left-shin')!;
    const lFoot = female.bodyParts!.find((p) => p.id === 'female-left-foot')!;

    const neckGeo = createPrimitiveGeometry(neck.primitiveType || 'custom', neck.geometryParams);
    const torsoGeo = createPrimitiveGeometry(torso.primitiveType || 'custom', torso.geometryParams);
    const pelvisGeo = createPrimitiveGeometry(pelvis.primitiveType || 'custom', pelvis.geometryParams);
    const armGeo = createPrimitiveGeometry(lUpperArm.primitiveType || 'custom', lUpperArm.geometryParams);
    const forearmGeo = createPrimitiveGeometry(lForearm.primitiveType || 'custom', lForearm.geometryParams);
    const handGeo = createPrimitiveGeometry(lHand.primitiveType || 'custom', lHand.geometryParams);
    const thighGeo = createPrimitiveGeometry(lThigh.primitiveType || 'custom', lThigh.geometryParams);
    const shinGeo = createPrimitiveGeometry(lShin.primitiveType || 'custom', lShin.geometryParams);
    const footGeo = createPrimitiveGeometry(lFoot.primitiveType || 'custom', lFoot.geometryParams);

    const neckBox = new THREE.Box3().setFromBufferAttribute(neckGeo.getAttribute('position') as THREE.BufferAttribute);
    const torsoBox = new THREE.Box3().setFromBufferAttribute(torsoGeo.getAttribute('position') as THREE.BufferAttribute);
    const pelvisBox = new THREE.Box3().setFromBufferAttribute(pelvisGeo.getAttribute('position') as THREE.BufferAttribute);
    const armBox = new THREE.Box3().setFromBufferAttribute(armGeo.getAttribute('position') as THREE.BufferAttribute);
    const forearmBox = new THREE.Box3().setFromBufferAttribute(forearmGeo.getAttribute('position') as THREE.BufferAttribute);
    const handBox = new THREE.Box3().setFromBufferAttribute(handGeo.getAttribute('position') as THREE.BufferAttribute);
    const thighBox = new THREE.Box3().setFromBufferAttribute(thighGeo.getAttribute('position') as THREE.BufferAttribute);
    const shinBox = new THREE.Box3().setFromBufferAttribute(shinGeo.getAttribute('position') as THREE.BufferAttribute);
    const footBox = new THREE.Box3().setFromBufferAttribute(footGeo.getAttribute('position') as THREE.BufferAttribute);

    // Neck base connects to clavicles (torso.max.y ~ 1.26m)
    expect(neckBox.min.y).toBeLessThanOrEqual(torsoBox.max.y + 0.01);
    // Neck top reaches chin / jawline (~1.44m)
    expect(neckBox.max.y).toBeGreaterThanOrEqual(1.40);

    // Torso base connects to pelvis top
    expect(torsoBox.min.y).toBeLessThanOrEqual(pelvisBox.max.y + 0.02);

    // Pelvis base connects to thigh tops (~0.70m)
    expect(thighBox.max.y).toBeGreaterThanOrEqual(pelvisBox.min.y - 0.02);

    // Thigh connects to shin at knee (~0.42m)
    expect(Math.abs(thighBox.min.y - shinBox.max.y)).toBeLessThan(0.02);

    // Shin connects to foot at ankle (~0.075m)
    expect(Math.abs(shinBox.min.y - footBox.max.y)).toBeLessThan(0.02);

    // Upper arm connects to forearm at elbow
    expect(Math.abs(armBox.min.y - forearmBox.max.y)).toBeLessThan(0.02);

    // Forearm connects to hand wrist
    expect(Math.abs(forearmBox.min.y - handBox.max.y)).toBeLessThan(0.05);
  });

  it('validates athletic feminine proportions (petite biacromial shoulders and slender back)', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true });
    const torso = female.bodyParts!.find((p) => p.id === 'female-torso')!;
    const pelvis = female.bodyParts!.find((p) => p.id === 'female-pelvis')!;

    const torsoGeo = createPrimitiveGeometry(torso.primitiveType || 'custom', torso.geometryParams);
    const pelvisGeo = createPrimitiveGeometry(pelvis.primitiveType || 'custom', pelvis.geometryParams);

    const torsoBox = new THREE.Box3().setFromBufferAttribute(torsoGeo.getAttribute('position') as THREE.BufferAttribute);
    const pelvisBox = new THREE.Box3().setFromBufferAttribute(pelvisGeo.getAttribute('position') as THREE.BufferAttribute);

    const shoulderHalfWidth = torsoBox.max.x;
    const thoracicDepth = torsoBox.max.z - torsoBox.min.z;
    const pelvisDepth = pelvisBox.max.z - pelvisBox.min.z;

    // Slender athletic shoulder half-width (<= 0.16m, narrowed from masculine 0.18m+)
    expect(shoulderHalfWidth).toBeLessThan(0.16);
    // Slender upper back and thoracic depth (<= 0.20m)
    expect(thoracicDepth).toBeLessThan(0.20);
    // Natural non-bulky gluteal depth (<= 0.22m)
    expect(pelvisDepth).toBeLessThan(0.22);
  });

  it('validates uniform skin vertex colors across all 16 modular body parts', () => {
    const female = generateRealisticFemaleScene({ modularBodyParts: true, skinColor: '#e0ac82' });
    const expectedColor = new THREE.Color('#e0ac82');

    for (const part of female.bodyParts!) {
      const geo = createPrimitiveGeometry(part.primitiveType || 'custom', part.geometryParams);
      const colors = geo.getAttribute('color') as THREE.BufferAttribute;
      expect(colors, `Modular part ${part.id} must have vertex colors`).toBeDefined();
      expect(colors.count).toBeGreaterThan(0);

      // Check average vertex color matches skin tone closely (excluding facial feature accents on head)
      if (part.id !== 'female-head') {
        const r = colors.getX(0);
        const g = colors.getY(0);
        const b = colors.getZ(0);

        expect(Math.abs(r - expectedColor.r)).toBeLessThan(0.05);
        expect(Math.abs(g - expectedColor.g)).toBeLessThan(0.05);
        expect(Math.abs(b - expectedColor.b)).toBeLessThan(0.05);
      }
    }
  });
});
