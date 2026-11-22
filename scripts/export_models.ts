import fs from 'fs';
import path from 'path';
import { generateRealisticFemaleScene, generateRealisticHumanScene } from '../src/core/character';
import { exportSceneToGLTFBuffer } from '../src/core/io';

async function main() {
  const artifactsDir = path.resolve('/home/sudpy/Projects/polyforge/artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log('Generating Female Models...');
  // 1. Female Clothed (Outer garments + hair)
  const femaleClothed = generateRealisticFemaleScene({
    modularBodyParts: true,
    includeClothing: true,
    includeAccessories: true,
    includeUnderwear: false,
  });
  const bufClothed = await exportSceneToGLTFBuffer(femaleClothed.allItems, true) as ArrayBuffer;
  fs.writeFileSync(path.join(artifactsDir, 'female_clothed.glb'), Buffer.from(bufClothed));
  console.log(`Saved female_clothed.glb (${bufClothed.byteLength} bytes)`);

  // 2. Female Underwear (Inner garments athletic top & briefs over modular anatomy)
  const femaleUnderwear = generateRealisticFemaleScene({
    modularBodyParts: true,
    includeClothing: false,
    includeAccessories: false,
    includeUnderwear: true,
  });
  const bufUnderwear = await exportSceneToGLTFBuffer(femaleUnderwear.allItems, true) as ArrayBuffer;
  fs.writeFileSync(path.join(artifactsDir, 'female_underwear.glb'), Buffer.from(bufUnderwear));
  console.log(`Saved female_underwear.glb (${bufUnderwear.byteLength} bytes)`);

  // 3. Female Bare (Pure high-poly organic anatomy without clothes or underwear)
  const femaleBare = generateRealisticFemaleScene({
    modularBodyParts: true,
    includeClothing: false,
    includeAccessories: false,
    includeUnderwear: false,
  });
  const bufBare = await exportSceneToGLTFBuffer(femaleBare.allItems, true) as ArrayBuffer;
  fs.writeFileSync(path.join(artifactsDir, 'female_bare.glb'), Buffer.from(bufBare));
  console.log(`Saved female_bare.glb (${bufBare.byteLength} bytes)`);

  // 4. Male Modular Underwear (Boxer briefs over modular anatomy)
  console.log('Generating Male Models...');
  const maleUnderwear = generateRealisticHumanScene({
    gender: 'male',
    modularBodyParts: true,
    includeClothing: false,
    includeAccessories: false,
    includeUnderwear: true,
  });
  const bufMaleUw = await exportSceneToGLTFBuffer(maleUnderwear.allItems, true) as ArrayBuffer;
  fs.writeFileSync(path.join(artifactsDir, 'male_underwear.glb'), Buffer.from(bufMaleUw));
  console.log(`Saved male_underwear.glb (${bufMaleUw.byteLength} bytes)`);

  // 5. Male Clothed (Suit)
  const maleClothed = generateRealisticHumanScene({
    gender: 'male',
    modularBodyParts: true,
    includeClothing: true,
    includeAccessories: true,
    includeUnderwear: false,
  });
  const bufMaleClothed = await exportSceneToGLTFBuffer(maleClothed.allItems, true) as ArrayBuffer;
  fs.writeFileSync(path.join(artifactsDir, 'male_clothed.glb'), Buffer.from(bufMaleClothed));
  console.log(`Saved male_clothed.glb (${bufMaleClothed.byteLength} bytes)`);

  console.log('All GLBs exported successfully!');
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
