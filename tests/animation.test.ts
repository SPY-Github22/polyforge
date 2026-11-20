import { describe, it, expect } from 'vitest';
import {
  evaluateTrackAtFrame,
  insertOrUpdateKeyframe,
  removeKeyframeAt,
  createTurntableTrack,
  generateClosedCircuitTrajectory,
  evaluateMultiTrackAtFrame,
} from '../src/core/animation';
import { AnimationTrack, TransformData } from '../src/types';

describe('Keyframe Animation Engine', () => {
  const fallbackTransform: TransformData = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  it('evaluates fallback transform when track is empty', () => {
    const emptyTrack: AnimationTrack = {
      objectId: 'obj-1',
      keyframes: [],
    };
    const result = evaluateTrackAtFrame(emptyTrack, 10, fallbackTransform);
    expect(result).toEqual(fallbackTransform);
  });

  it('clamps to boundary keyframes before start or after end', () => {
    const track: AnimationTrack = {
      objectId: 'obj-1',
      keyframes: [
        {
          frame: 10,
          transform: { position: [2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'linear',
        },
        {
          frame: 20,
          transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'linear',
        },
      ],
    };

    const before = evaluateTrackAtFrame(track, 0, fallbackTransform);
    expect(before.position[0]).toBe(2);

    const after = evaluateTrackAtFrame(track, 30, fallbackTransform);
    expect(after.position[0]).toBe(10);
  });

  it('linearly interpolates intermediate frames accurately', () => {
    const track: AnimationTrack = {
      objectId: 'obj-1',
      keyframes: [
        {
          frame: 0,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'linear',
        },
        {
          frame: 100,
          transform: { position: [10, 20, 30], rotation: [0, 0, 0], scale: [2, 2, 2] },
          interpolation: 'linear',
        },
      ],
    };

    const mid = evaluateTrackAtFrame(track, 50, fallbackTransform);
    expect(mid.position[0]).toBeCloseTo(5);
    expect(mid.position[1]).toBeCloseTo(10);
    expect(mid.position[2]).toBeCloseTo(15);
    expect(mid.scale[0]).toBeCloseTo(1.5);
  });

  it('interpolates using ease-in-out smoothstep curve', () => {
    const track: AnimationTrack = {
      objectId: 'obj-1',
      keyframes: [
        {
          frame: 0,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'ease-in-out',
        },
        {
          frame: 100,
          transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'ease-in-out',
        },
      ],
    };

    // At t=0.25, smoothstep(0.25) = 0.25 * 0.25 * (3 - 0.5) = 0.15625 => pos = 1.5625 (slower than linear 2.5)
    const quarter = evaluateTrackAtFrame(track, 25, fallbackTransform);
    expect(quarter.position[0]).toBeCloseTo(1.5625);

    // At t=0.5, smoothstep(0.5) = 0.5 => pos = 5.0
    const half = evaluateTrackAtFrame(track, 50, fallbackTransform);
    expect(half.position[0]).toBeCloseTo(5.0);
  });

  it('supports step (hold) interpolation', () => {
    const track: AnimationTrack = {
      objectId: 'obj-1',
      keyframes: [
        {
          frame: 0,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'step',
        },
        {
          frame: 10,
          transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          interpolation: 'step',
        },
      ],
    };

    const mid = evaluateTrackAtFrame(track, 5, fallbackTransform);
    expect(mid.position[0]).toBe(0); // remains held at prev keyframe
  });

  it('inserts and updates keyframes while keeping ascending frame order', () => {
    let track: AnimationTrack = { objectId: 'obj-1', keyframes: [] };

    track = insertOrUpdateKeyframe(track, 30, fallbackTransform);
    track = insertOrUpdateKeyframe(track, 10, fallbackTransform);
    track = insertOrUpdateKeyframe(track, 20, fallbackTransform);

    expect(track.keyframes.map((k) => k.frame)).toEqual([10, 20, 30]);

    // Updating existing frame 20
    const updatedTransform: TransformData = {
      position: [5, 5, 5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    track = insertOrUpdateKeyframe(track, 20, updatedTransform);
    expect(track.keyframes.length).toBe(3);
    expect(track.keyframes[1].transform.position).toEqual([5, 5, 5]);

    // Removing frame 20
    track = removeKeyframeAt(track, 20);
    expect(track.keyframes.map((k) => k.frame)).toEqual([10, 30]);
  });

  it('generates 360-degree turntable rotation keyframes', () => {
    const turntable = createTurntableTrack('obj-1', fallbackTransform, 0, 60);
    expect(turntable.keyframes.length).toBe(3);
    expect(turntable.keyframes[0].frame).toBe(0);
    expect(turntable.keyframes[0].transform.rotation[1]).toBeCloseTo(0);

    expect(turntable.keyframes[1].frame).toBe(30);
    expect(turntable.keyframes[1].transform.rotation[1]).toBeCloseTo(Math.PI);

    expect(turntable.keyframes[2].frame).toBe(60);
    expect(turntable.keyframes[2].transform.rotation[1]).toBeCloseTo(Math.PI * 2);

    // Continuous 360-degree rotation without gimbal flips
    const at15 = evaluateTrackAtFrame(turntable, 15, fallbackTransform);
    expect(at15.rotation[0]).toBeCloseTo(0);
    expect(at15.rotation[2]).toBeCloseTo(0);
    expect(at15.rotation[1]).toBeCloseTo(Math.PI / 2); // 90 degrees

    const at20 = evaluateTrackAtFrame(turntable, 20, fallbackTransform);
    expect(at20.rotation[0]).toBeCloseTo(0);
    expect(at20.rotation[2]).toBeCloseTo(0);
    expect(at20.rotation[1]).toBeCloseTo((Math.PI * 2) / 3); // 120 degrees

    const at45 = evaluateTrackAtFrame(turntable, 45, fallbackTransform);
    expect(at45.rotation[0]).toBeCloseTo(0);
    expect(at45.rotation[2]).toBeCloseTo(0);
    expect(at45.rotation[1]).toBeCloseTo((Math.PI * 3) / 2); // 270 degrees

    const at60 = evaluateTrackAtFrame(turntable, 60, fallbackTransform);
    expect(at60.rotation[1]).toBeCloseTo(Math.PI * 2); // 360 degrees
  });

  it('generates an exact closed-circuit trajectory that returns seamlessly to origin and initial heading', () => {
    const trajectory = generateClosedCircuitTrajectory({
      totalFrames: 360,
      fps: 30,
      turnRadius: 2.5,
      wheelRadius: 0.34,
      gearRatio: 2.4,
      integerRevolutions: true,
    });

    expect(trajectory.length).toBe(361);

    const start = trajectory[0];
    const end = trajectory[360];

    // Starts at origin
    expect(start.position[0]).toBeCloseTo(0, 2);
    expect(start.position[2]).toBeCloseTo(0, 2);
    expect(start.heading).toBeCloseTo(0, 2);

    // Returns seamlessly to origin
    expect(end.position[0]).toBeCloseTo(0, 2);
    expect(end.position[2]).toBeCloseTo(0, 2);
    // Heading should be 0 mod 2*pi
    expect(Math.abs(end.heading % (Math.PI * 2))).toBeCloseTo(0, 2);

    // Integer revolutions for wheels and cranks
    const wheelRotMod = Math.abs(end.wheelRotation % (Math.PI * 2));
    expect(wheelRotMod).toBeCloseTo(0, 1);

    const crankRotMod = Math.abs(end.crankRotation % (Math.PI * 2));
    expect(crankRotMod).toBeCloseTo(0, 1);

    // Mid-turn (around frame 120 or 130), bike must have positive curvature, inward lean and steering
    const midTurn = trajectory[130];
    expect(midTurn.curvature).toBeGreaterThan(0);
    expect(midTurn.leanAngle).toBeGreaterThan(0);
    expect(midTurn.steeringAngle).toBeGreaterThan(0);

    // Straightaway (frame 30) must have 0 curvature, 0 lean and 0 steering
    const straight = trajectory[30];
    expect(straight.curvature).toBeCloseTo(0, 3);
    expect(straight.leanAngle).toBeCloseTo(0, 3);
    expect(straight.steeringAngle).toBeCloseTo(0, 3);
  });

  it('evaluates multi-track animations across several objects simultaneously', () => {
    const trackA: AnimationTrack = {
      objectId: 'obj-a',
      keyframes: [
        { frame: 0, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
        { frame: 100, transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
      ],
    };
    const trackB: AnimationTrack = {
      objectId: 'obj-b',
      keyframes: [
        { frame: 0, transform: { position: [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
        { frame: 100, transform: { position: [0, 15, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
      ],
    };

    const evaluated = evaluateMultiTrackAtFrame([trackA, trackB], 50);
    expect(evaluated.size).toBe(2);
    expect(evaluated.get('obj-a')?.position[0]).toBeCloseTo(5);
    expect(evaluated.get('obj-b')?.position[1]).toBeCloseTo(10);
  });
});
