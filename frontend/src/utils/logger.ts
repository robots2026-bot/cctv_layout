/* eslint-disable no-console */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const prefix = '[CCTV Layout]';

export const logger = {
  log(level: LogLevel, message: string, ...args: unknown[]) {
    const formatted = `${prefix} ${message}`;
    switch (level) {
      case 'info':
        console.info(formatted, ...args);
        break;
      case 'warn':
        console.warn(formatted, ...args);
        break;
      case 'error':
        console.error(formatted, ...args);
        break;
      case 'debug':
      default:
        if (import.meta.env.DEV) {
          console.debug(formatted, ...args);
        }
        break;
    }
  }
};
