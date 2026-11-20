import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SceneItem, AnimationTrack, EnvironmentSettings, MaterialProperties, Modifier } from '../types';
import { createPrimitiveGeometry, applyModifiers } from './geometry';
import { createMaterial } from './material';

export interface ProjectSaveData {
  version: string;
  timestamp: string;
  items: SceneItem[];
  tracks: AnimationTrack[];
  environment: EnvironmentSettings;
}

const DEFAULT_MATERIAL: MaterialProperties = {
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
};

const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  backgroundColor: '#0d1117',
  ambientIntensity: 0.6,
  directionalIntensity: 1.2,
  showGrid: true,
  showAxes: true,
  shadows: true,
  preset: 'studio',
};

/**
 * Constructs a Three.js Object3D Group from an array of SceneItems.
 * Works headlessly in Node.js without requiring a WebGL context or browser DOM.
 */
export function buildThreeGroupFromItems(items: SceneItem[]): THREE.Group {
  const group = new THREE.Group();
  for (const item of items) {
    if (!item.visible) continue;
    try {
      const baseGeo = createPrimitiveGeometry(item.primitiveType || 'box', item.geometryParams);
      const geoWithMods = applyModifiers(baseGeo, item.modifiers);
      const mat = createMaterial(item.material, 'rendered');
      const mesh = new THREE.Mesh(geoWithMods, mat);
      mesh.name = item.name;
      mesh.position.set(item.transform.position[0], item.transform.position[1], item.transform.position[2]);
      mesh.rotation.set(item.transform.rotation[0], item.transform.rotation[1], item.transform.rotation[2]);
      mesh.scale.set(item.transform.scale[0], item.transform.scale[1], item.transform.scale[2]);
      group.add(mesh);
    } catch (err) {
      // Gracefully continue if an item fails geometry construction
      console.warn(`[IO Warning] Failed to construct mesh for "${item.name}":`, err);
    }
  }
  return group;
}

/**
 * Headless export: converts SceneItem[] directly to a Wavefront OBJ string.
 * Works in both browser and server/CLI environments.
 */
export function exportSceneToOBJString(items: SceneItem[]): string {
  const group = buildThreeGroupFromItems(items);
  const exporter = new OBJExporter();
  return exporter.parse(group);
}

/**
 * Headless export: converts SceneItem[] directly to an ASCII STL string.
 * Works in both browser and server/CLI environments.
 */
export function exportSceneToSTLString(items: SceneItem[]): string {
  const group = buildThreeGroupFromItems(items);
  const exporter = new STLExporter();
  const res = exporter.parse(group, { binary: false }) as string | DataView;
  return typeof res === 'string' ? res : new TextDecoder().decode(res.buffer);
}

/**
 * Triggers a client-side browser file download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a text/JSON download.
 */
export function downloadText(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Exports a Three.js Object3D / Scene to GLTF or GLB binary format.
 */
export function exportToGLTF(
  root: THREE.Object3D,
  binary: boolean = true,
  filename: string = 'polyforge-export'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      root,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          downloadBlob(blob, `${filename}.glb`);
        } else {
          const output = JSON.stringify(result, null, 2);
          downloadText(output, `${filename}.gltf`, 'application/json');
        }
        resolve();
      },
      (error) => {
        console.error('An error occurred during GLTF export:', error);
        reject(error);
      },
      { binary, embedImages: true }
    );
  });
}

/**
 * Exports a Three.js Object3D / Scene to Wavefront OBJ format.
 */
export function exportToOBJ(root: THREE.Object3D, filename: string = 'polyforge-export'): void {
  const exporter = new OBJExporter();
  const result = exporter.parse(root);
  downloadText(result, `${filename}.obj`, 'text/plain');
}

/**
 * Exports a Three.js Object3D / Scene to STL 3D printing format.
 */
