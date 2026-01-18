import { GoogleGenAI } from "@google/genai";
import { Artifact } from "../types";
import { useAppStore } from "../store/useAppStore";

export type OrchestratorClient = {
  run: (prospectId: string) => Promise<any>;
  runAgent: (prospectId: string, agentName: string) => Promise<{ ok: boolean, prospectId: string, agentName: string, artifacts: Artifact[] }>;
  refineArtifact: (artifact: Artifact, instruction: string) => Promise<{ ok: boolean, data: any }>;
};

const log = (source: string, msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    useAppStore.getState().addLog(source, msg, level);
};

// Mock implementation for fallback or offline dev
const mock: OrchestratorClient = {
  async run(prospectId) {
    return { ok: true, prospectId };
  },
  async runAgent(prospectId, agentName) {
    log('Orchestrator', `Initializing ${agentName}...`);
    await new Promise((r) => setTimeout(r, 800));
    
    // ... (rest of mock runAgent is same as before, omitted for brevity in this specific patch but assumed present)
     let mockData: any = {};
    let kind = 'data';

    if (agentName === 'scraper') {
        mockData = { 
            company: "Acme Corp (Mock)", 
            foundingYear: 2024, 
            industry: "Explosives",
            summary: "Leading provider of anvils and coyote countermeasures.",
            metrics: { employees: 150, revenue: "$50M" }
        };
        kind = 'data';
    } else if (agentName === 'copywriter') {
        mockData = { 
            headline: "Catch the Roadrunner.", 
            subheadline: "Precision tools for the modern predator.", 
            heroBody: "Stop failing at lunch. Start succeeding with Acme.", 
            features: ["Reliable Anvils", "Fast Rockets", "Free Shipping"],
            callToAction: "Shop Now" 
        };
        kind = 'copy';
    } else if (agentName === 'designer') {
        mockData = {
            url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop",
            alt: "Futuristic abstract design"
        };
        kind = 'image';
    }

    log(agentName, `Artifact generated successfully.`, 'success');
    return {
      ok: true,
      prospectId,
      agentName,
      artifacts: [{
        id: `mock_${crypto.randomUUID().slice(0,6)}`,
        kind,
        title: `${agentName === 'scraper' ? 'Company Data' : agentName === 'designer' ? 'Hero Image' : 'Marketing Copy'}`,
        defaultTab: agentName === 'scraper' ? 'profile' : agentName === 'designer' ? 'design' : 'copy',
        data: mockData
      }],
    };
  },
  async refineArtifact(artifact, instruction) {
    log('Refiner', `Refining artifact with instruction: "${instruction}"...`);
    await new Promise((r) => setTimeout(r, 1500));
    
    // Simple Mock Refinement logic
    const newData = structuredClone(artifact.data);
    if (typeof newData === 'object') {
        newData._refined = true;
        newData._instruction = instruction;
        if(newData.headline) newData.headline += " (Refined)";
        if(newData.summary) newData.summary += " (Updated)";
    }
    
    log('Refiner', `Refinement complete.`, 'success');
    return { ok: true, data: newData };
  }
};

// Real Gemini Implementation
async function generateWithGemini(prospectId: string, agentName: string): Promise<Artifact> {
    log('Orchestrator', `Connecting to Gemini for ${agentName}...`);
    if (!process.env.API_KEY) throw new Error("API Key not configured");

    const store = useAppStore.getState();
    const config = store.getPath(`workspace.stateByAgent.${agentName}.config`);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let sysInstruct = config?.systemInstruction || "You are a specialized AI agent for a B2B SaaS platform.";
    let userPrompt = `Context: ${prospectId}. Task: Run agent ${agentName}.`;
    
    // Fallback default prompts if no config found (though flow init should handle it)
    if (!config?.systemInstruction) {
        if (agentName === 'scraper') {
            sysInstruct = "You are an expert business intelligence analyst. Your goal is to generate realistic, structured company profiles based on a name or ID.";
        } else if (agentName === 'copywriter') {
            sysInstruct = "You are a world-class marketing copywriter. You write punchy, high-conversion landing page copy.";
        } else if (agentName === 'designer') {
            sysInstruct = "You are a UI Designer. Suggest an image URL from unsplash.";
        }
    }

    if (agentName === 'scraper') {
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
    } else if (agentName === 'designer') {
         userPrompt = "Return a JSON with { url: 'https://images.unsplash.com/...' } representing a tech abstract background.";
    }

    log(agentName, `Streaming content using customized brain...`);
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
            systemInstruction: sysInstruct,
            responseMimeType: "application/json",
            temperature: config?.temperature ?? 0.7
        }
    });

    log(agentName, `Parsing response...`);
    const text = response.text || "{}";
    let data = {};
    try {
        data = JSON.parse(text);
        log(agentName, `Artifact validated.`, 'success');
    } catch (e) {
        console.error("JSON Parse Error", e);
        data = { error: "Failed to parse model output", raw: text };
        log(agentName, `Failed to parse output.`, 'error');
    }

    return {
        id: `art_${crypto.randomUUID().slice(0,8)}`,
        kind: agentName === 'designer' ? 'image' : (agentName === 'scraper' ? 'data' : 'copy'),
        title: agentName === 'scraper' ? 'Company Profile' : (agentName === 'designer' ? 'Visual Asset' : 'Marketing Draft'),
        defaultTab: agentName === 'scraper' ? 'profile' : 'copy',
        data
    };
}

async function refineWithGemini(artifact: Artifact, instruction: string): Promise<any> {
    if (!process.env.API_KEY) throw new Error("API Key not configured");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
        Original Data (JSON):
        ${JSON.stringify(artifact.data)}

        User Instruction:
        ${instruction}

        Task:
        Update the Original Data based strictly on the User Instruction.
        Maintain the exact same JSON structure/schema.
        Do not output markdown fences. Return valid JSON only.
    `;

    log('Refiner', `Asking Gemini to refine...`);
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            temperature: 0.5
        }
    });

    const text = response.text || "{}";
    try {
        const data = JSON.parse(text);
        log('Refiner', `Refinement applied.`, 'success');
        return data;
    } catch (e) {
        log('Refiner', `Failed to parse refinement.`, 'error');
        throw e;
    }
}

export const orchestrator = {
  async run(prospectId: string) {
    return { ok: true, prospectId };
  },
  
  async runAgent(prospectId: string, agentName: string) {
    if (!process.env.API_KEY || process.env.API_KEY.includes("placeholder")) {
        console.warn("[Orchestrator] No valid API_KEY found. Falling back to Mock Agent.");
        log('System', 'Using Mock Agent (No API Key detected)', 'warn');
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
    } catch (error: any) {
        console.error("[Orchestrator] Gemini Error:", error);
        log('System', `Gemini Error: ${error.message}`, 'error');
        return mock.runAgent(prospectId, agentName);
    }
  },

  async refineArtifact(artifact: Artifact, instruction: string) {
     if (!process.env.API_KEY || process.env.API_KEY.includes("placeholder")) {
        return mock.refineArtifact(artifact, instruction);
    }
    try {
        const newData = await refineWithGemini(artifact, instruction);
        return { ok: true, data: newData };
    } catch (e: any) {
        log('System', `Refine Error: ${e.message}`, 'error');
        return { ok: false, data: artifact.data };
    }
  }
};