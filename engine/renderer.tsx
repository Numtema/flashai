import React, { useState } from "react";
import { UiNode, Ctx } from "../types";
import { interpolate } from "./bindings";
import { useAppStore } from "../store/useAppStore";
import flow from "../config/app.flow";
import { runAction } from "./actions";
import { evalExpr } from "./guards";

// --- UI Primitives ---

const Stack: React.FC<any> = ({ gap = 4, children }) => (
  <div className={`flex flex-col gap-${gap}`}>{children}</div>
);

const Grid: React.FC<any> = ({ gap = 4, columns = 1, children }) => (
  <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-${gap}`}>{children}</div>
);

const ReactiveText: React.FC<any> = ({ template, ctx, className, as: Tag = "div" }) => {
  const value = useAppStore((state) => {
      const v = interpolate(template, ctx, state);
      // Safety: convert objects to string to prevent React child errors
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
    
  const handleClick = () => {
    if (onClick?.$action) {
      const def = (flow.actions as any)[onClick.$action];
      runAction(def, { ...ctx, params: onClick.params });
    }
  };

  return (
    <button className={`${baseClass} ${styleClass}`} onClick={handleClick}>
       {label}
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

const AgentItem: React.FC<any> = ({ agent, ctx }) => {
    const status = useAppStore(s => s.getPath(agent.statusPath)) || 'idle';
    const isRunning = status === 'running';
    const isDone = status === 'done';

    return (
        <div className="flex items-center justify-between gap-4 p-4 rounded-[1.5rem] bg-black/20 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isRunning ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-pulse' : isDone ? 'bg-flash-accent shadow-[0_0_10px_rgba(22,198,12,0.4)]' : 'bg-gray-700'}`} />
                </div>
                <div>
                    <div className="text-xs font-bold text-gray-200 capitalize tracking-wide group-hover:text-white transition-colors">{agent.name}</div>
                    <div className="text-[9px] opacity-40 mt-1 font-mono uppercase tracking-widest">{status}</div>
                </div>
            </div>
            <button 
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                    ${isRunning ? 'opacity-30 cursor-not-allowed text-white' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}
                `}
                disabled={isRunning}
                onClick={() => {
                if (!isRunning) {
                    const def = (flow.actions as any)[agent.primaryAction.onClick.$action];
                    runAction(def, { ...ctx, params: agent.primaryAction.onClick.params });
                }
                }}
            >
                {isRunning ? "Running" : agent.primaryAction.label}
            </button>
        </div>
    );
};

const AgentsRail: React.FC<any> = ({ agents = [], ctx }) => {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-5 px-4">Available Agents</div>
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
                setPath("workspace.selectedArtifactId", a.id);
                if (onOpen?.$action) {
                  const def = (flow.actions as any)[onOpen.$action];
                  runAction(def, { ...ctx, params: { artifactId: a.id } });
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
                {sec.items.map((it: any) => {
                  const v = useAppStore((s) => s.getPath(it.path));
                  return (
                    <div key={it.id} className="flex items-center justify-between text-xs bg-white/[0.02] px-4 py-3 rounded-2xl border border-transparent hover:border-white/5 transition-all">
                      <span className="opacity-60 font-medium tracking-wide">{it.label}</span>
                      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${v ? "bg-flash-accent shadow-[0_0_8px_rgba(22,198,12,0.6)] scale-110" : "bg-red-500/20"}`}></div>
                    </div>
                  );
                })}
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

  React.useEffect(() => {
    setDraft(JSON.stringify(artifact.data, null, 2));
  }, [artifact.id]);

  return (
    <div className="flex flex-col h-full">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full flex-1 bg-black/40 border border-white/5 rounded-[1.5rem] p-6 text-xs font-mono outline-none focus:border-flash-accent/20 focus:bg-black/60 text-gray-300 resize-none leading-relaxed shadow-inner transition-all selection:bg-flash-accent/30"
        spellCheck={false}
      />
      <div className="mt-6 flex justify-end">
        <button
          className="px-8 py-3 rounded-full bg-flash-accent text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#1ae010] transition-all hover:scale-105 shadow-[0_10px_30px_-10px_rgba(22,198,12,0.4)]"
          onClick={() => {
            let nextData: any;
            try {
              nextData = JSON.parse(draft);
            } catch (e) {
              alert("Invalid JSON");
              return;
            }
            const patch = [{ op: "set", path: "data", value: nextData }];
            if (onSaveAction?.$action) {
              const def = (flow.actions as any)[onSaveAction.$action];
              runAction(def, { ...ctx, params: { artifactId: artifact.id, patch } });
            }
          }}
        >
          Save Changes
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
  return (
    <div className="max-w-[1800px] mx-auto pb-12">
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
                {(header?.actions || []).map((a: any, i: number) => (
                    <div key={i} className="min-w-[140px]">{renderNode({ type: "Button", ...a }, ctx)}</div>
                ))}
            </div>
        </div>
      </div>

      {/* 3 Panes Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-2">
        {/* Left Rail */}
        <div className="lg:col-span-3 space-y-8 sticky top-36">
          <div className="bg-flash-surface/50 border border-white/5 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-xl">
            <AgentsRail {...left} ctx={ctx} />
            {left?.secondary && renderNode(left.secondary, ctx)}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="lg:col-span-6 min-h-[700px]">
          <div className="bg-flash-surface/30 border border-white/5 rounded-[3rem] p-1 shadow-2xl backdrop-blur-xl h-full">
            <div className="h-full rounded-[2.8rem] bg-black/20 p-8 border border-white/5">
                {renderNode(center, ctx)}
            </div>
          </div>
        </div>

        {/* Right Inspector */}
        <div className="lg:col-span-3 sticky top-36 space-y-8">
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