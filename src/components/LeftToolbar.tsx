import React from 'react';
import {
  MousePointer,
  Move,
  RotateCw,
  Maximize,
  Box,
  Circle,
  Cylinder,
  Disc,
  Grid,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PrimitiveType, TransformMode } from '../types';

interface LeftToolbarProps {
  transformMode: TransformMode;
  onChangeTransformMode: (mode: TransformMode) => void;
  onAddPrimitive: (type: PrimitiveType) => void;
  onApplyNoiseSculpt: () => void;
  onSubdivideSelected: () => void;
  hasSelectedObject: boolean;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  transformMode,
  onChangeTransformMode,
  onAddPrimitive,
  onApplyNoiseSculpt,
  onSubdivideSelected,
  hasSelectedObject,
}) => {
  return (
    <aside className="w-14 bg-studio-900 border-r border-studio-750 flex flex-col items-center py-3 select-none z-40 text-xs">
      {/* Transform Gizmo Modes */}
      <div className="flex flex-col space-y-1 mb-4">
        <button
          onClick={() => onChangeTransformMode('select')}
          title="Select Tool (Q)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            transformMode === 'select'
              ? 'bg-studio-accent text-white shadow-lg shadow-studio-accent/30'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <MousePointer size={18} />
        </button>

        <button
          onClick={() => onChangeTransformMode('translate')}
          title="Move / Translate (G)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            transformMode === 'translate'
              ? 'bg-studio-accent text-white shadow-lg shadow-studio-accent/30'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <Move size={18} />
        </button>

        <button
          onClick={() => onChangeTransformMode('rotate')}
          title="Rotate (R)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            transformMode === 'rotate'
              ? 'bg-studio-accent text-white shadow-lg shadow-studio-accent/30'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <RotateCw size={18} />
        </button>

        <button
          onClick={() => onChangeTransformMode('scale')}
          title="Scale (S)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            transformMode === 'scale'
              ? 'bg-studio-accent text-white shadow-lg shadow-studio-accent/30'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <Maximize size={18} />
        </button>
      </div>

      <div className="w-8 border-t border-studio-750 my-1" />

      {/* Quick Primitive Add Icons */}
      <div className="flex flex-col space-y-1 my-2">
        <button
          onClick={() => onAddPrimitive('box')}
          title="Add Cube"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <Box size={18} />
        </button>

        <button
          onClick={() => onAddPrimitive('sphere')}
          title="Add Sphere"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <Circle size={18} />
        </button>

        <button
          onClick={() => onAddPrimitive('cylinder')}
          title="Add Cylinder"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <Cylinder size={18} />
        </button>

        <button
          onClick={() => onAddPrimitive('torus')}
          title="Add Torus Ring"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <Disc size={18} />
        </button>

        <button
          onClick={() => onAddPrimitive('plane')}
          title="Add Ground Plane"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <Grid size={18} />
        </button>
      </div>

      <div className="w-8 border-t border-studio-750 my-1" />

      {/* Mesh Modeling & Sculpting Tools */}
      <div className="flex flex-col space-y-1 my-2">
        <button
          disabled={!hasSelectedObject}
          onClick={onApplyNoiseSculpt}
          title="Organic Sculpt (Vertex Noise Displacement)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-purple-400 hover:text-purple-200 hover:bg-studio-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Activity size={18} />
        </button>

        <button
          disabled={!hasSelectedObject}
          onClick={onSubdivideSelected}
          title="Subdivide Mesh Geometry (Smooth Refine)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-400 hover:text-amber-200 hover:bg-studio-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Layers size={18} />
        </button>
      </div>

      <div className="mt-auto flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-studio-accent/10 border border-studio-accent/20 flex items-center justify-center text-studio-accent">
          <Sparkles size={14} />
        </div>
      </div>
    </aside>
  );
};
