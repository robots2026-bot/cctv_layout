import { registerAs } from '@nestjs/config';

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
  publicUploadEndpoint?: string;
  forcePathStyle: boolean;
  presignExpiresIn: number;
}

export default registerAs(
  'objectStorage',
  (): ObjectStorageConfig => ({
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.OBJECT_STORAGE_BUCKET ?? 'cctv-layout-assets',
    publicBaseUrl: process.env.OBJECT_STORAGE_PUBLIC_BASE_URL,
    publicUploadEndpoint: process.env.OBJECT_STORAGE_PUBLIC_UPLOAD_ENDPOINT,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== 'false',
    presignExpiresIn: Number(process.env.OBJECT_STORAGE_PRESIGN_EXPIRES_IN ?? 900)
  })
);
