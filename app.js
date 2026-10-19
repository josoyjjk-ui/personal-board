// 불개미 Personal Board — phase 1
// 로그인: fireant-hub(Supabase) 구글 로그인. 허용 = @bridge34.com 전원 + josoyjjk@gmail.com, '가족'은 오너 2계정만.
// 실제 보안은 DB RLS(sql/001_personal_tasks.sql). 화면 게이트는 편의용.

const HUB_URL = 'https://jcuuvazpexyinjjruplc.supabase.co';
const HUB_KEY = 'sb_publishable_mRNYq6Yq9UaYT3bydRhG1w_6wswYTd4';
const B34_REST = 'https://upuvwvpnsinqonvszify.supabase.co/rest/v1';
const B34_KEY = 'sb_publishable_Xa4mx6eGxwbvUw5BOlJKLQ_Zf8DnnzA';
const OWNERS = ['fireant@bridge34.com', 'josoyjjk@gmail.com'];
const CAMPAIGN_END = '2026-12-23';
const MOCK = new URLSearchParams(location.search).has('mock');

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isMember = (e) => { e = (e || '').toLowerCase(); return OWNERS.includes(e) || /^[^@\s]+@bridge34\.com$/.test(e); };
const isOwner = (e) => OWNERS.includes((e || '').toLowerCase());

const sb = window.supabase.createClient(HUB_URL, HUB_KEY);
let me = null;
let mockTasks = [
  { id: 'm1', area: '불개미', title: '[MOCK] 코인과세유예 공지 초안', due: null, done: false },
  { id: 'm2', area: '불개미', title: '[MOCK] 이벤트 리워드 지급', due: addDays(kstToday(), 2), done: false },
  { id: 'm3', area: '가족', title: '[MOCK] 병원 예약', due: addDays(kstToday(), 2), done: false },
  { id: 'm4', area: '가족', title: '[MOCK] 관리비 확인', due: addDays(kstToday(), 6), done: false },
];

// ── 날짜 유틸 (KST) ──
function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysUntil(iso) { return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(kstToday() + 'T00:00:00Z')) / 864e5); }
function md(iso) { if (!iso) return '-'; const [, m, d] = iso.slice(0, 10).split('-'); return `${+m}/${+d}`; }
function dday(iso, done) {
  if (done) return '<span class="dday ok">완료</span>';
  if (!iso) return '<span class="muted">-</span>';
  const n = daysUntil(iso);
  if (n < 0) return `<span class="dday red">${-n}일 지남</span>`;
  const cls = n <= 3 ? 'amber' : '';
  return `<span class="dday ${cls}">${n === 0 ? '오늘' : 'D-' + n}</span>`;
}

