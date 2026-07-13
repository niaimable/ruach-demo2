/* Ruach Practice — Admin Dashboard JS */

const API = '/api';
let token = localStorage.getItem('ruach_admin_token');
let adminName = localStorage.getItem('ruach_admin_name');
let currentPage = 'dashboard';
let allClients = [];
let allConversations = [];
let currentChatClient = null;
let currentDetailClient = null;
let calView = 'list';
let calWeekStart = null;
let calMonthDate = null;
let lastAppointments = [];

// ─── INIT ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (token) showApp();
});

async function adminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  try {
    const r = await fetch(`${API}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
    token = data.token;
    adminName = data.name;
    localStorage.setItem('ruach_admin_token', token);
    localStorage.setItem('ruach_admin_name', adminName);
    showApp();
  } catch (e) {
    errEl.textContent = 'Connection error. Is the server running?';
    errEl.style.display = 'block';
  }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'grid';
  document.querySelector('.sidebar-name').textContent = adminName || 'Melissa';
  goPage('dashboard');
}

function logout() {
  localStorage.removeItem('ruach_admin_token');
  localStorage.removeItem('ruach_admin_name');
  token = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────

function goPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', calendar: 'Appointments', clients: 'Clients', messages: 'Messages', availability: 'Availability', 'client-detail': 'Client Profile' };
  document.getElementById('page-title').textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  else if (page === 'calendar') { resetAppointmentFilters(); loadAppointments(); }
  else if (page === 'clients') loadClients();
  else if (page === 'messages') loadMessages();
  else if (page === 'availability') loadAvailability();

  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); goPage(el.dataset.page); });
});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ─── API HELPER ────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (r.status === 401) { logout(); return null; }
  return r.json();
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

async function loadDashboard() {
  const stats = await api('/admin/stats');
  if (!stats) return;
  document.getElementById('stat-clients').textContent = stats.totalClients;
  document.getElementById('stat-pending').textContent = stats.pendingAppointments;
  document.getElementById('stat-today').textContent = stats.todaySessions;
  document.getElementById('stat-messages').textContent = stats.unreadMessages;

  const pendingBadge = document.getElementById('badge-pending');
  const msgBadge = document.getElementById('badge-messages');
  const clientsBadge = document.getElementById('badge-clients');
  if (stats.pendingAppointments > 0) { pendingBadge.textContent = stats.pendingAppointments; pendingBadge.style.display = ''; }
  if (stats.unreadMessages > 0) { msgBadge.textContent = stats.unreadMessages; msgBadge.style.display = ''; }
  if (stats.newIntakes > 0) { clientsBadge.textContent = stats.newIntakes; clientsBadge.style.display = ''; }
  else { clientsBadge.style.display = 'none'; }

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const weekApts = await api(`/admin/appointments?from=${today}&to=${nextWeek}&status=confirmed`);
  const pendingApts = await api(`/admin/appointments?status=pending`);

  renderAptList('today-appointments', weekApts || [], true);
  renderAptList('pending-appointments', pendingApts || [], false, true);
}

function renderAptList(elId, apts, showActions = false, isPending = false) {
  const el = document.getElementById(elId);
  if (!apts.length) { el.innerHTML = `<div class="apt-empty">No appointments</div>`; return; }
  const CAP = 8;
  const shown = apts.slice(0, CAP);
  let html = shown.map(a => {
    const d = new Date(a.date + 'T12:00:00Z');
    return `
      <div class="apt-item">
        <div class="apt-time">
          <span class="day">${d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
          <span class="time">${a.start_time}</span>
        </div>
        <div class="apt-divider"></div>
        <div class="apt-info">
          <div class="apt-name">${a.first_name} ${a.last_name}</div>
          <div class="apt-type">${a.session_type} · ${a.date}</div>
        </div>
        ${isPending ? `
          <div class="apt-actions">
            <button class="btn-icon green" title="Confirm" onclick="updateApt(${a.id},'confirmed')"><i class="fas fa-check"></i></button>
            <button class="btn-icon red" title="Cancel" onclick="updateApt(${a.id},'cancelled')"><i class="fas fa-times"></i></button>
          </div>` : `<span class="status-badge status-${a.status}">${a.status}</span>`}
      </div>`;
  }).join('');
  if (apts.length > CAP) {
    html += `<div class="apt-empty" style="padding:12px 20px;font-size:12px">+${apts.length - CAP} more — <a href="#" onclick="goPage('calendar');return false" style="color:var(--green);font-weight:500">view all</a></div>`;
  }
  el.innerHTML = html;
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────

function resetAppointmentFilters() {
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  document.getElementById('filter-status').value = '';
}

async function loadAppointments() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const status = document.getElementById('filter-status').value;
  let q = '?';
  if (from) q += `from=${from}&`;
  if (to) q += `to=${to}&`;
  if (status) q += `status=${status}&`;
  const apts = await api(`/admin/appointments${q}`);
  if (!apts) return;
  lastAppointments = apts;
  renderCalView();
}

function setCalView(view) {
  calView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById('cal-list-view').style.display  = view === 'list'  ? 'block' : 'none';
  document.getElementById('cal-week-view').style.display  = view === 'week'  ? 'block' : 'none';
  document.getElementById('cal-month-view').style.display = view === 'month' ? 'block' : 'none';
  if (view === 'week' && !calWeekStart) {
    const now = new Date(); now.setHours(0,0,0,0);
    const day = now.getDay();
    calWeekStart = new Date(now); calWeekStart.setDate(now.getDate() - day);
  }
  if (view === 'month' && !calMonthDate) {
    calMonthDate = new Date(); calMonthDate.setDate(1);
  }
  renderCalView();
}

function renderCalView() {
  if (calView === 'list')  renderListView(lastAppointments);
  if (calView === 'week')  renderWeekView(lastAppointments);
  if (calView === 'month') renderMonthView(lastAppointments);
}

// ── LIST VIEW ──────────────────────────────────────────────────────────────

function renderListView(apts) {
  const el = document.getElementById('appointments-list');
  if (!apts.length) { el.innerHTML = `<div class="apt-empty" style="padding:40px">No appointments found</div>`; return; }
  el.innerHTML = `<table>
    <thead><tr>
      <th>Date</th><th>Time</th><th>Client</th><th>Type</th><th>Status</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${apts.map(a => `
        <tr>
          <td>${a.date}</td>
          <td>${a.start_time} – ${a.end_time}</td>
          <td>
            <div class="client-name-cell">
              <div class="client-avatar">${a.first_name[0]}${a.last_name[0]}</div>
              <div>
                <div class="client-name">${a.first_name} ${a.last_name}</div>
                <div class="client-email">${a.email}</div>
              </div>
            </div>
          </td>
          <td>${a.session_type}</td>
          <td><span class="status-badge status-${a.status}">${a.status}</span></td>
          <td>
            <div style="display:flex;gap:6px">
              ${a.status === 'pending' ? `<button class="btn-icon green" title="Confirm" onclick="updateApt(${a.id},'confirmed')"><i class="fas fa-check"></i></button>` : ''}
              ${a.status !== 'cancelled' ? `<button class="btn-icon red" title="Cancel" onclick="updateApt(${a.id},'cancelled')"><i class="fas fa-times"></i></button>` : ''}
              <button class="btn-icon" title="View client" onclick="openClient(${a.client_id})"><i class="fas fa-user"></i></button>
            </div>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

// ── WEEK VIEW ──────────────────────────────────────────────────────────────

function shiftWeek(dir) {
  calWeekStart = calWeekStart || (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; })();
  calWeekStart.setDate(calWeekStart.getDate() + dir * 7);
  renderWeekView(lastAppointments);
}

function renderWeekView(apts) {
  if (!calWeekStart) { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); calWeekStart = d; }
  const days = Array.from({length: 7}, (_, i) => { const d = new Date(calWeekStart); d.setDate(d.getDate() + i); return d; });
  const today = new Date().toDateString();
  const weekEnd = new Date(days[6]);
  document.getElementById('week-label').textContent =
    `${days[0].toLocaleDateString('en-GB', {day:'numeric',month:'short'})} – ${weekEnd.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}`;

  // Build map: date string → appointments
  const byDate = {};
  apts.forEach(a => { if (!byDate[a.date]) byDate[a.date] = []; byDate[a.date].push(a); });

  // Hours to show: 8am – 7pm
  const hours = Array.from({length: 12}, (_, i) => i + 8);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let html = `
    <div class="week-time-header"></div>
    ${days.map(d => `
      <div class="week-day-header ${d.toDateString() === today ? 'today' : ''}">
        <div class="week-day-name">${dayNames[d.getDay()]}</div>
        <div class="week-day-num">${d.getDate()}</div>
      </div>`).join('')}`;

  hours.forEach(h => {
    const hStr = `${String(h).padStart(2,'0')}:00`;
    html += `<div class="week-time-label">${h > 12 ? h-12 : h}${h >= 12 ? 'pm' : 'am'}</div>`;
    days.forEach(d => {
      const dateStr = d.toISOString().split('T')[0];
      const cellApts = (byDate[dateStr] || []).filter(a => a.start_time.startsWith(String(h).padStart(2,'0')));
      html += `<div class="week-cell">
        ${cellApts.map(a => `
          <div class="week-apt ${a.status}" title="${a.first_name} ${a.last_name} · ${a.start_time}" onclick="openClient(${a.client_id})">
            ${a.start_time} ${a.first_name}
          </div>`).join('')}
      </div>`;
    });
  });

  document.getElementById('week-grid').innerHTML = html;
}

// ── MONTH VIEW ─────────────────────────────────────────────────────────────

function shiftMonth(dir) {
  calMonthDate = calMonthDate || new Date();
  calMonthDate.setMonth(calMonthDate.getMonth() + dir);
  calMonthDate.setDate(1);
  renderMonthView(lastAppointments);
}

function renderMonthView(apts) {
  if (!calMonthDate) { calMonthDate = new Date(); calMonthDate.setDate(1); }
  const year = calMonthDate.getFullYear();
  const month = calMonthDate.getMonth();
  const today = new Date().toDateString();

  document.getElementById('month-label').textContent =
    calMonthDate.toLocaleDateString('en-GB', {month:'long', year:'numeric'});

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Build map
  const byDate = {};
  apts.forEach(a => { if (!byDate[a.date]) byDate[a.date] = []; byDate[a.date].push(a); });

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dayNames.map(d => `<div class="month-weekday">${d}</div>`).join('');

  // Prev month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="month-cell other-month"><div class="month-day-num" style="color:#ccc">${daysInPrev - i}</div></div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const d = new Date(year, month, day);
    const isToday = d.toDateString() === today;
    const dayApts = byDate[dateStr] || [];
    const show = dayApts.slice(0, 3);
    const more = dayApts.length - show.length;
    html += `<div class="month-cell ${isToday ? 'today' : ''}">
      <div class="month-day-num">${day}</div>
      ${show.map(a => `
        <div class="month-apt ${a.status}" title="${a.first_name} ${a.last_name} · ${a.start_time}" onclick="openClient(${a.client_id})">
          ${a.start_time} ${a.first_name}
        </div>`).join('')}
      ${more > 0 ? `<div class="month-more">+${more} more</div>` : ''}
    </div>`;
  }

  // Next month leading days
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="month-cell other-month"><div class="month-day-num" style="color:#ccc">${i}</div></div>`;
  }

  document.getElementById('month-grid').innerHTML = html;
}

async function updateApt(id, status) {
  await api(`/admin/appointments/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
  loadAppointments();
  const stats = await api('/admin/stats');
  if (stats) {
    document.getElementById('stat-pending').textContent = stats.pendingAppointments;
    const b = document.getElementById('badge-pending');
    if (stats.pendingAppointments > 0) { b.textContent = stats.pendingAppointments; b.style.display = ''; }
    else b.style.display = 'none';
  }
}

// ─── CLIENTS ───────────────────────────────────────────────────────────────

async function loadClients() {
  allClients = await api('/admin/clients') || [];
  renderClients(allClients);
}

function renderClients(clients) {
  const el = document.getElementById('clients-list');
  if (!clients.length) { el.innerHTML = `<div class="apt-empty" style="padding:40px">No clients yet</div>`; return; }
  el.innerHTML = `<table>
    <thead><tr>
      <th>Client</th><th>Phone</th><th>Language</th><th>Sessions</th><th>Next Session</th><th>Intake</th><th>Messages</th><th></th>
    </tr></thead>
    <tbody>
      ${clients.map(c => `
        <tr style="cursor:pointer" onclick="openClient(${c.id})">
          <td>
            <div class="client-name-cell">
              <div class="client-avatar">${c.first_name[0]}${c.last_name[0]}</div>
              <div>
                <div class="client-name">${c.first_name} ${c.last_name}</div>
                <div class="client-email">${c.email}</div>
              </div>
            </div>
          </td>
          <td>${c.phone || '—'}</td>
          <td>${c.preferred_language || 'English'}</td>
          <td>${c.session_count || 0}</td>
          <td>${c.next_session || '—'}</td>
          <td>${c.intake_completed
            ? `<span class="status-badge status-confirmed" style="cursor:pointer" onclick="event.stopPropagation();openClient(${c.id});setTimeout(()=>document.querySelector('[data-tab=intake]')?.click(),300)">✓ View</span>`
            : `<span class="status-badge status-pending">Pending</span>`}</td>
          <td>${c.unread_msgs > 0 ? `<span class="badge">${c.unread_msgs}</span>` : '—'}</td>
          <td><button class="btn-icon" onclick="event.stopPropagation();openClient(${c.id})"><i class="fas fa-chevron-right"></i></button></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function filterClients() {
  const q = document.getElementById('client-search').value.toLowerCase();
  renderClients(allClients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q)
  ));
}

async function openClient(clientId) {
  const data = await api(`/admin/clients/${clientId}`);
  if (!data) return;
  currentDetailClient = data.client;
  renderClientDetail(data);
  goPage('client-detail');

  // Set up tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(`tab-${t.dataset.tab}`).classList.add('active');
      if (t.dataset.tab === 'notes') loadNotes(clientId);
      if (t.dataset.tab === 'chat') loadChat(clientId);
    });
  });
}

function renderClientDetail(data) {
  const c = data.client;
  const initials = `${c.first_name[0]}${c.last_name[0]}`;
  document.getElementById('client-detail-header').innerHTML = `
    <div class="client-detail-avatar">${initials}</div>
    <div class="client-detail-info">
      <h2>${c.first_name} ${c.last_name}</h2>
      <div class="client-detail-meta">
        <span><i class="fas fa-envelope" style="color:var(--green)"></i> ${c.email}</span>
        ${c.phone ? `<span><i class="fas fa-phone" style="color:var(--green)"></i> ${c.phone}</span>` : ''}
        ${c.preferred_language ? `<span><i class="fas fa-language" style="color:var(--green)"></i> ${c.preferred_language}</span>` : ''}
        <span><i class="fas fa-calendar" style="color:var(--green)"></i> Client since ${c.created_at.split('T')[0]}</span>
      </div>
    </div>`;

  // Overview tab
  document.getElementById('tab-overview').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h4 style="font-size:14px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.06em">Personal Info</h4>
          <button class="btn-sm" onclick="toggleEditPersonal(${c.id})" id="edit-personal-btn"><i class="fas fa-pen" style="margin-right:4px"></i>Edit</button>
        </div>

        <!-- Read-only view -->
        <div id="personal-view">
          ${infoRow('Date of birth', c.date_of_birth || 'Not provided')}
          ${infoRow('Phone', c.phone || 'Not provided')}
          ${infoRow('Emergency contact', c.emergency_contact_name || 'Not provided')}
          ${infoRow('Emergency phone', c.emergency_contact_phone || 'Not provided')}
          ${infoRow('How they found us', c.how_heard || 'Not provided')}
          ${infoRow('Intake form', c.intake_completed ? '✅ Completed' : '⏳ Pending')}
        </div>

        <!-- Edit form (hidden by default) -->
        <div id="personal-edit" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label>Date of birth</label>
              <input type="date" id="edit-dob" value="${c.date_of_birth || ''}">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" id="edit-phone" value="${c.phone || ''}" placeholder="+1...">
            </div>
          </div>
          <div class="form-group">
            <label>Emergency contact name</label>
            <input type="text" id="edit-emergency-name" value="${c.emergency_contact_name || ''}" placeholder="Full name">
          </div>
          <div class="form-group">
            <label>Emergency contact phone</label>
            <input type="tel" id="edit-emergency-phone" value="${c.emergency_contact_phone || ''}" placeholder="+1...">
          </div>
          <div class="form-group">
            <label>How they found us</label>
            <input type="text" id="edit-how-heard" value="${c.how_heard || ''}" placeholder="Referral, social media…">
          </div>
          <div id="personal-save-msg" class="alert alert-success" style="display:none">Saved successfully</div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="btn-sm btn-green" onclick="savePersonalInfo(${c.id})">Save changes</button>
            <button class="btn-sm" onclick="toggleEditPersonal(${c.id})">Cancel</button>
          </div>
        </div>
      </div>

      <div class="card" style="padding:20px">
        <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.06em">Session Summary</h4>
        ${infoRow('Total sessions', data.appointments.filter(a => a.status === 'confirmed').length)}
        ${infoRow('Upcoming', data.appointments.filter(a => a.status === 'confirmed' && a.date >= new Date().toISOString().split('T')[0]).length)}
        ${infoRow('Last session', data.appointments.find(a => a.status === 'confirmed')?.date || 'No sessions yet')}
      </div>
    </div>`;

  // Appointments tab
  document.getElementById('tab-appointments').innerHTML = `
    <div class="card">
      ${data.appointments.length ? `
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.appointments.map(a => `<tr>
              <td>${a.date}</td><td>${a.start_time} – ${a.end_time}</td><td>${a.session_type}</td>
              <td><span class="status-badge status-${a.status}">${a.status}</span></td>
              <td>${a.status === 'pending' ? `<button class="btn-sm btn-green" onclick="updateApt(${a.id},'confirmed');openClient(${c.id})">Confirm</button>` : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : `<div class="apt-empty" style="padding:40px">No appointments yet</div>`}
    </div>`;

  // Intake tab — client responses + Melissa's private clinical fields
  const intake = data.intake;
  document.getElementById('tab-intake').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px;max-width:680px">

      <!-- Client's submitted responses -->
      <div class="card" style="padding:24px">
        <h4 style="font-family:'Playfair Display',serif;font-size:18px;margin-bottom:4px">Client Intake Responses</h4>
        ${intake ? `
          <p style="font-size:12px;color:var(--text-light);margin-bottom:20px">Submitted by client on ${intake.submitted_at?.split('T')[0]}</p>
          ${intakeRow('Reason for seeking therapy', intake.reason_for_seeking)}
          ${intakeRow('Previous therapy experience', intake.previous_therapy)}
          ${intakeRow('Goals', intake.goals)}
          ${intakeRow('Anything else', intake.anything_else)}
        ` : `
          <div style="text-align:center;padding:24px 0;color:var(--text-light)">
            <i class="fas fa-clipboard" style="font-size:36px;opacity:0.3;display:block;margin-bottom:12px"></i>
            <p>Client has not yet completed the intake form</p>
          </div>`}
      </div>

      <!-- Melissa's private clinical section -->
      <div class="card" style="padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <h4 style="font-family:'Playfair Display',serif;font-size:18px;margin-bottom:4px">Clinical Notes <span style="font-size:12px;background:var(--purple-light);color:var(--purple);padding:2px 8px;border-radius:50px;font-family:Inter,sans-serif;font-weight:500">Private</span></h4>
            <p style="font-size:12px;color:var(--text-light)">Added by Melissa only — not visible to client</p>
          </div>
          <button class="btn-sm btn-green" onclick="saveClinicalNotes(${c.id})">Save</button>
        </div>
        <div class="form-group">
          <label>Current Medications</label>
          <textarea id="clinical-meds" rows="3" placeholder="List any current medications relevant to mental health…">${intake?.current_medications || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Mental Health History</label>
          <textarea id="clinical-history" rows="4" placeholder="Previous diagnoses, hospitalisations, relevant history…">${intake?.mental_health_history || ''}</textarea>
        </div>
        <div id="clinical-save-msg" style="display:none" class="alert alert-success">Saved successfully</div>
      </div>

    </div>`;
}

function infoRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px">
    <span style="color:var(--text-light)">${label}</span>
    <span style="font-weight:500">${value}</span>
  </div>`;
}

function toggleEditPersonal(clientId) {
  const view = document.getElementById('personal-view');
  const edit = document.getElementById('personal-edit');
  const btn  = document.getElementById('edit-personal-btn');
  const isEditing = edit.style.display === 'block';
  view.style.display = isEditing ? 'block' : 'none';
  edit.style.display = isEditing ? 'none' : 'block';
  btn.innerHTML = isEditing
    ? '<i class="fas fa-pen" style="margin-right:4px"></i>Edit'
    : '<i class="fas fa-times" style="margin-right:4px"></i>Cancel';
}

async function savePersonalInfo(clientId) {
  const body = {
    date_of_birth:           document.getElementById('edit-dob').value || null,
    phone:                   document.getElementById('edit-phone').value.trim() || null,
    emergency_contact_name:  document.getElementById('edit-emergency-name').value.trim() || null,
    emergency_contact_phone: document.getElementById('edit-emergency-phone').value.trim() || null,
    how_heard:               document.getElementById('edit-how-heard').value.trim() || null,
  };

  const msg = document.getElementById('personal-save-msg');
  msg.style.display = 'none';

  try {
    const resp = await fetch(`${API}/admin/clients/${clientId}/personal`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const r = await resp.json();
    if (resp.ok && r.ok) {
      msg.className = 'alert alert-success';
      msg.textContent = 'Saved successfully';
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; openClient(clientId); }, 1200);
    } else {
      msg.className = 'alert alert-error';
      msg.textContent = r.error || `Server error (${resp.status})`;
      msg.style.display = 'block';
    }
  } catch (e) {
    msg.className = 'alert alert-error';
    msg.textContent = 'Connection error — is the server running?';
    msg.style.display = 'block';
  }
}

function intakeRow(label, value) {
  if (!value) return '';
  return `<div style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">${label}</div>
    <div style="font-size:14px;color:var(--text);line-height:1.7;background:var(--light);padding:12px;border-radius:var(--radius-sm)">${value}</div>
  </div>`;
}

async function saveClinicalNotes(clientId) {
  const meds    = document.getElementById('clinical-meds').value.trim();
  const history = document.getElementById('clinical-history').value.trim();
  const msg     = document.getElementById('clinical-save-msg');
  msg.style.display = 'none';

  try {
    const resp = await fetch(`${API}/admin/clinical/${clientId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_medications: meds, mental_health_history: history })
    });
    const r = await resp.json();
    if (resp.ok && r.ok) {
      msg.className = 'alert alert-success';
      msg.textContent = 'Saved successfully';
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 2500);
    } else {
      msg.className = 'alert alert-error';
      msg.textContent = r.error || `Server error (${resp.status})`;
      msg.style.display = 'block';
    }
  } catch (e) {
    msg.className = 'alert alert-error';
    msg.textContent = 'Connection error — is the server running?';
    msg.style.display = 'block';
  }
}

// ─── SESSION NOTES ─────────────────────────────────────────────────────────

async function loadNotes(clientId) {
  const notes = await api(`/admin/notes/${clientId}`) || [];
  const el = document.getElementById('tab-notes');

  const today = new Date().toISOString().split('T')[0];
  el.innerHTML = `
    <div class="note-form-wrap" style="margin-bottom:20px">
      <h4>Add session note</h4>
      <div class="form-row" style="margin-bottom:12px">
        <div class="form-group" style="margin-bottom:0">
          <label>Date</label>
          <input type="date" id="note-date" value="${today}" class="form-group input">
        </div>
      </div>
      <div class="form-group">
        <label>Notes <span style="font-size:11px;color:var(--text-light)">(Private — only visible to you)</span></label>
        <textarea id="note-content" rows="5" placeholder="Session observations, themes discussed, next steps…"></textarea>
      </div>
      <button class="btn-sm btn-green" onclick="saveNote(${clientId})">Save Note</button>
    </div>
    <div class="notes-list">
      ${notes.length ? notes.map(n => `
        <div class="note-card" id="note-${n.id}">
          <div class="note-header">
            <span class="note-date"><i class="fas fa-lock" style="font-size:10px;opacity:0.5;margin-right:4px"></i>${n.note_date}</span>
            <div style="display:flex;gap:6px">
              <button class="btn-icon amber" onclick="editNote(${n.id})" title="Edit"><i class="fas fa-pen"></i></button>
              <button class="btn-icon red" onclick="deleteNote(${n.id},${clientId})" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="note-body" id="note-body-${n.id}">${n.content}</div>
        </div>`).join('') : `<div style="text-align:center;color:var(--text-light);padding:32px;font-size:14px">No notes yet for this client</div>`}
    </div>`;
}

async function saveNote(clientId) {
  const date = document.getElementById('note-date').value;
  const content = document.getElementById('note-content').value.trim();
  if (!content) return alert('Please write a note first');
  await api('/admin/notes', { method: 'POST', body: JSON.stringify({ client_id: clientId, note_date: date, content }) });
  loadNotes(clientId);
}

async function deleteNote(id, clientId) {
  if (!confirm('Delete this note? This cannot be undone.')) return;
  await api(`/admin/notes/${id}`, { method: 'DELETE' });
  loadNotes(clientId);
}

function editNote(id) {
  const bodyEl = document.getElementById(`note-body-${id}`);
  const current = bodyEl.textContent;
  bodyEl.innerHTML = `
    <textarea style="width:100%;min-height:100px;font-family:Inter,sans-serif;font-size:14px;padding:8px;border:1px solid var(--border);border-radius:6px;outline:none" id="edit-${id}">${current}</textarea>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-sm btn-green" onclick="saveEditNote(${id})">Save</button>
      <button class="btn-sm" onclick="loadNotes(${currentDetailClient.id})">Cancel</button>
    </div>`;
}

async function saveEditNote(id) {
  const content = document.getElementById(`edit-${id}`).value.trim();
  if (!content) return;
  await api(`/admin/notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) });
  loadNotes(currentDetailClient.id);
}

// ─── MESSAGES ──────────────────────────────────────────────────────────────

async function loadMessages() {
  allConversations = await api('/admin/clients') || [];
  renderConversations(allConversations);
}

function renderConversations(clients) {
  const el = document.getElementById('conversations-list');
  if (!clients.length) { el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-light);font-size:14px">No clients yet</div>`; return; }
  el.innerHTML = clients.map(c => `
    <div class="conversation-item ${currentChatClient?.id === c.id ? 'active' : ''}" onclick="openChat(${c.id}, '${c.first_name}', '${c.last_name}')">
      <div class="conv-avatar">${c.first_name[0]}${c.last_name[0]}</div>
      <div style="flex:1;min-width:0">
        <div class="conv-name">${c.first_name} ${c.last_name}</div>
        <div class="conv-preview">${c.email}</div>
      </div>
      ${c.unread_msgs > 0 ? `<div class="conv-unread"></div>` : ''}
    </div>`).join('');
}

function filterConversations(q) {
  renderConversations(allConversations.filter(c => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q.toLowerCase())));
}

async function openChat(clientId, firstName, lastName) {
  currentChatClient = { id: clientId, name: `${firstName} ${lastName}` };
  const msgs = await api(`/messages/${clientId}`) || [];
  const mainEl = document.getElementById('messages-main');
  mainEl.innerHTML = `
    <div class="messages-header">${firstName} ${lastName}</div>
    <div class="messages-body" id="chat-body">
      ${msgs.length ? msgs.map(m => `
        <div>
          <div class="message-bubble from-${m.from_type}">${m.body}</div>
          <div class="message-time" style="text-align:${m.from_type === 'admin' ? 'right' : 'left'}">${new Date(m.sent_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>`).join('') : `<div style="text-align:center;color:var(--text-light);margin-top:40px;font-size:14px">No messages yet</div>`}
    </div>
    <div class="messages-compose">
      <textarea id="chat-reply" placeholder="Type a message…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAdminMsg()}"></textarea>
      <button class="btn-sm btn-green" onclick="sendAdminMsg()" style="height:60px;padding:0 18px">Send</button>
    </div>`;
  const body = document.getElementById('chat-body');
  body.scrollTop = body.scrollHeight;

  // Update unread badges
  document.querySelectorAll('.badge').forEach(b => { if (b.closest('.nav-item')?.dataset.page === 'messages') b.style.display = 'none'; });
}

async function sendAdminMsg() {
  if (!currentChatClient) return;
  const body = document.getElementById('chat-reply').value.trim();
  if (!body) return;
  document.getElementById('chat-reply').value = '';
  await api('/messages', { method: 'POST', body: JSON.stringify({ client_id: currentChatClient.id, body }) });
  openChat(currentChatClient.id, currentChatClient.name.split(' ')[0], currentChatClient.name.split(' ').slice(1).join(' '));
}

// ─── AVAILABILITY ───────────────────────────────────────────────────────────

async function loadAvailability() {
  const slots = await api('/admin/availability') || [];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = {};
  for (let i = 1; i <= 5; i++) byDay[i] = [];
  slots.forEach(s => { if (byDay[s.day_of_week]) byDay[s.day_of_week].push(s); });

  const el = document.getElementById('availability-grid');
  el.innerHTML = `<div class="avail-grid">
    ${[1,2,3,4,5].map(d => `
      <div class="avail-day">
        <div class="avail-day-header">${days[d]}</div>
        <div class="avail-blocks">
          ${byDay[d].length ? byDay[d].map(s => `
            <div class="avail-block ${!s.is_active ? 'inactive' : ''}">
              <i class="fas fa-clock" style="font-size:12px;opacity:0.6"></i>
              ${s.start_time} – ${s.end_time}
              <span style="font-size:11px;opacity:0.7">${s.slot_duration_mins}min slots</span>
              <button class="btn-icon amber" onclick="toggleAvail(${s.id},${s.is_active ? 0 : 1})" title="${s.is_active ? 'Deactivate' : 'Activate'}" style="width:24px;height:24px;font-size:11px"><i class="fas fa-${s.is_active ? 'pause' : 'play'}"></i></button>
              <button class="btn-icon red" onclick="deleteAvail(${s.id})" title="Delete" style="width:24px;height:24px;font-size:11px"><i class="fas fa-trash"></i></button>
            </div>`) .join('') : `<span style="font-size:13px;color:var(--text-light)">No availability set</span>`}
        </div>
      </div>`).join('')}
  </div>`;
}

async function toggleAvail(id, newActive) {
  const slots = await api('/admin/availability') || [];
  const s = slots.find(x => x.id === id);
  if (!s) return;
  await api(`/admin/availability/${id}`, { method: 'PUT', body: JSON.stringify({ start_time: s.start_time, end_time: s.end_time, slot_duration_mins: s.slot_duration_mins, is_active: newActive }) });
  loadAvailability();
}

async function deleteAvail(id) {
  if (!confirm('Delete this availability block?')) return;
  await api(`/admin/availability/${id}`, { method: 'DELETE' });
  loadAvailability();
}

function openAddAvailability() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  document.getElementById('modal-content').innerHTML = `
    <h3 class="modal-title">Add Availability Block</h3>
    <div class="form-group">
      <label>Day of week</label>
      <select id="avail-day">
        ${[1,2,3,4,5,6,0].map(d => `<option value="${d}">${days[d]}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Start time</label>
        <input type="time" id="avail-start" value="09:00">
      </div>
      <div class="form-group">
        <label>End time</label>
        <input type="time" id="avail-end" value="17:00">
      </div>
    </div>
    <div class="form-group">
      <label>Session duration (minutes)</label>
      <select id="avail-duration">
        <option value="50" selected>50 minutes (standard)</option>
        <option value="60">60 minutes</option>
        <option value="45">45 minutes</option>
        <option value="90">90 minutes</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn-sm btn-green" onclick="saveAvailability()">Add Block</button>
    </div>`;
  document.getElementById('modal-overlay').style.display = 'flex';
}

async function saveAvailability() {
  const day = document.getElementById('avail-day').value;
  const start = document.getElementById('avail-start').value;
  const end = document.getElementById('avail-end').value;
  const dur = document.getElementById('avail-duration').value;
  await api('/admin/availability', { method: 'POST', body: JSON.stringify({ day_of_week: parseInt(day), start_time: start, end_time: end, slot_duration_mins: parseInt(dur) }) });
  closeModal();
  loadAvailability();
}

// ─── MODAL ─────────────────────────────────────────────────────────────────

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// ─── ENTER KEY on login ────────────────────────────────────────────────────

document.getElementById('admin-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });