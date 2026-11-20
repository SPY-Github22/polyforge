import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SceneItem, AnimationTrack, EnvironmentSettings } from '../types';

export interface ProjectSaveData {
  version: string;
  timestamp: string;
  items: SceneItem[];
  tracks: AnimationTrack[];
  environment: EnvironmentSettings;
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
 * Parses and validates an imported project JSON file string.
 */
export function parseProjectFile(jsonContent: string): ProjectSaveData {
  const parsed = JSON.parse(jsonContent) as ProjectSaveData;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('Invalid project file format: missing items array.');
  }
  return parsed;
}
