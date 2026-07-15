/* Ruach Practice — Client Portal JS */

const API = '/api';
let clientToken = localStorage.getItem('ruach_client_token');
let clientUser = JSON.parse(localStorage.getItem('ruach_client_user') || 'null');
let calYear, calMonth, selectedDate, selectedSlot;

// ─── INIT ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  if (clientToken && clientUser) {
    // Already logged in — go straight to portal
    showPortal();
  } else {
    // Not logged in — show public booking view
    showPublicBooking();
  }
});

// ─── PUBLIC BOOKING (no login needed to browse) ────────────────────────────

function showPublicBooking() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('portal-app').style.display = 'none';
  document.getElementById('public-booking').style.display = 'block';
  renderPublicCalendar();
}

function renderPublicCalendar() {
  const d = new Date(calYear, calMonth, 1);
  document.getElementById('pub-cal-month').textContent =
    d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const daysEl = document.getElementById('pub-cal-days');
  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay = d.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calYear, calMonth, day);
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = date.toDateString() === new Date().toDateString();
    const isPast = date < today;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isSelected = dateStr === selectedDate;
    let cls = 'cal-day';
    if (isPast || isWeekend) cls += ' disabled';
    else cls += ' has-slots';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';
    html += `<div class="${cls}" ${(!isPast && !isWeekend) ? `onclick="pubSelectDate('${dateStr}')"` : ''}>${day}</div>`;
  }
  daysEl.innerHTML = html;
}

function pubPrevMonth() {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  selectedDate = null; selectedSlot = null;
  renderPublicCalendar();
  document.getElementById('pub-slots-container').innerHTML = '';
  document.getElementById('pub-slots-heading').textContent = 'Select a date to see available times';
  document.getElementById('pub-booking-confirm').style.display = 'none';
}

function pubNextMonth() {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  selectedDate = null; selectedSlot = null;
  renderPublicCalendar();
  document.getElementById('pub-slots-container').innerHTML = '';
  document.getElementById('pub-slots-heading').textContent = 'Select a date to see available times';
  document.getElementById('pub-booking-confirm').style.display = 'none';
}

async function pubSelectDate(dateStr) {
  selectedDate = dateStr;
  selectedSlot = null;
  document.getElementById('pub-booking-confirm').style.display = 'none';
  renderPublicCalendar();

  const d = new Date(dateStr + 'T12:00:00Z');
  document.getElementById('pub-slots-heading').textContent =
    `Available times — ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  document.getElementById('pub-slots-container').innerHTML =
    `<div style="text-align:center;padding:20px;color:var(--text-light)"><i class="fas fa-spinner fa-spin"></i></div>`;

  // Public fetch — no auth token needed
  const r = await fetch(`${API}/booking/slots?date=${dateStr}`);
  const slots = await r.json();

  if (!slots || !slots.length) {
    document.getElementById('pub-slots-container').innerHTML =
      `<div class="slots-empty"><i class="fas fa-calendar-times" style="font-size:32px;margin-bottom:8px;display:block"></i>No available times on this date</div>`;
    return;
  }
  document.getElementById('pub-slots-container').innerHTML = `
    <div class="slots-grid">
      ${slots.map(s => `<button class="slot-btn" id="pub-slot-${s}" onclick="pubSelectSlot('${s}')">${formatTime(s)}</button>`).join('')}
    </div>`;
}

function pubSelectSlot(time) {
  selectedSlot = time;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById(`pub-slot-${time}`)?.classList.add('selected');
  const d = new Date(selectedDate + 'T12:00:00Z');
  document.getElementById('pub-confirm-date').textContent =
    d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('pub-confirm-time').textContent = formatTime(time);
  document.getElementById('pub-booking-confirm').style.display = 'block';
  // Scroll to confirm panel smoothly
  document.getElementById('pub-booking-confirm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function pubConfirmClick() {
  // Save selection, then show auth
  sessionStorage.setItem('pending_date', selectedDate);
  sessionStorage.setItem('pending_slot', selectedSlot);
  sessionStorage.setItem('pending_type', document.getElementById('pub-confirm-type').value);
  showAuth();
}

// ─── AUTH (shown after slot selected) ─────────────────────────────────────

function showAuth() {
  document.getElementById('public-booking').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  // Show a summary of what they're booking
  const date = sessionStorage.getItem('pending_date');
  const slot = sessionStorage.getItem('pending_slot');
  if (date && slot) {
    const d = new Date(date + 'T12:00:00Z');
    const summary = `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${formatTime(slot)}`;
    document.getElementById('auth-booking-summary').style.display = 'block';
    document.getElementById('auth-booking-summary').innerHTML =
      `<i class="fas fa-calendar-check" style="color:var(--green);margin-right:8px"></i>Booking: <strong>${summary}</strong>`;
  }
}

function showAuthTab(tab) {
  document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login-btn').style.background = tab === 'login' ? 'var(--green)' : 'transparent';
  document.getElementById('tab-login-btn').style.color = tab === 'login' ? '#fff' : 'var(--text-light)';
  document.getElementById('tab-reg-btn').style.background = tab === 'register' ? 'var(--green)' : 'transparent';
  document.getElementById('tab-reg-btn').style.color = tab === 'register' ? '#fff' : 'var(--text-light)';
  document.getElementById('auth-error').style.display = 'none';
}

function goBackToBooking() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('public-booking').style.display = 'block';
}

async function clientLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('auth-error');
  err.style.display = 'none';
  try {
    const r = await fetch(`${API}/auth/client/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) { err.textContent = data.error; err.style.display = 'block'; return; }
    clientToken = data.token;
    clientUser = { id: data.id, name: data.name, intake_completed: data.intake_completed };
    localStorage.setItem('ruach_client_token', clientToken);
    localStorage.setItem('ruach_client_user', JSON.stringify(clientUser));
    afterAuth();
  } catch (e) { err.textContent = 'Connection error'; err.style.display = 'block'; }
}

