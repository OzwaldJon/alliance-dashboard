export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogLine = { ts: number; level: LogLevel; msg: string };

export function createLogBuffer(max: number): {
  buffer: LogLine[];
  push(level: LogLevel, msg: string): void;
} {
  const buffer: LogLine[] = [];

  return {
    buffer,
    push: (level, msg) => {
      buffer.push({ ts: Date.now(), level, msg: String(msg) });
      if (buffer.length > max) buffer.splice(0, buffer.length - max);
    }
  };
}
