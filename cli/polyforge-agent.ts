#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PROCEDURAL_TEMPLATES, matchProceduralTemplate } from '../src/core/ai/procedural';
import { ProceduralTemplateId } from '../src/core/ai/types';
import { executePolyForgeScript } from '../src/core/ai/api';
import { exportSceneToOBJString, exportSceneToSTLString, exportSceneToGLTFBuffer, parseProjectFile } from '../src/core/io';
import { PolyForgeMCPServer } from './polyforge-mcp';
import { EnvironmentSettings, TimelineState } from '../src/types';
import { generateBotanicalOakTree } from '../src/core/botany';
import { generateRealisticBicycle } from '../src/core/bicycle';

const defaultEnv: EnvironmentSettings = {
  backgroundColor: '#0d1117',
  ambientIntensity: 0.6,
  directionalIntensity: 1.2,
  showGrid: true,
  showAxes: true,
  shadows: true,
  preset: 'studio',
};

const defaultTimeline: TimelineState = {
  currentFrame: 0,
  totalFrames: 120,
  fps: 30,
  isPlaying: false,
  isLooping: true,
  autoKeying: false,
};

function printHelp() {
  console.log(`
PolyForge AI Headless Agent CLI & MCP Engine
============================================
Programmatic 3D scene generation, scripting, inspection, and Model Context Protocol interface.

Usage:
  npx tsx cli/polyforge-agent.ts <command> [options]

Commands:
  list-templates                                          List all built-in procedural 3D model generators
  generate --template <id> [--out <f>]                    Synthesize a 3D model from a template ID
  prompt "<natural language>" [--out <f>]                  Synthesize a 3D model matching a prompt
  run-script <script.js> [--scene <scene.json>] [--out <f>] Execute a PolyForge script in sandbox
  generate-tree [--out <f>] [--format <obj|stl|glb|json>] Synthesize an ultra-realistic high-poly botanical oak tree
  generate-bicycle [--out <f>] [--format <obj|stl|glb|json>] [--handlebar <drop|flat>] [--pedals <platform|clipless>] [--spokes <n>] [--wheelsize <r>] Synthesize an ultra-realistic mechanically precise bicycle
  export <scene.json> --format <obj|stl|glb|json> [--out <f>] Export a scene to 3D geometry formats
  inspect <scene.json>                                    Display detailed summary and metrics of a scene file
  mcp                                                     Launch the Model Context Protocol stdio server

Options:
  --out, -o <file>        Output file path (defaults to ./polyforge-output.json or model format)
  --format, -f <fmt>      Export format: obj, stl, or json
  --scene, -s <file>      Input scene file to execute script against
  --help, -h              Show this help screen
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  const getArgValue = (flag: string, alias?: string): string | null => {
    const idx = args.findIndex((a) => a === flag || (alias && a === alias));
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return null;
  };

  switch (command) {
    case 'mcp': {
      const server = new PolyForgeMCPServer();
      server.startStdio();
      break;
    }

    case 'list-templates': {
      console.log('\nAvailable Deeply Architected Templates:');
      console.log('---------------------------------------');
      for (const [id, tmpl] of Object.entries(PROCEDURAL_TEMPLATES)) {
        console.log(`• [${tmpl.category}] ID: ${id}`);
        console.log(`  Name: ${tmpl.name}`);
        console.log(`  Description: ${tmpl.description}`);
        console.log(`  Tags: ${tmpl.tags.join(', ')}\n`);
      }
      break;
    }

    case 'generate': {
      const templateId = getArgValue('--template', '-t') as ProceduralTemplateId | null;
      if (!templateId || !PROCEDURAL_TEMPLATES[templateId]) {
        console.error(`Error: Missing or invalid template ID. Choose from: ${Object.keys(PROCEDURAL_TEMPLATES).join(', ')}`);
        process.exit(1);
      }

      const tmpl = PROCEDURAL_TEMPLATES[templateId];
      console.log(`[PolyForge Agent] Synthesizing template: "${tmpl.name}"...`);
      const result = tmpl.generate();

      const outputData = {
        version: '1.0.0',
        generator: `PolyForge AI Agent (${tmpl.id})`,
        createdAt: new Date().toISOString(),
        environment: result.environment ? { ...defaultEnv, ...result.environment } : defaultEnv,
        items: result.items,
        tracks: result.tracks,
        timeline: result.timeline ? { ...defaultTimeline, ...result.timeline } : defaultTimeline,
      };

      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), `${templateId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
      console.log(`[PolyForge Agent] Generated ${result.items.length} objects and ${result.tracks.length} animation tracks.`);
      console.log(`[PolyForge Agent] Saved project to: ${outPath}`);
      break;
    }

    case 'generate-tree': {
      console.log('[PolyForge Agent] Synthesizing realistic botanical oak tree...');
      const seed = parseInt(getArgValue('--seed') || '2026', 10);
      const leafCount = parseInt(getArgValue('--leaf-count') || '3800', 10);
      const height = parseFloat(getArgValue('--height') || '9.2');
      const leafScale = parseFloat(getArgValue('--leaf-scale') || '0.48');

      const tree = generateBotanicalOakTree({
        seed,
        leafCount,
        leafScale,
        trunkHeight: height,
        radialSegments: 14,
      });

      console.log(`[PolyForge Agent] Tree generated: ${tree.stats.totalVertices} vertices, ${tree.stats.totalTriangles} triangles across 3 sub-meshes.`);
      console.log(`  • Trunk (Wood - Bark): ${tree.stats.barkVertices} verts, ${tree.stats.barkTriangles} tris`);
      console.log(`  • Canopy Foliage (Leaf Oak & Leaf Oak2): ${tree.stats.leafVertices} verts, ${tree.stats.leafTriangles} tris`);

      const fmt = (getArgValue('--format', '-f') || 'json').toLowerCase();
      const defaultName = `realistic-oak-tree.${fmt === 'json' ? 'json' : fmt}`;
      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), defaultName);

      if (fmt === 'obj') {
        const objString = exportSceneToOBJString(tree.allItems);
        fs.writeFileSync(outPath, objString, 'utf-8');
        console.log(`[PolyForge Agent] Exported tree OBJ to: ${outPath}`);
      } else if (fmt === 'stl') {
        const stlString = exportSceneToSTLString(tree.allItems);
        fs.writeFileSync(outPath, stlString, 'utf-8');
        console.log(`[PolyForge Agent] Exported tree STL to: ${outPath}`);
      } else if (fmt === 'glb') {
        const glbBuffer = await exportSceneToGLTFBuffer(tree.allItems, true);
        fs.writeFileSync(outPath, Buffer.from(glbBuffer as ArrayBuffer));
        console.log(`[PolyForge Agent] Exported tree GLB (${(glbBuffer as ArrayBuffer).byteLength} bytes) to: ${outPath}`);
      } else if (fmt === 'gltf') {
        const gltfObj = await exportSceneToGLTFBuffer(tree.allItems, false);
        fs.writeFileSync(outPath, JSON.stringify(gltfObj, null, 2), 'utf-8');
        console.log(`[PolyForge Agent] Exported tree glTF to: ${outPath}`);
      } else {
        const outputData = {
          version: '1.0.0',
          generator: 'PolyForge Botanical Engine (Quercus robur)',
          createdAt: new Date().toISOString(),
          environment: defaultEnv,
          items: tree.allItems,
          tracks: [],
          timeline: defaultTimeline,
          stats: tree.stats,
        };
        fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
        console.log(`[PolyForge Agent] Saved project JSON to: ${outPath}`);
      }
      break;
    }

    case 'generate-bicycle': {
      console.log('[PolyForge Agent] Synthesizing ultra-realistic mechanically precise bicycle...');
      const frameColor = getArgValue('--frame-color') || '#c01525';
      const frameMaterial = (getArgValue('--frame-material') || 'gloss') as 'gloss' | 'matte' | 'carbon';
      const handlebarStyle = (getArgValue('--handlebar') || 'drop') as 'drop' | 'flat';
      const pedalStyle = (getArgValue('--pedals') || 'platform') as 'platform' | 'clipless';
      const spokeCount = parseInt(getArgValue('--spokes') || '32', 10);
      const wheelSizeVal = getArgValue('--wheelsize');
      const wheelSize = wheelSizeVal ? parseFloat(wheelSizeVal) : undefined;

      const bike = generateRealisticBicycle({
        frameColor,
        frameMaterial,
        handlebarStyle,
        pedalStyle,
        wheelSize,
        spokeCount,
      });

      console.log(`[PolyForge Agent] Bicycle generated: ${bike.stats.totalVertices} vertices, ${bike.stats.totalTriangles} triangles across ${bike.stats.componentsCount} sub-assemblies.`);
      console.log(`  • Frame: ${bike.stats.frameVertices} verts, ${bike.stats.frameTriangles} tris`);
      console.log(`  • Cockpit & Fork: ${bike.stats.forkCockpitVertices} verts, ${bike.stats.forkCockpitTriangles} tris`);
      console.log(`  • Wheels & Rotors: ${bike.stats.wheelsVertices} verts, ${bike.stats.wheelsTriangles} tris`);
      console.log(`  • Drivetrain & Chain: ${bike.stats.drivetrainVertices} verts, ${bike.stats.drivetrainTriangles} tris`);
      console.log(`  • Saddle & Seatpost: ${bike.stats.saddleSeatpostVertices} verts, ${bike.stats.saddleSeatpostTriangles} tris`);
      console.log(`  • Cables & Reflectors: ${bike.stats.accessoriesVertices} verts, ${bike.stats.accessoriesTriangles} tris`);

      const fmt = (getArgValue('--format', '-f') || 'json').toLowerCase();
      const defaultName = `realistic-bicycle.${fmt === 'json' ? 'json' : fmt}`;
      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), defaultName);

      if (fmt === 'obj') {
        const objString = exportSceneToOBJString(bike.allItems);
        fs.writeFileSync(outPath, objString, 'utf-8');
        console.log(`[PolyForge Agent] Exported bicycle OBJ to: ${outPath}`);
      } else if (fmt === 'stl') {
        const stlString = exportSceneToSTLString(bike.allItems);
        fs.writeFileSync(outPath, stlString, 'utf-8');
        console.log(`[PolyForge Agent] Exported bicycle STL to: ${outPath}`);
      } else if (fmt === 'glb') {
        const glbBuffer = await exportSceneToGLTFBuffer(bike.allItems, true);
        fs.writeFileSync(outPath, Buffer.from(glbBuffer as ArrayBuffer));
        console.log(`[PolyForge Agent] Exported bicycle GLB (${(glbBuffer as ArrayBuffer).byteLength} bytes) to: ${outPath}`);
      } else if (fmt === 'gltf') {
        const gltfObj = await exportSceneToGLTFBuffer(bike.allItems, false);
        fs.writeFileSync(outPath, JSON.stringify(gltfObj, null, 2), 'utf-8');
        console.log(`[PolyForge Agent] Exported bicycle glTF to: ${outPath}`);
      } else {
        const outputData = {
          version: '1.0.0',
          generator: 'PolyForge Mechanical Engine (Bicycle)',
          createdAt: new Date().toISOString(),
          environment: {
            ...defaultEnv,
            preset: 'studio' as const,
          },
          items: bike.allItems,
          tracks: [],
          timeline: defaultTimeline,
          stats: bike.stats,
        };
        fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
        console.log(`[PolyForge Agent] Saved project JSON to: ${outPath}`);
      }
      break;
    }

    case 'prompt': {
      const query = args[1];
      if (!query || query.startsWith('-')) {
        console.error('Error: Please provide a prompt in quotes, e.g. npx tsx cli/polyforge-agent.ts prompt "orbital solar system"');
        process.exit(1);
      }

      const matched = matchProceduralTemplate(query);
      console.log(`[PolyForge Agent] Prompt matched to: "${matched.name}" (${matched.category})`);
      const result = matched.generate();

      const outputData = {
        version: '1.0.0',
        generator: `PolyForge AI Agent (${matched.id})`,
        prompt: query,
        createdAt: new Date().toISOString(),
        environment: result.environment ? { ...defaultEnv, ...result.environment } : defaultEnv,
        items: result.items,
        tracks: result.tracks,
        timeline: result.timeline ? { ...defaultTimeline, ...result.timeline } : defaultTimeline,
      };

      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), 'ai-generated-scene.json');
      fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
      console.log(`[PolyForge Agent] Successfully synthesized ${result.items.length} 3D objects and ${result.tracks.length} animated tracks.`);
      console.log(`[PolyForge Agent] Output written to: ${outPath}`);
      break;
    }

    case 'run-script': {
      const scriptPath = args[1];
      if (!scriptPath || !fs.existsSync(scriptPath)) {
        console.error(`Error: Script file not found: ${scriptPath}`);
        process.exit(1);
      }

      const scriptCode = fs.readFileSync(scriptPath, 'utf-8');
      console.log(`[PolyForge Agent] Executing script: ${scriptPath}...`);

      let initialItems: any[] = [];
      let initialTracks: any[] = [];
      let initialEnv = { ...defaultEnv };
      let initialTimeline = { ...defaultTimeline };

      const sceneFlag = getArgValue('--scene', '-s');
      if (sceneFlag) {
        if (!fs.existsSync(sceneFlag)) {
          console.error(`Error: Input scene file not found: ${sceneFlag}`);
          process.exit(1);
        }
        const sceneData = parseProjectFile(fs.readFileSync(sceneFlag, 'utf-8'));
        initialItems = sceneData.items;
        initialTracks = sceneData.tracks || [];
        if (sceneData.environment) initialEnv = sceneData.environment;
        console.log(`[PolyForge Agent] Loaded base scene from ${sceneFlag} with ${initialItems.length} objects.`);
      }

      const execution = await executePolyForgeScript(scriptCode, {
        items: initialItems,
        tracks: initialTracks,
        environment: initialEnv,
        timeline: initialTimeline,
      });

      if (!execution.success) {
        console.error(`[Execution Error] ${execution.error}`);
        process.exit(1);
      }

      for (const log of execution.logs) {
        console.log(`[Script Log] ${log}`);
      }

      const outputData = {
        version: '1.0.0',
        generator: 'PolyForge Script Execution Engine',
        createdAt: new Date().toISOString(),
        environment: execution.environment || defaultEnv,
        items: execution.items,
        tracks: execution.tracks,
        timeline: execution.timeline ? { ...defaultTimeline, ...execution.timeline } : defaultTimeline,
      };

      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), 'script-output.json');
      fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
      console.log(`[PolyForge Agent] Total objects in scene: ${execution.items.length}, animation tracks: ${execution.tracks.length}.`);
      console.log(`[PolyForge Agent] Saved to: ${outPath}`);
      break;
    }

    case 'export': {
      const filePath = args[1];
      if (!filePath || !fs.existsSync(filePath)) {
        console.error(`Error: Scene file not found: ${filePath}`);
        process.exit(1);
      }

      const sceneData = parseProjectFile(fs.readFileSync(filePath, 'utf-8'));
      const format = (getArgValue('--format', '-f') || 'obj').toLowerCase();
      const defaultExt = format === 'stl' ? 'stl' : format === 'obj' ? 'obj' : 'json';
      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), `${path.parse(filePath).name}.${defaultExt}`);

      console.log(`[PolyForge Agent] Exporting ${sceneData.items.length} objects to ${format.toUpperCase()}...`);

      if (format === 'obj') {
        const objText = exportSceneToOBJString(sceneData.items);
        fs.writeFileSync(outPath, objText, 'utf-8');
        console.log(`[PolyForge Agent] Successfully exported OBJ (${objText.length} bytes) to: ${outPath}`);
      } else if (format === 'stl') {
        const stlText = exportSceneToSTLString(sceneData.items);
        fs.writeFileSync(outPath, stlText, 'utf-8');
        console.log(`[PolyForge Agent] Successfully exported STL (${stlText.length} bytes) to: ${outPath}`);
      } else if (format === 'json') {
        fs.writeFileSync(outPath, JSON.stringify(sceneData, null, 2), 'utf-8');
        console.log(`[PolyForge Agent] Successfully exported JSON to: ${outPath}`);
      } else if (format === 'glb') {
        const glbBuf = await exportSceneToGLTFBuffer(sceneData.items, true);
        fs.writeFileSync(outPath, Buffer.from(glbBuf as ArrayBuffer));
        console.log(`[PolyForge Agent] Successfully exported GLB to: ${outPath}`);
      } else if (format === 'gltf') {
        const gltfObj = await exportSceneToGLTFBuffer(sceneData.items, false);
        fs.writeFileSync(outPath, JSON.stringify(gltfObj, null, 2), 'utf-8');
        console.log(`[PolyForge Agent] Successfully exported glTF to: ${outPath}`);
      } else {
        console.error(`Error: Unsupported export format: ${format}. Choose "obj", "stl", "glb", or "json".`);
        process.exit(1);
      }
      break;
    }

    case 'inspect': {
      const filePath = args[1];
      if (!filePath || !fs.existsSync(filePath)) {
        console.error(`Error: Project JSON file not found: ${filePath}`);
        process.exit(1);
      }

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const items = content.items || [];
      const tracks = content.tracks || [];

      console.log(`\nPolyForge Scene Inspection: ${path.basename(filePath)}`);
      console.log('--------------------------------------------------');
      console.log(`Objects Total: ${items.length}`);
      console.log(`Animation Tracks: ${tracks.length}`);
      console.log(`Environment Preset: ${content.environment?.preset || 'studio'}`);
      console.log(`Timeline: ${content.timeline?.totalFrames || 120} frames @ ${content.timeline?.fps || 30} FPS\n`);

      console.log('Sample Object Hierarchy:');
      items.slice(0, 10).forEach((it: any, i: number) => {
        const trk = tracks.find((t: any) => t.objectId === it.id);
        const kfCount = trk ? trk.keyframes.length : 0;
        console.log(`  ${i + 1}. [${it.primitiveType || 'mesh'}] "${it.name}" (pos: [${it.transform.position.join(', ')}], keyframes: ${kfCount})`);
      });
      if (items.length > 10) {
        console.log(`  ... and ${items.length - 10} more objects.`);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
