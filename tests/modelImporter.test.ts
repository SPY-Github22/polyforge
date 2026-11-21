import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  parseOBJ,
  parseSTL,
  convertThreeMaterial,
  convertThreeObjectToSceneItems,
  extractCustomGeometry,
} from '../src/core/modelImporter';

describe('Model Importer Suite (OBJ, STL, Materials)', () => {
  it('parses valid OBJ string geometry into SceneItems with custom geometry', () => {
    const sampleOBJ = `
# Simple OBJ Cube/Pyramid
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
vn 0.0 0.0 1.0
vt 0.0 0.0
vt 1.0 0.0
vt 0.5 1.0
f 1/1/1 2/2/1 3/3/1
`;

    const result = parseOBJ(sampleOBJ);
    expect(result.format).toBe('obj');
    expect(result.items.length).toBeGreaterThan(0);

    const firstItem = result.items[0];
    expect(firstItem.type).toBe('mesh');
    expect(firstItem.primitiveType).toBe('custom');
    expect(firstItem.geometryParams?.customGeometry).toBeDefined();

    const geo = firstItem.geometryParams!.customGeometry!;
    expect(geo.positions.length).toBe(9); // 3 vertices * 3 coordinates
    expect(geo.normals?.length).toBe(9);
    expect(result.stats.totalVertices).toBe(3);
    expect(result.stats.totalTriangles).toBe(1);
  });

  it('throws an error on empty or invalid OBJ content', () => {
    expect(() => parseOBJ('')).toThrow(/empty or missing/i);
    expect(() => parseOBJ('   \n  ')).toThrow(/empty or missing/i);
  });

  it('correctly handles autoCenter and autoScale options', () => {
    const offsetOBJ = `
v 10.0 10.0 10.0
v 20.0 10.0 10.0
v 15.0 20.0 10.0
f 1 2 3
`;

    const result = parseOBJ(offsetOBJ, {
      autoCenter: true,
      autoScale: true,
      targetMaxDimension: 2.0,
    });

    expect(result.items.length).toBe(1);
    const item = result.items[0];
    // Position should be centered around origin (x near 0, y near 0)
    expect(Math.abs(item.transform.position[0])).toBeLessThan(0.1);
    expect(Math.abs(item.transform.position[1])).toBeLessThan(0.1);
  });

  it('parses ASCII STL data into SceneItems', () => {
    const asciiSTL = `solid test
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
endsolid test`;

    const result = parseSTL(asciiSTL);
    expect(result.format).toBe('stl');
    expect(result.items.length).toBe(1);

    const item = result.items[0];
    expect(item.primitiveType).toBe('custom');
    expect(item.geometryParams?.customGeometry?.positions.length).toBe(9);
  });

  it('converts Three.js materials faithfully to MaterialProperties', () => {
    const stdMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b82f6'),
      roughness: 0.25,
      metalness: 0.85,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });

    const converted = convertThreeMaterial(stdMat);
    expect(converted.color).toBe('#3b82f6');
    expect(converted.roughness).toBe(0.25);
    expect(converted.metalness).toBe(0.85);
    expect(converted.wireframe).toBe(true);
    expect(converted.transparent).toBe(true);
    expect(converted.opacity).toBe(0.7);
  });

  it('extracts custom geometry with positions, normals and uvs', () => {
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    const customGeo = extractCustomGeometry(boxGeo);

    expect(customGeo.positions.length).toBe(72); // 24 verts * 3
    expect(customGeo.normals?.length).toBe(72);
    expect(customGeo.uvs?.length).toBe(48); // 24 verts * 2
    expect(customGeo.indices).toBeDefined();
  });

  it('imports model from a File object via importModelFromFile', async () => {
    const { importModelFromFile } = await import('../src/core/modelImporter');
    const objContent = `v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n`;
    const mockFile = new File([objContent], 'triangle.obj', { type: 'text/plain' });

    const result = await importModelFromFile(mockFile);
    expect(result.format).toBe('obj');
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBeDefined();
  });

  it('rejects unsupported file formats gracefully in importModelFromFile', async () => {
    const { importModelFromFile } = await import('../src/core/modelImporter');
    const mockFile = new File(['dummy'], 'test.docx', { type: 'application/msword' });

    await expect(importModelFromFile(mockFile)).rejects.toThrow(/unsupported 3D file format/i);
  });
});
