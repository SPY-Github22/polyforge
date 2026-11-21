import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Box,
  Download,
  FolderOpen,
  HelpCircle,
  Layers,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Camera,
  FileCode,
  Shapes,
  Sparkles,
  Bot,
  Upload,
} from 'lucide-react';
import { CameraView, PrimitiveType, ShadingMode } from '../types';

interface TopNavbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddPrimitive: (type: PrimitiveType) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onNewScene: () => void;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onExportGLTF: (binary: boolean) => void;
  onExportOBJ: () => void;
  onExportSTL: () => void;
  onCaptureSnapshot: () => void;
  shadingMode: ShadingMode;
  onChangeShadingMode: (mode: ShadingMode) => void;
  cameraView: CameraView;
  onChangeCameraView: (view: CameraView) => void;
  onOpenShortcuts: () => void;
  isAIOpen: boolean;
  onToggleAI: () => void;
  onAddAnimatedBicycle?: () => void;
  onAddRealisticHuman?: () => void;
  onAddRealisticFemale?: () => void;
  onImportModel?: (file: File) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddPrimitive,
  onDeleteSelected,
  onDuplicateSelected,
  onNewScene,
  onSaveProject,
  onOpenProject,
  onExportGLTF,
  onExportOBJ,
  onExportSTL,
  onCaptureSnapshot,
  shadingMode,
  onChangeShadingMode,
  cameraView,
  onChangeCameraView,
  onOpenShortcuts,
  isAIOpen,
  onToggleAI,
  onAddAnimatedBicycle,
  onAddRealisticHuman,
  onAddRealisticFemale,
  onImportModel,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleMenuClick = (e: React.MouseEvent, menuName: string) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenProject(file);
      e.target.value = '';
    }
  };

  const handleModelInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportModel) {
      onImportModel(file);
      e.target.value = '';
    }
  };

  return (
    <header className="h-12 bg-studio-900 border-b border-studio-750 px-3 flex items-center justify-between select-none z-50 text-xs">
      {/* Hidden file input for project open (supports project JSON & 3D models) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.pfproj,.glb,.gltf,.obj,.stl"
        className="hidden"
        onChange={handleFileInputChange}
      />
      {/* Hidden file input for 3D model import (.obj, .gltf, .glb, .stl) */}
      <input
        ref={modelInputRef}
        type="file"
        accept=".obj,.gltf,.glb,.stl"
        className="hidden"
        onChange={handleModelInputChange}
      />

      {/* Left side: Logo & Menus */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 mr-3 font-semibold text-slate-100 tracking-wider">
          <div className="w-7 h-7 rounded bg-studio-accent/20 border border-studio-accent/40 flex items-center justify-center text-studio-accent">
            <Box size={16} />
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
            POLYFORGE
          </span>
          <span className="text-[10px] bg-studio-800 text-slate-400 px-1.5 py-0.5 rounded border border-studio-700">
            v1.0
          </span>
        </div>

        {/* Menu Items */}
        <div className="flex items-center space-x-1">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={(e) => handleMenuClick(e, 'file')}
              className={`px-2.5 py-1 rounded hover:bg-studio-800 transition ${
                activeMenu === 'file' ? 'bg-studio-800 text-white' : 'text-slate-300'
              }`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 mt-1 w-48 bg-studio-900 border border-studio-700 rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-100"
              >
                <button
                  onClick={() => {
                    onNewScene();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center justify-between"
                >
                  <span>New Scene</span>
                  <span className="text-[10px] text-slate-500">Ctrl+N</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen size={13} /> Open Project...
                  </span>
                  <span className="text-[10px] text-slate-500">Ctrl+O</span>
                </button>
                <button
                  onClick={() => {
                    modelInputRef.current?.click();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center justify-between text-indigo-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Upload size={13} /> Import 3D Model...
                  </span>
                  <span className="text-[10px] text-slate-500">OBJ/GLTF/STL</span>
                </button>
                <button
                  onClick={() => {
                    onSaveProject();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Save size={13} /> Save Project (.json)
                  </span>
                  <span className="text-[10px] text-slate-500">Ctrl+S</span>
                </button>
                <div className="my-1 border-t border-studio-800" />
                <button
                  onClick={() => {
                    onExportGLTF(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-1.5 text-blue-400"
                >
                  <Download size={13} /> Export GLB (Binary)
                </button>
                <button
                  onClick={() => {
                    onExportGLTF(false);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-1.5"
                >
                  <FileCode size={13} /> Export GLTF (JSON)
                </button>
                <button
                  onClick={() => {
                    onExportOBJ();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-1.5"
                >
                  <Shapes size={13} /> Export OBJ
                </button>
                <button
                  onClick={() => {
                    onExportSTL();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-1.5"
                >
                  <Box size={13} /> Export STL (3D Print)
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={(e) => handleMenuClick(e, 'edit')}
              className={`px-2.5 py-1 rounded hover:bg-studio-800 transition ${
                activeMenu === 'edit' ? 'bg-studio-800 text-white' : 'text-slate-300'
              }`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 mt-1 w-48 bg-studio-900 border border-studio-700 rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-100"
              >
                <button
                  disabled={!canUndo}
                  onClick={() => {
                    onUndo();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Undo2 size={13} /> Undo
                  </span>
                  <span className="text-[10px] text-slate-500">Ctrl+Z</span>
                </button>
                <button
                  disabled={!canRedo}
                  onClick={() => {
                    onRedo();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Redo2 size={13} /> Redo
                  </span>
                  <span className="text-[10px] text-slate-500">Ctrl+Y</span>
                </button>
                <div className="my-1 border-t border-studio-800" />
                <button
                  onClick={() => {
                    onDuplicateSelected();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} /> Duplicate Object
                  </span>
                  <span className="text-[10px] text-slate-500">Shift+D</span>
                </button>
                <button
                  onClick={() => {
                    onDeleteSelected();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-red-400 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Trash2 size={13} /> Delete Object
                  </span>
                  <span className="text-[10px] text-slate-500">Del / X</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Primitive Menu */}
          <div className="relative">
            <button
              onClick={(e) => handleMenuClick(e, 'add')}
              className={`px-2.5 py-1 rounded hover:bg-studio-800 flex items-center gap-1 transition ${
                activeMenu === 'add' ? 'bg-studio-800 text-white' : 'text-slate-300'
              }`}
            >
              <Plus size={13} /> Add
            </button>
            {activeMenu === 'add' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 mt-1 w-44 bg-studio-900 border border-studio-700 rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-100"
              >
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Mesh Primitives
                </div>
                {(
                  [
                    'box',
                    'sphere',
                    'cylinder',
                    'cone',
                    'torus',
                    'plane',
                    'dodecahedron',
                    'capsule',
                  ] as PrimitiveType[]
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      onAddPrimitive(type);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-studio-800 capitalize flex items-center gap-2"
                  >
                    <Box size={12} className="text-blue-400" />
                    {type}
                  </button>
                ))}
                {onAddAnimatedBicycle && (
                  <>
                    <div className="my-1 border-t border-studio-800" />
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Procedural Models
                    </div>
                    {onAddRealisticHuman && (
                      <button
                        onClick={() => {
                          onAddRealisticHuman();
                          setActiveMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-2 text-indigo-400 font-medium"
                      >
                        <Sparkles size={12} className="text-indigo-400" />
                        Realistic Male Character
                      </button>
                    )}
                    {onAddRealisticFemale && (
                      <button
                        onClick={() => {
                          onAddRealisticFemale();
                          setActiveMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-2 text-rose-400 font-medium"
                      >
                        <Sparkles size={12} className="text-rose-400" />
                        Realistic Female Character
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onAddAnimatedBicycle();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center gap-2 text-emerald-400 font-medium"
                    >
                      <Activity size={12} className="text-emerald-400" />
                      Animated Bicycle Circuit
                    </button>
                  </>
                )}
              </div>
            )}
            {/* AI Assistant Menu */}
            <div className="relative">
              <button
                onClick={(e) => handleMenuClick(e, 'ai')}
                className={`px-2.5 py-1 rounded hover:bg-studio-800 flex items-center gap-1 transition ${
                  activeMenu === 'ai' || isAIOpen ? 'bg-sky-950/60 text-sky-400 border border-sky-800/60' : 'text-slate-300'
                }`}
              >
                <Sparkles size={13} className="text-sky-400" /> AI
              </button>
              {activeMenu === 'ai' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 mt-1 w-52 bg-studio-900 border border-studio-700 rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-100"
                >
                  <button
                    onClick={() => {
                      onToggleAI();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-studio-800 flex items-center justify-between text-sky-400 font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={13} /> Open AI Studio
                    </span>
                    <span className="text-[10px] text-slate-500">Ctrl+Shift+A</span>
                  </button>
                  <div className="h-px bg-studio-800 my-1" />
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Quick AI Workflows
                  </div>
                  <button
                    onClick={() => {
                      onToggleAI();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-slate-300 flex items-center gap-2"
                  >
                    <Bot size={13} className="text-blue-400" />
                    <span>Prompt to 3D Synthesizer</span>
                  </button>
                  <button
                    onClick={() => {
                      onToggleAI();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-slate-300 flex items-center gap-2"
                  >
                    <FileCode size={13} className="text-emerald-400" />
                    <span>JavaScript Code Studio</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Undo / Redo & Shading / Camera Mode Controls */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center bg-studio-850 border border-studio-750 rounded p-0.5">
          <button
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-studio-750 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Undo2 size={14} />
          </button>
          <button
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-studio-750 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Camera Views */}
        <select
          value={cameraView}
          onChange={(e) => onChangeCameraView(e.target.value as CameraView)}
          className="bg-studio-850 border border-studio-750 rounded px-2 py-1 text-slate-200 outline-none hover:bg-studio-800 focus:border-studio-accent cursor-pointer text-xs"
        >
          <option value="perspective">Perspective</option>
          <option value="isometric">Isometric</option>
          <option value="top">Top View (Numpad 7)</option>
          <option value="front">Front View (Numpad 1)</option>
          <option value="right">Right View (Numpad 3)</option>
        </select>

        {/* Shading Modes */}
        <div className="flex items-center bg-studio-850 border border-studio-750 rounded p-0.5 space-x-0.5">
          {(
            [
              { id: 'rendered', label: 'Rendered' },
              { id: 'solid', label: 'Solid' },
              { id: 'wireframe', label: 'Wireframe' },
              { id: 'normals', label: 'Normals' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              onClick={() => onChangeShadingMode(mode.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                shadingMode === mode.id
                  ? 'bg-studio-accent text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right side: Snapshot, Export GLB quick action, AI Studio, Help */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleAI}
          title="Open AI Studio (Ctrl+Shift+A)"
          className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1.5 shadow ${
            isAIOpen
              ? 'bg-sky-500 text-white ring-2 ring-sky-400/50'
              : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-950/40'
          }`}
        >
          <Sparkles size={13} className="text-yellow-300 animate-pulse" />
          <span>AI Studio</span>
        </button>

        <button
          onClick={onCaptureSnapshot}
          title="Capture Render Snapshot (PNG)"
          className="p-1.5 bg-studio-850 border border-studio-750 rounded hover:bg-studio-800 text-slate-300 hover:text-white transition flex items-center gap-1"
        >
          <Camera size={14} />
          <span className="hidden sm:inline">Render</span>
        </button>

        <button
          onClick={() => onExportGLTF(true)}
          className="px-2.5 py-1 bg-studio-accent/20 border border-studio-accent/40 rounded text-studio-accent hover:bg-studio-accent hover:text-white font-medium transition flex items-center gap-1.5"
        >
          <Download size={13} />
          <span>Export .GLB</span>
        </button>

        <button
          onClick={onOpenShortcuts}
          title="Shortcuts & Documentation"
          className="p-1.5 rounded hover:bg-studio-800 text-slate-400 hover:text-slate-200 transition"
        >
          <HelpCircle size={15} />
        </button>
      </div>
    </header>
  );
};
