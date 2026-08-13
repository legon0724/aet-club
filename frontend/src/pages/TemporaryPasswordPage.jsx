import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { clearLocalSession, rememberCurrentUser } from '../utils/localAuth';

export default function TemporaryPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상으로 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/api/auth/me/temporary-password', { new_password: newPassword });
      const response = await api.get('/api/auth/me', { cache: false });
      rememberCurrentUser(response.data);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '비밀번호를 변경하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearLocalSession();
    navigate('/login', { replace: true });
  };

  return (
    <main className="temporary-password-page">
      <section className="temporary-password-card" aria-labelledby="temporary-password-title">
        <span className="temporary-password-eyebrow">첫 로그인 보안 설정</span>
        <h1 id="temporary-password-title">새 비밀번호를 설정해주세요</h1>
        <p>임시 비밀번호는 한 번만 사용합니다. 계속하려면 본인만 아는 새 비밀번호로 변경하세요.</p>

        {error && <div className="form-alert error" role="alert">{error}</div>}

        <form onSubmit={submit} className="temporary-password-form">
          <label>
            <span>새 비밀번호</span>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
          </label>
          <label>
            <span>새 비밀번호 확인</span>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
          </label>
          <button type="submit" disabled={loading}>{loading ? '저장 중…' : '새 비밀번호 저장'}</button>
          <button type="button" className="temporary-password-logout" onClick={logout}>로그아웃</button>
        </form>
      </section>
    </main>
  );
}
