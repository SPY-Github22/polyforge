import React, { useRef, useEffect } from 'react';
import { CameraView, TransformMode, ViewportStats } from '../types';
import { Engine } from '../core/engine';
import { Activity, Compass, Focus } from 'lucide-react';

interface ViewportProps {
  engineRef: React.MutableRefObject<Engine | null>;
  containerRef: React.RefObject<HTMLDivElement>;
  stats: ViewportStats;
  cameraView: CameraView;
  transformMode: TransformMode;
  selectedObjectName: string | null;
  onResetCamera: () => void;
  onFocusSelected: () => void;
  onChangeCameraView: (view: CameraView) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  containerRef,
  stats,
  cameraView,
  transformMode,
  selectedObjectName,
  onResetCamera,
  onFocusSelected,
  onChangeCameraView,
}) => {
  const canvasHolderRef = useRef<HTMLDivElement>(null);

  // Transfer container ref
  useEffect(() => {
    if (canvasHolderRef.current && containerRef) {
      // @ts-expect-error containerRef mutable assignment
      containerRef.current = canvasHolderRef.current;
    }
  }, [containerRef]);

  return (
    <div className="flex-1 relative bg-studio-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas Holder */}
      <div ref={canvasHolderRef} className="w-full h-full" />

      {/* Top Left: Active Mode HUD */}
      <div className="absolute top-3 left-3 flex items-center space-x-2 pointer-events-none z-10">
        <div className="bg-studio-900/80 backdrop-blur-md border border-studio-750/70 px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 shadow-md">
          <span className="capitalize text-studio-accent font-semibold">{transformMode}</span>
          <span className="text-slate-600 mx-1.5">|</span>
          <span className="capitalize">{cameraView} View</span>
        </div>

        {selectedObjectName && (
          <div className="bg-studio-900/80 backdrop-blur-md border border-studio-accent/40 px-2.5 py-1 rounded text-[11px] font-mono text-slate-200 shadow-md flex items-center space-x-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-studio-accent animate-ping" />
            <span className="font-semibold text-blue-400">{selectedObjectName}</span>
          </div>
        )}
      </div>

      {/* Top Right: View Cube / Orientation Widget */}
      <div className="absolute top-3 right-3 flex flex-col space-y-1.5 z-10">
        <div className="bg-studio-900/80 backdrop-blur-md border border-studio-750/70 p-1.5 rounded-lg shadow-md flex flex-col space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
            Orientation
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => onChangeCameraView('top')}
              className="px-2 py-1 bg-studio-800 hover:bg-studio-750 text-slate-300 rounded text-[10px] font-mono font-bold transition"
              title="Top View (Z up)"
            >
              Top
            </button>
            <button
              onClick={() => onChangeCameraView('front')}
              className="px-2 py-1 bg-studio-800 hover:bg-studio-750 text-slate-300 rounded text-[10px] font-mono font-bold transition"
              title="Front View"
            >
              Front
            </button>
            <button
              onClick={() => onChangeCameraView('right')}
              className="px-2 py-1 bg-studio-800 hover:bg-studio-750 text-slate-300 rounded text-[10px] font-mono font-bold transition"
              title="Right Side View"
            >
              Right
            </button>
          </div>
          <div className="flex space-x-1 pt-1 border-t border-studio-800">
            <button
              onClick={() => onChangeCameraView('isometric')}
              className="flex-1 py-1 bg-studio-850 hover:bg-studio-750 text-slate-400 rounded text-[10px] font-mono transition"
            >
              Isometric
            </button>
            <button
              onClick={() => onChangeCameraView('perspective')}
              className="flex-1 py-1 bg-studio-850 hover:bg-studio-750 text-slate-400 rounded text-[10px] font-mono transition"
            >
              Persp
            </button>
          </div>
        </div>

        {/* Quick Viewport Action Buttons */}
        <div className="flex space-x-1 self-end">
          <button
            onClick={onFocusSelected}
            title="Focus / Frame Selected (F)"
            className="p-1.5 bg-studio-900/80 backdrop-blur-md border border-studio-750/70 rounded-lg text-slate-300 hover:text-white hover:bg-studio-800 shadow-md transition"
          >
            <Focus size={15} />
          </button>
          <button
            onClick={onResetCamera}
            title="Reset Camera (Home)"
            className="p-1.5 bg-studio-900/80 backdrop-blur-md border border-studio-750/70 rounded-lg text-slate-300 hover:text-white hover:bg-studio-800 shadow-md transition"
          >
            <Compass size={15} />
          </button>
        </div>
      </div>

      {/* Bottom Left: Diagnostics & Performance Readout */}
      <div className="absolute bottom-3 left-3 bg-studio-900/80 backdrop-blur-md border border-studio-750/70 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-slate-400 shadow-md flex items-center space-x-3 pointer-events-none z-10">
        <div className="flex items-center space-x-1 text-emerald-400">
          <Activity size={12} />
          <span className="font-bold">{stats.fps} FPS</span>
        </div>
        <span className="text-slate-600">|</span>
        <div>
          Tris: <span className="text-slate-200 font-semibold">{stats.triangles.toLocaleString()}</span>
        </div>
        <span className="text-slate-600">|</span>
        <div>
          Verts: <span className="text-slate-200 font-semibold">{stats.vertices.toLocaleString()}</span>
        </div>
        <span className="text-slate-600">|</span>
        <div>
          Objects: <span className="text-slate-200 font-semibold">{stats.objectsCount}</span>
        </div>
      </div>
    </div>
  );
};
