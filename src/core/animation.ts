import { AnimationTrack, Keyframe, TransformData } from '../types';

export interface KinematicTrajectoryPoint {
  frame: number;
  time: number;
  distance: number;
  position: [number, number, number];
  heading: number; // yaw in radians
  velocity: number;
  curvature: number;
  leanAngle: number; // centripetal roll in radians
  steeringAngle: number; // handlebar steering in radians
  wheelRotation: number; // cumulative roll in radians
  crankRotation: number; // cumulative pedaling in radians
  swayRoll: number;
  jitterY: number;
  jitterPitch: number;
}

export interface ClosedCircuitOptions {
  totalFrames?: number; // default 360
  fps?: number; // default 30
  straightDistance?: number; // default ~4.96m
  turnRadius?: number; // default 2.50m
  wheelRadius?: number; // default 0.34m
  wheelbase?: number; // default 1.00m
  gearRatio?: number; // default 2.4 (cadence gear)
  swayAmplitude?: number; // default 0.024 rad (~1.4 deg)
  vibrationAmplitude?: number; // default 0.0012 m micro-jitter
  integerRevolutions?: boolean; // default true
}

/**
 * Smoothstep easing curve for smooth ease-in-out keyframe transitions.
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Generates an ultra-smooth, physically authentic closed-circuit racetrack trajectory.
 * Calculates exact kinematics: forward travel, 180° circular return turns, wheel rolling,
 * cadence-synchronized pedaling, centripetal roll lean, steering, and road micro-vibrations.
 */
export function generateClosedCircuitTrajectory(
  options: ClosedCircuitOptions = {}
): KinematicTrajectoryPoint[] {
  const totalFrames = Math.max(30, options.totalFrames ?? 360);
  const fps = Math.max(1, options.fps ?? 30);
  const rWheel = Math.max(0.15, options.wheelRadius ?? 0.34);
  const rTurn = Math.max(1.0, options.turnRadius ?? 2.5);
  const wheelbase = Math.max(0.5, options.wheelbase ?? 1.0);
  const gearRatio = Math.max(1.0, options.gearRatio ?? 2.4);
  const swayAmp = options.swayAmplitude ?? 0.024;
  const vibAmp = options.vibrationAmplitude ?? 0.0012;
  const integerRev = options.integerRevolutions ?? true;

  const wheelCirc = 2 * Math.PI * rWheel;
  const turnCirc = 2 * Math.PI * rTurn; // Total length of two 180° turns

  let targetStraight = options.straightDistance ?? 4.9637;
  let totalLength = 2 * targetStraight + turnCirc;

  if (integerRev) {
    const kRevs = Math.max(4, Math.round(totalLength / wheelCirc));
    totalLength = kRevs * wheelCirc;
    targetStraight = Math.max(1.0, (totalLength - turnCirc) * 0.5);
  }

  const L = targetStraight;
  const turnArcLen = Math.PI * rTurn;
  const totalDist = 2 * L + 2 * turnArcLen;

  const points: KinematicTrajectoryPoint[] = [];

  for (let frame = 0; frame <= totalFrames; frame++) {
    const progress = frame / totalFrames; // 0.0 to 1.0
    const s = progress * totalDist;
    const time = frame / fps;
    const velocity = totalDist / (totalFrames / fps);

    let x = 0;
    let z = 0;
    let heading = 0;

    // Segment 1: Forward straight [0, L]
    if (s <= L) {
      x = s;
      z = 0;
      heading = 0;
    }
    // Segment 2: Turn 1 (Left 180° arc) [L, L + turnArcLen]
    else if (s <= L + turnArcLen) {
      const u = (s - L) / rTurn; // 0 to PI
      x = L + rTurn * Math.sin(u);
      z = rTurn - rTurn * Math.cos(u);
      heading = -u; // 0 to -PI
    }
    // Segment 3: Return straight [L + turnArcLen, 2L + turnArcLen]
    else if (s <= 2 * L + turnArcLen) {
      const d = s - (L + turnArcLen); // 0 to L
      x = L - d;
      z = 2 * rTurn;
      heading = -Math.PI;
    }
    // Segment 4: Turn 2 (Return 180° arc back to origin) [2L + turnArcLen, totalDist]
    else {
      const u = (s - (2 * L + turnArcLen)) / rTurn; // 0 to PI
      x = -rTurn * Math.sin(u);
      z = rTurn + rTurn * Math.cos(u);
      heading = -Math.PI - u; // -PI to -2*PI
    }

    // Smooth curvature easing at turn boundaries (clothoid transition)
    const transLen = Math.min(0.5, L * 0.25);
    let curvatureFactor = 0;

    // Turn 1 transition
    if (s >= L - transLen && s <= L + transLen) {
      const alpha = (s - (L - transLen)) / (2 * transLen);
      curvatureFactor = smoothstep(alpha);
    } else if (s > L + transLen && s < L + turnArcLen - transLen) {
      curvatureFactor = 1.0;
    } else if (s >= L + turnArcLen - transLen && s <= L + turnArcLen + transLen) {
      const alpha = (s - (L + turnArcLen - transLen)) / (2 * transLen);
      curvatureFactor = 1.0 - smoothstep(alpha);
    }
    // Turn 2 transition
    else if (s >= 2 * L + turnArcLen - transLen && s <= 2 * L + turnArcLen + transLen) {
      const alpha = (s - (2 * L + turnArcLen - transLen)) / (2 * transLen);
      curvatureFactor = smoothstep(alpha);
    } else if (s > 2 * L + turnArcLen + transLen && s < totalDist - transLen) {
      curvatureFactor = 1.0;
    } else if (s >= totalDist - transLen) {
      const alpha = (s - (totalDist - transLen)) / (2 * transLen);
      curvatureFactor = 1.0 - smoothstep(alpha);
    }

    const curvature = (1 / rTurn) * curvatureFactor;

    // Physical Centripetal Lean: tan(theta) = (v^2 * curvature) / g
    const g = 9.80665;
    const centripetalAcc = velocity * velocity * curvature;
    // Inward bank angle for left turn
    const leanAngle = Math.atan(centripetalAcc / g);

    // Kinematic Steering Angle: tan(delta) = wheelbase * curvature
    const steeringAngle = Math.atan(wheelbase * curvature);

    // Synchronized cumulative wheel and crank rotation
    // Negative because rolling forward clockwise around local Z axis
    const wheelRotation = -(s / rWheel);
    const crankRotation = -(s / (rWheel * gearRatio));

    // Dynamic pedaling sway roll (cadence roll wobble)
    const swayRoll = swayAmp * Math.sin(2 * crankRotation) * (1 - 0.4 * curvatureFactor);

    // Road micro-vibration and suspension pitch jitter with harmonic loop closure
    const totalTime = totalFrames / fps;
    const harmY1 = Math.round(13.5 * totalTime);
    const harmY2 = Math.round(21.0 * totalTime);
    const harmP1 = Math.round(17.0 * totalTime);
    const harmP2 = Math.round(27.5 * totalTime);
    const jitterY =
      vibAmp * Math.sin(2 * Math.PI * harmY1 * progress) * Math.cos(2 * Math.PI * harmY2 * progress);
    const jitterPitch =
      0.0018 * Math.sin(2 * Math.PI * harmP1 * progress) * Math.cos(2 * Math.PI * harmP2 * progress);

    points.push({
      frame,
      time,
      distance: s,
      position: [x, jitterY, z],
      heading,
      velocity,
      curvature,
      leanAngle,
      steeringAngle,
      wheelRotation,
      crankRotation,
      swayRoll,
      jitterY,
      jitterPitch,
    });
  }

  return points;
}

