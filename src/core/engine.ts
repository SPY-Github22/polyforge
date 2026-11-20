import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  CameraView,
  EnvironmentSettings,
  MaterialProperties,
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
  private ambientBounceLight: THREE.DirectionalLight;

  // Dedicated container for user meshes (isolates 3D models from helpers for clean export)
  public userMeshGroup: THREE.Group;

  // Object tracking
  private objectMap = new Map<string, THREE.Mesh>();
  private selectedId: string | null = null;
  private shadingMode: ShadingMode = 'rendered';
  private currentTransformMode: TransformMode = 'translate';

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
    this.userMeshGroup = new THREE.Group();
    this.scene.add(this.userMeshGroup);

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
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.75);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5ea, 1.25);
    this.dirLight.position.set(5, 12, 7);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 30;
    this.dirLight.shadow.camera.left = -8;
    this.dirLight.shadow.camera.right = 8;
    this.dirLight.shadow.camera.top = 8;
    this.dirLight.shadow.camera.bottom = -8;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.studioRimLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
    this.studioRimLight.position.set(-6, 5, -5);
    this.scene.add(this.studioRimLight);

    // Soft ambient bounce / fill light pointing upward from below
    // Natural upward ground bounce so undersides of canopies have soft, natural illumination instead of pitch black
    this.ambientBounceLight = new THREE.DirectionalLight(0xcfd8dc, 0.55);
    this.ambientBounceLight.position.set(0, -10, 0);
    this.ambientBounceLight.target.position.set(0, 5, 0);
    this.scene.add(this.ambientBounceLight);
    this.scene.add(this.ambientBounceLight.target);

    // 8. Event listeners
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('resize', this.onWindowResize);

    // 9. Start render loop
    this.animate();
  }

  private onPointerDown = (event: PointerEvent) => {
    // Only handle primary left clicks and ignore if interacting with transform gizmo
    if (
      event.button !== 0 ||
      this.transformControls.dragging ||
      (this.transformControls as any).axis !== null
    ) {
      return;
    }

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

  public setCallbacks(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  public getUserMeshGroup(): THREE.Group {
    return this.userMeshGroup;
  }

  public setTransformMode(mode: TransformMode) {
    this.currentTransformMode = mode;
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
    // Immediately adapt materials of all active meshes to new shading mode
    for (const [, mesh] of this.objectMap.entries()) {
      const matProps = mesh.userData.materialProps as MaterialProperties | undefined;
      if (matProps) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
        mesh.material = createMaterial(matProps, mode);
        mesh.userData.shadingMode = mode;
      }
    }
  }

  public setCameraView(view: CameraView) {
    const target = this.orbitControls.target;
    const box = new THREE.Box3().setFromObject(this.userMeshGroup);
    if (!box.isEmpty() && target.lengthSq() < 0.001) {
      box.getCenter(target);
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim > 1 ? Math.max(7, maxDim * 1.35) : 7;

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
        this.camera.position.set(target.x + dist * 0.65, target.y + dist * 0.4, target.z + dist * 0.85);
        break;
    }

    this.camera.lookAt(target);
    this.orbitControls.update();
  }

  /**
   * Centers orbit controls on the bounding box center of the target object,
   * or the bounding box center of all meshes in the scene if id is omitted/null.
   */
  public focusObject(id: string | null = null) {
    const box = new THREE.Box3();

    if (id && this.objectMap.has(id)) {
      const mesh = this.objectMap.get(id)!;
      mesh.updateMatrixWorld(true);
      box.setFromObject(mesh);
    } else if (this.userMeshGroup.children.length > 0) {
      this.userMeshGroup.updateMatrixWorld(true);
      box.setFromObject(this.userMeshGroup);
    }

    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      this.orbitControls.target.copy(center);

      // Frame camera comfortably to view the entire object / model
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 1.5) {
        const dir = new THREE.Vector3().subVectors(this.camera.position, center).normalize();
        if (dir.lengthSq() < 0.001) dir.set(0.65, 0.45, 0.85).normalize();
        // Ensure camera has an elevated vantage angle looking down into the canopy,
        // rather than pointing up into unlit branch undersides from the ground
        if (dir.y < 0.28) {
          dir.y = 0.35;
          dir.normalize();
        }
        const dist = Math.max(8, maxDim * 1.35);
        this.camera.position.copy(center).addScaledVector(dir, dist);
      }
      this.orbitControls.update();
    } else if (id && this.objectMap.has(id)) {
      const mesh = this.objectMap.get(id)!;
      this.orbitControls.target.copy(mesh.position);
      this.orbitControls.update();
    }
  }

  public setSelectedObject(id: string | null) {
    this.selectedId = id;
    if (id && this.objectMap.has(id)) {
      const mesh = this.objectMap.get(id)!;
      if (this.currentTransformMode !== 'select') {
        this.transformControls.attach(mesh);
      } else {
        this.transformControls.detach();
      }
    } else {
      this.transformControls.detach();
    }
  }

  public updateEnvironment(settings: EnvironmentSettings) {
    this.scene.background = new THREE.Color(settings.backgroundColor);
    this.hemiLight.intensity = settings.ambientIntensity;
    if (this.ambientBounceLight) {
      this.ambientBounceLight.intensity = settings.ambientIntensity * 0.75;
    }
    this.dirLight.intensity = settings.directionalIntensity;
    this.dirLight.castShadow = settings.shadows;
    this.gridHelper.visible = settings.showGrid;
    this.axesHelper.visible = settings.showAxes;

    // Presets adjustment
    switch (settings.preset) {
      case 'sunset':
        this.dirLight.color.set('#ff7a3d');
        this.hemiLight.color.set('#ffcba4');
        this.hemiLight.groundColor.set('#643b1f');
        this.studioRimLight.color.set('#a855f7');
        if (this.ambientBounceLight) this.ambientBounceLight.color.set('#ffb288');
        break;
      case 'cyberpunk':
        this.dirLight.color.set('#06b6d4');
        this.hemiLight.color.set('#ec4899');
        this.hemiLight.groundColor.set('#3b0764');
        this.studioRimLight.color.set('#8b5cf6');
        if (this.ambientBounceLight) this.ambientBounceLight.color.set('#818cf8');
        break;
      case 'dawn':
        this.dirLight.color.set('#fed7aa');
        this.hemiLight.color.set('#bae6fd');
        this.hemiLight.groundColor.set('#334155');
        this.studioRimLight.color.set('#f43f5e');
        if (this.ambientBounceLight) this.ambientBounceLight.color.set('#fed7aa');
        break;
      case 'studio':
      default:
        this.dirLight.color.set('#fff5ea');
        this.hemiLight.color.set('#ffffff');
        this.hemiLight.groundColor.set('#475569');
        this.studioRimLight.color.set('#60a5fa');
        if (this.ambientBounceLight) this.ambientBounceLight.color.set('#cbd5e1');
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
        this.userMeshGroup.remove(mesh);
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
        mesh.userData.materialProps = { ...item.material };
        mesh.userData.shadingMode = this.shadingMode;
        this.userMeshGroup.add(mesh);
        this.objectMap.set(item.id, mesh);
      } else {
        // Recreate material if shading mode changed, or update properties in-place
        if (mesh.userData.shadingMode !== this.shadingMode) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
          mesh.material = createMaterial(item.material, this.shadingMode);
          mesh.userData.shadingMode = this.shadingMode;
        } else {
          updateMaterial(mesh.material as THREE.Material, item.material, this.shadingMode);
        }
        mesh.userData.materialProps = { ...item.material };
      }

      mesh.position.set(item.transform.position[0], item.transform.position[1], item.transform.position[2]);
      mesh.rotation.set(item.transform.rotation[0], item.transform.rotation[1], item.transform.rotation[2]);
      mesh.scale.set(item.transform.scale[0], item.transform.scale[1], item.transform.scale[2]);
      mesh.visible = item.visible;
    }

    // Update active transform controls attachment
    if (this.selectedId && this.objectMap.has(this.selectedId)) {
      const selectedMesh = this.objectMap.get(this.selectedId)!;
      if (this.currentTransformMode !== 'select') {
        if (this.transformControls.object !== selectedMesh) {
          this.transformControls.attach(selectedMesh);
        }
      } else {
        this.transformControls.detach();
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

  /**
   * Captures a clean viewport render snapshot without editing gizmos or grid lines.
   */
  public captureSnapshot(filename: string = 'polyforge-render.png') {
    const gridVis = this.gridHelper.visible;
    const axesVis = this.axesHelper.visible;
    const gizmoVis = this.transformControls.getHelper().visible;

    this.gridHelper.visible = false;
    this.axesHelper.visible = false;
    this.transformControls.getHelper().visible = false;

    this.renderer.render(this.scene, this.camera);
    const dataURL = this.renderer.domElement.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = dataURL;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    this.gridHelper.visible = gridVis;
    this.axesHelper.visible = axesVis;
    this.transformControls.getHelper().visible = gizmoVis;
    this.renderer.render(this.scene, this.camera);
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

    this.scene.remove(this.ambientBounceLight.target);
    this.scene.remove(this.ambientBounceLight);
    this.ambientBounceLight.dispose();

    this.transformControls.dispose();
    this.orbitControls.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
