import { useRef, useState } from 'react';
import { applySiteTheme, getSiteTheme, SITE_THEMES } from '../utils/theme';

export default function ThemePicker() {
  const [themeId, setThemeId] = useState(() => getSiteTheme());
  const detailsRef = useRef(null);
  const selected = SITE_THEMES.find((theme) => theme.id === themeId) || SITE_THEMES[0];

  const selectTheme = (nextTheme) => {
    setThemeId(applySiteTheme(nextTheme));
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="theme-picker">
      <summary aria-label={`배경 테마: ${selected.label}`} title="배경 테마 바꾸기">
        <span>테마</span>
      </summary>
      <div className="theme-menu" aria-label="배경 테마 선택">
        {SITE_THEMES.map((theme) => (
          <button key={theme.id} type="button" className={theme.id === themeId ? 'selected' : ''} onClick={() => selectTheme(theme.id)}>
            <strong>{theme.label}</strong>
          </button>
        ))}
      </div>
    </details>
  );
}
