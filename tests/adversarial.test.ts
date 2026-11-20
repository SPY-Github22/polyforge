import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseProjectFile, exportSceneToOBJString, exportSceneToSTLString } from '../src/core/io';
import { createPrimitiveGeometry, applyModifiers } from '../src/core/geometry';
import { evaluateTrackAtFrame, createTurntableTrack } from '../src/core/animation';
import { executePolyForgeScript } from '../src/core/ai/api';
import { PolyForgeMCPServer } from '../cli/polyforge-mcp';
import { PrimitiveType, SceneItem, AnimationTrack, TransformData } from '../src/types';

describe('Adversarial & Fault Injection Stress Suite', () => {

  describe('1. Corrupted Project Deserialization & Self-Healing', () => {
    it('rejects non-object inputs (null, numbers, strings, arrays) with descriptive errors', () => {
      const nonObjects = ['null', '12345', '"plain string"', '[]', 'true'];
      for (const raw of nonObjects) {
        expect(() => parseProjectFile(raw)).toThrow();
      }
    });

    it('heals items with missing or corrupt transforms (NaN, null, undefined)', () => {
      const corruptJson = JSON.stringify({
        version: '1.0.0',
        items: [
          {
            id: 'corrupt-1',
            name: 'Broken Item',
            type: 'mesh',
            primitiveType: 'box',
            transform: {
              position: [NaN, null, undefined],
              rotation: ['invalid', NaN, 0],
              scale: [0, -1, NaN],
            },
          },
        ],
      });

      const project = parseProjectFile(corruptJson);
      expect(project.items.length).toBe(1);
      const item = project.items[0];
      // Position should be sanitized to valid numbers
      expect(Number.isFinite(item.transform.position[0])).toBe(true);
      expect(Number.isFinite(item.transform.position[1])).toBe(true);
      expect(Number.isFinite(item.transform.position[2])).toBe(true);
      // Scale should be positive finite
      expect(item.transform.scale[0]).toBeGreaterThan(0);
      expect(item.transform.scale[1]).toBeGreaterThan(0);
      expect(item.transform.scale[2]).toBeGreaterThan(0);
    });

    it('heals corrupted animation tracks with missing keyframes or invalid interpolations', () => {
      const corruptJson = JSON.stringify({
        version: '1.0.0',
        items: [],
        tracks: [
          {
            id: 'broken-track',
            targetId: 'none',
            name: 'Ghost Track',
            keyframes: [
              { frame: NaN, properties: null, interpolation: 'chaos' },
              { frame: -50, properties: { position: [NaN, 1, 2] } },
            ],
          },
        ],
      });

      const project = parseProjectFile(corruptJson);
      expect(project.tracks.length).toBe(1);
      const track = project.tracks[0];
      for (const kf of track.keyframes) {
        expect(Number.isFinite(kf.frame)).toBe(true);
        expect(kf.frame).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('2. Geometry Boundary Extremes & Chaos Modifiers', () => {
    it('handles negative, zero, and infinite modifier factors gracefully', () => {
      const box = createPrimitiveGeometry('box');
      
      // Extreme noise factors
      const noisyGeo = applyModifiers(box, [
        { id: '1', type: 'noise_displace', factor: -9999, enabled: true },
        { id: '2', type: 'twist', factor: 0, enabled: true },
        { id: '3', type: 'subdivide', factor: -5, enabled: true },
      ]);

      expect(noisyGeo.getAttribute('position')).toBeDefined();
      expect(noisyGeo.getAttribute('position').count).toBeGreaterThan(0);
    });

    it('creates fallback geometry for unsupported or malicious primitive strings', () => {
      const geo = createPrimitiveGeometry('non_existent_primitive' as PrimitiveType);
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);
      expect(geo.getAttribute('position')).toBeDefined();
      expect(geo.getAttribute('position').count).toBe(24); // Box fallback
    });

    it('handles subdivision on degenerate or empty geometry without hanging', () => {
      const emptyGeo = new THREE.BufferGeometry();
      emptyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([]), 3));
      
      const res = applyModifiers(emptyGeo, [
        { id: 'sub', type: 'subdivide', factor: 2, enabled: true }
      ]);
      expect(res.getAttribute('position').count).toBe(0);
    });
  });

  describe('3. Animation Timeline & Interpolation Boundaries', () => {
    const fallback: TransformData = {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };

    it('evaluates tracks when requested frame is outside all keyframe ranges', () => {
      const track: AnimationTrack = {
        objectId: 'obj1',
        keyframes: [
          { frame: 10, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
          { frame: 20, transform: { position: [10, 10, 10], rotation: [0, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
        ],
      };

      // Frame before first keyframe -> clamps to first
      const before = evaluateTrackAtFrame(track, 0, fallback);
      expect(before.position).toEqual([0, 0, 0]);

      // Frame after last keyframe -> clamps to last
      const after = evaluateTrackAtFrame(track, 100, fallback);
      expect(after.position).toEqual([10, 10, 10]);

      // Frame with negative number
      const negative = evaluateTrackAtFrame(track, -50, fallback);
      expect(negative.position).toEqual([0, 0, 0]);
    });

    it('generates valid turntable track even on boundary frame counts (e.g. 1 frame)', () => {
      const track = createTurntableTrack('obj1', fallback, 0, 1);
      expect(track.keyframes.length).toBe(3);
      expect(track.keyframes[0].frame).toBe(0);
    });
  });

  describe('4. Headless Exporter Boundary Testing', () => {
    it('exports empty scene to OBJ without throwing exceptions', () => {
      const objOutput = exportSceneToOBJString([]);
      expect(typeof objOutput).toBe('string');
      expect(objOutput).toContain('# PolyForge Wavefront OBJ Exporter');
    });

    it('exports empty scene to STL without throwing exceptions', () => {
      const stlOutput = exportSceneToSTLString([]);
      expect(typeof stlOutput).toBe('string');
      expect(stlOutput.toLowerCase()).toContain('solid');
      expect(stlOutput.toLowerCase()).toContain('endsolid');
    });

    it('handles items with zero scale and NaN transforms in OBJ/STL export', () => {
      const brokenItem: SceneItem = {
        id: 'zero-scale',
        name: 'Zero Scale Item',
        type: 'mesh',
        primitiveType: 'sphere',
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [0, 0, 0], // Collapsed geometry
        },
        material: { color: '#ffffff', roughness: 0.5, metalness: 0 },
        visible: true,
        locked: false,
      };

      const objStr = exportSceneToOBJString([brokenItem]);
      expect(objStr).toContain('o Zero Scale Item');

      const stlStr = exportSceneToSTLString([brokenItem]);
      expect(stlStr.toLowerCase()).toContain('solid');
      expect(stlStr.toLowerCase()).toContain('endsolid');
    });
  });

  describe('5. AI Sandbox Security & Attack Injections', () => {
    it('isolates sandbox from global process, require, and fs access', async () => {
      const attackScript = `
        try {
          if (typeof process !== 'undefined' && process.exit) {
            polyforge.log("LEAK: process is exposed!");
          }
        } catch (e) {}
        try {
          if (typeof require !== 'undefined') {
            polyforge.log("LEAK: require is exposed!");
          }
        } catch (e) {}
      `;

      const res = await executePolyForgeScript(attackScript, {
        items: [],
        tracks: [],
        environment: { preset: 'studio', backgroundColor: '#000000', ambientIntensity: 0.5, mainLightIntensity: 1, shadowSoftness: 0.5, showGrid: true, showAxes: true },
        timeline: { currentFrame: 0, totalFrames: 100, fps: 30, isPlaying: false, isLooping: true, autoKeying: false },
      });

      expect(res.success).toBe(true);
      expect(res.logs.some(l => l.includes("LEAK"))).toBe(false);
    });

    it('safely catches syntax errors without crashing host', async () => {
      const res = await executePolyForgeScript("const a = ;", {
        items: [],
        tracks: [],
        environment: {} as any,
        timeline: {} as any,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('safely handles prototype pollution attempts', async () => {
      const script = `
        polyforge.createObject({
          name: 'polluted',
          // @ts-ignore
          __proto__: { polluted: true }
        });
      `;

      const res = await executePolyForgeScript(script, {
        items: [],
        tracks: [],
        environment: {} as any,
        timeline: {} as any,
      });

      expect(res.success).toBe(true);
      // @ts-ignore
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  describe('6. MCP Protocol Conformance & Chaos RPC', () => {
    it('returns standard JSON-RPC error for unknown methods', async () => {
      const server = new PolyForgeMCPServer();
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 99,
        method: 'system/rm_rf',
        params: {},
      });

      expect(res.jsonrpc).toBe('2.0');
      expect(res.id).toBe(99);
      expect(res.error).toBeDefined();
      expect(res.error.code).toBe(-32601);
    });

    it('returns friendly error result for invalid tool names without unhandled rejection', async () => {
      const server = new PolyForgeMCPServer();
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/call',
        params: { name: 'non_existent_tool', arguments: {} },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Unknown tool: "non_existent_tool"');
    });
  });

});