async function clientRegister() {
  const err = document.getElementById('auth-error');
  err.style.display = 'none';
  const body = {
    first_name:         document.getElementById('reg-first').value.trim(),
    last_name:          document.getElementById('reg-last').value.trim(),
    email:              document.getElementById('reg-email').value.trim(),
    password:           document.getElementById('reg-password').value,
    date_of_birth:      document.getElementById('reg-dob').value || null,
    phone:              document.getElementById('reg-phone').value.trim(),
    preferred_language: document.getElementById('reg-language').value,
    how_heard:          document.getElementById('reg-heard').value.trim()
  };
  if (!body.first_name || !body.last_name || !body.email || !body.password || !body.date_of_birth || !body.phone) {
    err.textContent = 'Please fill in all required fields (marked with *)';
    err.style.display = 'block'; return;
  }
  try {
    const r = await fetch(`${API}/auth/client/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) { err.textContent = data.error; err.style.display = 'block'; return; }
    clientToken = data.token;
    clientUser = { id: data.id, name: data.name, intake_completed: 0 };
    localStorage.setItem('ruach_client_token', clientToken);
    localStorage.setItem('ruach_client_user', JSON.stringify(clientUser));
    afterAuth();
  } catch (e) { err.textContent = 'Connection error'; err.style.display = 'block'; }
}

// After login/register: check for pending booking, then show portal or intake
async function afterAuth() {
  const pendingDate = sessionStorage.getItem('pending_date');
  const pendingSlot = sessionStorage.getItem('pending_slot');
  const pendingType = sessionStorage.getItem('pending_type');
  sessionStorage.removeItem('pending_date');
  sessionStorage.removeItem('pending_slot');
  sessionStorage.removeItem('pending_type');

  if (!clientUser.intake_completed) {
    // New client — show intake first, then confirm booking after
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('intake-screen').style.display = 'block';
    // Store booking to complete after intake
    if (pendingDate) {
      sessionStorage.setItem('post_intake_date', pendingDate);
      sessionStorage.setItem('post_intake_slot', pendingSlot);
      sessionStorage.setItem('post_intake_type', pendingType);
    }
    return;
  }

  document.getElementById('auth-screen').style.display = 'none';
  showPortal();

  // If there's a pending booking, confirm it automatically
  if (pendingDate && pendingSlot) {
    await completePendingBooking(pendingDate, pendingSlot, pendingType);
  }
}

async function completePendingBooking(date, slot, type) {
  const r = await capi('/booking/request', {
    method: 'POST',
    body: JSON.stringify({ date, start_time: slot, session_type: type || 'Individual therapy' })
  });
  if (r?.id) {
    // Navigate to book page and show success
    goPPage('book', document.querySelector('[data-ppage=book]'));
    document.getElementById('booking-success').style.display = 'flex';
  }
}

function showPortal() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('public-booking').style.display = 'none';
  if (!clientUser.intake_completed) {
    document.getElementById('intake-screen').style.display = 'block';
  } else {
    document.getElementById('portal-app').style.display = 'block';
    document.getElementById('client-greeting').textContent = `Hi, ${clientUser.name}!`;
    document.getElementById('home-name').textContent = clientUser.name;
    loadHomePage();
    renderCalendar();
    loadClientMessages();
  }
}

function clientLogout() {
  localStorage.removeItem('ruach_client_token');
  localStorage.removeItem('ruach_client_user');
  clientToken = null; clientUser = null;
  document.getElementById('portal-app').style.display = 'none';
  document.getElementById('public-booking').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  // Clear the booking summary banner
  document.getElementById('auth-booking-summary').style.display = 'none';
  // Update auth screen to show a "browse booking" option
  document.getElementById('auth-booking-summary').innerHTML = '';
  showAuthTab('login');
}

// ─── API HELPER ────────────────────────────────────────────────────────────

async function capi(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${clientToken}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (r.status === 401) { clientLogout(); return null; }
  return r.json();
}

// ─── INTAKE FORM ───────────────────────────────────────────────────────────

async function submitIntake() {
  const err = document.getElementById('intake-error');
  err.style.display = 'none';
  const reason = document.getElementById('intake-reason').value.trim();
  const goals  = document.getElementById('intake-goals').value.trim();
  const emergencyName  = document.getElementById('intake-emergency-name').value.trim();
  const emergencyPhone = document.getElementById('intake-emergency-phone').value.trim();

  if (!emergencyName || !emergencyPhone) {
    err.textContent = 'Please provide your emergency contact details'; err.style.display = 'block'; return;
  }
  if (!reason || !goals) {
    err.textContent = 'Please fill in the required fields'; err.style.display = 'block'; return;
  }

  const data = {
    reason_for_seeking: reason,
    previous_therapy:   document.getElementById('intake-prev').value.trim(),
    goals,
    anything_else:      document.getElementById('intake-else').value.trim(),
    emergency_contact_name:  emergencyName,
    emergency_contact_phone: emergencyPhone,
  };
  const r = await capi('/intake', { method: 'POST', body: JSON.stringify(data) });
  if (r?.ok) {
    clientUser.intake_completed = 1;
    localStorage.setItem('ruach_client_user', JSON.stringify(clientUser));
    document.getElementById('intake-screen').style.display = 'none';
    showPortal();
    // Complete any booking that was pending before intake
    const date = sessionStorage.getItem('post_intake_date');
    const slot = sessionStorage.getItem('post_intake_slot');
    const type = sessionStorage.getItem('post_intake_type');
    sessionStorage.removeItem('post_intake_date');
    sessionStorage.removeItem('post_intake_slot');
    sessionStorage.removeItem('post_intake_type');
    if (date && slot) await completePendingBooking(date, slot, type);
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────

function setMobNav(activeId) {
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(activeId);
  if (el) el.classList.add('active');
}

function goPPage(page, linkEl) {
  document.querySelectorAll('.portal-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.portal-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`ppage-${page}`).classList.add('active');
  if (linkEl) linkEl.classList.add('active');
  // Sync mobile bottom nav
  const mobMap = { home: 'mob-home', book: 'mob-book', appointments: 'mob-appointments', messages: 'mob-messages' };
  if (mobMap[page]) setMobNav(mobMap[page]);
  // Scroll to top on page change
  window.scrollTo(0, 0);
  if (page === 'appointments') loadClientAppointments();
  if (page === 'messages') loadClientMessages();
  if (page === 'home') loadHomePage();
}

// ─── HOME ──────────────────────────────────────────────────────────────────

async function loadHomePage() {
  const apts = await capi('/client/appointments') || [];
  const today = new Date().toISOString().split('T')[0];
  const next = apts.find(a => a.status === 'confirmed' && a.date >= today);
  const el = document.getElementById('client-next-session');
  if (next) {
    const d = new Date(next.date + 'T12:00:00Z');
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px">
        <div style="width:56px;height:56px;background:#dcfce7;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:11px;color:var(--green);font-weight:600;text-transform:uppercase">${d.toLocaleDateString('en-GB',{month:'short'})}</span>
          <span style="font-size:22px;font-weight:700;color:var(--green-dark);line-height:1">${d.getUTCDate()}</span>
        </div>
        <div>
          <div style="font-weight:600;font-size:15px">${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div>
          <div style="font-size:13px;color:var(--text-light)"><i class="fas fa-clock" style="margin-right:4px;color:var(--green)"></i>${next.start_time} – ${next.end_time} · ${next.session_type}</div>
          <span class="status-badge status-${next.status}" style="margin-top:6px;display:inline-block">${next.status}</span>
        </div>
      </div>`;
  } else {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-light);font-size:14px">
      <i class="fas fa-calendar-plus" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px"></i>
      No upcoming sessions. <a href="#" onclick="goPPage('book',document.querySelector('[data-ppage=book]'));return false" style="color:var(--green);font-weight:500">Book one now →</a>
    </div>`;
  }
}

// ─── IN-PORTAL BOOKING CALENDAR ───────────────────────────────────────────

function renderCalendar() {
  const d = new Date(calYear, calMonth, 1);
  document.getElementById('cal-month').textContent = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const daysEl = document.getElementById('cal-days');
  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay = d.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calYear, calMonth, day);
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = date.toDateString() === new Date().toDateString();
    const isPast = date < today;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isSelected = dateStr === selectedDate;
    let cls = 'cal-day';
    if (isPast || isWeekend) cls += ' disabled';
    else cls += ' has-slots';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';
    html += `<div class="${cls}" ${(!isPast && !isWeekend) ? `onclick="selectDate('${dateStr}')"` : ''}>${day}</div>`;
  }
  daysEl.innerHTML = html;
}

function prevMonth() {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  selectedDate = null; selectedSlot = null;
  renderCalendar();
  document.getElementById('slots-container').innerHTML = '';
  document.getElementById('slots-heading').textContent = 'Select a date to see available times';
  document.getElementById('booking-confirm').style.display = 'none';
}

function nextMonth() {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  selectedDate = null; selectedSlot = null;
  renderCalendar();
  document.getElementById('slots-container').innerHTML = '';
  document.getElementById('slots-heading').textContent = 'Select a date to see available times';
  document.getElementById('booking-confirm').style.display = 'none';
}

async function selectDate(dateStr) {
  selectedDate = dateStr; selectedSlot = null;
  document.getElementById('booking-confirm').style.display = 'none';
  renderCalendar();
  const d = new Date(dateStr + 'T12:00:00Z');
  document.getElementById('slots-heading').textContent =
    `Available times — ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  document.getElementById('slots-container').innerHTML =
    `<div style="text-align:center;padding:20px;color:var(--text-light)"><i class="fas fa-spinner fa-spin"></i></div>`;
  const slots = await capi(`/booking/slots?date=${dateStr}`);
  if (!slots || !slots.length) {
    document.getElementById('slots-container').innerHTML =
      `<div class="slots-empty"><i class="fas fa-calendar-times" style="font-size:32px;margin-bottom:8px;display:block"></i>No available times on this date</div>`;
    return;
  }
  document.getElementById('slots-container').innerHTML = `
    <div class="slots-grid">
      ${slots.map(s => `<button class="slot-btn" id="slot-${s}" onclick="selectSlot('${s}')">${formatTime(s)}</button>`).join('')}
    </div>`;
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function selectSlot(time) {
  selectedSlot = time;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById(`slot-${time}`)?.classList.add('selected');
  const d = new Date(selectedDate + 'T12:00:00Z');
  document.getElementById('confirm-date').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('confirm-time').textContent = formatTime(time);
  document.getElementById('booking-confirm').style.display = 'block';
}

async function confirmBooking() {
  if (!selectedDate || !selectedSlot) return;
  const type = document.getElementById('confirm-type').value;
  const r = await capi('/booking/request', { method: 'POST', body: JSON.stringify({ date: selectedDate, start_time: selectedSlot, session_type: type }) });
  if (r?.id) {
    document.getElementById('booking-success').style.display = 'flex';
    selectedDate = null; selectedSlot = null;
    renderCalendar();
    document.getElementById('slots-container').innerHTML = '';
    document.getElementById('booking-confirm').style.display = 'none';
    document.getElementById('slots-heading').textContent = 'Select a date to see available times';
  } else {
    alert(r?.error || 'Booking failed. Please try another slot.');
  }
}

// ─── CLIENT APPOINTMENTS ───────────────────────────────────────────────────

async function loadClientAppointments() {
  const apts = await capi('/client/appointments') || [];
  const today = new Date().toISOString().split('T')[0];
  const upcoming = apts.filter(a => a.date >= today && a.status !== 'cancelled');
  const past = apts.filter(a => a.date < today || a.status === 'cancelled');
  const el = document.getElementById('client-appointments-list');
  let html = '';
  if (upcoming.length) {
    html += `<h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Upcoming</h3>`;
    html += upcoming.map(a => renderClientApt(a, true)).join('');
  }
  if (past.length) {
    html += `<h3 style="font-size:16px;font-weight:600;margin:24px 0 12px">Past Sessions</h3>`;
    html += past.map(a => renderClientApt(a, false)).join('');
  }
  if (!apts.length) html = `<div class="card" style="padding:40px;text-align:center;color:var(--text-light)">
    <i class="fas fa-calendar" style="font-size:36px;opacity:0.3;display:block;margin-bottom:12px"></i>
    No sessions yet. <a href="#" onclick="goPPage('book',document.querySelector('[data-ppage=book]'));return false" style="color:var(--green);font-weight:500">Book your first session →</a>
  </div>`;
  el.innerHTML = html;
}

function renderClientApt(a, canCancel) {
  const d = new Date(a.date + 'T12:00:00Z');
  return `<div class="card" style="padding:20px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="width:50px;height:50px;background:#f0f9f4;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:10px;color:var(--green);font-weight:600;text-transform:uppercase">${d.toLocaleDateString('en-GB',{month:'short'})}</span>
          <span style="font-size:20px;font-weight:700;color:var(--green-dark);line-height:1">${d.getUTCDate()}</span>
        </div>
        <div>
          <div style="font-weight:600">${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div>
          <div style="font-size:13px;color:var(--text-light)">${a.start_time} – ${a.end_time} · ${a.session_type}</div>
          ${a.notes_for_client ? `<div style="font-size:12px;color:var(--text-light);margin-top:4px;font-style:italic">Note from Melissa: ${a.notes_for_client}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="status-badge status-${a.status}">${a.status}</span>
        ${canCancel && a.status !== 'cancelled' ? `<button class="btn-sm" onclick="cancelApt(${a.id})" style="color:var(--red);border-color:var(--red)">Cancel</button>` : ''}
      </div>
    </div>
  </div>`;
}

async function cancelApt(id) {
  if (!confirm('Are you sure you want to cancel this session?')) return;
  const r = await capi(`/client/appointments/${id}/cancel`, { method: 'PUT' });
  if (r?.ok) loadClientAppointments();
}

// ─── CLIENT MESSAGES ───────────────────────────────────────────────────────

async function loadClientMessages() {
  const msgs = await capi(`/messages/${clientUser.id}`) || [];
  const el = document.getElementById('client-chat-body');
  if (!el) return;
  el.innerHTML = msgs.length ? msgs.map(m => `
    <div>
      <div class="message-bubble from-${m.from_type === 'client' ? 'admin' : 'client'}" style="${m.from_type === 'client' ? 'background:var(--green);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;border-bottom-left-radius:14px;' : ''}">
        ${m.body}
      </div>
      <div class="message-time" style="text-align:${m.from_type === 'client' ? 'right' : 'left'}">${new Date(m.sent_at).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'})}</div>
    </div>`).join('') : `<div style="text-align:center;color:var(--text-light);margin:auto;font-size:14px">
      <i class="fas fa-comment-dots" style="font-size:36px;opacity:0.2;display:block;margin-bottom:12px"></i>
      Send Melissa a message
    </div>`;
  el.scrollTop = el.scrollHeight;
}

async function sendClientMsg() {
  const input = document.getElementById('client-msg-input');
  const body = input.value.trim();
  if (!body) return;
  input.value = '';
  await capi('/messages', { method: 'POST', body: JSON.stringify({ client_id: clientUser.id, body }) });
  loadClientMessages();
}