import { useState, useRef, useEffect } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [lit, setLit] = useState(false);
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [agreed1, setAgreed1] = useState(false);
  const [agreed2, setAgreed2] = useState(false);
  const [agreed3, setAgreed3] = useState(false);
  const [showTerms1, setShowTerms1] = useState(false);
  const [showTerms2, setShowTerms2] = useState(false);
  const [showTerms3, setShowTerms3] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/');
  }, []);

  useEffect(() => {
    setAgreed(agreed1 && agreed2);
  }, [agreed1, agreed2]);

  const handleAllAgree = (checked) => {
    setAgreed(checked);
    setAgreed1(checked);
    setAgreed2(checked);
    setAgreed3(checked);
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || '로그인 실패');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (!agreed1 || !agreed2) { setError('필수 약관에 동의해주세요.'); setLoading(false); return; }
    try {
      await api.post('/api/auth/register', { email, password, username, privacy_consented: agreed });
      setSuccess('가입 완료! 로그인해주세요.'); setTab('login');
    } catch (err) {
      setError(err.response?.data?.detail || '가입 실패');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap" rel="stylesheet" />

      <div style={{ width: '42%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <LampSection lit={lit} setLit={setLit} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, opacity: lit ? 1 : 0, transform: lit ? 'translateX(0) scale(1)' : 'translateX(30px) scale(0.97)', transition: 'opacity .7s ease, transform .7s ease', pointerEvents: lit ? 'all' : 'none' }}>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffe566', boxShadow: '0 0 10px rgba(255,229,102,.6)', flexShrink: 0 }} />
              <div style={{ fontSize: 24, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-.5px' }}>AET 동아리</div>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.18)', letterSpacing: '.16em', textTransform: 'uppercase', paddingLeft: 18 }}>AI Engineering Team</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.02) 100%)', border: '1px solid rgba(255,210,60,.12)', borderRadius: 20, padding: '32px 32px 28px', backdropFilter: 'blur(20px)', boxShadow: '0 0 60px rgba(255,200,40,.06), inset 0 1px 0 rgba(255,255,255,.06)' }}>

            <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: 3 }}>
              {['login', 'register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                  style={{ flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', borderRadius: 8, background: tab === t ? 'rgba(255,210,60,.18)' : 'transparent', color: tab === t ? '#ffd43b' : 'rgba(255,255,255,.3)', transition: 'all .2s' }}>
                  {t === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, padding: '11px 14px', color: '#fca5a5', fontSize: 12, marginBottom: 16 }}>{error}</div>}
            {success && <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 8, padding: '11px 14px', color: '#86efac', fontSize: 12, marginBottom: 16 }}>{success}</div>}

            {tab === 'login' ? (
              <form onSubmit={handleLogin}>
                <Field label="이메일" type="email" value={email} onChange={setEmail} placeholder="학교 이메일" />
                <Field label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="비밀번호" />
                <div style={{ height: 20 }} />
                <Btn loading={loading}>로그인</Btn>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <Field label="학교 이메일" type="email" value={email} onChange={setEmail} placeholder="xxxx@cam.hs.kr" />
                <Field label="닉네임" type="text" value={username} onChange={setUsername} placeholder="닉네임" />
                <Field label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="8자 이상" />

                {/* 약관 동의 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px' }}>

                    {/* 전체 동의 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={agreed1 && agreed2 && agreed3} onChange={e => handleAllAgree(e.target.checked)} style={{ accentColor: '#ffd43b', width: 14, height: 14, cursor: 'pointer' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>전체 동의</span>
                      </label>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>필수 2개 · 선택 1개</span>
                    </div>

                    {/* 필수1 - 서비스 이용약관 */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={agreed1} onChange={e => setAgreed1(e.target.checked)} style={{ accentColor: '#ffd43b', width: 13, height: 13, cursor: 'pointer' }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}><span style={{ color: '#ffd43b' }}>[필수]</span> 서비스 이용약관 동의</span>
                        </label>
                        <button type="button" onClick={() => setShowTerms1(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer' }}>{showTerms1 ? '닫기' : '보기'}</button>
                      </div>
                      {showTerms1 && (
                        <div style={{ background: 'rgba(0,0,0,.4)', borderRadius: 7, padding: '12px 14px', marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.9, maxHeight: 200, overflowY: 'auto' }}>
                          <b style={{ color: 'rgba(255,255,255,.7)', display: 'block', marginBottom: 6 }}>AET 동아리 서비스 이용약관</b>
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제1조 (목적)</b><br />
                          본 약관은 AET(AI Engineering Team) 동아리(이하 "동아리")가 운영하는 웹 서비스(이하 "서비스")의 이용과 관련하여 동아리와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제2조 (용어의 정의)</b><br />
                          ① "서비스"란 동아리가 제공하는 팀 협업, 포트폴리오, AI 분석 등 모든 온라인 서비스를 말합니다.<br />
                          ② "회원"이란 서비스에 접속하여 본 약관에 동의하고 회원가입을 완료한 자를 말합니다.<br />
                          ③ "관리자"란 동아리 운영진으로서 서비스 관리 권한을 부여받은 자를 말합니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제3조 (약관의 효력 및 변경)</b><br />
                          ① 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.<br />
                          ② 동아리는 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위 내에서 약관을 변경할 수 있으며, 변경된 약관은 공지 후 효력이 발생합니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제4조 (서비스 이용)</b><br />
                          ① 서비스는 캠코더고등학교(@cam.hs.kr) 이메일 계정을 보유한 재학생 및 관리자로 지정된 자만 이용할 수 있습니다.<br />
                          ② 회원은 서비스 이용 시 다음 행위를 하여서는 안 됩니다.<br />
                          - 타인의 개인정보 무단 수집·이용<br />
                          - 서비스의 정상적인 운영을 방해하는 행위<br />
                          - 허위 정보 등록 및 타인 사칭<br />
                          - 동아리 활동 목적 외 서비스 이용<br />
                          - 저작권 등 타인의 권리 침해<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제5조 (게시물 관리)</b><br />
                          ① 회원이 서비스 내에 게시한 게시물의 저작권은 해당 회원에게 있습니다.<br />
                          ② 관리자는 다음 각 호에 해당하는 게시물을 사전 통보 없이 삭제할 수 있습니다.<br />
                          - 타인의 명예를 훼손하거나 모욕하는 내용<br />
                          - 동아리 운영 목적에 부적합한 내용<br />
                          - 관련 법령에 위반되는 내용<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제6조 (서비스 중단)</b><br />
                          동아리는 시스템 점검, 서버 장애 등 불가피한 사유로 서비스 제공을 일시 중단할 수 있으며, 이에 대해 사전 공지를 원칙으로 합니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제7조 (면책조항)</b><br />
                          동아리는 천재지변, 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다. 또한 회원 간의 분쟁에 대해 동아리는 개입 의무가 없으며 이로 인한 손해를 배상할 책임이 없습니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>제8조 (준거법 및 관할)</b><br />
                          본 약관과 관련된 분쟁에 대해서는 대한민국 법률을 적용하며, 관련 소송은 관할 법원에 제기합니다.
                        </div>
                      )}
                    </div>

                    {/* 필수2 - 개인정보 수집·이용 */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={agreed2} onChange={e => setAgreed2(e.target.checked)} style={{ accentColor: '#ffd43b', width: 13, height: 13, cursor: 'pointer' }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}><span style={{ color: '#ffd43b' }}>[필수]</span> 개인정보 수집·이용 동의</span>
                        </label>
                        <button type="button" onClick={() => setShowTerms2(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer' }}>{showTerms2 ? '닫기' : '보기'}</button>
                      </div>
                      {showTerms2 && (
                        <div style={{ background: 'rgba(0,0,0,.4)', borderRadius: 7, padding: '12px 14px', marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.9, maxHeight: 200, overflowY: 'auto' }}>
                          <b style={{ color: 'rgba(255,255,255,.7)', display: 'block', marginBottom: 6 }}>개인정보 수집·이용에 관한 동의</b>
                          「개인정보 보호법」 제15조 및 제22조에 따라 아래와 같이 개인정보를 수집·이용합니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>1. 수집하는 개인정보 항목</b><br />
                          · 필수항목: 이메일 주소, 닉네임, 암호화된 비밀번호<br />
                          · 자동수집: 서비스 이용기록, 접속 로그, IP 주소<br />
                          · 선택항목: 프로필 사진, 포트폴리오 내용(자기소개, 프로젝트, 기술, 수상내역, 목표), GitHub·블로그·Notion 링크<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>2. 개인정보 수집·이용 목적</b><br />
                          · 회원 식별 및 본인 확인<br />
                          · 동아리 서비스(팀 협업, 과제 제출, AI 분석, 포트폴리오) 제공<br />
                          · 부정 이용 방지 및 서비스 개선<br />
                          · 관리자의 회원 관리 및 동아리 운영<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>3. 개인정보 보유·이용 기간</b><br />
                          · 회원 탈퇴 시 즉시 파기 (단, 관련 법령에 따라 보존이 필요한 경우 해당 기간까지 보관)<br />
                          · 「전자상거래 등에서의 소비자 보호에 관한 법률」에 따른 보존 기간 준수<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>4. 개인정보의 제3자 제공</b><br />
                          동아리는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우에는 예외로 합니다.<br />
                          · 회원이 사전에 동의한 경우<br />
                          · 법령의 규정에 의하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>5. 개인정보 처리 위탁</b><br />
                          서비스 운영을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다.<br />
                          · Google Cloud Platform (서버 및 데이터 저장)<br />
                          · Groq Inc. (AI 분석 서비스, 분석 요청 시 입력 텍스트 전송)<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>6. 정보주체의 권리</b><br />
                          회원은 언제든지 다음의 권리를 행사할 수 있습니다.<br />
                          · 개인정보 열람 요청<br />
                          · 개인정보 정정·삭제 요청<br />
                          · 개인정보 처리 정지 요청<br />
                          · 회원 탈퇴를 통한 개인정보 파기 요청<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>7. 동의 거부 권리 및 불이익</b><br />
                          위 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 단, 필수 항목 동의를 거부하실 경우 서비스 이용이 불가합니다.<br /><br />
                          <b style={{ color: 'rgba(255,255,255,.55)' }}>8. 개인정보 보호책임자</b><br />
                          · 소속: AET 동아리 관리팀<br />
                          · 문의: 2620325@cam.hs.kr
                        </div>
                      )}
                    </div>

                    {/* 선택 - 알림 수신 */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={agreed3} onChange={e => setAgreed3(e.target.checked)} style={{ accentColor: '#ffd43b', width: 13, height: 13, cursor: 'pointer' }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}><span style={{ color: 'rgba(255,255,255,.25)' }}>[선택]</span> 서비스 알림 및 공지 수신 동의</span>
                        </label>
                        <button type="button" onClick={() => setShowTerms3(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer' }}>{showTerms3 ? '닫기' : '보기'}</button>
                      </div>
                      {showTerms3 && (
                        <div style={{ background: 'rgba(0,0,0,.4)', borderRadius: 7, padding: '12px 14px', marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.9, maxHeight: 120, overflowY: 'auto' }}>
                          <b style={{ color: 'rgba(255,255,255,.7)', display: 'block', marginBottom: 6 }}>서비스 알림 수신 동의 (선택)</b>
                          「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제50조에 따라 아래 내용에 대한 수신 동의를 받습니다.<br /><br />
                          · 동아리 공지사항 및 활동 안내<br />
                          · 과제 제출 기한 알림<br />
                          · 서비스 업데이트 및 변경 안내<br /><br />
                          본 동의는 선택사항으로, 동의하지 않으셔도 서비스 이용에 제한이 없습니다.<br />
                          수신 동의 후에도 언제든지 서비스 내 설정에서 철회하실 수 있습니다.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Btn loading={loading} disabled={!agreed1 || !agreed2}>가입하기</Btn>
              </form>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.1)', textAlign: 'center', marginTop: 18, fontFamily: 'DM Mono, monospace', letterSpacing: '.04em' }}>@cam.hs.kr 이메일로만 가입 가능</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.22)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'DM Mono, monospace' }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '11px 14px', background: focused ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)', border: '1px solid', borderColor: focused ? 'rgba(255,210,60,.4)' : 'rgba(255,255,255,.08)', borderRadius: 8, color: '#e0e0e0', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'all .2s' }} />
    </div>
  );
}

function Btn({ children, loading, disabled }) {
  return (
    <button type="submit" disabled={loading || disabled}
      style={{ width: '100%', padding: '13px 0', background: disabled ? 'transparent' : 'rgba(255,210,60,.1)', border: '1px solid', borderColor: disabled ? 'rgba(255,210,60,.1)' : 'rgba(255,210,60,.45)', borderRadius: 999, color: disabled ? 'rgba(255,212,60,.2)' : '#ffd43b', fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '.06em', transition: 'all .2s', boxShadow: disabled ? 'none' : '0 0 24px rgba(255,210,60,.1)' }}>
      {loading ? '처리 중...' : children}
    </button>
  );
}

function LampSection({ lit, setLit }) {
  const [pull, setPull] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);

  const getY = (e) => e.touches ? e.touches[0].clientY : e.clientY;
  const onDown = (e) => { dragging.current = true; startY.current = getY(e); e.preventDefault(); };
  const onMove = (e) => {
    if (!dragging.current) return;
    setPull(Math.max(0, Math.min(60, getY(e) - startY.current)));
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (pull > 22) setLit(l => !l);
    setPull(0);
  };

  const cordStartX = 226, cordStartY = 168;
  const cordEndY = cordStartY + 60 + pull;
  const cordD = `M${cordStartX},${cordStartY} Q${cordStartX + pull * 0.08},${cordStartY + 20 + pull * 0.3} ${cordStartX},${cordStartY + 40 + pull * 0.5} Q${cordStartX - pull * 0.06},${cordStartY + 52 + pull * 0.6} ${cordStartX},${cordEndY}`;

  return (
    <div style={{ position: 'relative', width: 320, userSelect: 'none' }}
      onMouseMove={onMove} onMouseUp={onUp} onTouchMove={onMove} onTouchEnd={onUp}>
      <div style={{ position: 'absolute', bottom: 10, left: '45%', transform: 'translateX(-50%)', width: 260, height: 100, borderRadius: '50%', background: lit ? 'radial-gradient(ellipse, rgba(255,200,50,.18) 0%, transparent 70%)' : 'none', transition: 'background 1.2s ease', pointerEvents: 'none' }} />
      <svg viewBox="0 0 320 320" width="320" style={{ filter: lit ? 'drop-shadow(0 -28px 55px rgba(255,200,40,.8)) drop-shadow(0 -8px 20px rgba(255,220,80,.45))' : 'none', transition: 'filter 1.2s ease', overflow: 'visible' }}>
        <defs>
          <radialGradient id="dOff" cx="45%" cy="30%" r="65%"><stop offset="0%" stopColor="#1e1e1e" /><stop offset="100%" stopColor="#0d0d0d" /></radialGradient>
          <radialGradient id="dOn" cx="42%" cy="28%" r="68%"><stop offset="0%" stopColor="#fffdf0" /><stop offset="30%" stopColor="#fff5b0" /><stop offset="65%" stopColor="#f0c830" /><stop offset="100%" stopColor="#c8980c" /></radialGradient>
          <linearGradient id="sOff" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#161616" /><stop offset="50%" stopColor="#1e1e1e" /><stop offset="100%" stopColor="#131313" /></linearGradient>
          <linearGradient id="sOn" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a07810" /><stop offset="50%" stopColor="#e0b828" /><stop offset="100%" stopColor="#906808" /></linearGradient>
          <radialGradient id="bOff" cx="50%" cy="35%" r="55%"><stop offset="0%" stopColor="#1a1a1a" /><stop offset="100%" stopColor="#0c0c0c" /></radialGradient>
          <radialGradient id="bOn" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#c89818" /><stop offset="60%" stopColor="#906808" /><stop offset="100%" stopColor="#503800" /></radialGradient>
        </defs>
        <ellipse cx="148" cy="300" rx="66" ry="15" fill={lit ? 'url(#bOn)' : 'url(#bOff)'} stroke="rgba(255,255,255,.04)" strokeWidth="0.7" style={{ transition: 'fill 1.2s' }} />
        <path d="M132,190 Q133,228 132,272 Q138,285 148,287 Q158,285 164,272 Q163,226 162,190 Z" fill={lit ? 'url(#sOn)' : 'url(#sOff)'} stroke="rgba(255,255,255,.03)" strokeWidth="0.5" style={{ transition: 'fill 1.2s' }} />
        <path d="M36,168 Q34,128 50,104 Q74,66 122,50 Q138,44 150,42 Q162,42 174,48 Q220,64 238,102 Q252,128 250,164 Q248,180 234,190 Q212,200 178,204 Q162,207 148,207 Q134,207 118,204 Q82,199 60,188 Q36,178 36,168 Z" fill={lit ? 'url(#dOn)' : 'url(#dOff)'} stroke="rgba(255,255,255,.06)" strokeWidth="0.8" style={{ transition: 'fill 1.2s' }} />
        <path d="M76,96 Q110,70 150,64 Q190,66 220,86" fill="none" stroke={lit ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.04)'} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 1.2s' }} />
        <path d={cordD} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" strokeLinecap="round" style={{ transition: pull === 0 ? 'all .4s ease' : 'none' }} />
        <g transform={`translate(0,${pull})`} style={{ transition: pull === 0 ? 'transform .4s ease' : 'none' }}>
          <circle cx={cordStartX} cy={cordStartY + 62} r="18" fill="transparent" onMouseDown={onDown} onTouchStart={onDown} style={{ cursor: 'grab' }} />
          <circle cx={cordStartX} cy={cordStartY + 62} r="5" fill="rgba(255,255,255,.35)" stroke="rgba(255,255,255,.15)" strokeWidth="0.8" style={{ pointerEvents: 'none' }} />
          <circle cx={cordStartX} cy={cordStartY + 62} r="2.5" fill="rgba(255,255,255,.7)" style={{ pointerEvents: 'none' }} />
        </g>
      </svg>
    </div>
  );
}