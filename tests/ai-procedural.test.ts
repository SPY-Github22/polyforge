import { describe, it, expect } from 'vitest';
import {
  generateSciFiCitadel,
  generateSolarOrrery,
  generateCastleFortress,
  generateKineticMech,
  generateDNAHelix,
  generateProceduralBiome,
  generateSpiralPavilion,
  matchProceduralTemplate,
  PROCEDURAL_TEMPLATES,
} from '../src/core/ai/procedural';

describe('Procedural 3D & Animation Generators', () => {
  it('generates Cyberpunk Sci-Fi Citadel with valid geometry and animation', () => {
    const res = generateSciFiCitadel();
    expect(res.items.length).toBeGreaterThan(5);
    expect(res.tracks.length).toBeGreaterThanOrEqual(3);
    expect(res.environment?.preset).toBe('cyberpunk');
    expect(res.timeline?.totalFrames).toBe(120);

    // Verify all item coordinates are valid numbers
    for (const item of res.items) {
      expect(item.transform.position.every((n) => Number.isFinite(n))).toBe(true);
      expect(item.transform.rotation.every((n) => Number.isFinite(n))).toBe(true);
      expect(item.transform.scale.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
    }
  });

  it('generates Solar System Orrery with orbiting planets', () => {
    const res = generateSolarOrrery();
    expect(res.items.length).toBeGreaterThanOrEqual(10);
    expect(res.tracks.length).toBeGreaterThanOrEqual(5);

    // Verify planet tracks have valid keyframes
    const earthTrack = res.tracks.find((t) => t.keyframes.length >= 8);
    expect(earthTrack).toBeDefined();
    expect(earthTrack!.keyframes[0].frame).toBe(0);
    expect(earthTrack!.keyframes[earthTrack!.keyframes.length - 1].frame).toBe(120);
  });

  it('generates Medieval Castle Fortress with four towers and walls', () => {
    const res = generateCastleFortress();
    expect(res.items.length).toBeGreaterThanOrEqual(10);
    const towerItems = res.items.filter((it) => it.name.includes('Tower'));
    expect(towerItems.length).toBeGreaterThanOrEqual(8); // 4 bodies + 4 roofs
  });

  it('generates Articulated Kinetic Mech with walking gait keyframes', () => {
    const res = generateKineticMech();
    expect(res.items.length).toBeGreaterThanOrEqual(10);
    expect(res.tracks.length).toBeGreaterThanOrEqual(4); // arms, legs, torso
  });

  it('generates Double Helix DNA Monument with 24 paired base nodes', () => {
    const res = generateDNAHelix();
    expect(res.items.length).toBe(24 * 3); // 24 node1 + 24 node2 + 24 rungs = 72
    expect(res.tracks.length).toBe(24 * 3);
  });

  it('generates Low-Poly Pine Forest Biome', () => {
    const res = generateProceduralBiome();
    expect(res.items.length).toBeGreaterThan(15);
    expect(res.environment?.preset).toBe('sunset');
  });

  it('generates Parametric Spiral Pavilion', () => {
    const res = generateSpiralPavilion();
    expect(res.items.length).toBeGreaterThan(20);
    expect(res.tracks.length).toBeGreaterThanOrEqual(1);
  });

  it('correctly matches natural language prompts to templates', () => {
    expect(matchProceduralTemplate('Build me a solar system with orbiting planets').id).toBe('solar-orrery');
    expect(matchProceduralTemplate('Medieval stone fortress with towers').id).toBe('castle-fortress');
    expect(matchProceduralTemplate('Walking bipedal battle robot mech').id).toBe('kinetic-mech');
    expect(matchProceduralTemplate('Double helix genetic molecule structure').id).toBe('dna-helix');
    expect(matchProceduralTemplate('Stylized pine forest landscape terrain').id).toBe('procedural-biome');
    expect(matchProceduralTemplate('Classical spiral staircase with marble columns').id).toBe('spiral-pavilion');
    expect(matchProceduralTemplate('Towering sci-fi skyscraper with glowing rings').id).toBe('sci-fi-citadel');
    expect(matchProceduralTemplate('make a model of a human with clothes and accessories').id).toBe('realistic-human');
    expect(matchProceduralTemplate('create a 3D avatar person with jacket and trousers').id).toBe('realistic-human');
    expect(matchProceduralTemplate('make a model of a female character with streetwear').id).toBe('realistic-female');
    expect(matchProceduralTemplate('generate a 3D woman avatar with jeans and sneakers').id).toBe('realistic-female');
  });

  it('generates Realistic Anatomical Human via template with white viewport background', () => {
    const tmpl = PROCEDURAL_TEMPLATES['realistic-human'];
    expect(tmpl).toBeDefined();
    expect(tmpl.category).toBe('Character');

    const result = tmpl.generate();
    expect(result.items.length).toBe(5);
    expect(result.environment?.backgroundColor).toBe('#ffffff');
    expect(result.environment?.preset).toBe('studio');
    expect(result.description).toContain('procedurally synthesized 3D human character');
  });

  it('generates Realistic Anatomical Female via template with studio environment', () => {
    const tmpl = PROCEDURAL_TEMPLATES['realistic-female'];
    expect(tmpl).toBeDefined();
    expect(tmpl.category).toBe('Character');

    const result = tmpl.generate();
    expect(result.items.length).toBe(5);
    expect(result.environment?.backgroundColor).toBe('#ffffff');
    expect(result.environment?.preset).toBe('studio');
    expect(result.description).toContain('procedurally synthesized 3D female character');
  });

  it('all registered templates can be invoked without errors', () => {
    for (const key of Object.keys(PROCEDURAL_TEMPLATES)) {
      const template = PROCEDURAL_TEMPLATES[key as keyof typeof PROCEDURAL_TEMPLATES];
      const result = template.generate();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.description).toBeTruthy();
    }
  });
});
