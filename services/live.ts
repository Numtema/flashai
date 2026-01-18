import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { eventBus } from "../engine/eventBus";
import { useAppStore } from "../store/useAppStore";

// --- Audio Handling Helpers ---
const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let audioSource: MediaStreamAudioSourceNode | null = null;
let currentSession: any = null;

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 16000 });
  } else if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function startAudioStream(sessionPromise: Promise<any>) {
  const ctx = ensureAudioContext();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioSource = ctx.createMediaStreamSource(mediaStream);
  scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);
  
  scriptProcessor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    const pcmBlob = createPcmBlob(inputData);
    sessionPromise.then((session) => {
      session.sendRealtimeInput({ media: pcmBlob });
    });
  };

  audioSource.connect(scriptProcessor);
  scriptProcessor.connect(ctx.destination);
}

function stopAudioStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (scriptProcessor && audioSource) {
    audioSource.disconnect(scriptProcessor);
    scriptProcessor.disconnect();
  }
}

// --- Live Service ---

export const liveService = {
  isActive: false,

  async connect() {
    if (this.isActive) return;
    if (!process.env.API_KEY) {
        eventBus.emit('ui.notify', { type: 'error', message: 'API Key missing for Live' });
        return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const store = useAppStore.getState();
    const prospectName = store.getPath("workspace.prospectName") || "Unknown Project";
    const prospectId = store.getPath("workspace.prospectId");

    const tools = [
        {
            functionDeclarations: [
                {
                    name: "run_agent",
                    description: "Run a specific AI agent (scraper, copywriter, or designer).",
                    parameters: {
                        type: "OBJECT" as any,
                        properties: {
                            agentName: { type: "STRING" as any, description: "Name of the agent: 'scraper', 'copywriter', or 'designer'" }
                        },
                        required: ["agentName"]
                    }
                }
            ]
        }
    ];

    eventBus.emit('ui.notify', { type: 'info', message: 'Connecting to Gemini Live...' });

    try {
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: `You are the voice interface for LeadSite Factory. 
                                    Current Project: ${prospectName} (ID: ${prospectId}).
                                    You can run agents. Be concise and professional.`,
                tools: tools as any
            },
            callbacks: {
                onopen: () => {
                    this.isActive = true;
                    eventBus.emit('live.status', 'connected');
                    startAudioStream(sessionPromise);
                },
                onmessage: (msg: LiveServerMessage) => {
                    // Handle Tool Calls
                    if (msg.toolCall) {
                        for (const fc of msg.toolCall.functionCalls) {
                            if (fc.name === 'run_agent') {
                                const agent = (fc.args as any).agentName;
                                eventBus.emit('orchestrator.runAgent', { agentName: agent, prospectId });
                                // Confirm to model
                                sessionPromise.then(s => s.sendToolResponse({
                                    functionResponses: {
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "Agent started successfully" }
                                    }
                                }));
                            }
                        }
                    }
                    
                    // Audio Output Playback (Simplified for this demo)
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && audioContext) {
                        const binary = atob(audioData);
                        const len = binary.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                        
                        // Decode properly
                        const int16 = new Int16Array(bytes.buffer);
                        // This is raw PCM 24kHz usually, decoding via AudioContext is tricky with raw PCM without header.
                        // For the purpose of this demo, we'll assume the user uses the browser's capability or rely on the visual feedback
                        // Implementing full raw PCM playback requires a bit more boilerplate (creating AudioBuffer manually)
                        
                        // Let's implement minimal playback:
                        const float32 = new Float32Array(int16.length);
                        for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768;
                        
                        const buffer = audioContext.createBuffer(1, float32.length, 24000);
                        buffer.getChannelData(0).set(float32);
                        
                        const source = audioContext.createBufferSource();
                        source.buffer = buffer;
                        source.connect(audioContext.destination);
                        source.start();
                    }
                },
                onclose: () => {
                    this.isActive = false;
                    eventBus.emit('live.status', 'disconnected');
                    stopAudioStream();
                },
                onerror: (e) => {
                    console.error(e);
                    this.isActive = false;
                    eventBus.emit('live.status', 'error');
                    stopAudioStream();
                }
            }
        });
        
        currentSession = sessionPromise;

    } catch (e) {
        console.error("Live Connect Error", e);
        eventBus.emit('ui.notify', { type: 'error', message: 'Failed to connect Live' });
    }
  },

  disconnect() {
    if (currentSession) {
       currentSession.then((s: any) => s.close());
       currentSession = null;
    }
    stopAudioStream();
    this.isActive = false;
    eventBus.emit('live.status', 'disconnected');
  }
};