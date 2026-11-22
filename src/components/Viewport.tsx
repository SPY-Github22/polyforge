import React, { useRef, useEffect, useState } from 'react';
import { CameraView, SceneItem, TransformMode, ViewportStats } from '../types';
import { Engine } from '../core/engine';
import {
  Activity,
  Compass,
  Focus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Palette,
} from 'lucide-react';

interface ViewportProps {
  engineRef: React.MutableRefObject<Engine | null>;
  containerRef: React.RefObject<HTMLDivElement>;
  stats: ViewportStats;
  cameraView: CameraView;
  transformMode: TransformMode;
  selectedObjectName: string | null;
  selectedItem?: SceneItem | null;
  sceneItems?: SceneItem[];
  onResetCamera: () => void;
  onFocusSelected: () => void;
  onChangeCameraView: (view: CameraView) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onUnhideAll?: () => void;
  onOpenMaterialTab?: () => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  containerRef,
  stats,
  cameraView,
  transformMode,
  selectedObjectName,
  selectedItem,
  sceneItems,
  onResetCamera,
  onFocusSelected,
  onChangeCameraView,
  onToggleVisibility,
  onToggleLock,
  onDuplicateSelected,
  onDeleteSelected,
  onUnhideAll,
  onOpenMaterialTab,
}) => {
  const canvasHolderRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isUnderwear = (id: string) => id.includes('underwear');

  const isBodyPart = (id: string) =>
    (id === 'female-body' ||
    id === 'human-body' ||
    id === 'male-body' ||
    (id.startsWith('female-') &&
      !['female-top', 'female-jeans', 'female-sneakers', 'female-accessories'].includes(id)) ||
    (id.startsWith('male-') &&
      !['male-shirt', 'male-pants', 'male-shoes', 'male-accessories'].includes(id)) ||
    (id.startsWith('human-') &&
      !['human-shirt', 'human-pants', 'human-shoes', 'human-accessories'].includes(id))) &&
    !isUnderwear(id);

  const isOuterClothing = (id: string) =>
    !isUnderwear(id) &&
    (id.includes('top') ||
    id.includes('shirt') ||
    id.includes('jeans') ||
    id.includes('pants') ||
    id.includes('sneakers') ||
    id.includes('shoes'));

  const characterBodyItems = sceneItems?.filter((it) => isBodyPart(it.id)) || [];
  const characterUnderwearItems = sceneItems?.filter((it) => isUnderwear(it.id)) || [];
  const characterClothesItems = sceneItems?.filter((it) => isOuterClothing(it.id)) || [];

  const hiddenCount = sceneItems ? sceneItems.filter((it) => !it.visible).length : 0;

  // Transfer container ref
  useEffect(() => {
    if (canvasHolderRef.current && containerRef) {
      // @ts-expect-error containerRef mutable assignment
      containerRef.current = canvasHolderRef.current;
    }
  }, [containerRef]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    if (contextMenu) {
      window.addEventListener('click', handleCloseMenu);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="flex-1 relative bg-white overflow-hidden select-none"
      onContextMenu={handleContextMenu}
    >
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
            <span className="text-slate-400">Selected:</span>
            <span className="font-semibold text-blue-400">{selectedObjectName}</span>
            {selectedItem && !selectedItem.visible && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500/30 text-amber-300 text-[9px] rounded font-mono font-bold">
                HIDDEN
              </span>
            )}
          </div>
        )}
      </div>

      {/* Top Center: Floating HUD Action Toolbar for Selected Object */}
      {selectedItem && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-studio-900/90 backdrop-blur-md border border-studio-750/80 px-2.5 py-1.5 rounded-xl shadow-2xl z-20 transition-all">
          <div className="flex items-center space-x-1.5 pr-2 mr-1 border-r border-studio-750">
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
              style={{ backgroundColor: selectedItem.material?.color || '#3b82f6' }}
            />
            <span className="font-semibold text-xs text-white max-w-[130px] truncate" title={selectedItem.name}>
              {selectedItem.name}
            </span>
          </div>

          {/* If selected object is hidden, show clear alert badge */}
          {!selectedItem.visible && (
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold mr-1 animate-pulse">
              <EyeOff size={13} className="text-amber-400" />
              <span>HIDDEN</span>
              {onToggleVisibility && (
                <button
                  onClick={() => onToggleVisibility(selectedItem.id)}
                  className="ml-1 px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition shadow"
                  title="Click to restore visibility (H)"
                >
                  Show
                </button>
              )}
            </div>
          )}

          {/* Visibility Toggle Button */}
          {onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(selectedItem.id)}
              title={selectedItem.visible ? 'Hide Object (H)' : 'Show Object (H)'}
              className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition ${
                selectedItem.visible
                  ? 'text-slate-300 hover:text-white hover:bg-studio-800'
                  : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
              }`}
            >
              {selectedItem.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}

          {/* Frame/Focus Button */}
          <button
            onClick={onFocusSelected}
            title="Focus Camera (F)"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-studio-800 transition"
          >
            <Focus size={14} />
          </button>

          {/* Lock Transform Button */}
          {onToggleLock && (
            <button
              onClick={() => onToggleLock(selectedItem.id)}
              title={selectedItem.locked ? 'Unlock Object (L)' : 'Lock Transform (L)'}
              className={`p-1.5 rounded-lg text-xs transition ${
                selectedItem.locked
                  ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-studio-800'
              }`}
            >
              {selectedItem.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          )}

          {/* Duplicate Button */}
          {onDuplicateSelected && (
            <button
              onClick={onDuplicateSelected}
              title="Duplicate Object (Shift+D)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-studio-800 transition"
            >
              <Copy size={14} />
            </button>
          )}

          {/* Material Button */}
          {onOpenMaterialTab && (
            <button
              onClick={onOpenMaterialTab}
              title="Inspect Material"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-studio-800 transition"
            >
              <Palette size={14} />
            </button>
          )}

          <div className="w-[1px] h-4 bg-studio-750 mx-0.5" />

          {/* Delete Button */}
          {onDeleteSelected && (
            <button
              onClick={onDeleteSelected}
              title="Delete Object (Del / Backspace)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      {/* Quick Character Anatomy, Underwear & Garment Visibility Toggles */}
      {(characterBodyItems.length > 0 || characterUnderwearItems.length > 0 || characterClothesItems.length > 0) && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-studio-900/90 border border-studio-700/60 px-2.5 py-1 rounded-xl shadow-xl backdrop-blur-md z-10 text-xs">
          {characterBodyItems.length > 0 && onToggleVisibility && (
            <button
              onClick={() => {
                const anyVisible = characterBodyItems.some((b) => b.visible);
                characterBodyItems.forEach((b) => {
                  if (anyVisible ? b.visible : !b.visible) {
                    onToggleVisibility(b.id);
                  }
                });
              }}
              className={`px-2 py-0.5 rounded-lg flex items-center space-x-1.5 font-medium transition ${
                characterBodyItems.some((b) => b.visible)
                  ? 'bg-studio-800 text-slate-200 hover:bg-studio-700'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
              title={characterBodyItems.some((b) => b.visible) ? 'Hide Character Body' : 'Show Character Body'}
            >
              {characterBodyItems.some((b) => b.visible) ? <Eye size={12} className="text-emerald-400" /> : <EyeOff size={12} className="text-amber-400" />}
              <span>Body: {characterBodyItems.some((b) => b.visible) ? 'Visible' : 'Hidden'}</span>
            </button>
          )}
          {characterUnderwearItems.length > 0 && onToggleVisibility && (
            <button
              onClick={() => {
                const anyVisible = characterUnderwearItems.some((u) => u.visible);
                characterUnderwearItems.forEach((u) => {
                  if (anyVisible ? u.visible : !u.visible) {
                    onToggleVisibility(u.id);
                  }
                });
              }}
              className={`px-2 py-0.5 rounded-lg flex items-center space-x-1.5 font-medium transition ${
                characterUnderwearItems.some((u) => u.visible)
                  ? 'bg-studio-800 text-slate-200 hover:bg-studio-700'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
              title={characterUnderwearItems.some((u) => u.visible) ? 'Hide Inner Garments' : 'Show Inner Garments'}
            >
              {characterUnderwearItems.some((u) => u.visible) ? <Eye size={12} className="text-purple-400" /> : <EyeOff size={12} className="text-amber-400" />}
              <span>Underwear: {characterUnderwearItems.some((u) => u.visible) ? 'Visible' : 'Hidden'}</span>
            </button>
          )}
          {characterClothesItems.length > 0 && onToggleVisibility && (
            <button
              onClick={() => {
                const anyVisible = characterClothesItems.some((c) => c.visible);
                characterClothesItems.forEach((c) => {
                  if (anyVisible ? c.visible : !c.visible) {
                    onToggleVisibility(c.id);
                  }
                });
              }}
              className={`px-2 py-0.5 rounded-lg flex items-center space-x-1.5 font-medium transition ${
                characterClothesItems.some((c) => c.visible)
                  ? 'bg-studio-800 text-slate-200 hover:bg-studio-700'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
              title={characterClothesItems.some((c) => c.visible) ? 'Hide All Clothes' : 'Show All Clothes'}
            >
              {characterClothesItems.some((c) => c.visible) ? <Eye size={12} className="text-blue-400" /> : <EyeOff size={12} className="text-amber-400" />}
              <span>Clothes: {characterClothesItems.some((c) => c.visible) ? 'Visible' : 'Hidden'}</span>
            </button>
          )}
        </div>
      )}

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

      {/* Bottom Right: Global Hidden Objects Notification Banner */}
      {hiddenCount > 0 && onUnhideAll && (
        <div className="absolute bottom-3 right-3 z-20">
          <button
            onClick={onUnhideAll}
            className="bg-studio-900/95 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/50 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md transition flex items-center space-x-2 group cursor-pointer"
            title="Restore visibility of all hidden objects (Alt+H)"
          >
            <EyeOff size={14} className="text-amber-400 group-hover:text-slate-950" />
            <span>
              {hiddenCount} object{hiddenCount > 1 ? 's' : ''} hidden • <span className="underline decoration-amber-400 font-bold">Unhide All (Alt+H)</span>
            </span>
          </button>
        </div>
      )}

      {/* Right-Click 3D Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-studio-900/95 backdrop-blur-xl border border-studio-750/90 rounded-xl shadow-2xl py-1.5 min-w-[210px] z-50 text-xs text-slate-200 divide-y divide-studio-800 select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {selectedItem && (
            <div className="px-3 py-1.5 font-semibold text-slate-400 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: selectedItem.material?.color || '#3b82f6' }}
              />
              <span className="truncate">{selectedItem.name}</span>
            </div>
          )}

          <div className="py-1">
            {selectedItem && (
              <>
                <button
                  onClick={() => {
                    onFocusSelected();
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
                >
                  <span className="flex items-center space-x-2">
                    <Focus size={13} />
                    <span>Focus Selected</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">F</span>
                </button>

                {onToggleVisibility && (
                  <button
                    onClick={() => {
                      onToggleVisibility(selectedItem.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
                  >
                    <span className="flex items-center space-x-2">
                      {selectedItem.visible ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{selectedItem.visible ? 'Hide Object' : 'Show Object'}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">H</span>
                  </button>
                )}

                {onToggleLock && (
                  <button
                    onClick={() => {
                      onToggleLock(selectedItem.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
                  >
                    <span className="flex items-center space-x-2">
                      {selectedItem.locked ? <Unlock size={13} /> : <Lock size={13} />}
                      <span>{selectedItem.locked ? 'Unlock Transform' : 'Lock Transform'}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">L</span>
                  </button>
                )}

                {onDuplicateSelected && (
                  <button
                    onClick={() => {
                      onDuplicateSelected();
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
                  >
                    <span className="flex items-center space-x-2">
                      <Copy size={13} />
                      <span>Duplicate Object</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Shift+D</span>
                  </button>
                )}

                {onOpenMaterialTab && (
                  <button
                    onClick={() => {
                      onOpenMaterialTab();
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
                  >
                    <span className="flex items-center space-x-2">
                      <Palette size={13} />
                      <span>Inspect Material</span>
                    </span>
                  </button>
                )}
              </>
            )}

            {characterBodyItems.length > 0 && onToggleVisibility && (
              <button
                onClick={() => {
                  const anyVisible = characterBodyItems.some((b) => b.visible);
                  characterBodyItems.forEach((b) => {
                    if (anyVisible ? b.visible : !b.visible) {
                      onToggleVisibility(b.id);
                    }
                  });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
              >
                <span className="flex items-center space-x-2">
                  {characterBodyItems.some((b) => b.visible) ? <EyeOff size={13} className="text-amber-400" /> : <Eye size={13} className="text-emerald-400" />}
                  <span>{characterBodyItems.some((b) => b.visible) ? 'Hide Character Body' : 'Show Character Body'}</span>
                </span>
              </button>
            )}

            {characterClothesItems && characterClothesItems.length > 0 && onToggleVisibility && (
              <button
                onClick={() => {
                  const anyVisible = characterClothesItems.some((c) => c.visible);
                  characterClothesItems.forEach((c) => {
                    if (anyVisible ? c.visible : !c.visible) {
                      onToggleVisibility(c.id);
                    }
                  });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
              >
                <span className="flex items-center space-x-2">
                  {characterClothesItems.some((c) => c.visible) ? <EyeOff size={13} className="text-amber-400" /> : <Eye size={13} className="text-blue-400" />}
                  <span>{characterClothesItems.some((c) => c.visible) ? 'Hide All Clothes' : 'Show All Clothes'}</span>
                </span>
              </button>
            )}

            {onUnhideAll && (
              <button
                onClick={() => {
                  onUnhideAll();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
              >
                <span className="flex items-center space-x-2">
                  <Eye size={13} />
                  <span>Unhide All Objects</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Alt+H</span>
              </button>
            )}

            <button
              onClick={() => {
                onResetCamera();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-studio-800 hover:text-white transition"
            >
              <span className="flex items-center space-x-2">
                <Compass size={13} />
                <span>Reset Camera View</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Home</span>
            </button>
          </div>

          {selectedItem && onDeleteSelected && (
            <div className="py-1">
              <button
                onClick={() => {
                  onDeleteSelected();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition"
              >
                <span className="flex items-center space-x-2">
                  <Trash2 size={13} />
                  <span>Delete Object</span>
                </span>
                <span className="text-[10px] text-rose-500/80 font-mono">Del</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
