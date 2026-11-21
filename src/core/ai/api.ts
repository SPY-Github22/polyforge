import {
  AnimationTrack,
  EnvironmentSettings,
  Keyframe,
  MaterialProperties,
  SceneItem,
  TimelineState,
  TransformData,
} from '../../types';
import {
  AIExecutionResult,
  CreateObjectOptions,
  PolyForgeScriptAPI,
  ProceduralGenerationResult,
  ProceduralTemplateId,
  UpdateObjectOptions,
} from './types';
import { insertOrUpdateKeyframe, ClosedCircuitOptions } from '../animation';
import { PROCEDURAL_TEMPLATES } from './procedural';
import { BotanicalTreeOptions, generateBotanicalOakTree } from '../botany';
import { BicycleOptions, generateRealisticBicycle, generateAnimatedBicycleCircuit } from '../bicycle';
import {
  RealisticHumanOptions,
  RealisticFemaleOptions,
  generateRealisticHumanScene,
  generateRealisticFemaleScene,
} from '../character';

const DEFAULT_SCRIPT_MATERIAL: MaterialProperties = {
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

export interface ScriptExecutionContext {
  items: SceneItem[];
  tracks: AnimationTrack[];
  environment: EnvironmentSettings;
  timeline: TimelineState;
}

/**
 * Creates the runtime `polyforge` API bridge passed to scripts and LLM-generated code.
 */
export function createPolyForgeScriptAPI(
  context: ScriptExecutionContext,
  logs: string[],
  createdItems: SceneItem[],
  updatedItems: SceneItem[],
  deletedItemIds: string[]
): PolyForgeScriptAPI {
  const findItemIndex = (idOrName: string): number => {
    return context.items.findIndex(
      (it) => it.id === idOrName || it.name.toLowerCase() === idOrName.toLowerCase()
    );
  };

  const api: PolyForgeScriptAPI = {
    createObject: (options: CreateObjectOptions): SceneItem => {
      const type = options.primitive || 'box';
      const id = options.id || `ai-${type}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const name = options.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${context.items.length + 1}`;

      const pos: [number, number, number] = options.position || [0, 0, 0];
      const rot: [number, number, number] = options.rotation || [0, 0, 0];
      const scale: [number, number, number] = options.scale || [1, 1, 1];

      const mat: MaterialProperties = {
        ...DEFAULT_SCRIPT_MATERIAL,
        ...options.material,
      };

      const modifiers = options.modifiers?.map((m, idx) => ({
        id: `mod-${id}-${idx}`,
        type: m.type,
        factor: m.factor,
        enabled: m.enabled !== undefined ? m.enabled : true,
      })) || [];

      const newItem: SceneItem = {
        id,
        name,
        type: 'mesh',
        primitiveType: type,
        transform: {
          position: pos,
          rotation: rot,
          scale,
        },
        material: mat,
        geometryParams: options.geometryParams,
        modifiers,
        visible: true,
        locked: false,
      };

      context.items.push(newItem);
      createdItems.push(newItem);
      return newItem;
    },

    createTree: (options?: BotanicalTreeOptions): SceneItem[] => {
      const result = generateBotanicalOakTree(options);
      for (const item of result.allItems) {
        context.items.push(item);
        createdItems.push(item);
      }
      logs.push(`[Botany] Generated realistic oak tree: ${result.stats.totalVertices} verts, ${result.stats.totalTriangles} tris.`);
      return result.allItems;
    },

    createBicycle: (options?: BicycleOptions): SceneItem[] => {
      const result = generateRealisticBicycle(options);
      for (const item of result.allItems) {
        context.items.push(item);
        createdItems.push(item);
      }
      logs.push(`[Mechanical] Generated realistic bicycle: ${result.stats.totalVertices} verts, ${result.stats.totalTriangles} tris across ${result.allItems.length} sub-assemblies.`);
      return result.allItems;
    },

    createAnimatedBicycle: (options?: BicycleOptions & ClosedCircuitOptions): { items: SceneItem[]; tracks: AnimationTrack[] } => {
      const circuit = generateAnimatedBicycleCircuit(options);
      for (const item of circuit.items) {
        context.items.push(item);
        createdItems.push(item);
      }
      for (const track of circuit.tracks) {
        context.tracks.push(track);
      }
      logs.push(`[Mechanical] Generated animated bicycle circuit: ${circuit.items.length} sub-assemblies, ${circuit.tracks.length} tracks, ${circuit.totalFrames} frames.`);
      return { items: circuit.items, tracks: circuit.tracks };
    },

    createHuman: (options?: RealisticHumanOptions): SceneItem[] => {
      const result = generateRealisticHumanScene(options);
      for (const item of result.allItems) {
        context.items.push(item);
        createdItems.push(item);
      }
      logs.push(`[Anatomy] Generated realistic human: ${result.stats.totalVertices} verts, ${result.stats.totalTriangles} tris across ${result.allItems.length} sub-assemblies.`);
      return result.allItems;
    },

    createFemaleHuman: (options?: RealisticFemaleOptions): SceneItem[] => {
      const result = generateRealisticFemaleScene(options);
      for (const item of result.allItems) {
        context.items.push(item);
        createdItems.push(item);
      }
      logs.push(`[Anatomy] Generated realistic female human: ${result.stats.totalVertices} verts, ${result.stats.totalTriangles} tris across ${result.allItems.length} sub-assemblies.`);
      return result.allItems;
    },

    createCustomMesh: (options: {
      name?: string;
      positions: number[];
      normals?: number[];
      uvs?: number[];
      indices?: number[];
      material?: Partial<MaterialProperties>;
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
    }): SceneItem => {
      return api.createObject({
        primitive: 'custom',
        name: options.name || `Custom Mesh ${context.items.length + 1}`,
        position: options.position || [0, 0, 0],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || [1, 1, 1],
        material: options.material,
        geometryParams: {
          customGeometry: {
            positions: options.positions,
            normals: options.normals,
            uvs: options.uvs,
            indices: options.indices,
          },
        },
      });
    },

    updateObject: (idOrName: string, updates: UpdateObjectOptions): SceneItem | null => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) {
        logs.push(`[Warn] updateObject: object "${idOrName}" not found.`);
        return null;
      }

      const current = context.items[idx];
      const updatedTransform: TransformData = {
        position: updates.position ? [...updates.position] : [...current.transform.position],
        rotation: updates.rotation ? [...updates.rotation] : [...current.transform.rotation],
        scale: updates.scale ? [...updates.scale] : [...current.transform.scale],
      };

      const updatedMat: MaterialProperties = updates.material
        ? { ...current.material, ...updates.material }
        : current.material;

      const updated: SceneItem = {
        ...current,
        name: updates.name !== undefined ? updates.name : current.name,
        transform: updatedTransform,
        material: updatedMat,
        visible: updates.visible !== undefined ? updates.visible : current.visible,
        locked: updates.locked !== undefined ? updates.locked : current.locked,
      };

      context.items[idx] = updated;
      const createdIdx = createdItems.findIndex((it) => it.id === updated.id);
      if (createdIdx !== -1) {
        createdItems[createdIdx] = updated;
      }
      updatedItems.push(updated);
      return updated;
    },

    deleteObject: (idOrName: string): boolean => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) return false;

      const [removed] = context.items.splice(idx, 1);
      deletedItemIds.push(removed.id);
      const createdIdx = createdItems.findIndex((it) => it.id === removed.id);
      if (createdIdx !== -1) {
        createdItems.splice(createdIdx, 1);
      }

      // Clean up associated animation tracks
      context.tracks = context.tracks.filter((t) => t.objectId !== removed.id);
      return true;
    },

    getObject: (idOrName: string): SceneItem | null => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) return null;
      return JSON.parse(JSON.stringify(context.items[idx]));
    },

    getAllObjects: (): SceneItem[] => {
      return JSON.parse(JSON.stringify(context.items));
    },

    clearScene: (): void => {
      for (const it of context.items) {
        deletedItemIds.push(it.id);
      }
      context.items = [];
      createdItems.length = 0;
      context.tracks = [];
    },

    addModifier: (
      idOrName: string,
      modifier: {
        type: 'subdivide' | 'noise_displace' | 'twist' | 'smooth' | 'bark_furrow' | 'taper';
        factor: number;
        enabled?: boolean;
      }
    ): boolean => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) {
        logs.push(`[Warn] addModifier: object "${idOrName}" not found.`);
        return false;
      }

      const item = context.items[idx];
      const modId = `mod-${item.id}-${(item.modifiers || []).length + 1}`;
      const newMod = {
        id: modId,
        type: modifier.type,
        factor: modifier.factor,
        enabled: modifier.enabled !== undefined ? modifier.enabled : true,
      };

      item.modifiers = [...(item.modifiers || []), newMod];
      const createdIdx = createdItems.findIndex((it) => it.id === item.id);
      if (createdIdx !== -1) {
        createdItems[createdIdx] = item;
      }
      updatedItems.push(item);
      return true;
    },

    addKeyframe: (
      idOrName: string,
      frame: number,
      transform: Partial<TransformData>,
      interpolation: 'linear' | 'ease-in-out' | 'step' = 'ease-in-out'
    ): boolean => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) {
        logs.push(`[Warn] addKeyframe: object "${idOrName}" not found.`);
        return false;
      }

      const item = context.items[idx];
      const completeTransform: TransformData = {
        position: transform.position ? [...transform.position] : [...item.transform.position],
        rotation: transform.rotation ? [...transform.rotation] : [...item.transform.rotation],
        scale: transform.scale ? [...transform.scale] : [...item.transform.scale],
      };

      let track = context.tracks.find((t) => t.objectId === item.id);
      if (!track) {
        track = { objectId: item.id, keyframes: [] };
        context.tracks.push(track);
      }

      const updatedTrack = insertOrUpdateKeyframe(track, frame, completeTransform, interpolation);
      const trackIdx = context.tracks.findIndex((t) => t.objectId === item.id);
      context.tracks[trackIdx] = updatedTrack;
      return true;
    },

    setAnimationTrack: (idOrName: string, keyframes: Keyframe[]): boolean => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) return false;
      const item = context.items[idx];

      const existingIdx = context.tracks.findIndex((t) => t.objectId === item.id);
      const newTrack: AnimationTrack = {
        objectId: item.id,
        keyframes: [...keyframes].sort((a, b) => a.frame - b.frame),
      };

      if (existingIdx !== -1) {
        context.tracks[existingIdx] = newTrack;
      } else {
        context.tracks.push(newTrack);
      }
      return true;
    },

    getAnimationTrack: (idOrName: string): AnimationTrack | null => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) return null;
      const item = context.items[idx];
      const track = context.tracks.find((t) => t.objectId === item.id);
      return track ? JSON.parse(JSON.stringify(track)) : null;
    },

    clearAnimation: (idOrName: string): boolean => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) return false;
      const item = context.items[idx];
      const lenBefore = context.tracks.length;
      context.tracks = context.tracks.filter((t) => t.objectId !== item.id);
      return context.tracks.length < lenBefore;
    },

    setTimeline: (settings: Partial<TimelineState>): void => {
      context.timeline = { ...context.timeline, ...settings };
    },

    getTimeline: (): TimelineState => {
      return { ...context.timeline };
    },

    setEnvironment: (settings: Partial<EnvironmentSettings>): void => {
      context.environment = { ...context.environment, ...settings };
    },

    getEnvironment: (): EnvironmentSettings => {
      return { ...context.environment };
    },

    listTemplates: () => {
      return Object.values(PROCEDURAL_TEMPLATES).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        tags: t.tags,
      }));
    },

    generateTemplate: (
      templateId: ProceduralTemplateId,
      options?: { clearScene?: boolean }
    ): ProceduralGenerationResult | null => {
      const template = PROCEDURAL_TEMPLATES[templateId];
      if (!template) {
        logs.push(`[Warn] generateTemplate: template "${templateId}" not found.`);
        return null;
      }

      if (options?.clearScene) {
        api.clearScene();
      }

      const result = template.generate();

      for (const item of result.items) {
        context.items.push(item);
        createdItems.push(item);
      }

      for (const track of result.tracks) {
        const existingIdx = context.tracks.findIndex((t) => t.objectId === track.objectId);
        if (existingIdx !== -1) {
          context.tracks[existingIdx] = track;
        } else {
          context.tracks.push(track);
        }
      }

      if (result.environment) {
        context.environment = { ...context.environment, ...result.environment };
      }
      if (result.timeline) {
        context.timeline = { ...context.timeline, ...result.timeline };
      }

      logs.push(`[Template] Instantiated "${template.name}" with ${result.items.length} objects and ${result.tracks.length} tracks.`);
      return result;
    },

    log: (...args: any[]): void => {
      const message = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ');
      logs.push(message);
    },
  };

  return api;
}

