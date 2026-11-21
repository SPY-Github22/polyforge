import * as fs from 'fs';
import * as THREE from 'three';
import { generateRealisticFemaleScene } from '../src/core/character';
import { exportSceneToGLTFBuffer, ProjectSaveData } from '../src/core/io';

async function main() {
  console.log('Generating procedural realistic female scene...');
  const female = generateRealisticFemaleScene({
    topColor: '#e11d48',    // Fitted crimson/rose top
    pantsColor: '#1e293b',  // High-waisted denim jeans
    shoesColor: '#f8fafc',  // White sneakers
    skinColor: '#e0ac82',   // Warm peach melanin
    hairColor: '#261a15',   // Brunette layered hair
    watchColor: '#cbd5e1',  // Silver smartwatch
  });

  console.log('Stats:');
  console.log(female.stats);

  console.log('Exporting GLB binary...');
  const glbBuffer = (await exportSceneToGLTFBuffer(female.allItems, true)) as ArrayBuffer;
  const glbPath = '/home/sudpy/Downloads/PolyForge-Realistic-Female.glb';
  fs.writeFileSync(glbPath, Buffer.from(glbBuffer));
  console.log(`Saved GLB to ${glbPath} (${glbBuffer.byteLength} bytes)`);

  const projectData: ProjectSaveData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    items: female.allItems,
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

  const jsonPath = '/home/sudpy/Downloads/PolyForge-Realistic-Female.json';
  fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2));
  console.log(`Saved full project JSON to ${jsonPath}`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
