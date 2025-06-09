export function log(level: string, message: string, meta?: unknown) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[${time}] [${level}] ${message}`, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[${time}] [${level}] ${message}`);
  }
}

export const info = (message: string, meta?: unknown) => log('INFO', message, meta);
export const warn = (message: string, meta?: unknown) => log('WARN', message, meta);
export const error = (message: string, meta?: unknown) => log('ERROR', message, meta);
