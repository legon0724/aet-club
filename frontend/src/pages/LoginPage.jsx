import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import heroImage from '../assets/hero.png';
import {
  LOCAL_RESET_KEY,
  LOCAL_RESET_VERSION,
  LOCAL_RESET_VERSION_KEY,
  LOCAL_USERS_KEY,
  clearLocalSession,
  encodePassword,
  isAdminEmail,
  isApiUnavailable,
  isSchoolEmail,
  readLocalUsers,
  rememberCurrentUser,
  setLocalSession,
  writeLocalUsers,
} from '../utils/localAuth';

const terms = [
  {
    id: 'service',
    required: true,
    title: '서비스 이용약관',
    body: 'NC는 동아리 활동, 공지, 팀 협업, 포트폴리오 관리를 위한 서비스입니다. 가입한 사용자는 본인 계정으로만 이용해야 하며, 허위 정보 등록이나 동아리 활동과 무관한 게시물 작성은 제한될 수 있습니다.',
  },
  {
    id: 'privacy',
    required: true,
    title: '개인정보 수집 및 이용',
    body: '회원 식별과 서비스 제공을 위해 이메일, 닉네임, 암호화된 비밀번호를 수집합니다. 포트폴리오에 입력한 프로젝트, 소개, 외부 링크는 사용자가 직접 관리할 수 있으며 탈퇴 시 관련 정보는 삭제됩니다.',
  },
  {
    id: 'notice',
    required: false,
    title: '활동 안내 수신',
    body: '동아리 공지, 과제 제출 일정, 서비스 변경 안내를 받을 수 있습니다. 선택 동의이므로 동의하지 않아도 가입과 이용에는 제한이 없습니다.',
  },
];

