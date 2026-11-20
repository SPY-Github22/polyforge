import {
  AnimationTrack,
  EnvironmentSettings,
  SceneItem,
  TimelineState,
} from '../../types';
import { AIConfig, LLMSceneSummary } from './types';
import { matchProceduralTemplate } from './procedural';

/**
 * Creates a token-efficient summary of the current 3D scene for LLM context.
 */
export function serializeSceneForLLM(
  items: SceneItem[],
  tracks: AnimationTrack[],
  environment: EnvironmentSettings,
  timeline: TimelineState
): LLMSceneSummary {
  const objects = items.map((it) => {
    const track = tracks.find((t) => t.objectId === it.id);
    return {
      id: it.id,
      name: it.name,
      primitive: it.primitiveType || 'custom',
      position: it.transform.position,
      rotation: it.transform.rotation,
      scale: it.transform.scale,
      color: it.material.color,
      metalness: it.material.metalness,
      roughness: it.material.roughness,
      keyframeCount: track ? track.keyframes.length : 0,
    };
  });

  return {
    objectCount: items.length,
    objects,
    timeline: {
      currentFrame: timeline.currentFrame,
      totalFrames: timeline.totalFrames,
      fps: timeline.fps,
    },
    environment: {
      preset: environment.preset,
      backgroundColor: environment.backgroundColor,
    },
  };
}

/**
 * Formats the complete system prompt instructing an LLM on how to author 3D scenes in PolyForge.
 */
export function getSystemPromptForLLM(): string {
  return `You are PolyForge AI, an expert 3D generative architect, procedural artist, and keyframe animator.
You produce clean, valid JavaScript code using the global \`polyforge\` API to construct 3D scenes, mathematical shapes, and precise animations.

### PolyForge API Reference:
- \`polyforge.createObject({ id, name, primitive, position: [x,y,z], rotation: [rx,ry,rz], scale: [sx,sy,sz], material: { color, roughness, metalness, emissive, emissiveIntensity, transmission, opacity, transparent, wireframe }, modifiers: [{ type: 'subdivide' | 'noise_displace' | 'twist' | 'smooth', factor }], geometryParams: { width, height, depth, radius, tube, radialSegments, tubularSegments } })\`
  - Valid primitives: 'box', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'dodecahedron', 'capsule'.
- \`polyforge.addModifier(idOrName, { type: 'subdivide' | 'noise_displace' | 'twist' | 'smooth', factor })\`
- \`polyforge.updateObject(idOrName, { position, rotation, scale, material, visible, locked })\`
- \`polyforge.deleteObject(idOrName)\`
- \`polyforge.getObject(idOrName)\`
- \`polyforge.getAllObjects()\`
- \`polyforge.clearScene()\`
- \`polyforge.addKeyframe(idOrName, frameNumber, { position, rotation, scale }, interpolation = 'ease-in-out' | 'linear' | 'step')\`
- \`polyforge.setAnimationTrack(idOrName, keyframes)\`
- \`polyforge.getAnimationTrack(idOrName)\`
- \`polyforge.clearAnimation(idOrName)\`
- \`polyforge.setEnvironment({ preset: 'studio' | 'sunset' | 'cyberpunk' | 'dawn', backgroundColor, ambientIntensity, directionalIntensity, showGrid, showAxes })\`
- \`polyforge.setTimeline({ totalFrames: 120, fps: 30 })\`
- \`polyforge.listTemplates()\`
- \`polyforge.generateTemplate(templateId, { clearScene: true })\`
  - Built-in templates: 'sci-fi-citadel', 'solar-orrery', 'castle-fortress', 'kinetic-mech', 'dna-helix', 'procedural-biome', 'spiral-pavilion'.
- \`polyforge.log(message)\`

### Guidelines:
1. Always write executable JavaScript code inside \`\`\`javascript ... \`\`\` markdown blocks.
2. Use mathematical loops, trigonometric functions (Math.sin, Math.cos, Math.PI), and precise spacing to architect intricate 3D assemblies.
3. For animations, create keyframes across the timeline (e.g. frames 0, 30, 60, 90, 120) with smooth ease-in-out or continuous linear rotations.
4. Set distinct harmonious materials (roughness, metalness, vibrant emissive accents) so the model looks visually stunning.`;
}

