import React, { useState, useEffect, useRef } from "react";
import { UiNode, Ctx } from "../types";
import { interpolate } from "./bindings";
import { useAppStore } from "../store/useAppStore";
import flow from "../config/app.flow";
import { runAction } from "./actions";
import { evalExpr } from "./guards";
import { eventBus } from "./eventBus";
import { useNavigate } from "react-router-dom";

// --- Style Mappings ---
const GAP_MAP: Record<number, string> = {
  1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 5: "gap-5", 6: "gap-6", 8: "gap-8", 10: "gap-10", 12: "gap-12"
};

const COL_MAP: Record<number, string> = {
  1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 12: "md:grid-cols-12"
};

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

// --- UI Primitives ---

const Stack: React.FC<any> = ({ gap = 4, children }) => {
  const gapClass = GAP_MAP[gap] || "gap-4";
  return <div className={`flex flex-col ${gapClass}`}>{children}</div>;
};

const Grid: React.FC<any> = ({ gap = 4, columns = 1, children }) => {
  const gapClass = GAP_MAP[gap] || "gap-4";
  const colClass = COL_MAP[columns] || "md:grid-cols-1";
  return <div className={`grid grid-cols-1 ${colClass} ${gapClass}`}>{children}</div>;
};

const ReactiveText: React.FC<any> = ({ template, ctx, className, as: Tag = "div" }) => {
  const value = useAppStore((state) => {
      const v = interpolate(template, ctx, state);
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
  });
  return <Tag className={className}>{value}</Tag>;
};

const Card: React.FC<any> = ({ title, children, ctx }) => (
  <div className="bg-flash-surface/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-8 shadow-2xl transition-all duration-500 hover:border-white/10 hover:shadow-black/50 group relative overflow-hidden">
    {title && (
      <div className="font-bold text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-3 relative z-10">
         <div className="w-1.5 h-1.5 rounded-full bg-flash-accent/50 group-hover:bg-flash-accent group-hover:shadow-[0_0_8px_rgba(22,198,12,0.8)] transition-all"></div>
         <ReactiveText template={title} ctx={ctx} as="span" />
      </div>
    )}
    <div className="relative z-10">{children}</div>
  </div>
);

const Button: React.FC<any> = ({ label, variant, onClick, ctx }) => {
  const isPrimary = variant === "primary";
  const baseClass = "w-full py-4 px-8 rounded-full font-bold text-[10px] uppercase tracking-[0.2em] transition-all duration-300 active:scale-95 flex items-center justify-center gap-3";
  const styleClass = isPrimary 
    ? "bg-flash-accent text-white hover:bg-[#1ae010] hover:shadow-[0_0_30px_rgba(22,198,12,0.3)] shadow-[0_0_15px_rgba(22,198,12,0.1)]" 
    : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5 hover:text-white backdrop-blur-md";
    
  const resolvedLabel = useAppStore((s) => interpolate(label, ctx, s));

  const handleClick = () => {
    if (onClick?.$action) {
      const def = (flow.actions as any)[onClick.$action];
      runAction(def, { ...ctx, params: onClick.params });
    }
  };

  return (
    <button className={`${baseClass} ${styleClass}`} onClick={handleClick}>
       {resolvedLabel}
    </button>
  );
};

const TextInput: React.FC<any> = ({ label, path, placeholder, ctx }) => {
  const val = useAppStore(s => s.getPath(path));
  const setPath = useAppStore(s => s.setPath);
  
  return (
    <div className="flex flex-col gap-3">
      {label && <label className="text-[9px] uppercase font-bold text-gray-500 pl-4 tracking-widest opacity-60">{label}</label>}
      <input 
        type="text" 
        value={val || ""} 
        onChange={(e) => setPath(path, e.target.value)}
        placeholder={placeholder}
        className="bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-flash-accent/30 focus:bg-black/40 text-white placeholder-gray-700 transition-all font-medium"
      />
    </div>
  );
};

const StatsCard: React.FC<any> = ({ label, value, ctx }) => (
    <div className="bg-white/[0.03] rounded-[2rem] p-6 flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group hover:bg-white/[0.05] transition-colors">
        <div className="text-3xl font-black text-white z-10 tracking-tight">
            <ReactiveText template={value} ctx={ctx} as="span" />
        </div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-gray-600 mt-2 z-10 font-bold group-hover:text-gray-400 transition-colors">{label}</div>
    </div>
);

// --- Complex Blocks ---

// Toast System
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

// Global Command Palette
export const CommandPalette: React.FC = () => {
    const isOpen = useAppStore(s => s.data.ui?.commandPaletteOpen);
    const toggle = useAppStore(s => s.toggleUi);
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Close on escape
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

// Global Terminal
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
        <div className="fixed bottom-0 left-0 right-0 h-48 bg-[#0a0a0a] border-t border-white/10 z-[40] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col">
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

            <button 
                className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
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
    );
};

