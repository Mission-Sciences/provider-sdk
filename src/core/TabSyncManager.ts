import { Logger } from '../utils/logger';

export interface TabSyncMessage {
  type: 'timer_update' | 'pause' | 'resume' | 'end';
  sessionId: string;
  remainingSeconds?: number;
  timestamp: number;
}

/**
 * Tab Synchronization Manager
 * Phase 2 Feature - Syncs session state across multiple tabs
 */
export class TabSyncManager {
  private channel: BroadcastChannel | null = null;
  private storageKey: string;
  private logger: Logger;
  private isMaster: boolean = false;

  constructor(
    private sessionId: string,
    private onMessage: (message: TabSyncMessage) => void,
    debug: boolean = false
  ) {
    this.storageKey = `gw_session_sync_${sessionId}`;
    this.logger = new Logger(debug, '[TabSyncManager]');

    this.initialize();
  }

  /**
   * Initialize sync mechanism
   */
  private initialize(): void {
    // Try BroadcastChannel API first (modern browsers)
    if (typeof BroadcastChannel !== 'undefined') {
      this.logger.log('Using BroadcastChannel for tab sync');
      this.channel = new BroadcastChannel(`gw-session-${this.sessionId}`);
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } else {
      // Fallback to localStorage events (older browsers)
      this.logger.log('Using localStorage for tab sync (fallback)');
      window.addEventListener('storage', this.handleStorageEvent);
    }

    // Elect this tab as master if no other tab exists
    this.electMaster();
  }

  /**
   * Broadcast message to other tabs
   */
  broadcast(type: TabSyncMessage['type'], data?: Partial<TabSyncMessage>): void {
    const message: TabSyncMessage = {
      type,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      ...data,
    };

    if (this.channel) {
      this.channel.postMessage(message);
      this.logger.log('Broadcasted:', type);
    } else {
      // Fallback: use localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(message));
      this.logger.log('Broadcasted via localStorage:', type);
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: TabSyncMessage): void {
    if (data.sessionId !== this.sessionId) {
      return; // Ignore messages for other sessions
    }

    this.logger.log('Received message:', data.type);
    this.onMessage(data);
  }

  /**
   * Handle storage event (fallback mechanism)
   */
  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === this.storageKey && event.newValue) {
      try {
        const data = JSON.parse(event.newValue) as TabSyncMessage;
        this.handleMessage(data);
      } catch (error) {
        this.logger.error('Failed to parse storage event:', error);
      }
    }
  };

  /**
   * Elect this tab as master if appropriate
   * Master tab is responsible for heartbeats
   */
  private electMaster(): void {
    const masterKey = `gw_session_master_${this.sessionId}`;
    const existingMaster = localStorage.getItem(masterKey);

    if (!existingMaster) {
      // No master exists, become master
      this.isMaster = true;
      localStorage.setItem(masterKey, Date.now().toString());
      this.logger.log('Elected as master tab');

      // Set up heartbeat to maintain master status
      setInterval(() => {
        if (this.isMaster) {
          localStorage.setItem(masterKey, Date.now().toString());
        }
      }, 5000);

      // Clear master status on unload
      window.addEventListener('beforeunload', () => {
        if (this.isMaster) {
          localStorage.removeItem(masterKey);
          this.logger.log('Removed master status');
        }
      });
    } else {
      this.logger.log('Another tab is master');

      // Check periodically if master is still alive
      setInterval(() => {
        const masterTimestamp = localStorage.getItem(masterKey);
        if (masterTimestamp) {
          const age = Date.now() - parseInt(masterTimestamp);
          if (age > 10000) {
            // Master hasn't updated in 10s, assume dead
            this.logger.warn('Master tab appears dead, becoming master');
            this.isMaster = true;
            localStorage.setItem(masterKey, Date.now().toString());
          }
        }
      }, 5000);
    }
  }

  /**
   * Check if this tab is the master
   */
  isMasterTab(): boolean {
    return this.isMaster;
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    } else {
      window.removeEventListener('storage', this.handleStorageEvent);
    }

    // Clean up storage
    localStorage.removeItem(this.storageKey);

    if (this.isMaster) {
      localStorage.removeItem(`gw_session_master_${this.sessionId}`);
    }

    this.logger.log('Tab sync destroyed');
  }
}
