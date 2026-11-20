import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  CameraView,
  EnvironmentSettings,
  SceneItem,
  ShadingMode,
  TransformData,
  TransformMode,
  ViewportStats,
} from '../types';
import { applyModifiers, calculateGeometryStats, createPrimitiveGeometry } from './geometry';
import { createMaterial, updateMaterial } from './material';

export interface EngineCallbacks {
  onSelectObject: (id: string | null) => void;
  onObjectTransformed: (id: string, transform: TransformData) => void;
  onTransformCommit: (id: string, transform: TransformData) => void;
  onStatsUpdate: (stats: ViewportStats) => void;
}

export class Engine {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public camera: THREE.PerspectiveCamera;
  public orbitControls: OrbitControls;
  public transformControls: TransformControls;

  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private animationFrameId: number | null = null;
  private isDestroyed = false;

  // Environment objects
  private gridHelper: THREE.GridHelper;
  private axesHelper: THREE.AxesHelper;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private studioRimLight: THREE.DirectionalLight;

  // Object tracking
  private objectMap = new Map<string, THREE.Mesh>();
  private selectedId: string | null = null;
  private shadingMode: ShadingMode = 'rendered';

  // Stats calculation
  private lastTime = performance.now();
  private frameCount = 0;
  private currentFps = 60;

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1117');

    // 2. Camera
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(4, 3, 5);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.target.set(0, 0, 0);

    // 5. Transform Controls
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.size = 0.85;
    this.scene.add(this.transformControls.getHelper());

