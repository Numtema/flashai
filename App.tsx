import React, { useEffect, useMemo } from "react";
import { HashRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import flow from "./config/app.flow";
import { renderNode, ToastContainer, CommandPalette, Terminal, AgentSettingsModal } from "./engine/renderer";
import { useAppStore } from "./store/useAppStore";
import { eventBus } from "./engine/eventBus";
import { orchestrator } from "./services/orchestrator";
import { ScreenNode } from "./types";
import { runAction } from "./engine/actions";
import { interpolate } from "./engine/bindings";

// --- Nav Bridge (React-controlled Navigation) ---
const NavBridge = () => {
  const navigate = useNavigate();
  const pending = useAppStore((s) => s.getPath("app.pendingNavTo"));
  const setPath = useAppStore((s) => s.setPath);

  useEffect(() => {
    if (pending) {
      navigate(pending);
      setPath("app.pendingNavTo", null);
    }
  }, [pending, navigate, setPath]);

  return null;
};

// --- Generic JSON Page Component ---

const JsonScreenPage: React.FC<{ screenId: string }> = ({ screenId }) => {
  const paramsRaw = useParams();
  const navigate = useNavigate();
  const setRouteParams = useAppStore((s) => s.setRouteParams);
  const screen = flow.screens.find((s: any) => s.id === screenId) as ScreenNode;

  // Stability: Serialize params to ensure referential equality for dependencies
  const paramsString = JSON.stringify(paramsRaw);
  const params = useMemo(() => JSON.parse(paramsString), [paramsString]);

  const ctx = useMemo(() => ({ route: { params }, navigate }), [params, navigate]);

  useEffect(() => {
    // 1. Sync Router Params to Store
    const currentParams = useAppStore.getState().route.params;
    if (JSON.stringify(currentParams) !== paramsString) {
        setRouteParams(params);
    }

    // 2. Run onEnter Logic
    if (screen?.onEnter) {
        const frame = requestAnimationFrame(() => {
            for(const step of screen.onEnter!) {
                if(step.op === 'action') {
                    const actionDef = (flow.actions as any)[step.name];
                    const resolvedParams = interpolate(step.params || {}, { route: { params } } as any);
                    runAction(actionDef, { route: { params }, navigate, params: resolvedParams });
                }
            }
        });
        return () => cancelAnimationFrame(frame);
    }
  }, [screenId, paramsString, params, screen, setRouteParams, navigate]);

  if (!screen) return <div className="p-12 text-white font-mono opacity-50 text-center">Screen not found: {screenId}</div>;

  return (
    <div className="min-h-screen pt-4 px-4 sm:px-6 pb-12 max-w-[1920px] mx-auto">
      {renderNode(screen.layout, ctx)}
    </div>
  );
};

// --- Main App & Event Binding ---

export default function App() {
  const setPath = useAppStore((s) => s.setPath);
  const pushPath = useAppStore((s) => s.pushPath);
  const addNotify = useAppStore((s) => s.addNotification);

  useEffect(() => {
    const stores = flow.state?.stores || {};
    // Ensure initial state exists if not hydrated
    const currentState = useAppStore.getState().data;
    if (!currentState.workspace) {
        for (const [k, v] of Object.entries(stores)) {
            setPath(k, (v as any).initial ?? {});
        }
    }

    // Handler: app.toggleTheme
    const offTheme = eventBus.on("app.toggleTheme", () => {
        const current = useAppStore.getState().getPath("app.settings.grayscale");
        setPath("app.settings.grayscale", !current);
    });

    // Handler: ui.notify
    const offNotify = eventBus.on("ui.notify", (payload) => {
        addNotify(payload.type, payload.message);
        setTimeout(() => {
             // Cleanup if needed
        }, 3000);
    });

    // Handler: workspace.create
    const offCreate = eventBus.on("workspace.create", (payload) => {
        const id = crypto.randomUUID().split('-')[0];
        setPath("workspace.prospectId", id);
        setPath("workspace.prospectName", payload?.draft?.prospectName || "New Project");
        setPath("workspace.status", "INTAKE_RECEIVED");
        setPath("workspace.artifacts", []);
        
        setPath("app.pendingNavTo", `/workspace/${id}`);
        addNotify('success', 'Workspace initialized');
    });

    // Handler: workspace.load
    const offLoad = eventBus.on("workspace.load", (payload) => {
        setPath("workspace.prospectId", payload.prospectId);
    });

    // Handler: orchestrator.runAgent
    const offRun = eventBus.on("orchestrator.runAgent", async (payload) => {
        const { prospectId, agentName } = payload;
        
        setPath(`workspace.stateByAgent.${agentName}.status`, "running");
        setPath("workspace.currentAgent", agentName);

        try {
            const res = await orchestrator.runAgent(prospectId, agentName);
            setPath(`workspace.stateByAgent.${agentName}.status`, "done");
            
            if (Array.isArray(res?.artifacts) && res.artifacts.length) {
                for (const a of res.artifacts) {
                     pushPath("workspace.artifacts", a);
                }
                const last = res.artifacts[res.artifacts.length - 1];
                setPath("workspace.selectedArtifactId", last.id);
                setPath("workspace.selectedTab", last.defaultTab || "profile");
                addNotify('success', `Agent ${agentName} finished`);
            }
        } catch (e: any) {
             setPath(`workspace.stateByAgent.${agentName}.status`, "failed");
             pushPath("workspace.errors", { agentName, message: String(e?.message || e) });
             addNotify('error', `Agent ${agentName} failed`);
        }
    });

    // Handler: orchestrator.refineArtifact
    const offRefine = eventBus.on("orchestrator.refineArtifact", async (payload) => {
        const { artifactId, instruction } = payload;
        const store = useAppStore.getState();
        const artifact = store.data.workspace?.artifacts.find((a: any) => a.id === artifactId);
        
        if (!artifact) return;

        // Visual indicator that refinement is happening (local state in component handles it via props mostly, but we can set a flag if we want)
        // For now, relies on logs and notification on finish.
        
        try {
            const res = await orchestrator.refineArtifact(artifact, instruction);
            if (res.ok && res.data) {
                store.applyArtifactPatch(artifactId, [{ op: 'set', path: 'data', value: res.data }]);
                addNotify('success', 'Refinement applied');
            } else {
                addNotify('error', 'Refinement failed');
            }
        } catch (e) {
            addNotify('error', 'Refinement failed');
        }
    });

    // Handler: artifacts.applyPatch
    const offPatch = eventBus.on("artifacts.applyPatch", (payload) => {
        const store = useAppStore.getState();
        store.applyArtifactPatch(payload.artifactId, payload.patch);
        addNotify('success', 'Changes saved');
    });

    // Handler: versions.snapshot
    const offSnap = eventBus.on("versions.snapshot", (payload) => {
        const store = useAppStore.getState();
        const snap = {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            note: payload?.note || "Snapshot",
            workspace: structuredClone(store.getPath("workspace")),
        };
        store.pushPath("workspace.versions", snap);
        addNotify('info', 'Version snapshot created');
    });
    
    return () => {
        offCreate(); offLoad(); offRun(); offRefine(); offPatch(); offSnap(); offTheme(); offNotify();
    };

  }, []);

  // Effect: Sync Theme
  const isGrayscale = useAppStore((s) => s.getPath("app.settings.grayscale"));
  useEffect(() => {
    if (isGrayscale) {
        document.documentElement.classList.add("theme-bw");
    } else {
        document.documentElement.classList.remove("theme-bw");
    }
  }, [isGrayscale]);

  return (
    <Router>
      <NavBridge />
      <ToastContainer />
      <CommandPalette />
      <AgentSettingsModal />
      <Terminal />
      <div className="bg-flash-bg min-h-screen text-gray-200 font-sans selection:bg-flash-accent/30 selection:text-white">
        <Routes>
            <Route path="/" element={<Navigate to={flow.app.routing.initialRoute} replace />} />
            {flow.app.routing.routes.map((r: any) => (
                <Route key={r.path} path={r.path} element={<JsonScreenPage screenId={r.screenId} />} />
            ))}
            <Route path="*" element={<div className="p-20 text-center text-white opacity-50 font-mono">404 | Page Not Found</div>} />
        </Routes>
      </div>
    </Router>
  );
}