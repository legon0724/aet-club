import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { showSiteAlert, showSiteConfirm } from '../utils/siteDialog';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
const emptyForm = { title: '', start_date: '', end_date: '', event_type: '개인' };

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateTimeValue(date) {
  return `${dateKey(date)}T09:00`;
}

function monthCells(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function CalendarPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [events, setEvents] = useState([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [form, setForm] = useState(() => ({ ...emptyForm, start_date: dateTimeValue(new Date()) }));
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEvents = () => api.get('/api/calendar/').then((response) => setEvents(response.data || []));

  useEffect(() => {
    api.get('/api/auth/me').then((response) => setUser(rememberCurrentUser(response.data))).catch(() => {});
    loadEvents().catch(() => setEvents([]));
  }, []);

  const cells = useMemo(() => monthCells(month), [month]);
  const groupedEvents = useMemo(() => events.reduce((result, event) => {
    const key = dateKey(event.start_date);
    if (!result[key]) result[key] = [];
    result[key].push(event);
    return result;
  }, {}), [events]);
  const selectedEvents = groupedEvents[dateKey(selectedDate)] || [];

  const moveMonth = (amount) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next);
    setSelectedDate(next);
  };

  const chooseDate = (date) => {
    setSelectedDate(date);
    setForm((current) => ({ ...current, start_date: dateTimeValue(date) }));
  };

  const create = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.start_date || saving) return;
    setSaving(true);
    try {
      const response = await api.post('/api/calendar/personal', { ...form, title: form.title.trim() });
      setEvents((current) => [...current, response.data].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)));
      setForm({ ...emptyForm, start_date: dateTimeValue(selectedDate) });
      setShowForm(false);
    } catch (error) {
      void showSiteAlert(error?.response?.data?.detail || '일정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (event) => {
    if (!event.editable || !(await showSiteConfirm('이 개인 일정을 삭제할까요?', '개인 일정 삭제'))) return;
    const previous = events;
    setEvents((current) => current.filter((item) => item.id !== event.id));
    try {
      await api.delete(`/api/calendar/personal/${event.id}`);
    } catch (error) {
      setEvents(previous);
      void showSiteAlert(error?.response?.data?.detail || '일정을 삭제하지 못했습니다.');
    }
  };

  return (
    <div className="app-shell workspace-shell calendar-shell">
      <Navbar user={user} />
      <main className="workspace-page calendar-page">
        <header className="calendar-hero">
          <div>
            <span>NC CALENDAR</span>
            <h1>내 캘린더</h1>
            <p>내 일정은 나만 볼 수 있고, 관리자 일정은 모든 회원에게 읽기 전용으로 표시됩니다.</p>
          </div>
          <button className="modern-btn primary" type="button" onClick={() => setShowForm((current) => !current)}>
            {showForm ? '닫기' : '＋ 개인 일정'}
          </button>
        </header>

        {showForm && (
          <form className="calendar-create-card" onSubmit={create}>
            <input aria-label="일정 제목" placeholder="일정 제목" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
            <input aria-label="시작 날짜" type="datetime-local" value={form.start_date} onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))} />
            <input aria-label="종료 날짜" type="datetime-local" value={form.end_date} onChange={(e) => setForm((current) => ({ ...current, end_date: e.target.value }))} />
            <select aria-label="일정 종류" value={form.event_type} onChange={(e) => setForm((current) => ({ ...current, event_type: e.target.value }))}>
              <option value="개인">개인</option>
              <option value="공부">공부</option>
              <option value="준비">준비</option>
              <option value="기타">기타</option>
            </select>
            <button className="modern-btn primary" type="submit" disabled={saving}>{saving ? '저장 중…' : '내 캘린더에 저장'}</button>
          </form>
        )}

        <section className="calendar-layout">
          <div className="calendar-board">
            <header className="calendar-month-head">
              <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
              <strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
              <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
            </header>
            <div className="calendar-week-row">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-day-grid">
              {cells.map((date) => {
                const key = dateKey(date);
                const dayEvents = groupedEvents[key] || [];
                const outside = date.getMonth() !== month.getMonth();
                const selected = key === dateKey(selectedDate);
                return (
                  <button key={key} type="button" className={`${outside ? 'outside ' : ''}${selected ? 'selected' : ''}`} onClick={() => chooseDate(date)}>
                    <time>{date.getDate()}</time>
                    <span className="calendar-dots">
                      {dayEvents.slice(0, 3).map((item) => <i key={item.id} className={item.is_public ? 'public' : 'personal'} />)}
                    </span>
                    {dayEvents.length > 0 && <small>{dayEvents.length}개</small>}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-agenda">
            <header>
              <span>{selectedDate.toLocaleDateString('ko-KR', { weekday: 'long' })}</span>
              <strong>{selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</strong>
            </header>
            <div className="calendar-agenda-list">
              {selectedEvents.length === 0 && <p>등록된 일정이 없습니다.</p>}
              {selectedEvents.map((event) => (
                <article key={event.id} className={event.is_public ? 'public' : 'personal'}>
                  <div>
                    <span>{event.is_public ? '관리자 일정 · 수정 불가' : '나만 보는 일정'}</span>
                    <strong>{event.title}</strong>
                    <small>{new Date(event.start_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}{event.end_date ? ` – ${new Date(event.end_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}</small>
                  </div>
                  {event.editable && <button type="button" onClick={() => remove(event)}>삭제</button>}
                  {event.is_public && <span className="calendar-lock" aria-label="읽기 전용">🔒</span>}
                </article>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
