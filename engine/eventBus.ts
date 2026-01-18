type Handler = (payload: any) => void;

class EventBus {
  private handlers: Record<string, Handler[]> = {};

  on(topic: string, handler: Handler) {
    this.handlers[topic] ??= [];
    this.handlers[topic].push(handler);
    
    // Return unsubscribe function
    return () => {
        this.handlers[topic] = this.handlers[topic].filter(h => h !== handler);
    };
  }

  emit(topic: string, payload: any) {
    // console.log(`[Bus] Emit: ${topic}`, payload);
    const hs = this.handlers[topic] || [];
    for (const h of hs) h(payload);
  }
}

export const eventBus = new EventBus();