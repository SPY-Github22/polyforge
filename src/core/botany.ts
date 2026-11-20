import * as THREE from 'three';
import { MaterialProperties, SceneItem } from '../types';

export interface BotanicalTreeOptions {
  seed?: number;
  trunkHeight?: number;       // overall height, default ~9.2
  trunkRadius?: number;       // base radius, default ~0.38
  crownSpread?: number;       // canopy spread radius, default ~5.2
  scaffoldBranches?: number;  // count of major limbs, default 6
  radialSegments?: number;    // cross-section resolution, default 14
  leafCount?: number;         // number of leaf sprays/clusters, default 3800
  leafScale?: number;         // size of individual leaf blades, default 0.48
  barkColor?: string;         // default '#ffffff'
  leafColor1?: string;        // mature oak leaf, default '#ffffff'
  leafColor2?: string;        // young/sunlit oak leaf, default '#ffffff'
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
 * Supports rotation-minimizing frame (RMF), organic longitudinal bark creasing,
 * crevice ambient occlusion vertex colors, and optional start/end end caps.
 */
function loftBranch(
  branch: Branch,
  radialSegments: number,
  vOffset: number,
  vScale: number,
  outPositions: number[],
  outNormals: number[],
  outUvs: number[],
  outColors: number[],
  outIndices: number[],
  capStart: boolean = false,
  capEnd: boolean = false
): { endV: number } {
  const nodes = branch.nodes;
  if (nodes.length < 2) return { endV: vOffset };

  const ringVertexStart = outPositions.length / 3;
  let currentV = vOffset;

  // Tangents along curve
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
      const furrow = 1.0 +
        Math.sin(theta * 8.0 + node.point.y * 2.5) * 0.05 +
        Math.cos(theta * 14.0) * 0.025;
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

      // Vertex color representing crevice Ambient Occlusion (AO) centered around 1.0:
      // Ridges are brighter (~1.0 - 1.15), furrows darker (~0.7 - 0.8)
      const ao = THREE.MathUtils.clamp(furrow * 0.95, 0.7, 1.15);
      outColors.push(ao, ao, ao);
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

  // Optional start cap (e.g. trunk base)
  if (capStart && nodes.length > 0) {
    const startCenterIdx = outPositions.length / 3;
    const startNode = nodes[0];
    const revNormal = tangents[0].clone().negate();

    outPositions.push(startNode.point.x, startNode.point.y, startNode.point.z);
    outNormals.push(revNormal.x, revNormal.y, revNormal.z);
    outUvs.push(0.5, 0.5);
    outColors.push(0.75, 0.75, 0.75); // Ground crevice AO

    const firstRing = ringVertexStart;
    for (let j = 0; j < radialSegments; j++) {
      outIndices.push(startCenterIdx, firstRing + j + 1, firstRing + j);
    }
  }

  // Optional end cap (e.g. branch/twig tip or root tip)
  if (capEnd && nodes.length > 0) {
    const endCenterIdx = outPositions.length / 3;
    const endNode = nodes[nodes.length - 1];
    const fwdNormal = tangents[tangents.length - 1].clone();

    outPositions.push(endNode.point.x, endNode.point.y, endNode.point.z);
    outNormals.push(fwdNormal.x, fwdNormal.y, fwdNormal.z);
    outUvs.push(0.5, 0.5);
    outColors.push(1.0, 1.0, 1.0); // Open tip AO

    const lastRing = ringVertexStart + (nodes.length - 1) * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      outIndices.push(endCenterIdx, lastRing + j, lastRing + j + 1);
    }
  }

  return { endV: currentV };
}

/**
 * Constructs a botanical oak leaf spray (branchlet bouquet) attached to a twig.
 * Generates 3-4 angled, curved leaf cards mapped precisely to the oak leaf atlas,
 * featuring phototropic elevation, chlorophyll vertex colors, and double-sided visibility.
 */
