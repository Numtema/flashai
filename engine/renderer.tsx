import React, { useState, useEffect, useRef } from "react";
import { UiNode, Ctx } from "../types";
import { interpolate } from "./bindings";
import { useAppStore } from "../store/useAppStore";
import flow from "../config/app.flow";
import { runAction } from "./actions";
import { evalExpr } from "./guards";
import { eventBus } from "./eventBus";
import { useNavigate } from "react-router-dom";
import { liveService } from "../services/live";
import { 
    Stack, Grid, Card, Button, TextInput, StatsCard, ReactiveText 
} from "../components/Primitives";

// --- Helpers ---
const downloadFile = (filename: string, content: string | Blob, contentType: string) => {
  const element = document.createElement("a");
  const file = content instanceof Blob ? content : new Blob([content], { type: contentType });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const jsonToMarkdown = (data: any, depth = 1): string => {
  let md = "";
  if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      md += `${"#".repeat(depth)} ${key.replace(/([A-Z])/g, ' $1').trim()}\n\n`;
      if (typeof value === "object") {
        md += jsonToMarkdown(value, depth + 1);
      } else if (Array.isArray(value)) {
        value.forEach(v => md += `- ${v}\n`);
        md += "\n";
      } else {
        md += `${value}\n\n`;
      }
    }
  } else {
    md += `${data}\n\n`;
  }
  return md;
};

// --- Complex Widgets (Features) ---

const VoiceControl: React.FC<{ isMobile?: boolean }> = ({ isMobile }) => {
    const [status, setStatus] = useState<'connected'|'disconnected'|'error'>('disconnected');

    useEffect(() => {
        const h = (s: any) => setStatus(s);
        const u = eventBus.on('live.status', h);
        return u;
    }, []);

    const toggle = () => {
        if (status === 'connected') {
            liveService.disconnect();
        } else {
            liveService.connect();
        }
    };

    const baseClass = isMobile 
        ? `w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${status === 'connected' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white'}`
        : `fixed bottom-8 left-1/2 -translate-x-1/2 z-50 h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 ${status === 'connected' ? 'bg-red-500 text-white animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.4)]' : 'bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-white/10 hover:scale-110'}`;

    return (
        <button onClick={toggle} className={baseClass}>
             {status === 'connected' ? (
                <div className="flex gap-1 h-4 items-center">
                    <div className="w-1 bg-white animate-[bounce_1s_infinite] h-full" />
                    <div className="w-1 bg-white animate-[bounce_1.2s_infinite] h-2/3" />
                    <div className="w-1 bg-white animate-[bounce_0.8s_infinite] h-full" />
                </div>
             ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
             )}
        </button>
    )
}

const Timeline: React.FC<any> = ({ steps }) => {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 backdrop-blur-sm relative overflow-hidden">
             <div className="text-[9px] uppercase font-black tracking-widest text-gray-600 mb-8">Production Pipeline</div>
             <div className="relative pl-2">
                 {/* Connecting Line */}
                 <div className="absolute left-[11px] top-2 bottom-4 w-[2px] bg-white/5"></div>
                 
                 <div className="space-y-8 relative">
                    {steps.map((step: any, i: number) => {
                        const status = useAppStore(s => s.getPath(`workspace.stateByAgent.${step.agent}.status`)) || 'idle';
                        const isDone = status === 'done';
                        const isRunning = status === 'running';
                        
                        return (
                            <div key={i} className="flex gap-4 items-start group">
                                <div className={`
                                    w-6 h-6 rounded-full border-2 z-10 flex items-center justify-center transition-all duration-500 bg-[#0a0a0a]
                                    ${isDone ? 'border-flash-accent bg-flash-accent text-black' : isRunning ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-white/10 bg-black'}
                                `}>
                                    {isDone && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                    {isRunning && <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping" />}
                                </div>
                                <div className="flex-1 -mt-1">
                                    <div className={`text-xs font-bold transition-colors ${isDone ? 'text-white' : isRunning ? 'text-yellow-400' : 'text-gray-600'}`}>
                                        {step.label}
                                    </div>
                                    <div className="text-[9px] uppercase tracking-wider opacity-40 mt-0.5">{status}</div>
                                </div>
                            </div>
                        )
                    })}
                 </div>
             </div>
        </div>
    )
}

export const ToastContainer: React.FC = () => {
    const notifications = useAppStore(s => s.data.notifications) || [];
    const remove = useAppStore(s => s.removeNotification);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
            {notifications.map(n => (
                <div key={n.id} className="pointer-events-auto min-w-[300px] bg-flash-surface border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-[slideIn_0.3s_ease-out] flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${n.type === 'error' ? 'bg-red-500' : n.type === 'success' ? 'bg-flash-accent' : 'bg-blue-400'} shadow-[0_0_10px_currentColor]`} />
                    <div className="flex-1 text-xs font-medium text-white">{n.message}</div>
                    <button onClick={() => remove(n.id)} className="text-white/30 hover:text-white">✕</button>
                </div>
            ))}
            <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        </div>
    );
};

