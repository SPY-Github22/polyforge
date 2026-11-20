export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

export type ShadingMode = 'rendered' | 'solid' | 'wireframe' | 'normals';

export type CameraView = 'perspective' | 'orthographic' | 'top' | 'front' | 'right' | 'isometric';

export type PrimitiveType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'dodecahedron'
  | 'capsule'
  | 'custom';

export type TexturePreset =
  | 'none'
  | 'checker'
  | 'uv_grid'
  | 'stripes'
  | 'bark'
  | 'foliage'
  | 'bark_oak'
  | 'leaf_oak_mature'
  | 'leaf_oak_young'
  | 'carbon_fiber'
  | 'tire_tread'
  | 'brushed_metal'
  | 'leather_perforated'
  | 'reflector_amber';

export interface CustomGeometryData {
  positions: number[];
  normals?: number[];
  uvs?: number[];
  indices?: number[];
  colors?: number[];
}

export interface MaterialProperties {
  color: string;
  roughness: number;
  metalness: number;
  emissive: string;
  emissiveIntensity: number;
  transmission: number;
  opacity: number;
  transparent: boolean;
  wireframe: boolean;
  texturePreset: TexturePreset;
  doubleSided?: boolean;
  vertexColors?: boolean;
  alphaTest?: number;
}

export interface TransformData {
  position: [number, number, number];
  rotation: [number, number, number]; // in radians
  scale: [number, number, number];
}

export interface GeometryParameters {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  tube?: number;
  radialSegments?: number;
  tubularSegments?: number;
  widthSegments?: number;
  heightSegments?: number;
  subdivisions?: number;
  customGeometry?: CustomGeometryData;
}

export interface Modifier {
  id: string;
  type: 'subdivide' | 'noise_displace' | 'twist' | 'smooth' | 'bark_furrow' | 'taper';
  factor: number;
  enabled: boolean;
}

export interface SceneItem {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'group';
  primitiveType?: PrimitiveType;
  transform: TransformData;
  material: MaterialProperties;
  geometryParams?: GeometryParameters;
  visible: boolean;
  locked: boolean;
  modifiers?: Modifier[];
}

export interface Keyframe {
  frame: number;
  transform: TransformData;
  interpolation: 'linear' | 'ease-in-out' | 'step';
}

export interface AnimationTrack {
  objectId: string;
  keyframes: Keyframe[];
}

export interface EnvironmentSettings {
  backgroundColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  showGrid: boolean;
  showAxes: boolean;
  shadows: boolean;
  preset: 'studio' | 'sunset' | 'cyberpunk' | 'dawn';
}

export interface TimelineState {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  isPlaying: boolean;
  isLooping: boolean;
  autoKeying: boolean;
}

export interface ViewportStats {
  fps: number;
  triangles: number;
  vertices: number;
  objectsCount: number;
}

export interface HistoryAction {
  description: string;
  undo: () => void;
  redo: () => void;
}
