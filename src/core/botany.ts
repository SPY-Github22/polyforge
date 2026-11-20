import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';

export interface BotanicalTreeOptions {
  seed?: number;
  trunkHeight?: number;       // overall height, default ~9.0
  trunkRadius?: number;       // base radius, default ~0.38
  crownSpread?: number;       // canopy spread radius, default ~5.2
  scaffoldBranches?: number;  // count of major limbs, default 6
  radialSegments?: number;    // cross-section resolution, default 12
  leafCount?: number;         // number of leaf clusters, default 3600
  leafScale?: number;         // size of individual leaf blades, default 0.28
  barkColor?: string;         // default '#3a2414'
  leafColor1?: string;        // mature oak leaf, default '#265420'
  leafColor2?: string;        // young/sunlit oak leaf, default '#447f2b'
}

export interface BotanicalTreeResult {
  trunkItem: SceneItem;
  matureLeavesItem: SceneItem;
  youngLeavesItem: SceneItem;
  allItems: SceneItem[];
  stats: {
    barkVertices: number;
    barkTriangles: number;
    leafVertices: number;
    leafTriangles: number;
    totalVertices: number;
    totalTriangles: number;
  };
}

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
function createRNG(seed: number) {
  let s = Math.floor(Math.abs(seed)) || 42;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SplineNode {
  point: THREE.Vector3;
  radius: number;
}

interface Branch {
  nodes: SplineNode[];
  level: number;
}

/**
 * Builds a lofted cylinder mesh along a 3D branch spline path.
 */
function loftBranch(
  branch: Branch,
  radialSegments: number,
  vOffset: number,
  vScale: number,
  outPositions: number[],
  outNormals: number[],
  outUvs: number[],
  outIndices: number[]
): { endV: number } {
  const nodes = branch.nodes;
  if (nodes.length < 2) return { endV: vOffset };

  const ringVertexStart = outPositions.length / 3;
  let currentV = vOffset;

  // Pre-calculate rotation-minimizing frame (RMF) or stable Frenet frame along curve
  const tangents: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];

  for (let i = 0; i < nodes.length; i++) {
    let t: THREE.Vector3;
    if (i === 0) {
      t = new THREE.Vector3().subVectors(nodes[1].point, nodes[0].point).normalize();
    } else if (i === nodes.length - 1) {
      t = new THREE.Vector3().subVectors(nodes[i].point, nodes[i - 1].point).normalize();
    } else {
      t = new THREE.Vector3().subVectors(nodes[i + 1].point, nodes[i - 1].point).normalize();
    }
    tangents.push(t);
  }

  // Initial normal
  let initialNormal = new THREE.Vector3(0, 0, 1).cross(tangents[0]);
  if (initialNormal.lengthSq() < 0.001) {
    initialNormal = new THREE.Vector3(1, 0, 0).cross(tangents[0]);
  }
  initialNormal.normalize();
  normals.push(initialNormal);
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], initialNormal).normalize());

  // Parallel transport frames along curve
  for (let i = 1; i < nodes.length; i++) {
    const prevT = tangents[i - 1];
    const curT = tangents[i];
    const prevN = normals[i - 1];

    const axis = new THREE.Vector3().crossVectors(prevT, curT);
    let curN: THREE.Vector3;
    if (axis.lengthSq() > 0.00001) {
      axis.normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(prevT.dot(curT), -1, 1));
      curN = prevN.clone().applyAxisAngle(axis, angle).normalize();
    } else {
      curN = prevN.clone();
    }
    normals.push(curN);
    binormals.push(new THREE.Vector3().crossVectors(curT, curN).normalize());
  }

  // Generate vertices along rings
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (i > 0) {
      const segLen = node.point.distanceTo(nodes[i - 1].point);
      currentV += segLen * vScale;
    }

    const n = normals[i];
    const b = binormals[i];

    // Radial ring vertices (+ 1 for UV seam wrap)
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Organic furrow modulation for realistic oak bark creasing
      const furrow = 1.0 + Math.sin(theta * 8.0 + node.point.y * 3.0) * 0.04 + Math.cos(theta * 14.0) * 0.02;
      const r = node.radius * furrow;

      const px = node.point.x + (n.x * cosT + b.x * sinT) * r;
      const py = node.point.y + (n.y * cosT + b.y * sinT) * r;
      const pz = node.point.z + (n.z * cosT + b.z * sinT) * r;

      const nx = n.x * cosT + b.x * sinT;
      const ny = n.y * cosT + b.y * sinT;
      const nz = n.z * cosT + b.z * sinT;

      outPositions.push(px, py, pz);
      outNormals.push(nx, ny, nz);
      outUvs.push(j / radialSegments, currentV);
    }
  }

  // Generate face indices connecting adjacent rings
  const ringStride = radialSegments + 1;
  for (let i = 0; i < nodes.length - 1; i++) {
    const ring1 = ringVertexStart + i * ringStride;
    const ring2 = ringVertexStart + (i + 1) * ringStride;

    for (let j = 0; j < radialSegments; j++) {
      const a = ring1 + j;
      const b = ring2 + j;
      const c = ring2 + j + 1;
      const d = ring1 + j + 1;

      // Two triangles per quad
      outIndices.push(a, b, d);
      outIndices.push(b, c, d);
    }
  }

  return { endV: currentV };
}

