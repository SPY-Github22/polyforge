#!/usr/bin/env node
import readline from 'readline';
import { executePolyForgeScript } from '../src/core/ai/api';
import { PROCEDURAL_TEMPLATES } from '../src/core/ai/procedural';
import { getSystemPromptForLLM, serializeSceneForLLM } from '../src/core/ai/llm';
import { exportSceneToOBJString, exportSceneToSTLString, parseProjectFile } from '../src/core/io';
import { ProceduralTemplateId } from '../src/core/ai/types';
import { AnimationTrack, EnvironmentSettings, SceneItem, TimelineState } from '../src/types';
import { generateBotanicalOakTree } from '../src/core/botany';
import { generateRealisticBicycle } from '../src/core/bicycle';

export interface MCPServerState {
  items: SceneItem[];
  tracks: AnimationTrack[];
  environment: EnvironmentSettings;
  timeline: TimelineState;
}

export const defaultMCPServerState: MCPServerState = {
  items: [],
  tracks: [],
  environment: {
    backgroundColor: '#0d1117',
    ambientIntensity: 0.6,
    directionalIntensity: 1.2,
    showGrid: true,
    showAxes: true,
    shadows: true,
    preset: 'studio',
  },
  timeline: {
    currentFrame: 0,
    totalFrames: 120,
    fps: 30,
    isPlaying: false,
    isLooping: true,
    autoKeying: false,
  },
};

export const MCP_TOOLS = [
  {
    name: 'polyforge_list_templates',
    description: 'List all built-in deeply architected 3D procedural generators (sci-fi-citadel, solar-orrery, castle-fortress, kinetic-mech, dna-helix, procedural-biome, spiral-pavilion)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'polyforge_generate_template',
    description: 'Synthesize a deeply architected 3D scene from a procedural template ID and load it into the active scene',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'ID of the template: "sci-fi-citadel" | "solar-orrery" | "castle-fortress" | "kinetic-mech" | "dna-helix" | "procedural-biome" | "spiral-pavilion"',
        },
        clearScene: {
          type: 'boolean',
          description: 'Whether to clear existing scene objects first (default: true)',
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'polyforge_execute_script',
    description: 'Execute arbitrary JavaScript code with full access to the polyforge 3D modeling and animation runtime API',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code utilizing polyforge.createObject, polyforge.addKeyframe, polyforge.addModifier, etc.',
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'polyforge_create_object',
    description: 'Programmatically create a 3D object in the scene with position, rotation, scale, material, and modifiers',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the object' },
        primitive: {
          type: 'string',
          description: '"box" | "sphere" | "cylinder" | "cone" | "torus" | "plane" | "dodecahedron" | "capsule"',
        },
        position: { type: 'array', items: { type: 'number' }, description: '[x, y, z] coordinates' },
        rotation: { type: 'array', items: { type: 'number' }, description: '[rx, ry, rz] Euler angles in radians' },
        scale: { type: 'array', items: { type: 'number' }, description: '[sx, sy, sz] scale multipliers' },
        material: {
          type: 'object',
          properties: {
            color: { type: 'string' },
            roughness: { type: 'number' },
            metalness: { type: 'number' },
            emissive: { type: 'string' },
            emissiveIntensity: { type: 'number' },
          },
        },
        modifiers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['subdivide', 'noise_displace', 'twist', 'smooth'] },
              factor: { type: 'number' },
            },
          },
        },
      },
      required: ['primitive'],
    },
  },
  {
    name: 'polyforge_update_object',
    description: 'Update transform or material properties of an existing object by ID or name',
    inputSchema: {
      type: 'object',
      properties: {
        idOrName: { type: 'string', description: 'Object ID or name' },
        position: { type: 'array', items: { type: 'number' } },
        rotation: { type: 'array', items: { type: 'number' } },
        scale: { type: 'array', items: { type: 'number' } },
        material: { type: 'object' },
        visible: { type: 'boolean' },
      },
      required: ['idOrName'],
    },
  },
  {
    name: 'polyforge_delete_object',
    description: 'Remove an object from the scene and clean up its animation tracks',
    inputSchema: {
      type: 'object',
      properties: {
        idOrName: { type: 'string', description: 'Object ID or name' },
      },
      required: ['idOrName'],
    },
  },
  {
    name: 'polyforge_add_keyframe',
    description: 'Record an animation keyframe transform for an object at a specific frame',
    inputSchema: {
      type: 'object',
      properties: {
        idOrName: { type: 'string', description: 'Target object ID or name' },
        frame: { type: 'number', description: 'Frame number (e.g. 0 to 120)' },
        position: { type: 'array', items: { type: 'number' } },
        rotation: { type: 'array', items: { type: 'number' } },
        scale: { type: 'array', items: { type: 'number' } },
        interpolation: { type: 'string', enum: ['linear', 'ease-in-out', 'step'] },
      },
      required: ['idOrName', 'frame'],
    },
  },
  {
    name: 'polyforge_get_scene',
    description: 'Get a summary of all objects, materials, animation tracks, and environment settings in the current scene',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['summary', 'full'], description: 'Summary for LLMs or full raw JSON' },
      },
    },
  },
  {
    name: 'polyforge_clear_scene',
    description: 'Clear all objects and animation tracks from the active 3D scene',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'polyforge_export_scene',
    description: 'Export the 3D scene to Wavefront OBJ, STL 3D printing format, or PolyForge JSON project file',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['obj', 'stl', 'json'] },
      },
      required: ['format'],
    },
  },
  {
    name: 'polyforge_get_api_docs',
    description: 'Get complete PolyForge TypeScript/JavaScript API reference and sample code for generative 3D modeling',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'polyforge_generate_bicycle',
    description: 'Synthesize an ultra-realistic mechanically precise 3D road bicycle with diamond frame, dropped/flat handlebars, 32-spoke laced wheels, 11-speed drivetrain, continuous roller chain, disc brakes, and routed control cables',
    inputSchema: {
      type: 'object',
      properties: {
        frameColor: { type: 'string', description: 'Frame paint hex color (e.g. "#c01525")' },
        frameMaterial: { type: 'string', enum: ['gloss', 'matte', 'carbon'], description: 'Frame finish preset' },
        handlebarStyle: { type: 'string', enum: ['drop', 'flat'], description: 'Handlebar cockpit style ("drop" or "flat")' },
        pedalStyle: { type: 'string', enum: ['platform', 'clipless'], description: 'Pedal style ("platform" or "clipless")' },
        wheelSize: { type: 'number', description: 'Outer wheel radius in meters (default 0.34 for 700c)' },
        spokeCount: { type: 'number', description: 'Number of spokes per wheel (default 32)' },
        includeCables: { type: 'boolean', description: 'Include routed control cables (default true)' },
        includeDiscBrakes: { type: 'boolean', description: 'Include 160mm vented disc rotors and calipers (default true)' },
        includeReflectors: { type: 'boolean', description: 'Include amber safety reflectors (default true)' },
        clearScene: { type: 'boolean', description: 'Whether to clear existing scene objects first (default: true)' },
      },
    },
  },
];

