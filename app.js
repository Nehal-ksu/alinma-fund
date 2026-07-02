/* =========================================================
   Alinma Family Fund — Shared App Logic (Prototype)
   State is persisted in localStorage so it survives page
   navigation. Works when hosted (e.g. GitHub Pages) or when
   opening the files directly in most browsers.
   ========================================================= */

const STORAGE_KEY = 'alinma_family_fund_v1';

const DEFAULT_MEMBERS = [
  { id: 'me',      name: 'أنت',          initial: 'أ' },
  { id: 'ibrahim', name: 'إبراهيم',      initial: 'إ' },
  { id: 'nawaf',   name: 'نواف',         initial: 'ن' },
  { id: 'munira',  name: 'منيرة',        initial: 'م' },
  { id: 'lama',    name: 'لمى',          initial: 'ل' },
  { id: 'ahmad',   name: 'أحمد عبدالله', initial: 'أ' },
  { id: 'khalid',  name: 'خالد',         initial: 'خ' },
];

/* ---------- helpers ---------- */
function uid(){ return 'id' + Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function fmt(n){ return Number(n||0).toLocaleString('en-US'); }
function el(id){ return document.getElementById(id); }
function majorityNeeded(eligibleCount){ return Math.floor(eligibleCount/2) + 1; }

function loadState(){
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function hasFund(){ const s = loadState(); return !!(s && s.fund); }

function reasonIconFor(reason){
  switch(reason){
    case 'زواج':        return 'ph-heart';
    case 'شراء سياره':
    case 'شراء سيارة':  return 'ph-car-profile';
    case 'شراء عقار':   return 'ph-house';
    case 'تعسر ديون':   return 'ph-hand-coins';
    default:            return 'ph-note';
  }
}

/* ---------- fund creation & seeding ---------- */
function seedSampleRequest(members){
  const applicant = members.find(m => m.id === 'ahmad')
                 || members.filter(m => m.id !== 'me').slice(-1)[0]
                 || { id: 'ext', name: 'أحمد عبدالله' };
  const eligible = members.filter(m => m.id !== applicant.id);
  const need = majorityNeeded(eligible.length);
  // pre-cast (need-1) approvals from other members so YOUR vote is the deciding one
  const preVoters = eligible.filter(m => m.id !== 'me').slice(0, Math.max(0, need - 1)).map(m => m.id);
  return {
    id: uid(),
    applicantId: applicant.id,
    applicantName: applicant.name,
    amount: 15000,
    months: 12,
    reason: 'شراء سيارة',
    reasonIcon: 'ph-car-profile',
    reasonDetail: '',
    attachment: { name: 'تسعيرة_تويوتا_كراون.pdf', size: '1.2 MB' },
    votes: { approve: preVoters, reject: [] },
    status: 'pending',
    daysLeft: 2,
    createdAt: Date.now()
  };
}

function createFund({ name, monthlyDeduction, members }){
  let mem = (members && members.length) ? members.slice() : DEFAULT_MEMBERS.slice();
  if(!mem.find(m => m.id === 'me')) mem.unshift({ id:'me', name:'أنت', initial:'أ' });

  const state = {
    fund: {
      name: name || 'صندوق العائلة',
      monthlyDeduction: monthlyDeduction || 200,
      balance: 42500,
      profit: 1250,
      createdAt: Date.now()
    },
    members: mem,
    loanRequests: [ seedSampleRequest(mem) ],
    transactions: [
      { id: uid(), title: 'استقطاع شهري آلي - إبراهيم', date: 'اليوم، 09:15 ص', amount: 200,  type: 'plus' },
      { id: uid(), title: 'عائد مرابحة - صندوق الإنماء', date: 'أمس، 04:30 م',  amount: 340,  type: 'plus' },
      { id: uid(), title: 'سداد قسط تمويل - خالد',      date: '28 يونيو 2026',  amount: 1250, type: 'plus' },
    ]
  };
  saveState(state);
  return state;
}

function resetApp(){
  if(confirm('إعادة تعيين التطبيق وحذف جميع البيانات؟')){
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = 'index.html';
  }
}

/* ---------- voting logic ---------- */
function resolveRequest(s, req){
  const eligible = s.members.filter(m => m.id !== req.applicantId).length;
  const need = majorityNeeded(eligible);
  if(req.votes.approve.length >= need){
    req.status = 'approved';
    s.fund.balance -= req.amount;
    s.transactions.unshift({
      id: uid(),
      title: 'تمويل مصروف - ' + req.applicantName,
      date: 'الآن',
      amount: req.amount,
      type: 'minus'
    });
  } else if(req.votes.reject.length > (eligible - need)){
    req.status = 'rejected';
  }
}

function castVote(requestId, voterId, decision){
  const s = loadState();
  const req = s.loanRequests.find(r => r.id === requestId);
  if(!req || req.status !== 'pending') return s;
  req.votes.approve = req.votes.approve.filter(id => id !== voterId);
  req.votes.reject  = req.votes.reject.filter(id => id !== voterId);
  (decision === 'approve' ? req.votes.approve : req.votes.reject).push(voterId);
  resolveRequest(s, req);
  saveState(s);
  return s;
}

// used for requests YOU submitted (you can't vote on your own) — simulates the family deciding
function simulateMemberVotes(requestId){
  const s = loadState();
  const req = s.loanRequests.find(r => r.id === requestId);
  if(!req || req.status !== 'pending') return s;
  const need = majorityNeeded(s.members.filter(m => m.id !== req.applicantId).length);
  const others = s.members.filter(m => m.id !== req.applicantId && m.id !== 'me');
  for(const m of others){
    if(req.votes.approve.length >= need) break;
    if(!req.votes.approve.includes(m.id) && !req.votes.reject.includes(m.id)){
      req.votes.approve.push(m.id);
    }
  }
  resolveRequest(s, req);
  saveState(s);
  return s;
}

function submitLoan({ amount, months, reason, reasonDetail }){
  const s = loadState() || createFund({});
  const req = {
    id: uid(),
    applicantId: 'me',
    applicantName: 'أنت',
    amount: Number(amount) || 0,
    months: Number(months) || 0,
    reason: reason || 'أخرى',
    reasonIcon: reasonIconFor(reason),
    reasonDetail: reasonDetail || '',
    attachment: null,
    votes: { approve: [], reject: [] },
    status: 'pending',
    daysLeft: 3,
    createdAt: Date.now()
  };
  s.loanRequests.unshift(req);
  saveState(s);
  return req;
}

/* ---------- routing (services hub) ---------- */
function routeFamily(){ window.location.href = hasFund() ? 'fund_dashboard.html' : 'create_fund.html'; }
function routeRequestLoan(){ window.location.href = hasFund() ? 'request_loan.html' : 'create_fund.html'; }

/* ---------- dashboard rendering ---------- */
function attachmentHTML(a){
  return `<div class="attachment-box" onclick="alert('جاري فتح المستند...')">
      <div style="display:flex;align-items:center;gap:8px;">
        <i class="ph ph-file-pdf" style="color:#ff5252;font-size:24px;"></i>
        <div>
          <div style="font-size:11px;color:var(--text-main);font-weight:600;">${a.name}</div>
          <div style="font-size:9px;color:var(--text-muted);">${a.size}</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--accent);display:flex;align-items:center;gap:4px;">
        <i class="ph ph-eye" style="font-size:16px;"></i> عرض
      </div>
    </div>`;
}

function requestCardHTML(s, r){
  const eligible = s.members.filter(m => m.id !== r.applicantId).length;
  const need = majorityNeeded(eligible);
  const app = r.votes.approve.length;
  const rej = r.votes.reject.length;
  const pct = Math.min(100, Math.round((app / need) * 100));

  const headerRight = r.status === 'pending'
    ? `<span class="vote-time">متبقي ${r.daysLeft || 2} يوم</span>`
    : (r.status === 'approved'
        ? `<span style="background:rgba(76,175,80,0.15);color:var(--success);padding:4px 8px;border-radius:4px;font-size:10px;font-weight:bold;">تمت الموافقة ✓</span>`
        : `<span style="background:rgba(255,82,82,0.15);color:#ff5252;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:bold;">مرفوض ✕</span>`);

  const reasonHtml = `<div class="reason-box"><i class="ph ${r.reasonIcon || 'ph-note'}" style="color:var(--accent);font-size:16px;"></i><span style="font-size:12px;font-weight:bold;color:var(--text-main);">السبب: ${r.reason}</span></div>`;
  const detailHtml = r.reasonDetail ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;padding:0 4px;">${r.reasonDetail}</div>` : '';
  const attachHtml = r.attachment ? attachmentHTML(r.attachment) : '';

  const tally = `<div style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:5px;">
        <span>الموافقات: ${app} · الرفض: ${rej}</span>
        <span>المطلوب للموافقة: ${need}</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;transition:0.3s;"></div>
      </div>
    </div>`;

  let actions = '';
  if(r.status === 'approved'){
    actions = `<div style="font-size:11px;color:var(--success);margin-top:12px;">تمت الموافقة بالأغلبية · تم صرف المبلغ وتحديث الرصيد.</div>`;
  } else if(r.status === 'rejected'){
    actions = `<div style="font-size:11px;color:#ff5252;margin-top:12px;">تم رفض الطلب من قبل الأغلبية.</div>`;
  } else if(r.applicantId === 'me'){
    actions = `<div style="font-size:11px;color:var(--text-muted);margin-top:12px;margin-bottom:8px;">طلبك بانتظار تصويت الأعضاء.</div>
      <button class="btn-primary" style="margin-top:0;padding:10px;" onclick="onSimulate('${r.id}')">محاكاة قرار الأعضاء</button>`;
  } else {
    const meA = r.votes.approve.includes('me') ? ' ✓' : '';
    const meR = r.votes.reject.includes('me') ? ' ✓' : '';
    actions = `<div class="vote-actions">
      <button class="btn-primary" style="margin-top:0;padding:10px;" onclick="onVote('${r.id}','approve')">موافق${meA}</button>
      <button class="btn-primary" style="margin-top:0;padding:10px;background:transparent;border:1px solid var(--border-color);color:var(--text-main);" onclick="onVote('${r.id}','reject')">رفض${meR}</button>
    </div>`;
  }

  return `<div class="vote-card">
    <div class="vote-header"><span class="vote-badge">طلب تمويل</span>${headerRight}</div>
    <h4 style="font-size:14px;margin-bottom:5px;">${r.applicantName}</h4>
    <p style="font-size:11px;color:var(--text-muted);">المبلغ: ${fmt(r.amount)} ر.س | المدة: ${r.months} شهر</p>
    ${reasonHtml}${detailHtml}${attachHtml}${tally}${actions}
  </div>`;
}

function renderAvatars(s){
  const wrap = el('membersAvatars'); if(!wrap) return;
  const shown = s.members.slice(0, 4);
  let html = '';
  shown.forEach(m => { html += `<div class="avatar" title="${m.name}">${m.initial}</div>`; });
  const extra = s.members.length - shown.length;
  if(extra > 0) html += `<div class="avatar" style="background-color:#333;color:white;">+${extra}</div>`;
  wrap.innerHTML = html;
}

function renderRequests(s){
  const wrap = el('pendingRequests'); if(!wrap) return;
  if(!s.loanRequests.length){
    wrap.innerHTML = `<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">لا توجد طلبات حالياً</p>`;
    return;
  }
  wrap.innerHTML = s.loanRequests.map(r => requestCardHTML(s, r)).join('');
}

function renderTransactions(s){
  const wrap = el('transactions'); if(!wrap) return;
  wrap.innerHTML = s.transactions.map(t => {
    const sign  = t.type === 'minus' ? '-' : '+';
    const color = t.type === 'minus' ? 'style="color:#ff5252;"' : '';
    const cls   = t.type === 'minus' ? 'tx-amount' : 'tx-amount plus';
    return `<div class="transaction-item">
        <div class="tx-info"><div class="tx-title">${t.title}</div><div class="tx-date">${t.date}</div></div>
        <div class="${cls}" ${color}>${sign}${fmt(t.amount)} ر.س</div>
      </div>`;
  }).join('');
}

function renderDashboard(){
  const s = loadState();
  if(!s || !s.fund){ window.location.href = '2_create_fund.html'; return; }
  if(el('fundTitle')) el('fundTitle').textContent = s.fund.name;
  if(el('balanceAmount')) el('balanceAmount').innerHTML = `${fmt(s.fund.balance)} <span style="font-size:14px;font-weight:normal;">ر.س</span>`;
  if(el('profitAmount')) el('profitAmount').textContent = `+${fmt(s.fund.profit)} ر.س`;
  if(el('nextDeduction')) el('nextDeduction').textContent = `${fmt(s.fund.monthlyDeduction)} ر.س`;
  renderAvatars(s);
  renderRequests(s);
  renderTransactions(s);
}

function onVote(id, decision){ castVote(id, 'me', decision); renderDashboard(); }
function onSimulate(id){ simulateMemberVotes(id); renderDashboard(); }

/* ---------- create-fund page ---------- */
let draftMembers = [];

function renderDraftMembers(){
  const wrap = el('membersList'); if(!wrap) return;
  if(!draftMembers.length){ wrap.innerHTML = ''; return; }
  let html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">';
  draftMembers.forEach((m, i) => {
    html += `<div style="display:flex;align-items:center;gap:6px;background:var(--bg-card);padding:6px 10px;border-radius:20px;font-size:12px;">
        <div class="avatar" style="width:22px;height:22px;font-size:9px;margin:0;">${m.initial}</div>${m.name}
        <i class="ph ph-x" style="cursor:pointer;color:var(--text-muted);" onclick="removeDraftMember(${i})"></i>
      </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}
function addMemberPrompt(){
  const name = prompt('اسم العضو:');
  if(name && name.trim()){
    const nm = name.trim();
    draftMembers.push({ id: 'm' + Date.now(), name: nm, initial: nm.charAt(0) });
    renderDraftMembers();
  }
}
function removeDraftMember(i){ draftMembers.splice(i, 1); renderDraftMembers(); }

function confirmCreateFund(){
  const name = (el('fundName') ? el('fundName').value : '').trim();
  const ded  = Number(el('deductionAmount') ? el('deductionAmount').value : 0);
  let members;
  if(draftMembers.length){
    members = [{ id:'me', name:'أنت', initial:'أ' }].concat(draftMembers);
  } else {
    members = DEFAULT_MEMBERS.slice(); // sensible default set for the demo
  }
  createFund({ name: name, monthlyDeduction: ded || 200, members: members });
  window.location.href = '3_fund_dashboard.html';
}

/* ---------- request-loan page ---------- */
function submitLoanForm(){
  if(!hasFund()){ alert('يرجى إنشاء صندوق عائلي أولاً.'); window.location.href = '2_create_fund.html'; return; }
  const amount = Number(el('loanAmount').value);
  const months = Number(el('loanMonths').value);
  const reason = el('reasonSelect').value;
  const detail = el('otherReasonText') ? el('otherReasonText').value : '';
  if(!amount || amount <= 0){ alert('يرجى إدخال مبلغ التمويل.'); return; }
  if(!months || months <= 0){ alert('يرجى إدخال مدة السداد.'); return; }
  if(!reason){ alert('يرجى اختيار سبب طلب التمويل.'); return; }
  submitLoan({ amount, months, reason, reasonDetail: reason === 'اخرى' ? detail : '' });
  alert('تم إرسال الطلب بنجاح للجنة الصندوق للتصويت.');
  window.location.href = '3_fund_dashboard.html';
}
