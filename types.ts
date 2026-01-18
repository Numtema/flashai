export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface Artifact {
  id: string;
  kind: string;
  title: string;
  defaultTab?: string;
  data: any;
}

export interface WorkspaceState {
  prospectId?: string;
  prospectName?: string;
  status?: string;
  artifacts: Artifact[];
  selectedArtifactId?: string;
  selectedTab?: string;
  versions?: any[];
  errors?: any[];
  warnings?: any[];
  currentAgent?: string;
  stateByAgent?: Record<string, { status: 'idle' | 'running' | 'done' | 'failed' }>;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface AppState {
  workspace: WorkspaceState;
  notifications: Notification[];
  logs: LogEntry[];
  ui: {
    focusMode: boolean;
    terminalOpen: boolean;
    commandPaletteOpen: boolean;
  };
  [key: string]: any;
}

export interface ActionDef {
  type: 'navigate' | 'set' | 'command';
  params?: any;
  effects?: Array<{
    op: 'set' | 'push' | 'dispatch';
    path?: string;
    value?: any;
    target?: string;
    payload?: any;
  }>;
}

export interface UiNode {
  type: string;
  id?: string;
  children?: UiNode[];
  [key: string]: any;
}

export interface ScreenNode {
  id: string;
  type: 'Page';
  title?: string;
  onEnter?: Array<{ op: 'action'; name: string; params?: any }>;
  layout: UiNode;
}

export interface AppFlow {
  app: {
    id: string;
    name: string;
    routing: {
      initialRoute: string;
      routes: Array<{ path: string; screenId: string }>;
    };
  };
  state?: {
    stores: Record<string, any>;
  };
  actions?: Record<string, ActionDef>;
  screens: ScreenNode[];
}

export type Ctx = {
  item?: any;
  value?: any;
  route?: { params: Record<string, string> };
  navigate?: (to: string) => void;
  params?: any;
};