/**
 * Generates the full prompt including current scene summary and user instructions.
 */
export function generateFullLLMPrompt(
  userRequest: string,
  items: SceneItem[],
  tracks: AnimationTrack[],
  environment: EnvironmentSettings,
  timeline: TimelineState
): string {
  const summary = serializeSceneForLLM(items, tracks, environment, timeline);

  return `${getSystemPromptForLLM()}

### Current PolyForge Scene State:
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

### User Request:
"${userRequest}"

Please write the complete JavaScript code to fulfill this request. Output ONLY the code inside a \`\`\`javascript ... \`\`\` block.`;
}

/**
 * Robustly extracts executable JavaScript code from LLM text responses.
 */
export function extractCodeFromLLMResponse(responseText: string): string {
  // Decode common HTML entities that LLMs or web views might inject
  let cleaned = responseText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  // Check for ```javascript, ```js, ```typescript, or ```ts code blocks
  const jsMatch = cleaned.match(/```(?:javascript|js|ts|typescript)?\s*([\s\S]*?)```/i);
  if (jsMatch && jsMatch[1].trim()) {
    return jsMatch[1].trim();
  }

  // If no markdown fence, check if raw response looks like script code
  const trimmed = cleaned.trim();
  if (trimmed.includes('polyforge.') || trimmed.includes('const ') || trimmed.includes('for (')) {
    return trimmed;
  }

  return cleaned.trim();
}

/**
 * Executes or fetches 3D generation from the configured AI provider.
 * When set to 'offline', it runs our built-in procedural synthesis engine instantly.
 */
export async function callAIProvider(
  userPrompt: string,
  config: AIConfig,
  currentScene: {
    items: SceneItem[];
    tracks: AnimationTrack[];
    environment: EnvironmentSettings;
    timeline: TimelineState;
  }
): Promise<{ code: string; explanation?: string; isProceduralFallback?: boolean }> {
  // 1. OFFLINE PROCEDURAL ENGINE
  if (config.provider === 'offline' || !config.apiKey) {
    const matched = matchProceduralTemplate(userPrompt);
    const genResult = matched.generate();

    const generatedScript = `// PolyForge Procedural AI Engine: Generated from "${matched.name}"
// Description: ${matched.description}
// Category: ${matched.category} | Prompt: "${userPrompt.replace(/"/g, '\\"')}"

polyforge.clearScene();
polyforge.generateTemplate("${matched.id}");
polyforge.log("Successfully synthesized ${matched.name} with ${genResult.items.length} objects and ${genResult.tracks.length} animation tracks.");
`;

    return {
      code: generatedScript,
      explanation: `Synthesized "${matched.name}" (${matched.description}) using PolyForge Offline Generative AI.`,
      isProceduralFallback: true,
    };
  }

  const prompt = generateFullLLMPrompt(
    userPrompt,
    currentScene.items,
    currentScene.tracks,
    currentScene.environment,
    currentScene.timeline
  );

  // 2. ANTHROPIC CLAUDE API
  if (config.provider === 'anthropic') {
    const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: config.temperature,
        system: getSystemPromptForLLM(),
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.content?.[0]?.text || '';
    return {
      code: extractCodeFromLLMResponse(rawContent),
      explanation: 'Generated via Anthropic Claude.',
    };
  }

  // 3. OPENAI / OLLAMA / CUSTOM ENDPOINT
  const endpoint =
    config.endpoint ||
    (config.provider === 'ollama' ? 'http://localhost:11434/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey && config.apiKey.trim() !== '') {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model || (config.provider === 'ollama' ? 'llama3' : 'gpt-4o'),
      temperature: config.temperature,
      messages: [
        { role: 'system', content: getSystemPromptForLLM() },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '';
  return {
    code: extractCodeFromLLMResponse(rawContent),
    explanation: `Generated via ${config.provider} (${config.model || 'default'}).`,
  };
}
