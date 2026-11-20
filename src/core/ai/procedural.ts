import {
  AnimationTrack,
  Keyframe,
  MaterialProperties,
  SceneItem,
} from '../../types';
import {
  ProceduralGenerationResult,
  ProceduralTemplate,
  ProceduralTemplateId,
} from './types';
import { generateRealisticBicycle } from '../bicycle';
import { generateRealisticHumanScene } from '../character';

// Helper to create a unique ID
function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
}

// Helper to create default material with overrides
function createMaterial(overrides: Partial<MaterialProperties>): MaterialProperties {
  return {
    color: '#388bfd',
    roughness: 0.35,
    metalness: 0.2,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'none',
    ...overrides,
  };
}

/**
 * 1. CYBERPUNK SCI-FI CITADEL
 * A towering megastructure with levitating magnetic rings, communications masts, and power pylons.
 */
export function generateSciFiCitadel(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  // Central Spire Base
  const baseId = makeId('citadel-base');
  items.push({
    id: baseId,
    name: 'Citadel Citadel Base',
    type: 'mesh',
    primitiveType: 'cylinder',
    transform: { position: [0, 0.75, 0], rotation: [0, 0, 0], scale: [2.2, 1.5, 2.2] },
    material: createMaterial({ color: '#161b22', metalness: 0.85, roughness: 0.3 }),
    geometryParams: { radialSegments: 16 },
    visible: true,
    locked: false,
  });

  // Tower Mid-Section
  const midId = makeId('citadel-mid');
  items.push({
    id: midId,
    name: 'Command Tower Core',
    type: 'mesh',
    primitiveType: 'cylinder',
    transform: { position: [0, 2.75, 0], rotation: [0, 0, 0], scale: [1.2, 2.5, 1.2] },
    material: createMaterial({ color: '#090d16', metalness: 0.9, roughness: 0.2 }),
    geometryParams: { radialSegments: 16 },
    visible: true,
    locked: false,
  });

  // Energy Reactor Core (Glowing Sphere)
  const coreId = makeId('citadel-reactor');
  items.push({
    id: coreId,
    name: 'Quantum Reactor Core',
    type: 'mesh',
    primitiveType: 'sphere',
    transform: { position: [0, 2.75, 0], rotation: [0, 0, 0], scale: [0.75, 0.75, 0.75] },
    material: createMaterial({
      color: '#06b6d4',
      emissive: '#06b6d4',
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.1,
    }),
    geometryParams: { widthSegments: 24, heightSegments: 24 },
    visible: true,
    locked: false,
  });

  // Tower Spire Top
  const spireId = makeId('citadel-spire');
  items.push({
    id: spireId,
    name: 'Apex Communications Spire',
    type: 'mesh',
    primitiveType: 'cone',
    transform: { position: [0, 5.0, 0], rotation: [0, 0, 0], scale: [0.8, 2.0, 0.8] },
    material: createMaterial({ color: '#1f2937', metalness: 0.95, roughness: 0.15 }),
    geometryParams: { radialSegments: 16 },
    visible: true,
    locked: false,
  });

  // Spire Beacon
  const beaconId = makeId('citadel-beacon');
  items.push({
    id: beaconId,
    name: 'Apex Beacon',
    type: 'mesh',
    primitiveType: 'dodecahedron',
    transform: { position: [0, 6.1, 0], rotation: [0, 0, 0], scale: [0.25, 0.25, 0.25] },
    material: createMaterial({
      color: '#f43f5e',
      emissive: '#f43f5e',
      emissiveIntensity: 3.0,
      roughness: 0.05,
    }),
    visible: true,
    locked: false,
  });

  // Floating Magnetic Ring 1 (Lower, rotates clockwise)
  const ring1Id = makeId('citadel-ring-1');
  items.push({
    id: ring1Id,
    name: 'Levitation Ring Alpha',
    type: 'mesh',
    primitiveType: 'torus',
    transform: { position: [0, 2.0, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 1] },
    material: createMaterial({
      color: '#3b82f6',
      emissive: '#2563eb',
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.2,
    }),
    geometryParams: { radius: 1.8, tube: 0.08, radialSegments: 16, tubularSegments: 36 },
    visible: true,
    locked: false,
  });

  // Floating Magnetic Ring 2 (Upper, rotates counter-clockwise & tilted)
  const ring2Id = makeId('citadel-ring-2');
  items.push({
    id: ring2Id,
    name: 'Levitation Ring Beta',
    type: 'mesh',
    primitiveType: 'torus',
    transform: { position: [0, 3.5, 0], rotation: [Math.PI / 2 + 0.2, 0, 0.1], scale: [1, 1, 1] },
    material: createMaterial({
      color: '#ec4899',
      emissive: '#db2777',
      emissiveIntensity: 0.9,
      metalness: 0.9,
      roughness: 0.2,
    }),
    geometryParams: { radius: 1.4, tube: 0.06, radialSegments: 16, tubularSegments: 36 },
    visible: true,
    locked: false,
  });

  // 4 Ground Foundation Pylons
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const px = Math.cos(angle) * 2.5;
    const pz = Math.sin(angle) * 2.5;
    const pylonId = makeId(`citadel-pylon-${i}`);
    items.push({
      id: pylonId,
      name: `Stabilizer Pylon ${i + 1}`,
      type: 'mesh',
      primitiveType: 'box',
      transform: {
        position: [px, 0.6, pz],
        rotation: [0, -angle, 0.2],
        scale: [0.4, 1.2, 0.8],
      },
      material: createMaterial({ color: '#111827', metalness: 0.8, roughness: 0.4 }),
      visible: true,
      locked: false,
    });
  }

  // Animation Tracks:
  // Ring 1 Clockwise continuous rotation + floating oscillation
  const ring1Keyframes: Keyframe[] = [
    { frame: 0, transform: { position: [0, 2.0, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
    { frame: 60, transform: { position: [0, 2.2, 0], rotation: [Math.PI / 2, Math.PI, 0], scale: [1.03, 1.03, 1.03] }, interpolation: 'linear' },
    { frame: 120, transform: { position: [0, 2.0, 0], rotation: [Math.PI / 2, Math.PI * 2, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
  ];
  tracks.push({ objectId: ring1Id, keyframes: ring1Keyframes });

  // Ring 2 Counter-clockwise rotation + tilted precession
  const ring2Keyframes: Keyframe[] = [
    { frame: 0, transform: { position: [0, 3.5, 0], rotation: [Math.PI / 2 + 0.2, 0, 0.1], scale: [1, 1, 1] }, interpolation: 'linear' },
    { frame: 60, transform: { position: [0, 3.3, 0], rotation: [Math.PI / 2 + 0.2, -Math.PI, -0.1], scale: [0.97, 0.97, 0.97] }, interpolation: 'linear' },
    { frame: 120, transform: { position: [0, 3.5, 0], rotation: [Math.PI / 2 + 0.2, -Math.PI * 2, 0.1], scale: [1, 1, 1] }, interpolation: 'linear' },
  ];
  tracks.push({ objectId: ring2Id, keyframes: ring2Keyframes });

  // Beacon Pulsing scale
  const beaconKeyframes: Keyframe[] = [
    { frame: 0, transform: { position: [0, 6.1, 0], rotation: [0, 0, 0], scale: [0.25, 0.25, 0.25] }, interpolation: 'ease-in-out' },
    { frame: 30, transform: { position: [0, 6.1, 0], rotation: [0, Math.PI / 2, 0], scale: [0.35, 0.35, 0.35] }, interpolation: 'ease-in-out' },
    { frame: 60, transform: { position: [0, 6.1, 0], rotation: [0, Math.PI, 0], scale: [0.25, 0.25, 0.25] }, interpolation: 'ease-in-out' },
    { frame: 90, transform: { position: [0, 6.1, 0], rotation: [0, (Math.PI * 3) / 2, 0], scale: [0.35, 0.35, 0.35] }, interpolation: 'ease-in-out' },
    { frame: 120, transform: { position: [0, 6.1, 0], rotation: [0, Math.PI * 2, 0], scale: [0.25, 0.25, 0.25] }, interpolation: 'ease-in-out' },
  ];
  tracks.push({ objectId: beaconId, keyframes: beaconKeyframes });

  return {
    items,
    tracks,
    environment: {
      preset: 'cyberpunk',
      backgroundColor: '#05070d',
      ambientIntensity: 0.5,
      directionalIntensity: 1.4,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Cyberpunk Citadel: Multi-tiered command spire with counter-rotating levitation rings, quantum core, and pulsing apex beacon.',
  };
}

/**
 * 2. SOLAR SYSTEM ORBITAL ORRERY
 * Accurate multi-body celestial mechanism with synchronized orbital revolution and axial rotation.
 */
export function generateSolarOrrery(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  // Central Sun
  const sunId = makeId('orrery-sun');
  items.push({
    id: sunId,
    name: 'Sol (Sun)',
    type: 'mesh',
    primitiveType: 'sphere',
    transform: { position: [0, 1.2, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2] },
    material: createMaterial({
      color: '#fbbf24',
      emissive: '#f59e0b',
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.1,
    }),
    geometryParams: { widthSegments: 32, heightSegments: 32 },
    visible: true,
    locked: false,
  });

  // Sun axial rotation
  tracks.push({
    objectId: sunId,
    keyframes: [
      { frame: 0, transform: { position: [0, 1.2, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2] }, interpolation: 'linear' },
      { frame: 120, transform: { position: [0, 1.2, 0], rotation: [0, Math.PI * 2, 0], scale: [1.2, 1.2, 1.2] }, interpolation: 'linear' },
    ],
  });

  // Planet specifications: [name, radius, orbitRadius, color, metalness, roughness, speedMult]
  const planets = [
    { name: 'Mercury', r: 0.18, orbit: 2.0, color: '#94a3b8', metal: 0.8, rough: 0.3, speed: 4 },
    { name: 'Venus', r: 0.28, orbit: 3.0, color: '#fde047', metal: 0.4, rough: 0.5, speed: 2 },
    { name: 'Earth', r: 0.32, orbit: 4.2, color: '#38bdf8', metal: 0.3, rough: 0.4, speed: 1 },
    { name: 'Mars', r: 0.22, orbit: 5.4, color: '#ef4444', metal: 0.5, rough: 0.6, speed: 0.7 },
  ];

  // Orbital Guide Rings & Animated Planets
  for (const p of planets) {
    // Orbital Track visual ring
    const ringId = makeId(`orbit-ring-${p.name.toLowerCase()}`);
    items.push({
      id: ringId,
      name: `${p.name} Orbit Path`,
      type: 'mesh',
      primitiveType: 'torus',
      transform: { position: [0, 1.2, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 1] },
      material: createMaterial({
        color: '#475569',
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.35,
      }),
      geometryParams: { radius: p.orbit, tube: 0.015, radialSegments: 8, tubularSegments: 64 },
      visible: true,
      locked: true,
    });

    // Planet body
    const planetId = makeId(`planet-${p.name.toLowerCase()}`);
    const initX = p.orbit;
    items.push({
      id: planetId,
      name: p.name,
      type: 'mesh',
      primitiveType: 'sphere',
      transform: { position: [initX, 1.2, 0], rotation: [0, 0, 0.15], scale: [p.r, p.r, p.r] },
      material: createMaterial({
        color: p.color,
        roughness: p.rough,
        metalness: p.metal,
      }),
      geometryParams: { widthSegments: 20, heightSegments: 20 },
      visible: true,
      locked: false,
    });

    // Keyframed Orbital Revolution around Sun
    const totalFrames = 120;
    const step = 15; // 8 keyframes around circular orbit
    const kfs: Keyframe[] = [];

    for (let f = 0; f <= totalFrames; f += step) {
      const angle = (f / totalFrames) * Math.PI * 2 * p.speed;
      const px = Math.cos(angle) * p.orbit;
      const pz = Math.sin(angle) * p.orbit;
      kfs.push({
        frame: f,
        transform: {
          position: [Number(px.toFixed(4)), 1.2, Number(pz.toFixed(4))],
          rotation: [0, angle * 3, 0.15],
          scale: [p.r, p.r, p.r],
        },
        interpolation: 'linear',
      });
    }
    tracks.push({ objectId: planetId, keyframes: kfs });
  }

  // Saturn with majestic ring
  const saturnOrbit = 6.8;
  const saturnRingId = makeId('orbit-ring-saturn');
  items.push({
    id: saturnRingId,
    name: 'Saturn Orbit Path',
    type: 'mesh',
    primitiveType: 'torus',
    transform: { position: [0, 1.2, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 1] },
    material: createMaterial({ color: '#475569', opacity: 0.25, transparent: true }),
    geometryParams: { radius: saturnOrbit, tube: 0.015, radialSegments: 8, tubularSegments: 64 },
    visible: true,
    locked: true,
  });

  const saturnId = makeId('planet-saturn');
  items.push({
    id: saturnId,
    name: 'Saturn & Ring System',
    type: 'mesh',
    primitiveType: 'sphere',
    transform: { position: [saturnOrbit, 1.2, 0], rotation: [0.35, 0, 0.1], scale: [0.55, 0.55, 0.55] },
    material: createMaterial({ color: '#fcd34d', roughness: 0.4, metalness: 0.2 }),
    geometryParams: { widthSegments: 24, heightSegments: 24 },
    visible: true,
    locked: false,
  });

  const saturnKfs: Keyframe[] = [];
  for (let f = 0; f <= 120; f += 20) {
    const angle = (f / 120) * Math.PI * 2 * 0.5;
    saturnKfs.push({
      frame: f,
      transform: {
        position: [Number((Math.cos(angle) * saturnOrbit).toFixed(4)), 1.2, Number((Math.sin(angle) * saturnOrbit).toFixed(4))],
        rotation: [0.35, angle * 2, 0.1],
        scale: [0.55, 0.55, 0.55],
      },
      interpolation: 'linear',
    });
  }
  tracks.push({ objectId: saturnId, keyframes: saturnKfs });

  return {
    items,
    tracks,
    environment: {
      preset: 'studio',
      backgroundColor: '#02040a',
      ambientIntensity: 0.3,
      directionalIntensity: 1.0,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Solar System Orrery: Synchronized orbital mechanics with rotating Sun, Keplerian planetary orbits, and planetary axial tilt.',
  };
}

/**
 * 3. PROCEDURAL CASTLE FORTRESS
 * Fully architected modular medieval fortress with corner watchtowers, curtain walls, battlements, and keep.
 */
export function generateCastleFortress(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  const wallMat = createMaterial({ color: '#64748b', roughness: 0.85, metalness: 0.1 });
  const roofMat = createMaterial({ color: '#991b1b', roughness: 0.6, metalness: 0.15 });
  const woodMat = createMaterial({ color: '#78350f', roughness: 0.9, metalness: 0.05 });

  const halfSize = 2.5;

  // 4 Corner Towers (Cylinders + Conical Roofs)
  const towerPositions = [
    [-halfSize, halfSize],
    [halfSize, halfSize],
    [halfSize, -halfSize],
    [-halfSize, -halfSize],
  ];

  towerPositions.forEach(([x, z], idx) => {
    const towerBodyId = makeId(`castle-tower-body-${idx}`);
    items.push({
      id: towerBodyId,
      name: `Corner Tower ${idx + 1}`,
      type: 'mesh',
      primitiveType: 'cylinder',
      transform: { position: [x, 1.5, z], rotation: [0, 0, 0], scale: [0.7, 3.0, 0.7] },
      material: wallMat,
      geometryParams: { radialSegments: 16 },
      visible: true,
      locked: false,
    });

    const towerRoofId = makeId(`castle-tower-roof-${idx}`);
    items.push({
      id: towerRoofId,
      name: `Tower Roof ${idx + 1}`,
      type: 'mesh',
      primitiveType: 'cone',
      transform: { position: [x, 3.5, z], rotation: [0, 0, 0], scale: [0.85, 1.2, 0.85] },
      material: roofMat,
      geometryParams: { radialSegments: 16 },
      visible: true,
      locked: false,
    });
  });

  // 4 Curtain Walls connecting towers
  const walls = [
    { pos: [0, 1.0, halfSize], rot: [0, 0, 0], scale: [halfSize * 2 - 0.8, 2.0, 0.35], name: 'North Curtain Wall' },
    { pos: [0, 1.0, -halfSize], rot: [0, 0, 0], scale: [halfSize * 2 - 0.8, 2.0, 0.35], name: 'South Curtain Wall' },
    { pos: [halfSize, 1.0, 0], rot: [0, Math.PI / 2, 0], scale: [halfSize * 2 - 0.8, 2.0, 0.35], name: 'East Curtain Wall' },
    { pos: [-halfSize, 1.0, 0], rot: [0, Math.PI / 2, 0], scale: [halfSize * 2 - 0.8, 2.0, 0.35], name: 'West Curtain Wall' },
  ];

  walls.forEach((w) => {
    items.push({
      id: makeId('castle-wall'),
      name: w.name,
      type: 'mesh',
      primitiveType: 'box',
      transform: {
        position: w.pos as [number, number, number],
        rotation: w.rot as [number, number, number],
        scale: w.scale as [number, number, number],
      },
      material: wallMat,
      visible: true,
      locked: false,
    });
  });

  // Central Keep (Donjon)
  const keepBaseId = makeId('castle-keep-base');
  items.push({
    id: keepBaseId,
    name: 'Royal Keep Donjon',
    type: 'mesh',
    primitiveType: 'box',
    transform: { position: [0, 2.0, 0], rotation: [0, 0, 0], scale: [2.0, 4.0, 2.0] },
    material: wallMat,
    visible: true,
    locked: false,
  });

  const keepRoofId = makeId('castle-keep-roof');
  items.push({
    id: keepRoofId,
    name: 'Keep Citadel Roof',
    type: 'mesh',
    primitiveType: 'cone',
    transform: { position: [0, 4.6, 0], rotation: [0, Math.PI / 4, 0], scale: [1.8, 1.4, 1.8] },
    material: roofMat,
    geometryParams: { radialSegments: 4 }, // 4-sided pyramid roof
    visible: true,
    locked: false,
  });

  // Gatehouse entrance archway
  const gateId = makeId('castle-gate');
  items.push({
    id: gateId,
    name: 'Reinforced Gatehouse Portal',
    type: 'mesh',
    primitiveType: 'box',
    transform: { position: [0, 0.6, halfSize + 0.15], rotation: [0, 0, 0], scale: [1.0, 1.2, 0.2] },
    material: woodMat,
    visible: true,
    locked: false,
  });

  // Turntable inspection animation on keep
  tracks.push({
    objectId: keepBaseId,
    keyframes: [
      { frame: 0, transform: { position: [0, 2.0, 0], rotation: [0, 0, 0], scale: [2.0, 4.0, 2.0] }, interpolation: 'linear' },
      { frame: 120, transform: { position: [0, 2.0, 0], rotation: [0, Math.PI * 2, 0], scale: [2.0, 4.0, 2.0] }, interpolation: 'linear' },
    ],
  });

  return {
    items,
    tracks,
    environment: {
      preset: 'dawn',
      backgroundColor: '#111827',
      ambientIntensity: 0.7,
      directionalIntensity: 1.3,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Castle Fortress: Medieval stone citadel with four corner parapet towers, battlements, central keep, and reinforced portcullis gate.',
  };
}

/**
 * 4. ARTICULATED KINETIC MECH / ROBOT
 * Articulated bipedal mech with torso, head, shoulder joints, arms, hips, and walking gait keyframes.
 */
export function generateKineticMech(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  const armorMat = createMaterial({ color: '#2563eb', metalness: 0.8, roughness: 0.3 });
  const darkMetal = createMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.25 });
  const glowMat = createMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 2.0, roughness: 0.1 });

  // Pelvis / Core Hip
  const pelvisId = makeId('mech-pelvis');
  items.push({
    id: pelvisId,
    name: 'Mech Pelvis Hub',
    type: 'mesh',
    primitiveType: 'box',
    transform: { position: [0, 1.8, 0], rotation: [0, 0, 0], scale: [0.8, 0.4, 0.6] },
    material: darkMetal,
    visible: true,
    locked: false,
  });

  // Torso / Cockpit
  const torsoId = makeId('mech-torso');
  items.push({
    id: torsoId,
    name: 'Chassis Torso',
    type: 'mesh',
    primitiveType: 'box',
    transform: { position: [0, 2.6, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 0.9] },
    material: armorMat,
    visible: true,
    locked: false,
  });

  // Head
  const headId = makeId('mech-head');
  items.push({
    id: headId,
    name: 'Command Head Unit',
    type: 'mesh',
    primitiveType: 'dodecahedron',
    transform: { position: [0, 3.45, 0.1], rotation: [0, 0, 0], scale: [0.4, 0.4, 0.4] },
    material: darkMetal,
    visible: true,
    locked: false,
  });

  // Visor Sensor (Glow)
  const visorId = makeId('mech-visor');
  items.push({
    id: visorId,
    name: 'Optic Visor',
    type: 'mesh',
    primitiveType: 'box',
    transform: { position: [0, 3.45, 0.42], rotation: [0, 0, 0], scale: [0.35, 0.08, 0.05] },
    material: glowMat,
    visible: true,
    locked: false,
  });

  // Left & Right Arms
  const armConfigs = [
    { side: 'Left', x: -0.9, sign: -1 },
    { side: 'Right', x: 0.9, sign: 1 },
  ];

  armConfigs.forEach(({ side, x, sign }) => {
    // Shoulder Pauldron
    const shoulderId = makeId(`mech-shoulder-${side.toLowerCase()}`);
    items.push({
      id: shoulderId,
      name: `${side} Shoulder Pauldron`,
      type: 'mesh',
      primitiveType: 'sphere',
      transform: { position: [x, 2.9, 0], rotation: [0, 0, 0], scale: [0.35, 0.35, 0.35] },
      material: darkMetal,
      visible: true,
      locked: false,
    });

    // Arm Limb
    const armId = makeId(`mech-arm-${side.toLowerCase()}`);
    items.push({
      id: armId,
      name: `${side} Arm Cannon`,
      type: 'mesh',
      primitiveType: 'cylinder',
      transform: { position: [x, 2.2, 0], rotation: [0, 0, sign * 0.1], scale: [0.18, 1.0, 0.18] },
      material: armorMat,
      visible: true,
      locked: false,
    });

    // Arm counter-swing keyframe animation
    tracks.push({
      objectId: armId,
      keyframes: [
        { frame: 0, transform: { position: [x, 2.2, 0], rotation: [sign * 0.35, 0, sign * 0.1], scale: [0.18, 1.0, 0.18] }, interpolation: 'ease-in-out' },
        { frame: 30, transform: { position: [x, 2.2, 0], rotation: [0, 0, sign * 0.1], scale: [0.18, 1.0, 0.18] }, interpolation: 'ease-in-out' },
        { frame: 60, transform: { position: [x, 2.2, 0], rotation: [-sign * 0.35, 0, sign * 0.1], scale: [0.18, 1.0, 0.18] }, interpolation: 'ease-in-out' },
        { frame: 90, transform: { position: [x, 2.2, 0], rotation: [0, 0, sign * 0.1], scale: [0.18, 1.0, 0.18] }, interpolation: 'ease-in-out' },
        { frame: 120, transform: { position: [x, 2.2, 0], rotation: [sign * 0.35, 0, sign * 0.1], scale: [0.18, 1.0, 0.18] }, interpolation: 'ease-in-out' },
      ],
    });
  });

  // Left & Right Legs
  const legConfigs = [
    { side: 'Left', x: -0.45, phase: 1 },
    { side: 'Right', x: 0.45, phase: -1 },
  ];

  legConfigs.forEach(({ side, x, phase }) => {
    const legId = makeId(`mech-leg-${side.toLowerCase()}`);
    items.push({
      id: legId,
      name: `${side} Bipedal Strut`,
      type: 'mesh',
      primitiveType: 'cylinder',
      transform: { position: [x, 0.9, 0], rotation: [0, 0, 0], scale: [0.22, 1.6, 0.22] },
      material: darkMetal,
      visible: true,
      locked: false,
    });

    const footId = makeId(`mech-foot-${side.toLowerCase()}`);
    items.push({
      id: footId,
      name: `${side} Stabilizer Foot`,
      type: 'mesh',
      primitiveType: 'box',
      transform: { position: [x, 0.1, 0.15], rotation: [0, 0, 0], scale: [0.45, 0.2, 0.7] },
      material: armorMat,
      visible: true,
      locked: false,
    });

    // Leg stride walk-cycle keyframes
    tracks.push({
      objectId: legId,
      keyframes: [
        { frame: 0, transform: { position: [x, 0.9, phase * 0.2], rotation: [-phase * 0.3, 0, 0], scale: [0.22, 1.6, 0.22] }, interpolation: 'ease-in-out' },
        { frame: 30, transform: { position: [x, 1.05, 0], rotation: [0, 0, 0], scale: [0.22, 1.6, 0.22] }, interpolation: 'ease-in-out' },
        { frame: 60, transform: { position: [x, 0.9, -phase * 0.2], rotation: [phase * 0.3, 0, 0], scale: [0.22, 1.6, 0.22] }, interpolation: 'ease-in-out' },
        { frame: 90, transform: { position: [x, 0.85, 0], rotation: [0, 0, 0], scale: [0.22, 1.6, 0.22] }, interpolation: 'ease-in-out' },
        { frame: 120, transform: { position: [x, 0.9, phase * 0.2], rotation: [-phase * 0.3, 0, 0], scale: [0.22, 1.6, 0.22] }, interpolation: 'ease-in-out' },
      ],
    });
  });

  // Torso subtle breathing/bobbing
  tracks.push({
    objectId: torsoId,
    keyframes: [
      { frame: 0, transform: { position: [0, 2.6, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 0.9] }, interpolation: 'ease-in-out' },
      { frame: 30, transform: { position: [0, 2.68, 0], rotation: [0.03, 0.05, 0], scale: [1.2, 1.2, 0.9] }, interpolation: 'ease-in-out' },
      { frame: 60, transform: { position: [0, 2.6, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 0.9] }, interpolation: 'ease-in-out' },
      { frame: 90, transform: { position: [0, 2.68, 0], rotation: [0.03, -0.05, 0], scale: [1.2, 1.2, 0.9] }, interpolation: 'ease-in-out' },
      { frame: 120, transform: { position: [0, 2.6, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 0.9] }, interpolation: 'ease-in-out' },
    ],
  });

  return {
    items,
    tracks,
    environment: {
      preset: 'cyberpunk',
      backgroundColor: '#0a0d14',
      ambientIntensity: 0.6,
      directionalIntensity: 1.4,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Kinetic Mech: Fully articulated bipedal chassis with walking cycle keyframes, counter-swinging arms, and glowing visor.',
  };
}

/**
 * 5. PARAMETRIC DOUBLE-HELIX DNA MONUMENT
 * Mathematically precise double helix with phosphodiester backbone strands and colored nitrogenous base-pairs.
 */
export function generateDNAHelix(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  const strandMat1 = createMaterial({ color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.2 });
  const strandMat2 = createMaterial({ color: '#ec4899', emissive: '#db2777', emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.2 });
  const rungMatAT = createMaterial({ color: '#10b981', metalness: 0.5, roughness: 0.3 });
  const rungMatGC = createMaterial({ color: '#f59e0b', metalness: 0.5, roughness: 0.3 });

  const totalSteps = 24;
  const heightTotal = 6.0;
  const radius = 1.2;
  const turns = 2.0;

  for (let i = 0; i < totalSteps; i++) {
    const fraction = i / totalSteps;
    const y = fraction * heightTotal + 0.3;
    const angle = fraction * Math.PI * 2 * turns;

    const x1 = Math.cos(angle) * radius;
    const z1 = Math.sin(angle) * radius;

    const x2 = Math.cos(angle + Math.PI) * radius;
    const z2 = Math.sin(angle + Math.PI) * radius;

    // Node 1
    const node1Id = makeId(`dna-node1-${i}`);
    items.push({
      id: node1Id,
      name: `Strand A Node ${i + 1}`,
      type: 'mesh',
      primitiveType: 'sphere',
      transform: { position: [x1, y, z1], rotation: [0, 0, 0], scale: [0.2, 0.2, 0.2] },
      material: strandMat1,
      visible: true,
      locked: false,
    });

    // Node 2
    const node2Id = makeId(`dna-node2-${i}`);
    items.push({
      id: node2Id,
      name: `Strand B Node ${i + 1}`,
      type: 'mesh',
      primitiveType: 'sphere',
      transform: { position: [x2, y, z2], rotation: [0, 0, 0], scale: [0.2, 0.2, 0.2] },
      material: strandMat2,
      visible: true,
      locked: false,
    });

    // Horizontal Bridge Rung (Cylinder connecting x1,z1 to x2,z2)
    const rungId = makeId(`dna-rung-${i}`);
    items.push({
      id: rungId,
      name: `Base Pair Rung ${i + 1}`,
      type: 'mesh',
      primitiveType: 'cylinder',
      transform: {
        position: [0, y, 0],
        rotation: [0, -angle, Math.PI / 2],
        scale: [0.06, radius * 2, 0.06],
      },
      material: i % 2 === 0 ? rungMatAT : rungMatGC,
      visible: true,
      locked: false,
    });

    // Continuous 360° rotation keyframes for every node
    const kfs1: Keyframe[] = [];
    const kfs2: Keyframe[] = [];
    const kfsR: Keyframe[] = [];

    for (let f = 0; f <= 120; f += 30) {
      const rotAngle = (f / 120) * Math.PI * 2;
      const curA = angle + rotAngle;
      kfs1.push({
        frame: f,
        transform: {
          position: [Number((Math.cos(curA) * radius).toFixed(4)), y, Number((Math.sin(curA) * radius).toFixed(4))],
          rotation: [0, rotAngle, 0],
          scale: [0.2, 0.2, 0.2],
        },
        interpolation: 'linear',
      });
      kfs2.push({
        frame: f,
        transform: {
          position: [Number((Math.cos(curA + Math.PI) * radius).toFixed(4)), y, Number((Math.sin(curA + Math.PI) * radius).toFixed(4))],
          rotation: [0, rotAngle, 0],
          scale: [0.2, 0.2, 0.2],
        },
        interpolation: 'linear',
      });
      kfsR.push({
        frame: f,
        transform: {
          position: [0, y, 0],
          rotation: [0, -curA, Math.PI / 2],
          scale: [0.06, radius * 2, 0.06],
        },
        interpolation: 'linear',
      });
    }

    tracks.push({ objectId: node1Id, keyframes: kfs1 });
    tracks.push({ objectId: node2Id, keyframes: kfs2 });
    tracks.push({ objectId: rungId, keyframes: kfsR });
  }

  return {
    items,
    tracks,
    environment: {
      preset: 'studio',
      backgroundColor: '#030712',
      ambientIntensity: 0.6,
      directionalIntensity: 1.5,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Double Helix DNA Monument: 24 paired nucleotide rungs twisting along a parametric helix with continuous kinetic rotation.',
  };
}

/**
 * 6. PROCEDURAL LOW-POLY BIOME / FOREST
 * Natural landscape with terrain grid, multi-tiered pine trees, and mossy monoliths.
 */
export function generateProceduralBiome(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  const groundMat = createMaterial({ color: '#15803d', roughness: 0.95, metalness: 0.05 });
  const trunkMat = createMaterial({ color: '#78350f', roughness: 0.9, metalness: 0.05 });
  const needleMat1 = createMaterial({ color: '#166534', roughness: 0.8, metalness: 0.1 });
  const needleMat2 = createMaterial({ color: '#14532d', roughness: 0.8, metalness: 0.1 });
  const rockMat = createMaterial({ color: '#475569', roughness: 0.7, metalness: 0.2 });

  // Undulating Terrain Ground Plane
  items.push({
    id: makeId('biome-ground'),
    name: 'Forest Meadow Bed',
    type: 'mesh',
    primitiveType: 'plane',
    transform: { position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0], scale: [12, 12, 1] },
    material: groundMat,
    geometryParams: { widthSegments: 16, heightSegments: 16 },
    modifiers: [{ id: makeId('mod-noise'), type: 'noise_displace', factor: 0.2, enabled: true }],
    visible: true,
    locked: true,
  });

  // Pine tree positions & scales
  const trees = [
    { x: -2.5, z: -1.5, scale: 1.1 },
    { x: -1.0, z: 2.0, scale: 0.85 },
    { x: 1.8, z: -2.2, scale: 1.3 },
    { x: 2.2, z: 1.2, scale: 0.9 },
    { x: 0.0, z: -3.0, scale: 1.0 },
    { x: -3.2, z: 1.8, scale: 0.75 },
    { x: 3.0, z: -0.5, scale: 1.15 },
  ];

  trees.forEach((t, idx) => {
    // Tree Trunk
    const trunkId = makeId(`tree-trunk-${idx}`);
    items.push({
      id: trunkId,
      name: `Pine Trunk ${idx + 1}`,
      type: 'mesh',
      primitiveType: 'cylinder',
      transform: {
        position: [t.x, 0.4 * t.scale, t.z],
        rotation: [0, 0, 0],
        scale: [0.15 * t.scale, 0.8 * t.scale, 0.15 * t.scale],
      },
      material: trunkMat,
      visible: true,
      locked: false,
    });

    // 3 Conical Canopy Tiers
    const canopyTiers = [
      { yOffset: 0.9, s: 1.0, mat: needleMat1 },
      { yOffset: 1.4, s: 0.8, mat: needleMat2 },
      { yOffset: 1.85, s: 0.6, mat: needleMat1 },
    ];

    canopyTiers.forEach((tier, tierIdx) => {
      const coneId = makeId(`tree-canopy-${idx}-${tierIdx}`);
      const basePos: [number, number, number] = [t.x, tier.yOffset * t.scale, t.z];
      items.push({
        id: coneId,
        name: `Tree ${idx + 1} Foliage Tier ${tierIdx + 1}`,
        type: 'mesh',
        primitiveType: 'cone',
        transform: {
          position: basePos,
          rotation: [0, 0, 0],
          scale: [0.8 * tier.s * t.scale, 0.9 * t.scale, 0.8 * tier.s * t.scale],
        },
        material: tier.mat,
        geometryParams: { radialSegments: 7 }, // Low poly stylized aesthetic
        visible: true,
        locked: false,
      });

      // Gentle wind breeze sway animation
      tracks.push({
        objectId: coneId,
        keyframes: [
          { frame: 0, transform: { position: basePos, rotation: [0, 0, 0], scale: [0.8 * tier.s * t.scale, 0.9 * t.scale, 0.8 * tier.s * t.scale] }, interpolation: 'ease-in-out' },
          { frame: 40, transform: { position: [t.x + 0.05, basePos[1], t.z], rotation: [0.03, 0, 0.05], scale: [0.8 * tier.s * t.scale, 0.9 * t.scale, 0.8 * tier.s * t.scale] }, interpolation: 'ease-in-out' },
          { frame: 80, transform: { position: [t.x - 0.05, basePos[1], t.z], rotation: [-0.03, 0, -0.05], scale: [0.8 * tier.s * t.scale, 0.9 * t.scale, 0.8 * tier.s * t.scale] }, interpolation: 'ease-in-out' },
          { frame: 120, transform: { position: basePos, rotation: [0, 0, 0], scale: [0.8 * tier.s * t.scale, 0.9 * t.scale, 0.8 * tier.s * t.scale] }, interpolation: 'ease-in-out' },
        ],
      });
    });
  });

  // Scattered Boulders / Monoliths
  const rocks = [
    { x: -0.5, z: 0.5, scale: [0.6, 0.45, 0.5], rot: [0.2, 0.4, 0.1] },
    { x: 1.2, z: 0.2, scale: [0.4, 0.35, 0.4], rot: [-0.1, 0.8, 0.3] },
    { x: -1.8, z: -0.8, scale: [0.7, 0.55, 0.6], rot: [0.3, -0.5, 0.2] },
  ];

  rocks.forEach((r, idx) => {
    items.push({
      id: makeId(`biome-rock-${idx}`),
      name: `Mossy Monolith ${idx + 1}`,
      type: 'mesh',
      primitiveType: 'dodecahedron',
      transform: {
        position: [r.x, r.scale[1] / 2, r.z],
        rotation: r.rot as [number, number, number],
        scale: r.scale as [number, number, number],
      },
      material: rockMat,
      visible: true,
      locked: false,
    });
  });

  return {
    items,
    tracks,
    environment: {
      preset: 'sunset',
      backgroundColor: '#1c1917',
      ambientIntensity: 0.8,
      directionalIntensity: 1.5,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Low-Poly Biome: Atmospheric pine forest with multi-tiered stylized canopies, undulating terrain, wind sway animation, and mossy monoliths.',
  };
}

/**
 * 7. PARAMETRIC SPIRAL PAVILION
 * Spiral staircase wrapping around a central core with observation cupola.
 */
export function generateSpiralPavilion(): ProceduralGenerationResult {
  const items: SceneItem[] = [];
  const tracks: AnimationTrack[] = [];

  const marbleMat = createMaterial({ color: '#f8fafc', roughness: 0.2, metalness: 0.1 });
  const goldMat = createMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.2 });
  const platformMat = createMaterial({ color: '#0284c7', emissive: '#0369a1', emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.2 });

  // Central Core Pillar
  const coreId = makeId('pavilion-core');
  items.push({
    id: coreId,
    name: 'Central Pillar',
    type: 'mesh',
    primitiveType: 'cylinder',
    transform: { position: [0, 2.5, 0], rotation: [0, 0, 0], scale: [0.6, 5.0, 0.6] },
    material: marbleMat,
    geometryParams: { radialSegments: 20 },
    visible: true,
    locked: false,
  });

  // Spiral Steps
  const stepCount = 18;
  const totalHeight = 4.0;
  const spiralRadius = 1.6;

  for (let i = 0; i < stepCount; i++) {
    const fraction = i / stepCount;
    const angle = fraction * Math.PI * 2;
    const y = fraction * totalHeight + 0.15;
    const stepX = Math.cos(angle) * (spiralRadius / 2);
    const stepZ = Math.sin(angle) * (spiralRadius / 2);

    items.push({
      id: makeId(`pavilion-step-${i}`),
      name: `Spiral Step ${i + 1}`,
      type: 'mesh',
      primitiveType: 'box',
      transform: {
        position: [stepX, y, stepZ],
        rotation: [0, -angle, 0],
        scale: [spiralRadius, 0.08, 0.35],
      },
      material: marbleMat,
      visible: true,
      locked: false,
    });
  }

  // Upper Observation Platform
  const deckId = makeId('pavilion-deck');
  items.push({
    id: deckId,
    name: 'Apex Observation Deck',
    type: 'mesh',
    primitiveType: 'cylinder',
    transform: { position: [0, totalHeight + 0.3, 0], rotation: [0, 0, 0], scale: [2.5, 0.2, 2.5] },
    material: platformMat,
    geometryParams: { radialSegments: 24 },
    visible: true,
    locked: false,
  });

  // Domed Canopy
  const domeId = makeId('pavilion-dome');
  items.push({
    id: domeId,
    name: 'Celestial Cupola',
    type: 'mesh',
    primitiveType: 'sphere',
    transform: { position: [0, totalHeight + 1.6, 0], rotation: [0, 0, 0], scale: [1.8, 0.9, 1.8] },
    material: goldMat,
    geometryParams: { widthSegments: 24, heightSegments: 16 },
    visible: true,
    locked: false,
  });

  // Animated ascending elevator platform
  const liftId = makeId('pavilion-lift');
  items.push({
    id: liftId,
    name: 'Kinetic Ascender Lift',
    type: 'mesh',
    primitiveType: 'cylinder',
    transform: { position: [spiralRadius, 0.2, 0], rotation: [0, 0, 0], scale: [0.6, 0.1, 0.6] },
    material: goldMat,
    visible: true,
    locked: false,
  });

  const liftKfs: Keyframe[] = [
    { frame: 0, transform: { position: [spiralRadius, 0.2, 0], rotation: [0, 0, 0], scale: [0.6, 0.1, 0.6] }, interpolation: 'ease-in-out' },
    { frame: 60, transform: { position: [spiralRadius, totalHeight + 0.2, 0], rotation: [0, Math.PI * 2, 0], scale: [0.6, 0.1, 0.6] }, interpolation: 'ease-in-out' },
    { frame: 120, transform: { position: [spiralRadius, 0.2, 0], rotation: [0, Math.PI * 4, 0], scale: [0.6, 0.1, 0.6] }, interpolation: 'ease-in-out' },
  ];
  tracks.push({ objectId: liftId, keyframes: liftKfs });

  return {
    items,
    tracks,
    environment: {
      preset: 'dawn',
      backgroundColor: '#0f172a',
      ambientIntensity: 0.65,
      directionalIntensity: 1.4,
      showGrid: true,
      shadows: true,
    },
    timeline: { totalFrames: 120, fps: 30 },
    description: 'Spiral Pavilion: Classical parametric helical staircase, marble colonnade, golden cupola dome, and ascending kinetic lift platform.',
  };
}

/**
 * Registry of all available deeply architected procedural templates.
 */
export const PROCEDURAL_TEMPLATES: Record<ProceduralTemplateId, ProceduralTemplate> = {
  'sci-fi-citadel': {
    id: 'sci-fi-citadel',
    name: 'Cyberpunk Citadel',
    category: 'Sci-Fi',
    description: 'Towering futuristic spire with counter-rotating magnetic levitation rings, quantum core, and pulsing apex beacon.',
    tags: ['cyberpunk', 'futuristic', 'tower', 'spire', 'levitation', 'animation'],
    generate: generateSciFiCitadel,
  },
  'solar-orrery': {
    id: 'solar-orrery',
    name: 'Solar System Orrery',
    category: 'Astronomy',
    description: 'Accurate multi-body astronomical mechanism with orbiting planets, axial rotation, and Saturnian ring system.',
    tags: ['astronomy', 'space', 'planets', 'solar-system', 'orrery', 'orbit'],
    generate: generateSolarOrrery,
  },
  'castle-fortress': {
    id: 'castle-fortress',
    name: 'Medieval Castle Fortress',
    category: 'Architecture',
    description: 'Stone fortress with four corner watchtowers, crenellated curtain walls, gatehouse portal, and central keep.',
    tags: ['medieval', 'castle', 'fortress', 'architecture', 'historical'],
    generate: generateCastleFortress,
  },
  'kinetic-mech': {
    id: 'kinetic-mech',
    name: 'Articulated Kinetic Mech',
    category: 'Robotics',
    description: 'Bipedal battle mech with articulated chassis, glowing optic visor, and synchronized walking gait cycle.',
    tags: ['robot', 'mech', 'robotics', 'bipedal', 'walk-cycle', 'scifi'],
    generate: generateKineticMech,
  },
  'dna-helix': {
    id: 'dna-helix',
    name: 'Double-Helix DNA Monument',
    category: 'Kinetics',
    description: 'Parametric double helix with 24 paired nucleotide rungs and continuous 360° synchronized rotation.',
    tags: ['biology', 'dna', 'helix', 'molecular', 'kinetic', 'science'],
    generate: generateDNAHelix,
  },
  'procedural-biome': {
    id: 'procedural-biome',
    name: 'Low-Poly Forest Biome',
    category: 'Nature',
    description: 'Undulating terrain with stylized multi-tiered pine trees, natural wind sway keyframes, and mossy monoliths.',
    tags: ['nature', 'forest', 'trees', 'landscape', 'lowpoly', 'biome'],
    generate: generateProceduralBiome,
  },
  'spiral-pavilion': {
    id: 'spiral-pavilion',
    name: 'Parametric Spiral Pavilion',
    category: 'Architecture',
    description: 'Helical staircase wrapping around central marble core with apex observation deck and kinetic lift platform.',
    tags: ['architecture', 'spiral', 'stairs', 'pavilion', 'classical', 'parametric'],
    generate: generateSpiralPavilion,
  },
  'realistic-bicycle': {
    id: 'realistic-bicycle',
    name: 'Realistic Road Bicycle',
    category: 'Mechanical',
    description: 'Mechanically precise road bicycle with diamond frame, drop handlebars, 32-spoke laced wheels, 11-speed drivetrain, continuous roller chain, disc brakes, and routed control cables.',
    tags: ['bicycle', 'bike', 'cycle', 'road-bike', 'vehicle', 'mechanical', 'drivetrain'],
    generate: () => {
      const result = generateRealisticBicycle();
      return {
        description: 'Ultra-realistic mechanically precise 3D road bicycle with diamond frame, drop handlebars, laced wheels, 11-speed drivetrain, continuous roller chain, disc brakes, and routed control cables.',
        items: result.allItems,
        tracks: [],
        timeline: {
          currentFrame: 0,
          totalFrames: 120,
          fps: 30,
          isPlaying: false,
          isLooping: true,
          autoKeying: false,
        },
        environment: {
          backgroundColor: '#0f172a',
          ambientIntensity: 0.7,
          directionalIntensity: 1.4,
          showGrid: true,
          showAxes: true,
          shadows: true,
          preset: 'studio',
        },
      };
    },
  },
  'realistic-human': {
    id: 'realistic-human',
    name: 'Realistic Anatomical Human',
    category: 'Character',
    description: 'Procedurally generated realistic 3D human model with anatomical 7.8-head proportions (~1.78m tall), layered clothing (jacket/shirt, jeans trousers), footwear, and accessories (glasses, wristwatch, belt).',
    tags: ['human', 'person', 'character', 'man', 'woman', 'avatar', 'body', 'anatomy', 'clothes', 'garment'],
    generate: () => {
      const result = generateRealisticHumanScene();
      return {
        description: 'Ultra-realistic procedurally synthesized 3D human character with 7.8-head anatomical proportions (~1.78m height), layered jacket, denim jeans, sneakers, sunglasses, wristwatch, and belt.',
        items: result.allItems,
        tracks: [],
        timeline: {
          currentFrame: 0,
          totalFrames: 120,
          fps: 30,
          isPlaying: false,
          isLooping: true,
          autoKeying: false,
        },
        environment: {
          backgroundColor: '#ffffff',
          ambientIntensity: 0.8,
          directionalIntensity: 1.5,
          showGrid: true,
          showAxes: true,
          shadows: true,
          preset: 'studio',
        },
      };
    },
  },
};

/**
 * Resolves a natural language query or keyword into the best-matching procedural generator.
 */
export function matchProceduralTemplate(query: string): ProceduralTemplate {
  const q = query.toLowerCase();

  if (q.includes('human') || q.includes('person') || q.includes('character') || q.includes('man') || q.includes('woman') || q.includes('avatar') || q.includes('anatomy') || q.includes('body') || q.includes('people')) {
    return PROCEDURAL_TEMPLATES['realistic-human'];
  }
  if (q.includes('bike') || q.includes('bicycle') || q.includes('cycle') || q.includes('cycling') || q.includes('drivetrain')) {
    return PROCEDURAL_TEMPLATES['realistic-bicycle'];
  }
  if (q.includes('solar') || q.includes('planet') || q.includes('space') || q.includes('orrery') || q.includes('sun')) {
    return PROCEDURAL_TEMPLATES['solar-orrery'];
  }
  if (q.includes('castle') || q.includes('fortress') || q.includes('tower') && q.includes('stone') || q.includes('medieval')) {
    return PROCEDURAL_TEMPLATES['castle-fortress'];
  }
  if (q.includes('robot') || q.includes('mech') || q.includes('walk') || q.includes('biped') || q.includes('cyborg')) {
    return PROCEDURAL_TEMPLATES['kinetic-mech'];
  }
  if (q.includes('dna') || q.includes('helix') || q.includes('gene') || q.includes('molecule') || q.includes('spiral monument')) {
    return PROCEDURAL_TEMPLATES['dna-helix'];
  }
  if (q.includes('forest') || q.includes('tree') || q.includes('nature') || q.includes('biome') || q.includes('terrain') || q.includes('pine')) {
    return PROCEDURAL_TEMPLATES['procedural-biome'];
  }
  if (q.includes('stair') || q.includes('pavilion') || q.includes('classical') || q.includes('helical')) {
    return PROCEDURAL_TEMPLATES['spiral-pavilion'];
  }

  // Default to the flagship Sci-Fi Citadel
  return PROCEDURAL_TEMPLATES['sci-fi-citadel'];
}
