import {
  AnimationTrack,
  CustomGeometryData,
  EnvironmentSettings,
  Keyframe,
  MaterialProperties,
  PrimitiveType,
  SceneItem,
  TimelineState,
  TransformData,
} from '../../types';
import { BotanicalTreeOptions } from '../botany';
import { BicycleOptions } from '../bicycle';
import { ClosedCircuitOptions } from '../animation';
import { RealisticHumanOptions } from '../character';

export type ProceduralTemplateId =
  | 'sci-fi-citadel'
  | 'solar-orrery'
  | 'castle-fortress'
  | 'kinetic-mech'
  | 'dna-helix'
  | 'procedural-biome'
  | 'spiral-pavilion'
  | 'realistic-bicycle';

export interface CreateObjectOptions {
  id?: string;
  name?: string;
  primitive?: PrimitiveType;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material?: Partial<MaterialProperties>;
  modifiers?: Array<{
    type: 'subdivide' | 'noise_displace' | 'twist' | 'smooth' | 'bark_furrow' | 'taper';
    factor: number;
    enabled?: boolean;
  }>;
  geometryParams?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    tube?: number;
    radialSegments?: number;
    tubularSegments?: number;
    widthSegments?: number;
    heightSegments?: number;
    customGeometry?: CustomGeometryData;
  };
}

export interface UpdateObjectOptions {
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material?: Partial<MaterialProperties>;
  visible?: boolean;
  locked?: boolean;
}

export interface PolyForgeScriptAPI {
  // Object creation & mutation
  createObject: (options: CreateObjectOptions) => SceneItem;
  createTree: (options?: BotanicalTreeOptions) => SceneItem[];
  createBicycle: (options?: BicycleOptions) => SceneItem[];
  createAnimatedBicycle: (options?: BicycleOptions & ClosedCircuitOptions) => { items: SceneItem[]; tracks: AnimationTrack[] };
  createHuman: (options?: RealisticHumanOptions) => SceneItem[];
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
  }) => SceneItem;
  updateObject: (idOrName: string, updates: UpdateObjectOptions) => SceneItem | null;
  deleteObject: (idOrName: string) => boolean;
  getObject: (idOrName: string) => SceneItem | null;
  getAllObjects: () => SceneItem[];
  clearScene: () => void;
  addModifier: (
    idOrName: string,
    modifier: {
      type: 'subdivide' | 'noise_displace' | 'twist' | 'smooth' | 'bark_furrow' | 'taper';
      factor: number;
      enabled?: boolean;
    }
  ) => boolean;

  // Animation & Keyframing
  addKeyframe: (
    idOrName: string,
    frame: number,
    transform: Partial<TransformData>,
    interpolation?: 'linear' | 'ease-in-out' | 'step'
  ) => boolean;
  setAnimationTrack: (idOrName: string, keyframes: Keyframe[]) => boolean;
  getAnimationTrack: (idOrName: string) => AnimationTrack | null;
  clearAnimation: (idOrName: string) => boolean;

  // Timeline & Environment
  setTimeline: (settings: Partial<TimelineState>) => void;
  getTimeline: () => TimelineState;
  setEnvironment: (settings: Partial<EnvironmentSettings>) => void;
  getEnvironment: () => EnvironmentSettings;

  // Procedural Templates
  listTemplates: () => Array<{
    id: ProceduralTemplateId;
    name: string;
    category: string;
    description: string;
    tags: string[];
  }>;
  generateTemplate: (
    templateId: ProceduralTemplateId,
    options?: { clearScene?: boolean }
  ) => ProceduralGenerationResult | null;

  // Logging & Utilities
  log: (...args: any[]) => void;
}

export interface AIExecutionResult {
  success: boolean;
  logs: string[];
  error?: string;
  items: SceneItem[];
  createdItems: SceneItem[];
  updatedItems: SceneItem[];
  deletedItemIds: string[];
  tracks: AnimationTrack[];
  environment?: EnvironmentSettings;
  timeline?: Partial<TimelineState>;
}

export interface ProceduralGenerationResult {
  items: SceneItem[];
  tracks: AnimationTrack[];
  environment?: Partial<EnvironmentSettings>;
  timeline?: Partial<TimelineState>;
  description: string;
}

export interface ProceduralTemplate {
  id: ProceduralTemplateId;
  name: string;
  category: 'Sci-Fi' | 'Astronomy' | 'Architecture' | 'Robotics' | 'Nature' | 'Kinetics' | 'Mechanical' | 'Character';
  description: string;
  tags: string[];
  generate: (params?: Record<string, any>) => ProceduralGenerationResult;
}

export type AIProviderType = 'offline' | 'openai' | 'anthropic' | 'ollama' | 'custom';

export interface AIConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  endpoint: string;
  temperature: number;
}

export interface LLMSceneSummary {
  objectCount: number;
  objects: Array<{
    id: string;
    name: string;
    primitive: PrimitiveType | string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    color: string;
    metalness: number;
    roughness: number;
    keyframeCount: number;
  }>;
  timeline: {
    currentFrame: number;
    totalFrames: number;
    fps: number;
  };
  environment: {
    preset: string;
    backgroundColor: string;
  };
}

export interface ScriptSample {
  id: string;
  title: string;
  description: string;
  category: 'Modeling' | 'Animation' | 'Procedural' | 'Architectural' | 'Sci-Fi';
  code: string;
}
