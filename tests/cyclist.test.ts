import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  poseCharacterAsCyclist,
  generateAnimatedCyclistCircuit,
} from '../src/core/cyclist';
import { generateRealisticFemaleScene, generateRealisticHumanScene } from '../src/core/character';
import { createPrimitiveGeometry, calculateGeometryStats } from '../src/core/geometry';
import { exportSceneToGLTFBuffer } from '../src/core/io';

describe('Kinematic Cyclist & Animation Circuit Engine', () => {
  it('poses the realistic female character into an athletic cycling posture', () => {
    const baseFemale = generateRealisticFemaleScene();
    const posed = poseCharacterAsCyclist(baseFemale, 'female');

    expect(posed.allItems.length).toBe(5);
    expect(posed.bodyItem).toBeDefined();
    expect(posed.clothingUpperItem).toBeDefined();
    expect(posed.clothingLowerItem).toBeDefined();
    expect(posed.footwearItem).toBeDefined();
    expect(posed.accessoriesItem).toBeDefined();

    // Verify BufferGeometry validity
    for (const item of posed.allItems) {
      const geo = createPrimitiveGeometry(item.primitiveType || 'custom', item.geometryParams);
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);
      const pos = geo.getAttribute('position');
      const norm = geo.getAttribute('normal');
      expect(pos).toBeDefined();
      expect(norm).toBeDefined();
      expect(pos.count).toBeGreaterThan(0);
      expect(norm.count).toBe(pos.count);
    }
  });

  it('generates a complete articulated animated cyclist circuit with 18 sub-assemblies and 18 animation tracks', () => {
    const circuit = generateAnimatedCyclistCircuit({
      totalFrames: 360,
      fps: 30,
      turnRadius: 2.5,
      wheelRadius: 0.34,
      gearRatio: 2.4,
      articulated: true,
    });

    // 8 bicycle (frame, saddle, cockpit, front wheel, rear wheel, crankset, left pedal, right pedal)
    // + 10 cyclist (body, hair/top, jeans/saddle, accessories, right thigh/shin/shoe, left thigh/shin/shoe) = 18 sub-assemblies
    expect(circuit.allItems.length).toBe(18);
    expect(circuit.bicycleItems.length).toBe(8);
    expect(circuit.cyclistItems.length).toBe(10);

    // 18 synchronized animation tracks
    expect(circuit.tracks.length).toBe(18);

    // 361 keyframes per track (0 through 360)
    for (const track of circuit.tracks) {
      expect(track.keyframes.length).toBe(361);
      expect(track.keyframes[0].frame).toBe(0);
      expect(track.keyframes[360].frame).toBe(360);
    }

    expect(circuit.totalFrames).toBe(360);
    expect(circuit.fps).toBe(30);
    expect(circuit.trajectory.length).toBe(361);

    // Stat densities
    expect(circuit.stats.totalVertices).toBeGreaterThan(40000);
    expect(circuit.stats.totalTriangles).toBeGreaterThan(70000);
    expect(circuit.stats.totalItems).toBe(18);
  });

  it('supports monolithic non-articulated fallback with 13 sub-assemblies and 13 animation tracks', () => {
    const circuit = generateAnimatedCyclistCircuit({
      totalFrames: 120,
      articulated: false,
    });

    // 8 bicycle + 5 cyclist = 13 sub-assemblies
    expect(circuit.allItems.length).toBe(13);
    expect(circuit.bicycleItems.length).toBe(8);
    expect(circuit.cyclistItems.length).toBe(5);
    expect(circuit.tracks.length).toBe(13);
  });

  it('correctly aligns the cyclist pelvis with the bicycle saddle and feet with pedals', () => {
    // 1. Articulated mode alignment
    const circuit = generateAnimatedCyclistCircuit({ articulated: true });

    const jeansItem = circuit.cyclistItems.find((it) => it.id === 'female-jeans');
    const bodyItem = circuit.cyclistItems.find((it) => it.id === 'female-body');
    const rShoeItem = circuit.cyclistItems.find((it) => it.id === 'cyclist-right-shoe');
    const lShoeItem = circuit.cyclistItems.find((it) => it.id === 'cyclist-left-shoe');

    expect(jeansItem).toBeDefined();
    expect(bodyItem).toBeDefined();
    expect(rShoeItem).toBeDefined();
    expect(lShoeItem).toBeDefined();

    const jeansPos = jeansItem!.geometryParams!.customGeometry!.positions;
    const bodyPos = bodyItem!.geometryParams!.customGeometry!.positions;

    let hasSaddleVertex = false;
    for (let i = 0; i < jeansPos.length; i += 3) {
      const x = jeansPos[i];
      const y = jeansPos[i + 1];
      const z = jeansPos[i + 2];

      const dSaddle = Math.hypot(x - (-0.150), y - 0.890, z);
      if (dSaddle < 0.12) {
        hasSaddleVertex = true;
      }
    }

    let hasGripVertex = false;
    for (let i = 0; i < bodyPos.length; i += 3) {
      const x = bodyPos[i];
      const y = bodyPos[i + 1];
      const z = bodyPos[i + 2];

      // Handlebar STI brake hoods near (0.570, 0.945, ±0.200) or drops near (0.420, 0.900, ±0.180)
      if (
        Math.hypot(x - 0.570, y - 0.945, Math.abs(z) - 0.200) < 0.12 ||
        Math.hypot(x - 0.420, y - 0.900, Math.abs(z) - 0.180) < 0.15
      ) {
        hasGripVertex = true;
      }
    }

    expect(hasSaddleVertex).toBe(true);
    expect(hasGripVertex).toBe(true);

    // 2. Monolithic mode alignment
    const monoCircuit = generateAnimatedCyclistCircuit({ articulated: false });
    const sneakersItem = monoCircuit.cyclistItems.find((it) => it.id === 'female-sneakers');
    expect(sneakersItem).toBeDefined();
    const sneakersPos = sneakersItem!.geometryParams!.customGeometry!.positions;

    let hasLeftPedalVertex = false;
    let hasRightPedalVertex = false;
    for (let i = 0; i < sneakersPos.length; i += 3) {
      const x = sneakersPos[i];
      const y = sneakersPos[i + 1];
      const z = sneakersPos[i + 2];

      const dRight = Math.hypot(x - 0.155, y - 0.205, z - 0.075);
      if (dRight < 0.10) {
        hasRightPedalVertex = true;
      }
      if (Math.hypot(x - (-0.155), y - 0.355, z - (-0.075)) < 0.10) {
        hasLeftPedalVertex = true;
      }
    }
    expect(hasRightPedalVertex).toBe(true);
    expect(hasLeftPedalVertex).toBe(true);
  });

  it('supports male cyclist configuration', () => {
    const articulatedCircuit = generateAnimatedCyclistCircuit({ gender: 'male', articulated: true });
    expect(articulatedCircuit.allItems.length).toBe(18);
    expect(articulatedCircuit.tracks.length).toBe(18);

    const monoCircuit = generateAnimatedCyclistCircuit({ gender: 'male', articulated: false });
    expect(monoCircuit.allItems.length).toBe(13);
    expect(monoCircuit.tracks.length).toBe(13);
  });

  it('exports animated cyclist GLB buffer with embedded animation tracks', async () => {
    const circuit = generateAnimatedCyclistCircuit({ totalFrames: 60 });
    const glbBuffer = await exportSceneToGLTFBuffer(
      circuit.allItems,
      true,
      circuit.tracks,
      circuit.fps
    );

    expect(glbBuffer).toBeInstanceOf(ArrayBuffer);
    expect(glbBuffer.byteLength).toBeGreaterThan(100000);
  });
});
