import { AnimationTrack, Keyframe, TransformData } from '../types';

/**
 * Smoothstep easing curve for smooth ease-in-out keyframe transitions.
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
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
