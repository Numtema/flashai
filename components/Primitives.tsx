import React from "react";
import { useAppStore } from "../store/useAppStore";
import { interpolate } from "../engine/bindings";
import { runAction } from "../engine/actions";
import flow from "../config/app.flow";
import { Ctx } from "../types";

// --- Style Constants ---
const GAP_MAP: Record<number, string> = {
  1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 5: "gap-5", 6: "gap-6", 8: "gap-8", 10: "gap-10", 12: "gap-12"
};

const COL_MAP: Record<number, string> = {
  1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 12: "md:grid-cols-12"
};

// --- Atoms ---

export const ReactiveText: React.FC<any> = ({ template, ctx, className, as: Tag = "div" }) => {
  const value = useAppStore((state) => {
      const v = interpolate(template, ctx, state);
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
  });
  return <Tag className={className}>{value}</Tag>;
};

export const Stack: React.FC<any> = ({ gap = 4, children }) => {
  const gapClass = GAP_MAP[gap] || "gap-4";
  return <div className={`flex flex-col ${gapClass}`}>{children}</div>;
};

export const Grid: React.FC<any> = ({ gap = 4, columns = 1, children }) => {
  const gapClass = GAP_MAP[gap] || "gap-4";
  const colClass = COL_MAP[columns] || "md:grid-cols-1";
  return <div className={`grid grid-cols-1 ${colClass} ${gapClass}`}>{children}</div>;
};

export const Card: React.FC<any> = ({ title, children, ctx }) => (
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

export const Button: React.FC<any> = ({ label, variant, onClick, ctx }) => {
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

export const TextInput: React.FC<any> = ({ label, path, placeholder, ctx }) => {
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

export const StatsCard: React.FC<any> = ({ label, value, ctx }) => (
    <div className="bg-white/[0.03] rounded-[2rem] p-6 flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group hover:bg-white/[0.05] transition-colors">
        <div className="text-3xl font-black text-white z-10 tracking-tight">
            <ReactiveText template={value} ctx={ctx} as="span" />
        </div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-gray-600 mt-2 z-10 font-bold group-hover:text-gray-400 transition-colors">{label}</div>
    </div>
);
