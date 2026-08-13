import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import heroImage from '../assets/hero.png';
import { applyCachedUserBackground, applyUserBackground } from '../utils/background';
import {
  LOCAL_RESET_KEY,
  LOCAL_RESET_VERSION,
  LOCAL_RESET_VERSION_KEY,
  LOCAL_USERS_KEY,
  clearLocalSession,
  isSchoolEmail,
  rememberCurrentUser,
} from '../utils/localAuth';

const terms = [
  {
    id: 'service',
    required: true,
    title: '서비스 이용약관',
    body: 'NC는 동아리 활동, 공지, 과제, 포트폴리오 관리를 위한 서비스입니다. 가입한 사용자는 본인 계정으로만 이용해야 하며, 허위 정보 등록이나 동아리 활동과 무관한 게시물 작성은 제한될 수 있습니다.',
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
    tab: '초기화 요청',
    eyebrow: 'Admin reset',
    title: '비밀번호 초기화 요청',
    helper: '가입 이메일을 입력하면 관리자가 임시 비밀번호를 발급합니다.',
  },
};

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    const token = localStorage.getItem('token');
    if (token?.startsWith('local:')) {
      clearLocalSession();
      return;
    }
    if (token) navigate('/');
  }, [navigate]);

  const resetMessage = () => {
    setError('');
    setSuccess('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
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

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await api.post('/api/auth/login', { email: normalizedEmail, password });
      localStorage.setItem('token', res.data.access_token);
      const me = await api.get('/api/auth/me', { cache: false });
      const signedInUser = rememberCurrentUser(me.data);
      applyCachedUserBackground(signedInUser.id);
      try {
        const background = await api.get('/api/auth/me/background', { cache: false });
        applyUserBackground(background.data.background_image, signedInUser.id);
      } catch {
        // A temporary background failure must never block a successful login.
      }
      navigate(signedInUser.must_change_password ? '/password-change' : '/');
    } catch (err) {
      clearLocalSession();
      applyUserBackground(null);
      setError(err.response?.data?.detail || '서버 연결에 실패했습니다. 잠시 후 다시 로그인해주세요.');
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

    const normalizedEmail = email.trim().toLowerCase();

    try {
      await api.post('/api/auth/register', {
        email: normalizedEmail,
        password,
        username: username.trim(),
        privacy_consented: agreements.privacy,
      });
      setSuccess('가입이 완료되었습니다. 이제 로그인해주세요.');
      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || '서버에 가입 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    resetMessage();

    if (!isSchoolEmail(email)) {
      setError('@cam.hs.kr 학교 이메일만 재설정할 수 있습니다.');
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      await api.post('/api/auth/password-reset/request', { email: normalizedEmail });
      setSuccess('초기화 요청을 보냈습니다. 관리자에게 임시 비밀번호를 받아 로그인해주세요.');
    } catch (err) {
      setError(err.response?.data?.detail || '초기화 요청을 보내지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page nc-editorial nc-login-stage">
      <section className="editorial-scene" aria-label="NC 소개">
        <div className="editorial-nav">
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
            <img src={heroImage} alt="" decoding="async" />
            <div className="paper-character">
              <span className="character-head" />
              <span className="character-body" />
              <span className="character-arm left" />
              <span className="character-arm right" />
              <span className="character-shadow" />
            </div>
          </div>
        </div>
      </section>

      <section className="editorial-form-wrap" aria-label={copy.title}>
        <div className="editorial-form">
          <div className="form-title">
            <strong>NC Club</strong>
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

          {mode === 'reset' && (
            <form onSubmit={handleResetRequest} className="auth-form">
              <Field label="가입 이메일" type="email" value={email} onChange={setEmail} placeholder="name@cam.hs.kr" autoComplete="email" />
              <SubmitButton loading={loading}>관리자에게 초기화 요청</SubmitButton>
              <p className="reset-request-help">관리자가 발급한 임시 비밀번호는 관리자에게 직접 전달받으세요.</p>
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