export class PolyForgeMCPServer {
  public state: MCPServerState;

  constructor(initialState?: Partial<MCPServerState>) {
    this.state = {
      items: initialState?.items ? [...initialState.items] : [...defaultMCPServerState.items],
      tracks: initialState?.tracks ? [...initialState.tracks] : [...defaultMCPServerState.tracks],
      environment: initialState?.environment
        ? { ...initialState.environment }
        : { ...defaultMCPServerState.environment },
      timeline: initialState?.timeline
        ? { ...initialState.timeline }
        : { ...defaultMCPServerState.timeline },
    };
  }

  public async handleRequest(req: any): Promise<any> {
    const { id, method, params } = req;

    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'polyforge-mcp',
              version: '1.0.0',
            },
          },
        };
      }

      case 'notifications/initialized': {
        return null;
      }

      case 'ping': {
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };
      }

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const output = await this.callTool(toolName, toolArgs);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
                },
              ],
              isError: false,
            },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Error: ${msg}` }],
              isError: true,
            },
          };
        }
      }

      default: {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
      }
    }
  }

  public async callTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'polyforge_list_templates': {
        return Object.values(PROCEDURAL_TEMPLATES).map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          description: t.description,
          tags: t.tags,
        }));
      }

      case 'polyforge_generate_template': {
        const templateId = args.templateId as ProceduralTemplateId;
        const tmpl = PROCEDURAL_TEMPLATES[templateId];
        if (!tmpl) {
          throw new Error(`Template not found: "${templateId}". Choose from: ${Object.keys(PROCEDURAL_TEMPLATES).join(', ')}`);
        }

        if (args.clearScene !== false) {
          this.state.items = [];
          this.state.tracks = [];
        }

        const res = tmpl.generate();
        this.state.items.push(...res.items);
        this.state.tracks.push(...res.tracks);
        if (res.environment) this.state.environment = { ...this.state.environment, ...res.environment };
        if (res.timeline) this.state.timeline = { ...this.state.timeline, ...res.timeline };

        return {
          message: `Successfully synthesized template "${tmpl.name}".`,
          totalObjects: this.state.items.length,
          totalAnimationTracks: this.state.tracks.length,
          createdItems: res.items.map((i) => ({ id: i.id, name: i.name, primitive: i.primitiveType })),
        };
      }

      case 'polyforge_execute_script': {
        const script = args.script;
        if (!script) throw new Error('Missing "script" parameter.');

        const result = await executePolyForgeScript(script, {
          items: this.state.items,
          tracks: this.state.tracks,
          environment: this.state.environment,
          timeline: this.state.timeline,
        });

        if (!result.success) {
          throw new Error(`Script error: ${result.error || 'Execution failed'}`);
        }

        this.state.items = result.items;
        this.state.tracks = result.tracks;
        if (result.environment) this.state.environment = result.environment;
        if (result.timeline) this.state.timeline = { ...this.state.timeline, ...result.timeline };

        return {
          message: 'Script executed successfully.',
          logs: result.logs,
          currentObjectCount: this.state.items.length,
          currentTrackCount: this.state.tracks.length,
        };
      }

      case 'polyforge_create_object': {
        const primitive = args.primitive || 'box';
        const name = args.name || `${primitive.charAt(0).toUpperCase() + primitive.slice(1)} ${this.state.items.length + 1}`;
        const id = `ai-${primitive}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

        const newItem: SceneItem = {
          id,
          name,
          type: 'mesh',
          primitiveType: primitive,
          transform: {
            position: args.position || [0, 0, 0],
            rotation: args.rotation || [0, 0, 0],
            scale: args.scale || [1, 1, 1],
          },
          material: {
            color: args.material?.color || '#388bfd',
            roughness: args.material?.roughness ?? 0.35,
            metalness: args.material?.metalness ?? 0.2,
            emissive: args.material?.emissive || '#000000',
            emissiveIntensity: args.material?.emissiveIntensity ?? 0,
            transmission: 0,
            opacity: 1,
            transparent: false,
            wireframe: false,
            texturePreset: 'none',
          },
          modifiers: args.modifiers || [],
          visible: true,
          locked: false,
        };

        this.state.items.push(newItem);
        return {
          message: `Created object "${newItem.name}".`,
          object: newItem,
          totalObjects: this.state.items.length,
        };
      }

      case 'polyforge_update_object': {
        const idOrName = args.idOrName;
        const idx = this.state.items.findIndex(
          (it) => it.id === idOrName || it.name.toLowerCase() === idOrName.toLowerCase()
        );
        if (idx === -1) {
          throw new Error(`Object "${idOrName}" not found in current scene.`);
        }

        const cur = this.state.items[idx];
        const updated: SceneItem = {
          ...cur,
          transform: {
            position: args.position ? [...args.position] : cur.transform.position,
            rotation: args.rotation ? [...args.rotation] : cur.transform.rotation,
            scale: args.scale ? [...args.scale] : cur.transform.scale,
          },
          material: args.material ? { ...cur.material, ...args.material } : cur.material,
          visible: args.visible !== undefined ? args.visible : cur.visible,
        };

        this.state.items[idx] = updated;
        return {
          message: `Updated object "${updated.name}".`,
          object: updated,
        };
      }

      case 'polyforge_delete_object': {
        const idOrName = args.idOrName;
        const idx = this.state.items.findIndex(
          (it) => it.id === idOrName || it.name.toLowerCase() === idOrName.toLowerCase()
        );
        if (idx === -1) {
          throw new Error(`Object "${idOrName}" not found.`);
        }

        const [removed] = this.state.items.splice(idx, 1);
        this.state.tracks = this.state.tracks.filter((t) => t.objectId !== removed.id);
        return {
          message: `Deleted object "${removed.name}".`,
          remainingObjects: this.state.items.length,
        };
      }

      case 'polyforge_add_keyframe': {
        const { idOrName, frame, position, rotation, scale, interpolation } = args;
        const idx = this.state.items.findIndex(
          (it) => it.id === idOrName || it.name.toLowerCase() === idOrName.toLowerCase()
        );
        if (idx === -1) {
          throw new Error(`Object "${idOrName}" not found.`);
        }

        const item = this.state.items[idx];
        let track = this.state.tracks.find((t) => t.objectId === item.id);
        if (!track) {
          track = { objectId: item.id, keyframes: [] };
          this.state.tracks.push(track);
        }

        const existingKfIdx = track.keyframes.findIndex((k) => k.frame === frame);
        const newKf = {
          frame,
          transform: {
            position: position ? [...position] : [...item.transform.position],
            rotation: rotation ? [...rotation] : [...item.transform.rotation],
            scale: scale ? [...scale] : [...item.transform.scale],
          },
          interpolation: interpolation || 'ease-in-out',
        };

        if (existingKfIdx >= 0) {
          track.keyframes[existingKfIdx] = newKf as any;
        } else {
          track.keyframes.push(newKf as any);
          track.keyframes.sort((a, b) => a.frame - b.frame);
        }

        return {
          message: `Recorded keyframe at frame ${frame} for "${item.name}".`,
          totalKeyframes: track.keyframes.length,
        };
      }

      case 'polyforge_get_scene': {
        if (args.format === 'full') {
          return {
            items: this.state.items,
            tracks: this.state.tracks,
            environment: this.state.environment,
            timeline: this.state.timeline,
          };
        }

        return serializeSceneForLLM(
          this.state.items,
          this.state.tracks,
          this.state.environment,
          this.state.timeline
        );
      }

      case 'polyforge_clear_scene': {
        this.state.items = [];
        this.state.tracks = [];
        return { message: 'Scene cleared.' };
      }

      case 'polyforge_export_scene': {
        const format = args.format;
        if (format === 'json') {
          return {
            version: '1.0.0',
            items: this.state.items,
            tracks: this.state.tracks,
            environment: this.state.environment,
            timeline: this.state.timeline,
          };
        } else if (format === 'obj') {
          const obj = exportSceneToOBJString(this.state.items);
          return {
            format: 'obj',
            content: obj,
            characterCount: obj.length,
          };
        } else if (format === 'stl') {
          const stl = exportSceneToSTLString(this.state.items);
          return {
            format: 'stl',
            content: stl,
            characterCount: stl.length,
          };
        }
        throw new Error(`Unsupported export format: "${format}". Choose: obj, stl, or json.`);
      }

      case 'polyforge_generate_bicycle': {
        if (args.clearScene !== false) {
          this.state.items = [];
          this.state.tracks = [];
        }

        const bike = generateRealisticBicycle({
          frameColor: args.frameColor,
          frameMaterial: args.frameMaterial,
          handlebarStyle: args.handlebarStyle,
          pedalStyle: args.pedalStyle,
          wheelSize: args.wheelSize,
          spokeCount: args.spokeCount,
          includeCables: args.includeCables,
          includeDiscBrakes: args.includeDiscBrakes,
          includeReflectors: args.includeReflectors,
        });

        this.state.items.push(...bike.allItems);
        return {
          message: 'Successfully synthesized realistic mechanical bicycle.',
          stats: bike.stats,
          components: bike.allItems.map((i) => ({ id: i.id, name: i.name })),
        };
      }

      case 'polyforge_get_api_docs': {
        return getSystemPromptForLLM();
      }

      default:
        throw new Error(`Unknown tool: "${name}"`);
    }
  }

  public startStdio(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    process.stderr.write('[PolyForge MCP] Server started on stdio. Listening for JSON-RPC 2.0...\n');

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed);
        const response = await this.handleRequest(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (err) {
        const parseError = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: `Parse error: Invalid JSON payload (${err instanceof Error ? err.message : String(err)})`,
          },
        };
        process.stdout.write(JSON.stringify(parseError) + '\n');
      }
    });

    rl.on('close', () => {
      process.stderr.write('[PolyForge MCP] Connection closed.\n');
      process.exit(0);
    });
  }
}

// Entry point when run directly from command line
if (process.argv[1] && (process.argv[1].endsWith('polyforge-mcp.ts') || process.argv[1].endsWith('polyforge-mcp'))) {
  const server = new PolyForgeMCPServer();
  server.startStdio();
}
