import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Palette,
  Layers,
  Sun,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Unlock,
  Wand2,
} from 'lucide-react';
import {
  EnvironmentSettings,
  MaterialProperties,
  Modifier,
  SceneItem,
  TexturePreset,
  TransformData,
} from '../types';

interface RightInspectorProps {
  sceneItems: SceneItem[];
  selectedItem: SceneItem | null;
  environment: EnvironmentSettings;
  onSelectObject: (id: string | null) => void;
  onUpdateTransform: (id: string, transform: TransformData) => void;
  onUpdateMaterial: (id: string, material: MaterialProperties) => void;
  onUpdateEnvironment: (env: EnvironmentSettings) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRenameObject: (id: string, newName: string) => void;
  onDeleteObject: (id: string) => void;
  onAddModifier: (id: string, type: 'noise_displace' | 'twist' | 'subdivide') => void;
  onUpdateModifierFactor: (id: string, modId: string, factor: number) => void;
  onToggleModifier: (id: string, modId: string) => void;
  onDeleteModifier: (id: string, modId: string) => void;
}

const NumericInput: React.FC<{
  value: number;
  step?: number;
  min?: number;
  onChange: (val: number) => void;
  className?: string;
  isDegrees?: boolean;
}> = ({ value, step = 0.1, min, onChange, className, isDegrees }) => {
  const displayVal = isDegrees
    ? Math.round(value * (180 / Math.PI))
    : Number(value.toFixed(2));
  const [localStr, setLocalStr] = useState<string>(String(displayVal));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalStr(String(displayVal));
    }
  }, [displayVal, isFocused]);

  const commit = (str: string) => {
    const parsed = parseFloat(str);
    if (!isNaN(parsed)) {
      const finalVal = min !== undefined ? Math.max(min, parsed) : parsed;
      onChange(isDegrees ? finalVal * (Math.PI / 180) : finalVal);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={isFocused ? localStr : String(displayVal)}
      onFocus={() => {
        setIsFocused(true);
        setLocalStr(String(displayVal));
      }}
      onChange={(e) => {
        setLocalStr(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => {
        setIsFocused(false);
        commit(localStr);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const cur = parseFloat(localStr) || 0;
          const next = cur + (step || 1);
          setLocalStr(String(Number(next.toFixed(2))));
          commit(String(next));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const cur = parseFloat(localStr) || 0;
          const next = cur - (step || 1);
          setLocalStr(String(Number(next.toFixed(2))));
          commit(String(next));
        }
      }}
      className={className}
    />
  );
};

export const RightInspector: React.FC<RightInspectorProps> = ({
  sceneItems,
  selectedItem,
  environment,
  onSelectObject,
  onUpdateTransform,
  onUpdateMaterial,
  onUpdateEnvironment,
  onToggleVisibility,
  onToggleLock,
  onRenameObject,
  onDeleteObject,
  onAddModifier,
  onUpdateModifierFactor,
  onToggleModifier,
  onDeleteModifier,
}) => {
  const [activeTab, setActiveTab] = useState<'transform' | 'material' | 'modifiers' | 'scene' | 'environment'>('transform');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // Transform input handlers
  const handlePositionChange = (axis: 0 | 1 | 2, val: number) => {
    if (!selectedItem) return;
    const newPos: [number, number, number] = [...selectedItem.transform.position];
    newPos[axis] = isNaN(val) ? 0 : val;
    onUpdateTransform(selectedItem.id, {
      ...selectedItem.transform,
      position: newPos,
    });
  };

  const handleRotationChange = (axis: 0 | 1 | 2, radVal: number) => {
    if (!selectedItem) return;
    const newRot: [number, number, number] = [...selectedItem.transform.rotation];
    newRot[axis] = isNaN(radVal) ? 0 : radVal;
    onUpdateTransform(selectedItem.id, {
      ...selectedItem.transform,
      rotation: newRot,
    });
  };

  const handleScaleChange = (axis: 0 | 1 | 2, val: number) => {
    if (!selectedItem) return;
    const newScale: [number, number, number] = [...selectedItem.transform.scale];
    newScale[axis] = isNaN(val) ? 1 : Math.max(0.01, val);
    onUpdateTransform(selectedItem.id, {
      ...selectedItem.transform,
      scale: newScale,
    });
  };

  return (
    <aside className="w-72 bg-studio-900 border-l border-studio-750 flex flex-col select-none z-40 text-xs">
      {/* Top Tab Switcher */}
      <div className="h-10 bg-studio-950 border-b border-studio-800 flex items-center px-1 space-x-1">
        <button
          onClick={() => setActiveTab('scene')}
          title="Outliner / Scene Hierarchy"
          className={`flex-1 py-1.5 flex justify-center items-center rounded transition ${
            activeTab === 'scene' ? 'bg-studio-800 text-studio-accent font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={15} />
        </button>

        <button
          onClick={() => setActiveTab('transform')}
          title="Transform Properties"
          className={`flex-1 py-1.5 flex justify-center items-center rounded transition ${
            activeTab === 'transform' ? 'bg-studio-800 text-studio-accent font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders size={15} />
        </button>

        <button
          onClick={() => setActiveTab('material')}
          title="Material & Shading Editor"
          className={`flex-1 py-1.5 flex justify-center items-center rounded transition ${
            activeTab === 'material' ? 'bg-studio-800 text-studio-accent font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Palette size={15} />
        </button>

        <button
          onClick={() => setActiveTab('modifiers')}
          title="Mesh Modifiers & Sculpting"
          className={`flex-1 py-1.5 flex justify-center items-center rounded transition ${
            activeTab === 'modifiers' ? 'bg-studio-800 text-studio-accent font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wand2 size={15} />
        </button>

        <button
          onClick={() => setActiveTab('environment')}
          title="Lighting & Environment Settings"
          className={`flex-1 py-1.5 flex justify-center items-center rounded transition ${
            activeTab === 'environment' ? 'bg-studio-800 text-studio-accent font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sun size={15} />
        </button>
      </div>

      {/* Main Tab Panel Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TAB 1: OUTLINER / SCENE TREE */}
        {activeTab === 'scene' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-slate-400 font-semibold mb-2">
              <span className="text-[11px] uppercase tracking-wider">Scene Hierarchy ({sceneItems.length})</span>
            </div>

            <div className="space-y-1">
              {sceneItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isEditing = editingNameId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectObject(item.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition ${
                      isSelected
                        ? 'bg-studio-accent/20 border border-studio-accent/40 text-white font-medium'
                        : 'bg-studio-850 hover:bg-studio-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0 mr-2">
                      <div className="w-2 h-2 rounded-full bg-studio-accent" />
                      {isEditing ? (
                        <input
                          autoFocus
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRenameObject(item.id, tempName.trim() || item.name);
                              setEditingNameId(null);
                            }
                          }}
                          onBlur={() => {
                            onRenameObject(item.id, tempName.trim() || item.name);
                            setEditingNameId(null);
                          }}
                          className="bg-studio-950 px-1 py-0.5 rounded border border-studio-accent text-white outline-none w-full"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => {
                            setEditingNameId(item.id);
                            setTempName(item.name);
                          }}
                          className="truncate text-xs"
                          title="Double-click to rename"
                        >
                          {item.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleVisibility(item.id)}
                        className="p-1 hover:text-white text-slate-500"
                        title={item.visible ? 'Hide' : 'Show'}
                      >
                        {item.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-red-400" />}
                      </button>

                      <button
                        onClick={() => onToggleLock(item.id)}
                        className="p-1 hover:text-white text-slate-500"
                        title={item.locked ? 'Unlock' : 'Lock'}
                      >
                        {item.locked ? <Lock size={13} className="text-amber-400" /> : <Unlock size={13} />}
                      </button>

                      <button
                        onClick={() => onDeleteObject(item.id)}
                        className="p-1 hover:text-red-400 text-slate-500"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: TRANSFORM INSPECTOR */}
        {activeTab === 'transform' && (
          <div className="space-y-4">
            {!selectedItem ? (
              <div className="text-center py-10 text-slate-500">
                <Sliders size={28} className="mx-auto mb-2 opacity-40" />
                <p>No object selected</p>
                <p className="text-[11px] mt-1 text-slate-600">Select an object from the viewport or outliner</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-studio-800">
                  <span className="font-semibold text-slate-200">{selectedItem.name}</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-studio-800 text-slate-400">
                    {selectedItem.primitiveType || 'Mesh'}
                  </span>
                </div>

                {/* POSITION */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Position</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                      <div key={axis} className="flex items-center bg-studio-950 border border-studio-800 rounded px-1.5 py-1">
                        <span className={`font-mono text-[11px] font-bold mr-1 ${idx === 0 ? 'text-red-400' : idx === 1 ? 'text-green-400' : 'text-blue-400'}`}>
                          {axis}
                        </span>
                        <NumericInput
                          value={selectedItem.transform.position[idx]}
                          step={0.1}
                          onChange={(val) => handlePositionChange(idx as 0 | 1 | 2, val)}
                          className="w-full bg-transparent text-right font-mono text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ROTATION */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rotation (Deg)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                      <div key={axis} className="flex items-center bg-studio-950 border border-studio-800 rounded px-1.5 py-1">
                        <span className={`font-mono text-[11px] font-bold mr-1 ${idx === 0 ? 'text-red-400' : idx === 1 ? 'text-green-400' : 'text-blue-400'}`}>
                          {axis}
                        </span>
                        <NumericInput
                          value={selectedItem.transform.rotation[idx]}
                          isDegrees={true}
                          step={5}
                          onChange={(val) => handleRotationChange(idx as 0 | 1 | 2, val)}
                          className="w-full bg-transparent text-right font-mono text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* SCALE */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Scale</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                      <div key={axis} className="flex items-center bg-studio-950 border border-studio-800 rounded px-1.5 py-1">
                        <span className={`font-mono text-[11px] font-bold mr-1 ${idx === 0 ? 'text-red-400' : idx === 1 ? 'text-green-400' : 'text-blue-400'}`}>
                          {axis}
                        </span>
                        <NumericInput
                          value={selectedItem.transform.scale[idx]}
                          min={0.01}
                          step={0.1}
                          onChange={(val) => handleScaleChange(idx as 0 | 1 | 2, val)}
                          className="w-full bg-transparent text-right font-mono text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Reset Button */}
                <button
                  onClick={() =>
                    onUpdateTransform(selectedItem.id, {
                      position: [0, 0, 0],
                      rotation: [0, 0, 0],
                      scale: [1, 1, 1],
                    })
                  }
                  className="w-full py-1.5 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-300 rounded font-medium transition"
                >
                  Reset Transforms
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATERIAL & SHADER EDITOR */}
        {activeTab === 'material' && (
          <div className="space-y-4">
            {!selectedItem ? (
              <div className="text-center py-10 text-slate-500">
                <Palette size={28} className="mx-auto mb-2 opacity-40" />
                <p>No object selected</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Base Color */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Base Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={selectedItem.material.color}
                      onChange={(e) =>
                        onUpdateMaterial(selectedItem.id, {
                          ...selectedItem.material,
                          color: e.target.value,
                        })
                      }
                      className="w-8 h-8 rounded border border-studio-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={selectedItem.material.color}
                      onChange={(e) =>
                        onUpdateMaterial(selectedItem.id, {
                          ...selectedItem.material,
                          color: e.target.value,
                        })
                      }
                      className="flex-1 bg-studio-950 border border-studio-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Metallic */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                    <span>Metallic</span>
                    <span className="font-mono text-studio-accent">{selectedItem.material.metalness.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedItem.material.metalness}
                    onChange={(e) =>
                      onUpdateMaterial(selectedItem.id, {
                        ...selectedItem.material,
                        metalness: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-studio-accent cursor-pointer"
                  />
                </div>

                {/* Roughness */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                    <span>Roughness</span>
                    <span className="font-mono text-studio-accent">{selectedItem.material.roughness.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedItem.material.roughness}
                    onChange={(e) =>
                      onUpdateMaterial(selectedItem.id, {
                        ...selectedItem.material,
                        roughness: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-studio-accent cursor-pointer"
                  />
                </div>

                {/* Transmission / Glass */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                    <span>Transmission (Glass)</span>
                    <span className="font-mono text-studio-accent">{selectedItem.material.transmission.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedItem.material.transmission}
                    onChange={(e) =>
                      onUpdateMaterial(selectedItem.id, {
                        ...selectedItem.material,
                        transmission: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-studio-accent cursor-pointer"
                  />
                </div>

                {/* Emissive Color & Intensity */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Emission Glow</label>
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="color"
                      value={selectedItem.material.emissive}
                      onChange={(e) =>
                        onUpdateMaterial(selectedItem.id, {
                          ...selectedItem.material,
                          emissive: e.target.value,
                        })
                      }
                      className="w-8 h-8 rounded border border-studio-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={selectedItem.material.emissiveIntensity}
                      onChange={(e) =>
                        onUpdateMaterial(selectedItem.id, {
                          ...selectedItem.material,
                          emissiveIntensity: parseFloat(e.target.value),
                        })
                      }
                      className="flex-1 accent-studio-accent cursor-pointer"
                    />
                  </div>
                </div>

                {/* Procedural Texture Pattern */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Texture Pattern</label>
                  <select
                    value={selectedItem.material.texturePreset}
                    onChange={(e) =>
                      onUpdateMaterial(selectedItem.id, {
                        ...selectedItem.material,
                        texturePreset: e.target.value as TexturePreset,
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-800 rounded px-2 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="none">None (Solid Color)</option>
                    <option value="checker">Checkerboard Grid</option>
                    <option value="uv_grid">UV Coordinate Calibration Grid</option>
                    <option value="stripes">Linear Stripes Pattern</option>
                  </select>
                </div>

                {/* Wireframe toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-studio-800">
                  <span className="text-[11px] font-semibold text-slate-400">Wireframe Overlay</span>
                  <input
                    type="checkbox"
                    checked={selectedItem.material.wireframe}
                    onChange={(e) =>
                      onUpdateMaterial(selectedItem.id, {
                        ...selectedItem.material,
                        wireframe: e.target.checked,
                      })
                    }
                    className="accent-studio-accent w-4 h-4 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MODIFIERS & PROCEDURAL MODELING */}
        {activeTab === 'modifiers' && (
          <div className="space-y-3">
            {!selectedItem ? (
              <div className="text-center py-10 text-slate-500">
                <Wand2 size={28} className="mx-auto mb-2 opacity-40" />
                <p>No object selected</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-studio-800">
                  <span className="font-semibold text-slate-300">Active Modifiers</span>
                </div>

                {/* Add Modifier Dropdown/Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onAddModifier(selectedItem.id, 'noise_displace')}
                    className="px-2 py-1.5 bg-studio-850 hover:bg-studio-800 border border-studio-750 rounded text-[11px] text-purple-300 font-medium transition"
                  >
                    + Noise Sculpt
                  </button>
                  <button
                    onClick={() => onAddModifier(selectedItem.id, 'twist')}
                    className="px-2 py-1.5 bg-studio-850 hover:bg-studio-800 border border-studio-750 rounded text-[11px] text-blue-300 font-medium transition"
                  >
                    + Axial Twist
                  </button>
                  <button
                    onClick={() => onAddModifier(selectedItem.id, 'subdivide')}
                    className="col-span-2 px-2 py-1.5 bg-studio-850 hover:bg-studio-800 border border-studio-750 rounded text-[11px] text-amber-300 font-medium transition"
                  >
                    + Subdivide Refinement
                  </button>
                </div>

                {/* Modifiers List */}
                <div className="space-y-2 mt-2">
                  {(selectedItem.modifiers || []).map((mod: Modifier) => (
                    <div
                      key={mod.id}
                      className="p-2.5 bg-studio-950 border border-studio-800 rounded space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="capitalize font-semibold text-slate-200">
                          {mod.type.replace('_', ' ')}
                        </span>
                        <div className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={mod.enabled}
                            onChange={() => onToggleModifier(selectedItem.id, mod.id)}
                            className="accent-studio-accent w-3.5 h-3.5 cursor-pointer mr-1"
                          />
                          <button
                            onClick={() => onDeleteModifier(selectedItem.id, mod.id)}
                            className="text-slate-500 hover:text-red-400 p-0.5"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-400">Factor:</span>
                        <input
                          type="range"
                          min={mod.type === 'subdivide' ? 1 : 0}
                          max={mod.type === 'subdivide' ? 2 : mod.type === 'twist' ? 6 : 0.8}
                          step={mod.type === 'subdivide' ? 1 : 0.05}
                          value={mod.factor}
                          onChange={(e) =>
                            onUpdateModifierFactor(selectedItem.id, mod.id, parseFloat(e.target.value))
                          }
                          className="flex-1 accent-studio-accent cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-slate-300 w-8 text-right">
                          {mod.factor.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {(!selectedItem.modifiers || selectedItem.modifiers.length === 0) && (
                    <p className="text-slate-500 text-center py-4 text-[11px]">No modifiers added yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ENVIRONMENT & LIGHTING */}
        {activeTab === 'environment' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {/* Preset */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Studio Preset</label>
                <select
                  value={environment.preset}
                  onChange={(e) =>
                    onUpdateEnvironment({
                      ...environment,
                      preset: e.target.value as EnvironmentSettings['preset'],
                    })
                  }
                  className="w-full bg-studio-950 border border-studio-800 rounded px-2 py-1.5 text-slate-200 outline-none"
                >
                  <option value="studio">Studio Neutral (Crisp White)</option>
                  <option value="sunset">Sunset Glow (Warm Amber)</option>
                  <option value="cyberpunk">Cyberpunk Neon (Cyan / Magenta)</option>
                  <option value="dawn">Dawn Sky (Pastel Sky)</option>
                </select>
              </div>

              {/* Background Color */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Background Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={environment.backgroundColor}
                    onChange={(e) =>
                      onUpdateEnvironment({
                        ...environment,
                        backgroundColor: e.target.value,
                      })
                    }
                    className="w-8 h-8 rounded border border-studio-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={environment.backgroundColor}
                    onChange={(e) =>
                      onUpdateEnvironment({
                        ...environment,
                        backgroundColor: e.target.value,
                      })
                    }
                    className="flex-1 bg-studio-950 border border-studio-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Ambient Light */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Ambient Intensity</span>
                  <span className="font-mono text-studio-accent">{environment.ambientIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={environment.ambientIntensity}
                  onChange={(e) =>
                    onUpdateEnvironment({
                      ...environment,
                      ambientIntensity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-studio-accent cursor-pointer"
                />
              </div>

              {/* Sun Light */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Directional Sunlight</span>
                  <span className="font-mono text-studio-accent">{environment.directionalIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={environment.directionalIntensity}
                  onChange={(e) =>
                    onUpdateEnvironment({
                      ...environment,
                      directionalIntensity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-studio-accent cursor-pointer"
                />
              </div>

              {/* Shadow toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-studio-800">
                <span className="text-[11px] font-semibold text-slate-400">Real-Time Shadows</span>
                <input
                  type="checkbox"
                  checked={environment.shadows}
                  onChange={(e) =>
                    onUpdateEnvironment({
                      ...environment,
                      shadows: e.target.checked,
                    })
                  }
                  className="accent-studio-accent w-4 h-4 rounded cursor-pointer"
                />
              </div>

              {/* Grid toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Ground Grid</span>
                <input
                  type="checkbox"
                  checked={environment.showGrid}
                  onChange={(e) =>
                    onUpdateEnvironment({
                      ...environment,
                      showGrid: e.target.checked,
                    })
                  }
                  className="accent-studio-accent w-4 h-4 rounded cursor-pointer"
                />
              </div>

              {/* Axes toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Coordinate Axes</span>
                <input
                  type="checkbox"
                  checked={environment.showAxes}
                  onChange={(e) =>
                    onUpdateEnvironment({
                      ...environment,
                      showAxes: e.target.checked,
                    })
                  }
                  className="accent-studio-accent w-4 h-4 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
