# PolyForge Studio 🎨✨

> **Next-Generation Web-Based 3D Modeling, Rigging, & Keyframe Animation Suite**

PolyForge Studio is an open-source, zero-latency 3D modeling and animation platform built for modern creators. It runs entirely in your browser powered by WebGL/Three.js with hardware-accelerated PBR shading, real-time procedural modifiers, Blender-compatible hotkeys, and multi-format 3D export pipelines (GLTF/GLB, OBJ, STL).

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)]()
[![Three.js](https://img.shields.io/badge/Three.js-r170-black.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Key Capabilities

### 1. 📐 Procedural 3D Modeling & Primitives
- **Mesh Primitives**: Box, Sphere, Cylinder, Cone, Torus, Plane, Dodecahedron, and Capsule with parametric tessellation.
- **Procedural Modifiers**:
  - `Noise Sculpting`: 3D procedural noise displacement along vertex normals for organic and terrain modeling.
  - `Axial Twist`: Continuous angular twist deformation around the vertical axis.
  - `Face Subdivision`: Midpoint triangle refinement to increase polygonal density and geometric fidelity.
  - `Normal Smoothing`: Smooth normal recalculation.

### 2. 🎬 Keyframe Animation & Timeline Engine
- **Non-Linear Scrubber**: Full timeline scrubber with custom frame count (e.g. 60–1200 frames) and configurable framerates (24, 30, 60 FPS).
- **Interpolation Curves**:
  - Linear interpolation (`lerp`)
  - Smoothstep cubic ease-in-out (`smoothstep`)
  - Hold / Step interpolation (`step`)
  - Quaternion spherical slerp (`slerp`) for rotation without gimbal lock.
- **Auto-Keying**: Automatically captures keyframes on the timeline when manipulating objects.
- **360° Turntable Generator**: One-click procedural turntable rotation sequence generator.

### 3. 💎 Physically Based Rendering (PBR) & Shading
- **Material Inspector**: Real-time control of Base Color, Metalness, Roughness, Transmission (Glass / Refraction), and Emissive Glow.
- **Procedural Patterns**: Real-time canvas-generated UV calibration grids, checkerboards, and stripe maps without external asset loading.
- **Shading Modes**:
  - `Rendered`: Full PBR with soft shadow mapping and ACES Filmic tone mapping.
  - `Solid`: Clean studio matcap lighting.
  - `Wireframe`: Edge topology wireframe inspection.
  - `Normals`: Vertex normal direction visualization.

### 4. 📦 Universal 3D Export & Import
- **Binary GLB / GLTF**: Universal 3D format for web, three.js, Unity, Unreal Engine, and Blender.
- **Wavefront OBJ**: Industry-standard geometry format.
- **Stereolithography STL**: Ready for 3D printing slicing.
- **PolyForge Scene JSON**: Full scene hierarchy, material properties, and animation track persistence.
- **High-Res Snapshot**: Instant viewport image capture at native resolution.

### 5. ⌨️ Blender-Compatible Keybindings
| Shortcut | Action |
| :--- | :--- |
| `G` | Grab / Translate mode |
| `R` | Rotate mode |
| `S` | Scale mode |
| `Q` | Select mode |
| `Shift + D` | Duplicate selected object |
| `Del` / `X` | Delete selected object |
| `Space` | Play / Pause Animation |
| `←` / `→` | Step back / forward 1 frame |
| `Shift + ←` / `→` | Jump to start / end frame |
| `Num 1` / `3` / `7` | Front / Right / Top orthographic views |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo |
| `Ctrl + S` | Save Project JSON |

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or pnpm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/SPY-Github22/polyforge.git
cd polyforge

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Running Tests
PolyForge Studio comes with a comprehensive unit test suite covering geometry algorithms, modifier math, keyframe interpolation, and project serialization:
```bash
npm test
```

### Production Build
```bash
npm run build
```
Production artifacts are emitted to the `dist/` directory.

---

## 🏛️ Architecture & Project Structure

```
polyforge/
├── src/
│   ├── types/
│   │   └── index.ts          # Strongly typed scene, transform, material, and keyframe interfaces
│   ├── core/
│   │   ├── engine.ts         # Three.js WebGLRenderer, OrbitControls, TransformControls, Lights
│   │   ├── geometry.ts       # Primitive generators & procedural modifiers (Noise, Twist, Subdivide)
│   │   ├── material.ts       # PBR shaders and procedural canvas texture generators
│   │   ├── animation.ts      # Quaternion slerp, smoothstep easing, and turntable automation
│   │   ├── io.ts             # GLTF/GLB, OBJ, STL, and Scene JSON exporters
│   │   └── history.ts        # Undo/Redo command manager with stack bounds
│   ├── components/
│   │   ├── TopNavbar.tsx     # Menus (File, Edit, Add), Shading modes, camera switchers
│   │   ├── LeftToolbar.tsx   # Transform tools (G/R/S), quick primitive spawner, sculpting tools
│   │   ├── RightInspector.tsx# Transform inputs, Material PBR, Modifiers, Scene Outliner, Environment
│   │   ├── Timeline.tsx      # Animation scrubber, playhead, diamond keyframe markers
│   │   ├── Viewport.tsx      # 3D canvas viewport, orientation compass, real-time FPS/tri counter
│   │   └── KeyboardShortcutsModal.tsx # Blender shortcut guide
│   ├── App.tsx               # Root application coordinator and keyboard events
│   └── main.tsx              # Application mount point
├── tests/
│   ├── geometry.test.ts      # Primitive creation and modifier verification
│   ├── animation.test.ts     # Keyframe interpolation and turntable testing
│   ├── io.test.ts            # Project serialization & error handling
│   └── history.test.ts       # Undo/Redo stack verification
└── vite.config.ts
```

---

## 🛡️ Privacy & Security Standard
PolyForge runs 100% client-side in the browser. No geometry, scenes, user identity, or telemetry data is collected or transmitted to external servers.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
