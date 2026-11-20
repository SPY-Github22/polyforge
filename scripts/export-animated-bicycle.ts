import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateAnimatedBicycleCircuit } from '../src/core/bicycle';
import { exportSceneToGLTFBuffer, ProjectSaveData } from '../src/core/io';

async function main() {
  console.log('Generating kinematically animated bicycle circuit...');
  const startTime = Date.now();

  const circuit = generateAnimatedBicycleCircuit({
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
    includeCables: true,
    includeDiscBrakes: true,
    includeReflectors: true,
  });

  console.log(`Generated ${circuit.items.length} sub-assemblies:`);
  for (const item of circuit.items) {
    const vCount = (item.geometryParams?.customGeometry?.positions.length ?? 0) / 3;
    const tCount = (item.geometryParams?.customGeometry?.indices?.length ?? 0) / 3;
    console.log(` - ${item.name} (${vCount} verts, ${tCount} tris)`);
  }

  console.log(`\nGenerated ${circuit.tracks.length} animation tracks (${circuit.tracks[0].keyframes.length} keyframes per track, ${circuit.totalFrames} frames @ ${circuit.fps} fps).`);

  // 1. Export Headless Animated GLB
  console.log('Exporting binary GLTF (.glb) with embedded animations...');
  const glbBuffer = await exportSceneToGLTFBuffer(circuit.items, true, circuit.tracks, circuit.fps);

  if (!(glbBuffer instanceof ArrayBuffer)) {
    throw new Error('GLTF export did not return ArrayBuffer');
  }

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const projectDir = path.resolve(__dirname, '..');

  const glbDownloadsPath = path.join(downloadsDir, 'PolyForge-Animated-Bicycle.glb');
  const glbProjectPath = path.join(projectDir, 'polyforge-animated-bicycle.glb');

  fs.writeFileSync(glbDownloadsPath, Buffer.from(glbBuffer));
  fs.writeFileSync(glbProjectPath, Buffer.from(glbBuffer));
  console.log(`Saved GLB to: ${glbDownloadsPath} (${(glbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Saved GLB to: ${glbProjectPath} (${(glbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  // 2. Export Project Save JSON
  console.log('Exporting PolyForge project JSON...');
  const projectData: ProjectSaveData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    items: circuit.items,
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

  const jsonString = JSON.stringify(projectData, null, 2);
  const jsonDownloadsPath = path.join(downloadsDir, 'PolyForge-Animated-Bicycle.json');
  const jsonProjectPath = path.join(projectDir, 'polyforge-animated-bicycle.json');

  fs.writeFileSync(jsonDownloadsPath, jsonString, 'utf-8');
  fs.writeFileSync(jsonProjectPath, jsonString, 'utf-8');
  console.log(`Saved JSON to: ${jsonDownloadsPath} (${(jsonString.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Saved JSON to: ${jsonProjectPath} (${(jsonString.length / 1024 / 1024).toFixed(2)} MB)`);

  console.log(`\nCompleted in ${((Date.now() - startTime) / 1000).toFixed(2)}s.`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
