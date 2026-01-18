import { useAppStore } from "../store/useAppStore";
import { interpolate } from "./bindings";
import { eventBus } from "./eventBus";
import { ActionDef, Ctx } from "../types";

type RunCtx = Ctx;

export const runAction = (actionDef: ActionDef, ctx: RunCtx) => {
  if (!actionDef) return;

  const store = useAppStore.getState();
  const effects = actionDef.effects || [];

  for (const eff of effects) {
    if (eff.op === "set" && eff.path) {
      store.setPath(eff.path, interpolate(eff.value, ctx));
    }
    
    if (eff.op === "push" && eff.path) {
      store.pushPath(eff.path, interpolate(eff.value, ctx));
    }
    
    if (eff.op === "dispatch" && eff.target) {
      const payload = eff.payload ? interpolate(eff.payload, ctx) : {};
      
      // If dispatching navigation, handle it via ctx callback if available
      if (eff.target === "navigate") {
         const to = payload.to;
         if (to && ctx.navigate) ctx.navigate(to);
      } else {
         eventBus.emit(eff.target, payload);
      }
    }
  }

  if (actionDef.type === "navigate") {
    const to = interpolate(actionDef.params?.to || ctx.route?.params?.to, ctx);
    ctx.navigate?.(to);
  }
};