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
  UpdateObjectOptions,
} from './types';
import { insertOrUpdateKeyframe } from '../animation';

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
      const id = `ai-${type}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
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
      updatedItems.push(updated);
      return updated;
    },

    deleteObject: (idOrName: string): boolean => {
      const idx = findItemIndex(idOrName);
      if (idx === -1) return false;

      const [removed] = context.items.splice(idx, 1);
      deletedItemIds.push(removed.id);

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
      context.tracks = [];
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
  initialContext: ScriptExecutionContext
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

  try {
    // Wrap script inside an async function to allow await
    // Provide polyforge and standard math utilities
    const wrappedCode = `
      return (async function(polyforge, Math) {
        "use strict";
        ${code}
      })(api, Math);
    `;

    const runner = new Function('api', wrappedCode);
    await runner(api);

    return {
      success: true,
      logs,
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
      createdItems: [],
      updatedItems: [],
      deletedItemIds: [],
      tracks: initialContext.tracks,
      environment: initialContext.environment,
      timeline: initialContext.timeline,
    };
  }
}
