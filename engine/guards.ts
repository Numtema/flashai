import { resolvePath } from "./bindings";
import { Ctx } from "../types";

// Safe-ish evaluator for expressions like "workspace.status == 'DONE'"
export const evalExpr = (expr: string, ctx: Ctx, state?: any): boolean => {
  if (!expr) return true;

  // Replace paths in the expression with their actual values (serialized)
  // Logic: Find words that look like paths (contain dots or start with known roots)
  const replaced = expr.replace(
    /([a-zA-Z_][a-zA-Z0-9_.]*)(\s*\.length)?/g,
    (match) => {
      // Ignore JS keywords and numbers
      if (["true", "false", "null", "undefined"].includes(match)) return match;
      if (/^\d+$/.test(match)) return match;
      if (match.startsWith("'") || match.startsWith('"')) return match;

      // Check if it looks like a known state path
      const looksLikePath =
        match.includes(".") ||
        match.startsWith("workspace") ||
        match.startsWith("app") ||
        match.startsWith("draftIntake") ||
        match.startsWith("route") ||
        match.startsWith("item");

      if (!looksLikePath) return match;

      const v = resolvePath(match, ctx, state);
      // Serialize value for JS execution
      return JSON.stringify(v);
    }
  );

  try {
    // Limited sandbox
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${replaced});`)());
  } catch (e) {
    console.warn("Guard eval error:", expr, e);
    return false;
  }
};