export const CommandPalette: React.FC = () => {
    const isOpen = useAppStore(s => s.data.ui?.commandPaletteOpen);
    const toggle = useAppStore(s => s.toggleUi);
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                toggle('commandPaletteOpen');
            }
            if (e.key === 'Escape' && isOpen) {
                toggle('commandPaletteOpen');
            }
        }
        window.addEventListener('keydown', handleDown);
        return () => window.removeEventListener('keydown', handleDown);
    }, [isOpen, toggle]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const commands = [
        { id: 'home', label: 'Go to Dashboard', icon: '🏠', action: () => navigate('/') },
        { id: 'theme', label: 'Toggle Theme', icon: '🌗', action: () => eventBus.emit('app.toggleTheme', {}) },
        { id: 'focus', label: 'Toggle Focus Mode', icon: '🎯', action: () => useAppStore.getState().toggleUi('focusMode') },
        { id: 'term', label: 'Toggle Terminal', icon: '💻', action: () => useAppStore.getState().toggleUi('terminalOpen') },
    ];

    const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={() => toggle('commandPaletteOpen')}>
            <div className="w-full max-w-lg bg-[#151515] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-[fadeIn_0.15s_ease-out]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-white/5 flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                        ref={inputRef}
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 text-sm"
                        placeholder="Type a command..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="px-2 py-1 bg-white/10 rounded text-[10px] text-gray-400 font-mono">ESC</div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                    {filtered.map((c, i) => (
                        <button 
                            key={c.id}
                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm text-gray-300 hover:bg-flash-accent/10 hover:text-white transition-colors group ${i === 0 ? 'bg-white/[0.02]' : ''}`}
                            onClick={() => {
                                c.action();
                                toggle('commandPaletteOpen');
                            }}
                        >
                            <span className="opacity-50 group-hover:opacity-100 transition-opacity">{c.icon}</span>
                            <span className="font-medium">{c.label}</span>
                        </button>
                    ))}
                    {filtered.length === 0 && <div className="p-4 text-center text-xs text-gray-500">No results found.</div>}
                </div>
            </div>
        </div>
    );
};

export const Terminal: React.FC = () => {
    const isOpen = useAppStore(s => s.data.ui?.terminalOpen);
    const logs = useAppStore(s => s.data.logs) || [];
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-48 bg-[#0a0a0a] border-t border-white/10 z-[40] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col hidden lg:flex">
            <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/5">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-flash-accent animate-pulse"></span>
                    Live Console
                </div>
                <button onClick={() => useAppStore.getState().toggleUi('terminalOpen')} className="text-gray-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1 custom-scrollbar">
                {logs.length === 0 && <div className="opacity-30 italic text-gray-500">System ready. Waiting for tasks...</div>}
                {logs.map(log => (
                    <div key={log.id} className="flex gap-3 text-gray-400 border-b border-white/[0.02] pb-1 mb-1 last:border-0 hover:bg-white/[0.02]">
                        <span className="opacity-30 select-none w-14">{log.timestamp}</span>
                        <span className={`font-bold w-20 text-right uppercase tracking-wider ${log.source === 'System' ? 'text-blue-400' : 'text-flash-accent'}`}>{log.source}</span>
                        <span className={`flex-1 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : log.level === 'success' ? 'text-green-400' : 'text-gray-300'}`}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export const AgentSettingsModal: React.FC = () => {
    const activeAgent = useAppStore(s => s.getPath('ui.activeAgentSettings'));
    const configPath = `workspace.stateByAgent.${activeAgent}.config`;
    const config = useAppStore(s => s.getPath(configPath)) || {};
    const [instruction, setInstruction] = useState(config.systemInstruction || "");
    const [temperature, setTemperature] = useState(config.temperature ?? 0.7);

    useEffect(() => {
        if (activeAgent) {
            setInstruction(config.systemInstruction || "");
            setTemperature(config.temperature ?? 0.7);
        }
    }, [activeAgent, config.systemInstruction, config.temperature]);

    const handleSave = () => {
        const def = (flow.actions as any)['updateAgentConfig'];
        runAction(def, { 
            params: { 
                agentName: activeAgent, 
                systemInstruction: instruction, 
                temperature: Number(temperature) 
            } 
        } as any);
    };

    const handleClose = () => {
        const def = (flow.actions as any)['closeAgentSettings'];
        runAction(def, {} as any);
    };

    if (!activeAgent) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-[#121212] w-full max-w-2xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden animate-[scaleIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
                {/* ... (Modal content same as before) ... */}
                <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                     <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-flash-accent mb-2 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-flash-accent animate-pulse" />
                             Agent Brain Config
                        </div>
                        <h2 className="text-2xl font-bold text-white capitalize">{activeAgent} Protocol</h2>
                     </div>
                     <button onClick={handleClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                </div>
                
                <div className="p-8 space-y-8">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            System Instruction (Persona)
                        </label>
                        <textarea 
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            className="w-full h-40 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-mono text-gray-300 focus:border-flash-accent/50 focus:ring-1 focus:ring-flash-accent/20 outline-none resize-none leading-relaxed placeholder-white/10"
                            placeholder="Define who this agent is and how it should behave..."
                        />
                    </div>
                    {/* ... (rest of modal content) ... */}
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Creativity (Temperature)</label>
                            <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-white">{temperature}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.1"
                            value={temperature}
                            onChange={e => setTemperature(parseFloat(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-flash-accent"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 uppercase font-bold tracking-widest">
                            <span>Precise</span>
                            <span>Balanced</span>
                            <span>Creative</span>
                        </div>
                    </div>
                </div>
                 <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end gap-3">
                    <button onClick={handleClose} className="px-6 py-3 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-wider">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-flash-accent text-white text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(22,198,12,0.4)] transition-all transform hover:scale-105">
                        Reprogram Agent
                    </button>
                </div>
            </div>
        </div>
    );
};

const AgentItem: React.FC<any> = ({ agent, ctx }) => {
    const status = useAppStore(s => s.getPath(agent.statusPath)) || 'idle';
    const isRunning = status === 'running';
    const isDone = status === 'done';

    return (
        <div className={`
            flex items-center justify-between gap-4 p-4 rounded-[1.8rem] border transition-all duration-500 group relative overflow-hidden
            ${isRunning ? 'bg-white/[0.03] border-flash-accent/20' : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'}
        `}>
            {/* Ambient Background Glow when running */}
            {isRunning && <div className="absolute inset-0 bg-flash-accent/5 animate-pulse pointer-events-none" />}

            <div className="flex items-center gap-4 relative z-10">
                {/* Avatar with Status Dot */}
                <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-transparent p-0.5 shadow-inner">
                        <div className="w-full h-full rounded-[14px] bg-black/40 flex items-center justify-center overflow-hidden">
                             {agent.avatar ? (
                                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
                             ) : (
                                <div className="w-6 h-6 rounded-full bg-white/20" />
                             )}
                        </div>
                    </div>
                    {/* Status Dot Overlay */}
                    <div className="absolute -bottom-1 -right-1 flex">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 border-[#151515] transition-all duration-500 ${
                            isRunning ? 'bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]' : 
                            isDone ? 'bg-flash-accent shadow-[0_0_8px_rgba(22,198,12,0.6)]' : 'bg-gray-600'
                        }`} />
                        {isRunning && <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-yellow-400 animate-ping opacity-75" />}
                    </div>
                </div>

                <div>
                    <div className="text-xs font-bold text-gray-200 capitalize tracking-wide group-hover:text-white transition-colors">{agent.name}</div>
                    <div className="text-[9px] opacity-40 mt-0.5 font-medium tracking-normal text-gray-300">{agent.role || status}</div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 relative z-10">
                <button
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all duration-300"
                    onClick={() => {
                        if (agent.settingsAction && agent.settingsAction.$action) {
                            const def = (flow.actions as any)[agent.settingsAction.$action];
                            runAction(def, { ...ctx, params: agent.settingsAction.params });
                        }
                    }}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <button 
                    className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                        ${isRunning 
                            ? 'bg-transparent text-yellow-400' 
                            : 'bg-white/5 hover:bg-flash-accent hover:text-white text-gray-500'}
                    `}
                    disabled={isRunning}
                    onClick={() => {
                    if (!isRunning) {
                        const def = (flow.actions as any)[agent.primaryAction.onClick.$action];
                        runAction(def, { ...ctx, params: agent.primaryAction.onClick.params });
                    }
                    }}
                >
                    {isRunning ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                </button>
            </div>
        </div>
    );
};

const ArtifactEditor: React.FC<{ artifact: any; onSaveAction: any; onRefineAction?: any; ctx: any }> = ({ artifact, onSaveAction, onRefineAction, ctx }) => {
  // ... existing implementation
  const [draft, setDraft] = useState(() => JSON.stringify(artifact.data, null, 2));
  const [mode, setMode] = useState<'edit'|'preview'>('edit');
  const [showExport, setShowExport] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  React.useEffect(() => {
    setDraft(JSON.stringify(artifact.data, null, 2));
    setIsRefining(false);
    setShowRefine(false);
  }, [artifact.id, artifact.data]); 

  const isImage = artifact.kind === 'image' || (artifact.data && (artifact.data.url || artifact.data.base64));

  const handleExport = (format: string) => {
    setShowExport(false);
    try {
        const data = JSON.parse(draft);
        const filename = `${artifact.title.replace(/\s+/g, '_')}_${Date.now()}`;
        if (format === 'json') downloadFile(`${filename}.json`, draft, 'application/json');
        else if (format === 'md') downloadFile(`${filename}.md`, jsonToMarkdown(data), 'text/markdown');
        else if (format === 'txt') downloadFile(`${filename}.txt`, JSON.stringify(data, null, 2), 'text/plain');
        eventBus.emit('ui.notify', { type: 'success', message: `Exported as ${format.toUpperCase()}` });
    } catch(e) {
        eventBus.emit('ui.notify', { type: 'error', message: 'Failed to export' });
    }
  };

  const handleRefine = () => {
    if(!refinePrompt.trim()) return;
    setIsRefining(true);
    if (onRefineAction?.$action) {
        const def = (flow.actions as any)[onRefineAction.$action];
        runAction(def, { ...ctx, params: { artifactId: artifact.id, instruction: refinePrompt } });
    }
  };

  const renderPreview = (jsonString: string) => {
    try {
        const obj = JSON.parse(jsonString);
        if (isImage) {
            const src = obj.url || obj.base64;
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black/20">
                        <img src={src} alt="Generated Artifact" className="max-h-[500px] max-w-full object-contain" />
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-[2rem] pointer-events-none" />
                    </div>
                    <div className="flex gap-2">
                         <button 
                            onClick={() => downloadFile(`image_${artifact.id}.png`, src, 'image/png')}
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download PNG
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="space-y-4 font-sans text-gray-300">
                {Object.entries(obj).map(([k, v]: any) => (
                    <div key={k} className="border-b border-white/5 pb-2">
                        <div className="text-[9px] uppercase tracking-widest opacity-50 mb-1">{k}</div>
                        <div className="text-sm font-medium leading-relaxed">
                            {Array.isArray(v) 
                                ? <ul className="list-disc pl-4 space-y-1">{v.map((i, idx) => <li key={idx}>{String(i)}</li>)}</ul> 
                                : typeof v === 'object' 
                                    ? <pre className="text-[10px] bg-black/20 p-2 rounded border border-white/5 overflow-x-auto">{JSON.stringify(v, null, 2)}</pre>
                                    : <div className="whitespace-pre-wrap">{String(v)}</div>
                            }
                        </div>
                    </div>
                ))}
            </div>
        );
    } catch(e) {
        return <div className="text-red-400 text-xs font-mono p-4 bg-red-500/10 rounded-xl border border-red-500/20">Error: Invalid JSON data</div>;
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute -top-14 right-0 z-30 flex gap-2 items-center">
          <button 
             onClick={() => { setShowRefine(!showRefine); setRefinePrompt(""); }}
             className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all ${showRefine ? 'bg-purple-500 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-black/40 text-purple-400 border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10'}`}
             title="Magic Refine"
          >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>
          <div className="bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5 flex gap-1 shadow-xl">
            <button onClick={() => setMode('edit')} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${mode === 'edit' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}>Code</button>
            <button onClick={() => setMode('preview')} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${mode === 'preview' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}>Preview</button>
          </div>
          <div className="relative">
              <button onClick={() => setShowExport(!showExport)} className="bg-flash-accent/10 hover:bg-flash-accent/20 text-flash-accent border border-flash-accent/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 backdrop-blur-md">
                  Export
                  <svg className={`w-3 h-3 transition-transform ${showExport ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showExport && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-[slideIn_0.1s_ease-out] z-50">
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-3 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider">JSON</button>
                      <button onClick={() => handleExport('md')} className="w-full text-left px-4 py-3 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider">Markdown</button>
                      <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-3 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider">Text</button>
                  </div>
              )}
          </div>
      </div>

      {showRefine && (
        <div className="mb-4 animate-[slideIn_0.2s_ease-out]">
            <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-2xl p-2 flex gap-2 shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden">
                {isRefining && <div className="absolute inset-0 bg-white/5 animate-pulse z-0" />}
                <div className="flex items-center pl-3 z-10"><svg className="w-4 h-4 text-purple-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg></div>
                <input autoFocus type="text" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRefine()} placeholder="Describe how to change this artifact..." disabled={isRefining} className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-gray-500 z-10" />
                <button onClick={handleRefine} disabled={isRefining} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 z-10">{isRefining ? 'Refining...' : 'Apply Magic'}</button>
            </div>
        </div>
      )}

      <div className="flex-1 mt-0 overflow-hidden relative rounded-[2rem] bg-black/20 border border-white/5">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
            {mode === 'edit' ? <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full min-h-full bg-transparent border-none outline-none text-xs font-mono text-gray-300 resize-none leading-relaxed selection:bg-flash-accent/30 placeholder-white/10" spellCheck={false} placeholder="// JSON Data..." /> : renderPreview(draft)}
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center opacity-50 hover:opacity-100 transition-opacity">
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest pl-2">{mode === 'edit' ? 'Editing Mode' : 'Read-Only Mode'}</div>
        <button className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-flash-accent hover:text-white text-gray-400 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105" onClick={() => {
            let nextData: any;
            try { nextData = JSON.parse(draft); } catch (e) { eventBus.emit('ui.notify', { type: 'error', message: 'Invalid JSON' }); return; }
            const patch = [{ op: "set", path: "data", value: nextData }];
            if (onSaveAction?.$action) { const def = (flow.actions as any)[onSaveAction.$action]; runAction(def, { ...ctx, params: { artifactId: artifact.id, patch } }); }
          }}>Save</button>
      </div>
    </div>
  );
};

const Canvas: React.FC<any> = ({ tabs, selectedTabPath, editor, emptyState, ctx }) => {
    const selectedTab = useAppStore(s => s.getPath(selectedTabPath));
    const setPath = useAppStore(s => s.setPath);
    
    // We need to know which artifact is selected.
    const selectedArtifactId = useAppStore(s => s.getPath(editor.artifactIdPath));
    const artifacts = useAppStore(s => s.getPath("workspace.artifacts")) || [];
    const selectedArtifact = artifacts.find((a: any) => a.id === selectedArtifactId);

    // Use evalExpr to check for empty state
    // If we have no artifact selected, or if condition matches
    const showEmpty = !selectedArtifact || (emptyState?.when && evalExpr(emptyState.when, ctx));

    if (showEmpty && emptyState) {
        return (
             <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-[fadeIn_0.5s_ease-out]">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse border border-white/5">
                    <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">{emptyState.title}</h3>
                <p className="text-gray-500 max-w-md mb-8 leading-relaxed text-sm">{emptyState.text}</p>
                {emptyState.primary && (
                    <div className="w-auto inline-block">
                         <Button {...emptyState.primary} variant="primary" ctx={ctx} />
                    </div>
                )}
             </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Tabs */}
            {tabs && (
                <div className="flex items-center gap-6 mb-6 border-b border-white/5 pb-0 px-2 overflow-x-auto no-scrollbar">
                    {tabs.map((tab: any) => {
                        const isActive = selectedTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setPath(selectedTabPath, tab.id)}
                                className={`pb-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${isActive ? 'text-flash-accent' : 'text-gray-600 hover:text-gray-400'}`}
                            >
                                {tab.label}
                                {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-flash-accent shadow-[0_0_15px_rgba(22,198,12,0.8)] rounded-full" />}
                            </button>
                        );
                    })}
                </div>
            )}
            
            {/* Content */}
            <div className="flex-1 min-h-0 relative">
                 {selectedArtifact ? (
                    <ArtifactEditor 
                        artifact={selectedArtifact} 
                        onSaveAction={editor.onSave} 
                        onRefineAction={editor.onRefine}
                        ctx={ctx} 
                    />
                 ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest opacity-50">
                        Select an artifact to view details
                    </div>
                 )}
            </div>
        </div>
    );
};

const AgentsRail: React.FC<any> = ({ agents = [], ctx }) => {
    return (
        <div className="flex flex-col gap-3">
            {agents.map((agent: any, i: number) => (
                <AgentItem key={i} agent={agent} ctx={ctx} />
            ))}
        </div>
    );
};

const ArtifactsExplorer: React.FC<any> = ({ bind, onOpen, ctx }) => {
    const artifacts = useAppStore(s => s.getPath(bind)) || [];
    const selectedId = useAppStore(s => s.getPath("workspace.selectedArtifactId"));

    if (!artifacts.length) return <div className="p-4 text-[10px] text-gray-500 italic opacity-50 text-center border border-white/5 rounded-2xl bg-black/20">No artifacts generated yet.</div>;

    return (
        <div className="flex flex-col gap-2 animate-[fadeIn_0.3s_ease-out]">
            <div className="px-2 text-[9px] uppercase font-black tracking-widest text-gray-600 mb-2 mt-2">Artifacts</div>
            {artifacts.map((art: any) => {
                const isSelected = selectedId === art.id;
                return (
                    <button
                        key={art.id}
                        onClick={() => {
                            if (onOpen?.$action) {
                                const def = (flow.actions as any)[onOpen.$action];
                                runAction(def, { ...ctx, params: onOpen.params, item: art });
                            }
                        }}
                        className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all duration-300 flex items-center gap-3 group relative overflow-hidden
                            ${isSelected 
                                ? 'bg-flash-accent/10 border-flash-accent/40 text-white shadow-[0_0_20px_rgba(22,198,12,0.1)]' 
                                : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/10 hover:text-white'}
                        `}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full transition-all ${isSelected ? 'bg-flash-accent shadow-[0_0_8px_currentColor]' : 'bg-gray-700 group-hover:bg-gray-500'}`} />
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold truncate leading-tight">{art.title}</div>
                            <div className="text-[9px] opacity-40 uppercase tracking-wider font-medium mt-0.5">{art.kind}</div>
                        </div>
                    </button>
                )
            })}
        </div>
    );
};

const InspectorStatus: React.FC<any> = ({ ctx }) => {
    const status = useAppStore(s => s.getPath('workspace.status')) || 'IDLE';
    const versions = useAppStore(s => s.getPath('workspace.versions')) || [];
    
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 backdrop-blur-sm">
            <div className="text-[9px] uppercase font-black tracking-widest text-gray-600 mb-4">Project Status</div>
            <div className="flex items-center justify-between mb-4">
                 <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">{status}</div>
                 <div className="text-[10px] text-gray-500 font-mono">{versions.length} Ver</div>
            </div>
            <div className="h-12 flex items-end gap-1 opacity-40">
                {[40,70,30,80,50,90,20,60,40,70].map((h,i) => (
                    <div key={i} className="flex-1 bg-white/20 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
            </div>
        </div>
    )
}

const InspectorChecklist: React.FC<any> = ({ title, items, ctx }) => {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 backdrop-blur-sm">
             <div className="text-[9px] uppercase font-black tracking-widest text-gray-600 mb-4">{title}</div>
             <div className="flex flex-col gap-3">
                {items.map((item: any) => {
                     const val = useAppStore(s => s.getPath(item.path));
                     return (
                        <div key={item.id} className="flex items-center gap-3 group opacity-70 hover:opacity-100 transition-opacity cursor-default">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${val ? 'bg-flash-accent border-flash-accent text-black' : 'border-white/20 bg-black/20'}`}>
                                {val && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-[11px] font-medium text-gray-300">{item.label}</span>
                        </div>
                    );
                })}
             </div>
        </div>
    )
}

