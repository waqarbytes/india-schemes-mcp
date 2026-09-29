/**
 * Structured logger writing strictly to STDERR.
 * Standard out (stdout) is exclusively reserved for the MCP JSON-RPC protocol transport.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface ToolLogEntry {
  tool: string;
  duration_ms: number;
  success: boolean;
  error?: string;
  args?: Record<string, unknown>;
}

export class Logger {
  private static formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(meta ? { meta } : {}),
    };
    return JSON.stringify(payload);
  }

  public static info(message: string, meta?: Record<string, unknown>): void {
    process.stderr.write(`${this.formatMessage("info", message, meta)}\n`);
  }

  public static warn(message: string, meta?: Record<string, unknown>): void {
    process.stderr.write(`${this.formatMessage("warn", message, meta)}\n`);
  }

  public static error(message: string, meta?: Record<string, unknown>): void {
    process.stderr.write(`${this.formatMessage("error", message, meta)}\n`);
  }

  public static debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
      process.stderr.write(`${this.formatMessage("debug", message, meta)}\n`);
    }
  }

  public static logToolExecution(entry: ToolLogEntry): void {
    const level: LogLevel = entry.success ? "info" : "error";
    const status = entry.success ? "SUCCESS" : "FAILURE";
    const msg = `[Tool: ${entry.tool}] ${status} in ${entry.duration_ms}ms`;
    
    process.stderr.write(
      `${this.formatMessage(level, msg, {
        tool: entry.tool,
        duration_ms: entry.duration_ms,
        success: entry.success,
        error: entry.error,
      })}\n`
    );
  }
}
