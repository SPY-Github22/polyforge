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
});
