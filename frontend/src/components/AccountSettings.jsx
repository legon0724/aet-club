import { memo, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { applyUserBackground, prepareBackgroundImage } from '../utils/background';

function AccountSettings({ user, variant = 'nav' }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage('');
    if (newPassword.length < 8) {
      setMessage('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('새 비밀번호가 서로 다릅니다.');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/api/auth/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('비밀번호가 변경되었습니다.');
    } catch (error) {
      setMessage(error.response?.data?.detail || '비밀번호를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveBackground = async (backgroundImage) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await api.patch('/api/auth/me/background', { background_image: backgroundImage });
      applyUserBackground(response.data.background_image, user?.id);
      setMessage(backgroundImage ? '배경화면이 변경되었습니다.' : '기본 배경으로 돌아왔습니다.');
    } catch (error) {
      setMessage(error.response?.data?.detail || '배경화면을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onBackgroundFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await saveBackground(await prepareBackgroundImage(file));
    } catch (error) {
      setMessage(error.message || '이미지를 처리하지 못했습니다.');
    }
  };

  const username = user?.username || 'NC 멤버';

  return (
    <>
      <button
        type="button"
        className={`account-settings-trigger ${variant}`}
        onClick={() => setOpen(true)}
        aria-label={`${username} 설정 열기`}
      >
        <span className="account-avatar">{username[0].toUpperCase()}</span>
        <span className="account-copy"><strong>{username}</strong><small>설정</small></span>
      </button>

      {open && (
        <div className="account-settings-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="account-settings-panel" role="dialog" aria-modal="true" aria-labelledby="account-settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>NC</span><div><h2 id="account-settings-title">내 설정</h2><p>{user?.email}</p></div></div>
              <button type="button" className="settings-close" onClick={() => setOpen(false)} aria-label="설정 닫기">×</button>
            </header>

            <section className="settings-section">
              <div><h3>배경화면</h3><p>선택한 사진은 내 계정에만 적용됩니다.</p></div>
              <div className="background-actions">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onBackgroundFile} hidden />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>사진 선택</button>
                <button type="button" className="quiet" onClick={() => saveBackground(null)} disabled={saving}>기본 배경</button>
              </div>
            </section>

            <form className="settings-section password-section" onSubmit={changePassword}>
              <div><h3>비밀번호 변경</h3><p>현재 비밀번호를 확인한 뒤 변경합니다.</p></div>
              <label>현재 비밀번호<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
              <label>새 비밀번호<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
              <label>새 비밀번호 확인<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
              <button type="submit" className="save-password" disabled={saving}>{saving ? '저장 중…' : '비밀번호 변경'}</button>
            </form>

            {message && <p className="settings-message" role="status">{message}</p>}
          </section>
        </div>
      )}
    </>
  );
}

export default memo(AccountSettings);
