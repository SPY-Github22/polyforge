import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateRealisticBicycle } from '../src/core/bicycle';
import { createPrimitiveGeometry, calculateGeometryStats } from '../src/core/geometry';
import { exportSceneToOBJString, exportSceneToSTLString, exportSceneToGLTFBuffer } from '../src/core/io';

describe('Mechanical Engine & Realistic Bicycle Generator', () => {
  it('generates a full bicycle with 6 sub-assemblies and complete mechanical details', () => {
    const bike = generateRealisticBicycle();

    expect(bike.frameItem).toBeDefined();
    expect(bike.forkAndCockpitItem).toBeDefined();
    expect(bike.wheelsItem).toBeDefined();
    expect(bike.drivetrainItem).toBeDefined();
    expect(bike.saddleAndSeatpostItem).toBeDefined();
    expect(bike.accessoriesItem).toBeDefined();
    expect(bike.allItems.length).toBe(6);

    // Verify minimum triangle/vertex densities
    expect(bike.stats.frameTriangles).toBeGreaterThan(500);
    expect(bike.stats.forkCockpitTriangles).toBeGreaterThan(500);
    expect(bike.stats.wheelsTriangles).toBeGreaterThan(1500);
    expect(bike.stats.drivetrainTriangles).toBeGreaterThan(1000);
    expect(bike.stats.saddleSeatpostTriangles).toBeGreaterThan(300);
    expect(bike.stats.accessoriesTriangles).toBeGreaterThan(200);

    expect(bike.stats.totalVertices).toBeGreaterThan(4000);
    expect(bike.stats.totalTriangles).toBeGreaterThan(4000);
  });

  it('constructs valid BufferGeometry with positions, normals, and uvs for each assembly', () => {
    const bike = generateRealisticBicycle();

    for (const item of bike.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);

      const pos = geo.getAttribute('position');
      const norm = geo.getAttribute('normal');
      const uv = geo.getAttribute('uv');

      expect(pos).toBeDefined();
      expect(norm).toBeDefined();
      expect(uv).toBeDefined();
      expect(geo.index).toBeDefined();

      const stats = calculateGeometryStats(geo);
      expect(stats.vertices).toBeGreaterThan(0);
      expect(stats.triangles).toBeGreaterThan(0);
    }
  });

  it('matches realistic mechanical road bike dimensions and ISO proportions', () => {
    const bike = generateRealisticBicycle();
    const group = new THREE.Group();

    for (const item of bike.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      const mesh = new THREE.Mesh(geo);
      group.add(mesh);
    }

    const bbox = new THREE.Box3().setFromObject(group);

    // Tires should touch ground near y ≈ 0
    expect(bbox.min.y).toBeCloseTo(0.0, 1);
    // Overall bicycle height to tops/saddle ~0.95m - 1.05m
    expect(bbox.max.y).toBeGreaterThan(0.90);
    expect(bbox.max.y).toBeLessThan(1.15);
    // Overall bicycle length ~1.6m - 1.8m (wheelbase ~1.0m + 2x tire radius ~0.68m)
    const length = bbox.max.x - bbox.min.x;
    expect(length).toBeGreaterThan(1.50);
    expect(length).toBeLessThan(1.85);
    // Handlebar width ~0.40m - 0.50m
    const width = bbox.max.z - bbox.min.z;
    expect(width).toBeGreaterThan(0.35);
    expect(width).toBeLessThan(0.55);
  });

  it('correctly configures materials and texture presets', () => {
    const glossBike = generateRealisticBicycle({ frameColor: '#1d4ed8', frameMaterial: 'gloss' });
    expect(glossBike.frameItem.material.color).toBe('#1d4ed8');
    expect(glossBike.frameItem.material.roughness).toBeLessThan(0.3);

    const carbonBike = generateRealisticBicycle({ frameMaterial: 'carbon' });
    expect(carbonBike.frameItem.material.texturePreset).toBe('carbon_fiber');

    expect(glossBike.wheelsItem.material.texturePreset).toBe('tire_tread');
    expect(glossBike.drivetrainItem.material.texturePreset).toBe('brushed_metal');
    expect(glossBike.forkAndCockpitItem.material.texturePreset).toBe('brushed_metal');
    expect(glossBike.saddleAndSeatpostItem.material.texturePreset).toBe('leather_perforated');
    expect(glossBike.accessoriesItem.material.texturePreset).toBe('reflector_amber');
  });

  it('supports feature toggles (cables, disc brakes, reflectors)', () => {
    const fullBike = generateRealisticBicycle({ includeCables: true, includeDiscBrakes: true, includeReflectors: true });
    const strippedBike = generateRealisticBicycle({ includeCables: false, includeDiscBrakes: false, includeReflectors: false });

    expect(strippedBike.stats.accessoriesTriangles).toBeLessThan(fullBike.stats.accessoriesTriangles);
    expect(strippedBike.stats.wheelsTriangles).toBeLessThan(fullBike.stats.wheelsTriangles);
  });

  it('exports bicycle scene cleanly to OBJ, STL, and headless GLB formats', async () => {
    const bike = generateRealisticBicycle();

    // Wavefront OBJ
    const objString = exportSceneToOBJString(bike.allItems);
    expect(objString).toContain('o Bicycle - Diamond Road Frame');
    expect(objString).toContain('o Bicycle - Wheels, Aero Rims, Spokes & Disc Rotors');
    expect(objString).toContain('v ');
    expect(objString).toContain('f ');

    // ASCII STL
    const stlString = exportSceneToSTLString(bike.allItems);
    expect(stlString).toContain('facet normal');
    expect(stlString).toContain('vertex');

    // Headless GLB
    const glb = await exportSceneToGLTFBuffer(bike.allItems, true);
    expect(glb).toBeInstanceOf(ArrayBuffer);
    expect((glb as ArrayBuffer).byteLength).toBeGreaterThan(50000);
  });

  it('supports handlebarStyle options ("drop" and "flat") with distinct cockpit geometries', () => {
    const dropBike = generateRealisticBicycle({ handlebarStyle: 'drop' });
    expect(dropBike.forkAndCockpitItem.name).toContain('Drop Handlebars');

    const flatBike = generateRealisticBicycle({ handlebarStyle: 'flat' });
    expect(flatBike.forkAndCockpitItem.name).toContain('Flat Handlebars');
    expect(flatBike.stats.forkCockpitVertices).toBeGreaterThan(0);
    expect(flatBike.stats.forkCockpitTriangles).toBeGreaterThan(0);

    // Verify flat handlebar is wider (~0.66m) than drop handlebar (~0.42m)
    const flatGeo = createPrimitiveGeometry('custom', flatBike.forkAndCockpitItem.geometryParams);
    flatGeo.computeBoundingBox();
    const flatWidth = (flatGeo.boundingBox!.max.z - flatGeo.boundingBox!.min.z);
    expect(flatWidth).toBeGreaterThan(0.60);
  });

  it('supports pedalStyle options ("platform" and "clipless")', () => {
    const platformBike = generateRealisticBicycle({ pedalStyle: 'platform', includeReflectors: true });
    expect(platformBike.stats.accessoriesTriangles).toBeGreaterThan(0);

    const cliplessBike = generateRealisticBicycle({ pedalStyle: 'clipless', includeReflectors: false });
    expect(cliplessBike.stats.drivetrainTriangles).toBeGreaterThan(0);
  });

  it('proportions wheel and frame geometry to custom wheelSize', () => {
    const smallWheelBike = generateRealisticBicycle({ wheelSize: 0.28 });
    const standardBike = generateRealisticBicycle({ wheelSize: 0.34 });

    const smallGroup = new THREE.Group();
    for (const item of smallWheelBike.allItems) {
      smallGroup.add(new THREE.Mesh(createPrimitiveGeometry('custom', item.geometryParams)));
    }
    const smallBbox = new THREE.Box3().setFromObject(smallGroup);

    const stdGroup = new THREE.Group();
    for (const item of standardBike.allItems) {
      stdGroup.add(new THREE.Mesh(createPrimitiveGeometry('custom', item.geometryParams)));
    }
    const stdBbox = new THREE.Box3().setFromObject(stdGroup);

    // Both touch ground near y=0
    expect(smallBbox.min.y).toBeCloseTo(0.0, 1);
    expect(stdBbox.min.y).toBeCloseTo(0.0, 1);
    // Smaller wheel bike has lower top height
    expect(smallBbox.max.y).toBeLessThan(stdBbox.max.y);
  });

  it('sanitizes spoke counts safely for zero, odd, and extreme values', () => {
    const zeroSpokes = generateRealisticBicycle({ spokeCount: 0 });
    expect(zeroSpokes.stats.wheelsTriangles).toBeGreaterThan(0);

    const oddSpokes = generateRealisticBicycle({ spokeCount: 27 });
    expect(oddSpokes.stats.wheelsTriangles).toBeGreaterThan(0);

    const highSpokes = generateRealisticBicycle({ spokeCount: 64 });
    expect(highSpokes.stats.wheelsTriangles).toBeGreaterThan(zeroSpokes.stats.wheelsTriangles);
  });

  it('guarantees zero NaNs and valid vertex indexing across all procedural sub-assemblies', () => {
    const bike = generateRealisticBicycle();

    for (const item of bike.allItems) {
      const custom = item.geometryParams?.customGeometry;
      expect(custom).toBeDefined();
      if (!custom) continue;

      const numVerts = custom.positions.length / 3;
      expect(numVerts).toBeGreaterThan(0);

      // Verify no NaN or infinite values
      for (let i = 0; i < custom.positions.length; i++) {
        expect(Number.isFinite(custom.positions[i])).toBe(true);
      }
      for (let i = 0; i < custom.normals.length; i++) {
        expect(Number.isFinite(custom.normals[i])).toBe(true);
      }
      for (let i = 0; i < custom.uvs.length; i++) {
        expect(Number.isFinite(custom.uvs[i])).toBe(true);
      }

      // Verify all indices are valid vertex pointers
      for (let i = 0; i < custom.indices.length; i++) {
        const idx = custom.indices[i];
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(numVerts);
      }
    }
  });
});