export function exportToSTL(
  root: THREE.Object3D,
  binary: boolean = true,
  filename: string = 'polyforge-export'
): void {
  const exporter = new STLExporter();
  const result = exporter.parse(root, { binary });
  if (result instanceof DataView) {
    const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    downloadBlob(blob, `${filename}.stl`);
  } else {
    downloadText(result, `${filename}.stl`, 'text/plain');
  }
}

/**
 * Captures a high-resolution PNG snapshot from the WebGLRenderer canvas.
 */
export function captureViewportImage(
  renderer: THREE.WebGLRenderer,
  filename: string = 'polyforge-render.png'
): void {
  const dataURL = renderer.domElement.toDataURL('image/png');
  const anchor = document.createElement('a');
  anchor.href = dataURL;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Serializes project scene and animation state to a downloadable JSON file.
 */
export function exportProjectFile(
  items: SceneItem[],
  tracks: AnimationTrack[],
  environment: EnvironmentSettings,
  filename: string = 'polyforge-scene.json'
): void {
  const project: ProjectSaveData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    items,
    tracks,
    environment,
  };
  const json = JSON.stringify(project, null, 2);
  downloadText(json, filename, 'application/json');
}

/**
 * Parses, validates, and heals an imported project JSON file string against missing/malformed fields.
 */
