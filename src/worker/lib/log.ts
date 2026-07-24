type LogLevel = "info" | "error";

type LogRecord = {
  event: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  error?: string;
};

export function logRecord(level: LogLevel, record: LogRecord): void {
  const serialized = JSON.stringify(record);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}
