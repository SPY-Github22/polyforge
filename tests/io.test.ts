import { describe, it, expect } from 'vitest';
import { parseProjectFile, ProjectSaveData } from '../src/core/io';
import { SceneItem, AnimationTrack, EnvironmentSettings } from '../src/types';

describe('Project IO and Serialization', () => {
  it('correctly parses and validates valid project JSON', () => {
    const validData: ProjectSaveData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      items: [
        {
          id: 'mesh-1',
          name: 'Hero Mesh',
          type: 'mesh',
          primitiveType: 'cylinder',
          transform: {
            position: [1, 2, 3],
            rotation: [0, 1.57, 0],
            scale: [1, 1, 1],
          },
          material: {
            color: '#ff0000',
            roughness: 0.5,
            metalness: 0.8,
            emissive: '#000000',
            emissiveIntensity: 0,
            transmission: 0,
            opacity: 1,
            transparent: false,
            wireframe: false,
            texturePreset: 'checker',
          },
          visible: true,
          locked: false,
        },
      ],
      tracks: [
        {
          objectId: 'mesh-1',
          keyframes: [
            {
              frame: 0,
              transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
              interpolation: 'linear',
            },
          ],
        },
      ],
      environment: {
        backgroundColor: '#000000',
        ambientIntensity: 0.5,
        directionalIntensity: 1.0,
        showGrid: true,
        showAxes: true,
        shadows: true,
        preset: 'studio',
      },
    };

    const serialized = JSON.stringify(validData);
    const parsed = parseProjectFile(serialized);

    expect(parsed.version).toBe('1.0.0');
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].name).toBe('Hero Mesh');
    expect(parsed.items[0].primitiveType).toBe('cylinder');
    expect(parsed.tracks.length).toBe(1);
    expect(parsed.environment.preset).toBe('studio');
  });

  it('throws descriptive error on invalid project JSON missing items array', () => {
    const invalidJson = JSON.stringify({ version: '1.0.0' });
    expect(() => parseProjectFile(invalidJson)).toThrow(
      'Invalid project file format: missing items array.'
    );
  });

  it('heals and sanitizes incomplete or malformed item fields with safe defaults', () => {
    const partialJson = JSON.stringify({
      version: '1.0.0',
      items: [
        {
          id: 'test-broken',
          // missing name, type, transform, material, modifiers
        },
      ],
    });

    const parsed = parseProjectFile(partialJson);
    expect(parsed.items.length).toBe(1);
    const item = parsed.items[0];
    expect(item.id).toBe('test-broken');
    expect(item.name).toBe('Object 1');
    expect(item.transform.position).toEqual([0, 0, 0]);
    expect(item.transform.rotation).toEqual([0, 0, 0]);
    expect(item.transform.scale).toEqual([1, 1, 1]);
    expect(item.material.color).toBe('#388bfd');
    expect(item.modifiers).toEqual([]);
  });

  it('throws clear syntax error on malformed JSON string', () => {
    expect(() => parseProjectFile('{ broken json: ')).toThrow('Corrupted JSON file');
  });
});
