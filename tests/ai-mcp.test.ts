import { describe, it, expect, beforeEach } from 'vitest';
import { PolyForgeMCPServer, MCP_TOOLS } from '../cli/polyforge-mcp';

describe('PolyForge Model Context Protocol (MCP) Server', () => {
  let server: PolyForgeMCPServer;

  beforeEach(() => {
    server = new PolyForgeMCPServer();
  });

  it('handles MCP initialize handshake and returns protocol capabilities', async () => {
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result.serverInfo.name).toBe('polyforge-mcp');
    expect(res.result.serverInfo.version).toBe('1.0.0');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it('lists all 12 available PolyForge 3D modeling tools with schemas', async () => {
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(res.result.tools.length).toBe(12);
    const toolNames = res.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('polyforge_list_templates');
    expect(toolNames).toContain('polyforge_generate_template');
    expect(toolNames).toContain('polyforge_generate_bicycle');
    expect(toolNames).toContain('polyforge_execute_script');
    expect(toolNames).toContain('polyforge_create_object');
    expect(toolNames).toContain('polyforge_update_object');
    expect(toolNames).toContain('polyforge_delete_object');
    expect(toolNames).toContain('polyforge_add_keyframe');
    expect(toolNames).toContain('polyforge_get_scene');
    expect(toolNames).toContain('polyforge_clear_scene');
    expect(toolNames).toContain('polyforge_export_scene');
    expect(toolNames).toContain('polyforge_get_api_docs');
  });

  it('generates procedural template models via tool call', async () => {
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'polyforge_generate_template',
        arguments: { templateId: 'solar-orrery' },
      },
    });

    expect(res.result.isError).toBe(false);
    const parsed = JSON.parse(res.result.content[0].text);
    expect(parsed.message).toContain('Solar System Orrery');
    expect(parsed.totalObjects).toBeGreaterThan(5);
    expect(server.state.items.length).toBeGreaterThan(5);
    expect(server.state.tracks.length).toBeGreaterThan(0);
  });

  it('creates, updates, keyframes, and exports 3D models step-by-step', async () => {
    // 1. Create Cylinder
    const createRes = await server.handleRequest({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'polyforge_create_object',
        arguments: {
          name: 'Main Spire',
          primitive: 'cylinder',
          position: [0, 2, 0],
          scale: [0.5, 4, 0.5],
          material: { color: '#38bdf8', metalness: 0.8 },
        },
      },
    });
    expect(createRes.result.isError).toBe(false);
    expect(server.state.items.length).toBe(1);

    // 2. Add Keyframe
    const kfRes = await server.handleRequest({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'polyforge_add_keyframe',
        arguments: {
          idOrName: 'Main Spire',
          frame: 60,
          position: [0, 5, 0],
          rotation: [0, Math.PI, 0],
        },
      },
    });
    expect(kfRes.result.isError).toBe(false);
    expect(server.state.tracks.length).toBe(1);

    // 3. Update Object
    const updateRes = await server.handleRequest({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'polyforge_update_object',
        arguments: {
          idOrName: 'Main Spire',
          material: { roughness: 0.1 },
        },
      },
    });
    expect(updateRes.result.isError).toBe(false);
    expect(server.state.items[0].material.roughness).toBe(0.1);

    // 4. Export to OBJ
    const exportObj = await server.handleRequest({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'polyforge_export_scene',
        arguments: { format: 'obj' },
      },
    });
    expect(exportObj.result.isError).toBe(false);
    const objData = JSON.parse(exportObj.result.content[0].text);
    expect(objData.format).toBe('obj');
    expect(objData.content).toContain('v ');

    // 5. Export to STL
    const exportStl = await server.handleRequest({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'polyforge_export_scene',
        arguments: { format: 'stl' },
      },
    });
    expect(exportStl.result.isError).toBe(false);
    const stlData = JSON.parse(exportStl.result.content[0].text);
    expect(stlData.format).toBe('stl');
    expect(stlData.content.toLowerCase()).toContain('solid');
  });

  it('executes custom JavaScript scripts via MCP tool', async () => {
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: {
        name: 'polyforge_execute_script',
        arguments: {
          script: `
            polyforge.clearScene();
            for (let i = 0; i < 4; i++) {
              polyforge.createObject({ name: 'Node ' + i, position: [i * 2, 0, 0] });
            }
            polyforge.log('Batch creation finished');
          `,
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(server.state.items.length).toBe(4);
    const data = JSON.parse(res.result.content[0].text);
    expect(data.logs).toContain('Batch creation finished');
  });

  it('returns clean error responses for missing tools or bad arguments', async () => {
    // Unknown method
    const badMethod = await server.handleRequest({
      jsonrpc: '2.0',
      id: 99,
      method: 'invalid_method',
      params: {},
    });
    expect(badMethod.error.code).toBe(-32601);

    // Unknown tool
    const badTool = await server.handleRequest({
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/call',
      params: { name: 'non_existent_tool', arguments: {} },
    });
    expect(badTool.result.isError).toBe(true);
    expect(badTool.result.content[0].text).toContain('Unknown tool');

    // Missing required argument
    const badArgs = await server.handleRequest({
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/call',
      params: { name: 'polyforge_generate_template', arguments: { templateId: 'unknown-id' } },
    });
    expect(badArgs.result.isError).toBe(true);
    expect(badArgs.result.content[0].text).toContain('Template not found');
  });

  it('generates realistic bicycle via MCP tool call', async () => {
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/call',
      params: {
        name: 'polyforge_generate_bicycle',
        arguments: {
          frameColor: '#1d4ed8',
          frameMaterial: 'gloss',
          spokeCount: 32,
        },
      },
    });

    expect(res.result.isError).toBe(false);
    const data = JSON.parse(res.result.content[0].text);
    expect(data.message).toContain('realistic mechanical bicycle');
    expect(data.stats.totalVertices).toBeGreaterThan(4000);
    expect(data.components.length).toBe(6);
  });

  it('generates animated closed-circuit bicycle with tracks via MCP tool call', async () => {
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 103,
      method: 'tools/call',
      params: {
        name: 'polyforge_generate_bicycle',
        arguments: {
          animated: true,
          frameColor: '#c01525',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    const data = JSON.parse(res.result.content[0].text);
    expect(data.message).toContain('animated closed-circuit bicycle');
    expect(data.componentsCount).toBe(7);
    expect(data.tracksCount).toBe(7);
    expect(data.totalFrames).toBe(360);
    expect(server.state.items.length).toBe(7);
    expect(server.state.tracks.length).toBe(7);
  });
});
