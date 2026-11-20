import { describe, it, expect } from 'vitest';
import {
  serializeSceneForLLM,
  getSystemPromptForLLM,
  generateFullLLMPrompt,
  extractCodeFromLLMResponse,
  callAIProvider,
} from '../src/core/ai/llm';
import { EnvironmentSettings, SceneItem, TimelineState } from '../src/types';

describe('LLM Scene Serialization & Provider Bridge', () => {
  const dummyItem: SceneItem = {
    id: 'test-cube',
    name: 'Test Cube',
    type: 'mesh',
    primitiveType: 'box',
    transform: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: {
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
    },
    visible: true,
    locked: false,
  };

  const dummyEnv: EnvironmentSettings = {
    backgroundColor: '#0d1117',
    ambientIntensity: 0.6,
    directionalIntensity: 1.2,
    showGrid: true,
    showAxes: true,
    shadows: true,
    preset: 'studio',
  };

  const dummyTimeline: TimelineState = {
    currentFrame: 15,
    totalFrames: 120,
    fps: 30,
    isPlaying: false,
    isLooping: true,
    autoKeying: false,
  };

  it('serializes scene items into token-efficient LLM summary', () => {
    const summary = serializeSceneForLLM([dummyItem], [], dummyEnv, dummyTimeline);
    expect(summary.objectCount).toBe(1);
    expect(summary.objects[0].name).toBe('Test Cube');
    expect(summary.objects[0].position).toEqual([1, 2, 3]);
    expect(summary.timeline.currentFrame).toBe(15);
    expect(summary.environment.preset).toBe('studio');
  });

  it('includes complete system instructions and API schema in prompt', () => {
    const sysPrompt = getSystemPromptForLLM();
    expect(sysPrompt).toContain('polyforge.createObject');
    expect(sysPrompt).toContain('polyforge.addKeyframe');
    expect(sysPrompt).toContain('polyforge.setEnvironment');

    const fullPrompt = generateFullLLMPrompt(
      'Create an orbital satellite',
      [dummyItem],
      [],
      dummyEnv,
      dummyTimeline
    );
    expect(fullPrompt).toContain('Create an orbital satellite');
    expect(fullPrompt).toContain('Test Cube');
  });

  it('extracts executable code cleanly from various LLM response formats', () => {
    const markdownResponse = `
Here is the code you requested:
\`\`\`javascript
polyforge.createObject({ name: 'Satellite Dish', primitive: 'cone' });
polyforge.log('Done');
\`\`\`
Enjoy your model!
`;
    const code = extractCodeFromLLMResponse(markdownResponse);
    expect(code).toBe(`polyforge.createObject({ name: 'Satellite Dish', primitive: 'cone' });\npolyforge.log('Done');`);

    const rawResponse = `polyforge.createObject({ name: 'Raw' });`;
    expect(extractCodeFromLLMResponse(rawResponse)).toBe(rawResponse);
  });

  it('generates offline procedural code when provider is offline', async () => {
    const result = await callAIProvider(
      'Create a futuristic cyberpunk spire',
      {
        provider: 'offline',
        apiKey: '',
        model: '',
        endpoint: '',
        temperature: 0.7,
      },
      {
        items: [],
        tracks: [],
        environment: dummyEnv,
        timeline: dummyTimeline,
      }
    );

    expect(result.code).toContain('polyforge.clearScene()');
    expect(result.code).toContain('PROCEDURAL_TEMPLATES["sci-fi-citadel"]');
    expect(result.isProceduralFallback).toBe(true);
  });
});
