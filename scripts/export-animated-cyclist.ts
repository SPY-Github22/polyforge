import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { generateAnimatedCyclistCircuit } from '../src/core/cyclist';
import { generateRealisticFemaleScene } from '../src/core/character';
import { exportSceneToGLTFBuffer, ProjectSaveData } from '../src/core/io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('--- 1. Generating Kinematically Animated Cyclist Circuit ---');
  const startTime = Date.now();

  const circuit = generateAnimatedCyclistCircuit({
    totalFrames: 360,
    fps: 30,
    turnRadius: 2.5,
    wheelRadius: 0.34,
    gearRatio: 2.4,
    frameColor: '#c01525',
    frameMaterial: 'gloss',
    componentsColor: '#dce3eb',
    handlebarStyle: 'drop',
    pedalStyle: 'platform',
    spokeCount: 32,
    gender: 'female',
    characterOptions: {
      topColor: '#e11d48',
      pantsColor: '#1e293b',
      shoesColor: '#f8fafc',
      skinColor: '#e0ac82',
      hairColor: '#261a15',
    },
  });

  console.log(`Generated ${circuit.allItems.length} sub-assemblies (7 bicycle + 5 cyclist):`);
  for (const item of circuit.allItems) {
    const vCount = (item.geometryParams?.customGeometry?.positions.length ?? 0) / 3;
    const tCount = (item.geometryParams?.customGeometry?.indices?.length ?? 0) / 3;
    console.log(` - [${item.id}] ${item.name} (${vCount} verts, ${tCount} tris)`);
  }

  console.log(`\nGenerated ${circuit.tracks.length} animation tracks (${circuit.tracks[0].keyframes.length} keyframes per track, ${circuit.totalFrames} frames @ ${circuit.fps} fps).`);

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const projectDir = path.resolve(__dirname, '..');

  // Export Headless Animated Cyclist GLB
  console.log('Exporting binary GLTF (.glb) with embedded animations...');
  const cyclistGlbBuffer = await exportSceneToGLTFBuffer(circuit.allItems, true, circuit.tracks, circuit.fps);

  if (!(cyclistGlbBuffer instanceof ArrayBuffer)) {
    throw new Error('Cyclist GLTF export did not return ArrayBuffer');
  }

  const glbDownloadsPath = path.join(downloadsDir, 'PolyForge-Animated-Cyclist.glb');
  const glbProjectPath = path.join(projectDir, 'polyforge-animated-cyclist.glb');

  fs.writeFileSync(glbDownloadsPath, Buffer.from(cyclistGlbBuffer));
  fs.writeFileSync(glbProjectPath, Buffer.from(cyclistGlbBuffer));
  console.log(`Saved GLB to: ${glbDownloadsPath} (${(cyclistGlbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Saved GLB to: ${glbProjectPath} (${(cyclistGlbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  // Export Project Save JSON
  console.log('Exporting PolyForge project JSON...');
  const cyclistProjectData: ProjectSaveData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    items: circuit.allItems,
    tracks: circuit.tracks,
    environment: {
      backgroundColor: '#0a0f1d',
      ambientIntensity: 0.8,
      directionalIntensity: 1.5,
      showGrid: true,
      showAxes: true,
      shadows: true,
      preset: 'studio',
    },
  };

  const jsonString = JSON.stringify(cyclistProjectData, null, 2);
  const jsonDownloadsPath = path.join(downloadsDir, 'PolyForge-Animated-Cyclist.json');
  const jsonProjectPath = path.join(projectDir, 'polyforge-animated-cyclist.json');

  fs.writeFileSync(jsonDownloadsPath, jsonString, 'utf-8');
  fs.writeFileSync(jsonProjectPath, jsonString, 'utf-8');
  console.log(`Saved JSON to: ${jsonDownloadsPath} (${(jsonString.length / 1024 / 1024).toFixed(2)} MB)`);

  // 2. Re-export Refined Realistic Female Character (Softened face, clean hem)
  console.log('\n--- 2. Exporting Refined Realistic Female Character ---');
  const femaleScene = generateRealisticFemaleScene();
  const femaleGlbBuffer = await exportSceneToGLTFBuffer(femaleScene.allItems, true);

  if (femaleGlbBuffer instanceof ArrayBuffer) {
    const femaleGlbPath = path.join(downloadsDir, 'PolyForge-Realistic-Female.glb');
    fs.writeFileSync(femaleGlbPath, Buffer.from(femaleGlbBuffer));
    console.log(`Updated Female GLB at: ${femaleGlbPath} (${(femaleGlbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  }

  const femaleProjectData: ProjectSaveData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    items: femaleScene.allItems,
    tracks: [],
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

  const femaleJsonString = JSON.stringify(femaleProjectData, null, 2);
  const femaleJsonPath = path.join(downloadsDir, 'PolyForge-Realistic-Female.json');
  fs.writeFileSync(femaleJsonPath, femaleJsonString, 'utf-8');
  console.log(`Updated Female JSON at: ${femaleJsonPath} (${(femaleJsonString.length / 1024 / 1024).toFixed(2)} MB)`);

  console.log(`\nCompleted in ${((Date.now() - startTime) / 1000).toFixed(2)}s.`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
