import { registerAs } from '@nestjs/config';

export interface AppConfig {
  environment: string;
  port: number;
  websocketPath: string;
}

export default registerAs('app', (): AppConfig => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  websocketPath: process.env.REALTIME_PATH ?? '/realtime'
}));
