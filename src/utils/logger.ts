/**
 * Simple logger with debug mode support
 */
export class Logger {
  private debug: boolean;
  private prefix: string;

  constructor(debug: boolean = false, prefix: string = '[MarketplaceSDK]') {
    this.debug = debug;
    this.prefix = prefix;
  }

  /**
   * Log debug message (only if debug enabled)
   */
  log(...args: any[]): void {
    if (this.debug) {
      console.log(this.prefix, ...args);
    }
  }

  /**
   * Log info message (only if debug enabled)
   */
  info(...args: any[]): void {
    if (this.debug) {
      console.info(this.prefix, ...args);
    }
  }

  /**
   * Log warning message (always shown)
   */
  warn(...args: any[]): void {
    console.warn(this.prefix, ...args);
  }

  /**
   * Log error message (always shown)
   */
  error(...args: any[]): void {
    console.error(this.prefix, ...args);
  }
}
