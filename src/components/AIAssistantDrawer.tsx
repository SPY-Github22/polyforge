import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Code2,
  Play,
  Copy,
  Check,
  Settings,
  Terminal,
  Bot,
  X,
  RefreshCw,
  HelpCircle,
  FileCode,
} from 'lucide-react';
import {
  AnimationTrack,
  EnvironmentSettings,
  SceneItem,
  TimelineState,
} from '../types';
import {
  executePolyForgeScript,
} from '../core/ai/api';
import {
  PROCEDURAL_TEMPLATES,
} from '../core/ai/procedural';
import {
  callAIProvider,
  generateFullLLMPrompt,
  extractCodeFromLLMResponse,
} from '../core/ai/llm';
import { SAMPLE_SCRIPTS } from '../core/ai/sampleScripts';
import { AIConfig, AIProviderType, ProceduralTemplateId } from '../core/ai/types';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sceneItems: SceneItem[];
  tracks: AnimationTrack[];
  environment: EnvironmentSettings;
  timelineState: TimelineState;
  onApplySceneUpdate: (
    items: SceneItem[],
    tracks: AnimationTrack[],
    env?: EnvironmentSettings,
    timeline?: Partial<TimelineState>,
    actionName?: string
  ) => void;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  sceneItems,
  tracks,
  environment,
  timelineState,
  onApplySceneUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'prompt' | 'script' | 'context' | 'settings'>('prompt');

  // Prompt state
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  // Script editor state
  const [scriptCode, setScriptCode] = useState<string>(SAMPLE_SCRIPTS[0].code);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_SCRIPTS[0].id);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [isExecutingScript, setIsExecutingScript] = useState(false);

  // Context copy state
  const [isCopied, setIsCopied] = useState(false);
  const [externalResponse, setExternalResponse] = useState('');

  // AI Configuration state
  const [config, setConfig] = useState<AIConfig>({
    provider: 'offline',
    apiKey: '',
    model: 'gpt-4o',
    endpoint: '',
    temperature: 0.7,
  });

  // Load saved AI config from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('polyforge_ai_config');
      if (saved) {
        setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleSaveConfig = (updates: Partial<AIConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem('polyforge_ai_config', JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  // Run script directly
  const handleRunScript = async (codeToRun: string, actionName: string = 'Run AI Script') => {
    setIsExecutingScript(true);
    setConsoleLogs((prev) => [...prev, `[PolyForge AI] Executing script...`]);

    try {
      const result = await executePolyForgeScript(codeToRun, {
        items: sceneItems,
        tracks: tracks,
        environment: environment,
        timeline: timelineState,
      });

      if (result.logs.length > 0) {
        setConsoleLogs((prev) => [...prev, ...result.logs]);
      }

      if (result.success) {
        setConsoleLogs((prev) => [
          ...prev,
          `[Success] Script executed. Items in scene: ${result.createdItems.length + sceneItems.length - result.deletedItemIds.length}`,
        ]);

        // Construct final scene array
        const deletedSet = new Set(result.deletedItemIds);
        const updatedMap = new Map(result.updatedItems.map((it) => [it.id, it]));

        let finalItems = sceneItems
          .filter((it) => !deletedSet.has(it.id))
          .map((it) => (updatedMap.has(it.id) ? updatedMap.get(it.id)! : it));

        finalItems = [...finalItems, ...result.createdItems];

        onApplySceneUpdate(
          finalItems,
          result.tracks,
          result.environment,
          result.timeline,
          actionName
        );
      } else {
        setConsoleLogs((prev) => [...prev, `[Error] ${result.error || 'Execution failed.'}`]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConsoleLogs((prev) => [...prev, `[Runtime Exception] ${msg}`]);
    } finally {
      setIsExecutingScript(false);
    }
  };

  // Generate 3D Model from prompt
  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setIsGenerating(true);
    setGenerationStatus('Synthesizing 3D architecture & kinematics...');

    try {
      const aiResponse = await callAIProvider(promptText, config, {
        items: sceneItems,
        tracks: tracks,
        environment: environment,
        timeline: timelineState,
      });

      setGenerationStatus('Executing synthesized 3D construction...');
      setScriptCode(aiResponse.code);

      await handleRunScript(
        aiResponse.code,
        `AI: ${promptText.slice(0, 30)}`
      );

      setGenerationStatus(aiResponse.explanation || 'Generation complete!');
      setTimeout(() => setGenerationStatus(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerationStatus(`Generation error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply procedural preset immediately
  const handleSelectProceduralTemplate = (templateId: ProceduralTemplateId) => {
    const template = PROCEDURAL_TEMPLATES[templateId];
    if (!template) return;

    const res = template.generate();
    onApplySceneUpdate(
      res.items,
      res.tracks,
      res.environment ? ({ ...environment, ...res.environment } as EnvironmentSettings) : environment,
      res.timeline,
      `Procedural: ${template.name}`
    );

    setConsoleLogs((prev) => [
      ...prev,
      `[Procedural Engine] Generated "${template.name}" with ${res.items.length} objects and ${res.tracks.length} tracks.`,
    ]);
  };

  // Copy scene context for external LLMs
  const handleCopyContext = () => {
    const fullPrompt = generateFullLLMPrompt(
      promptText || 'Create or modify this 3D scene',
      sceneItems,
      tracks,
      environment,
      timelineState
    );

    navigator.clipboard.writeText(fullPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Execute pasted code from external LLM
  const handleRunExternalResponse = () => {
    if (!externalResponse.trim()) return;
    const extracted = extractCodeFromLLMResponse(externalResponse);
    setScriptCode(extracted);
    handleRunScript(extracted, 'Run Imported AI Code');
    setExternalResponse('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-11 right-0 bottom-8 w-[460px] bg-studio-900 border-l border-studio-800 shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="h-11 px-4 border-b border-studio-800 flex items-center justify-between bg-studio-950/80 backdrop-blur">
        <div className="flex items-center space-x-2 text-sky-400 font-semibold text-sm">
          <Sparkles className="w-4 h-4 animate-pulse text-sky-400" />
          <span>PolyForge AI Studio</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800 text-sky-300 font-mono">
            {config.provider === 'offline' ? 'Offline Procedural' : config.provider.toUpperCase()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-studio-800 transition"
          title="Close AI Assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-studio-800 bg-studio-950/40 text-xs text-slate-400 font-medium">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex-1 py-2 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition ${
            activeTab === 'prompt'
              ? 'border-sky-500 text-sky-400 bg-studio-900/60 font-semibold'
              : 'border-transparent hover:text-slate-200 hover:bg-studio-800/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Prompt 3D</span>
        </button>
        <button
          onClick={() => setActiveTab('script')}
          className={`flex-1 py-2 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition ${
            activeTab === 'script'
              ? 'border-sky-500 text-sky-400 bg-studio-900/60 font-semibold'
              : 'border-transparent hover:text-slate-200 hover:bg-studio-800/40'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code Studio</span>
        </button>
        <button
          onClick={() => setActiveTab('context')}
          className={`flex-1 py-2 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition ${
            activeTab === 'context'
              ? 'border-sky-500 text-sky-400 bg-studio-900/60 font-semibold'
              : 'border-transparent hover:text-slate-200 hover:bg-studio-800/40'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>LLM Bridge</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2 px-3 flex items-center justify-center border-b-2 transition ${
            activeTab === 'settings'
              ? 'border-sky-500 text-sky-400 bg-studio-900/60'
              : 'border-transparent hover:text-slate-200 hover:bg-studio-800/40'
          }`}
          title="AI Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: PROMPT TO 3D */}
        {activeTab === 'prompt' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Natural Language 3D Synthesis
              </label>
              <div className="relative">
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="e.g. Create a cyberpunk neon citadel with floating rings, or a solar system with orbiting planets..."
                  rows={4}
                  className="w-full bg-studio-950 border border-studio-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none font-sans"
                />
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-2 font-medium">
                Deeply Architected Templates:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PROCEDURAL_TEMPLATES) as ProceduralTemplateId[]).map((id) => {
                  const tmpl = PROCEDURAL_TEMPLATES[id];
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setPromptText(tmpl.description);
                        handleSelectProceduralTemplate(id);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-studio-800 hover:bg-studio-700 text-slate-300 hover:text-sky-300 border border-studio-700 transition flex items-center space-x-1"
                    >
                      <span>{tmpl.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !promptText.trim()}
              className={`w-full py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition ${
                isGenerating || !promptText.trim()
                  ? 'bg-studio-800 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Architecture...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate 3D & Animate</span>
                </>
              )}
            </button>

            {/* Status Message */}
            {generationStatus && (
              <div className="p-2.5 rounded bg-studio-950 border border-sky-900 text-xs text-sky-300 flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>{generationStatus}</span>
              </div>
            )}

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-studio-950/60 border border-studio-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Zero Setup Generation</span>
              </div>
              <p>
                PolyForge includes built-in procedural synthesis capable of generating multi-tier buildings, mechanical rigs, celestial systems, and synchronized animations with zero API keys. To connect external LLMs (Claude, GPT-4, Ollama), visit the <strong>Settings</strong> tab.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: CODE STUDIO */}
        {activeTab === 'script' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                <span>JavaScript 3D Code</span>
              </label>
              {/* Preset Selector */}
              <select
                value={selectedSampleId}
                onChange={(e) => {
                  setSelectedSampleId(e.target.value);
                  const found = SAMPLE_SCRIPTS.find((s) => s.id === e.target.value);
                  if (found) setScriptCode(found.code);
                }}
                className="bg-studio-950 border border-studio-700 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-sky-500"
              >
                {SAMPLE_SCRIPTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Code Textarea */}
            <div className="relative">
              <textarea
                value={scriptCode}
                onChange={(e) => setScriptCode(e.target.value)}
                rows={12}
                className="w-full bg-studio-950 border border-studio-700 rounded-lg p-3 text-[11px] text-sky-100 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleRunScript(scriptCode, 'Run Code Studio')}
                disabled={isExecutingScript}
                className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition shadow"
              >
                {isExecutingScript ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Script</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setConsoleLogs([])}
                className="py-2 px-3 rounded-lg bg-studio-800 hover:bg-studio-700 text-slate-300 text-xs border border-studio-700 transition"
                title="Clear Logs"
              >
                Clear
              </button>
            </div>

            {/* Console Log Output */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="flex items-center space-x-1">
                  <Terminal className="w-3 h-3 text-sky-400" />
                  <span>Execution Console</span>
                </span>
                <span>{consoleLogs.length} events</span>
              </div>
              <div className="h-28 bg-black/50 border border-studio-800 rounded-lg p-2 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1">
                {consoleLogs.length === 0 ? (
                  <span className="text-slate-600">No output recorded yet.</span>
                ) : (
                  consoleLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.includes('[Error]') || log.includes('[Execution Error]')
                          ? 'text-rose-400'
                          : log.includes('[Success]')
                          ? 'text-emerald-400'
                          : log.includes('[Warn]')
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LLM BRIDGE & AGENT INTEGRATION */}
        {activeTab === 'context' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Agent / Copilot Bridge
              </span>
              <p className="text-[11px] text-slate-400">
                Export complete 3D scene graphs and PolyForge TypeScript API documentation to external agents (Antigravity CLI, ChatGPT, Claude) or run their generated scripts.
              </p>
            </div>

            {/* One-click copy prompt context */}
            <button
              onClick={handleCopyContext}
              className="w-full py-2.5 px-3 rounded-lg bg-studio-800 hover:bg-studio-700 text-slate-200 text-xs font-medium border border-studio-700 transition flex items-center justify-center space-x-2"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Context Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-sky-400" />
                  <span>Copy Scene Context & API Schema</span>
                </>
              )}
            </button>

            {/* Paste AI response & Run */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300 flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                <span>Paste External AI Response:</span>
              </label>
              <textarea
                value={externalResponse}
                onChange={(e) => setExternalResponse(e.target.value)}
                placeholder="Paste code or markdown from ChatGPT, Claude, or terminal agent..."
                rows={5}
                className="w-full bg-studio-950 border border-studio-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono resize-none"
              />
              <button
                onClick={handleRunExternalResponse}
                disabled={!externalResponse.trim()}
                className={`w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition ${
                  !externalResponse.trim()
                    ? 'bg-studio-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Import & Execute Code</span>
              </button>
            </div>

            {/* Headless CLI Instructions */}
            <div className="p-3 rounded-lg bg-studio-950/80 border border-studio-800 text-[11px] text-slate-400 space-y-2 font-mono">
              <div className="text-sky-300 font-semibold font-sans flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Headless Terminal Agent Execution</span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Agents running in shell can execute scripts, generate models, and export GLTF/OBJ directly from the command line:
              </p>
              <div className="p-2 rounded bg-black/60 text-sky-300 text-[10px] select-all">
                npx tsx cli/polyforge-agent.ts generate --template sci-fi-citadel --out model.json
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              AI Provider Configuration
            </span>

            {/* Provider Select */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Provider</label>
              <select
                value={config.provider}
                onChange={(e) => handleSaveConfig({ provider: e.target.value as AIProviderType })}
                className="w-full bg-studio-950 border border-studio-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-sky-500"
              >
                <option value="offline">Built-in Procedural AI (Offline / Zero Setup)</option>
                <option value="openai">OpenAI (GPT-4o, o1, etc.)</option>
                <option value="anthropic">Anthropic Claude (3.5 Sonnet)</option>
                <option value="ollama">Local Ollama / vLLM</option>
                <option value="custom">Custom OpenAI-Compatible API</option>
              </select>
            </div>

            {/* API Key */}
            {config.provider !== 'offline' && config.provider !== 'ollama' && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">API Key</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => handleSaveConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-studio-950 border border-studio-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {/* Model Name */}
            {config.provider !== 'offline' && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Model Name</label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => handleSaveConfig({ model: e.target.value })}
                  placeholder={config.provider === 'ollama' ? 'llama3' : 'gpt-4o'}
                  className="w-full bg-studio-950 border border-studio-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {/* Custom Endpoint */}
            {(config.provider === 'ollama' || config.provider === 'custom') && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">API Endpoint</label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => handleSaveConfig({ endpoint: e.target.value })}
                  placeholder={
                    config.provider === 'ollama'
                      ? 'http://localhost:11434/v1/chat/completions'
                      : 'https://your-api.com/v1/chat/completions'
                  }
                  className="w-full bg-studio-950 border border-studio-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {/* Temperature Slider */}
            {config.provider !== 'offline' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-medium">Creativity (Temperature)</span>
                  <span className="font-mono text-sky-400">{config.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={config.temperature}
                  onChange={(e) => handleSaveConfig({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="h-8 px-4 border-t border-studio-800 bg-studio-950/90 flex items-center justify-between text-[10px] text-slate-500">
        <span>PolyForge AI Engine v1.0</span>
        <span className="text-slate-400">Ready</span>
      </div>
    </div>
  );
};
