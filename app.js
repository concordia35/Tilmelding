import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const LOCAL_SESSION_KEY = 'loge_shared_login_member_id';

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

const eventAdminSelect = document.getElementById('eventAdminSelect');
const editEventTitle = document.getElementById('editEventTitle');
const editEventDate = document.getElementById('editEventDate');
const editEventTime = document.getElementById('editEventTime');
const editEventLocation = document.getElementById('editEventLocation');
const editEventDeadlineDays = document.getElementById('editEventDeadlineDays');

const loginFullName = document.getElementById('loginFullName');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const saveReminderBtn = document.getElementById('saveReminderBtn');
const addEventBtn = document.getElementById('addEventBtn');
const saveEventBtn = document.getElementById('saveEventBtn');
const deleteEventBtn = document.getElementById('deleteEventBtn');
const saveMemberBtn = document.getElementById('saveMemberBtn');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');

const reminderDaysInput = document.getElementById('reminderDaysInput');
const reminderChannelInput = document.getElementById('reminderChannelInput');
const sharedPasswordInput = document.getElementById('sharedPasswordInput');

let supabase = null;
let state = {
  profile: null,
  members: [],
  events: [],
  absences: [],
  settings: { id: 1, reminder_days: 2, reminder_channel: 'mail', shared_password: 'oddfellow35' },
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

function normalizeName(value) {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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
  const eventDateTime = new Date(`${event.date}T${event.time || '19:00'}:00`);
  const deadline = new Date(eventDateTime);
  deadline.setDate(deadline.getDate() - (Number(event.deadline_days) || 0));
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

function getMemberOverride(eventId, memberId) {
  return state.absences.find(row => row.event_id === eventId && row.member_id === memberId) || null;
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

function computeIsAttending(eventId, member) {
  const override = getMemberOverride(eventId, member.id);
  if (member.opt_in_only) {
    return override?.status === 'attending';
  }
  return override?.status !== 'absent';
}

function getAttendingMembers(eventId) {
  return state.members
    .filter(member => computeIsAttending(eventId, member))
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

function getAbsentMembers(eventId) {
  return state.members
    .filter(member => !computeIsAttending(eventId, member))
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

async function initializeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_') || SUPABASE_ANON_KEY.includes('YOUR_')) {
    showSetupNotice('Udfyld først supabase-config.js med din Supabase URL og publishable key. Kør derefter SQL-filerne i mappen database i Supabase.');
    return false;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

async function fetchAllData() {
  const [{ data: members, error: membersError }, { data: events, error: eventsError }, { data: absences, error: absencesError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('members').select('*').order('name'),
    supabase.from('events').select('*').order('date'),
    supabase.from('absences').select('*'),
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (membersError) throw membersError;
  if (eventsError) throw eventsError;
  if (absencesError) throw absencesError;
  if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

  state.members = members || [];
  state.events = events || [];
  state.absences = absences || [];
  state.settings = settings || { id: 1, reminder_days: 2, reminder_channel: 'mail', shared_password: 'oddfellow35' };

  if (!state.selectedEventId && state.events.length) state.selectedEventId = state.events[0].id;
  if (state.selectedEventId && !state.events.some(event => event.id === state.selectedEventId)) {
    state.selectedEventId = state.events[0]?.id || null;
  }

  const sessionMemberId = Number(localStorage.getItem(LOCAL_SESSION_KEY) || 0);
  state.profile = state.members.find(member => member.id === sessionMemberId) || null;
}

function renderAuthState() {
  const loggedIn = !!state.profile;
  authLoggedOut.classList.toggle('hidden', loggedIn);
  authLoggedIn.classList.toggle('hidden', !loggedIn);
  appArea.classList.toggle('hidden', !loggedIn || !state.profile);

  if (loggedIn) {
    currentUserText.textContent = `${state.profile.name} · ${isAdmin() ? 'Admin' : 'Broder'}${state.profile.email ? ' · ' + state.profile.email : ''}`;
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
    const attending = getAttendingMembers(event.id).length;

    const button = document.createElement('button');
    button.className = 'event-btn' + (event.id === state.selectedEventId ? ' active' : '');
    button.innerHTML = `
      <div class="event-title">${event.title}</div>
      <div class="event-meta">${formatDanishDate(event.date)} kl. ${event.time}</div>
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

async function setAttendance(member, shouldAttend) {
  const event = getCurrentEvent();
  if (!event || !state.profile) return;
  if (!isAdmin() && !isBeforeDeadline(event)) {
    setError('Fristen er overskredet. Kun admin kan ændre status nu.');
    return;
  }

  const existing = getMemberOverride(event.id, member.id);
  const defaultAttend = !member.opt_in_only;

  if (shouldAttend === defaultAttend) {
    if (existing) {
      const { error } = await supabase.from('absences').delete().eq('id', existing.id);
      if (error) return setError(error.message);
    }
  } else {
    const payload = {
      event_id: event.id,
      member_id: member.id,
      status: shouldAttend ? 'attending' : 'absent',
    };

    if (existing) {
      const { error } = await supabase.from('absences').update({ status: payload.status }).eq('id', existing.id);
      if (error) return setError(error.message);
    } else {
      const { error } = await supabase.from('absences').insert([payload]);
      if (error) return setError(error.message);
    }
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

  const isAttending = computeIsAttending(event.id, state.profile);
  const beforeDeadline = isBeforeDeadline(event);
  const buttonText = isAttending ? 'Meld mig fra' : 'Jeg kommer';
  const buttonClass = isAttending ? 'pill pill-off' : 'pill pill-on';
  const statusText = isAttending ? 'Du står aktuelt som deltagende.' : 'Du står aktuelt som ikke deltagende.';

  memberActionBox.innerHTML = `
    <div class="success-box">
      <strong>${state.profile.name}</strong><br>
      ${statusText}
      ${state.profile.opt_in_only ? '<br><span class="mini">Denne broder er ikke automatisk tilmeldt som standard.</span>' : ''}
    </div>
    ${beforeDeadline || isAdmin() ? '' : '<div class="warning">Fristen er overskredet. Kun admin kan ændre status nu.</div>'}
    <div style="margin-bottom:18px;">
      <button id="selfActionBtn" class="${buttonClass}" ${beforeDeadline || isAdmin() ? '' : 'disabled'}>${buttonText}</button>
    </div>
  `;

  document.getElementById('selfActionBtn')?.addEventListener('click', async () => {
    await setAttendance(state.profile, !isAttending);
  });
}

function renderMembers() {
  const event = getCurrentEvent();
  if (!event) {
    eventInfo.innerHTML = '<div class="empty">Vælg en logeaften.</div>';
    return;
  }

  const attendingMembers = getAttendingMembers(event.id);
  const absentMembers = getAbsentMembers(event.id);

  eventInfo.innerHTML = `
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 6px;">${event.title}</div>
    <div class="muted">${formatDanishDate(event.date)} kl. ${event.time} · ${event.location}</div>
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
        <div class="member-name">${member.name}</div>
        <div class="muted">${member.email || 'Ingen mail registreret'}</div>
      </div>
    `;
    if (isAdmin()) {
      const btn = document.createElement('button');
      btn.className = 'pill pill-off';
      btn.textContent = 'Meld fra';
      btn.addEventListener('click', async () => {
        await setAttendance(member, false);
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
          <div class="member-name">${member.name}</div>
          <div class="muted">${member.opt_in_only ? 'Ikke automatisk tilmeldt' : 'Har meldt fra'}</div>
        </div>
      `;
      if (isAdmin()) {
        const btn = document.createElement('button');
        btn.className = 'pill pill-on';
        btn.textContent = 'Meld til igen';
        btn.addEventListener('click', async () => {
          await setAttendance(member, true);
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
  sharedPasswordInput.value = state.settings.shared_password ?? '';

  memberAdminSelect.innerHTML = state.members
    .map(member => `<option value="${member.id}">${member.name}</option>`)
    .join('');

  eventAdminSelect.innerHTML = state.events
    .map(event => `<option value="${event.id}">${event.title} – ${formatDanishDate(event.date)}</option>`)
    .join('');

  if (state.selectedEventId) {
    eventAdminSelect.value = String(state.selectedEventId);
  }

  hydrateMemberEditor();
  hydrateEventEditor();
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

function hydrateEventEditor() {
  const eventId = Number(eventAdminSelect.value || state.selectedEventId || state.events[0]?.id || 0);
  const event = state.events.find(row => row.id === eventId);
  if (!event) return;

  editEventTitle.value = event.title || '';
  editEventDate.value = event.date || '';
  editEventTime.value = event.time || '19:00';
  editEventLocation.value = event.location || '';
  editEventDeadlineDays.value = event.deadline_days ?? 2;
}

async function saveSettings() {
  const payload = {
    id: 1,
    reminder_days: Number(reminderDaysInput.value || 2),
    reminder_channel: reminderChannelInput.value,
    shared_password: sharedPasswordInput.value.trim() || 'oddfellow35',
  };

  const { error } = await supabase.from('settings').upsert(payload);
  if (error) {
    setError(error.message);
    return;
  }
  await loadApp();
  setMessage('Indstillinger er gemt.');
}

async function addEvent() {
  const title = document.getElementById('newEventTitle').value.trim();
  const date = document.getElementById('newEventDate').value;
  const time = document.getElementById('newEventTime').value || '19:00';
  const location = document.getElementById('newEventLocation').value.trim() || 'Frederiksgade 15, Slagelse';
  const deadline_days = Number(document.getElementById('newEventDeadlineDays').value || 2);

  if (!title || !date) {
    setError('Udfyld mindst titel og dato.');
    return;
  }

  const { error } = await supabase
    .from('events')
    .insert([{ title, date, time, location, deadline_days }]);

  if (error) {
    setError(error.message);
    return;
  }

  document.getElementById('newEventTitle').value = '';
  document.getElementById('newEventDate').value = '';
  document.getElementById('newEventTime').value = '19:00';
  document.getElementById('newEventDeadlineDays').value = '2';

  await loadApp();
  setMessage('Ny logeaften er oprettet.');
}

async function saveEvent() {
  const eventId = Number(eventAdminSelect.value || 0);
  const payload = {
    title: editEventTitle.value.trim(),
    date: editEventDate.value,
    time: editEventTime.value || '19:00',
    location: editEventLocation.value.trim() || 'Frederiksgade 15, Slagelse',
    deadline_days: Number(editEventDeadlineDays.value || 2),
  };

  if (!eventId || !payload.title || !payload.date) {
    setError('Vælg en logeaften og udfyld mindst titel og dato.');
    return;
  }

  const { error } = await supabase.from('events').update(payload).eq('id', eventId);
  if (error) {
    setError(error.message);
    return;
  }

  await loadApp(eventId);
  setMessage('Logeaften er gemt.');
}

async function deleteEvent() {
  const eventId = Number(eventAdminSelect.value || 0);
  const event = state.events.find(row => row.id === eventId);
  if (!eventId || !event) {
    setError('Vælg en logeaften først.');
    return;
  }

  const ok = window.confirm(`Vil du slette logeaften: ${event.title}?`);
  if (!ok) return;

  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) {
    setError(error.message);
    return;
  }

  state.selectedEventId = null;
  await loadApp();
  setMessage('Logeaften er slettet.');
}

async function saveMember() {
  const memberId = Number(memberAdminSelect.value);
  const updated = {
    email: memberEmailInput.value.trim(),
    phone: memberPhoneInput.value.trim(),
    opt_in_only: memberOptInOnlyInput.checked,
    role: memberRoleInput.value,
  };

  const { error } = await supabase.from('members').update(updated).eq('id', memberId);
  if (error) {
    setError(error.message);
    return;
  }

  await loadApp();
  setMessage('Medlem er gemt.');
}

function exportData() {
  const payload = {
    profile: state.profile,
    members: state.members,
    events: state.events,
    absences: state.absences,
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
  await fetchAllData();
  if (selectEventId) state.selectedEventId = selectEventId;
  render();
}

async function login() {
  setError('');
  const fullName = loginFullName.value;
  const password = loginPassword.value;
  const normalized = normalizeName(fullName);
  const member = state.members.find(row => normalizeName(row.name) === normalized);

  if (!member || !password) {
    setError('Skriv dit fulde navn og adgangskoden.');
    return;
  }

  if (password !== (state.settings.shared_password || 'oddfellow35')) {
    setError('Forkert adgangskode.');
    return;
  }

  localStorage.setItem(LOCAL_SESSION_KEY, String(member.id));
  state.profile = member;
  loginPassword.value = '';
  await loadApp();
  setMessage('Du er logget ind.');
}

function logout() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
  state.profile = null;
  state.selectedEventId = state.events[0]?.id || null;
  loginPassword.value = '';
  render();
}

function render() {
  renderAuthState();
  if (!state.profile) return;
  renderEventButtons();
  renderMemberAction();
  renderMembers();
  renderAdminArea();
}

async function boot() {
  const ok = await initializeSupabase();
  if (!ok) return;

  try {
    await loadApp();
  } catch (err) {
    setError(err.message || 'Kunne ikke hente data. Kør SQL-filerne og tjek policies.');
  }
}

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
saveReminderBtn.addEventListener('click', saveSettings);
addEventBtn.addEventListener('click', addEvent);
saveEventBtn.addEventListener('click', saveEvent);
deleteEventBtn.addEventListener('click', deleteEvent);
saveMemberBtn.addEventListener('click', saveMember);
refreshBtn.addEventListener('click', () => loadApp());
exportBtn.addEventListener('click', exportData);
memberAdminSelect.addEventListener('change', hydrateMemberEditor);
eventAdminSelect.addEventListener('change', () => {
  state.selectedEventId = Number(eventAdminSelect.value || state.selectedEventId);
  hydrateEventEditor();
  renderEventButtons();
  renderMemberAction();
  renderMembers();
});
loginPassword.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') login();
});
loginFullName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') login();
});

boot();
