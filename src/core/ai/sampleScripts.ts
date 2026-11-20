import { ScriptSample } from './types';

export const SAMPLE_SCRIPTS: ScriptSample[] = [
  {
    id: 'parametric-stairs',
    title: 'Parametric Spiral Staircase',
    category: 'Architectural',
    description: 'Generates a helical marble staircase wrapped around a central pillar with an apex observation platform.',
    code: `// Clear existing scene and setup studio lighting
polyforge.clearScene();
polyforge.setEnvironment({ preset: 'studio', showGrid: true });
polyforge.setTimeline({ totalFrames: 120, fps: 30 });

// 1. Central Core Pillar
const pillar = polyforge.createObject({
  name: 'Central Helical Pillar',
  primitive: 'cylinder',
  position: [0, 2.5, 0],
  scale: [0.5, 5.0, 0.5],
  material: { color: '#f1f5f9', roughness: 0.2, metalness: 0.1 }
});

// 2. Generate Helical Steps
const totalSteps = 20;
const height = 4.0;
const radius = 1.4;

for (let i = 0; i < totalSteps; i++) {
  const fraction = i / totalSteps;
  const angle = fraction * Math.PI * 2;
  const y = fraction * height + 0.1;
  const x = Math.cos(angle) * (radius / 2);
  const z = Math.sin(angle) * (radius / 2);

  polyforge.createObject({
    name: \`Stair Tread \${i + 1}\`,
    primitive: 'box',
    position: [x, y, z],
    rotation: [0, -angle, 0],
    scale: [radius, 0.08, 0.3],
    material: {
      color: i % 2 === 0 ? '#388bfd' : '#e2e8f0',
      roughness: 0.3,
      metalness: 0.2
    }
  });
}

// 3. Apex Platform
polyforge.createObject({
  name: 'Apex Lookout Platform',
  primitive: 'cylinder',
  position: [0, height + 0.1, 0],
  scale: [2.2, 0.15, 2.2],
  material: { color: '#fbbf24', metalness: 0.8, roughness: 0.2 }
});

polyforge.log("Created spiral staircase with 20 treads and apex lookout.");
`,
  },
  {
    id: 'kinetic-wave-field',
    title: 'Kinetic Sine Wave Grid',
    category: 'Procedural',
    description: 'Creates a 7x7 matrix of oscillating columns synchronized into a hypnotic 3D wave animation.',
    code: `polyforge.clearScene();
polyforge.setEnvironment({ preset: 'cyberpunk', backgroundColor: '#090d16' });
polyforge.setTimeline({ totalFrames: 120, fps: 30 });

const gridSize = 7;
const spacing = 0.6;
const offset = ((gridSize - 1) * spacing) / 2;

for (let x = 0; x < gridSize; x++) {
  for (let z = 0; z < gridSize; z++) {
    const px = x * spacing - offset;
    const pz = z * spacing - offset;
    const dist = Math.sqrt(px * px + pz * pz);
    
    const obj = polyforge.createObject({
      name: \`Pillar [\${x},\${z}]\`,
      primitive: 'box',
      position: [px, 0.5, pz],
      scale: [0.35, 1.0, 0.35],
      material: {
        color: dist < 1.0 ? '#06b6d4' : dist < 1.8 ? '#3b82f6' : '#ec4899',
        metalness: 0.7,
        roughness: 0.2,
        emissive: dist < 1.0 ? '#06b6d4' : '#000000',
        emissiveIntensity: dist < 1.0 ? 0.8 : 0
      }
    });

    // Create wave keyframes across 120 frames
    for (let f = 0; f <= 120; f += 20) {
      const phase = (f / 120) * Math.PI * 2;
      const height = 0.4 + Math.sin(dist * 2.0 - phase) * 0.35 + 0.35;
      polyforge.addKeyframe(
        obj.id,
        f,
        {
          position: [px, height / 2, pz],
          scale: [0.35, height, 0.35]
        },
        'ease-in-out'
      );
    }
  }
}

polyforge.log(\`Generated kinetic wave field with \${gridSize * gridSize} synchronized animated pillars.\`);
`,
  },
  {
    id: 'orbiting-planetary-system',
    title: 'Keplerian Planetary System',
    category: 'Animation',
    description: 'Constructs an illuminated sun with four orbiting celestial spheres possessing distinct orbital radii, colors, and velocities.',
    code: `polyforge.clearScene();
polyforge.setEnvironment({ preset: 'studio', backgroundColor: '#020617' });
polyforge.setTimeline({ totalFrames: 120, fps: 30 });

// Radiant Sun
const sun = polyforge.createObject({
  name: 'Sun',
  primitive: 'sphere',
  position: [0, 1.0, 0],
  scale: [1.0, 1.0, 1.0],
  material: {
    color: '#fbbf24',
    emissive: '#f59e0b',
    emissiveIntensity: 2.0,
    roughness: 0.1
  }
});

// Sun rotation
polyforge.addKeyframe(sun.id, 0, { rotation: [0, 0, 0] }, 'linear');
polyforge.addKeyframe(sun.id, 120, { rotation: [0, Math.PI * 2, 0] }, 'linear');

// Planets
const planets = [
  { name: 'Planet Vulcan', radius: 1.8, size: 0.2, color: '#f87171', speed: 3 },
  { name: 'Planet Azure', radius: 2.8, size: 0.3, color: '#38bdf8', speed: 2 },
  { name: 'Planet Emerald', radius: 3.8, size: 0.26, color: '#34d399', speed: 1.2 },
  { name: 'Planet Gold', radius: 4.8, size: 0.4, color: '#facc15', speed: 0.8 },
];

for (const p of planets) {
  const planet = polyforge.createObject({
    name: p.name,
    primitive: 'sphere',
    position: [p.radius, 1.0, 0],
    scale: [p.size, p.size, p.size],
    material: { color: p.color, roughness: 0.4, metalness: 0.4 }
  });

  // Calculate circular orbit keyframes
  for (let f = 0; f <= 120; f += 15) {
    const angle = (f / 120) * Math.PI * 2 * p.speed;
    const px = Math.cos(angle) * p.radius;
    const pz = Math.sin(angle) * p.radius;
    polyforge.addKeyframe(
      planet.id,
      f,
      {
        position: [px, 1.0, pz],
        rotation: [0, angle * 2, 0]
      },
      'linear'
    );
  }
}

polyforge.log("Generated Keplerian planetary system with orbital animation.");
`,
  },
  {
    id: 'scifi-energy-conduit',
    title: 'Sci-Fi Quantum Conduit',
    category: 'Sci-Fi',
    description: 'Constructs an array of high-tech interlocking magnetic rings and pulsating central energy crystals.',
    code: `polyforge.clearScene();
polyforge.setEnvironment({ preset: 'cyberpunk', backgroundColor: '#030712' });
polyforge.setTimeline({ totalFrames: 120, fps: 30 });

// Core Energy Crystal
const core = polyforge.createObject({
  name: 'Quantum Crystal',
  primitive: 'dodecahedron',
  position: [0, 1.5, 0],
  scale: [0.8, 1.2, 0.8],
  material: {
    color: '#06b6d4',
    emissive: '#0891b2',
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.2
  }
});

polyforge.addKeyframe(core.id, 0, { rotation: [0, 0, 0], scale: [0.8, 1.2, 0.8] }, 'linear');
polyforge.addKeyframe(core.id, 60, { rotation: [Math.PI, Math.PI, 0], scale: [0.95, 1.4, 0.95] }, 'linear');
polyforge.addKeyframe(core.id, 120, { rotation: [Math.PI * 2, Math.PI * 2, 0], scale: [0.8, 1.2, 0.8] }, 'linear');

// Dual Orthogonal Rings
const ring1 = polyforge.createObject({
  name: 'Containment Ring X',
  primitive: 'torus',
  position: [0, 1.5, 0],
  scale: [1, 1, 1],
  material: { color: '#ec4899', emissive: '#db2777', emissiveIntensity: 1.2, metalness: 0.9, roughness: 0.2 },
  geometryParams: { radius: 1.8, tube: 0.08 }
});

const ring2 = polyforge.createObject({
  name: 'Containment Ring Y',
  primitive: 'torus',
  position: [0, 1.5, 0],
  scale: [1, 1, 1],
  material: { color: '#3b82f6', emissive: '#2563eb', emissiveIntensity: 1.2, metalness: 0.9, roughness: 0.2 },
  geometryParams: { radius: 2.2, tube: 0.08 }
});

// Animate counter-rotations
polyforge.addKeyframe(ring1.id, 0, { rotation: [0, 0, 0] }, 'linear');
polyforge.addKeyframe(ring1.id, 120, { rotation: [Math.PI * 2, 0, 0] }, 'linear');

polyforge.addKeyframe(ring2.id, 0, { rotation: [0, 0, Math.PI / 2] }, 'linear');
polyforge.addKeyframe(ring2.id, 120, { rotation: [0, Math.PI * 2, Math.PI / 2] }, 'linear');

polyforge.log("Constructed Sci-Fi Quantum Conduit with animated magnetic fields.");
`,
  },
  {
    id: 'procedural-megacity',
    title: 'Procedural Skyscraper Megacity',
    category: 'Procedural',
    description: 'Procedurally synthesizes an illuminated urban cityscape grid with diverse skyscraper profiles, glass reflections, and aerial beacons.',
    code: `polyforge.clearScene();
polyforge.setEnvironment({ preset: 'cyberpunk', backgroundColor: '#020617' });
polyforge.setTimeline({ totalFrames: 120, fps: 30 });

const rows = 5;
const cols = 5;
const spacing = 1.3;
const startX = -((cols - 1) * spacing) / 2;
const startZ = -((rows - 1) * spacing) / 2;

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = startX + c * spacing;
    const z = startZ + r * spacing;
    
    // Procedural pseudo-random height based on coordinates
    const seed = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
    const rand = seed - Math.floor(seed);
    const height = 1.2 + rand * 3.5;
    
    const tower = polyforge.createObject({
      name: \`Skyscraper [\${c},\${r}]\`,
      primitive: rand > 0.6 ? 'cylinder' : 'box',
      position: [x, height / 2, z],
      scale: [0.8, height, 0.8],
      material: {
        color: rand > 0.5 ? '#1e293b' : '#0f172a',
        metalness: 0.85,
        roughness: 0.2,
      }
    });

    // Rooftop beacon for taller skyscrapers
    if (height > 2.8) {
      polyforge.createObject({
        name: \`Beacon [\${c},\${r}]\`,
        primitive: 'sphere',
        position: [x, height + 0.15, z],
        scale: [0.15, 0.15, 0.15],
        material: {
          color: '#f43f5e',
          emissive: '#f43f5e',
          emissiveIntensity: 3.0,
          roughness: 0.1
        }
      });
    }
  }
}

polyforge.log(\`Generated urban megacity grid with \${rows * cols} skyscrapers and aviation beacons.\`);
`,
  },
];
