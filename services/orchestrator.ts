import { GoogleGenAI } from "@google/genai";
import { Artifact } from "../types";

export type OrchestratorClient = {
  run: (prospectId: string) => Promise<any>;
  runAgent: (prospectId: string, agentName: string) => Promise<{ ok: boolean, prospectId: string, agentName: string, artifacts: Artifact[] }>;
};

// Mock implementation for fallback or offline dev
const mock: OrchestratorClient = {
  async run(prospectId) {
    return { ok: true, prospectId };
  },
  async runAgent(prospectId, agentName) {
    await new Promise((r) => setTimeout(r, 1500));
    
    // Mock Data Generators
    const mockData = agentName === 'scraper' 
        ? { 
            company: "Acme Corp (Mock)", 
            foundingYear: 2024, 
            industry: "Explosives",
            summary: "Leading provider of anvils and coyote countermeasures.",
            metrics: { employees: 150, revenue: "$50M" }
          }
        : { 
            headline: "Catch the Roadrunner.", 
            subheadline: "Precision tools for the modern predator.", 
            heroBody: "Stop failing at lunch. Start succeeding with Acme.", 
            features: ["Reliable Anvils", "Fast Rockets", "Free Shipping"],
            callToAction: "Shop Now" 
          };

    return {
      ok: true,
      prospectId,
      agentName,
      artifacts: [{
        id: `mock_${crypto.randomUUID().slice(0,6)}`,
        kind: agentName === 'scraper' ? 'data' : 'copy',
        title: `${agentName === 'scraper' ? 'Company Data' : 'Marketing Copy'} (Mock)`,
        defaultTab: agentName === 'scraper' ? 'profile' : 'copy',
        data: mockData
      }],
    };
  },
};

// Real Gemini Implementation
async function generateWithGemini(prospectId: string, agentName: string): Promise<Artifact> {
    if (!process.env.API_KEY) throw new Error("API Key not configured");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let sysInstruct = "You are a specialized AI agent for a B2B SaaS platform.";
    let userPrompt = `Context: ${prospectId}. Task: Run agent ${agentName}.`;

    if (agentName === 'scraper') {
        sysInstruct = "You are an expert business intelligence analyst. Your goal is to generate realistic, structured company profiles based on a name or ID.";
        userPrompt = `Analyze the prospect ID "${prospectId}". 
                      If it matches a known real-world company, infer accurate data. 
                      If it appears generic, invent a highly realistic B2B SaaS or Tech company profile.
                      
                      Output strictly valid JSON (no markdown fences).
                      Schema: 
                      { 
                        "company": "string", 
                        "foundingYear": number, 
                        "industry": "string", 
                        "summary": "string", 
                        "metrics": { "employees": number, "revenue": "string" },
                        "key_technologies": ["string"]
                      }`;
    } else if (agentName === 'copywriter') {
        sysInstruct = "You are a world-class marketing copywriter. You write punchy, high-conversion landing page copy.";
        userPrompt = `Generate a marketing copy package for the company "${prospectId}".
                      Tone: Professional, Innovative, yet accessible.
                      
                      Output strictly valid JSON (no markdown fences).
                      Schema: 
                      { 
                        "headline": "string (Under 10 words)", 
                        "subheadline": "string (Under 20 words)", 
                        "heroBody": "string (2-3 sentences)", 
                        "features": ["string", "string", "string"], 
                        "callToAction": "string" 
                      }`;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
            systemInstruction: sysInstruct,
            responseMimeType: "application/json",
            temperature: 0.7
        }
    });

    const text = response.text || "{}";
    let data = {};
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error", e);
        data = { error: "Failed to parse model output", raw: text };
    }

    return {
        id: `art_${crypto.randomUUID().slice(0,8)}`,
        kind: agentName === 'scraper' ? 'data' : 'copy',
        title: agentName === 'scraper' ? 'Company Profile' : 'Marketing Draft',
        defaultTab: agentName === 'scraper' ? 'profile' : 'copy',
        data
    };
}

export const orchestrator = {
  async run(prospectId: string) {
    return { ok: true, prospectId };
  },
  
  async runAgent(prospectId: string, agentName: string) {
    // Smart Fallback: Check for API Key validity before calling Gemini
    if (!process.env.API_KEY || process.env.API_KEY.includes("placeholder")) {
        console.warn("[Orchestrator] No valid API_KEY found. Falling back to Mock Agent.");
        return mock.runAgent(prospectId, agentName);
    }

    try {
        const artifact = await generateWithGemini(prospectId, agentName);
        return {
            ok: true,
            prospectId,
            agentName,
            artifacts: [artifact]
        };
    } catch (error) {
        console.error("[Orchestrator] Gemini Error:", error);
        // Fallback on error ensures the UI doesn't break during demos
        return mock.runAgent(prospectId, agentName);
    }
  }
};