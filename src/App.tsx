import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AnimationTrack,
  CameraView,
  EnvironmentSettings,
  MaterialProperties,
  PrimitiveType,
  SceneItem,
  ShadingMode,
  TimelineState,
  TransformData,
  TransformMode,
  ViewportStats,
} from './types';
import { Engine } from './core/engine';
import {
  evaluateTrackAtFrame,
  insertOrUpdateKeyframe,
  removeKeyframeAt,
  createTurntableTrack,
} from './core/animation';
import {
  exportToGLTF,
  exportToOBJ,
  exportToSTL,
  exportProjectFile,
  parseProjectFile,
  convertPolyforgeTracksToAnimationClip,
} from './core/io';
import { generateAnimatedBicycleCircuit } from './core/bicycle';
import { generateAnimatedCyclistCircuit } from './core/cyclist';
import { generateRealisticHumanScene, generateRealisticFemaleScene } from './core/character';
import { importModelFromFile } from './core/modelImporter';
import { history } from './core/history';
import { TopNavbar } from './components/TopNavbar';
import { LeftToolbar } from './components/LeftToolbar';
import { RightInspector } from './components/RightInspector';
import { Timeline } from './components/Timeline';
import { Viewport } from './components/Viewport';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';

const DEFAULT_MATERIAL: MaterialProperties = {
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

const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  backgroundColor: '#ffffff',
  ambientIntensity: 0.6,
  directionalIntensity: 1.2,
  showGrid: true,
  showAxes: true,
  shadows: true,
  preset: 'studio',
};

