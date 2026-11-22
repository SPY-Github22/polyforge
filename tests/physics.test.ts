import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createHairVerletChain,
  stepHairVerletChain,
  deformHairMeshAlongVerletSpine,
} from '../src/core/physics';

describe('Hair & Secondary Motion Verlet Physics Engine', () => {
  it('creates a valid Verlet hair chain with pinned cranial root and distance constraints', () => {
    const anchor = new THREE.Vector3(0, 1.56, -0.125);
    const chain = createHairVerletChain(anchor, 6, 0.035);

    expect(chain.particles.length).toBe(7);
    expect(chain.constraints.length).toBe(6);
    expect(chain.particles[0].pinned).toBe(true);
    expect(chain.particles[0].position.x).toBeCloseTo(0, 4);
    expect(chain.particles[0].position.y).toBeCloseTo(1.56, 4);
    expect(chain.particles[0].position.z).toBeCloseTo(-0.125, 4);

    for (let i = 1; i < chain.particles.length; i++) {
      expect(chain.particles[i].pinned).toBe(false);
    }
  });

  it('steps physics realistically: anchor motion drags the chain, while constraints preserve rest lengths', () => {
    const anchor = new THREE.Vector3(0, 1.56, -0.125);
    const chain = createHairVerletChain(anchor, 5, 0.04);

    // Initial total distance from root to tip
    const initialTipDist = chain.particles[5].position.distanceTo(chain.particles[0].position);
    expect(initialTipDist).toBeCloseTo(5 * 0.04, 3);

    // Simulate head moving forward rapidly (x += 0.05m)
    const newAnchor = new THREE.Vector3(0.05, 1.56, -0.125);
    const windForce = new THREE.Vector3(-2.0, 0, 0); // inertial drag backward

    for (let step = 0; step < 10; step++) {
      stepHairVerletChain(chain, 0.016, newAnchor, windForce);
    }

    // Pinned anchor moved exactly
    expect(chain.particles[0].position.x).toBeCloseTo(0.05, 4);
    // Tip lags behind due to inertia and wind drag (tip.x < anchor.x)
    expect(chain.particles[5].position.x).toBeLessThan(chain.particles[0].position.x);

    // Distance constraints prevent stretching
    for (const c of chain.constraints) {
      const dist = chain.particles[c.indexA].position.distanceTo(chain.particles[c.indexB].position);
      expect(dist).toBeCloseTo(c.restLength, 1);
    }
  });

  it('deforms hair mesh positions according to simulated Verlet spine offsets', () => {
    const restCenters = [
      new THREE.Vector3(0, 1.56, -0.12),
      new THREE.Vector3(0, 1.52, -0.13),
    ];
    const chain = createHairVerletChain(restCenters[0], 1, 0.04);
    // Move second particle by +0.02 on X
    chain.particles[1].position.x += 0.02;

    const dummyPositions = new Float32Array([
      // Ring 0 (2 vertices)
      0.01, 1.56, -0.12,
      -0.01, 1.56, -0.12,
      // Ring 1 (2 vertices)
      0.01, 1.52, -0.13,
      -0.01, 1.52, -0.13,
    ]);

    const deformed = deformHairMeshAlongVerletSpine(dummyPositions, restCenters, chain, [2, 2]);
    // Ring 0 didn't move on X
    expect(deformed[0]).toBeCloseTo(0.01, 4);
    expect(deformed[3]).toBeCloseTo(-0.01, 4);
    // Ring 1 shifted by +0.02 on X
    expect(deformed[6]).toBeCloseTo(0.03, 4);
    expect(deformed[9]).toBeCloseTo(0.01, 4);
  });
});
