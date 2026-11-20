import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateRealisticHumanScene, RealisticHumanResult } from '../src/core/character';
import { createPrimitiveGeometry, calculateGeometryStats } from '../src/core/geometry';
import { exportSceneToOBJString, exportSceneToSTLString, exportSceneToGLTFBuffer } from '../src/core/io';
import { createPolyForgeScriptAPI } from '../src/core/ai/api';
import { SceneItem, AnimationTrack, EnvironmentSettings, TimelineState } from '../src/types';

describe('Anatomical Character Engine (Realistic Human)', () => {
  it('generates a full human scene with 5 distinct sub-assemblies and complete anatomical fidelity', () => {
    const result: RealisticHumanResult = generateRealisticHumanScene();

    expect(result.bodyItem).toBeDefined();
    expect(result.clothingUpperItem).toBeDefined();
    expect(result.clothingLowerItem).toBeDefined();
    expect(result.footwearItem).toBeDefined();
    expect(result.accessoriesItem).toBeDefined();
    expect(result.allItems.length).toBe(5);

    // Verify vertex & triangle counts meet high-fidelity standards
    expect(result.stats.bodyVertices).toBeGreaterThan(2000);
    expect(result.stats.bodyTriangles).toBeGreaterThan(3000);
    expect(result.stats.clothingVertices).toBeGreaterThan(1500);
    expect(result.stats.clothingTriangles).toBeGreaterThan(2000);
    expect(result.stats.footwearVertices).toBeGreaterThan(500);
    expect(result.stats.footwearTriangles).toBeGreaterThan(800);
    expect(result.stats.accessoriesVertices).toBeGreaterThan(600);
    expect(result.stats.accessoriesTriangles).toBeGreaterThan(800);

    expect(result.stats.totalVertices).toBeGreaterThan(6000);
    expect(result.stats.totalTriangles).toBeGreaterThan(8000);
    expect(result.stats.componentsCount).toBe(5);
  });

  it('constructs valid BufferGeometry with valid positions, normals, and uvs without NaNs or Infs', () => {
    const result = generateRealisticHumanScene();

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

      // Check vertex and triangle counts via calculateGeometryStats
      const stats = calculateGeometryStats(geo);
      expect(stats.vertices).toBeGreaterThan(0);
      expect(stats.triangles).toBeGreaterThan(0);
    }
  });

  it('adheres to realistic anatomical proportions (approx 1.78m tall, grounded at y = 0)', () => {
    const result = generateRealisticHumanScene();
    const group = new THREE.Group();

    for (const item of result.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      const mesh = new THREE.Mesh(geo);
      group.add(mesh);
    }

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Height should be approximately 1.78m (±0.05m tolerance)
    expect(size.y).toBeGreaterThanOrEqual(1.72);
    expect(size.y).toBeLessThanOrEqual(1.85);

    // Standing grounded with bottom of footwear at y = 0
    expect(box.min.y).toBeCloseTo(0.0, 2);

    // Natural shoulder and stance width (~0.45m to 0.65m wide)
    expect(size.x).toBeGreaterThan(0.40);
    expect(size.x).toBeLessThan(0.70);

    // Front-to-back depth (~0.20m to 0.35m depth)
    expect(size.z).toBeGreaterThan(0.18);
    expect(size.z).toBeLessThan(0.35);
  });

  it('assigns correct procedural PBR material presets to each sub-assembly', () => {
    const result = generateRealisticHumanScene({
      skinColor: '#d4a373',
      shirtColor: '#2563eb',
      pantsColor: '#1e3a8a',
      shoesColor: '#1e293b',
      watchColor: '#e2e8f0',
    });

    expect(result.bodyItem.material.texturePreset).toBe('skin_tone');
    expect(result.bodyItem.material.color).toBe('#d4a373');

    expect(result.clothingUpperItem?.material.texturePreset).toBe('knit_cotton');
    expect(result.clothingUpperItem?.material.color).toBe('#2563eb');

    expect(result.clothingLowerItem?.material.texturePreset).toBe('denim_fabric');
    expect(result.clothingLowerItem?.material.color).toBe('#1e3a8a');

    expect(result.footwearItem?.material.texturePreset).toBe('leather_boot');
    expect(result.footwearItem?.material.color).toBe('#1e293b');

    expect(result.accessoriesItem?.material.texturePreset).toBe('brushed_metal');
    expect(result.accessoriesItem?.material.vertexColors).toBe(true);
  });

  it('supports modular toggles for clothing and accessories', () => {
    // Generate without clothing
    const noClothes = generateRealisticHumanScene({ includeClothing: false, includeAccessories: true });
    expect(noClothes.clothingUpperItem).toBeUndefined();
    expect(noClothes.clothingLowerItem).toBeUndefined();
    expect(noClothes.footwearItem).toBeUndefined();
    expect(noClothes.bodyItem).toBeDefined();
    expect(noClothes.accessoriesItem).toBeDefined();
    expect(noClothes.allItems.length).toBe(2);

    // Generate without accessories
    const noAccessories = generateRealisticHumanScene({ includeClothing: true, includeAccessories: false });
    expect(noAccessories.accessoriesItem).toBeUndefined();
    expect(noAccessories.clothingUpperItem).toBeDefined();
    expect(noAccessories.clothingLowerItem).toBeDefined();
    expect(noAccessories.footwearItem).toBeDefined();
    expect(noAccessories.allItems.length).toBe(4);

    // Generate bare anatomy only
    const bareAnatomy = generateRealisticHumanScene({ includeClothing: false, includeAccessories: false });
    expect(bareAnatomy.allItems.length).toBe(1);
    expect(bareAnatomy.allItems[0].id).toBe('human-body');
  });

  it('integrates cleanly with PolyForge script API polyforge.createHuman()', () => {
    const items: SceneItem[] = [];
    const tracks: AnimationTrack[] = [];
    const environment: EnvironmentSettings = {
      backgroundColor: '#ffffff',
      ambientIntensity: 0.6,
      directionalIntensity: 1.2,
      showGrid: true,
      showAxes: true,
      shadows: true,
      preset: 'studio',
    };
    const timeline: TimelineState = {
      currentFrame: 0,
      totalFrames: 120,
      fps: 30,
      isPlaying: false,
      isLooping: true,
      autoKeying: false,
    };

    const logs: string[] = [];
    const createdItems: SceneItem[] = [];
    const updatedItems: SceneItem[] = [];
    const deletedItemIds: string[] = [];

    const api = createPolyForgeScriptAPI(
      { items, tracks, environment, timeline },
      logs,
      createdItems,
      updatedItems,
      deletedItemIds
    );

    const generated = api.createHuman({
      includeClothing: true,
      includeAccessories: true,
      shirtColor: '#10b981',
    });

    expect(generated.length).toBe(5);
    expect(items.length).toBe(5);
    expect(createdItems.length).toBe(5);
    expect(logs.some((l) => l.includes('[Anatomy] Generated realistic human'))).toBe(true);
  });

  it('exports cleanly to OBJ, STL, and binary GLB without errors', async () => {
    const human = generateRealisticHumanScene();

    // 1. OBJ export
    const objString = exportSceneToOBJString(human.allItems);
    expect(typeof objString).toBe('string');
    expect(objString).toContain('o Human Anatomy (Body)');
    expect(objString.length).toBeGreaterThan(50000);

    // 2. STL export
    const stlString = exportSceneToSTLString(human.allItems);
    expect(typeof stlString).toBe('string');
    expect(stlString).toContain('solid exported');
    expect(stlString.length).toBeGreaterThan(50000);

    // 3. Binary GLB export
    const glbBuffer = await exportSceneToGLTFBuffer(human.allItems, true);
    expect(glbBuffer).toBeInstanceOf(ArrayBuffer);
    expect((glbBuffer as ArrayBuffer).byteLength).toBeGreaterThan(100000);
  });
});