/**
 * Evaluates multiple animation tracks concurrently for all scene items at a given frame.
 */
export function evaluateMultiTrackAtFrame(
  tracks: AnimationTrack[],
  frame: number,
  fallbackMap: Map<string, TransformData> = new Map()
): Map<string, TransformData> {
  const result = new Map<string, TransformData>();

  for (const track of tracks) {
    const fallback = fallbackMap.get(track.objectId) || {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    result.set(track.objectId, evaluateTrackAtFrame(track, frame, fallback));
  }

  return result;
}

/**
 * Evaluates the animated transform for an object at a specific frame number.
 */
export function evaluateTrackAtFrame(
  track: AnimationTrack,
  frame: number,
  fallbackTransform: TransformData = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }
): TransformData {
  if (!track || !track.keyframes || track.keyframes.length === 0) {
    return fallbackTransform;
  }

  const safeExtract = (t?: Partial<TransformData>): TransformData => ({
    position:
      Array.isArray(t?.position) && t.position.length === 3
        ? [Number(t.position[0]) || 0, Number(t.position[1]) || 0, Number(t.position[2]) || 0]
        : [...fallbackTransform.position],
    rotation:
      Array.isArray(t?.rotation) && t.rotation.length === 3
        ? [Number(t.rotation[0]) || 0, Number(t.rotation[1]) || 0, Number(t.rotation[2]) || 0]
        : [...fallbackTransform.rotation],
    scale:
      Array.isArray(t?.scale) && t.scale.length === 3
        ? [Number(t.scale[0]) || 1, Number(t.scale[1]) || 1, Number(t.scale[2]) || 1]
        : [...fallbackTransform.scale],
  });

  // Sort keyframes by frame number ascending
  const sorted = [...track.keyframes].sort((a, b) => a.frame - b.frame);

  // Before first keyframe
  if (frame <= sorted[0].frame) {
    return safeExtract(sorted[0].transform);
  }

  // After last keyframe
  if (frame >= sorted[sorted.length - 1].frame) {
    const last = sorted[sorted.length - 1];
    return safeExtract(last.transform);
  }

  // Find surrounding keyframes
  let prev = sorted[0];
  let next = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }

  const frameRange = next.frame - prev.frame;
  if (frameRange === 0) {
    return {
      position: [...prev.transform.position],
      rotation: [...prev.transform.rotation],
      scale: [...prev.transform.scale],
    };
  }

  let alpha = (frame - prev.frame) / frameRange;

  if (prev.interpolation === 'step') {
    return {
      position: [...prev.transform.position],
      rotation: [...prev.transform.rotation],
      scale: [...prev.transform.scale],
    };
  } else if (prev.interpolation === 'ease-in-out') {
    alpha = smoothstep(alpha);
  }

  // Position interpolation
  const pos: [number, number, number] = [
    prev.transform.position[0] + (next.transform.position[0] - prev.transform.position[0]) * alpha,
    prev.transform.position[1] + (next.transform.position[1] - prev.transform.position[1]) * alpha,
    prev.transform.position[2] + (next.transform.position[2] - prev.transform.position[2]) * alpha,
  ];

  // Rotation interpolation (Euler angles in radians with continuous revolution preservation)
  const rot: [number, number, number] = [
    prev.transform.rotation[0] + (next.transform.rotation[0] - prev.transform.rotation[0]) * alpha,
    prev.transform.rotation[1] + (next.transform.rotation[1] - prev.transform.rotation[1]) * alpha,
    prev.transform.rotation[2] + (next.transform.rotation[2] - prev.transform.rotation[2]) * alpha,
  ];

  // Scale interpolation
  const sca: [number, number, number] = [
    prev.transform.scale[0] + (next.transform.scale[0] - prev.transform.scale[0]) * alpha,
    prev.transform.scale[1] + (next.transform.scale[1] - prev.transform.scale[1]) * alpha,
    prev.transform.scale[2] + (next.transform.scale[2] - prev.transform.scale[2]) * alpha,
  ];

  return {
    position: pos,
    rotation: rot,
    scale: sca,
  };
}

