import { useAppStore } from "../store/useAppStore";
import { Ctx } from "../types";

export const resolvePath = (path: string, ctx: Ctx, state?: any) => {
  if (!path) return undefined;
  
  if (path.startsWith("route.params.")) {
    const key = path.replace("route.params.", "");
    return ctx.route?.params?.[key];
  }
  if (path.startsWith("item.")) {
    return ctx.item?.[path.replace("item.", "")];
  }
  if (path.startsWith("params.")) {
    return ctx.params?.[path.replace("params.", "")];
  }
  if (path === "value") return ctx.value;

  const store = state || useAppStore.getState();
  
  if (path.endsWith(".length")) {
    const base = path.replace(".length", "");
    const arr = store.getPath(base);
    return Array.isArray(arr) ? arr.length : 0;
  }

  return store.getPath(path);
};

export const interpolate = (template: any, ctx: Ctx, state?: any): any => {
  if (template === null || template === undefined) return template;

  if (typeof template === "string") {
    const exact = template.match(/^\{\{\s*(.+?)\s*\}\}$/);
    if (exact) {
      return resolvePath(exact[1], ctx, state);
    }

    return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
      const v = resolvePath(expr.trim(), ctx, state);
      return v == null ? "" : String(v);
    });
  }

  if (Array.isArray(template)) {
    return template.map((item) => interpolate(item, ctx, state));
  }

  // Handle object interpolation recursively, but guard against cyclic deps if needed (not here for now)
  if (typeof template === "object") {
    const res: any = {};
    for (const key in template) {
      res[key] = interpolate(template[key], ctx, state);
    }
    return res;
  }

  return template;
};