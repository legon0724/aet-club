import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const terms = [
  {
    id: 'service',
    required: true,
    title: '서비스 이용약관',
    body: 'AET 홈페이지는 동아리 활동, 공지, 팀 협업, 포트폴리오 관리를 위한 서비스입니다. 가입한 사용자는 본인 계정으로만 이용해야 하며, 허위 정보 등록이나 동아리 활동과 무관한 게시물 작성은 제한될 수 있습니다.',
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

export default function LoginPage() {
  const [tab, setTab] = useState('login');
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

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/');
  }, [navigate]);

  const helperText = useMemo(() => {
    if (tab === 'login') return '동아리 계정으로 공지, 팀 공간, 포트폴리오를 이어서 관리하세요.';
    return '@cam.hs.kr 학교 이메일로 가입할 수 있습니다.';
  }, [tab]);

  const resetMessage = () => {
    setError('');
    setSuccess('');
  };

  const switchTab = (nextTab) => {
    setTab(nextTab);
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
    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || '이메일과 비밀번호를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    resetMessage();

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
      setTab('login');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || '가입 정보를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="AET 소개">
        <div className="brand-mark">AET</div>
        <p className="auth-eyebrow">AI Engineering Team</p>
        <h1>동아리 활동과 포트폴리오를 한곳에서 관리합니다.</h1>
        <p className="auth-copy">
          공지 확인, 팀 프로젝트 협업, 생기부 분석, 개인 포트폴리오 정리를
          동아리 구성원이 함께 쓰기 좋게 묶었습니다.
        </p>
        <div className="auth-stats" aria-label="주요 기능">
          <span>공지</span>
          <span>팀 공간</span>
          <span>포트폴리오</span>
          <span>AI 분석</span>
        </div>
      </section>

      <section className="auth-panel" aria-label={tab === 'login' ? '로그인' : '회원가입'}>
        <div className="auth-card">
          <div className="auth-card-head">
            <div>
              <p className="auth-kicker">{tab === 'login' ? 'Welcome back' : 'Create account'}</p>
              <h2>{tab === 'login' ? '로그인' : '회원가입'}</h2>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="인증 방식 선택">
              <button type="button" className={tab === 'login' ? 'active' : ''} onClick={() => switchTab('login')}>로그인</button>
              <button type="button" className={tab === 'register' ? 'active' : ''} onClick={() => switchTab('register')}>가입</button>
            </div>
          </div>

          <p className="auth-helper">{helperText}</p>

          {error && <div className="form-alert error">{error}</div>}
          {success && <div className="form-alert success">{success}</div>}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form">
              <Field label="이메일" type="email" value={email} onChange={setEmail} placeholder="name@cam.hs.kr" autoComplete="email" />
              <Field label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="비밀번호" autoComplete="current-password" />
              <SubmitButton loading={loading}>로그인</SubmitButton>
            </form>
          ) : (
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
