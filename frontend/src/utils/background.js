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

export async function prepareBackgroundImage(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('이미지 파일만 선택할 수 있습니다.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('원본 이미지는 12MB 이하만 사용할 수 있습니다.');
  }

  const bitmap = await createImageBitmap(file);
  const maxWidth = 1920;
  const maxHeight = 1200;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL('image/webp', 0.8);
  if (dataUrl.length > 1_800_000) {
    throw new Error('이미지가 너무 큽니다. 더 작은 사진을 선택해 주세요.');
  }
  return dataUrl;
}