/**
 * Creates 3D curved realistic oak leaf mesh elements.
 * Each oak leaf has a curved central vein crease, 3 lobes on each side, and realistic petiole stem.
 */
function createOakLeafGeometry(
  leafOrigin: THREE.Vector3,
  tangentDir: THREE.Vector3,
  upDir: THREE.Vector3,
  scale: number,
  outPositions: number[],
  outNormals: number[],
  outUvs: number[],
  outIndices: number[]
) {
  const baseIdx = outPositions.length / 3;

  const fwd = tangentDir.clone().normalize();
  const side = new THREE.Vector3().crossVectors(fwd, upDir).normalize();
  const up = new THREE.Vector3().crossVectors(side, fwd).normalize();

  // 7 key spine stations along the leaf length (petiole to tip)
  // Each station has center spine vertex, left margin vertex, and right margin vertex
  const stations = [
    { frac: 0.0, halfWidth: 0.02, spineLift: 0.0, marginDrop: 0.0 },     // Petiole base
    { frac: 0.15, halfWidth: 0.18, spineLift: 0.01, marginDrop: -0.01 },  // Lower lobe 1
    { frac: 0.35, halfWidth: 0.28, spineLift: 0.03, marginDrop: -0.02 },  // Waist sinus
    { frac: 0.55, halfWidth: 0.36, spineLift: 0.04, marginDrop: -0.03 },  // Middle lobe 2 (widest)
    { frac: 0.75, halfWidth: 0.26, spineLift: 0.03, marginDrop: -0.02 },  // Upper lobe 3
    { frac: 0.90, halfWidth: 0.14, spineLift: 0.015, marginDrop: -0.01 }, // Sub-apex
    { frac: 1.0, halfWidth: 0.005, spineLift: 0.0, marginDrop: 0.0 },    // Tip apex
  ];

  const L = scale;
  const W = scale * 0.85;

  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    const distFwd = st.frac * L;
    const curW = st.halfWidth * W;

    // Center spine vertex (slight arch along length)
    const spineArch = Math.sin(st.frac * Math.PI) * (scale * 0.08) + st.spineLift * scale;
    const centerPos = leafOrigin.clone()
      .addScaledVector(fwd, distFwd)
      .addScaledVector(up, spineArch);

    // Left margin vertex (slight downward curl)
    const leftPos = centerPos.clone()
      .addScaledVector(side, -curW)
      .addScaledVector(up, st.marginDrop * scale);

    // Right margin vertex (slight downward curl)
    const rightPos = centerPos.clone()
      .addScaledVector(side, curW)
      .addScaledVector(up, st.marginDrop * scale);

    // Position pushes (Center: 0, Left: 1, Right: 2 at each station)
    outPositions.push(centerPos.x, centerPos.y, centerPos.z);
    outPositions.push(leftPos.x, leftPos.y, leftPos.z);
    outPositions.push(rightPos.x, rightPos.y, rightPos.z);

    // Normals (pointing predominantly in up direction with slight side tilt for 3D curvature)
    const normCenter = up.clone().normalize();
    const normLeft = up.clone().addScaledVector(side, -0.3).normalize();
    const normRight = up.clone().addScaledVector(side, 0.3).normalize();

    outNormals.push(normCenter.x, normCenter.y, normCenter.z);
    outNormals.push(normLeft.x, normLeft.y, normLeft.z);
    outNormals.push(normRight.x, normRight.y, normRight.z);

    // UV coordinates
    outUvs.push(0.5, st.frac);
    outUvs.push(0.0, st.frac);
    outUvs.push(1.0, st.frac);
  }

  // Indices: connect adjacent stations with quads (two triangles per side)
  for (let i = 0; i < stations.length - 1; i++) {
    const row1 = baseIdx + i * 3;
    const row2 = baseIdx + (i + 1) * 3;

    const c1 = row1 + 0;
    const l1 = row1 + 1;
    const r1 = row1 + 2;

    const c2 = row2 + 0;
    const l2 = row2 + 1;
    const r2 = row2 + 2;

    // Left wing quad: (l1, l2, c2) & (l1, c2, c1)
    outIndices.push(l1, l2, c2);
    outIndices.push(l1, c2, c1);

    // Right wing quad: (c1, c2, r2) & (c1, r2, r1)
    outIndices.push(c1, c2, r2);
    outIndices.push(c1, r2, r1);
  }
}

