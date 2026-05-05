import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const log = pino(
  isDev
    ? {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, ignore: 'pid,hostname' }
        }
      }
    : { level: process.env.LOG_LEVEL || 'info' }
);

export { log };
