import { wsURL } from "@/lib/api/client";
import type { WSEvent } from "@/types";

type Listener = (evt: WSEvent) => void;

class LiveSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private retryDelay = 1000;
  private closedByUser = false;

  connect() {
    if (this.socket || typeof window === "undefined") return;
    this.closedByUser = false;
    const socket = new WebSocket(wsURL());

    socket.onopen = () => {
      this.retryDelay = 1000;
    };
    socket.onmessage = (msg) => {
      // A socket mid-close (e.g. replaced during React Strict Mode's dev
      // double-invoke of effects) can still deliver an already in-flight
      // message. Only the currently active socket's messages count.
      if (this.socket !== socket) return;
      try {
        const evt: WSEvent = JSON.parse(msg.data);
        this.listeners.forEach((fn) => fn(evt));
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      if (!this.closedByUser) {
        setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 15000);
      }
    };
    socket.onerror = () => socket.close();

    this.socket = socket;
  }

  disconnect() {
    this.closedByUser = true;
    this.socket?.close();
    this.socket = null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const liveSocket = new LiveSocket();
