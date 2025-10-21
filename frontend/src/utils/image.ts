export interface ImageDimensions {
  width: number;
  height: number;
}

interface LoadImageOptions {
  crossOrigin?: string;
}

export const loadImageElement = (source: string, options?: LoadImageOptions): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (options?.crossOrigin) {
      image.crossOrigin = options.crossOrigin;
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法加载图纸图片资源'));
    image.src = source;
  });

export const loadImageDimensions = async (source: string, options?: LoadImageOptions): Promise<ImageDimensions> => {
    const image = await loadImageElement(source, options);
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    };
  };

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('无法读取图纸文件内容'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('图纸文件读取失败'));
    };
    reader.readAsDataURL(file);
  });

const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_MAX_DATA_URL_LENGTH = 1_400_000; // ~1.0MB (base64 chars)
const DEFAULT_QUALITY = 0.85;
const DEFAULT_MIN_QUALITY = 0.55;
const QUALITY_STEP = 0.1;
const SCALE_STEP = 0.85;

export interface ImageOptimizationOptions {
  maxDimension?: number;
  maxDataUrlLength?: number;
  quality?: number;
  minQuality?: number;
  preferredFormat?: 'image/webp' | 'image/jpeg' | 'image/png';
  skipProcessingTypes?: string[];
  fallbacks?: ('image/png' | 'image/jpeg' | 'image/webp')[];
}

const approximateBytesFromBase64 = (length: number) => Math.floor((length * 3) / 4);

const renderToDataUrl = (
  image: HTMLImageElement,
  scale: number,
  format: 'image/webp' | 'image/jpeg' | 'image/png',
  quality: number
) => {
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建图纸画布上下文');
  }
  context.drawImage(image, 0, 0, width, height);
  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL(format, quality);
  } catch (error) {
    dataUrl = canvas.toDataURL('image/png');
  }
  return { dataUrl, width, height };
};

const optimiseDataUrl = (
  image: HTMLImageElement,
  baseDataUrlLength: number,
  options?: ImageOptimizationOptions
) => {
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxDataUrlLength = options?.maxDataUrlLength ?? DEFAULT_MAX_DATA_URL_LENGTH;
  let quality = options?.quality ?? DEFAULT_QUALITY;
  const minQuality = options?.minQuality ?? DEFAULT_MIN_QUALITY;
  let scale =
    Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height) > maxDimension
      ? maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
      : 1;
  const fallbackFormats: ('image/png' | 'image/jpeg' | 'image/webp')[] =
    options?.fallbacks ?? ['image/webp', 'image/jpeg', 'image/png'];
  let format = options?.preferredFormat ?? fallbackFormats[0] ?? 'image/webp';

  let { dataUrl, width, height } = renderToDataUrl(image, scale, format === 'image/png' ? 'image/png' : format, quality);
  let attempts = 0;
  let formatIndex = fallbackFormats.indexOf(format);
  if (formatIndex === -1) {
    fallbackFormats.unshift(format);
    formatIndex = 0;
  }

  while (dataUrl.length > maxDataUrlLength && attempts < 10) {
    attempts += 1;
    let adjusted = false;
    if (quality > minQuality) {
      quality = Math.max(minQuality, quality - QUALITY_STEP);
      adjusted = true;
    }
    if (dataUrl.length > maxDataUrlLength && scale > 0.3) {
      scale *= SCALE_STEP;
      adjusted = true;
    }
    ({ dataUrl, width, height } = renderToDataUrl(
      image,
      scale,
      format === 'image/png' ? 'image/png' : format,
      quality
    ));
    if (!adjusted) {
      if (formatIndex < fallbackFormats.length - 1) {
        formatIndex += 1;
        format = fallbackFormats[formatIndex] as 'image/png' | 'image/jpeg' | 'image/webp';
        ({ dataUrl, width, height } = renderToDataUrl(
          image,
          scale,
          format === 'image/png' ? 'image/png' : format,
          quality
        ));
        adjusted = true;
      } else {
        break;
      }
    }
  }

  if (dataUrl.length > maxDataUrlLength) {
    throw new Error(
      '蓝图仍然过大，请在上传前压缩或裁剪图片（建议宽高不超过 2048 像素，或降低分辨率后再试）'
    );
  }

  return {
    dataUrl,
    width,
    height,
    optimized: dataUrl.length < baseDataUrlLength || scale < 1 || quality < (options?.quality ?? DEFAULT_QUALITY),
    approxBytes: approximateBytesFromBase64(dataUrl.length)
  };
};

export interface ReadImageResult {
  dataUrl: string;
  width: number;
  height: number;
  optimized: boolean;
  approxBytes: number;
  format: string;
}

export const readImageFile = async (
  file: File,
  options?: ImageOptimizationOptions
): Promise<ReadImageResult> => {
  const skipOptimization =
    options?.skipProcessingTypes?.some((type) => file.type?.toLowerCase() === type.toLowerCase()) ?? false;
  if (skipOptimization) {
    const baseDataUrl = await readFileAsDataUrl(file);
    const { width, height } = await loadImageDimensions(baseDataUrl);
    return {
      dataUrl: baseDataUrl,
      width,
      height,
      optimized: false,
      approxBytes: approximateBytesFromBase64(baseDataUrl.length),
      format: file.type || 'image/png'
    };
  }

  const baseDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(baseDataUrl);
  const baseLength = baseDataUrl.length;

  try {
    const optimised = optimiseDataUrl(image, baseLength, options);
    return { ...optimised, format: options?.preferredFormat ?? 'image/webp' };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('图纸优化失败，请稍后重试');
  }
};

export const measureImageFile = (file: File): Promise<ImageDimensions> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取图纸尺寸'));
    };
    image.src = objectUrl;
  });