/**
 * Procedurally generates an ultra-realistic high-poly Oak Tree (Quercus robur).
 * Implements botanical recursive phototropic branching, root buttressing,
 * bark furrowing, and dual-canopy 3D curved oak foliage.
 */
export function generateBotanicalOakTree(options: BotanicalTreeOptions = {}): BotanicalTreeResult {
  const rng = createRNG(options.seed ?? 1024);

  const H = options.trunkHeight ?? 9.2;
  const R0 = options.trunkRadius ?? 0.38;
  const spread = options.crownSpread ?? 5.2;
  const numScaffold = options.scaffoldBranches ?? 6;
  const radialSegments = options.radialSegments ?? 14;
  const totalLeaves = options.leafCount ?? 3600;
  const leafScale = options.leafScale ?? 0.28;

  const barkPos: number[] = [];
  const barkNorm: number[] = [];
  const barkUv: number[] = [];
  const barkIdx: number[] = [];

  const leavesPos1: number[] = [];
  const leavesNorm1: number[] = [];
  const leavesUv1: number[] = [];
  const leavesIdx1: number[] = [];

  const leavesPos2: number[] = [];
  const leavesNorm2: number[] = [];
  const leavesUv2: number[] = [];
  const leavesIdx2: number[] = [];

  const terminalTwigAnchors: Array<{
    point: THREE.Vector3;
    direction: THREE.Vector3;
    level: number;
    sunExposure: number;
  }> = [];

  // ==========================================
  // 1. ROOT BUTTRESS & TRUNK MODELING
  // ==========================================

  // Generate 5 root buttress flares at the base (y: 0.0 to 1.0)
  const rootCount = 5;
  for (let r = 0; r < rootCount; r++) {
    const rootAngle = (r / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rootNodes: SplineNode[] = [];
    const rootLen = 1.2 + rng() * 0.6;
    const rootSteps = 5;

    for (let s = 0; s <= rootSteps; s++) {
      const frac = s / rootSteps;
      const radDist = (1.0 - frac) * rootLen + R0 * 0.8;
      const y = (1.0 - frac) * 0.6 + frac * 0.02;
      const x = Math.cos(rootAngle) * radDist + (rng() - 0.5) * 0.05;
      const z = Math.sin(rootAngle) * radDist + (rng() - 0.5) * 0.05;
      const radius = THREE.MathUtils.lerp(0.18, 0.06, frac);
      rootNodes.push({ point: new THREE.Vector3(x, y, z), radius });
    }

    loftBranch({ nodes: rootNodes, level: 0 }, 8, 0, 1.5, barkPos, barkNorm, barkUv, barkIdx);
  }

  // Main Trunk (y: 0.0 to scaffold split at ~3.2m)
  const trunkNodes: SplineNode[] = [];
  const trunkSteps = 9;
  const splitY = THREE.MathUtils.lerp(2.8, 3.4, rng());

  let trunkX = 0;
  let trunkZ = 0;

  for (let s = 0; s <= trunkSteps; s++) {
    const frac = s / trunkSteps;
    const y = frac * splitY;
    // Organic gentle trunk tilt & harmonic curvature
    trunkX += Math.sin(frac * Math.PI * 1.5) * 0.04 + (rng() - 0.5) * 0.03;
    trunkZ += Math.cos(frac * Math.PI * 1.2) * 0.03 + (rng() - 0.5) * 0.03;

    // Leonardo da Vinci trunk taper with root flare expansion near base
    const baseFlare = frac < 0.2 ? Math.pow(1.0 - frac / 0.2, 2) * 0.18 : 0.0;
    const radius = THREE.MathUtils.lerp(R0, R0 * 0.62, Math.pow(frac, 0.7)) + baseFlare;

    trunkNodes.push({ point: new THREE.Vector3(trunkX, y, trunkZ), radius });
  }

  const { endV: trunkEndV } = loftBranch(
    { nodes: trunkNodes, level: 0 },
    radialSegments,
    0,
    1.0,
    barkPos,
    barkNorm,
    barkUv,
    barkIdx
  );

  const trunkApex = trunkNodes[trunkNodes.length - 1];

  // ==========================================
  // 2. PRIMARY SCAFFOLD LIMBS (TIER 1)
  // ==========================================
  const scaffoldBranches: Branch[] = [];

  for (let i = 0; i < numScaffold; i++) {
    const angle = (i / numScaffold) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    // Scaffold limb elevation angle (35 to 60 degrees from vertical)
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(35, 60, rng()));
    const limbLen = THREE.MathUtils.lerp(H * 0.35, H * 0.5, rng());
    const limbSteps = 8;

    const limbNodes: SplineNode[] = [];
    const baseR = trunkApex.radius * THREE.MathUtils.lerp(0.48, 0.62, rng());

    let curP = trunkApex.point.clone();
    limbNodes.push({ point: curP.clone(), radius: baseR });

    for (let s = 1; s <= limbSteps; s++) {
      const frac = s / limbSteps;
      const stepDist = (limbLen / limbSteps);

      // Branch curves outwards and then upwards phototropically towards sky
      const outX = Math.cos(angle);
      const outZ = Math.sin(angle);
      const phototropism = Math.pow(frac, 1.4) * 0.35; // turns up

      curP = curP.clone().add(new THREE.Vector3(
        outX * Math.sin(pitch) * stepDist + (rng() - 0.5) * 0.08,
        (Math.cos(pitch) + phototropism) * stepDist + (rng() - 0.5) * 0.05,
        outZ * Math.sin(pitch) * stepDist + (rng() - 0.5) * 0.08
      ));

      const r = THREE.MathUtils.lerp(baseR, baseR * 0.38, frac);
      limbNodes.push({ point: curP.clone(), radius: Math.max(0.04, r) });
    }

    const branchObj: Branch = { nodes: limbNodes, level: 1 };
    scaffoldBranches.push(branchObj);
    loftBranch(branchObj, Math.max(8, radialSegments - 2), trunkEndV, 1.2, barkPos, barkNorm, barkUv, barkIdx);
  }

  // ==========================================
  // 3. SECONDARY BOUGHS & TERTIARY TWIGS (TIER 2 & 3)
  // ==========================================
  for (const scaffold of scaffoldBranches) {
    const limbNodes = scaffold.nodes;
    // Spawn 3 to 5 secondary branches along upper half of scaffold limb
    const numSecondary = Math.floor(THREE.MathUtils.lerp(3, 5, rng()));

    for (let sb = 0; sb < numSecondary; sb++) {
      const parentIdx = Math.floor(THREE.MathUtils.lerp(2, limbNodes.length - 1, (sb + 0.5) / numSecondary));
      const parentNode = limbNodes[parentIdx];
      const parentTangent = parentIdx < limbNodes.length - 1
        ? new THREE.Vector3().subVectors(limbNodes[parentIdx + 1].point, parentNode.point).normalize()
        : new THREE.Vector3(0, 1, 0);

      // Phyllotactic golden angle fork
      const forkSide = (sb % 2 === 0 ? 1 : -1);
      const forkAngle = forkSide * THREE.MathUtils.degToRad(THREE.MathUtils.lerp(35, 55, rng()));
      const secLen = THREE.MathUtils.lerp(1.5, 2.8, rng());
      const secSteps = 6;

      const secNodes: SplineNode[] = [];
      const secBaseR = parentNode.radius * 0.6;
      let secP = parentNode.point.clone();
      secNodes.push({ point: secP.clone(), radius: secBaseR });

      // Orthogonal fork direction
      const ortho = new THREE.Vector3(-parentTangent.z, 0, parentTangent.x).normalize();
      if (ortho.lengthSq() < 0.001) ortho.set(1, 0, 0);

      const secDir = parentTangent.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), forkAngle)
        .addScaledVector(ortho, forkSide * 0.4)
        .normalize();

      for (let s = 1; s <= secSteps; s++) {
        const frac = s / secSteps;
        const stepDist = secLen / secSteps;
        // Gravitropic arch + phototropic upward flare
        secP = secP.clone().add(new THREE.Vector3(
          secDir.x * stepDist + (rng() - 0.5) * 0.06,
          (secDir.y * 0.7 + 0.3 * frac) * stepDist,
          secDir.z * stepDist + (rng() - 0.5) * 0.06
        ));

        const r = THREE.MathUtils.lerp(secBaseR, 0.025, frac);
        secNodes.push({ point: secP.clone(), radius: Math.max(0.015, r) });
      }

      loftBranch({ nodes: secNodes, level: 2 }, 6, trunkEndV + 10, 1.5, barkPos, barkNorm, barkUv, barkIdx);

      // Spawn tertiary twig sprays off secondary branch
      const twigCount = 3 + Math.floor(rng() * 3);
      for (let tw = 0; tw < twigCount; tw++) {
        const twIdx = Math.floor(THREE.MathUtils.lerp(2, secNodes.length - 1, tw / twigCount));
        const twNode = secNodes[twIdx];
        const twLen = THREE.MathUtils.lerp(0.8, 1.4, rng());
        const twSteps = 4;
        const twNodes: SplineNode[] = [];
        let twP = twNode.point.clone();
        twNodes.push({ point: twP.clone(), radius: 0.018 });

        const twSide = (tw % 2 === 0 ? 1 : -1);
        const twDir = new THREE.Vector3(
          (rng() - 0.5) * 1.5 + twSide * 0.8,
          0.4 + rng() * 0.8,
          (rng() - 0.5) * 1.5
        ).normalize();

        for (let t = 1; t <= twSteps; t++) {
          const frac = t / twSteps;
          twP = twP.clone().addScaledVector(twDir, twLen / twSteps);
          twNodes.push({ point: twP.clone(), radius: THREE.MathUtils.lerp(0.018, 0.008, frac) });
        }

        loftBranch({ nodes: twNodes, level: 3 }, 5, trunkEndV + 20, 2.0, barkPos, barkNorm, barkUv, barkIdx);

        // Record anchor point for leaf foliage bunches
        const tip = twNodes[twNodes.length - 1];
        const sunExposure = Math.min(1.0, (tip.point.y / H) * 0.8 + (tip.point.length() / spread) * 0.4);
        terminalTwigAnchors.push({
          point: tip.point.clone(),
          direction: twDir.clone(),
          level: 3,
          sunExposure,
        });
      }
    }
  }

  // ==========================================
  // 4. LUSH DUAL-CANOPY OAK FOLIAGE SYNTHESIS
  // ==========================================
  const leavesPerAnchor = Math.max(1, Math.floor(totalLeaves / Math.max(1, terminalTwigAnchors.length)));

  for (const anchor of terminalTwigAnchors) {
    for (let l = 0; l < leavesPerAnchor; l++) {
      // Cluster leaves in organic hemispherical cloud volume around twig tip
      const offsetRadius = rng() * 0.65;
      const phi = rng() * Math.PI * 2;
      const theta = rng() * Math.PI * 0.7; // canopy bias upwards

      const leafOrigin = anchor.point.clone().add(new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi) * offsetRadius,
        Math.cos(theta) * offsetRadius * 0.8,
        Math.sin(theta) * Math.sin(phi) * offsetRadius
      ));

      // Leaves angle outwards from tree center and upwards towards the sky
      const outDir = new THREE.Vector3(leafOrigin.x, 0, leafOrigin.z).normalize();
      const leafTangent = outDir.clone()
        .add(new THREE.Vector3(0, 0.35 + rng() * 0.4, 0))
        .add(new THREE.Vector3((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.5))
        .normalize();

      const leafUp = new THREE.Vector3(0, 1, 0)
        .add(new THREE.Vector3((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3))
        .normalize();

      const curLeafScale = leafScale * THREE.MathUtils.lerp(0.85, 1.25, rng());

      // Assign to Mature Oak Foliage (70%) or Young Sunlit Foliage (30%)
      const isSunlitTip = anchor.sunExposure > 0.65 && rng() > 0.45;
      if (isSunlitTip) {
        createOakLeafGeometry(
          leafOrigin,
          leafTangent,
          leafUp,
          curLeafScale,
          leavesPos2,
          leavesNorm2,
          leavesUv2,
          leavesIdx2
        );
      } else {
        createOakLeafGeometry(
          leafOrigin,
          leafTangent,
          leafUp,
          curLeafScale,
          leavesPos1,
          leavesNorm1,
          leavesUv1,
          leavesIdx1
        );
      }
    }
  }

  // ==========================================
  // 5. PACK SCENE ITEMS & MATERIALS
  // ==========================================
  const barkMat: MaterialProperties = {
    color: options.barkColor ?? '#3e2716',
    roughness: 0.92,
    metalness: 0.04,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'bark',
  };

  const matureLeafMat: MaterialProperties = {
    color: options.leafColor1 ?? '#27521e',
    roughness: 0.42,
    metalness: 0.08,
    emissive: '#0b1e09',
    emissiveIntensity: 0.08,
    transmission: 0.16, // Subsurface scattering sunlight translucency
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'foliage',
    doubleSided: true,
  };

  const youngLeafMat: MaterialProperties = {
    color: options.leafColor2 ?? '#46832a',
    roughness: 0.38,
    metalness: 0.05,
    emissive: '#11290b',
    emissiveIntensity: 0.12,
    transmission: 0.24, // Fresh young leaves have higher transmission
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'foliage',
    doubleSided: true,
  };

  const trunkItem: SceneItem = {
    id: `oak-wood-bark-${Date.now().toString(36)}`,
    name: 'Wood - Bark',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: barkMat,
    geometryParams: {
      customGeometry: {
        positions: barkPos,
        normals: barkNorm,
        uvs: barkUv,
        indices: barkIdx,
      },
    },
    visible: true,
    locked: false,
  };

  const matureLeavesItem: SceneItem = {
    id: `oak-leaves-mature-${Date.now().toString(36)}`,
    name: 'Leaf Oak',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: matureLeafMat,
    geometryParams: {
      customGeometry: {
        positions: leavesPos1,
        normals: leavesNorm1,
        uvs: leavesUv1,
        indices: leavesIdx1,
      },
    },
    visible: true,
    locked: false,
  };

  const youngLeavesItem: SceneItem = {
    id: `oak-leaves-young-${Date.now().toString(36)}`,
    name: 'Leaf Oak2',
    type: 'mesh',
    primitiveType: 'custom',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: youngLeafMat,
    geometryParams: {
      customGeometry: {
        positions: leavesPos2,
        normals: leavesNorm2,
        uvs: leavesUv2,
        indices: leavesIdx2,
      },
    },
    visible: true,
    locked: false,
  };

  const barkVerts = barkPos.length / 3;
  const barkTris = barkIdx.length / 3;
  const leafVerts = (leavesPos1.length + leavesPos2.length) / 3;
  const leafTris = (leavesIdx1.length + leavesIdx2.length) / 3;

  return {
    trunkItem,
    matureLeavesItem,
    youngLeavesItem,
    allItems: [trunkItem, matureLeavesItem, youngLeavesItem],
    stats: {
      barkVertices: barkVerts,
      barkTriangles: barkTris,
      leafVertices: leafVerts,
      leafTriangles: leafTris,
      totalVertices: barkVerts + leafVerts,
      totalTriangles: barkTris + leafTris,
    },
  };
}