function createOakLeafSpray(
  origin: THREE.Vector3,
  stemDir: THREE.Vector3,
  upDir: THREE.Vector3,
  scale: number,
  isYoung: boolean,
  rng: () => number,
  outPositions: number[],
  outNormals: number[],
  outUvs: number[],
  outColors: number[],
  outIndices: number[]
) {
  const fwd = stemDir.clone().normalize();
  const side = new THREE.Vector3().crossVectors(fwd, upDir).normalize();
  const up = new THREE.Vector3().crossVectors(side, fwd).normalize();

  // Ambient Occlusion scalar values centered around 1.0:
  // Petiole base is tucked deep in cluster/crevice (0.78-0.84), mid leaf (0.92-0.96), tip is open to ambient light (1.00-1.05)
  const aoBase = isYoung ? 0.84 : 0.78;
  const aoMid = isYoung ? 0.96 : 0.92;
  const aoTip = isYoung ? 1.05 : 1.00;

  const stemCol = [aoBase, aoBase, aoBase];
  const leafBaseCol = [aoMid, aoMid, aoMid];
  const leafTipCol = [aoTip, aoTip, aoTip];

  // Leaf configuration within the spray:
  // 3-4 leaves angled in 3D around the twig stem
  const leafAngles = [
    { yaw: 0.0, pitch: 0.15, roll: 0.0, scaleMult: 1.05, atlasCol: 0 },       // Center main leaf
    { yaw: 0.55, pitch: 0.30, roll: 0.25, scaleMult: 0.92, atlasCol: 1 },     // Right fanned leaf
    { yaw: -0.55, pitch: 0.28, roll: -0.25, scaleMult: 0.90, atlasCol: 0 },    // Left fanned leaf
    { yaw: (rng() - 0.5) * 0.4, pitch: -0.20, roll: 0.1, scaleMult: 0.82, atlasCol: 1 }, // Lower tuck leaf
  ];

  for (let l = 0; l < leafAngles.length; l++) {
    const la = leafAngles[l];
    const leafScale = scale * la.scaleMult * (0.9 + rng() * 0.2);

    // Compute leaf forward and side vectors with 3D orientation
    const leafFwd = fwd.clone()
      .applyAxisAngle(up, la.yaw)
      .applyAxisAngle(side, la.pitch)
      .normalize();
    const leafSide = new THREE.Vector3().crossVectors(leafFwd, up).normalize();
    const leafUp = new THREE.Vector3().crossVectors(leafSide, leafFwd).normalize();

    // Atlas UV coordinates:
    // Leaf 0 (atlasCol === 0): U in [0.05..0.48]
    // Leaf 1 (atlasCol === 1): U in [0.52..0.95]
    const minU = la.atlasCol === 0 ? 0.05 : 0.52;
    const maxU = la.atlasCol === 0 ? 0.48 : 0.95;
    const midU = (minU + maxU) * 0.5;

    const baseIdx = outPositions.length / 3;

    // 3 longitudinal stations along leaf blade (Base -> Mid Lobe -> Tip)
    const L = leafScale;
    const W = leafScale * 0.65;

    // Station 0: Petiole base
    const p0_c = origin.clone();
    const p0_l = origin.clone().addScaledVector(leafSide, -W * 0.08);
    const p0_r = origin.clone().addScaledVector(leafSide, W * 0.08);

    // Station 1: Mid-leaf (widest lobes with slight upward spine arch)
    const midArch = leafScale * 0.08;
    const p1_center = origin.clone()
      .addScaledVector(leafFwd, L * 0.55)
      .addScaledVector(leafUp, midArch);
    const p1_l = p1_center.clone().addScaledVector(leafSide, -W * 0.55);
    const p1_r = p1_center.clone().addScaledVector(leafSide, W * 0.55);

    // Station 2: Leaf apex tip (slight downward drooping tip)
    const p2_center = origin.clone()
      .addScaledVector(leafFwd, L)
      .addScaledVector(leafUp, midArch * 0.4);
    const p2_l = p2_center.clone().addScaledVector(leafSide, -W * 0.05);
    const p2_r = p2_center.clone().addScaledVector(leafSide, W * 0.05);

    const stations = [
      { c: p0_c, l: p0_l, r: p0_r, vFrac: 0.05, col: stemCol },
      { c: p1_center, l: p1_l, r: p1_r, vFrac: 0.55, col: leafBaseCol },
      { c: p2_center, l: p2_l, r: p2_r, vFrac: 0.95, col: leafTipCol },
    ];

    for (const st of stations) {
      // Normals: primarily leafUp with slight side tilt for 3D curved lighting
      const nCenter = leafUp.clone().normalize();
      const nLeft = leafUp.clone().addScaledVector(leafSide, -0.25).normalize();
      const nRight = leafUp.clone().addScaledVector(leafSide, 0.25).normalize();

      // Positions: Center (0), Left (1), Right (2)
      outPositions.push(st.c.x, st.c.y, st.c.z);
      outPositions.push(st.l.x, st.l.y, st.l.z);
      outPositions.push(st.r.x, st.r.y, st.r.z);

      outNormals.push(nCenter.x, nCenter.y, nCenter.z);
      outNormals.push(nLeft.x, nLeft.y, nLeft.z);
      outNormals.push(nRight.x, nRight.y, nRight.z);

      outUvs.push(midU, st.vFrac);
      outUvs.push(minU, st.vFrac);
      outUvs.push(maxU, st.vFrac);

      outColors.push(st.col[0], st.col[1], st.col[2]);
      outColors.push(st.col[0], st.col[1], st.col[2]);
      outColors.push(st.col[0], st.col[1], st.col[2]);
    }

    // Connect stations with quad strips (2 triangles per side = 4 triangles per station pair)
    for (let s = 0; s < stations.length - 1; s++) {
      const row1 = baseIdx + s * 3;
      const row2 = baseIdx + (s + 1) * 3;

      const c1 = row1 + 0;
      const l1 = row1 + 1;
      const r1 = row1 + 2;

      const c2 = row2 + 0;
      const l2 = row2 + 1;
      const r2 = row2 + 2;

      // Left wing: CCW when viewed along +leafUp to match vertex normals
      outIndices.push(l1, c2, l2);
      outIndices.push(l1, c1, c2);

      // Right wing: CCW when viewed along +leafUp to match vertex normals
      outIndices.push(c1, r2, c2);
      outIndices.push(c1, r1, r2);
    }
  }
}

