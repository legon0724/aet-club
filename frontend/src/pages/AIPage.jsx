import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';
import { buildLocalAnalysis, getLocalAIUsage, increaseLocalAIUsage } from '../utils/localWorkspace';

const admissionOptions = [
  '학생부종합전형',
  '학생부교과전형',
  '논술전형',
  '실기전형',
  '정시(수능)',
  '특기자전형',
  '농어촌전형',
  '기회균형전형',
  '사회배려대상자전형',
  '재외국민전형',
];

export default function AIPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [usage, setUsage] = useState(() => getLocalAIUsage(getCurrentLocalUser()));
  const [form, setForm] = useState({ record_text: '', target_major: '', target_university: '', target_admission: '' });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/api/auth/me').then((r) => {
      const remembered = rememberCurrentUser(r.data);
      setUser(remembered);
      setUsage(getLocalAIUsage(remembered));
    }).catch(() => {});
    api.get('/api/ai/usage').then((r) => setUsage(r.data)).catch(() => {});
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
      } else if (['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'ppt', 'pptx'].includes(ext)) {
        combined += `\n[첨부 파일: ${file.name} - 핵심 내용을 아래 입력칸에 함께 적어 주세요]\n`;
      }
    }

    setFileName(names.join(', '));
    if (combined) setForm((current) => ({ ...current, record_text: `${current.record_text}\n${combined}`.trim() }));
    setFileLoading(false);
  };

  const analyze = async () => {
    if (!form.record_text.trim() || !form.target_major.trim()) {
      setError('생기부 내용과 목표 학과를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      const res = await api.post('/api/ai/analyze', form);
      setResult(res.data.result);
      setUsage((current) => ({ ...current, used: current.used + 1, remaining: Math.max(current.remaining - 1, 0) }));
    } catch (e) {
      const activeUser = user || getCurrentLocalUser();
      setResult(buildLocalAnalysis(form));
      setUsage(increaseLocalAIUsage(activeUser));
      if (e.response?.data?.detail && e.response.status < 500) {
        setError(e.response.data.detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="workspace-page ai-page">
        <section className="page-hero compact">
          <div>
            <span>AI Analysis</span>
            <h1>생기부 문장을 입학사정관 관점으로 정리합니다.</h1>
            <p>목표 학과, 전형, 활동 기록을 넣으면 강점과 보완 방향을 바로 확인할 수 있습니다.</p>
          </div>
          <div className="usage-card">
            <strong>{usage.remaining}</strong>
            <span>오늘 남은 횟수 / {usage.limit}</span>
          </div>
        </section>

        <section className="ai-layout">
          <div className="workspace-card analysis-form">
            <div className="form-grid">
              <label>
                <span>목표 학과</span>
                <input value={form.target_major} onChange={(e) => setForm((current) => ({ ...current, target_major: e.target.value }))} placeholder="예: 컴퓨터공학과" />
              </label>
              <label>
                <span>목표 대학</span>
                <input value={form.target_university} onChange={(e) => setForm((current) => ({ ...current, target_university: e.target.value }))} placeholder="예: 서울대학교" />
              </label>
            </div>

            <div className="option-group">
              <span>관심 전형</span>
              <div>
                {admissionOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={form.target_admission === option ? 'active' : ''}
                    onClick={() => setForm((current) => ({ ...current, target_admission: current.target_admission === option ? '' : option }))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button className="upload-zone" type="button" onClick={() => fileRef.current?.click()}>
              <strong>{fileLoading ? '처리 중...' : fileName || '파일 업로드'}</strong>
              <span>txt, md, pdf, hwp, docx, pptx, 이미지 파일</span>
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md,.jpg,.jpeg,.png,.webp,.pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx" onChange={handleFile} hidden multiple />

            <label className="record-field">
              <span>생기부 / 활동 내역</span>
              <textarea
                value={form.record_text}
                onChange={(e) => setForm((current) => ({ ...current, record_text: e.target.value }))}
                placeholder="활동 내용, 프로젝트, 수상 경력, 느낀 점을 붙여넣어 주세요."
                rows={12}
              />
            </label>

            {error && <div className="inline-alert error">{error}</div>}
            <button className="modern-btn primary wide" type="button" onClick={analyze} disabled={loading || usage.remaining <= 0}>
              {loading ? '분석 중...' : '분석 시작'}
            </button>
          </div>

          <aside className="workspace-card analysis-result">
            <div className="card-head">
              <span>Result</span>
              <strong>분석 결과</strong>
            </div>
            {result ? (
              <pre>{result}</pre>
            ) : (
              <p className="empty-copy">입력값을 채우고 분석을 시작하면 결과가 여기에 표시됩니다.</p>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