const Inspector: React.FC<any> = ({ sections = [], ctx }) => {
    return (
        <div className="flex flex-col gap-6">
            {sections.map((sec: any, i: number) => {
                if (sec.type === 'Status') return <InspectorStatus key={i} ctx={ctx} />;
                if (sec.type === 'Timeline') return <Timeline key={i} steps={sec.steps} />;
                if (sec.type === 'Checklist') return <InspectorChecklist key={i} {...sec} ctx={ctx} />;
                return null;
            })}
        </div>
    );
};

const Workspace3Pane: React.FC<any> = ({ header, left, center, right, ctx }) => {
  const isFocusMode = useAppStore(s => s.data.ui?.focusMode);
  // Mobile View Logic: "agents", "canvas", "inspector"
  const [mobileView, setMobileView] = useState<'agents'|'canvas'|'inspector'>('canvas');
  
  return (
    <div className="max-w-[1800px] mx-auto pb-48 lg:pb-12 min-h-screen flex flex-col">
      {/* Desktop Voice Control */}
      {!isFocusMode && <VoiceControl />}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-flash-bg/90 backdrop-blur-xl py-6 border-b border-white/5 mb-6 lg:mb-10 transition-all px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white drop-shadow-2xl">
                    <ReactiveText template={header?.title} ctx={ctx} as="span" />
                </h1>
                <div className="text-xs font-mono text-flash-accent mt-3 opacity-80 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-flash-accent rounded-sm animate-pulse"></span>
                    <ReactiveText template={header?.subtitle} ctx={ctx} as="span" />
                </div>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => useAppStore.getState().toggleUi('focusMode')} 
                    className={`h-12 w-12 rounded-full flex items-center justify-center border transition-all ${isFocusMode ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'}`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </button>
                {(header?.actions || []).map((a: any, i: number) => (
                    <div key={i} className="min-w-[140px] hidden sm:block">{renderNode({ type: "Button", ...a }, ctx)}</div>
                ))}
            </div>
        </div>
      </div>

      {/* Mobile/Tablet View Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-2 relative transition-all duration-500">
        
        {/* Left Rail (Desktop: col 1-3, Mobile: Toggleable) */}
        <div className={`
            lg:col-span-3 space-y-8 transition-all duration-500 
            ${isFocusMode ? 'lg:-translate-x-full lg:opacity-0 lg:absolute' : ''}
            ${mobileView === 'agents' ? 'block animate-[fadeIn_0.3s]' : 'hidden lg:block lg:sticky lg:top-36'}
        `}>
          <div className="bg-flash-surface/50 border border-white/5 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-xl">
            <AgentsRail {...left} ctx={ctx} />
            {left?.secondary && renderNode(left.secondary, ctx)}
          </div>
        </div>

        {/* Center Canvas (Desktop: col 4-9, Mobile: Toggleable) */}
        <div className={`
            min-h-[60vh] transition-all duration-500
            ${isFocusMode ? 'lg:col-span-12' : 'lg:col-span-6'}
            ${mobileView === 'canvas' ? 'block animate-[fadeIn_0.3s]' : 'hidden lg:block'}
        `}>
          <div className="bg-flash-surface/30 border border-white/5 rounded-[3rem] p-1 shadow-2xl backdrop-blur-xl h-full">
            <div className="h-full rounded-[2.8rem] bg-black/20 p-4 sm:p-8 border border-white/5">
                {renderNode(center, ctx)}
            </div>
          </div>
        </div>

        {/* Right Inspector (Desktop: col 10-12, Mobile: Toggleable) */}
        <div className={`
            lg:col-span-3 space-y-8 transition-all duration-500
            ${isFocusMode ? 'lg:translate-x-full lg:opacity-0 lg:absolute lg:right-0' : ''}
            ${mobileView === 'inspector' ? 'block animate-[fadeIn_0.3s]' : 'hidden lg:block lg:sticky lg:top-36'}
        `}>
             <Inspector {...right} ctx={ctx} />
        </div>
      </div>

      {/* Mobile Bottom Floating Dock Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 lg:hidden">
          <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/10 rounded-full p-2 flex items-center shadow-2xl gap-1">
              <button 
                onClick={() => setMobileView('agents')}
                className={`p-3 rounded-full transition-all ${mobileView === 'agents' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </button>
              <button 
                onClick={() => setMobileView('canvas')}
                className={`p-3 rounded-full transition-all ${mobileView === 'canvas' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
              </button>
              <button 
                onClick={() => setMobileView('inspector')}
                className={`p-3 rounded-full transition-all ${mobileView === 'inspector' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </button>
              {/* Integrated Voice Control for Mobile */}
              <div className="pl-2 border-l border-white/10 ml-1">
                  <VoiceControl isMobile={true} />
              </div>
          </div>
      </div>
    </div>
  );
};

