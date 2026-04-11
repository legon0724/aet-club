import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

export default function AIPage() {
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState({ used: 0, remaining: 5, limit: 5 });
  const [form, setForm] = useState({ record_text: '', target_major: '', target_university: '', target_admission: '' });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me').then(r => setUser(r.data)).catch(() => navigate('/login'));
    api.get('/api/ai/usage').then(r => setUsage(r.data)).catch(() => {});
  }, []);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setFileLoading(true);

    let combined = '';
    const names = [];

    for (const file of files) {
      names.push(file.name);
      const ext = file.name.split('.').pop().toLowerCase();
      if (['txt', 'md'].includes(ext)) {
        const text = await file.text();
        combined += `\n[파일: ${file.name}]\n${text}\n`;
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        combined += `\n[이미지 파일: ${file.name}]\n`;
      } else if (ext === 'pdf') {
        combined += `\n[PDF 파일: ${file.name} - 텍스트를 직접 붙여넣기 해주세요]\n`;
      }
    }

    setFileName(names.join(', '));
    if (combined) setForm(f => ({ ...f, record_text: (f.record_text + combined).trim() }));
    setFileLoading(false);
  };

  const analyze = async () => {
    if (!form.record_text || !form.target_major) { setError('생기부 내용과 목표 학과를 입력해주세요.'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await api.post('/api/ai/analyze', form);
      setResult(res.data.result);
      setUsage(u => ({ ...u, used: u.used + 1, remaining: u.remaining - 1 }));
    } catch (e) {
      setError(e.response?.data?.detail || '분석 실패');
    } finally { setLoading(false); }
  };

  const admissionOptions = ['학생부종합전형', '학생부교과전형', '논술전형', '실기전형',
  '정시(수능)', '특기자전형', '농어촌전형', '기회균형전형',
  '사회배려대상자전형', '재외국민전형'];

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>AI 생기부 분석</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>카이스트·서울대 입학사정관 관점 분석 · 오늘 남은 횟수: {usage.remaining}/{usage.limit}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={labelStyle}>목표 학과 *</div>
            <input value={form.target_major} onChange={e => setForm(f => ({ ...f, target_major: e.target.value }))} placeholder="예: 컴퓨터공학과" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>목표 대학 (선택)</div>
            <input value={form.target_university} onChange={e => setForm(f => ({ ...f, target_university: e.target.value }))} placeholder="예: 서울대학교" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>관심 전형 (선택)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {admissionOptions.map(opt => (
              <button key={opt} onClick={() => setForm(f => ({ ...f, target_admission: f.target_admission === opt ? '' : opt }))}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'all .2s', background: form.target_admission === opt ? 'rgba(255,210,60,.15)' : 'rgba(255,255,255,.03)', borderColor: form.target_admission === opt ? 'rgba(255,210,60,.4)' : 'rgba(255,255,255,.08)', color: form.target_admission === opt ? '#ffd43b' : 'rgba(255,255,255,.5)' }}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>파일 업로드 (여러 개 가능)</div>
          <div onClick={() => fileRef.current.click()}
            style={{ border: '1px dashed rgba(255,255,255,.15)', borderRadius: 8, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,210,60,.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'}>
            <span style={{ fontSize: 18 }}>📎</span>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{fileLoading ? '처리 중...' : fileName || '파일 클릭하여 업로드 (여러 개 선택 가능)'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>txt, jpg, png 지원 · Ctrl 또는 Shift로 여러 개 선택</div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.jpg,.jpeg,.png,.webp" onChange={handleFile} style={{ display: 'none' }} multiple />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>생기부 / 활동 내역 *</div>
          <textarea value={form.record_text} onChange={e => setForm(f => ({ ...f, record_text: e.target.value }))}
            placeholder="생활기록부 내용, 활동 내역, 수상 경력 등을 입력하세요..."
            rows={10} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <button onClick={analyze} disabled={loading || usage.remaining <= 0}
          style={{ padding: '12px 28px', background: usage.remaining <= 0 ? 'transparent' : 'rgba(255,210,60,.12)', border: '1px solid', borderColor: usage.remaining <= 0 ? 'rgba(255,255,255,.1)' : 'rgba(255,210,60,.4)', borderRadius: 10, color: usage.remaining <= 0 ? 'rgba(255,255,255,.3)' : '#ffd43b', fontSize: 14, fontWeight: 500, cursor: usage.remaining <= 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? '분석 중...' : usage.remaining <= 0 ? '오늘 횟수 초과' : '분석 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>분석 결과</div>
            <div style={{ fontSize: 14, color: '#c0c0c0', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 7 };
const inputStyle = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#e0e0e0', fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' };