const AgentsRail: React.FC<any> = ({ agents = [], ctx }) => {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-5 px-4">Operations Team</div>
      <div className="space-y-3">
        {agents.map((a: any) => {
          if (!a) return null;
          return <AgentItem key={a.name} agent={a} ctx={ctx} />;
        })}
      </div>
    </div>
  );
};

const ArtifactsExplorer: React.FC<any> = ({ bind, onOpen, ctx }) => {
  const data = useAppStore((s) => (bind ? s.getPath(bind) : [])) || [];
  const selectedId = useAppStore(s => s.getPath("workspace.selectedArtifactId"));
  const setPath = useAppStore(s => s.setPath);

  return (
    <div className="mt-10 space-y-3">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 px-4 mb-5">Generated Artifacts</div>
      {data.length === 0 ? (
        <div className="text-xs opacity-20 border-2 border-dashed border-white/5 rounded-3xl p-8 text-center mx-2 font-mono">
          No artifacts yet.
        </div>
      ) : (
        data.map((a: any) => {
          if (!a) return null;
          return (
            <button
              key={a.id}
              className={`w-full text-left px-5 py-4 rounded-[1.5rem] border transition-all duration-300 group relative overflow-hidden
                  ${selectedId === a.id ? 'bg-flash-accent/5 border-flash-accent/30 shadow-[0_0_20px_rgba(22,198,12,0.05)]' : 'bg-white/[0.02] border-transparent hover:border-white/5 hover:bg-white/[0.04]'}
              `}
              onClick={() => {
                if (onOpen?.$action) {
                  const def = (flow.actions as any)[onOpen.$action];
                  const resolvedParams = interpolate(onOpen.params || {}, { ...ctx, item: a });
                  runAction(def, { ...ctx, item: a, params: resolvedParams });
                } else {
                  setPath("workspace.selectedArtifactId", a.id);
                }
              }}
            >
              <div className="flex justify-between items-center relative z-10 mb-2">
                  <div className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{a.title}</div>
                  <div className="text-[8px] uppercase opacity-40 bg-white/5 px-2 py-1 rounded-md font-bold tracking-widest">{a.kind}</div>
              </div>
              <div className="text-[9px] opacity-30 font-mono text-gray-400 truncate relative z-10 pl-0.5">{a.id}</div>
            </button>
          );
        })
      )}
    </div>
  );
};

