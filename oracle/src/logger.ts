/**
 * Structured JSON logger for the oracle service.
 * Writes JSON-formatted log entries to stdout (info/debug) and stderr (warn/error).
 * Each entry includes a timestamp (ISO 8601) and level field for Railway log search.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

type LogFields = Record<string, unknown>;

function writeLog(level: LogLevel, fields: LogFields): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "warn" || level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info(fields: LogFields): void {
    writeLog("info", fields);
  },
  warn(fields: LogFields): void {
    writeLog("warn", fields);
  },
  error(fields: LogFields): void {
    writeLog("error", fields);
  },
  debug(fields: LogFields): void {
    writeLog("debug", fields);
  },
};