/**
 * Safely executes JavaScript code in the PolyForge context.
 * Supports both synchronous and asynchronous scripts.
 */
export async function executePolyForgeScript(
  code: string,
  initialContext: ScriptExecutionContext,
  options?: { timeoutMs?: number }
): Promise<AIExecutionResult> {
  const clonedContext: ScriptExecutionContext = {
    items: JSON.parse(JSON.stringify(initialContext.items)),
    tracks: JSON.parse(JSON.stringify(initialContext.tracks)),
    environment: JSON.parse(JSON.stringify(initialContext.environment)),
    timeline: JSON.parse(JSON.stringify(initialContext.timeline)),
  };

  const logs: string[] = [];
  const createdItems: SceneItem[] = [];
  const updatedItems: SceneItem[] = [];
  const deletedItemIds: string[] = [];

  const api = createPolyForgeScriptAPI(
    clonedContext,
    logs,
    createdItems,
    updatedItems,
    deletedItemIds
  );

  const consoleShim = {
    log: (...args: any[]) => api.log(...args),
    warn: (...args: any[]) => api.log('[Warn]', ...args),
    error: (...args: any[]) => api.log('[Error]', ...args),
    info: (...args: any[]) => api.log('[Info]', ...args),
  };

  const timeoutMs = options?.timeoutMs ?? 5000;

  try {
    // Wrap script inside an async function to allow await
    // Provide polyforge, standard Math utilities, and console
    // Explicitly shadow and neutralize host-level globals (process, require, global, globalThis)
    const wrappedCode = `
      return (async function(polyforge, Math, console, process, require, window, document, global, globalThis) {
        "use strict";
        ${code}
      })(api, Math, consoleShim, undefined, undefined, undefined, undefined, undefined, undefined);
    `;

    const runner = new Function('api', 'Math', 'consoleShim', wrappedCode);
    const executionPromise = runner(api, Math, consoleShim);

    let timer: any;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Script execution timed out (${timeoutMs}ms limit)`));
      }, timeoutMs);
    });

    try {
      await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }

    return {
      success: true,
      logs,
      items: clonedContext.items,
      createdItems,
      updatedItems,
      deletedItemIds,
      tracks: clonedContext.tracks,
      environment: clonedContext.environment,
      timeline: clonedContext.timeline,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logs.push(`[Execution Error] ${errorMsg}`);
    return {
      success: false,
      logs,
      error: errorMsg,
      items: initialContext.items,
      createdItems: [],
      updatedItems: [],
      deletedItemIds: [],
      tracks: initialContext.tracks,
      environment: initialContext.environment,
      timeline: initialContext.timeline,
    };
  }
}