// --- Main Recursive Renderer ---

export const renderNode = (node: UiNode, ctx: Ctx): React.ReactNode => {
  if (!node) return null;
  const t = node.type;
  
  // Recursively render children
  const children = node.children?.map((c: any, i: number) => (
    <React.Fragment key={i}>{renderNode(c, ctx)}</React.Fragment>
  ));

  switch (t) {
    case "Stack": return <Stack {...node}>{children}</Stack>;
    case "Grid": return <Grid {...node}>{children}</Grid>;
    case "Card": return <Card {...node} ctx={ctx}>{children}</Card>;
    case "TextInput": return <TextInput {...node} ctx={ctx} />;
    case "StatsCard": return <StatsCard {...node} ctx={ctx} />;
    case "Button": return <Button {...node} ctx={ctx} />;
    case "Workspace3Pane": return <Workspace3Pane {...node} ctx={ctx} />;
    case "ArtifactsExplorer": return <ArtifactsExplorer {...node} ctx={ctx} />;
    case "AgentsRail": return <AgentsRail {...node} ctx={ctx} />;
    case "Canvas": return <Canvas {...node} ctx={ctx} />;
    case "Inspector": return <Inspector {...node} ctx={ctx} />;
    case "Timeline": return <Timeline {...node} ctx={ctx} />;
    default: return null;
  }
};