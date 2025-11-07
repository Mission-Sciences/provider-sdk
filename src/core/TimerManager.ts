import { Logger } from '../utils/logger';
import { SDKEvents } from '../types';

/**
 * Timer Manager for session countdown
 */
export class TimerManager {
  private remainingSeconds: number;
  private intervalId: number | null = null;
  private warningThreshold: number;
  private warningShown: boolean = false;
  private logger: Logger;
  private events: Partial<SDKEvents>;

  constructor(
    durationSeconds: number,
    warningThresholdSeconds: number = 300,
    events: Partial<SDKEvents> = {},
    debug: boolean = false
  ) {
    this.remainingSeconds = durationSeconds;
    this.warningThreshold = warningThresholdSeconds;
    this.events = events;
    this.logger = new Logger(debug, '[TimerManager]');

    this.logger.log('Initialized with duration:', durationSeconds, 'seconds');
  }

  /**
   * Start countdown timer
   */
  start(): void {
    if (this.intervalId !== null) {
      this.logger.warn('Timer already running');
      return;
    }

    this.logger.log('Starting timer with', this.remainingSeconds, 'seconds remaining');

    this.intervalId = window.setInterval(() => {
      this.remainingSeconds--;

      // Check for warning threshold
      if (
        !this.warningShown &&
        this.remainingSeconds <= this.warningThreshold &&
        this.remainingSeconds > 0
      ) {
        this.warningShown = true;
        this.logger.warn('Warning threshold reached:', this.remainingSeconds, 'seconds remaining');
        this.events.onSessionWarning?.({
          remainingSeconds: this.remainingSeconds,
        });
      }

      // Check for expiration
      if (this.remainingSeconds <= 0) {
        this.logger.warn('Session expired');
        this.stop();
        this.events.onSessionEnd?.();
      }
    }, 1000);
  }

  /**
   * Stop timer
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Timer stopped');
    }
  }

  /**
   * Pause timer
   */
  pause(): void {
    this.stop();
    this.logger.log('Timer paused at:', this.remainingSeconds, 'seconds');
  }

  /**
   * Resume timer
   */
  resume(): void {
    if (this.intervalId === null && this.remainingSeconds > 0) {
      this.start();
      this.logger.log('Timer resumed at:', this.remainingSeconds, 'seconds');
    }
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  /**
   * Get formatted time string (MM:SS)
   */
  getFormattedTime(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get formatted time string with hours (HH:MM:SS)
   */
  getFormattedTimeWithHours(): string {
    const hours = Math.floor(this.remainingSeconds / 3600);
    const minutes = Math.floor((this.remainingSeconds % 3600) / 60);
    const seconds = this.remainingSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return this.getFormattedTime();
  }

  /**
   * Check if timer is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Check if warning has been shown
   */
  hasWarningBeenShown(): boolean {
    return this.warningShown;
  }

  /**
   * Update remaining time (useful for syncing with server)
   */
  updateRemainingTime(seconds: number): void {
    this.remainingSeconds = seconds;
    this.logger.log('Remaining time updated to:', seconds, 'seconds');
  }
}