const ChecklistItem: React.FC<{ item: any }> = ({ item }) => {
    const v = useAppStore((s) => s.getPath(item.path));
    return (
        <div className="flex items-center justify-between text-xs bg-white/[0.02] px-4 py-3 rounded-2xl border border-transparent hover:border-white/5 transition-all">
            <span className="opacity-60 font-medium tracking-wide">{item.label}</span>
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${v ? "bg-flash-accent shadow-[0_0_8px_rgba(22,198,12,0.6)] scale-110" : "bg-red-500/20"}`}></div>
        </div>
    );
};

const Inspector: React.FC<any> = ({ sections = [] }) => {
  const warnings = useAppStore((s) => s.getPath("workspace.warnings")) || [];
  const errors = useAppStore((s) => s.getPath("workspace.errors")) || [];

  return (
    <div className="space-y-6">
      {sections.map((sec: any, i: number) => {
        if (!sec) return null;
        if (sec.type === "Status") {
          return (
            <div key={i} className="p-6 rounded-[2rem] bg-black/20 border border-white/5 backdrop-blur-xl">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50 mb-6 flex items-center gap-3">
                 <div className="w-1.5 h-1.5 bg-flash-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(22,198,12,0.8)]"></div>
                 System Health
              </div>
              <div className="flex justify-between text-xs py-3 border-b border-white/5 items-center">
                <span className="text-gray-500 font-medium">Warnings</span>
                <span className={`font-mono font-bold px-2 py-1 rounded text-[10px] ${warnings.length > 0 ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-600'}`}>{warnings.length}</span>
              </div>
              <div className="flex justify-between text-xs py-3 items-center mt-1">
                <span className="text-gray-500 font-medium">Errors</span>
                <span className={`font-mono font-bold px-2 py-1 rounded text-[10px] ${errors.length > 0 ? 'bg-red-500/20 text-red-500' : 'text-gray-600'}`}>{errors.length}</span>
              </div>
            </div>
          );
        }
        if (sec.type === "Checklist") {
          return (
            <div key={i} className="p-6 rounded-[2rem] bg-black/20 border border-white/5 backdrop-blur-xl">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50 mb-6">{sec.title}</div>
              <div className="space-y-2">
                {sec.items.map((it: any) => (
                    <ChecklistItem key={it.id} item={it} />
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

const ArtifactEditor: React.FC<{ artifact: any; onSaveAction: any; ctx: any }> = ({ artifact, onSaveAction, ctx }) => {
  const [draft, setDraft] = useState(() => JSON.stringify(artifact.data, null, 2));
  const [mode, setMode] = useState<'edit'|'preview'>('edit');
  const [showExport, setShowExport] = useState(false);

  React.useEffect(() => {
    setDraft(JSON.stringify(artifact.data, null, 2));
  }, [artifact.id]);

  // Determine if it is an image artifact based on 'kind' or data structure
  const isImage = artifact.kind === 'image' || (artifact.data && (artifact.data.url || artifact.data.base64));

  const handleExport = (format: string) => {
    setShowExport(false);
    try {
        const data = JSON.parse(draft);
        const filename = `${artifact.title.replace(/\s+/g, '_')}_${Date.now()}`;

        if (format === 'json') {
            downloadFile(`${filename}.json`, draft, 'application/json');
        } else if (format === 'md') {
            const md = jsonToMarkdown(data);
            downloadFile(`${filename}.md`, md, 'text/markdown');
        } else if (format === 'txt') {
             // Simple flatten
            const txt = JSON.stringify(data, null, 2);
            downloadFile(`${filename}.txt`, txt, 'text/plain');
        }

        eventBus.emit('ui.notify', { type: 'success', message: `Exported as ${format.toUpperCase()}` });
    } catch(e) {
        eventBus.emit('ui.notify', { type: 'error', message: 'Failed to export' });
    }
  };

  // Preview Renderer
  const renderPreview = (jsonString: string) => {
    try {
        const obj = JSON.parse(jsonString);
        
        // Image Mode
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
                            onClick={() => downloadFile(`image_${artifact.id}.png`, src, 'image/png')} // Note: this works for Data URLs directly
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download PNG
                        </button>
                    </div>
                </div>
            );
        }

        // Text/Data Mode
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
      {/* Editor Header Toolbar */}
      <div className="absolute -top-14 right-0 z-30 flex gap-2 items-center">
          {/* View Toggle */}
          <div className="bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5 flex gap-1 shadow-xl">
            <button 
                onClick={() => setMode('edit')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${mode === 'edit' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}>
                Code
            </button>
            <button 
                onClick={() => setMode('preview')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${mode === 'preview' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}>
                Preview
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
              <button 
                  onClick={() => setShowExport(!showExport)}
                  className="bg-flash-accent/10 hover:bg-flash-accent/20 text-flash-accent border border-flash-accent/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 backdrop-blur-md"
              >
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

      <div className="flex-1 mt-0 overflow-hidden relative rounded-[2rem] bg-black/20 border border-white/5">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
            {mode === 'edit' ? (
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full min-h-full bg-transparent border-none outline-none text-xs font-mono text-gray-300 resize-none leading-relaxed selection:bg-flash-accent/30 placeholder-white/10"
                    spellCheck={false}
                    placeholder="// JSON Data..."
                />
            ) : (
                renderPreview(draft)
            )}
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center opacity-50 hover:opacity-100 transition-opacity">
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest pl-2">
            {mode === 'edit' ? 'Editing Mode' : 'Read-Only Mode'}
        </div>
        <button
          className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-flash-accent hover:text-white text-gray-400 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105"
          onClick={() => {
            let nextData: any;
            try {
              nextData = JSON.parse(draft);
            } catch (e) {
              eventBus.emit('ui.notify', { type: 'error', message: 'Invalid JSON' });
              return;
            }
            const patch = [{ op: "set", path: "data", value: nextData }];
            if (onSaveAction?.$action) {
              const def = (flow.actions as any)[onSaveAction.$action];
              runAction(def, { ...ctx, params: { artifactId: artifact.id, patch } });
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

const Canvas: React.FC<any> = ({ tabs = [], selectedTabPath, editor, emptyState, ctx }) => {
  const selectedTab = useAppStore((s) => s.getPath(selectedTabPath)) || tabs?.[0]?.id;
  
  // Safe selector
  const isEmpty = useAppStore(s => {
      if (!emptyState) {
          const a = s.getPath("workspace.artifacts");
          return !a || a.length === 0;
      }
      if (emptyState.when) return evalExpr(emptyState.when, ctx, s);
      const a = s.getPath("workspace.artifacts");
      return !a || a.length === 0;
  });

  const selectedArtifactId = useAppStore((s) => s.getPath(editor?.artifactIdPath));
  const artifact = useAppStore((s) => {
     const id = s.getPath(editor?.artifactIdPath);
     const arts = s.getPath("workspace.artifacts") || [];
     return arts.find((a: any) => a.id === id);
  });
  
  const shouldShowEmpty = emptyState && isEmpty;

  if (shouldShowEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-gradient-to-b from-white/[0.02] to-transparent rounded-[3rem] border-2 border-dashed border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent_70%)] pointer-events-none" />
        <div className="w-24 h-24 bg-white/[0.03] rounded-full flex items-center justify-center mb-8 ring-1 ring-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <svg className="w-10 h-10 opacity-30 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        </div>
        <div className="text-3xl font-black text-white mb-4 tracking-tight drop-shadow-xl">{emptyState.title}</div>
        <div className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed mb-10">{emptyState.text}</div>
        <div>
          <button
            className="px-10 py-4 rounded-full bg-flash-accent text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_40px_rgba(22,198,12,0.2)] hover:scale-105 transition-all duration-300 ring-4 ring-flash-accent/10 hover:ring-flash-accent/20"
            onClick={() => {
              const def = (flow.actions as any)[emptyState.primary.onClick.$action];
              runAction(def, { ...ctx, params: emptyState.primary.onClick.params });
            }}
          >
            {emptyState.primary.label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex gap-3 pb-6 border-b border-white/5 overflow-x-auto no-scrollbar mask-gradient-right">
        {tabs.map((t: any) => (
          <button
            key={t.id}
            className={`px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border transition-all whitespace-nowrap ${
              selectedTab === t.id
                ? "bg-flash-accent text-white border-flash-accent shadow-[0_0_20px_rgba(22,198,12,0.2)]"
                : "bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10 hover:bg-white/10"
            }`}
            onClick={() => useAppStore.getState().setPath(selectedTabPath, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 mt-8 grid grid-cols-1 gap-6">
        <div className="bg-flash-surface/50 border border-white/5 rounded-[3rem] p-2 flex flex-col relative overflow-hidden group shadow-2xl backdrop-blur-xl">
            <div className="flex justify-between items-center px-8 py-5 border-b border-white/5 bg-white/[0.02] rounded-t-[2.5rem]">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                    Artifact View <span className="mx-2 opacity-20">/</span> <span className="font-mono opacity-60 text-white tracking-normal">{selectedArtifactId || "Empty"}</span>
                </div>
            </div>
            
            <div className="flex-1 p-4 min-h-[400px]">
                {!artifact ? (
                    <div className="h-full flex items-center justify-center text-sm opacity-30 font-mono">Select an artifact from the left rail.</div>
                ) : (
                    <ArtifactEditor artifact={artifact} onSaveAction={editor?.onSave} ctx={ctx} />
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const Workspace3Pane: React.FC<any> = ({ header, left, center, right, ctx }) => {
  const isFocusMode = useAppStore(s => s.data.ui?.focusMode);
  
  return (
    <div className="max-w-[1800px] mx-auto pb-48">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-flash-bg/90 backdrop-blur-xl py-6 border-b border-white/5 mb-10 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4">
            <div>
                <h1 className="text-4xl font-black tracking-tighter text-white drop-shadow-2xl">
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
                    <div key={i} className="min-w-[140px]">{renderNode({ type: "Button", ...a }, ctx)}</div>
                ))}
            </div>
        </div>
      </div>

      {/* 3 Panes Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-2 relative transition-all duration-500">
        {/* Left Rail */}
        <div className={`lg:col-span-3 space-y-8 sticky top-36 transition-all duration-500 ${isFocusMode ? '-translate-x-full opacity-0 absolute' : 'opacity-100'}`}>
          <div className="bg-flash-surface/50 border border-white/5 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-xl">
            <AgentsRail {...left} ctx={ctx} />
            {left?.secondary && renderNode(left.secondary, ctx)}
          </div>
        </div>

        {/* Center Canvas */}
        <div className={`min-h-[700px] transition-all duration-500 ${isFocusMode ? 'lg:col-span-12' : 'lg:col-span-6'}`}>
          <div className="bg-flash-surface/30 border border-white/5 rounded-[3rem] p-1 shadow-2xl backdrop-blur-xl h-full">
            <div className="h-full rounded-[2.8rem] bg-black/20 p-8 border border-white/5">
                {renderNode(center, ctx)}
            </div>
          </div>
        </div>

        {/* Right Inspector */}
        <div className={`lg:col-span-3 sticky top-36 space-y-8 transition-all duration-500 ${isFocusMode ? 'translate-x-full opacity-0 absolute right-0' : 'opacity-100'}`}>
             <Inspector {...right} ctx={ctx} />
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
    default: return null;
  }
};