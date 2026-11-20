import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMaterial, updateMaterial, getProceduralTexture } from '../src/core/material';
import { MaterialProperties } from '../src/types';

describe('Material System', () => {
  const defaultProps: MaterialProperties = {
    color: '#388bfd',
    roughness: 0.35,
    metalness: 0.2,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'none',
  };

  it('creates MeshPhysicalMaterial for rendered mode with PBR attributes', () => {
    const mat = createMaterial(defaultProps, 'rendered');
    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const pbr = mat as THREE.MeshPhysicalMaterial;
    expect(pbr.roughness).toBe(0.35);
    expect(pbr.metalness).toBe(0.2);
    expect(pbr.wireframe).toBe(false);
  });

  it('creates MeshBasicMaterial with wireframe for wireframe mode', () => {
    const mat = createMaterial(defaultProps, 'wireframe');
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((mat as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });

  it('creates MeshNormalMaterial for normals shading mode', () => {
    const mat = createMaterial(defaultProps, 'normals');
    expect(mat).toBeInstanceOf(THREE.MeshNormalMaterial);
  });

  it('creates MeshLambertMaterial for solid shading mode', () => {
    const mat = createMaterial(defaultProps, 'solid');
    expect(mat).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('updates existing MeshPhysicalMaterial in place without rebuilding', () => {
    const mat = createMaterial(defaultProps, 'rendered') as THREE.MeshPhysicalMaterial;
    updateMaterial(mat, {
      ...defaultProps,
      color: '#ff0055',
      roughness: 0.8,
      metalness: 0.9,
      wireframe: true,
    }, 'rendered');

    expect(mat.roughness).toBe(0.8);
    expect(mat.metalness).toBe(0.9);
    expect(mat.wireframe).toBe(true);
    expect(mat.color.getHexString()).toBe('ff0055');
  });

  it('returns null procedural texture for preset "none"', () => {
    const tex = getProceduralTexture('none');
    expect(tex).toBeNull();
  });

  it('sets material color to white for textured materials with vertexColors to avoid triple multiplication', () => {
    const mat = createMaterial({
      ...defaultProps,
      color: '#3e2716',
      texturePreset: 'bark_oak',
      vertexColors: true,
    }, 'rendered') as THREE.MeshPhysicalMaterial;

    // Should be #ffffff to prevent darkening texture diffuse
    expect(mat.color.getHexString()).toBe('ffffff');
    expect(mat.map).not.toBeNull();
    expect(mat.vertexColors).toBe(true);
  });

  it('generates photorealistic procedural mechanical textures', () => {
    const mechanicalPresets = ['carbon_fiber', 'tire_tread', 'brushed_metal', 'leather_perforated', 'reflector_amber'] as const;
    for (const preset of mechanicalPresets) {
      const tex = getProceduralTexture(preset);
      expect(tex).not.toBeNull();
      expect(tex).toBeInstanceOf(THREE.DataTexture);
      const dataTex = tex as THREE.DataTexture;
      expect(dataTex.image.width).toBeGreaterThanOrEqual(256);
      expect(dataTex.image.height).toBeGreaterThanOrEqual(256);
      expect(dataTex.image.data.length).toBe(dataTex.image.width * dataTex.image.height * 4);
    }
  });
});
