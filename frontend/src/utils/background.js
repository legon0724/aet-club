const BACKGROUND_CACHE_PREFIX = 'nc-user-background:';

function cacheKey(userId) {
  return `${BACKGROUND_CACHE_PREFIX}${userId || 'guest'}`;
}

export function applyUserBackground(backgroundImage = null, userId = null) {
  const root = document.documentElement;

  if (backgroundImage) {
    root.style.setProperty('--user-background-image', `url("${backgroundImage}")`);
    root.classList.add('has-custom-background');
    try {
      localStorage.setItem(cacheKey(userId), backgroundImage);
    } catch {
      // The server remains the source of truth if browser storage is full.
    }
    return;
  }

  root.style.removeProperty('--user-background-image');
  root.classList.remove('has-custom-background');
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function applyCachedUserBackground(userId = null) {
  try {
    const saved = localStorage.getItem(cacheKey(userId));
    if (saved) applyUserBackground(saved, userId);
  } catch {
    // Keep the seasonal theme when storage is unavailable.
  }
}

async function decodeBackgroundImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      // Fall through to the regular image decoder for wider browser support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('이 사진 형식은 읽을 수 없습니다. JPG, PNG 또는 WebP 사진을 선택해 주세요.', { cause: error });
  }
}

export async function prepareBackgroundImage(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('이미지 파일만 선택할 수 있습니다.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('원본 이미지는 20MB 이하만 사용할 수 있습니다.');
  }

  const decoded = await decodeBackgroundImage(file);
  const initialScale = Math.min(1, 1920 / decoded.width, 1200 / decoded.height);
  let width = Math.max(1, Math.round(decoded.width * initialScale));
  let height = Math.max(1, Math.round(decoded.height * initialScale));
  const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];

  try {
    for (const quality of qualities) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.drawImage(decoded.source, 0, 0, width, height);

      let dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp;base64,')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (dataUrl.length <= 1_750_000) return dataUrl;

      width = Math.max(640, Math.round(width * 0.82));
      height = Math.max(400, Math.round(height * 0.82));
    }
  } finally {
    decoded.close();
  }

  throw new Error('이미지가 너무 큽니다. 더 작은 사진을 선택해 주세요.');
}