export const App: React.FC = () => {
  // Scene Items
  const [sceneItems, setSceneItems] = useState<SceneItem[]>([
    {
      id: 'default-cube',
      name: 'Studio Cube',
      type: 'mesh',
      primitiveType: 'box',
      transform: {
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material: { ...DEFAULT_MATERIAL },
      visible: true,
      locked: false,
      modifiers: [],
    },
  ]);

  const [selectedId, setSelectedId] = useState<string | null>('default-cube');
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [shadingMode, setShadingMode] = useState<ShadingMode>('rendered');
  const [cameraView, setCameraView] = useState<CameraView>('perspective');
  const [environment, setEnvironment] = useState<EnvironmentSettings>(DEFAULT_ENVIRONMENT);

  // Animation State
  const [tracks, setTracks] = useState<AnimationTrack[]>([]);
  const [timelineState, setTimelineState] = useState<TimelineState>({
    currentFrame: 0,
    totalFrames: 120,
    fps: 30,
    isPlaying: false,
    isLooping: true,
    autoKeying: false,
  });

  // Diagnostics & Modals
  const [stats, setStats] = useState<ViewportStats>({
    fps: 60,
    triangles: 12,
    vertices: 24,
    objectsCount: 1,
  });
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [, setHistoryTick] = useState(0);

  // Engine references
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  // Synchronized refs to avoid stale closures in engine callbacks
  const sceneItemsRef = useRef(sceneItems);
  sceneItemsRef.current = sceneItems;

  const timelineStateRef = useRef(timelineState);
  timelineStateRef.current = timelineState;

  // Subscribe to history changes for Undo/Redo button updates
  useEffect(() => {
    return history.subscribe(() => setHistoryTick((t) => t + 1));
  }, []);

  // Initialize Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new Engine(containerRef.current, {
      onSelectObject: (id) => setSelectedId(id),
      onObjectTransformed: (id, newTransform) => {
        setSceneItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, transform: newTransform } : item))
        );
      },
      onTransformCommit: (id, committedTransform) => {
        // Record undoable history step using latest state
        const currentItems = sceneItemsRef.current;
        const oldItem = currentItems.find((it) => it.id === id);
        if (oldItem) {
          const prevTransform = { ...oldItem.transform };
          history.record({
            name: `Transform ${oldItem.name}`,
            undo: () => {
              setSceneItems((cur) =>
                cur.map((it) => (it.id === id ? { ...it, transform: prevTransform } : it))
              );
            },
            redo: () => {
              setSceneItems((cur) =>
                cur.map((it) => (it.id === id ? { ...it, transform: committedTransform } : it))
              );
            },
          });
        }

        // Auto-keying check with latest timeline state
        if (timelineStateRef.current.autoKeying) {
          setTracks((prev) => {
            let existingTrack = prev.find((t) => t.objectId === id);
            if (!existingTrack) {
              existingTrack = { objectId: id, keyframes: [] };
            }
            const updatedTrack = insertOrUpdateKeyframe(
              existingTrack,
              timelineStateRef.current.currentFrame,
              committedTransform,
              'ease-in-out'
            );
            return [...prev.filter((t) => t.objectId !== id), updatedTrack];
          });
        }
      },
      onStatsUpdate: (newStats) => setStats(newStats),
    });

    engineRef.current = engine;
    engine.syncSceneItems(sceneItems);
    engine.setSelectedObject(selectedId);
    engine.setTransformMode(transformMode);
    engine.updateEnvironment(environment);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync engine scene items when state changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.syncSceneItems(sceneItems);
    }
  }, [sceneItems]);

  // Sync selection to engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedObject(selectedId);
    }
  }, [selectedId]);

  // Sync transform mode
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTransformMode(transformMode);
    }
  }, [transformMode]);

  // Sync shading mode
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setShadingMode(shadingMode);
      engineRef.current.syncSceneItems(sceneItems);
    }
  }, [shadingMode, sceneItems]);

  // Sync camera view
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCameraView(cameraView);
    }
  }, [cameraView]);

  // Sync environment
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateEnvironment(environment);
    }
  }, [environment]);

  // Animation Playback Interval
  useEffect(() => {
    if (!timelineState.isPlaying) return;

    const intervalMs = 1000 / timelineState.fps;
    const timer = setInterval(() => {
      setTimelineState((prev) => {
        let nextFrame = prev.currentFrame + 1;
        if (nextFrame > prev.totalFrames) {
          if (prev.isLooping) {
            nextFrame = 0;
          } else {
            return { ...prev, isPlaying: false };
          }
        }
        return { ...prev, currentFrame: nextFrame };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [timelineState.isPlaying, timelineState.fps]);

  // Evaluate Animated Transforms at current frame
  useEffect(() => {
    if (tracks.length === 0) return;

    setSceneItems((prev) =>
      prev.map((item) => {
        const track = tracks.find((t) => t.objectId === item.id);
        if (!track || track.keyframes.length === 0) return item;

        const evaluatedTransform = evaluateTrackAtFrame(track, timelineState.currentFrame, item.transform);
        return {
          ...item,
          transform: evaluatedTransform,
        };
      })
    );
  }, [timelineState.currentFrame, tracks]);

  // Add Primitive action
  const handleAddPrimitive = (type: PrimitiveType) => {
    const id = `mesh-${type}-${Date.now().toString(36)}`;
    const count = sceneItems.filter((it) => it.primitiveType === type).length + 1;
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;

    const newItem: SceneItem = {
      id,
      name,
      type: 'mesh',
      primitiveType: type,
      transform: {
        position: [0, type === 'plane' ? 0 : 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material: { ...DEFAULT_MATERIAL },
      visible: true,
      locked: false,
      modifiers: [],
    };

    history.execute({
      name: `Add ${name}`,
      undo: () => {
        setSceneItems((prev) => prev.filter((it) => it.id !== id));
        setSelectedId(null);
      },
      redo: () => {
        setSceneItems((prev) => [...prev, newItem]);
        setSelectedId(id);
      },
    });
  };

  // Delete Selected object
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    const itemToDelete = sceneItems.find((it) => it.id === selectedId);
    if (!itemToDelete) return;

    history.execute({
      name: `Delete ${itemToDelete.name}`,
      undo: () => {
        setSceneItems((prev) => [...prev, itemToDelete]);
        setSelectedId(itemToDelete.id);
      },
      redo: () => {
        setSceneItems((prev) => prev.filter((it) => it.id !== selectedId));
        setSelectedId(null);
      },
    });
  }, [selectedId, sceneItems]);

  // Duplicate Selected object
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const source = sceneItems.find((it) => it.id === selectedId);
    if (!source) return;

    const id = `copy-${Date.now().toString(36)}`;
    const newItem: SceneItem = {
      ...source,
      id,
      name: `${source.name} (Copy)`,
      transform: {
        position: [
          source.transform.position[0] + 0.5,
          source.transform.position[1],
          source.transform.position[2] + 0.5,
        ],
        rotation: [...source.transform.rotation],
        scale: [...source.transform.scale],
      },
      material: { ...source.material },
      modifiers: source.modifiers ? source.modifiers.map((m) => ({ ...m })) : [],
    };

    history.execute({
      name: `Duplicate ${source.name}`,
      undo: () => {
        setSceneItems((prev) => prev.filter((it) => it.id !== id));
        setSelectedId(source.id);
      },
      redo: () => {
        setSceneItems((prev) => [...prev, newItem]);
        setSelectedId(id);
      },
    });
  }, [selectedId, sceneItems]);

  // Update Transform from Inspector
  const handleUpdateTransform = (id: string, newTransform: TransformData) => {
    setSceneItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, transform: newTransform } : item))
    );

    if (timelineStateRef.current.autoKeying) {
      handleAddKeyframeForObject(id, newTransform);
    }
  };

  // Update Material
  const handleUpdateMaterial = (id: string, newMaterial: MaterialProperties) => {
    setSceneItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, material: newMaterial } : item))
    );
  };

  // Modifiers
  const handleAddModifier = (id: string, type: 'noise_displace' | 'twist' | 'subdivide') => {
    const modId = `mod-${Date.now().toString(36)}`;
    setSceneItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const defaultFactor = type === 'subdivide' ? 1 : type === 'twist' ? 1.5 : 0.2;
        const newMods = [...(item.modifiers || []), { id: modId, type, factor: defaultFactor, enabled: true }];
        const updatedItem = { ...item, modifiers: newMods };
        if (engineRef.current) {
          engineRef.current.rebuildObjectGeometry(updatedItem);
        }
        return updatedItem;
      })
    );
  };

  const handleUpdateModifierFactor = (id: string, modId: string, factor: number) => {
    setSceneItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updatedMods = (item.modifiers || []).map((m) => (m.id === modId ? { ...m, factor } : m));
        const updatedItem = { ...item, modifiers: updatedMods };
        if (engineRef.current) {
          engineRef.current.rebuildObjectGeometry(updatedItem);
        }
        return updatedItem;
      })
    );
  };

  const handleToggleModifier = (id: string, modId: string) => {
    setSceneItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updatedMods = (item.modifiers || []).map((m) =>
          m.id === modId ? { ...m, enabled: !m.enabled } : m
        );
        const updatedItem = { ...item, modifiers: updatedMods };
        if (engineRef.current) {
          engineRef.current.rebuildObjectGeometry(updatedItem);
        }
        return updatedItem;
      })
    );
  };

  const handleDeleteModifier = (id: string, modId: string) => {
    setSceneItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updatedMods = (item.modifiers || []).filter((m) => m.id !== modId);
        const updatedItem = { ...item, modifiers: updatedMods };
        if (engineRef.current) {
          engineRef.current.rebuildObjectGeometry(updatedItem);
        }
        return updatedItem;
      })
    );
  };

  // Add Keyframe Helper
  const handleAddKeyframeForObject = (objectId: string, transform: TransformData) => {
    setTracks((prev) => {
      let existingTrack = prev.find((t) => t.objectId === objectId);
      if (!existingTrack) {
        existingTrack = { objectId, keyframes: [] };
      }
      const updatedTrack = insertOrUpdateKeyframe(
        existingTrack,
        timelineState.currentFrame,
        transform,
        'ease-in-out'
      );
      return [...prev.filter((t) => t.objectId !== objectId), updatedTrack];
    });
  };

  // Keyframe timeline callbacks
  const handleAddKeyframe = () => {
    if (!selectedId) return;
    const item = sceneItems.find((it) => it.id === selectedId);
    if (!item) return;
    handleAddKeyframeForObject(selectedId, item.transform);
  };

  const handleRemoveKeyframe = () => {
    if (!selectedId) return;
    setTracks((prev) =>
      prev.map((t) => (t.objectId === selectedId ? removeKeyframeAt(t, timelineState.currentFrame) : t))
    );
  };

  const handleGenerateTurntable = () => {
    if (!selectedId) return;
    const item = sceneItems.find((it) => it.id === selectedId);
    if (!item) return;
    const newTrack = createTurntableTrack(selectedId, item.transform, 0, timelineState.totalFrames);
    setTracks((prev) => [...prev.filter((t) => t.objectId !== selectedId), newTrack]);
  };

  // Project I/O Actions
  const handleNewScene = () => {
    if (window.confirm('Create a new scene? Any unsaved changes will be cleared.')) {
      history.clear();
      setSceneItems([]);
      setSelectedId(null);
      setTracks([]);
    }
  };

  const handleSaveProject = () => {
    exportProjectFile(sceneItems, tracks, environment);
  };

  const handleOpenProject = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      // 1. Direct 3D Model Import (.glb, .gltf, .obj, .stl)
      if (['glb', 'gltf', 'obj', 'stl'].includes(ext || '')) {
        const result = await importModelFromFile(file, {
          autoCenter: true,
          autoScale: true,
          targetMaxDimension: 3.5,
        });

        if (result.items.length === 0) {
          alert(`No valid 3D meshes found in ${file.name}.`);
          return;
        }

        history.clear();
        setSceneItems(result.items);
        setTracks([]);
        setSelectedId(result.items[0].id);

        if (engineRef.current) {
          engineRef.current.syncSceneItems(result.items);
          engineRef.current.focusObject(result.items[0].id);
        }
        return;
      }

      // 2. Project JSON or Character Metadata JSON
      const text = await file.text();
      let items: SceneItem[] = [];
      let newTracks: AnimationTrack[] = [];
      let env: EnvironmentSettings | undefined;

      try {
        const rawJson = JSON.parse(text);

        // Detect standalone character stats/metadata JSON (e.g. PolyForge-Realistic-Female.json)
        if (rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson.items) && rawJson.bodyVertices) {
          const isFemale = rawJson.height === 1.68 || file.name.toLowerCase().includes('female');
          const scene = isFemale ? generateRealisticFemaleScene() : generateRealisticHumanScene();
          items = scene.allItems;
        } else {
          const data = parseProjectFile(text);
          items = data.items;
          newTracks = data.tracks || [];
          env = data.environment;
        }
      } catch (parseErr) {
        // Fallback to strict project file parsing
        const data = parseProjectFile(text);
        items = data.items;
        newTracks = data.tracks || [];
        env = data.environment;
      }

      history.clear();
      setSceneItems(items);
      setTracks(newTracks);
      if (env) setEnvironment(env);
      setSelectedId(items.length > 0 ? items[0].id : null);

      if (engineRef.current) {
        engineRef.current.syncSceneItems(items);
        engineRef.current.focusObject(null);
      }
    } catch (err) {
      alert(`Failed to load project file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImportModel = async (file: File) => {
    try {
      const result = await importModelFromFile(file, {
        autoCenter: true,
        autoScale: true,
        targetMaxDimension: 3.5,
      });

      if (result.items.length === 0) {
        alert(`No valid 3D meshes found in ${file.name}.`);
        return;
      }

      const importedIds = new Set(result.items.map((it) => it.id));
      history.execute({
        name: `Import ${file.name}`,
        undo: () => {
          setSceneItems((prev) => prev.filter((it) => !importedIds.has(it.id)));
          setSelectedId(null);
        },
        redo: () => {
          setSceneItems((prev) => {
            const filtered = prev.filter((it) => it.id !== 'default-cube');
            return [...filtered, ...result.items];
          });
          setSelectedId(result.items[0].id);
        },
      });

      setSelectedId(result.items[0].id);

      if (engineRef.current) {
        engineRef.current.syncSceneItems(result.items);
        engineRef.current.focusObject(result.items[0].id);
      }
    } catch (err) {
      alert(`Failed to import 3D model: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportGLTF = (binary: boolean) => {
    if (engineRef.current) {
      const clip = tracks.length > 0 ? convertPolyforgeTracksToAnimationClip(sceneItems, tracks, timelineState.fps) : null;
      const animations = clip ? [clip] : undefined;
      exportToGLTF(engineRef.current.getUserMeshGroup(), binary, 'polyforge-model', animations);
    }
  };

  const handleAddAnimatedBicycle = () => {
    const circuit = generateAnimatedBicycleCircuit({ totalFrames: 360, fps: 30 });
    setSceneItems((prev) => {
      const filtered = prev.filter((it) => it.id !== 'default-cube');
      return [...filtered, ...circuit.items];
    });
    setTracks((prev) => [...prev, ...circuit.tracks]);
    setTimelineState((prev) => ({
      ...prev,
      currentFrame: 0,
      totalFrames: 360,
      fps: 30,
      isPlaying: true,
      isLooping: true,
    }));
  };

  const handleAddAnimatedCyclist = () => {
    const circuit = generateAnimatedCyclistCircuit({ totalFrames: 360, fps: 30 });
    setSceneItems((prev) => {
      const filtered = prev.filter((it) => it.id !== 'default-cube');
      return [...filtered, ...circuit.allItems];
    });
    setTracks((prev) => [...prev, ...circuit.tracks]);
    setTimelineState((prev) => ({
      ...prev,
      currentFrame: 0,
      totalFrames: 360,
      fps: 30,
      isPlaying: true,
      isLooping: true,
    }));
    setSelectedId(circuit.cyclistCharacter.bodyItem.id);
    if (engineRef.current) {
      engineRef.current.syncSceneItems(circuit.allItems);
      engineRef.current.focusObject(null);
    }
  };

  const handleAddRealisticHuman = () => {
    const human = generateRealisticHumanScene();
    setSceneItems((prev) => {
      const filtered = prev.filter((it) => it.id !== 'default-cube');
      return [...filtered, ...human.allItems];
    });
    setSelectedId(human.bodyItem.id);
    if (engineRef.current) {
      engineRef.current.focusObject(null);
    }
  };

  const handleAddRealisticFemale = () => {
    const female = generateRealisticFemaleScene();
    setSceneItems((prev) => {
      const filtered = prev.filter((it) => it.id !== 'default-cube');
      return [...filtered, ...female.allItems];
    });
    setSelectedId(female.bodyItem.id);
    if (engineRef.current) {
      engineRef.current.focusObject(null);
    }
  };

  const handleExportOBJ = () => {
    if (engineRef.current) {
      exportToOBJ(engineRef.current.getUserMeshGroup(), 'polyforge-model');
    }
  };

  const handleExportSTL = () => {
    if (engineRef.current) {
      exportToSTL(engineRef.current.getUserMeshGroup(), true, 'polyforge-model');
    }
  };

  const handleCaptureSnapshot = () => {
    if (engineRef.current) {
      engineRef.current.captureSnapshot('polyforge-render.png');
    }
  };

  // AI Assistant Scene Integration with Undo/Redo history
  const handleApplySceneUpdate = useCallback(
    (
      newItems: SceneItem[],
      newTracks: AnimationTrack[],
      newEnv?: EnvironmentSettings,
      newTimeline?: Partial<TimelineState>,
      actionName: string = 'AI Scene Update'
    ) => {
      const prevItems = sceneItemsRef.current;
      const prevTracks = tracks;
      const prevEnv = environment;
      const prevTimeline = timelineStateRef.current;

      history.execute({
        name: actionName,
        undo: () => {
          setSceneItems(prevItems);
          setTracks(prevTracks);
          setEnvironment(prevEnv);
          if (newTimeline) {
            setTimelineState(prevTimeline);
          }
          setSelectedId(prevItems.length > 0 ? prevItems[0].id : null);
        },
        redo: () => {
          setSceneItems(newItems);
          setTracks(newTracks);
          if (newEnv) setEnvironment(newEnv);
          if (newTimeline) {
            setTimelineState((cur) => ({ ...cur, ...newTimeline }));
          }
          setSelectedId(newItems.length > 0 ? newItems[0].id : null);
        },
      });
    },
    [tracks, environment]
  );

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing inside an input/textarea
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Undo / Redo
      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          history.redo();
        } else {
          history.undo();
        }
        return;
      }
      if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        history.redo();
        return;
      }

      // Save
      if (e.ctrlKey && key === 's') {
        e.preventDefault();
        handleSaveProject();
        return;
      }

      // New Scene (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && key === 'n') {
        e.preventDefault();
        handleNewScene();
        return;
      }

      // AI Studio Toggle (Ctrl+Shift+A)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'a') {
        e.preventDefault();
        setIsAIOpen((prev) => !prev);
        return;
      }

      // Duplicate
      if (e.shiftKey && key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Delete
      if (e.key === 'Delete' || key === 'x') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Transform Modes
      if (key === 'g') {
        setTransformMode('translate');
      } else if (key === 'r') {
        setTransformMode('rotate');
      } else if (key === 's') {
        setTransformMode('scale');
      } else if (key === 'q') {
        setTransformMode('select');
      }

      // Camera Focus & Reset Hotkeys
      if (key === 'f') {
        if (engineRef.current) {
          engineRef.current.focusObject(selectedId);
        }
      } else if (e.key === 'Home') {
        setCameraView('perspective');
      }

      // Playback Spacebar
      if (e.code === 'Space') {
        e.preventDefault();
        setTimelineState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
      }

      // Step Frames
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) {
          setTimelineState((prev) => ({ ...prev, currentFrame: 0 }));
        } else {
          setTimelineState((prev) => ({ ...prev, currentFrame: Math.max(0, prev.currentFrame - 1) }));
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) {
          setTimelineState((prev) => ({ ...prev, currentFrame: prev.totalFrames }));
        } else {
          setTimelineState((prev) => ({
            ...prev,
            currentFrame: Math.min(prev.totalFrames, prev.currentFrame + 1),
          }));
        }
      }

      // Numpad Views
      if (e.code === 'Numpad1') {
        setCameraView('front');
      } else if (e.code === 'Numpad3') {
        setCameraView('right');
      } else if (e.code === 'Numpad7') {
        setCameraView('top');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDuplicateSelected, handleDeleteSelected]);

  const selectedItem = sceneItems.find((it) => it.id === selectedId) || null;
  const activeTrack = tracks.find((t) => t.objectId === selectedId);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file) {
          handleOpenProject(file);
        }
      }}
      className="flex flex-col h-screen w-screen bg-studio-950 text-slate-100 select-none overflow-hidden font-sans"
    >
      {/* Top Navigation Bar */}
      <TopNavbar
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        onUndo={() => history.undo()}
        onRedo={() => history.redo()}
        onAddPrimitive={handleAddPrimitive}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onNewScene={handleNewScene}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onExportGLTF={handleExportGLTF}
        onExportOBJ={handleExportOBJ}
        onExportSTL={handleExportSTL}
        onCaptureSnapshot={handleCaptureSnapshot}
        shadingMode={shadingMode}
        onChangeShadingMode={setShadingMode}
        cameraView={cameraView}
        onChangeCameraView={setCameraView}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isAIOpen={isAIOpen}
        onToggleAI={() => setIsAIOpen((prev) => !prev)}
        onAddAnimatedBicycle={handleAddAnimatedBicycle}
        onAddAnimatedCyclist={handleAddAnimatedCyclist}
        onAddRealisticHuman={handleAddRealisticHuman}
        onAddRealisticFemale={handleAddRealisticFemale}
        onImportModel={handleImportModel}
      />

      {/* Main Workspace Row: Toolbar + Viewport + Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <LeftToolbar
          transformMode={transformMode}
          onChangeTransformMode={setTransformMode}
          onAddPrimitive={handleAddPrimitive}
          onApplyNoiseSculpt={() => selectedId && handleAddModifier(selectedId, 'noise_displace')}
          onSubdivideSelected={() => selectedId && handleAddModifier(selectedId, 'subdivide')}
          hasSelectedObject={!!selectedId}
        />

        {/* 3D Viewport */}
        <Viewport
          engineRef={engineRef}
          containerRef={containerRef}
          stats={stats}
          cameraView={cameraView}
          transformMode={transformMode}
          selectedObjectName={selectedItem ? selectedItem.name : null}
          onResetCamera={() => setCameraView('perspective')}
          onFocusSelected={() => {
            if (engineRef.current) {
              engineRef.current.focusObject(selectedId);
            }
          }}
          onChangeCameraView={setCameraView}
        />

        {/* Right Inspector */}
        <RightInspector
          sceneItems={sceneItems}
          selectedItem={selectedItem}
          environment={environment}
          onSelectObject={setSelectedId}
          onUpdateTransform={handleUpdateTransform}
          onUpdateMaterial={handleUpdateMaterial}
          onUpdateEnvironment={setEnvironment}
          onToggleVisibility={(id) =>
            setSceneItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it))
            )
          }
          onToggleLock={(id) =>
            setSceneItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, locked: !it.locked } : it))
            )
          }
          onRenameObject={(id, newName) =>
            setSceneItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, name: newName } : it))
            )
          }
          onDeleteObject={(id) => {
            setSelectedId(id);
            handleDeleteSelected();
          }}
          onAddModifier={handleAddModifier}
          onUpdateModifierFactor={handleUpdateModifierFactor}
          onToggleModifier={handleToggleModifier}
          onDeleteModifier={handleDeleteModifier}
        />
      </div>

      {/* Bottom Animation Timeline */}
      <Timeline
        timelineState={timelineState}
        keyframes={activeTrack?.keyframes || []}
        selectedObjectId={selectedId}
        onSetFrame={(f) => setTimelineState((prev) => ({ ...prev, currentFrame: f }))}
        onTogglePlay={() => setTimelineState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))}
        onToggleLoop={() => setTimelineState((prev) => ({ ...prev, isLooping: !prev.isLooping }))}
        onToggleAutoKey={() =>
          setTimelineState((prev) => ({ ...prev, autoKeying: !prev.autoKeying }))
        }
        onAddKeyframe={handleAddKeyframe}
        onRemoveKeyframe={handleRemoveKeyframe}
        onGenerateTurntable={handleGenerateTurntable}
        onChangeFps={(fps) => setTimelineState((prev) => ({ ...prev, fps }))}
        onChangeTotalFrames={(total) =>
          setTimelineState((prev) => ({ ...prev, totalFrames: total }))
        }
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* PolyForge AI Assistant Studio Drawer */}
      <AIAssistantDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        sceneItems={sceneItems}
        tracks={tracks}
        environment={environment}
        timelineState={timelineState}
        onApplySceneUpdate={handleApplySceneUpdate}
      />
    </div>
  );
};

export default App;
