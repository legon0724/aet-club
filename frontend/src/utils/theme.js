export const SITE_THEMES = [
  { id: 'spring', label: '봄' },
  { id: 'summer', label: '여름' },
  { id: 'autumn', label: '가을' },
  { id: 'winter', label: '겨울' },
  { id: 'christmas', label: '크리스마스' },
];

const STORAGE_KEY = 'nc-site-theme';

function currentSeasonTheme() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  if (month === 12) return 'christmas';
  return 'winter';
}

export function getSiteTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return SITE_THEMES.some((theme) => theme.id === stored) ? stored : currentSeasonTheme();
}

export function applySiteTheme(themeId) {
  const next = SITE_THEMES.some((theme) => theme.id === themeId) ? themeId : currentSeasonTheme();
  document.documentElement.dataset.theme = next;
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}