export function parseProjectFile(jsonContent: string): ProjectSaveData {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    throw new Error(`Corrupted JSON file: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
    throw new Error('Invalid project file format: missing items array.');
  }

  const sanitizedItems: SceneItem[] = parsed.items.map((item: any, idx: number) => {
    const raw = typeof item === 'object' && item !== null ? item : {};
    const pos =
      Array.isArray(raw.transform?.position) && raw.transform.position.length === 3
        ? [
            Number(raw.transform.position[0]) || 0,
            Number(raw.transform.position[1]) || 0,
            Number(raw.transform.position[2]) || 0,
          ] as [number, number, number]
        : ([0, 0, 0] as [number, number, number]);

    const rot =
      Array.isArray(raw.transform?.rotation) && raw.transform.rotation.length === 3
        ? [
            Number(raw.transform.rotation[0]) || 0,
            Number(raw.transform.rotation[1]) || 0,
            Number(raw.transform.rotation[2]) || 0,
          ] as [number, number, number]
        : ([0, 0, 0] as [number, number, number]);

    const sca =
      Array.isArray(raw.transform?.scale) && raw.transform.scale.length === 3
        ? [
            Number(raw.transform.scale[0]) || 1,
            Number(raw.transform.scale[1]) || 1,
            Number(raw.transform.scale[2]) || 1,
          ] as [number, number, number]
        : ([1, 1, 1] as [number, number, number]);

    const rawMat = typeof raw.material === 'object' && raw.material !== null ? raw.material : {};
    const material: MaterialProperties = {
      color: typeof rawMat.color === 'string' ? rawMat.color : DEFAULT_MATERIAL.color,
      roughness: typeof rawMat.roughness === 'number' ? rawMat.roughness : DEFAULT_MATERIAL.roughness,
      metalness: typeof rawMat.metalness === 'number' ? rawMat.metalness : DEFAULT_MATERIAL.metalness,
      emissive: typeof rawMat.emissive === 'string' ? rawMat.emissive : DEFAULT_MATERIAL.emissive,
      emissiveIntensity:
        typeof rawMat.emissiveIntensity === 'number'
          ? rawMat.emissiveIntensity
          : DEFAULT_MATERIAL.emissiveIntensity,
      transmission:
        typeof rawMat.transmission === 'number'
          ? rawMat.transmission
          : DEFAULT_MATERIAL.transmission,
      opacity: typeof rawMat.opacity === 'number' ? rawMat.opacity : DEFAULT_MATERIAL.opacity,
      transparent: Boolean(rawMat.transparent),
      wireframe: Boolean(rawMat.wireframe),
      texturePreset: ['none', 'checker', 'uv_grid', 'stripes'].includes(rawMat.texturePreset)
        ? rawMat.texturePreset
        : 'none',
    };

    const sanitizedModifiers: Modifier[] = Array.isArray(raw.modifiers)
      ? raw.modifiers
          .filter((m: any) => m && typeof m === 'object' && typeof m.type === 'string')
          .map((m: any, mIdx: number) => ({
            id: typeof m.id === 'string' ? m.id : `mod-${mIdx}`,
            type: ['subdivide', 'noise_displace', 'twist', 'smooth'].includes(m.type)
              ? m.type
              : 'smooth',
            factor: typeof m.factor === 'number' ? m.factor : 1,
            enabled: m.enabled !== false,
          }))
      : [];

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : `imported-${idx}-${Date.now().toString(36)}`,
      name: typeof raw.name === 'string' && raw.name ? raw.name : `Object ${idx + 1}`,
      type: raw.type === 'light' || raw.type === 'group' ? raw.type : 'mesh',
      primitiveType: raw.primitiveType || 'box',
      transform: { position: pos, rotation: rot, scale: sca },
      material,
      visible: raw.visible !== false,
      locked: Boolean(raw.locked),
      modifiers: sanitizedModifiers,
      geometryParams: raw.geometryParams || {},
    };
  });

  const sanitizedTracks: AnimationTrack[] = Array.isArray(parsed.tracks)
    ? parsed.tracks
        .filter((t: any) => t && typeof t === 'object' && typeof t.objectId === 'string')
        .map((t: any) => ({
          objectId: t.objectId,
          keyframes: Array.isArray(t.keyframes)
            ? t.keyframes.map((k: any) => ({
                frame: typeof k.frame === 'number' ? k.frame : 0,
                transform: {
                  position: Array.isArray(k.transform?.position)
                    ? [
                        Number(k.transform.position[0]) || 0,
                        Number(k.transform.position[1]) || 0,
                        Number(k.transform.position[2]) || 0,
                      ]
                    : [0, 0, 0],
                  rotation: Array.isArray(k.transform?.rotation)
                    ? [
                        Number(k.transform.rotation[0]) || 0,
                        Number(k.transform.rotation[1]) || 0,
                        Number(k.transform.rotation[2]) || 0,
                      ]
                    : [0, 0, 0],
                  scale: Array.isArray(k.transform?.scale)
                    ? [
                        Number(k.transform.scale[0]) || 1,
                        Number(k.transform.scale[1]) || 1,
                        Number(k.transform.scale[2]) || 1,
                      ]
                    : [1, 1, 1],
                },
                interpolation: ['linear', 'ease-in-out', 'step'].includes(k.interpolation)
                  ? k.interpolation
                  : 'linear',
              }))
            : [],
        }))
    : [];

  const rawEnv =
    typeof parsed.environment === 'object' && parsed.environment !== null ? parsed.environment : {};
  const sanitizedEnv: EnvironmentSettings = {
    backgroundColor:
      typeof rawEnv.backgroundColor === 'string'
        ? rawEnv.backgroundColor
        : DEFAULT_ENVIRONMENT.backgroundColor,
    ambientIntensity:
      typeof rawEnv.ambientIntensity === 'number'
        ? rawEnv.ambientIntensity
        : DEFAULT_ENVIRONMENT.ambientIntensity,
    directionalIntensity:
      typeof rawEnv.directionalIntensity === 'number'
        ? rawEnv.directionalIntensity
        : DEFAULT_ENVIRONMENT.directionalIntensity,
    showGrid: rawEnv.showGrid !== false,
    showAxes: rawEnv.showAxes !== false,
    shadows: rawEnv.shadows !== false,
    preset: ['studio', 'sunset', 'cyberpunk', 'dawn'].includes(rawEnv.preset)
      ? rawEnv.preset
      : DEFAULT_ENVIRONMENT.preset,
  };

  return {
    version: typeof parsed.version === 'string' ? parsed.version : '1.0.0',
    timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
    items: sanitizedItems,
    tracks: sanitizedTracks,
    environment: sanitizedEnv,
  };
}
