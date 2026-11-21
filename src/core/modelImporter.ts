import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  SceneItem,
  MaterialProperties,
  TransformData,
  CustomGeometryData,
  AnimationTrack,
  Keyframe,
} from '../types';

export interface ImportModelOptions {
  autoCenter?: boolean;
  autoScale?: boolean;
  targetMaxDimension?: number;
  preserveHierarchy?: boolean;
  defaultColor?: string;
}

export interface ImportModelResult {
  items: SceneItem[];
  format: 'obj' | 'gltf' | 'glb' | 'stl' | 'unknown';
  tracks?: AnimationTrack[];
  stats: {
    totalObjects: number;
    totalVertices: number;
    totalTriangles: number;
    boundingBox: {
      min: [number, number, number];
      max: [number, number, number];
      size: [number, number, number];
    };
  };
}

const DEFAULT_IMPORT_MATERIAL: MaterialProperties = {
  color: '#94a3b8',
  roughness: 0.5,
  metalness: 0.1,
  emissive: '#000000',
  emissiveIntensity: 0,
  transmission: 0,
  opacity: 1,
  transparent: false,
  wireframe: false,
  texturePreset: 'none',
};

/**
 * Generates a unique, collision-resistant identifier for imported items.
 */
function generateImportId(prefix: string, index: number): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${index}`;
}

/**
 * Converts a Three.js material instance to PolyForge MaterialProperties.
 */
export function convertThreeMaterial(mat: THREE.Material | THREE.Material[] | null | undefined): MaterialProperties {
  if (!mat) return { ...DEFAULT_IMPORT_MATERIAL };

  const activeMat = Array.isArray(mat) ? mat[0] : mat;
  const props: MaterialProperties = { ...DEFAULT_IMPORT_MATERIAL };

  if ('color' in activeMat && (activeMat as any).color instanceof THREE.Color) {
    props.color = '#' + (activeMat as any).color.getHexString();
  }
  if ('roughness' in activeMat && typeof (activeMat as any).roughness === 'number') {
    props.roughness = (activeMat as any).roughness;
  }
  if ('metalness' in activeMat && typeof (activeMat as any).metalness === 'number') {
    props.metalness = (activeMat as any).metalness;
  }
  if ('emissive' in activeMat && (activeMat as any).emissive instanceof THREE.Color) {
    props.emissive = '#' + (activeMat as any).emissive.getHexString();
  }
  if ('emissiveIntensity' in activeMat && typeof (activeMat as any).emissiveIntensity === 'number') {
    props.emissiveIntensity = (activeMat as any).emissiveIntensity;
  }
  if ('transmission' in activeMat && typeof (activeMat as any).transmission === 'number') {
    props.transmission = (activeMat as any).transmission;
  }
  if (typeof activeMat.opacity === 'number') {
    props.opacity = activeMat.opacity;
  }
  props.transparent = Boolean(activeMat.transparent || props.opacity < 1);
  if ('wireframe' in activeMat) {
    props.wireframe = Boolean((activeMat as any).wireframe);
  }
  if (activeMat.vertexColors) {
    props.vertexColors = true;
  }

  return props;
}

/**
 * Extracts raw buffer attributes from a BufferGeometry into PolyForge CustomGeometryData.
 */
export function extractCustomGeometry(geo: THREE.BufferGeometry): CustomGeometryData {
  // Ensure normals exist
  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }

  const posAttr = geo.getAttribute('position');
  if (!posAttr) {
    return { positions: [] };
  }

  const positions = Array.from(posAttr.array);
  const normAttr = geo.getAttribute('normal');
  const normals = normAttr ? Array.from(normAttr.array) : undefined;
  const uvAttr = geo.getAttribute('uv');
  const uvs = uvAttr ? Array.from(uvAttr.array) : undefined;
  const colAttr = geo.getAttribute('color');
  const colors = colAttr ? Array.from(colAttr.array) : undefined;
  const indices = geo.index ? Array.from(geo.index.array) : undefined;

  return {
    positions,
    normals,
    uvs,
    colors,
    indices,
  };
}

/**
 * Converts a Three.js Object3D root (from OBJLoader, GLTFLoader, STLLoader)
 * into a collection of PolyForge SceneItem instances.
 */
export function convertThreeObjectToSceneItems(
  root: THREE.Object3D,
  options: ImportModelOptions = {}
): ImportModelResult {
  const {
    autoCenter = false,
    autoScale = false,
    targetMaxDimension = 5.0,
    preserveHierarchy = false,
    defaultColor,
  } = options;

  root.updateMatrixWorld(true);

  // Compute global bounding box across all meshes
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Handle empty or degenerate geometry bounds
  if (size.x === 0 && size.y === 0 && size.z === 0) {
    size.set(1, 1, 1);
  }

  // Calculate normalization scale if requested
  const maxDim = Math.max(size.x, size.y, size.z);
  const scaleFactor = autoScale && maxDim > 0 ? targetMaxDimension / maxDim : 1.0;

  const items: SceneItem[] = [];
  let itemIndex = 0;
  let totalVertices = 0;
  let totalTriangles = 0;

  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry.clone();
      if (!geo) return;

      // Determine transformation and geometry
      let transform: TransformData;
      if (preserveHierarchy) {
        transform = {
          position: [child.position.x, child.position.y, child.position.z],
          rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
          scale: [child.scale.x, child.scale.y, child.scale.z],
        };
      } else {
        // Bake world transformation and normalize center/scale into geometry
        geo.applyMatrix4(child.matrixWorld);

        if (autoCenter) {
          geo.translate(-center.x, -center.y, -center.z);
        }
        if (autoScale && scaleFactor !== 1.0) {
          geo.scale(scaleFactor, scaleFactor, scaleFactor);
        }

        transform = {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        };
      }

      // Extract geometry data after normalization
      const customGeometry = extractCustomGeometry(geo);
      const vertCount = customGeometry.positions.length / 3;
      const triCount = customGeometry.indices
        ? customGeometry.indices.length / 3
        : vertCount / 3;

      totalVertices += vertCount;
      totalTriangles += Math.floor(triCount);

      // Determine material
      const material = convertThreeMaterial(child.material);
      if (defaultColor) {
        material.color = defaultColor;
      }

      const itemName = child.name && child.name.trim() !== ''
        ? child.name
        : `Imported_Mesh_${itemIndex + 1}`;

      const sceneItem: SceneItem = {
        id: generateImportId('imported-mesh', itemIndex),
        name: itemName,
        type: 'mesh',
        primitiveType: 'custom',
        transform,
        material,
        geometryParams: {
          customGeometry,
        },
        visible: child.visible !== false,
        locked: false,
        modifiers: [],
      };

      items.push(sceneItem);
      itemIndex++;
    }
  });

  return {
    items,
    format: 'unknown',
    stats: {
      totalObjects: items.length,
      totalVertices,
      totalTriangles,
      boundingBox: {
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
        size: [size.x, size.y, size.z],
      },
    },
  };
}

/**
 * Parses an OBJ file format from string text.
 */
export function parseOBJ(
  objContent: string,
  options: ImportModelOptions = {}
): ImportModelResult {
  if (!objContent || typeof objContent !== 'string' || objContent.trim() === '') {
    throw new Error('Invalid OBJ content: empty or missing string.');
  }

  const loader = new OBJLoader();
  const obj = loader.parse(objContent);
  const result = convertThreeObjectToSceneItems(obj, options);
  result.format = 'obj';
  return result;
}

/**
 * Parses an STL file format from ArrayBuffer or ASCII string.
 */
export function parseSTL(
  stlData: ArrayBuffer | string,
  options: ImportModelOptions = {}
): ImportModelResult {
  if (!stlData) {
    throw new Error('Invalid STL data: missing data buffer.');
  }

  const loader = new STLLoader();
  const geometry = loader.parse(stlData);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  const root = new THREE.Group();
  root.add(mesh);

  const result = convertThreeObjectToSceneItems(root, options);
  result.format = 'stl';
  return result;
}

/**
 * Extracts animation clips from GLTF into PolyForge AnimationTrack structures.
 */
export function extractGLTFAnimations(
  animations: THREE.AnimationClip[] | undefined,
  items: SceneItem[],
  fps: number = 30
): AnimationTrack[] {
  if (!animations || animations.length === 0 || items.length === 0) return [];

  const itemByName = new Map<string, SceneItem>();
  for (const item of items) {
    itemByName.set(item.name.toLowerCase().trim(), item);
    itemByName.set(item.id.toLowerCase().trim(), item);
    const sanitized = item.name.toLowerCase().trim().replace(/[\s\-_]+/g, '');
    itemByName.set(sanitized, item);
  }

  const trackMap = new Map<string, Map<number, Partial<Keyframe['transform']>>>();

  for (const clip of animations) {
    for (const track of clip.tracks) {
      const dotIdx = track.name.lastIndexOf('.');
      if (dotIdx === -1) continue;

      const nodeName = track.name.slice(0, dotIdx).toLowerCase().trim();
      const prop = track.name.slice(dotIdx + 1);

      let matchedItem = itemByName.get(nodeName);
      if (!matchedItem) {
        const sanitized = nodeName.replace(/[\s\-_]+/g, '');
        matchedItem = itemByName.get(sanitized);
      }
      if (!matchedItem) continue;

      if (!trackMap.has(matchedItem.id)) {
        trackMap.set(matchedItem.id, new Map());
      }
      const itemKeyframes = trackMap.get(matchedItem.id)!;

      const times = track.times;
      const values = track.values;

      if (prop === 'position') {
        for (let i = 0; i < times.length; i++) {
          const frame = Math.round(times[i] * fps);
          if (!itemKeyframes.has(frame)) itemKeyframes.set(frame, {});
          itemKeyframes.get(frame)!.position = [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]];
        }
      } else if (prop === 'quaternion') {
        for (let i = 0; i < times.length; i++) {
          const frame = Math.round(times[i] * fps);
          if (!itemKeyframes.has(frame)) itemKeyframes.set(frame, {});
          const q = new THREE.Quaternion(
            values[i * 4],
            values[i * 4 + 1],
            values[i * 4 + 2],
            values[i * 4 + 3]
          );
          const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
          itemKeyframes.get(frame)!.rotation = [e.x, e.y, e.z];
        }
      } else if (prop === 'scale') {
        for (let i = 0; i < times.length; i++) {
          const frame = Math.round(times[i] * fps);
          if (!itemKeyframes.has(frame)) itemKeyframes.set(frame, {});
          itemKeyframes.get(frame)!.scale = [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]];
        }
      }
    }
  }

  const resultTracks: AnimationTrack[] = [];
  for (const [objectId, frameMap] of trackMap.entries()) {
    const sortedFrames = Array.from(frameMap.keys()).sort((a, b) => a - b);
    const keyframes: Keyframe[] = [];

    let lastPos: [number, number, number] = [0, 0, 0];
    let lastRot: [number, number, number] = [0, 0, 0];
    let lastScale: [number, number, number] = [1, 1, 1];

    const item = items.find((it) => it.id === objectId);
    if (item?.transform) {
      lastPos = [...item.transform.position];
      lastRot = [...item.transform.rotation];
      lastScale = [...item.transform.scale];
    }

    for (const frame of sortedFrames) {
      const data = frameMap.get(frame)!;
      if (data.position) lastPos = data.position;
      if (data.rotation) lastRot = data.rotation;
      if (data.scale) lastScale = data.scale;

      keyframes.push({
        frame,
        transform: {
          position: [lastPos[0], lastPos[1], lastPos[2]],
          rotation: [lastRot[0], lastRot[1], lastRot[2]],
          scale: [lastScale[0], lastScale[1], lastScale[2]],
        },
        interpolation: 'linear',
      });
    }

    if (keyframes.length > 0) {
      resultTracks.push({
        objectId,
        keyframes,
      });
    }
  }

  return resultTracks;
}

/**
 * Parses a GLTF or GLB binary/JSON file from ArrayBuffer or JSON string.
 */
export async function parseGLTF(
  gltfData: ArrayBuffer | string,
  options: ImportModelOptions = {}
): Promise<ImportModelResult> {
  if (!gltfData) {
    throw new Error('Invalid GLTF data: missing data buffer.');
  }

  const loader = new GLTFLoader();

  return new Promise<ImportModelResult>((resolve, reject) => {
    try {
      loader.parse(
        gltfData,
        '',
        (gltf) => {
          const hasAnimations = Boolean(gltf.animations && gltf.animations.length > 0);
          const effectiveOptions = hasAnimations
            ? { ...options, preserveHierarchy: true, autoCenter: false, autoScale: false }
            : options;

          const result = convertThreeObjectToSceneItems(gltf.scene || new THREE.Group(), effectiveOptions);
          result.format = gltfData instanceof ArrayBuffer ? 'glb' : 'gltf';
          result.tracks = extractGLTFAnimations(gltf.animations, result.items);
          resolve(result);
        },
        (error) => {
          reject(new Error(`Failed to parse GLTF/GLB: ${error instanceof Error ? error.message : String(error)}`));
        }
      );
    } catch (err) {
      reject(new Error(`GLTFLoader threw an exception: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}

/**
 * High-level universal model importer that inspects file extension/MIME
 * and delegates to the appropriate specialized loader.
 */
export async function importModelFromFile(
  file: File,
  options: ImportModelOptions = {}
): Promise<ImportModelResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.obj')) {
    const text = await file.text();
    return parseOBJ(text, options);
  }

  if (fileName.endsWith('.stl')) {
    const buffer = await file.arrayBuffer();
    return parseSTL(buffer, options);
  }

  if (fileName.endsWith('.glb')) {
    const buffer = await file.arrayBuffer();
    return await parseGLTF(buffer, options);
  }

  if (fileName.endsWith('.gltf')) {
    const text = await file.text();
    return await parseGLTF(text, options);
  }

  throw new Error(`Unsupported 3D file format: ${file.name}. Supported formats: .obj, .gltf, .glb, .stl`);
}
