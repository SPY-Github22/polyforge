import * as fs from 'fs';
import * as THREE from 'three';
import { generateRealisticHumanScene } from '../src/core/character';
import { exportSceneToGLTFBuffer, ProjectSaveData } from '../src/core/io';

async function main() {
  console.log('Generating procedural realistic human scene...');
  const human = generateRealisticHumanScene();

  console.log('Stats:');
  console.log(human.stats);

  console.log('Exporting GLB binary...');
  const glbBuffer = (await exportSceneToGLTFBuffer(human.allItems, true)) as ArrayBuffer;
  const glbPath = '/home/sudpy/Downloads/PolyForge-Realistic-Human.glb';
  fs.writeFileSync(glbPath, Buffer.from(glbBuffer));
  console.log(`Saved GLB to ${glbPath} (${glbBuffer.byteLength} bytes)`);

  const projectData: ProjectSaveData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    items: human.allItems,
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

  const jsonPath = '/home/sudpy/Downloads/PolyForge-Realistic-Human.json';
  fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2));
  console.log(`Saved full project JSON to ${jsonPath}`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
