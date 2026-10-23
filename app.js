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
let token = null;   // 로그인 access token — supabase-js 내부 잠금(hang) 피하려고 REST 로 직접 호출
const vestScope = '개인';          // 퍼스널 보드는 개인 베스팅만 (회사 베스팅은 오피스보드)
let claimsCache = [];                 // 캘린더에 클레임 일정 합치기용
let calCache = null;                  // { today, tom, evs, names }
let mockClaims = [
  { id: 'c1', scope: '개인', project: '[MOCK] Monad', token: 'MON', amount: 1250, claim_date: kstToday(), claim_url: 'https://example.com', claimed: false },
  { id: 'c2', scope: '개인', project: '[MOCK] Monad', token: 'MON', amount: 1250, claim_date: addDays(kstToday(), 30), claim_url: null, claimed: false },
  { id: 'c3', scope: '개인', project: '[MOCK] Aptos', token: 'APT', amount: 300, claim_date: addDays(kstToday(), 1), claim_url: null, claimed: false },
];
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
async function hub(path, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(HUB_URL + '/rest/v1' + path, { ...opts, signal: ctl.signal,
      headers: { apikey: HUB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200) || r.status);
    const txt = await r.text();                    // return=minimal 은 201/204 + 빈 본문
    return txt ? JSON.parse(txt) : null;
  } finally { clearTimeout(t); }
}
async function loadTasks() {
  if (MOCK) return mockTasks;
  try { return await hub('/personal_tasks?select=id,area,title,due,done&order=done.asc,due.asc.nullslast,created_at.asc') || []; }
  catch (e) { console.warn('tasks', e); return []; }
}
async function addTask(area, title, due) {
  if (MOCK) { mockTasks.push({ id: 'm' + Date.now(), area, title, due: due || null, done: false }); return true; }
  try { await hub('/personal_tasks', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ area, title, due: due || null }) }); return true; }
  catch (e) { alert('저장 실패: ' + e.message); return false; }
}
async function setDone(id, done) {
  if (MOCK) { const t = mockTasks.find((x) => x.id === id); if (t) t.done = done; return; }
  try { await hub('/personal_tasks?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ done }) }); }
  catch (e) { alert('저장 실패: ' + e.message); }
}
async function delTask(id) {
  if (MOCK) { mockTasks = mockTasks.filter((x) => x.id !== id); return; }
  try { await hub('/personal_tasks?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }
  catch (e) { alert('삭제 실패: ' + e.message); }
}
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));            // 31일 → 그 달 말일
  return t.toISOString().slice(0, 10);
}
async function loadClaims() {
  if (MOCK) return mockClaims;
  try { return await hub('/vesting_claims?select=id,scope,project,token,amount,claim_date,claim_url,note,claimed&scope=eq.%EA%B0%9C%EC%9D%B8&order=claim_date.asc') || []; }
  catch (e) { console.warn('claims', e); return []; }
}
async function addClaims(rows) {
  if (MOCK) { rows.forEach((r, i) => mockClaims.push({ id: 'c' + Date.now() + i, claimed: false, ...r })); return true; }
  try { await hub('/vesting_claims', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); return true; }
  catch (e) { alert('저장 실패: ' + e.message); return false; }
}
async function patchClaim(id, body) {
  if (MOCK) { const c = mockClaims.find((x) => x.id === id); if (c) Object.assign(c, body); return; }
  try { await hub('/vesting_claims?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }); }
  catch (e) { alert('저장 실패: ' + e.message); }
}
async function delClaim(id) {
  if (MOCK) { mockClaims = mockClaims.filter((x) => x.id !== id); return; }
  try { await hub('/vesting_claims?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }
  catch (e) { alert('삭제 실패: ' + e.message); }
}
const fmtAmt = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 }));
function renderVest(claims) {
  claimsCache = claims;
  const today = kstToday();
  const all = $('vestAll').checked;
  const list = claims.filter((c) => c.scope === vestScope)
    .filter((c) => all || (!c.claimed && (c.claim_date >= today || daysUntil(c.claim_date) < 0)));  // 기본: 안 받은 것(지난 것 포함)
  const upcoming = claims.filter((c) => c.scope === '개인' && !c.claimed && c.claim_date >= today && daysUntil(c.claim_date) <= 7).length;
  $('vestCount').textContent = upcoming ? `7일 내 ${upcoming}` : '0';
  $('vestBody').innerHTML = list.map((c) => `<tr class="${c.claimed ? 'done' : ''}" data-cid="${esc(c.id)}">
      <td style="text-align:center"><input type="checkbox" class="chk" data-vact="claimed" ${c.claimed ? 'checked' : ''} title="받음"></td>
      <td>${md(c.claim_date)}</td><td>${dday(c.claim_date, c.claimed)}</td>
      <td class="client-name">${esc(c.project)}</td>
      <td>${esc(fmtAmt(c.amount))} ${esc(c.token || '')}</td>
      <td>${c.claim_url ? `<a class="vlink" href="${esc(c.claim_url)}" target="_blank" rel="noopener">클레임 ↗</a>` : ''}</td>
      <td><button class="del" data-vact="del" title="삭제">✕</button></td></tr>`).join('')
    || '<tr><td colspan="7" class="muted" style="text-align:center;padding:16px">클레임 일정 없음 — 아래에서 추가</td></tr>';
  if (calCache) drawCalendars();
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
}
function areaOf(title, activeNames) {
  const s = (title || '').toLowerCase();
  if (activeNames.some((n) => n && s.includes(n))) return ['col', '협업'];
  if (/\bama\b|불개미|fire ?week|방송/.test(s)) return ['ant', '불개미'];
  return ['biz', '회사'];
}
function claimRows(day) {
  return claimsCache.filter((c) => c.scope === '개인' && !c.claimed && c.claim_date === day).map((c) =>
    `<div class="cal-row"><div class="cal-time">💰</div><div class="cal-summary">${esc(c.project)} 클레임 ${esc(fmtAmt(c.amount))} ${esc(c.token || '')}</div><span class="area a-claim">클레임</span></div>`).join('');
}
function drawCalendars() {
  const { today, tom, evs, names } = calCache;
  const kd = (e) => e.start_time.slice(0, 10);
  renderCal($('calToday'), evs.filter((e) => kd(e) === today), names, claimRows(today));
  renderCal($('calTom'), evs.filter((e) => kd(e) === tom), names, claimRows(tom));
}
function renderCal(el, events, activeNames, extra = '') {
  el.innerHTML = extra + (events.length || extra ? '' : '<div class="cal-empty">일정 없음</div>') + events.map((ev) => {
    const [cls, lbl] = areaOf(ev.summary, activeNames);
    const time = ev.start_time ? ev.start_time.slice(11, 16) : '—';
    return `<div class="cal-row"><div class="cal-time">${esc(time)}</div><div class="cal-summary">${esc(ev.summary || '(제목 없음)')}</div><span class="area a-${cls}">${lbl}</span></div>`;
  }).join('');
}
function clientRow(c) {
  const unpaid = /\d/.test(c.invoice_sent || '') && !c.invoice_received;  // 날짜·숫자가 적힌 경우만 '발송'으로 봄
  const ph = '<span class="muted">-</span>';
  return `<tr><td class="client-name">${esc(c.client)}</td><td>${esc(c.due_label || '') || ph}</td><td>${esc(c.service || '') || ph}</td>
    <td>${esc(c.invoice_sent || '') || ph}</td><td>${c.invoice_received ? esc(c.invoice_received) : (unpaid ? '<span class="dday amber">미수령</span>' : ph)}</td></tr>`;
}
const CLOSED = ['계약됨', '드랍'];
async function renderB34() {
  const today = kstToday(), tom = addDays(today, 1), after = addDays(today, 2);
  const [clients, notes, evs] = await Promise.all([
    b34('/clients?select=client,category,service,due_label,invoice_sent,invoice_received,deal_stage&order=client.asc'),
    b34('/deal_latest_note?select=client,occurred_at,source,summary,title').catch(() => []),
    b34(`/events?select=summary,start_time&start_time=gte.${encodeURIComponent(today + 'T00:00:00+09:00')}&start_time=lt.${encodeURIComponent(after + 'T00:00:00+09:00')}&order=start_time.asc`),
  ]);
  // 협업 프로젝트 / 유지보수 — 오피스보드와 같은 열
  const active = clients.filter((c) => c.category === '진행중');
  const maint = clients.filter((c) => c.category === '유지보수');
  $('colBody').innerHTML = active.map(clientRow).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:18px">진행중 프로젝트 없음</td></tr>';
  $('mntBody').innerHTML = maint.map(clientRow).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:18px">유지보수 중인 프로젝트 없음</td></tr>';

  // 미확정 딜 — 오피스보드와 같은 정렬·색 (오래된 갱신이 위, 기록 없음은 뒤, 종료 딜 제외)
  const noteBy = Object.fromEntries((notes || []).map((n) => [n.client, n]));
  const deals = clients.filter((c) => c.category === '논의중' && !CLOSED.includes(c.deal_stage)).map((c) => {
    const n = noteBy[c.client];
    const since = n ? -daysUntil(n.occurred_at.slice(0, 10)) : null;
    return { c, n, since, level: since == null ? '' : since >= 14 ? 'red' : since >= 7 ? 'amber' : '' };
  }).sort((a, b) => (a.since == null) - (b.since == null) || (b.since ?? 0) - (a.since ?? 0) || a.c.client.localeCompare(b.c.client));
  $('dealCount').textContent = deals.length;
  const stale = deals.filter((d) => d.since != null && d.since >= 7).length, none = deals.filter((d) => d.since == null).length;
  $('dealAlert').innerHTML = (stale ? `<span class="pill" style="background:rgba(245,184,74,.15);color:#f5b84a">7일+ 갱신 없음 ${stale}</span> ` : '') + (none ? `<span class="pill" style="background:#1e2638;color:#8b97ad">기록 없음 ${none}</span>` : '');
  $('dealBody').innerHTML = deals.map(({ c, n, since, level }) => {
    const status = n ? `<span class="deal-st-date">${md(n.occurred_at)}</span> · ${esc((n.summary || n.title || '').replace(/\s+/g, ' ').trim())}<span class="deal-src">${esc(n.source || '')}</span>` : '<span class="deal-muted">기록 없음</span>';
    const upd = since == null ? '<span class="deal-muted">-</span>' : (since <= 0 ? '오늘' : `${since}일 전`);
    const stage = c.deal_stage || '리드';
    return `<tr class="${level ? 'lv-' + level : ''}"><td class="client-name">${esc(c.client)}</td><td><span class="deal-stage" data-stage="${esc(stage)}">${esc(stage)}</span></td><td>${status}</td><td class="deal-upd ${level ? 'warn-' + level : ''}">${upd}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="muted" style="text-align:center;padding:18px">논의 중인 딜 없음</td></tr>';

  const names = [...active, ...maint].map((c) => (c.client || '').toLowerCase()).filter((x) => x.length >= 2);
  calCache = { today, tom, evs, names };
  drawCalendars();
  $('todayLbl').textContent = `(${md(today)})`;
  $('tomLbl').textContent = `(${md(tom)})`;
}
async function refresh() {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // 입력 중엔 건너뜀
  // 패널별로 따로 — 한 곳이 실패·지연돼도 나머지는 표시
  renderB34().catch((e) => console.warn('b34', e));
  loadClaims().then(renderVest).catch((e) => console.warn('vest', e));
  const [tasks, auto] = await Promise.all([loadTasks(), autoAntRows().catch(() => [])]);
  renderTasks(tasks, auto);
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
  const vact = e.target.dataset.vact;
  if (vact) {
    const cid = e.target.closest('tr')?.dataset.cid; if (!cid) return;
    if (vact === 'claimed') await patchClaim(cid, { claimed: e.target.checked });
    if (vact === 'del' && window.confirm('이 클레임 일정을 삭제할까요?')) await delClaim(cid);
    loadClaims().then(renderVest); return;
  }
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
  if (isOwner(email) || MOCK) $('vestPanel').hidden = false;   // 개인 베스팅은 오너 2계정만
  $('vestAll').addEventListener('change', () => renderVest(claimsCache));
  $('vAdd').addEventListener('click', async () => {
    const project = $('vProject').value.trim(), first = $('vDate').value;
    if (!project || !first) return alert('프로젝트와 첫 클레임일을 입력하세요.');
    const n = +$('vRepeat').value, amt = $('vAmount').value;
    const base = { scope: '개인', project, token: $('vToken').value.trim() || null,
      amount: amt === '' ? null : Number(amt), claim_url: $('vUrl').value.trim() || null };
    const batch = n > 1 ? (crypto.randomUUID ? crypto.randomUUID() : null) : null;
    const rows = Array.from({ length: n }, (_, i) => ({ ...base, claim_date: addMonths(first, i), ...(batch && !MOCK ? { batch_id: batch } : {}) }));
    if (await addClaims(rows)) { ['vProject', 'vToken', 'vAmount', 'vDate', 'vUrl'].forEach((id) => { $(id).value = ''; }); $('vRepeat').value = '1'; loadClaims().then(renderVest); }
  });
  tick(); setInterval(tick, 1000);
  refresh(); setInterval(refresh, 60000);
}
$('loginBtn').addEventListener('click', () => {
  sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
});
$('logoutBtn').addEventListener('click', () => { sb.auth.signOut(); });

function boot(session) {
  if (me) return;                                   // 이미 시작됨
  token = session?.access_token || null;
  const email = session?.user?.email;
  if (!email) return showLogin();
  if (!isMember(email)) { sb.auth.signOut(); return showLogin(`${email} 계정은 접근 권한이 없습니다. bridge34.com 계정으로 로그인하세요.`); }
  start(email);
}
if (MOCK) { $('mockbar').hidden = false; $('logoutBtn').hidden = true; start('mock@bridge34.com'); }
else {
  // 새로고침 없이 처리: 로그인 이벤트·기존 세션 둘 다 boot() 한 번으로 수렴
  sb.auth.onAuthStateChange((ev, session) => {
    if (session?.access_token) token = session.access_token;   // 토큰 자동 갱신 반영
    if (ev === 'SIGNED_OUT') { me = null; showLogin(); return; }
    if (session) boot(session);
  });
  sb.auth.getSession().then(({ data }) => { if (data.session) boot(data.session); else if (!me) showLogin(); });
}
