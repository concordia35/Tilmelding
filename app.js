import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const setupNotice = document.getElementById('setupNotice');
const globalMessage = document.getElementById('globalMessage');
const globalError = document.getElementById('globalError');
const appArea = document.getElementById('appArea');
const authLoggedOut = document.getElementById('authLoggedOut');
const authLoggedIn = document.getElementById('authLoggedIn');
const currentUserText = document.getElementById('currentUserText');

const eventList = document.getElementById('eventList');
const eventInfo = document.getElementById('eventInfo');
const attendingList = document.getElementById('attendingList');
const absentList = document.getElementById('absentList');
const attendingCount = document.getElementById('attendingCount');
const absentCount = document.getElementById('absentCount');
const totalCount = document.getElementById('totalCount');
const deadlineText = document.getElementById('deadlineText');
const memberActionBox = document.getElementById('memberActionBox');
const adminArea = document.getElementById('adminArea');

const memberAdminSelect = document.getElementById('memberAdminSelect');
const memberEmailInput = document.getElementById('memberEmailInput');
const memberPhoneInput = document.getElementById('memberPhoneInput');
const memberOptInOnlyInput = document.getElementById('memberOptInOnlyInput');
const memberRoleInput = document.getElementById('memberRoleInput');

const loginMemberSelect = document.getElementById('loginMemberSelect');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const saveReminderBtn = document.getElementById('saveReminderBtn');
const addEventBtn = document.getElementById('addEventBtn');
const saveMemberBtn = document.getElementById('saveMemberBtn');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');

const reminderDaysInput = document.getElementById('reminderDaysInput');
const reminderChannelInput = document.getElementById('reminderChannelInput');

let supabase = null;
let state = {
  session: null,
  profile: null,
  members: [],
  events: [],
  attendance: [],
  settings: { reminder_days: 2, reminder_channel: 'mail' },
  selectedEventId: null,
};

function showSetupNotice(message) {
  setupNotice.textContent = message;
  setupNotice.classList.remove('hidden');
}

function setMessage(message = '') {
  if (!message) {
    globalMessage.classList.add('hidden');
    globalMessage.textContent = '';
    return;
  }
  globalMessage.textContent = message;
  globalMessage.classList.remove('hidden');
  setTimeout(() => {
    globalMessage.classList.add('hidden');
  }, 3500);
}

function setError(message = '') {
  if (!message) {
    globalError.classList.add('hidden');
    globalError.textContent = '';
    return;
  }
  globalError.textContent = message;
  globalError.classList.remove('hidden');
}

function formatDanishDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('da-DK', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function getCurrentEvent() {
  return state.events.find(event => event.id === state.selectedEventId) || null;
}

function getDeadlineDate(event) {
  const eventDateTime = new Date(`${event.event_date}T${event.event_time || '19:00'}:00`);
  const deadline = new Date(eventDateTime);
  deadline.setDate(deadline.getDate() - (Number(event.deadline_days_before) || 0));
  return deadline;
}

function isBeforeDeadline(event) {
  return new Date() <= getDeadlineDate(event);
}

function getDeadlineLabel(event) {
  const deadline = getDeadlineDate(event);
  return deadline.toLocaleDateString('da-DK', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) + ' kl. ' + String(deadline.getHours()).padStart(2, '0') + '.' + String(deadline.getMinutes()).padStart(2, '0');
}

function getAttendanceForEvent(eventId) {
  return state.attendance.filter(row => row.event_id === eventId);
}

function getAttendanceRow(eventId, memberId) {
  return state.attendance.find(row => row.event_id === eventId && row.member_id === memberId) || null;
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

async function initializeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_') || SUPABASE_ANON_KEY.includes('YOUR_')) {
    showSetupNotice('Udfyld først supabase-config.js med din Supabase URL og anon key. Kør derefter database/schema.sql og database/seed.sql i Supabase.');
    return false;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

async function fetchProfileAndData() {
  const email = state.session?.user?.email;
  if (!email) return;

  const [{ data: profile, error: profileError }, { data: members, error: membersError }, { data: events, error: eventsError }, { data: attendance, error: attendanceError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('members').select('*').eq('email', email).single(),
    supabase.from('members').select('*').eq('active', true).order('full_name'),
    supabase.from('events').select('*').eq('active', true).order('event_date'),
    supabase.from('attendance').select('*'),
    supabase.from('app_settings').select('*').limit(1).maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (membersError) throw membersError;
  if (eventsError) throw eventsError;
  if (attendanceError) throw attendanceError;
  if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

  state.profile = profile;
  state.members = members || [];
  state.events = events || [];
  state.attendance = attendance || [];
  state.settings = settings || { reminder_days: 2, reminder_channel: 'mail' };

  if (!state.selectedEventId && state.events.length) state.selectedEventId = state.events[0].id;
  if (state.selectedEventId && !state.events.some(event => event.id === state.selectedEventId)) {
    state.selectedEventId = state.events[0]?.id || null;
  }
}


function renderLoginMemberOptions() {
  if (!loginMemberSelect) return;
  const members = [...state.members].sort((a, b) => a.full_name.localeCompare(b.full_name, 'da'));
  loginMemberSelect.innerHTML = '<option value="">Vælg dit navn</option>' + members.map(member => {
    const emailNote = member.email ? '' : ' (mangler e-mail)';
    return `<option value="${member.id}">${member.full_name}${emailNote}</option>`;
  }).join('');

  if (state.profile?.id) {
    loginMemberSelect.value = String(state.profile.id);
  }
}

function renderAuthState() {
  const loggedIn = !!state.session;
  authLoggedOut.classList.toggle('hidden', loggedIn);
  authLoggedIn.classList.toggle('hidden', !loggedIn);
  appArea.classList.toggle('hidden', !loggedIn || !state.profile);

  if (loggedIn && state.profile) {
    currentUserText.textContent = `${state.profile.full_name} · ${state.profile.role === 'admin' ? 'Admin' : 'Broder'} · ${state.profile.email}`;
  } else {
    currentUserText.textContent = '';
  }
}

function renderEventButtons() {
  eventList.innerHTML = '';
  if (!state.events.length) {
    eventList.innerHTML = '<div class="empty">Ingen logeaftener endnu.</div>';
    return;
  }

  state.events.forEach(event => {
    const rows = getAttendanceForEvent(event.id);
    const attending = rows.filter(row => row.status === 'attending').length;

    const button = document.createElement('button');
    button.className = 'event-btn' + (event.id === state.selectedEventId ? ' active' : '');
    button.innerHTML = `
      <div class="event-title">${event.title}</div>
      <div class="event-meta">${formatDanishDate(event.event_date)} kl. ${event.event_time}</div>
      <div class="event-meta">Forventet fremmøde: ${attending}/${state.members.length}</div>
      <div class="event-meta">Frist: ${getDeadlineLabel(event)}</div>
    `;
    button.addEventListener('click', () => {
      state.selectedEventId = event.id;
      render();
    });
    eventList.appendChild(button);
  });
}

async function updateAttendance(memberId, newStatus) {
  const event = getCurrentEvent();
  if (!event || !state.profile) return;
  if (!isAdmin() && !isBeforeDeadline(event)) {
    setError('Fristen er overskredet. Kun admin kan ændre status nu.');
    return;
  }

  const row = getAttendanceRow(event.id, memberId);
  if (!row) return;

  const { error } = await supabase
    .from('attendance')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', row.id);

  if (error) {
    setError(error.message);
    return;
  }

  setError('');
  await loadApp();
  setMessage('Status er opdateret.');
}

function renderMemberAction() {
  const event = getCurrentEvent();
  if (!event || !state.profile) {
    memberActionBox.innerHTML = '';
    return;
  }

  const row = getAttendanceRow(event.id, state.profile.id);
  if (!row) {
    memberActionBox.innerHTML = '<div class="warning">Din medlemsprofil kunne ikke findes på denne logeaften.</div>';
    return;
  }

  const isAbsent = row.status !== 'attending';
  const beforeDeadline = isBeforeDeadline(event);
  const buttonText = isAbsent ? 'Jeg kommer' : 'Meld mig fra';
  const buttonClass = isAbsent ? 'pill pill-on' : 'pill pill-off';
  const statusText = isAbsent ? 'Du står aktuelt som ikke deltagende.' : 'Du står aktuelt som deltagende.';

  memberActionBox.innerHTML = `
    <div class="success-box">
      <strong>${state.profile.full_name}</strong><br>
      ${statusText}
      ${state.profile.opt_in_only ? '<br><span class="mini">Denne broder er ikke automatisk tilmeldt som standard.</span>' : ''}
    </div>
    ${beforeDeadline || isAdmin() ? '' : '<div class="warning">Fristen er overskredet. Kun admin kan ændre status nu.</div>'}
    <div style="margin-bottom:18px;">
      <button id="selfActionBtn" class="${buttonClass}" ${beforeDeadline || isAdmin() ? '' : 'disabled'}>${buttonText}</button>
    </div>
  `;

  document.getElementById('selfActionBtn')?.addEventListener('click', async () => {
    await updateAttendance(state.profile.id, isAbsent ? 'attending' : 'absent');
  });
}

function renderMembers() {
  const event = getCurrentEvent();
  if (!event) {
    eventInfo.innerHTML = '<div class="empty">Vælg en logeaften.</div>';
    return;
  }

  const rows = getAttendanceForEvent(event.id);
  const attendingRows = rows.filter(row => row.status === 'attending');
  const absentRows = rows.filter(row => row.status !== 'attending');

  const attendingMembers = attendingRows
    .map(row => state.members.find(member => member.id === row.member_id))
    .filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'da'));

  const absentMembers = absentRows
    .map(row => state.members.find(member => member.id === row.member_id))
    .filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'da'));

  eventInfo.innerHTML = `
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 6px;">${event.title}</div>
    <div class="muted">${formatDanishDate(event.event_date)} kl. ${event.event_time} · ${event.location}</div>
  `;

  attendingCount.textContent = String(attendingMembers.length);
  absentCount.textContent = String(absentMembers.length);
  totalCount.textContent = String(state.members.length);
  deadlineText.textContent = getDeadlineLabel(event);

  attendingList.innerHTML = '';
  absentList.innerHTML = '';

  attendingMembers.forEach(member => {
    const item = document.createElement('div');
    item.className = 'member';
    item.innerHTML = `
      <div>
        <div class="member-name">${member.full_name}</div>
        <div class="muted">${member.email || 'Ingen mail registreret'}</div>
      </div>
    `;
    if (isAdmin()) {
      const btn = document.createElement('button');
      btn.className = 'pill pill-off';
      btn.textContent = 'Meld fra';
      btn.addEventListener('click', async () => {
        await updateAttendance(member.id, 'absent');
      });
      item.appendChild(btn);
    }
    attendingList.appendChild(item);
  });

  if (!absentMembers.length) {
    absentList.innerHTML = '<div class="empty">Ingen har meldt fra endnu.</div>';
  } else {
    absentMembers.forEach(member => {
      const item = document.createElement('div');
      item.className = 'member';
      item.innerHTML = `
        <div>
          <div class="member-name">${member.full_name}</div>
          <div class="muted">${member.opt_in_only ? 'Ikke automatisk tilmeldt' : 'Har meldt fra'}</div>
        </div>
      `;
      if (isAdmin()) {
        const btn = document.createElement('button');
        btn.className = 'pill pill-on';
        btn.textContent = 'Meld til igen';
        btn.addEventListener('click', async () => {
          await updateAttendance(member.id, 'attending');
        });
        item.appendChild(btn);
      }
      absentList.appendChild(item);
    });
  }
}

function renderAdminArea() {
  adminArea.classList.toggle('hidden', !isAdmin());
  if (!isAdmin()) return;

  reminderDaysInput.value = state.settings.reminder_days ?? 2;
  reminderChannelInput.value = state.settings.reminder_channel ?? 'mail';

  memberAdminSelect.innerHTML = state.members
    .map(member => `<option value="${member.id}">${member.full_name}</option>`)
    .join('');

  hydrateMemberEditor();
}

function hydrateMemberEditor() {
  const memberId = Number(memberAdminSelect.value || state.members[0]?.id || 0);
  const member = state.members.find(row => row.id === memberId);
  if (!member) return;

  memberEmailInput.value = member.email || '';
  memberPhoneInput.value = member.phone || '';
  memberOptInOnlyInput.checked = !!member.opt_in_only;
  memberRoleInput.value = member.role || 'member';
}

async function saveReminderSettings() {
  const payload = {
    id: 1,
    reminder_days: Number(reminderDaysInput.value || 2),
    reminder_channel: reminderChannelInput.value,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('app_settings').upsert(payload);
  if (error) {
    setError(error.message);
    return;
  }
  await loadApp();
  setMessage('Påmindelsesindstillinger er gemt.');
}

async function addEvent() {
  const title = document.getElementById('newEventTitle').value.trim();
  const event_date = document.getElementById('newEventDate').value;
  const event_time = document.getElementById('newEventTime').value || '19:00';
  const location = document.getElementById('newEventLocation').value.trim() || 'Frederiksgade 15, Slagelse';
  const deadline_days_before = Number(document.getElementById('newEventDeadlineDays').value || 2);

  if (!title || !event_date) {
    setError('Udfyld mindst titel og dato.');
    return;
  }

  const { data: insertedEvent, error: eventError } = await supabase
    .from('events')
    .insert([{ title, event_date, event_time, location, deadline_days_before, active: true }])
    .select()
    .single();

  if (eventError) {
    setError(eventError.message);
    return;
  }

  const attendanceRows = state.members.map(member => ({
    event_id: insertedEvent.id,
    member_id: member.id,
    status: member.opt_in_only ? 'absent' : 'attending',
  }));

  const { error: attendanceError } = await supabase.from('attendance').insert(attendanceRows);
  if (attendanceError) {
    setError(attendanceError.message);
    return;
  }

  document.getElementById('newEventTitle').value = '';
  document.getElementById('newEventDate').value = '';
  document.getElementById('newEventTime').value = '19:00';
  document.getElementById('newEventDeadlineDays').value = '2';

  await loadApp(insertedEvent.id);
  setMessage('Ny logeaften er oprettet.');
}

async function saveMember() {
  const memberId = Number(memberAdminSelect.value);
  const existing = state.members.find(member => member.id === memberId);
  if (!existing) return;

  const updated = {
    email: memberEmailInput.value.trim(),
    phone: memberPhoneInput.value.trim(),
    opt_in_only: memberOptInOnlyInput.checked,
    role: memberRoleInput.value,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('members').update(updated).eq('id', memberId);
  if (error) {
    setError(error.message);
    return;
  }

  if (existing.opt_in_only !== updated.opt_in_only) {
    const today = new Date().toISOString().slice(0, 10);
    const futureEvents = state.events.filter(event => event.event_date >= today);

    for (const event of futureEvents) {
      const row = getAttendanceRow(event.id, memberId);
      if (!row) continue;
      const shouldStatus = updated.opt_in_only ? 'absent' : 'attending';
      await supabase.from('attendance').update({ status: shouldStatus }).eq('id', row.id);
    }
  }

  await loadApp();
  setMessage('Medlem er gemt.');
}

function exportData() {
  const payload = {
    profile: state.profile,
    members: state.members,
    events: state.events,
    attendance: state.attendance,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'loge-afmelding-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function loadApp(selectEventId = null) {
  setError('');
  await fetchProfileAndData();
  if (selectEventId) state.selectedEventId = selectEventId;
  render();
}

async function loadLoginMembers() {
  const { data, error } = await supabase.from('members').select('id, full_name, email').eq('active', true).order('full_name');
  if (error) {
    setError(error.message);
    return;
  }
  state.members = data || [];
  renderLoginMemberOptions();
}

function render() {
  renderLoginMemberOptions();
  renderAuthState();
  if (!state.session || !state.profile) return;
  renderEventButtons();
  renderMemberAction();
  renderMembers();
  renderAdminArea();
}

async function login() {
  setError('');
  const memberId = Number(loginMemberSelect.value);
  const password = loginPassword.value;
  const member = state.members.find(row => row.id === memberId);

  if (!memberId || !member || !password) {
    setError('Vælg dit navn og skriv din adgangskode.');
    return;
  }

  if (!member.email) {
    setError('Denne bruger mangler e-mail i medlemslisten. Tilføj e-mail under Admin – medlemmer først.');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: member.email, password });
  if (error) {
    setError(error.message);
    return;
  }

  state.session = data.session;
  await loadApp();
  setMessage('Du er logget ind.');
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    setError(error.message);
    return;
  }
  state.session = null;
  state.profile = null;
  state.events = [];
  state.attendance = [];
  state.selectedEventId = null;
  await loadLoginMembers();
  render();
}

async function boot() {
  const ok = await initializeSupabase();
  if (!ok) return;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    setError(error.message);
    return;
  }

  state.session = session;
  if (session) {
    try {
      await loadApp();
    } catch (err) {
      setError(err.message || 'Kunne ikke hente data.');
    }
  } else {
    await loadLoginMembers();
    render();
  }

  supabase.auth.onAuthStateChange(async (_event, sessionData) => {
    state.session = sessionData;
    if (sessionData) {
      try {
        await loadApp();
      } catch (err) {
        setError(err.message || 'Kunne ikke hente data efter login.');
      }
    } else {
      state.profile = null;
      state.events = [];
      state.attendance = [];
      state.selectedEventId = null;
      await loadLoginMembers();
      render();
    }
  });
}

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
saveReminderBtn.addEventListener('click', saveReminderSettings);
addEventBtn.addEventListener('click', addEvent);
saveMemberBtn.addEventListener('click', saveMember);
refreshBtn.addEventListener('click', () => loadApp());
exportBtn.addEventListener('click', exportData);
memberAdminSelect.addEventListener('change', hydrateMemberEditor);

boot();