/**
 * Inserts or updates a keyframe on a track.
 */
export function insertOrUpdateKeyframe(
  track: AnimationTrack,
  frame: number,
  transform: TransformData,
  interpolation: 'linear' | 'ease-in-out' | 'step' = 'ease-in-out'
): AnimationTrack {
  const existingIdx = track.keyframes.findIndex((k) => k.frame === frame);
  const newKeyframe: Keyframe = {
    frame,
    transform: {
      position: [...transform.position],
      rotation: [...transform.rotation],
      scale: [...transform.scale],
    },
    interpolation,
  };

  const updatedKeyframes = [...track.keyframes];
  if (existingIdx >= 0) {
    updatedKeyframes[existingIdx] = newKeyframe;
  } else {
    updatedKeyframes.push(newKeyframe);
    updatedKeyframes.sort((a, b) => a.frame - b.frame);
  }

  return {
    ...track,
    keyframes: updatedKeyframes,
  };
}

/**
 * Removes a keyframe from a track by frame number.
 */
export function removeKeyframeAt(track: AnimationTrack, frame: number): AnimationTrack {
  return {
    ...track,
    keyframes: track.keyframes.filter((k) => k.frame !== frame),
  };
}

/**
 * Generates a 360-degree turntable rotation animation sequence.
 */
export function createTurntableTrack(
  objectId: string,
  baseTransform: TransformData,
  startFrame: number = 0,
  durationFrames: number = 60
): AnimationTrack {
  const kf0: Keyframe = {
    frame: startFrame,
    transform: {
      position: [...baseTransform.position],
      rotation: [baseTransform.rotation[0], 0, baseTransform.rotation[2]],
      scale: [...baseTransform.scale],
    },
    interpolation: 'linear',
  };

  const kfMid: Keyframe = {
    frame: startFrame + Math.round(durationFrames / 2),
    transform: {
      position: [...baseTransform.position],
      rotation: [baseTransform.rotation[0], Math.PI, baseTransform.rotation[2]],
      scale: [...baseTransform.scale],
    },
    interpolation: 'linear',
  };

  const kfEnd: Keyframe = {
    frame: startFrame + durationFrames,
    transform: {
      position: [...baseTransform.position],
      rotation: [baseTransform.rotation[0], Math.PI * 2, baseTransform.rotation[2]],
      scale: [...baseTransform.scale],
    },
    interpolation: 'linear',
  };

  return {
    objectId,
    keyframes: [kf0, kfMid, kfEnd],
  };
}
