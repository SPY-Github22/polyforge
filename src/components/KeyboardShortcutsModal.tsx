import React from 'react';
import { X, Keyboard, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: 'Object Manipulation (Blender standard)',
      items: [
        { keys: ['G'], label: 'Translate / Move selected' },
        { keys: ['R'], label: 'Rotate selected' },
        { keys: ['S'], label: 'Scale selected' },
        { keys: ['Q'], label: 'Select tool' },
        { keys: ['Shift', 'D'], label: 'Duplicate selected object' },
        { keys: ['X', 'or', 'Del'], label: 'Delete selected object' },
      ],
    },
    {
      category: 'Timeline & Animation',
      items: [
        { keys: ['Space'], label: 'Play / Pause Animation' },
        { keys: ['←'], label: 'Step Back 1 Frame' },
        { keys: ['→'], label: 'Step Forward 1 Frame' },
        { keys: ['Shift', '←'], label: 'Jump to First Frame (0)' },
        { keys: ['Shift', '→'], label: 'Jump to Last Frame' },
      ],
    },
    {
      category: 'Viewport & Camera Views',
      items: [
        { keys: ['Num 1'], label: 'Front View' },
        { keys: ['Num 3'], label: 'Right Side View' },
        { keys: ['Num 7'], label: 'Top View' },
        { keys: ['Middle Mouse'], label: 'Orbit 3D Scene' },
        { keys: ['Shift', 'Middle Mouse'], label: 'Pan 3D Scene' },
        { keys: ['Wheel'], label: 'Zoom In / Out' },
      ],
    },
    {
      category: 'AI Assistant & Automation',
      items: [
        { keys: ['Ctrl', 'Shift', 'A'], label: 'Toggle AI Studio Drawer' },
      ],
    },
    {
      category: 'History & Project',
      items: [
        { keys: ['Ctrl', 'Z'], label: 'Undo Action' },
        { keys: ['Ctrl', 'Y'], label: 'Redo Action' },
        { keys: ['Ctrl', 'S'], label: 'Save Project JSON' },
      ],
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-studio-900 border border-studio-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-studio-800 bg-studio-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-studio-accent/20 border border-studio-accent/40 flex items-center justify-center text-studio-accent">
              <Keyboard size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">Keyboard Shortcuts & Navigation</h3>
              <p className="text-[11px] text-slate-400">Blender-compatible hotkeys for fast 3D creation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-studio-800 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5 text-xs">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-studio-accent">
                {group.category}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-studio-850/60 border border-studio-800"
                  >
                    <span className="text-slate-300 text-[11px]">{item.label}</span>
                    <div className="flex items-center space-x-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 bg-studio-950 border border-studio-700 rounded font-mono text-[10px] text-slate-200 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* About Section */}
          <div className="p-3 bg-studio-950/80 border border-studio-800 rounded-lg text-slate-400 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-200 font-semibold">
              <HelpCircle size={14} className="text-studio-accent" />
              <span>About PolyForge Studio</span>
            </div>
            <p className="text-[11px]">
              PolyForge is a zero-latency, full-featured web-native 3D modeling and animation platform.
              All geometry generation, lighting shaders, keyframe interpolation, and 3D export pipelines run directly on your GPU without cloud dependency.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-studio-950 border-t border-studio-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-studio-accent text-white rounded-lg hover:bg-blue-600 transition font-medium text-xs shadow-md"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
