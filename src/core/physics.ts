import * as THREE from 'three';

export interface VerletParticle {
  position: THREE.Vector3;
  prevPosition: THREE.Vector3;
  acceleration: THREE.Vector3;
  pinned: boolean;
  mass: number;
}

export interface DistanceConstraint {
  indexA: number;
  indexB: number;
  restLength: number;
  stiffness: number; // 0 to 1
}

export interface VerletHairChain {
  particles: VerletParticle[];
  constraints: DistanceConstraint[];
  restDirections: THREE.Vector3[];
  totalLength: number;
}

/**
 * Creates a topological Verlet particle chain for hair strands or ponytail secondary motion.
 * Particle 0 is pinned to the cranial anchor point (e.g. occiput skull vault).
 */
export function createHairVerletChain(
  anchor: THREE.Vector3,
  segmentCount: number = 7,
  segmentLength: number = 0.030,
  restDirection: THREE.Vector3 = new THREE.Vector3(0, -0.85, -0.52).normalize()
): VerletHairChain {
  const particles: VerletParticle[] = [];
  const constraints: DistanceConstraint[] = [];
  const restDirections: THREE.Vector3[] = [];

  let curPos = anchor.clone();
  particles.push({
    position: curPos.clone(),
    prevPosition: curPos.clone(),
    acceleration: new THREE.Vector3(0, 0, 0),
    pinned: true,
    mass: 1.0,
  });

  for (let i = 1; i <= segmentCount; i++) {
    curPos = curPos.clone().addScaledVector(restDirection, segmentLength);
    particles.push({
      position: curPos.clone(),
      prevPosition: curPos.clone(),
      acceleration: new THREE.Vector3(0, 0, 0),
      pinned: false,
      mass: 0.8 + 0.2 * (1 - i / segmentCount),
    });

    constraints.push({
      indexA: i - 1,
      indexB: i,
      restLength: segmentLength,
      stiffness: 0.95,
    });

    restDirections.push(restDirection.clone());
  }

  return {
    particles,
    constraints,
    restDirections,
    totalLength: segmentCount * segmentLength,
  };
}

/**
 * Advances the Verlet hair simulation step with inertia, damping, gravity, and external wind/inertial acceleration.
 */
export function stepHairVerletChain(
  chain: VerletHairChain,
  dt: number,
  newAnchorPos: THREE.Vector3,
  externalForce: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  gravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0),
  damping: number = 0.92,
  constraintIterations: number = 5,
  shapeRestoreStiffness: number = 0.15
): void {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtSq = safeDt * safeDt;

  // 1. Move pinned anchor
  if (chain.particles.length > 0 && chain.particles[0].pinned) {
    chain.particles[0].position.copy(newAnchorPos);
    chain.particles[0].prevPosition.copy(newAnchorPos);
  }

  // 2. Verlet integration for free particles
  for (let i = 1; i < chain.particles.length; i++) {
    const p = chain.particles[i];
    if (p.pinned) continue;

    // Velocity = (pos - prevPos) * damping
    const velocity = new THREE.Vector3().subVectors(p.position, p.prevPosition).multiplyScalar(damping);

    // Accumulate total force
    const totalForce = gravity.clone().add(externalForce);
    const accel = totalForce.clone().divideScalar(p.mass);

    // Shape retention force (pull gently toward rest direction from parent)
    const parent = chain.particles[i - 1];
    const restDir = chain.restDirections[i - 1] || new THREE.Vector3(0, -1, 0);
    const targetPos = parent.position.clone().addScaledVector(restDir, chain.constraints[i - 1].restLength);
    const shapeDiff = targetPos.sub(p.position).multiplyScalar(shapeRestoreStiffness / safeDt);
    accel.add(shapeDiff);

    p.prevPosition.copy(p.position);
    p.position.add(velocity).addScaledVector(accel, dtSq);
  }

  // 3. Relax distance constraints
  for (let iter = 0; iter < constraintIterations; iter++) {
    for (const c of chain.constraints) {
      const pA = chain.particles[c.indexA];
      const pB = chain.particles[c.indexB];

      const delta = new THREE.Vector3().subVectors(pB.position, pA.position);
      const curDist = delta.length();
      if (curDist < 1e-6) continue;

      const diff = (curDist - c.restLength) / curDist;
      const correction = delta.multiplyScalar(diff * 0.5 * c.stiffness);

      if (!pA.pinned && !pB.pinned) {
        pA.position.add(correction);
        pB.position.sub(correction);
      } else if (pA.pinned && !pB.pinned) {
        pB.position.sub(correction.multiplyScalar(2.0));
      } else if (!pA.pinned && pB.pinned) {
        pA.position.add(correction.multiplyScalar(2.0));
      }
    }
  }
}

/**
 * Deforms ponytail mesh geometry along the simulated Verlet spine curve.
 */
export function deformHairMeshAlongVerletSpine(
  positions: Float32Array | number[],
  restSpineCenters: THREE.Vector3[],
  chain: VerletHairChain,
  ringVertexCounts: number[]
): Float32Array {
  const result = positions instanceof Float32Array ? new Float32Array(positions) : new Float32Array(positions);
  let vOffset = 0;

  const numRings = Math.min(restSpineCenters.length, chain.particles.length);

  for (let r = 0; r < numRings; r++) {
    const restCenter = restSpineCenters[r];
    const simCenter = chain.particles[r].position;
    const offset = new THREE.Vector3().subVectors(simCenter, restCenter);

    const count = ringVertexCounts[r] || 0;
    for (let i = 0; i < count; i++) {
      const idx = (vOffset + i) * 3;
      result[idx] += offset.x;
      result[idx + 1] += offset.y;
      result[idx + 2] += offset.z;
    }
    vOffset += count;
  }

  return result;
}