// ── 데이터 ──
async function b34(path) {
  const r = await fetch(B34_REST + path, { headers: { apikey: B34_KEY, Authorization: 'Bearer ' + B34_KEY } });
  if (!r.ok) throw new Error('b34 ' + r.status);
  return r.json();
}
async function loadTasks() {
  if (MOCK) return mockTasks;
  const { data, error } = await sb.from('personal_tasks').select('id,area,title,due,done')
    .order('done', { ascending: true }).order('due', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
  if (error) { console.warn('tasks', error); return []; }
  return data || [];
}
async function addTask(area, title, due) {
  if (MOCK) { mockTasks.push({ id: 'm' + Date.now(), area, title, due: due || null, done: false }); return true; }
  const { error } = await sb.from('personal_tasks').insert({ area, title, due: due || null });
  if (error) alert('저장 실패: ' + error.message);
  return !error;
}
async function setDone(id, done) {
  if (MOCK) { const t = mockTasks.find((x) => x.id === id); if (t) t.done = done; return; }
  const { error } = await sb.from('personal_tasks').update({ done }).eq('id', id);
  if (error) alert('저장 실패: ' + error.message);
}
async function delTask(id) {
  if (MOCK) { mockTasks = mockTasks.filter((x) => x.id !== id); return; }
  const { error } = await sb.from('personal_tasks').delete().eq('id', id);
  if (error) alert('삭제 실패: ' + error.message);
}
async function autoAntRows() {
  const rows = [];
  try {
    const r = await fetch('https://antinfo.io/daily-report-data.json?t=' + Date.now());
    const d = await r.json();
    const t = kstToday().replace(/-/g, '.');
    const ok = String(d.date || '').startsWith(t);
    rows.push({ title: '14:30 일일시황 발행', tag: '시황', due: '오늘', state: ok ? '<span class="dday ok">완료</span>' : '<span class="dday amber">미발행</span>' });
  } catch { /* 무시 */ }
  const n = daysUntil(CAMPAIGN_END);
  rows.push({ title: '코인과세유예 SNS 캠페인 응모', tag: '캠페인', due: md(CAMPAIGN_END), state: `<span class="dday">${n >= 0 ? 'D-' + n : '종료'}</span>` });
  try {
    const r = await fetch('https://antinfo.io/data/donations.json?t=' + Date.now());
    const d = await r.json();
    const list = d.donations || [];
    const sum = list.reduce((s, x) => s + (+x.amount_usd || 0), 0);
    rows.push({ title: `후원 리더보드 $${sum.toLocaleString('en-US')} · ${list.length}건`, tag: '후원', due: '수시', state: '<a href="https://antinfo.io/donate" target="_blank" class="muted">보기 ↗</a>' });
  } catch { /* 무시 */ }
  return rows;
}

// ── 렌더 ──
function taskRow(t, withTag) {
  return `<tr class="${t.done ? 'done' : ''}" data-id="${esc(t.id)}">
    <td style="text-align:center"><input type="checkbox" class="chk" ${t.done ? 'checked' : ''} data-act="done"></td>
    <td class="client-name">${esc(t.title)}</td>
    ${withTag ? '<td><span class="area a-ant">할 일</span></td>' : ''}
    <td>${md(t.due)}</td><td>${dday(t.due, t.done)}</td>
    <td><button class="del" data-act="del" title="삭제">✕</button></td></tr>`;
}
function renderTasks(tasks, auto) {
  const ant = tasks.filter((t) => t.area === '불개미');
  const autoHtml = auto.map((a) => `<tr class="auto"><td style="text-align:center">·</td><td class="client-name">${esc(a.title)}</td><td><span class="area a-ant">${esc(a.tag)}</span></td><td>${esc(a.due)}</td><td>${a.state}</td><td></td></tr>`).join('');
  $('antBody').innerHTML = autoHtml + ant.map((t) => taskRow(t, true)).join('');
  $('antCount').textContent = ant.filter((t) => !t.done).length;
  if (isOwner(me) || MOCK) {
    const fam = tasks.filter((t) => t.area === '가족');
    $('famPanel').hidden = false;
    $('famBody').innerHTML = fam.length ? fam.map((t) => taskRow(t, false)).join('') : '<tr><td colspan="5" class="muted" style="padding:14px">할 일 없음</td></tr>';
    $('famCount').textContent = fam.filter((t) => !t.done).length;
  }
}
function areaOf(title, activeNames) {
  const s = (title || '').toLowerCase();
  if (activeNames.some((n) => n && s.includes(n))) return ['col', '협업'];
  if (/\bama\b|불개미|fire ?week|방송/.test(s)) return ['ant', '불개미'];
  return ['biz', '회사'];
}
function renderCal(el, events, activeNames) {
  el.innerHTML = events.length ? events.map((ev) => {
    const [cls, lbl] = areaOf(ev.summary, activeNames);
    const time = ev.start_time ? ev.start_time.slice(11, 16) : '—';
    return `<div class="cal-row"><div class="cal-time">${esc(time)}</div><div class="cal-summary">${esc(ev.summary || '(제목 없음)')}</div><span class="area a-${cls}">${lbl}</span></div>`;
  }).join('') : '<div class="cal-empty">일정 없음</div>';
}
async function renderB34() {
  const today = kstToday(), tom = addDays(today, 1), after = addDays(today, 2);
  const [clients, notes, evs] = await Promise.all([
    b34('/clients?select=client,category,service,due_label,invoice_sent,invoice_received&order=client.asc'),
    b34('/deal_latest_note?select=client,occurred_at,summary,title').catch(() => []),
    b34(`/events?select=summary,start_time&start_time=gte.${encodeURIComponent(today + 'T00:00:00+09:00')}&start_time=lt.${encodeURIComponent(after + 'T00:00:00+09:00')}&order=start_time.asc`),
  ]);
  const active = clients.filter((c) => c.category === '진행중' || c.category === '유지보수');
  $('colCount').textContent = active.length;
  $('colBody').innerHTML = active.map((c) => {
    const unpaid = /\d/.test(c.invoice_sent || '') && !c.invoice_received;  // 날짜·숫자가 적힌 경우만 '발송'으로 봄
    return `<tr><td class="client-name">${esc(c.client)}</td><td>${esc(c.service || '')}</td><td>${esc(c.due_label || '')}</td><td>${esc(c.invoice_sent || '')}</td><td>${unpaid ? '<span class="dday amber">미수령</span>' : esc(c.invoice_received || '')}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="muted">진행중 프로젝트 없음</td></tr>';

  const noteBy = Object.fromEntries((notes || []).map((n) => [n.client, n]));
  const deals = clients.filter((c) => c.category === '논의중').map((c) => {
    const n = noteBy[c.client];
    const day = n ? n.occurred_at.slice(0, 10) : null;
    return { c, n, since: day ? -daysUntil(day) : null };
  }).filter((d) => d.since == null || d.since >= 7)
    .sort((a, b) => (b.since ?? -1) - (a.since ?? -1)).slice(0, 8);
  $('bizBody').innerHTML = deals.map(({ c, n, since }) => {
    const lv = since == null ? '' : since >= 14 ? 'red' : 'amber';
    const txt = n ? `${md(n.occurred_at)} · ${esc((n.summary || n.title || '').slice(0, 70))}` : '<span class="muted">기록 없음</span>';
    return `<tr class="${lv ? 'lv-' + lv : ''}"><td class="client-name">${esc(c.client)}</td><td>${txt}</td><td class="deal-upd ${lv ? 'warn-' + lv : ''}">${since == null ? '-' : since + '일 전'}</td></tr>`;
  }).join('') || '<tr><td colspan="3" class="muted">방치된 딜 없음</td></tr>';

  const names = active.map((c) => (c.client || '').toLowerCase()).filter((s) => s.length >= 2);
  const kd = (e) => e.start_time.slice(0, 10);
  renderCal($('calToday'), evs.filter((e) => kd(e) === today), names);
  renderCal($('calTom'), evs.filter((e) => kd(e) === tom), names);
  $('todayLbl').textContent = `(${md(today)})`;
  $('tomLbl').textContent = `(${md(tom)})`;
}
async function refresh() {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // 입력 중엔 건너뜀
  const [tasks, auto] = await Promise.all([loadTasks(), autoAntRows()]);
  renderTasks(tasks, auto);
  try { await renderB34(); } catch (e) { console.warn('b34', e); }
}

// ── 이벤트 ──
function bindAdd(inputId, dueId, area) {
  $(inputId).addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const title = e.target.value.trim(); if (!title) return;
    if (await addTask(area, title, $(dueId).value)) { e.target.value = ''; $(dueId).value = ''; e.target.blur(); refresh(); }
  });
}
document.addEventListener('click', async (e) => {
  const act = e.target.dataset.act; if (!act) return;
  const id = e.target.closest('tr')?.dataset.id; if (!id) return;
  if (act === 'done') await setDone(id, e.target.checked);
  if (act === 'del' && window.confirm('삭제할까요?')) await delTask(id);
  refresh();
});
function tick() { $('clock').textContent = new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 19); }

// ── 시작 ──
function showLogin(msg) {
  $('app').hidden = true; $('loginView').hidden = false;
  if (msg) $('loginMsg').textContent = msg;
}
function start(email) {
  me = email;
  $('loginView').hidden = true; $('app').hidden = false;
  $('who').textContent = email;
  bindAdd('antNew', 'antDue', '불개미');
  bindAdd('famNew', 'famDue', '가족');
  tick(); setInterval(tick, 1000);
  refresh(); setInterval(refresh, 60000);
}
$('loginBtn').addEventListener('click', () => {
  sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
});
$('logoutBtn').addEventListener('click', () => { sb.auth.signOut(); if (!MOCK) location.reload(); });

(async () => {
  if (MOCK) { $('mockbar').hidden = false; $('logoutBtn').hidden = true; start('mock@bridge34.com'); return; }
  const { data } = await sb.auth.getSession();
  const email = data.session?.user?.email;
  if (!email) return showLogin();
  if (!isMember(email)) { await sb.auth.signOut(); return showLogin(`${email} 계정은 접근 권한이 없습니다. bridge34.com 계정으로 로그인하세요.`); }
  start(email);
})();
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'SIGNED_IN' && session?.user?.email && !me) location.reload();
});
