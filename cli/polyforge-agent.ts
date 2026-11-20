#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PROCEDURAL_TEMPLATES, matchProceduralTemplate } from '../src/core/ai/procedural';
import { ProceduralTemplateId } from '../src/core/ai/types';
import { executePolyForgeScript } from '../src/core/ai/api';
import { EnvironmentSettings, TimelineState } from '../src/types';

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
PolyForge AI Headless Agent CLI
================================
Programmatic 3D scene generation, scripting, and inspection interface for LLMs and automated workflows.

Usage:
  npx tsx cli/polyforge-agent.ts <command> [options]

Commands:
  list-templates                         List all built-in procedural 3D model and animation generators
  generate --template <id> [--out <f>]   Synthesize a 3D model from a template ID and export PolyForge JSON
  prompt "<natural language>" [--out <f>] Synthesize a 3D model matching a prompt and export PolyForge JSON
  run-script <script.js> [--out <f>]     Execute a PolyForge JavaScript script in headless sandbox
  inspect <scene.json>                   Display detailed summary and metrics of a scene file

Options:
  --out, -o <file>   Output JSON file path (defaults to stdout or ./polyforge-output.json)
  --help, -h         Show this help screen
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

      const execution = await executePolyForgeScript(scriptCode, {
        items: [],
        tracks: [],
        environment: { ...defaultEnv },
        timeline: { ...defaultTimeline },
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
        items: execution.createdItems,
        tracks: execution.tracks,
        timeline: execution.timeline ? { ...defaultTimeline, ...execution.timeline } : defaultTimeline,
      };

      const outPath = getArgValue('--out', '-o') || path.resolve(process.cwd(), 'script-output.json');
      fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
      console.log(`[PolyForge Agent] Created ${execution.createdItems.length} objects and ${execution.tracks.length} animation tracks.`);
      console.log(`[PolyForge Agent] Saved to: ${outPath}`);
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
