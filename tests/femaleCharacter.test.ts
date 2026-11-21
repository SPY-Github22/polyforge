import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  generateRealisticFemaleScene,
  generateRealisticHumanScene,
  RealisticHumanResult,
} from '../src/core/character';
import { createPrimitiveGeometry, calculateGeometryStats } from '../src/core/geometry';
import { exportSceneToOBJString, exportSceneToSTLString, exportSceneToGLTFBuffer } from '../src/core/io';

describe('Anatomical Female Character Engine', () => {
  it('generates a full female scene with 5 distinct sub-assemblies and complete anatomical fidelity', () => {
    const result: RealisticHumanResult = generateRealisticFemaleScene();

    expect(result.bodyItem).toBeDefined();
    expect(result.clothingUpperItem).toBeDefined();
    expect(result.clothingLowerItem).toBeDefined();
    expect(result.footwearItem).toBeDefined();
    expect(result.accessoriesItem).toBeDefined();
    expect(result.allItems.length).toBe(5);

    // Verify vertex & triangle counts meet high-fidelity standards
    expect(result.stats.bodyVertices).toBeGreaterThan(25000);
    expect(result.stats.bodyTriangles).toBeGreaterThan(50000);
    expect(result.stats.clothingVertices).toBeGreaterThan(5000);
    expect(result.stats.clothingTriangles).toBeGreaterThan(10000);
    expect(result.stats.footwearVertices).toBeGreaterThan(1000);
    expect(result.stats.footwearTriangles).toBeGreaterThan(2000);
    expect(result.stats.accessoriesVertices).toBeGreaterThan(600);
    expect(result.stats.accessoriesTriangles).toBeGreaterThan(800);

    expect(result.stats.totalVertices).toBeGreaterThanOrEqual(35000);
    expect(result.stats.totalTriangles).toBeGreaterThanOrEqual(50000);
    expect(result.stats.componentsCount).toBe(5);
  });

  it('constructs valid BufferGeometry with valid positions, normals, and uvs without NaNs or Infs', () => {
    const result = generateRealisticFemaleScene();

    for (const item of result.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);

      const pos = geo.getAttribute('position');
      const norm = geo.getAttribute('normal');
      const uv = geo.getAttribute('uv');

      expect(pos).toBeDefined();
      expect(norm).toBeDefined();
      expect(uv).toBeDefined();
      expect(geo.index).toBeDefined();

      const posArray = pos.array as Float32Array;
      const normArray = norm.array as Float32Array;

      // Ensure no NaN or infinite coordinates anywhere
      for (let i = 0; i < posArray.length; i++) {
        expect(Number.isFinite(posArray[i])).toBe(true);
      }
      for (let i = 0; i < normArray.length; i++) {
        expect(Number.isFinite(normArray[i])).toBe(true);
      }

      const stats = calculateGeometryStats(geo);
      expect(stats.vertices).toBeGreaterThan(0);
      expect(stats.triangles).toBeGreaterThan(0);
    }
  });

  it('adheres to realistic female anatomical proportions (approx 1.68m tall, grounded at y = 0)', () => {
    const result = generateRealisticFemaleScene();
    const group = new THREE.Group();

    for (const item of result.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      const mesh = new THREE.Mesh(geo);
      group.add(mesh);
    }

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Height should be approximately 1.68m (±0.04m tolerance)
    expect(size.y).toBeGreaterThanOrEqual(1.64);
    expect(size.y).toBeLessThanOrEqual(1.72);

    // Standing grounded with bottom of footwear at y = 0
    expect(box.min.y).toBeCloseTo(0.0, 2);

    // Female shoulder and stance width (~0.35m to 0.65m wide)
    expect(size.x).toBeGreaterThan(0.35);
    expect(size.x).toBeLessThan(0.65);

    // Front-to-back depth (~0.18m to 0.35m depth)
    expect(size.z).toBeGreaterThan(0.18);
    expect(size.z).toBeLessThan(0.35);
  });

  it('assigns correct procedural PBR material presets to each female sub-assembly', () => {
    const result = generateRealisticFemaleScene({
      skinColor: '#e0ac82',
      topColor: '#ec4899',
      pantsColor: '#1e3a8a',
      shoesColor: '#ffffff',
      watchColor: '#e2e8f0',
    });

    expect(result.bodyItem.material.texturePreset).toBe('skin_tone');
    expect(result.bodyItem.material.color).toBe('#e0ac82');

    expect(result.clothingUpperItem?.material.texturePreset).toBe('knit_cotton');
    expect(result.clothingUpperItem?.material.color).toBe('#ec4899');

    expect(result.clothingLowerItem?.material.texturePreset).toBe('denim_fabric');
    expect(result.clothingLowerItem?.material.color).toBe('#1e3a8a');

    expect(result.footwearItem?.material.texturePreset).toBe('leather_boot');
    expect(result.footwearItem?.material.color).toBe('#ffffff');

    expect(result.accessoriesItem?.material.texturePreset).toBe('brushed_metal');
    expect(result.accessoriesItem?.material.vertexColors).toBe(true);
  });

  it('supports modular toggles for female clothing and accessories', () => {
    // Generate without clothing
    const noClothes = generateRealisticFemaleScene({ includeClothing: false, includeAccessories: true });
    expect(noClothes.clothingUpperItem).toBeUndefined();
    expect(noClothes.clothingLowerItem).toBeUndefined();
    expect(noClothes.footwearItem).toBeUndefined();
    expect(noClothes.bodyItem).toBeDefined();
    expect(noClothes.accessoriesItem).toBeDefined();
    expect(noClothes.allItems.length).toBe(2);

    // Generate without accessories
    const noAccessories = generateRealisticFemaleScene({ includeClothing: true, includeAccessories: false });
    expect(noAccessories.accessoriesItem).toBeUndefined();
    expect(noAccessories.clothingUpperItem).toBeDefined();
    expect(noAccessories.clothingLowerItem).toBeDefined();
    expect(noAccessories.footwearItem).toBeDefined();
    expect(noAccessories.allItems.length).toBe(4);

    // Generate bare anatomy only
    const bareAnatomy = generateRealisticFemaleScene({ includeClothing: false, includeAccessories: false });
    expect(bareAnatomy.allItems.length).toBe(1);
    expect(bareAnatomy.allItems[0].id).toBe('female-body');
  });

  it('integrates seamlessly with generateRealisticHumanScene({ gender: "female" })', () => {
    const femaleFromUnified = generateRealisticHumanScene({ gender: 'female', topColor: '#f43f5e' });
    expect(femaleFromUnified.bodyItem.id).toBe('female-body');
    expect(femaleFromUnified.clothingUpperItem?.id).toBe('female-top');
    expect(femaleFromUnified.clothingUpperItem?.material.color).toBe('#f43f5e');
    expect(femaleFromUnified.stats.height).toBe(1.68);
  });

  it('exports female model cleanly to OBJ, STL, and binary GLB without errors', async () => {
    const female = generateRealisticFemaleScene();

    // 1. OBJ export
    const objString = exportSceneToOBJString(female.allItems);
    expect(typeof objString).toBe('string');
    expect(objString).toContain('o Female Anatomy (Body)');
    expect(objString.length).toBeGreaterThan(50000);

    // 2. STL export
    const stlString = exportSceneToSTLString(female.allItems);
    expect(typeof stlString).toBe('string');
    expect(stlString).toContain('solid exported');
    expect(stlString.length).toBeGreaterThan(50000);

    // 3. Binary GLB export
    const glbBuffer = await exportSceneToGLTFBuffer(female.allItems, true);
    expect(glbBuffer).toBeInstanceOf(ArrayBuffer);
    expect((glbBuffer as ArrayBuffer).byteLength).toBeGreaterThan(100000);
  });

  it('verifies non-zero, unit-length, outward-facing normals across female sub-assemblies', () => {
    const female = generateRealisticFemaleScene();

    for (const item of female.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      const norm = geo.getAttribute('normal') as THREE.BufferAttribute;
      expect(norm).toBeDefined();

      let zeroNormals = 0;
      for (let i = 0; i < norm.count; i++) {
        const nx = norm.getX(i);
        const ny = norm.getY(i);
        const nz = norm.getZ(i);
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-4) {
          zeroNormals++;
        } else {
          expect(Math.abs(len - 1.0)).toBeLessThan(0.01);
        }
      }
      expect(zeroNormals).toBe(0);
    }

    // Verify outward-facing chest/bust normals on female body item
    const bodyGeo = createPrimitiveGeometry(female.bodyItem.primitiveType || 'custom', female.bodyItem.geometryParams);
    const pos = bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const norm = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;

    let outwardChestNormals = 0;
    let inwardChestNormals = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y >= 0.95 && y <= 1.40 && z > 0.03) {
        if (norm.getZ(i) > 0) outwardChestNormals++;
        else inwardChestNormals++;
      }
    }
    expect(outwardChestNormals).toBeGreaterThan(50);
    expect(inwardChestNormals).toBe(0);
  });

  it('verifies female vertex colors for hair and accessories', () => {
    const female = generateRealisticFemaleScene({
      hairColor: '#eab308', // Blonde hair
      glassesColor: '#dc2626', // Red spectacles frame
    });

    const bodyGeo = createPrimitiveGeometry(female.bodyItem.primitiveType || 'custom', female.bodyItem.geometryParams);
    const bodyCols = bodyGeo.getAttribute('color') as THREE.BufferAttribute;
    expect(bodyCols).toBeDefined();

    const expectedHair = new THREE.Color('#eab308');
    let blondeHairVerts = 0;
    for (let i = 0; i < bodyCols.count; i++) {
      const r = bodyCols.getX(i);
      const g = bodyCols.getY(i);
      const b = bodyCols.getZ(i);
      if (Math.abs(r - expectedHair.r) < 0.05 && Math.abs(g - expectedHair.g) < 0.05 && Math.abs(b - expectedHair.b) < 0.05) {
        blondeHairVerts++;
      }
    }
    expect(blondeHairVerts).toBeGreaterThan(100);

    const accGeo = createPrimitiveGeometry(female.accessoriesItem!.primitiveType || 'custom', female.accessoriesItem!.geometryParams);
    const accCols = accGeo.getAttribute('color') as THREE.BufferAttribute;
    expect(accCols).toBeDefined();

    const expectedGlasses = new THREE.Color('#dc2626');
    let redGlassesVerts = 0;
    for (let i = 0; i < accCols.count; i++) {
      const r = accCols.getX(i);
      const g = accCols.getY(i);
      const b = accCols.getZ(i);
      if (Math.abs(r - expectedGlasses.r) < 0.05 && Math.abs(g - expectedGlasses.g) < 0.05 && Math.abs(b - expectedGlasses.b) < 0.05) {
        redGlassesVerts++;
      }
    }
    expect(redGlassesVerts).toBeGreaterThan(100);
  });

  it('verifies watertight female cranium vault with crown cap and chin apex', () => {
    const female = generateRealisticFemaleScene();
    const bodyGeo = createPrimitiveGeometry(female.bodyItem.primitiveType || 'custom', female.bodyItem.geometryParams);
    const pos = bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const norm = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;

    // Verify crown cap vertex at top of cranium (y = 1.660m, normal pointing +y)
    let crownCapFound = false;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - 1.660) < 1e-3 && Math.abs(pos.getX(i)) < 1e-3) {
        if (norm.getY(i) > 0.95) {
          crownCapFound = true;
          break;
        }
      }
    }
    expect(crownCapFound).toBe(true);

    // Verify chin apex cap vertex at y = 1.455m with downward normal pointing -y
    let chinCapFound = false;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - 1.455) < 1e-3 && Math.abs(pos.getX(i)) < 1e-3) {
        if (norm.getY(i) < -0.90) {
          chinCapFound = true;
          break;
        }
      }
    }
    expect(chinCapFound).toBe(true);
  });

  it('verifies female high-poly realism standards (35,000+ vertices, articulated hands, seamless denim)', () => {
    const female = generateRealisticFemaleScene();

    expect(female.stats.totalVertices).toBeGreaterThanOrEqual(35000);
    expect(female.stats.totalTriangles).toBeGreaterThanOrEqual(50000);
    expect(female.stats.bodyVertices).toBeGreaterThanOrEqual(25000);

    // Articulated hands in relaxed A-pose (left and right)
    const bodyGeo = createPrimitiveGeometry(female.bodyItem.primitiveType || 'custom', female.bodyItem.geometryParams);
    const bodyPos = bodyGeo.getAttribute('position') as THREE.BufferAttribute;

    let leftHandVerts = 0;
    let rightHandVerts = 0;
    for (let i = 0; i < bodyPos.count; i++) {
      const x = bodyPos.getX(i);
      const y = bodyPos.getY(i);
      if (y >= 0.60 && y <= 0.85) {
        if (x < -0.22) leftHandVerts++;
        if (x > 0.22) rightHandVerts++;
      }
    }
    expect(leftHandVerts).toBeGreaterThan(300);
    expect(rightHandVerts).toBeGreaterThan(300);

    // Continuous pelvic junction / crotch bridge in high-waisted jeans
    const jeansGeo = createPrimitiveGeometry(female.clothingLowerItem!.primitiveType || 'custom', female.clothingLowerItem!.geometryParams);
    const jeansPos = jeansGeo.getAttribute('position') as THREE.BufferAttribute;

    let crotchVerts = 0;
    for (let i = 0; i < jeansPos.count; i++) {
      const x = jeansPos.getX(i);
      const y = jeansPos.getY(i);
      if (Math.abs(x) < 0.02 && y >= 0.70 && y <= 0.82) {
        crotchVerts++;
      }
    }
    expect(crotchVerts).toBeGreaterThan(10);
  });
});
