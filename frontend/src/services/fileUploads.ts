import { apiClient } from '../utils/apiClient';
import { measureImageFile, type ImageDimensions } from '../utils/image';

interface PresignResponse {
  fileId: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
  objectKey: string;
}

export interface UploadedFileMetadata {
  id: string;
  url: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  mimeType: string;
  objectKey: string;
}

const extractEtag = (response: Response) => {
  const header = response.headers.get('ETag') ?? response.headers.get('etag');
  if (!header) return undefined;
  return header.replace(/"/g, '');
};

const uploadToPresignedUrl = async (uploadUrl: string, file: File, headers: Record<string, string>) => {
  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', file.type || 'application/octet-stream');
  }
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: finalHeaders
  });
  if (!response.ok) {
    throw new Error('图纸上传失败，请稍后重试');
  }
  return extractEtag(response);
};

export interface UploadBlueprintResult extends UploadedFileMetadata {
  dimensions: ImageDimensions;
}

export const uploadBlueprintFile = async (
  file: File,
  { projectId, layoutId }: { projectId: string; layoutId?: string }
): Promise<UploadBlueprintResult> => {
  const dimensions = await measureImageFile(file);
  const presignResponse = await apiClient.post<PresignResponse>(
    `/projects/${projectId}/files/presign`,
    {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      category: 'blueprint',
      layoutId
    }
  );

  const etag = await uploadToPresignedUrl(
    presignResponse.data.uploadUrl,
    file,
    presignResponse.data.headers ?? {}
  );

  const completeResponse = await apiClient.post<UploadedFileMetadata>(
    `/projects/${projectId}/files/${presignResponse.data.fileId}/complete`,
    {
      sizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
      etag
    }
  );

  return {
    ...completeResponse.data,
    dimensions
  };
};