    // Prevent orbit while dragging gizmo
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (this.selectedId && this.transformControls.object) {
        const obj = this.transformControls.object;
        const transform: TransformData = {
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        };
        this.callbacks.onObjectTransformed(this.selectedId, transform);
      }
    });

    // Final commit on mouse up / dragging end
    this.transformControls.addEventListener('mouseUp', () => {
      if (this.selectedId && this.transformControls.object) {
        const obj = this.transformControls.object;
        const transform: TransformData = {
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        };
        this.callbacks.onTransformCommit(this.selectedId, transform);
      }
    });

    // 6. Helpers
    this.gridHelper = new THREE.GridHelper(20, 20, 0x388bfd, 0x30363d);
    (this.gridHelper.material as THREE.Material).transparent = true;
    (this.gridHelper.material as THREE.Material).opacity = 0.6;
    this.gridHelper.position.y = -0.001;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(3);
    (this.axesHelper.material as THREE.Material).depthTest = false;
    this.axesHelper.renderOrder = 999;
    this.scene.add(this.axesHelper);

    // 7. Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x161b22, 0.6);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
    this.dirLight.position.set(5, 10, 7);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 25;
    this.dirLight.shadow.camera.left = -6;
    this.dirLight.shadow.camera.right = 6;
    this.dirLight.shadow.camera.top = 6;
    this.dirLight.shadow.camera.bottom = -6;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.studioRimLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    this.studioRimLight.position.set(-6, 5, -5);
    this.scene.add(this.studioRimLight);

    // 8. Event listeners
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('resize', this.onWindowResize);

    // 9. Start render loop
    this.animate();
  }

  private onPointerDown = (event: PointerEvent) => {
    // Only handle primary left clicks and ignore if interacting with transform gizmo
    if (event.button !== 0 || this.transformControls.dragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.objectMap.values()).filter((m) => m.visible);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      let foundId: string | null = null;
      for (const [id, mesh] of this.objectMap.entries()) {
        if (mesh === hit) {
          foundId = id;
          break;
        }
      }
      this.callbacks.onSelectObject(foundId);
    } else {
      // Clicked on empty space: deselect
      this.callbacks.onSelectObject(null);
    }
  };

  private onWindowResize = () => {
    if (!this.container || this.isDestroyed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public setTransformMode(mode: TransformMode) {
    if (mode === 'select') {
      this.transformControls.detach();
    } else {
      this.transformControls.setMode(mode);
      if (this.selectedId && this.objectMap.has(this.selectedId)) {
        this.transformControls.attach(this.objectMap.get(this.selectedId)!);
      }
    }
  }

  public setShadingMode(mode: ShadingMode) {
    this.shadingMode = mode;
  }

  public setCameraView(view: CameraView) {
    const target = this.orbitControls.target;
    const dist = 7;

    switch (view) {
      case 'front':
        this.camera.position.set(target.x, target.y, target.z + dist);
        break;
      case 'top':
        this.camera.position.set(target.x, target.y + dist, target.z + 0.001);
        break;
      case 'right':
        this.camera.position.set(target.x + dist, target.y, target.z);
        break;
      case 'isometric':
        this.camera.position.set(target.x + dist * 0.7, target.y + dist * 0.7, target.z + dist * 0.7);
        break;
      case 'perspective':
        this.camera.position.set(4, 3, 5);
        break;
    }

    this.camera.lookAt(target);
    this.orbitControls.update();
  }

  public setSelectedObject(id: string | null) {
    this.selectedId = id;
    if (id && this.objectMap.has(id)) {
      const mesh = this.objectMap.get(id)!;
      this.transformControls.attach(mesh);
    } else {
      this.transformControls.detach();
    }
  }

  public updateEnvironment(settings: EnvironmentSettings) {
    this.scene.background = new THREE.Color(settings.backgroundColor);
    this.hemiLight.intensity = settings.ambientIntensity;
    this.dirLight.intensity = settings.directionalIntensity;
    this.dirLight.castShadow = settings.shadows;
    this.gridHelper.visible = settings.showGrid;
    this.axesHelper.visible = settings.showAxes;

    // Presets adjustment
    switch (settings.preset) {
      case 'sunset':
        this.dirLight.color.set('#ff7a3d');
        this.hemiLight.color.set('#ffcba4');
        this.studioRimLight.color.set('#a855f7');
        break;
      case 'cyberpunk':
        this.dirLight.color.set('#06b6d4');
        this.hemiLight.color.set('#ec4899');
        this.studioRimLight.color.set('#8b5cf6');
        break;
      case 'dawn':
        this.dirLight.color.set('#fed7aa');
        this.hemiLight.color.set('#bae6fd');
        this.studioRimLight.color.set('#f43f5e');
        break;
      case 'studio':
      default:
        this.dirLight.color.set('#fff5ea');
        this.hemiLight.color.set('#ffffff');
        this.studioRimLight.color.set('#60a5fa');
        break;
    }
  }

  public syncSceneItems(items: SceneItem[]) {
    const incomingIds = new Set(items.map((it) => it.id));

    // Remove deleted objects
    for (const [id, mesh] of this.objectMap.entries()) {
      if (!incomingIds.has(id)) {
        if (this.selectedId === id) {
          this.transformControls.detach();
        }
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
        this.objectMap.delete(id);
      }
    }

    // Add or update items
    for (const item of items) {
      let mesh = this.objectMap.get(item.id);

      if (!mesh) {
        // Create new mesh
        const baseGeo = createPrimitiveGeometry(item.primitiveType || 'box', item.geometryParams);
        const geoWithMods = applyModifiers(baseGeo, item.modifiers);
        const mat = createMaterial(item.material, this.shadingMode);

        mesh = new THREE.Mesh(geoWithMods, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.objectMap.set(item.id, mesh);
      } else {
        // Update existing mesh transform
        updateMaterial(mesh.material as THREE.Material, item.material, this.shadingMode);
      }

      mesh.position.set(item.transform.position[0], item.transform.position[1], item.transform.position[2]);
      mesh.rotation.set(item.transform.rotation[0], item.transform.rotation[1], item.transform.rotation[2]);
      mesh.scale.set(item.transform.scale[0], item.transform.scale[1], item.transform.scale[2]);
      mesh.visible = item.visible;
    }

    // Update active transform controls attachment
    if (this.selectedId && this.objectMap.has(this.selectedId)) {
      const selectedMesh = this.objectMap.get(this.selectedId)!;
      if (this.transformControls.object !== selectedMesh) {
        this.transformControls.attach(selectedMesh);
      }
    }
  }

  /**
   * Rebuilds geometry with modifiers for an object when modified in UI.
   */
  public rebuildObjectGeometry(item: SceneItem) {
    const mesh = this.objectMap.get(item.id);
    if (!mesh) return;

    mesh.geometry.dispose();
    const baseGeo = createPrimitiveGeometry(item.primitiveType || 'box', item.geometryParams);
    mesh.geometry = applyModifiers(baseGeo, item.modifiers);
  }

  public getMeshById(id: string): THREE.Mesh | undefined {
    return this.objectMap.get(id);
  }

  private animate = () => {
    if (this.isDestroyed) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    // Update orbit controls damping
    this.orbitControls.update();

    // Render frame
    this.renderer.render(this.scene, this.camera);

    // Compute stats
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;

      let totalVerts = 0;
      let totalTris = 0;
      for (const mesh of this.objectMap.values()) {
        const stats = calculateGeometryStats(mesh.geometry);
        totalVerts += stats.vertices;
        totalTris += stats.triangles;
      }

      this.callbacks.onStatsUpdate({
        fps: this.currentFps,
        vertices: totalVerts,
        triangles: totalTris,
        objectsCount: this.objectMap.size,
      });
    }
  };

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);

    this.transformControls.dispose();
    this.orbitControls.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
