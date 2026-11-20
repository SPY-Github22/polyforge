import React, { useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Radio,
  Key,
  Compass,
} from 'lucide-react';
import { Keyframe, TimelineState } from '../types';

interface TimelineProps {
  timelineState: TimelineState;
  keyframes: Keyframe[];
  selectedObjectId: string | null;
  onSetFrame: (frame: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onToggleAutoKey: () => void;
  onAddKeyframe: () => void;
  onRemoveKeyframe: () => void;
  onGenerateTurntable: () => void;
  onChangeFps: (fps: number) => void;
  onChangeTotalFrames: (total: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  timelineState,
  keyframes,
  selectedObjectId,
  onSetFrame,
  onTogglePlay,
  onToggleLoop,
  onToggleAutoKey,
  onAddKeyframe,
  onRemoveKeyframe,
  onGenerateTurntable,
  onChangeFps,
  onChangeTotalFrames,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const { currentFrame, totalFrames, fps, isPlaying, isLooping, autoKeying } = timelineState;

  const hasKeyframeAtCurrent = keyframes.some((k) => k.frame === currentFrame);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newFrame = Math.round((clickX / rect.width) * totalFrames);
    onSetFrame(newFrame);
  };

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newFrame = Math.round((clickX / rect.width) * totalFrames);
    onSetFrame(newFrame);
  };

  return (
    <div className="h-28 bg-studio-900 border-t border-studio-750 flex flex-col select-none z-40 text-xs">
      {/* Upper Timeline Control Bar */}
      <div className="h-9 px-4 border-b border-studio-800 flex items-center justify-between">
        {/* Playback Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onSetFrame(0)}
            title="Jump to Start (Shift+Left)"
            aria-label="Jump to Start"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-studio-800 transition"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => onSetFrame(Math.max(0, currentFrame - 1))}
            title="Step Back 1 Frame (Left)"
            aria-label="Step Back 1 Frame"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-studio-800 transition"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            aria-label={isPlaying ? "Pause animation" : "Play animation"}
            className="w-7 h-7 rounded-full bg-studio-accent text-white flex items-center justify-center hover:bg-blue-600 transition shadow-md shadow-blue-500/20"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          <button
            onClick={() => onSetFrame(Math.min(totalFrames, currentFrame + 1))}
            title="Step Forward 1 Frame (Right)"
            aria-label="Step Forward 1 Frame"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-studio-800 transition"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => onSetFrame(totalFrames)}
            title="Jump to End (Shift+Right)"
            aria-label="Jump to End"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-studio-800 transition"
          >
            <SkipForward size={14} />
          </button>

          <div className="h-4 border-r border-studio-800 mx-2" />

          {/* Loop toggle */}
          <button
            onClick={onToggleLoop}
            title={isLooping ? 'Looping Enabled' : 'Looping Disabled'}
            className={`p-1.5 rounded transition ${
              isLooping ? 'bg-studio-accent/20 text-studio-accent' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Repeat size={14} />
          </button>

          {/* Auto-key toggle */}
          <button
            onClick={onToggleAutoKey}
            title={autoKeying ? 'Auto-Keying ACTIVE (Transforms auto-recorded)' : 'Auto-Keying Disabled'}
            className={`p-1.5 rounded transition flex items-center gap-1 ${
              autoKeying ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Radio size={14} className={autoKeying ? 'animate-pulse text-red-500' : ''} />
            <span className="text-[10px] font-semibold">{autoKeying ? 'REC' : 'Auto-Key'}</span>
          </button>
        </div>

        {/* Current Frame Readout */}
        <div className="flex items-center space-x-2 bg-studio-950 px-3 py-1 rounded border border-studio-800 font-mono">
          <span className="text-slate-500 text-[11px]">FRAME</span>
          <input
            type="number"
            min={0}
            max={totalFrames}
            value={currentFrame}
            onChange={(e) => onSetFrame(Math.max(0, Math.min(totalFrames, parseInt(e.target.value) || 0)))}
            className="w-12 bg-transparent text-center font-bold text-studio-accent focus:outline-none"
          />
          <span className="text-slate-600">/</span>
          <input
            type="number"
            min={10}
            max={1200}
            value={totalFrames}
            onChange={(e) => onChangeTotalFrames(Math.max(10, parseInt(e.target.value) || 60))}
            className="w-12 bg-transparent text-center text-slate-400 focus:outline-none"
          />
        </div>

        {/* Keyframe Operations & Generators */}
        <div className="flex items-center space-x-2">
          {hasKeyframeAtCurrent ? (
            <button
              disabled={!selectedObjectId}
              onClick={onRemoveKeyframe}
              title="Delete Keyframe at Current Frame"
              className="px-2 py-1 bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-900 rounded text-xs transition disabled:opacity-40"
            >
              - Keyframe
            </button>
          ) : (
            <button
              disabled={!selectedObjectId}
              onClick={onAddKeyframe}
              title="Add Keyframe at Current Frame"
              className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded text-xs transition disabled:opacity-40 flex items-center gap-1"
            >
              <Key size={12} />
              <span>+ Keyframe</span>
            </button>
          )}

          <button
            disabled={!selectedObjectId}
            onClick={onGenerateTurntable}
            title="Auto-Generate 360° Turntable Rotation Keyframes"
            className="px-2 py-1 bg-studio-800 border border-studio-700 text-slate-300 hover:text-white hover:bg-studio-750 rounded text-xs transition disabled:opacity-40 flex items-center gap-1"
          >
            <Compass size={12} />
            <span>360° Spin</span>
          </button>

          {/* FPS select */}
          <select
            value={fps}
            onChange={(e) => onChangeFps(parseInt(e.target.value))}
            className="bg-studio-850 border border-studio-750 rounded px-1.5 py-1 text-slate-300 outline-none text-xs"
          >
            <option value={24}>24 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </div>
      </div>

      {/* Scrubber Ruler & Keyframe Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onMouseMove={handleTrackMouseMove}
        className="flex-1 relative cursor-pointer bg-studio-950 overflow-hidden"
      >
        {/* Frame Ruler Lines */}
        <div className="absolute inset-0 pointer-events-none flex justify-between px-2">
          {Array.from({ length: 11 }).map((_, idx) => {
            const frameNum = Math.round((idx / 10) * totalFrames);
            return (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[9px] text-slate-600 font-mono mt-0.5">{frameNum}</span>
                <div className="w-px h-full bg-studio-850" />
              </div>
            );
          })}
        </div>

        {/* Keyframe Markers (Diamonds) for the active object */}
        {keyframes.map((kf) => {
          const leftPercent = (kf.frame / totalFrames) * 100;
          return (
            <div
              key={kf.frame}
              onClick={(e) => {
                e.stopPropagation();
                onSetFrame(kf.frame);
              }}
              title={`Keyframe at frame ${kf.frame}`}
              style={{ left: `${leftPercent}%` }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-amber-400 border border-amber-200 rounded-sm shadow-md shadow-amber-500/50 hover:scale-125 transition-transform z-20 cursor-pointer"
            />
          );
        })}

        {/* Playhead Needle */}
        <div
          style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
          className="absolute top-0 bottom-0 -translate-x-1/2 w-0.5 bg-studio-accent z-30 pointer-events-none"
        >
          <div className="w-2.5 h-3 bg-studio-accent -translate-x-[4px] rounded-b shadow" />
        </div>
      </div>
    </div>
  );
};
