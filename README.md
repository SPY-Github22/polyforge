# PolyForge Studio 🎨✨

> **Next-Generation Web-Based 3D Modeling, Rigging, Keyframe Animation & AI Generative Copilot Suite**

PolyForge Studio is an open-source, zero-latency 3D modeling and animation platform built for modern creators and AI agents. It runs entirely in your browser powered by WebGL/Three.js with hardware-accelerated PBR shading, real-time procedural modifiers, Blender-compatible hotkeys, multi-format 3D export pipelines (GLTF/GLB, OBJ, STL), and deep **AI Agent & LLM Integration** for automated 3D architecture, procedural synthesis, and programmatic keyframing.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)]()
[![Three.js](https://img.shields.io/badge/Three.js-r170-black.svg)]()
[![AI Integration](https://img.shields.io/badge/AI_Copilot-Enabled-purple.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🤖 AI Integration & Generative Copilot

PolyForge Studio was built from the ground up to give Large Language Models (LLMs) and autonomous agents first-class programmatic and interactive access to 3D modeling, procedural architecture, and kinematic animation.

### 1. 🧠 Interactive AI Studio Drawer (`Ctrl + Shift + A`)
- **Prompt-to-3D Synthesizer**: Type natural language prompts like *"A cyberpunk neon citadel with floating counter-rotating rings"* or *"A solar system with Keplerian orbits"* to instantly architect 3D models and synchronized keyframe animations.
- **Built-in Procedural AI Engine (Offline / Zero Setup)**: Runs rich mathematical procedural generators locally in the browser with zero API keys required.
- **Code Studio & Script Editor**: Live JavaScript code editor with immediate execution in the 3D viewport, sample script library, and execution console.
- **Agent / LLM Bridge**: One-click extraction of the full 3D scene graph and TypeScript API schema for external LLMs (Claude, ChatGPT, Gemini, Antigravity CLI) with instant script paste-and-run execution.
- **Multi-Provider Support**: Connect custom API keys for OpenAI (GPT-4o), Anthropic Claude (3.5 Sonnet), local Ollama instances, or custom endpoints.

### 2. ⚡ Programmatic Scripting API (`polyforge.*`)
LLMs and developers have access to a clean, strongly-typed JavaScript runtime API:
```javascript
// Clear scene and configure cyberpunk environment
polyforge.clearScene();
polyforge.setEnvironment({ preset: 'cyberpunk', backgroundColor: '#05070d' });
polyforge.setTimeline({ totalFrames: 120, fps: 30 });

// Construct central glowing reactor
const core = polyforge.createObject({
  name: 'Quantum Reactor',
  primitive: 'sphere',
  position: [0, 2.5, 0],
  scale: [1, 1, 1],
  material: { color: '#06b6d4', emissive: '#06b6d4', emissiveIntensity: 2.5 }
});

// Create counter-rotating magnetic levitation ring
const ring = polyforge.createObject({
  name: 'Levitation Ring',
  primitive: 'torus',
  position: [0, 2.5, 0],
  material: { color: '#ec4899', emissive: '#db2777', emissiveIntensity: 1.0, metalness: 0.9 },
  geometryParams: { radius: 2.0, tube: 0.08 }
});

// Program keyframed continuous rotation
polyforge.addKeyframe(ring.id, 0, { rotation: [Math.PI / 2, 0, 0] }, 'linear');
polyforge.addKeyframe(ring.id, 120, { rotation: [Math.PI / 2, Math.PI * 2, 0] }, 'linear');
```

### 3. 🔌 Model Context Protocol (MCP) Server for LLM Agents
PolyForge provides a standard **Model Context Protocol (MCP)** server over stdio, enabling AI assistants (Claude Desktop, Cursor, Antigravity, Cline, Windsurf) to natively create, modify, inspect, and animate 3D scenes:

```json
// Add to your Claude Desktop / Cursor / Agent MCP configuration:
{
  "mcpServers": {
    "polyforge": {
      "command": "npx",
      "args": ["tsx", "/path/to/polyforge/cli/polyforge-mcp.ts"]
    }
  }
}
```

Available MCP Tools for LLMs:
- `polyforge_list_templates`: Enumerate all built-in procedural generators.
- `polyforge_generate_template`: Synthesize a complete 3D scene from a template.
- `polyforge_create_object`: Programmatically create primitives with custom PBR materials and modifiers.
- `polyforge_update_object`: Modify existing objects (position, rotation, scale, material).
- `polyforge_delete_object`: Remove objects and associated animation tracks.
- `polyforge_add_keyframe`: Add precise animation keyframes with linear or ease-in-out curves.
- `polyforge_execute_script`: Execute arbitrary JavaScript 3D procedural scripts.
- `polyforge_export_scene`: Export scene to Wavefront OBJ, STL, or PolyForge JSON.
- `polyforge_get_scene`: Inspect token-efficient scene topology and tracks.
- `polyforge_clear_scene`: Reset the scene.
- `polyforge_get_api_docs`: Retrieve complete scripting API documentation.

### 4. 🖥️ Headless Terminal CLI for Autonomous Agents
Terminal agents and CI/CD pipelines can generate, script, export, and inspect 3D scenes without opening a browser:
```bash
# List all built-in procedural templates
npm run polyforge -- list-templates

# Generate a 3D model from a template
npm run polyforge -- generate --template kinetic-mech --out ./mech.json

# Synthesize a model directly from a natural language prompt
npm run polyforge -- prompt "solar system orrery with planets" --out ./system.json

# Execute a custom JavaScript script in headless sandbox (or modify an existing scene)
npm run polyforge -- run-script ./my-script.js --scene ./base.json --out ./output.json

# Export a scene to Wavefront OBJ or STL for 3D printing and game engines
npm run polyforge -- export ./mech.json --format obj --out ./mech.obj
npm run polyforge -- export ./mech.json --format stl --out ./mech.stl

# Inspect an existing scene's objects, materials, and animation tracks
npm run polyforge -- inspect ./system.json

# Launch the Model Context Protocol stdio server
npm run polyforge-mcp
```

### 5. 🏛️ Flagship Deeply Architected Procedural Templates
| Template ID | Name | Category | Description |
| :--- | :--- | :--- | :--- |
| `sci-fi-citadel` | Cyberpunk Citadel | Sci-Fi | Soaring spire, counter-rotating levitation rings, quantum core, and pulsing beacon |
| `solar-orrery` | Solar System Orrery | Astronomy | Radiant rotating Sun, 4 orbiting terrestrial planets, and Saturn ring system |
| `castle-fortress` | Medieval Castle Fortress | Architecture | 4 conical watchtowers, crenellated curtain walls, gatehouse portal, and central keep |
| `kinetic-mech` | Articulated Kinetic Mech | Robotics | Armored chassis, glowing visor, and synchronized walking gait cycle keyframes |
| `dna-helix` | Double-Helix DNA | Kinetics | 24 paired nucleotide rungs twisting along a parametric helix with continuous rotation |
| `procedural-biome`| Low-Poly Pine Forest | Nature | Undulating terrain grid, stylized multi-tiered pine trees with wind sway, and monoliths |
| `spiral-pavilion` | Parametric Spiral Pavilion | Architecture | Helical marble staircase, golden cupola dome, and ascending kinetic platform |

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
├── cli/
│   └── polyforge-agent.ts    # Headless CLI for terminal agents, scripting & model synthesis
├── src/
│   ├── types/
│   │   └── index.ts          # Strongly typed scene, transform, material, and keyframe interfaces
│   ├── core/
│   │   ├── engine.ts         # Three.js WebGLRenderer, OrbitControls, TransformControls, Lights
│   │   ├── geometry.ts       # Primitive generators & procedural modifiers (Noise, Twist, Subdivide)
│   │   ├── material.ts       # PBR shaders and procedural canvas texture generators
│   │   ├── animation.ts      # Quaternion slerp, smoothstep easing, and turntable automation
│   │   ├── io.ts             # GLTF/GLB, OBJ, STL, and Scene JSON exporters
│   │   ├── history.ts        # Undo/Redo command manager with stack bounds
│   │   └── ai/
│   │       ├── types.ts      # AI API interfaces, script context, and template schemas
│   │       ├── api.ts        # Script execution runtime (`polyforge.*`) & sandbox
│   │       ├── procedural.ts # Flagship procedural model & kinematic animation synthesizers
│   │       ├── llm.ts        # Scene graph serialization, prompt compiler, and provider clients
│   │       └── sampleScripts.ts # Library of educational and generative 3D scripts
│   ├── components/
│   │   ├── TopNavbar.tsx     # Menus (File, Edit, Add, AI), Shading modes, camera switchers
│   │   ├── LeftToolbar.tsx   # Transform tools (G/R/S), quick primitive spawner, sculpting tools
│   │   ├── RightInspector.tsx# Transform inputs, Material PBR, Modifiers, Scene Outliner, Environment
│   │   ├── Timeline.tsx      # Animation scrubber, playhead, diamond keyframe markers
│   │   ├── Viewport.tsx      # 3D canvas viewport, orientation compass, real-time FPS/tri counter
│   │   ├── AIAssistantDrawer.tsx # AI Prompt-to-3D, Code Studio, and LLM bridge drawer
│   │   └── KeyboardShortcutsModal.tsx # Blender shortcut guide
│   ├── App.tsx               # Root application coordinator and keyboard events
│   └── main.tsx              # Application mount point
├── tests/
│   ├── geometry.test.ts      # Primitive creation and modifier verification
│   ├── animation.test.ts     # Keyframe interpolation and turntable testing
│   ├── io.test.ts            # Project serialization & error handling
│   ├── history.test.ts       # Undo/Redo stack verification
│   ├── ai-scripting.test.ts  # Scripting API execution & error handling tests
│   ├── ai-procedural.test.ts # Mathematical validity tests for all procedural generators
│   └── ai-llm.test.ts        # Scene serialization & LLM prompt format tests
└── vite.config.ts
```

---

## 🛡️ Privacy & Security Standard
PolyForge runs 100% client-side in the browser. No geometry, scenes, user identity, or telemetry data is collected or transmitted to external servers.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