/**
 * Procedurally generates an ultra-realistic high-poly Oak Tree (Quercus robur).
 * Implements botanical recursive phototropic branching, flared root buttressing,
 * organic bark furrow displacement, and dual-canopy 3D curved oak foliage sprays.
 */
export function generateBotanicalOakTree(options: BotanicalTreeOptions = {}): BotanicalTreeResult {
  const rng = createRNG(options.seed ?? 1024);

  const H = options.trunkHeight ?? 9.2;
  const R0 = options.trunkRadius ?? 0.38;
  const spread = options.crownSpread ?? 5.2;
  const numScaffold = options.scaffoldBranches ?? 6;
  const radialSegments = options.radialSegments ?? 14;
  const totalLeafSprays = options.leafCount ?? 3800;
  const leafScale = options.leafScale ?? 0.48;

  const barkPos: number[] = [];
  const barkNorm: number[] = [];
  const barkUv: number[] = [];
  const barkColors: number[] = [];
  const barkIdx: number[] = [];

  const leavesPos1: number[] = [];
  const leavesNorm1: number[] = [];
  const leavesUv1: number[] = [];
  const leavesColors1: number[] = [];
  const leavesIdx1: number[] = [];

  const leavesPos2: number[] = [];
  const leavesNorm2: number[] = [];
  const leavesUv2: number[] = [];
  const leavesColors2: number[] = [];
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

  // Generate 5 massive flared root buttresses curving from trunk into soil
  const rootCount = 5;
  for (let r = 0; r < rootCount; r++) {
    const rootAngle = (r / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const rootNodes: SplineNode[] = [];
    const rootLen = 1.1 + rng() * 0.5;
    const rootSteps = 6;

    for (let s = 0; s <= rootSteps; s++) {
      const frac = s / rootSteps;
      // frac = 0 at trunk attachment (y ≈ 0.85m, rad ≈ R0)
      // frac = 1 at ground soil entry (y = 0.0m, rad ≈ R0 + rootLen)
      const radDist = R0 * 0.95 + Math.pow(frac, 0.8) * rootLen;
      const y = (1.0 - Math.pow(frac, 0.7)) * 0.85;
      const x = Math.cos(rootAngle) * radDist + (rng() - 0.5) * 0.04;
      const z = Math.sin(rootAngle) * radDist + (rng() - 0.5) * 0.04;
      const radius = THREE.MathUtils.lerp(0.20, 0.04, frac);
      rootNodes.push({ point: new THREE.Vector3(x, y, z), radius });
    }

    loftBranch({ nodes: rootNodes, level: 0 }, 8, 0, 1.5, barkPos, barkNorm, barkUv, barkColors, barkIdx, false, true);
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
    barkColors,
    barkIdx,
    true, // Seal trunk base with end cap
    false
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
      const stepDist = limbLen / limbSteps;

      // Branch curves outwards and then upwards phototropically towards sky
      const outX = Math.cos(angle);
      const outZ = Math.sin(angle);
      const phototropism = Math.pow(frac, 1.4) * 0.35;

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
    loftBranch(
      branchObj,
      Math.max(8, radialSegments - 2),
      trunkEndV,
      1.2,
      barkPos,
      barkNorm,
      barkUv,
      barkColors,
      barkIdx,
      false,
      false
    );

    // Distribute canopy foliage anchors along middle-to-outer reach of scaffold limb
    for (let s = Math.floor(limbNodes.length * 0.35); s < limbNodes.length; s++) {
      const node = limbNodes[s];
      const sunExposure = Math.min(1.0, (node.point.y / H) * 0.75 + (node.point.length() / spread) * 0.45);
      const outVec = new THREE.Vector3(node.point.x, 0, node.point.z).normalize();
      terminalTwigAnchors.push({
        point: node.point.clone().add(new THREE.Vector3(outVec.x * 0.35, 0.2, outVec.z * 0.35)),
        direction: outVec.clone().add(new THREE.Vector3(0, 0.5, 0)).normalize(),
        level: 1,
        sunExposure,
      });
    }
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

      // Golden angle fork
      const forkSide = (sb % 2 === 0 ? 1 : -1);
      const forkAngle = forkSide * THREE.MathUtils.degToRad(THREE.MathUtils.lerp(35, 55, rng()));
      const secLen = THREE.MathUtils.lerp(1.5, 2.8, rng());
      const secSteps = 6;

      const secNodes: SplineNode[] = [];
      const secBaseR = parentNode.radius * 0.6;
      let secP = parentNode.point.clone();
      secNodes.push({ point: secP.clone(), radius: secBaseR });

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

      loftBranch(
        { nodes: secNodes, level: 2 },
        6,
        trunkEndV + 10,
        1.5,
        barkPos,
        barkNorm,
        barkUv,
        barkColors,
        barkIdx,
        false,
        false
      );

      // Distribute foliage anchors along secondary bough
      for (let s = 1; s < secNodes.length; s++) {
        const node = secNodes[s];
        const sunExposure = Math.min(1.0, (node.point.y / H) * 0.8 + (node.point.length() / spread) * 0.4);
        terminalTwigAnchors.push({
          point: node.point.clone().add(new THREE.Vector3((rng() - 0.5) * 0.25, 0.15, (rng() - 0.5) * 0.25)),
          direction: secDir.clone().add(new THREE.Vector3(0, 0.45, 0)).normalize(),
          level: 2,
          sunExposure,
        });
      }

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

        // Seal terminal twig tips with end caps
        loftBranch(
          { nodes: twNodes, level: 3 },
          5,
          trunkEndV + 20,
          2.0,
          barkPos,
          barkNorm,
          barkUv,
          barkColors,
          barkIdx,
          false,
          true
        );

        // Record anchor points along and at tip of tertiary twig
        for (let t = 1; t < twNodes.length; t++) {
          const node = twNodes[t];
          const isTip = t === twNodes.length - 1;
          const sunExposure = Math.min(1.0, (node.point.y / H) * 0.85 + (node.point.length() / spread) * 0.45);
          terminalTwigAnchors.push({
            point: node.point.clone(),
            direction: twDir.clone(),
            level: isTip ? 3 : 2,
            sunExposure: isTip ? Math.min(1.0, sunExposure * 1.1) : sunExposure,
          });
        }
      }
    }
  }

  // ==========================================
  // 4. LUSH DUAL-CANOPY OAK FOLIAGE SYNTHESIS
  // ==========================================
  const anchorCount = Math.max(1, terminalTwigAnchors.length);

  for (let i = 0; i < totalLeafSprays; i++) {
    const anchor = terminalTwigAnchors[i % anchorCount];

    // Cluster leaf sprays in organic volumetric billows around branch anchors
    // Billow radius varies with branch tier to form lush, overlapping foliage canopies
    const billowRadius = anchor.level === 1 ? 0.95 : anchor.level === 2 ? 0.78 : 0.60;
    const offsetRadius = Math.pow(rng(), 0.7) * billowRadius;
    const phi = rng() * Math.PI * 2;
    const theta = rng() * Math.PI * 0.78; // canopy bias upwards

    const sprayOrigin = anchor.point.clone().add(new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi) * offsetRadius,
      Math.cos(theta) * offsetRadius * 0.85,
      Math.sin(theta) * Math.sin(phi) * offsetRadius
    ));

    // Leaves angle outwards from tree center and upwards towards the sky
    const outDir = new THREE.Vector3(sprayOrigin.x, 0, sprayOrigin.z).normalize();
    const sprayDir = outDir.clone()
      .add(new THREE.Vector3(0, 0.4 + rng() * 0.45, 0))
      .add(new THREE.Vector3((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.5))
      .normalize();

    const sprayUp = new THREE.Vector3(0, 1, 0)
      .add(new THREE.Vector3((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3))
      .normalize();

    // Scale variation: lush, overlapping foliage billows
    const curLeafScale = leafScale * THREE.MathUtils.lerp(0.85, 1.3, rng());

    // Assign to Mature Oak Foliage (68-70%) or Young Sunlit Foliage (30-32%) on exposed outer tips
    const isSunlitTip = anchor.sunExposure > 0.65 && rng() > 0.60;
    if (isSunlitTip) {
      createOakLeafSpray(
        sprayOrigin,
        sprayDir,
        sprayUp,
        curLeafScale,
        true, // Young sunlit leaf
        rng,
        leavesPos2,
        leavesNorm2,
        leavesUv2,
        leavesColors2,
        leavesIdx2
      );
    } else {
      createOakLeafSpray(
        sprayOrigin,
        sprayDir,
        sprayUp,
        curLeafScale,
        false, // Mature oak leaf
        rng,
        leavesPos1,
        leavesNorm1,
        leavesUv1,
        leavesColors1,
        leavesIdx1
      );
    }
  }

  // ==========================================
  // 5. PACK SCENE ITEMS & MATERIALS
  // ==========================================
  const barkMat: MaterialProperties = {
    color: options.barkColor ?? '#ffffff',
    roughness: 0.92,
    metalness: 0.04,
    emissive: '#000000',
    emissiveIntensity: 0,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'bark_oak',
    vertexColors: true,
  };

  const matureLeafMat: MaterialProperties = {
    color: options.leafColor1 ?? '#ffffff',
    roughness: 0.42,
    metalness: 0.06,
    emissive: '#081707',
    emissiveIntensity: 0.08,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'leaf_oak_mature',
    doubleSided: true,
    vertexColors: true,
    alphaTest: 0.5,
  };

  const youngLeafMat: MaterialProperties = {
    color: options.leafColor2 ?? '#ffffff',
    roughness: 0.38,
    metalness: 0.04,
    emissive: '#0d2208',
    emissiveIntensity: 0.10,
    transmission: 0,
    opacity: 1,
    transparent: false,
    wireframe: false,
    texturePreset: 'leaf_oak_young',
    doubleSided: true,
    vertexColors: true,
    alphaTest: 0.5,
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
        colors: barkColors,
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
        colors: leavesColors1,
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
        colors: leavesColors2,
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
