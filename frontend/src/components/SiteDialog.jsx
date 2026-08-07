import { useEffect, useState } from 'react';
import { subscribeToSiteDialog } from '../utils/siteDialog';

export default function SiteDialog() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const listener = (nextDialog) => {
      setDialog((current) => {
        current?.resolve(false);
        return nextDialog;
      });
    };
    return subscribeToSiteDialog(listener);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        dialog.resolve(false);
        setDialog(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog]);

  if (!dialog) return null;

  const finish = (result) => {
    dialog.resolve(result);
    setDialog(null);
  };

  return (
    <div className="site-dialog-backdrop" role="presentation" onMouseDown={() => finish(false)}>
      <section
        className="site-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-dialog-title"
        aria-describedby="site-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="site-dialog-mark">NC</span>
        <h2 id="site-dialog-title">{dialog.title}</h2>
        <p id="site-dialog-message">{dialog.message}</p>
        <div className="site-dialog-actions">
          {dialog.type === 'confirm' && (
            <button type="button" className="modern-btn" onClick={() => finish(false)}>취소</button>
          )}
          <button type="button" className={dialog.type === 'confirm' ? 'modern-btn danger' : 'modern-btn primary'} autoFocus onClick={() => finish(true)}>
            {dialog.type === 'confirm' ? '확인' : '닫기'}
          </button>
        </div>
      </section>
    </div>
  );
}
