class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.statusListeners = new Set();
    this.reconnectTimeout = null;
    this.isConnected = false;
  }

  getWsUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    if (typeof window !== 'undefined' && window.location.port !== '5173') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/ws/dashboard`;
    }
    return 'ws://127.0.0.1:8000/ws/dashboard';
  }

  connect() {
    const wsUrl = this.getWsUrl();
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        console.log('[WS] Connected to dashboard stream');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.dispatch(payload.event, payload);
        } catch (e) {
          console.warn('[WS] Malformed message', event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        console.log('[WS] Disconnected, scheduling reconnect...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Error', err);
        this.ws?.close();
      };
    } catch (e) {
      console.warn('[WS] Connection exception', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 2500);
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus(connected) {
    this.statusListeners.forEach((cb) => cb(connected));
  }

  dispatch(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => cb(payload));
    }
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => cb(payload));
    }
  }
}

export const wsService = new WebSocketService();