const modeText = {
  login: {
    tab: '로그인',
    eyebrow: 'NC access',
    title: '로그인',
    helper: '학교 이메일로만 접속할 수 있습니다.',
  },
  register: {
    tab: '가입',
    eyebrow: 'Start now',
    title: '회원가입',
    helper: '@cam.hs.kr 학교 이메일로 가입할 수 있습니다.',
  },
  reset: {
    tab: '재설정',
    eyebrow: 'Email code',
    title: '비밀번호 재설정',
    helper: '가입한 이메일로 인증번호를 받고 새 비밀번호를 설정하세요.',
  },
};

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [resetStep, setResetStep] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [agreements, setAgreements] = useState({ service: false, privacy: false, notice: false });
  const [openTerm, setOpenTerm] = useState('service');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const requiredAccepted = agreements.service && agreements.privacy;
  const allAccepted = terms.every((term) => agreements[term.id]);
  const copy = useMemo(() => modeText[mode], [mode]);

  useEffect(() => {
    if (localStorage.getItem(LOCAL_RESET_VERSION_KEY) !== LOCAL_RESET_VERSION) {
      localStorage.removeItem(LOCAL_USERS_KEY);
      localStorage.removeItem(LOCAL_RESET_KEY);
      clearLocalSession();
      localStorage.setItem(LOCAL_RESET_VERSION_KEY, LOCAL_RESET_VERSION);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/');
  }, [navigate]);

  const resetMessage = () => {
    setError('');
    setSuccess('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setResetStep('email');
    resetMessage();
  };

  const handleAllAgree = (checked) => {
    setAgreements({ service: checked, privacy: checked, notice: checked });
  };

  const handleAgreement = (id, checked) => {
    setAgreements((current) => ({ ...current, [id]: checked }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessage();

    if (!isSchoolEmail(email)) {
      setError('@cam.hs.kr 학교 이메일만 로그인할 수 있습니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      try {
        const me = await api.get('/api/auth/me');
        rememberCurrentUser(me.data);
      } catch {
        // If the profile request is unavailable, the route guards still keep the token.
      }
      navigate('/');
    } catch (err) {
      if (isApiUnavailable(err)) {
        const localUser = readLocalUsers().find((user) => user.email === email.trim().toLowerCase());
        if (localUser && localUser.password === encodePassword(password)) {
          setLocalSession(localUser);
          navigate('/');
          return;
        }
        setError('가입한 학교 이메일과 비밀번호를 다시 확인해주세요.');
        return;
      }
      setError(err.response?.data?.detail || '이메일과 비밀번호를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    resetMessage();

    if (!isSchoolEmail(email)) {
      setError('@cam.hs.kr 학교 이메일만 가입할 수 있습니다.');
      return;
    }

    if (!requiredAccepted) {
      setError('필수 약관에 동의해야 가입할 수 있습니다.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/register', {
        email,
        password,
        username,
        privacy_consented: agreements.privacy,
      });
      setSuccess('가입이 완료되었습니다. 이제 로그인해주세요.');
      setMode('login');
      setPassword('');
    } catch (err) {
      if (isApiUnavailable(err)) {
        const normalizedEmail = email.trim().toLowerCase();
        const users = readLocalUsers();
        if (users.some((user) => user.email === normalizedEmail)) {
          setError('이미 가입된 학교 이메일입니다.');
          return;
        }
        if (users.some((user) => user.username === username.trim())) {
          setError('이미 사용 중인 닉네임입니다.');
          return;
        }
        writeLocalUsers([
          ...users,
          {
            email: normalizedEmail,
            username: username.trim(),
            password: encodePassword(password),
            is_admin: isAdminEmail(normalizedEmail),
            team_id: 'creative',
            created_at: new Date().toISOString(),
          },
        ]);
        setSuccess('가입이 완료되었습니다. 이제 로그인해주세요.');
        setMode('login');
        setPassword('');
        return;
      }
      setError(err.response?.data?.detail || '가입 정보를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async (e) => {
    e.preventDefault();
    resetMessage();

    if (!isSchoolEmail(email)) {
      setError('@cam.hs.kr 학교 이메일만 재설정할 수 있습니다.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/password-reset/request', { email });
      setSuccess('인증번호를 이메일로 보냈습니다. 메일함을 확인해주세요.');
      setResetStep('code');
    } catch (err) {
      if (isApiUnavailable(err)) {
        const normalizedEmail = email.trim().toLowerCase();
        const localUser = readLocalUsers().find((user) => user.email === normalizedEmail);
        if (!localUser) {
          setError('가입된 학교 이메일을 찾을 수 없습니다.');
          return;
        }
        const fallbackCode = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        localStorage.setItem(
          LOCAL_RESET_KEY,
          JSON.stringify({
            email: normalizedEmail,
            code: fallbackCode,
            expiresAt: Date.now() + 10 * 60 * 1000,
          }),
        );
        setSuccess(`메일 서버 연결 전 임시 인증번호: ${fallbackCode}`);
        setResetStep('code');
        return;
      }
      setError(err.response?.data?.detail || '이메일 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    resetMessage();

    if (!isSchoolEmail(email)) {
      setError('@cam.hs.kr 학교 이메일만 재설정할 수 있습니다.');
      return;
    }

    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상으로 설정해주세요.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/password-reset/confirm', {
        email,
        code,
        new_password: newPassword,
      });
      setSuccess('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
      setMode('login');
      setResetStep('email');
      setPassword('');
      setCode('');
      setNewPassword('');
    } catch (err) {
      if (isApiUnavailable(err)) {
        const normalizedEmail = email.trim().toLowerCase();
        const reset = JSON.parse(localStorage.getItem(LOCAL_RESET_KEY) || 'null');
        if (!reset || reset.email !== normalizedEmail || reset.code !== code || reset.expiresAt < Date.now()) {
          setError('인증번호가 만료되었거나 올바르지 않습니다.');
          return;
        }
        const users = readLocalUsers();
        const nextUsers = users.map((user) => (
          user.email === normalizedEmail ? { ...user, password: encodePassword(newPassword) } : user
        ));
        writeLocalUsers(nextUsers);
        localStorage.removeItem(LOCAL_RESET_KEY);
        setSuccess('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
        setMode('login');
        setResetStep('email');
        setPassword('');
        setCode('');
        setNewPassword('');
        return;
      }
      setError(err.response?.data?.detail || '인증번호와 새 비밀번호를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page nc-editorial nc-login-stage">
      <section className="editorial-scene" aria-label="NC 소개">
        <div className="editorial-nav">
          <span className="editorial-logo">NC</span>
          <span>CAM High Club</span>
        </div>

        <div className="poster-stack" aria-hidden="true">
          <div className="motion-pixel pixel-a" />
          <div className="motion-pixel pixel-b" />
          <div className="poster-card poster-card-main">
            <div className="poster-noise" />
            <div className="poster-eyes">
              <span />
              <span />
            </div>
            <img src={heroImage} alt="" />
            <div className="paper-character">
              <span className="character-head" />
              <span className="character-body" />
              <span className="character-arm left" />
              <span className="character-arm right" />
              <span className="character-shadow" />
            </div>
            <span className="poster-title">NC</span>
          </div>
        </div>
      </section>

      <section className="editorial-form-wrap" aria-label={copy.title}>
        <div className="editorial-form">
          <div className="form-title">
            <strong>NC Portal</strong>
            <span>{copy.eyebrow}</span>
            <h2>{copy.title}</h2>
            <p>{copy.helper}</p>
          </div>

          <div className="editorial-tabs" role="tablist" aria-label="인증 방식 선택">
            {Object.entries(modeText).map(([key, item]) => (
              <button key={key} type="button" className={mode === key ? 'active' : ''} onClick={() => switchMode(key)}>
                {item.tab}
              </button>
            ))}
          </div>

          {error && <div className="form-alert error">{error}</div>}
          {success && <div className="form-alert success">{success}</div>}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <Field label="학교 이메일" type="email" value={email} onChange={setEmail} placeholder="name@cam.hs.kr" autoComplete="email" />
              <Field label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="비밀번호" autoComplete="current-password" />
              <SubmitButton loading={loading}>로그인</SubmitButton>
              <button className="text-button" type="button" onClick={() => switchMode('reset')}>비밀번호를 잊으셨나요?</button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="auth-form">
              <Field label="학교 이메일" type="email" value={email} onChange={setEmail} placeholder="name@cam.hs.kr" autoComplete="email" />
              <Field label="닉네임" type="text" value={username} onChange={setUsername} placeholder="활동명 또는 이름" autoComplete="nickname" />
              <Field label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="8자 이상 권장" autoComplete="new-password" />

              <div className="terms-box">
                <label className="terms-all">
                  <input type="checkbox" checked={allAccepted} onChange={(e) => handleAllAgree(e.target.checked)} />
                  <span>약관 전체 동의</span>
                </label>

                {terms.map((term) => (
                  <div className="term-item" key={term.id}>
                    <div className="term-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={agreements[term.id]}
                          onChange={(e) => handleAgreement(term.id, e.target.checked)}
                        />
                        <span>{term.required ? '[필수]' : '[선택]'} {term.title}</span>
                      </label>
                      <button type="button" onClick={() => setOpenTerm(openTerm === term.id ? '' : term.id)}>
                        {openTerm === term.id ? '닫기' : '보기'}
                      </button>
                    </div>
                    {openTerm === term.id && <p className="term-body">{term.body}</p>}
                  </div>
                ))}
              </div>

              <SubmitButton loading={loading} disabled={!requiredAccepted}>가입하기</SubmitButton>
            </form>
          )}

          {mode === 'reset' && resetStep === 'email' && (
            <form onSubmit={handleSendResetCode} className="auth-form">
              <Field label="가입 이메일" type="email" value={email} onChange={setEmail} placeholder="name@cam.hs.kr" autoComplete="email" />
              <SubmitButton loading={loading}>인증번호 받기</SubmitButton>
            </form>
          )}

          {mode === 'reset' && resetStep === 'code' && (
            <form onSubmit={handleConfirmReset} className="auth-form">
              <Field label="이메일" type="email" value={email} onChange={setEmail} placeholder="name@cam.hs.kr" autoComplete="email" />
              <Field label="인증번호" type="text" value={code} onChange={setCode} placeholder="6자리 숫자" autoComplete="one-time-code" />
              <Field label="새 비밀번호" type="password" value={newPassword} onChange={setNewPassword} placeholder="8자 이상" autoComplete="new-password" />
              <SubmitButton loading={loading}>비밀번호 변경</SubmitButton>
              <button className="text-button" type="button" onClick={() => setResetStep('email')}>이메일 다시 입력</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}

function SubmitButton({ children, loading, disabled = false }) {
  return (
    <button className="primary-button" type="submit" disabled={loading || disabled}>
      {loading ? '처리 중...' : children}
    </button>
  );
}
