import { describe, it, expect } from 'vitest';
import { executePolyForgeScript, ScriptExecutionContext } from '../src/core/ai/api';
import { EnvironmentSettings, TimelineState } from '../src/types';

const defaultEnv: EnvironmentSettings = {
  backgroundColor: '#0d1117',
  ambientIntensity: 0.6,
  directionalIntensity: 1.2,
  showGrid: true,
  showAxes: true,
  shadows: true,
  preset: 'studio',
};

const defaultTimeline: TimelineState = {
  currentFrame: 0,
  totalFrames: 120,
  fps: 30,
  isPlaying: false,
  isLooping: true,
  autoKeying: false,
};

function createTestContext(): ScriptExecutionContext {
  return {
    items: [],
    tracks: [],
    environment: { ...defaultEnv },
    timeline: { ...defaultTimeline },
  };
}

describe('AI Scripting Engine & API', () => {
  it('creates 3D objects with custom properties', async () => {
    const ctx = createTestContext();
    const script = `
      polyforge.createObject({
        name: 'Glowing Obelisk',
        primitive: 'box',
        position: [1, 2, 3],
        scale: [0.5, 4, 0.5],
        material: {
          color: '#38bdf8',
          emissive: '#0284c7',
          emissiveIntensity: 1.5,
          metalness: 0.8
        }
      });
    `;

    const res = await executePolyForgeScript(script, ctx);
    expect(res.success).toBe(true);
    expect(res.createdItems.length).toBe(1);
    expect(res.createdItems[0].name).toBe('Glowing Obelisk');
    expect(res.createdItems[0].primitiveType).toBe('box');
    expect(res.createdItems[0].transform.position).toEqual([1, 2, 3]);
    expect(res.createdItems[0].transform.scale).toEqual([0.5, 4, 0.5]);
    expect(res.createdItems[0].material.color).toBe('#38bdf8');
    expect(res.createdItems[0].material.emissiveIntensity).toBe(1.5);
  });

  it('updates objects by id and by name', async () => {
    const ctx = createTestContext();
    const script = `
      const obj = polyforge.createObject({ name: 'Alpha Tower', primitive: 'cylinder' });
      polyforge.updateObject('Alpha Tower', {
        position: [0, 5, 0],
        scale: [2, 2, 2]
      });
      polyforge.updateObject(obj.id, {
        material: { color: '#ff0000' }
      });
    `;

    const res = await executePolyForgeScript(script, ctx);
    expect(res.success).toBe(true);
    expect(res.updatedItems.length).toBe(2);
    const lastUpdate = res.updatedItems[1];
    expect(lastUpdate.transform.position).toEqual([0, 5, 0]);
    expect(lastUpdate.transform.scale).toEqual([2, 2, 2]);
    expect(lastUpdate.material.color).toBe('#ff0000');
  });

  it('deletes objects and cleans up associated animation tracks', async () => {
    const ctx = createTestContext();
    const script = `
      const obj1 = polyforge.createObject({ name: 'Temp Mesh' });
      polyforge.addKeyframe(obj1.id, 0, { position: [0, 0, 0] });
      polyforge.addKeyframe(obj1.id, 60, { position: [0, 10, 0] });
      polyforge.deleteObject('Temp Mesh');
    `;

    const res = await executePolyForgeScript(script, ctx);
    expect(res.success).toBe(true);
    expect(res.deletedItemIds.length).toBe(1);
    expect(res.tracks.length).toBe(0);
  });

  it('records keyframes and updates timeline/environment settings', async () => {
    const ctx = createTestContext();
    const script = `
      polyforge.setEnvironment({ preset: 'cyberpunk', backgroundColor: '#05070d' });
      polyforge.setTimeline({ totalFrames: 240, fps: 60 });
      const cube = polyforge.createObject({ name: 'Kinetic Cube' });
      polyforge.addKeyframe(cube.id, 0, { position: [0, 0, 0], rotation: [0, 0, 0] }, 'linear');
      polyforge.addKeyframe(cube.id, 120, { position: [0, 5, 0], rotation: [0, Math.PI, 0] }, 'ease-in-out');
      polyforge.log('Animation recorded successfully');
    `;

    const res = await executePolyForgeScript(script, ctx);
    expect(res.success).toBe(true);
    expect(res.environment?.preset).toBe('cyberpunk');
    expect(res.environment?.backgroundColor).toBe('#05070d');
    expect(res.timeline?.totalFrames).toBe(240);
    expect(res.timeline?.fps).toBe(60);
    expect(res.tracks.length).toBe(1);
    expect(res.tracks[0].keyframes.length).toBe(2);
    expect(res.logs).toContain('Animation recorded successfully');
  });

  it('catches syntax and runtime errors safely without unhandled exceptions', async () => {
    const ctx = createTestContext();
    const badScript = `
      polyforge.createObject({ name: 'Valid' });
      throw new Error('Procedural calculation overflow');
    `;

    const res = await executePolyForgeScript(badScript, ctx);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Procedural calculation overflow');
    expect(res.logs.some((l) => l.includes('[Execution Error]'))).toBe(true);
  });

  it('supports async operations and mathematical loops', async () => {
    const ctx = createTestContext();
    const script = `
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        polyforge.createObject({
          name: 'Ring Item ' + i,
          position: [Math.cos(angle) * 3, 0, Math.sin(angle) * 3]
        });
      }
    `;

    const res = await executePolyForgeScript(script, ctx);
    expect(res.success).toBe(true);
    expect(res.createdItems.length).toBe(5);
  });
});
