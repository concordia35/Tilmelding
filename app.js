import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const LOGIN_STORAGE_KEY = "loge_login_v1";

let currentUser = null;
let currentEvent = null;
let membersCache = [];
let eventsCache = [];
let absencesCache = [];
let settingsCache = {
  reminder_days: 2,
  reminder_channel: "mail",
  shared_password: "oddfellow35"
};
let adminVisible = false;

const $ = (id) => document.getElementById(id);

function normalizeName(value) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function escapeLike(value) {
  return (value || "").replace(/[%_]/g, "").trim();
}

function saveLoginToBrowser(name, password) {
  localStorage.setItem(
    LOGIN_STORAGE_KEY,
    JSON.stringify({
      name,
      password
    })
  );
}

function getSavedLogin() {
  try {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSavedLogin() {
  localStorage.removeItem(LOGIN_STORAGE_KEY);
}

function showMessage(text) {
  $("globalMessage").textContent = text;
  $("globalMessage").classList.remove("hidden");
  setTimeout(() => $("globalMessage").classList.add("hidden"), 2500);
}

function showError(text) {
  $("globalError").textContent = text;
  $("globalError").classList.remove("hidden");
  setTimeout(() => $("globalError").classList.add("hidden"), 4000);
}

function clearMessages() {
  $("globalMessage").classList.add("hidden");
  $("globalError").classList.add("hidden");
}

function formatDate(dateString) {
  const d = new Date(dateString + "T12:00:00");
  return d.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatDeadline(event) {
  const date = new Date(`${event.date}T${event.time || "19:00"}:00`);
  date.setDate(date.getDate() - (Number(event.deadline_days) || 0));
  return (
    date.toLocaleDateString("da-DK", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }) +
    " kl. " +
    String(date.getHours()).padStart(2, "0") +
    "." +
    String(date.getMinutes()).padStart(2, "0")
  );
}

function isBeforeDeadline(event) {
  const date = new Date(`${event.date}T${event.time || "19:00"}:00`);
  date.setDate(date.getDate() - (Number(event.deadline_days) || 0));
  return new Date() <= date;
}

function getEventAbsences(eventId) {
  return absencesCache.filter((a) => a.event_id === eventId);
}

function getAttendanceRecord(memberId, eventId) {
  return getEventAbsences(eventId).find((a) => a.member_id === memberId) || null;
}

function isAbsent(memberId, eventId) {
  const member = membersCache.find((m) => m.id === memberId);
  const record = getAttendanceRecord(memberId, eventId);

  if (record) {
    return record.attending === false;
  }

  return !!member?.opt_in_only;
}

function getAttendingMembers(eventId) {
  return membersCache.filter((m) => !isAbsent(m.id, eventId));
}

function getAbsentMembers(eventId) {
  return membersCache.filter((m) => isAbsent(m.id, eventId));
}

function getCurrentAttendanceForUser() {
  if (!currentUser || !currentEvent) return null;
  return getAttendanceRecord(currentUser.id, currentEvent.id);
}

function renderAuth() {
  const adminToggleBtn = $("adminToggleBtn");
  const adminPanel = $("adminPanel");

  if (currentUser) {
    $("authLoggedOut").classList.add("hidden");
    $("authLoggedIn").classList.remove("hidden");
    $("currentUserText").textContent =
      `${currentUser.name} · ${currentUser.role === "admin" ? "Admin" : "Broder"} · ${currentUser.email || ""}`;
    $("appArea").classList.remove("hidden");
    $("attendanceForm").classList.remove("hidden");
  } else {
    $("authLoggedOut").classList.remove("hidden");
    $("authLoggedIn").classList.add("hidden");
    $("appArea").classList.add("hidden");
    $("attendanceForm").classList.add("hidden");
    adminVisible = false;
  }

  if (currentUser?.role === "admin") {
    adminToggleBtn.classList.remove("hidden");
  } else {
    adminToggleBtn.classList.add("hidden");
    adminPanel.classList.add("hidden");
    adminVisible = false;
  }
}

function renderEvents() {
  $("eventList").innerHTML = "";

  if (!currentEvent && eventsCache.length > 0) {
    currentEvent = eventsCache[0];
  }

  eventsCache.forEach((event) => {
    const absent = getAbsentMembers(event.id).length;
    const attending = membersCache.length - absent;

    const btn = document.createElement("button");
    btn.className =
      "event-btn" + (currentEvent && currentEvent.id === event.id ? " active" : "");
    btn.innerHTML = `
      <div class="event-title">${event.title}</div>
      <div class="event-meta">${formatDate(event.date)} kl. ${event.time || "19:00"}</div>
      <div class="event-meta">Forventet fremmøde: ${attending}/${membersCache.length}</div>
      <div class="event-meta">Frist: ${formatDeadline(event)}</div>
    `;

    btn.addEventListener("click", async () => {
      currentEvent = event;
      renderAll();
      await loadMyAttendanceIntoForm();
    });

    $("eventList").appendChild(btn);
  });
}

function renderStats() {
  if (!currentEvent) return;

  const absentMembers = getAbsentMembers(currentEvent.id);
  const attendingMembers = getAttendingMembers(currentEvent.id);

  $("attendingCount").textContent = attendingMembers.length;
  $("absentCount").textContent = absentMembers.length;
  $("totalCount").textContent = membersCache.length;
  $("deadlineText").textContent = formatDeadline(currentEvent);

  const records = getEventAbsences(currentEvent.id);

  const mealsCount = records.filter(
    (r) => r.attending !== false && r.wants_food === true
  ).length;

  const guestCount = records.filter(
    (r) => r.attending !== false && r.brings_guest === true
  ).length;

  const guestMealsCount = records.filter(
    (r) =>
      r.attending !== false &&
      r.brings_guest === true &&
      r.guest_wants_food === true
  ).length;

  if ($("mealsCount")) $("mealsCount").textContent = mealsCount;
  if ($("guestCount")) $("guestCount").textContent = guestCount;
  if ($("guestMealsCount")) $("guestMealsCount").textContent = guestMealsCount;
  if ($("totalMealsCount")) {
    $("totalMealsCount").textContent = mealsCount + guestMealsCount;
  }
}

function renderEventInfo() {
  if (!currentEvent) return;

  $("eventInfo").innerHTML = `
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 6px;">${currentEvent.title}</div>
    <div class="muted">${formatDate(currentEvent.date)} kl. ${currentEvent.time || "19:00"} · ${currentEvent.location || ""}</div>
  `;
}

function renderMembers() {
  if (!currentEvent) return;

  const attending = getAttendingMembers(currentEvent.id);
  const absent = getAbsentMembers(currentEvent.id);

  $("attendingList").innerHTML = "";
  $("absentList").innerHTML = "";

  attending.forEach((member) => {
    const record = getAttendanceRecord(member.id, currentEvent.id);
    const guestText = record?.brings_guest
      ? ` · Gæst: ${record.guest_name || "Ja"}`
      : "";
    const foodText =
      record?.wants_food === false ? " · Uden mad" : " · Med mad";

    const item = document.createElement("div");
    item.className = "member";
    item.innerHTML = `
      <div>
        <div class="member-name">${member.name}</div>
        <div class="muted">${foodText}${guestText}</div>
      </div>
    `;
    $("attendingList").appendChild(item);
  });

  if (absent.length === 0) {
    $("absentList").innerHTML = `<div class="empty">Ingen har meldt fra endnu.</div>`;
  } else {
    absent.forEach((member) => {
      const record = getAttendanceRecord(member.id, currentEvent.id);

      let statusText = "Har meldt fra";
      if (!record && member.opt_in_only) {
        statusText = "Ikke automatisk tilmeldt";
      }

      const item = document.createElement("div");
      item.className = "member";
      item.innerHTML = `
        <div>
          <div class="member-name">${member.name}</div>
          <div class="muted">${statusText}</div>
        </div>
      `;
      $("absentList").appendChild(item);
    });
  }
}

function renderMemberAction() {
  if (!currentUser || !currentEvent) return;

  const absent = isAbsent(currentUser.id, currentEvent.id);
  const beforeDeadline = isBeforeDeadline(currentEvent);

  $("memberActionBox").innerHTML = `
    <div class="success-box">
      <strong>${currentUser.name}</strong><br>
      ${absent ? "Du står aktuelt som ikke deltagende." : "Du står aktuelt som deltagende."}
      ${currentUser.opt_in_only ? '<br><span class="mini">Denne broder er ikke automatisk tilmeldt som standard og skal selv melde sig til.</span>' : ""}
      ${!beforeDeadline ? '<br><span class="mini">Afmeldingsfristen er overskredet. Kun admin kan ændre efter fristen.</span>' : ""}
    </div>
  `;
}

async function loadMyAttendanceIntoForm() {
  if (!currentUser || !currentEvent) return;

  const record = getCurrentAttendanceForUser();

  if (!record) {
    $("attending").checked = !currentUser.opt_in_only;
    $("wantsFood").checked = !currentUser.opt_in_only;
    $("bringsGuest").checked = false;
    $("guestName").value = "";
    $("guestWantsFood").checked = false;
    $("guestFields").classList.add("hidden");
    return;
  }

  $("attending").checked = record.attending !== false;
  $("wantsFood").checked = record.wants_food !== false;
  $("bringsGuest").checked = record.brings_guest === true;
  $("guestName").value = record.guest_name || "";
  $("guestWantsFood").checked = record.guest_wants_food === true;
  $("guestFields").classList.toggle("hidden", record.brings_guest !== true);
}

function renderAdmin() {
  const isAdmin = currentUser?.role === "admin";
  $("adminArea").classList.toggle("hidden", !isAdmin);
  $("adminPanel").classList.toggle("hidden", !isAdmin || !adminVisible);

  if (!isAdmin) return;

  $("reminderDaysInput").value = settingsCache.reminder_days ?? 2;
  $("reminderChannelInput").value = settingsCache.reminder_channel ?? "mail";
  $("sharedPasswordInput").value =
    settingsCache.shared_password ?? "oddfellow35";

  $("eventAdminSelect").innerHTML = eventsCache
    .map((e) => `<option value="${e.id}">${e.title}</option>`)
    .join("");

  $("memberAdminSelect").innerHTML = membersCache
    .map((m) => `<option value="${m.id}">${m.name}</option>`)
    .join("");

  fillEventEditForm();
  fillMemberEditForm();
}

function fillEventEditForm() {
  const id = Number($("eventAdminSelect").value);
  const event = eventsCache.find((e) => e.id === id);
  if (!event) return;

  $("editEventTitle").value = event.title || "";
  $("editEventDate").value = event.date || "";
  $("editEventTime").value = event.time || "";
  $("editEventLocation").value = event.location || "";
  $("editEventDeadlineDays").value = event.deadline_days ?? 2;
}

function fillMemberEditForm() {
  const id = Number($("memberAdminSelect").value);
  const member = membersCache.find((m) => m.id === id);
  if (!member) return;

  $("memberEmailInput").value = member.email || "";
  $("memberPhoneInput").value = member.phone || "";
  $("memberOptInOnlyInput").checked = !!member.opt_in_only;
  $("memberRoleInput").value = member.role || "member";
}

function renderAll() {
  renderAuth();
  renderEvents();
  renderStats();
  renderEventInfo();
  renderMembers();
  renderMemberAction();
  renderAdmin();
}

async function loadAllData() {
  clearMessages();

  const [
    { data: members, error: membersError },
    { data: events, error: eventsError },
    { data: absences, error: absencesError },
    { data: settings, error: settingsError }
  ] = await Promise.all([
    supabase.from("members").select("*").order("name"),
    supabase.from("events").select("*").order("date"),
    supabase.from("absences").select("*"),
    supabase.from("settings").select("*").limit(1).maybeSingle()
  ]);

  if (membersError) {
    console.error("membersError:", membersError);
    throw membersError;
  }
  if (eventsError) {
    console.error("eventsError:", eventsError);
    throw eventsError;
  }
  if (absencesError) {
    console.error("absencesError:", absencesError);
    throw absencesError;
  }
  if (settingsError) {
    console.error("settingsError:", settingsError);
    throw settingsError;
  }

  membersCache = members || [];
  eventsCache = events || [];
  absencesCache = absences || [];
  settingsCache = settings || settingsCache;

  if (!currentEvent && eventsCache.length > 0) {
    currentEvent = eventsCache[0];
  }

  console.log("Loaded members:", membersCache.length);
  console.log("Loaded events:", eventsCache.length);
  console.log("Loaded absences:", absencesCache.length);
  console.log("Loaded settings:", settingsCache);
}

async function performLogin(rawName, password, { silent = false } = {}) {
  const normalizedInput = normalizeName(rawName);

  if (!normalizedInput) {
    if (!silent) showError("Skriv dit fulde navn.");
    return false;
  }

  try {
    const { data: settingsRow, error: settingsError } = await supabase
      .from("settings")
      .select("shared_password")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("Settings fejl:", settingsError);
      if (!silent) showError("Kunne ikke læse indstillinger.");
      return false;
    }

    const sharedPassword = settingsRow?.shared_password || "oddfellow35";

    if (password !== sharedPassword) {
      clearSavedLogin();
      if (!silent) showError("Forkert password.");
      return false;
    }

    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("*")
      .ilike("name", `%${escapeLike(rawName)}%`)
      .limit(20);

    if (memberError) {
      console.error("Members fejl:", memberError);
      if (!silent) showError("Kunne ikke læse medlemmer.");
      return false;
    }

    const exactMatch = (members || []).find(
      (m) => normalizeName(m.name) === normalizedInput
    );

    if (!exactMatch) {
      console.log("Login input:", rawName);
      console.log("Matchende kandidater:", members);
      clearSavedLogin();
      if (!silent) {
        showError("Navn ikke fundet. Skriv navnet præcist som i databasen.");
      }
      return false;
    }

    currentUser = exactMatch;
    adminVisible = false;
    saveLoginToBrowser(rawName.trim(), password);

    await loadAllData();
    renderAll();
    await loadMyAttendanceIntoForm();

    if (!silent) {
      showMessage("Du er logget ind.");
    }

    return true;
  } catch (err) {
    console.error("Login fejl:", err);
    clearSavedLogin();
    if (!silent) showError("Kunne ikke logge ind.");
    return false;
  }
}

$("loginBtn").addEventListener("click", async () => {
  const rawName = $("loginFullName").value;
  const password = $("loginPassword").value;
  await performLogin(rawName, password);
});

$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  currentEvent = null;
  adminVisible = false;
  clearSavedLogin();
  $("loginFullName").value = "";
  $("loginPassword").value = "";
  renderAll();
  showMessage("Du er logget ud.");
});

$("adminToggleBtn").addEventListener("click", () => {
  if (currentUser?.role !== "admin") return;
  adminVisible = !adminVisible;
  renderAdmin();
});

["loginFullName", "loginPassword"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      $("loginBtn").click();
    }
  });
});

$("bringsGuest").addEventListener("change", () => {
  $("guestFields").classList.toggle("hidden", !$("bringsGuest").checked);

  if (!$("bringsGuest").checked) {
    $("guestName").value = "";
    $("guestWantsFood").checked = false;
  }
});

$("saveBtn").addEventListener("click", async () => {
  if (!currentUser || !currentEvent) return;

  if (!isBeforeDeadline(currentEvent) && currentUser.role !== "admin") {
    showError("Afmeldingsfristen er overskredet.");
    return;
  }

  const attending = $("attending").checked;
  const bringsGuest = $("bringsGuest").checked;
  const guestName = $("guestName").value.trim();

  if (bringsGuest && !guestName) {
    showError("Skriv gæstens navn.");
    return;
  }

  const payload = {
    member_id: currentUser.id,
    event_id: currentEvent.id,
    attending,
    wants_food: attending ? $("wantsFood").checked : false,
    brings_guest: attending ? bringsGuest : false,
    guest_name: attending && bringsGuest ? guestName : null,
    guest_wants_food: attending && bringsGuest ? $("guestWantsFood").checked : false
  };

  const { error } = await supabase
    .from("absences")
    .upsert(payload, { onConflict: "event_id,member_id" });

  if (error) {
    console.error(error);
    showError("Kunne ikke gemme.");
    return;
  }

  await loadAllData();
  renderAll();
  await loadMyAttendanceIntoForm();
  showMessage("Din tilmelding er gemt.");
});

$("refreshBtn")?.addEventListener("click", async () => {
  try {
    await loadAllData();
    renderAll();
    await loadMyAttendanceIntoForm();
    showMessage("Data er opdateret.");
  } catch (err) {
    console.error(err);
    showError("Kunne ikke opdatere data.");
  }
});

$("exportBtn")?.addEventListener("click", () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          members: membersCache,
          events: eventsCache,
          absences: absencesCache,
          settings: settingsCache
        },
        null,
        2
      )
    ],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "loge-data.json";
  a.click();
  URL.revokeObjectURL(url);
});

$("eventAdminSelect")?.addEventListener("change", fillEventEditForm);
$("memberAdminSelect")?.addEventListener("change", fillMemberEditForm);

$("addEventBtn")?.addEventListener("click", async () => {
  const payload = {
    title: $("newEventTitle").value.trim(),
    date: $("newEventDate").value,
    time: $("newEventTime").value || "19:00",
    location: $("newEventLocation").value.trim(),
    deadline_days: Number($("newEventDeadlineDays").value || 2)
  };

  if (!payload.title || !payload.date) {
    showError("Udfyld titel og dato.");
    return;
  }

  const { error } = await supabase.from("events").insert(payload);

  if (error) {
    console.error(error);
    showError("Kunne ikke oprette logeaften.");
    return;
  }

  $("newEventTitle").value = "";
  $("newEventDate").value = "";
  $("newEventTime").value = "19:00";
  $("newEventLocation").value = "Frederiksgade 15, Slagelse";
  $("newEventDeadlineDays").value = "2";

  await loadAllData();
  renderAll();
  showMessage("Logeaften oprettet.");
});

$("saveEventBtn")?.addEventListener("click", async () => {
  const id = Number($("eventAdminSelect").value);

  const payload = {
    title: $("editEventTitle").value.trim(),
    date: $("editEventDate").value,
    time: $("editEventTime").value,
    location: $("editEventLocation").value.trim(),
    deadline_days: Number($("editEventDeadlineDays").value || 2)
  };

  const { error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error(error);
    showError("Kunne ikke gemme logeaften.");
    return;
  }

  await loadAllData();
  renderAll();
  showMessage("Logeaften gemt.");
});

$("deleteEventBtn")?.addEventListener("click", async () => {
  const id = Number($("eventAdminSelect").value);

  if (!confirm("Vil du slette denne logeaften?")) return;

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    showError("Kunne ikke slette logeaften.");
    return;
  }

  currentEvent = null;
  await loadAllData();
  renderAll();
  showMessage("Logeaften slettet.");
});

$("saveMemberBtn")?.addEventListener("click", async () => {
  const id = Number($("memberAdminSelect").value);

  const payload = {
    email: $("memberEmailInput").value.trim(),
    phone: $("memberPhoneInput").value.trim(),
    opt_in_only: $("memberOptInOnlyInput").checked,
    role: $("memberRoleInput").value
  };

  const { error } = await supabase
    .from("members")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error(error);
    showError("Kunne ikke gemme medlem.");
    return;
  }

  await loadAllData();
  renderAll();
  showMessage("Medlem gemt.");
});

$("saveReminderBtn")?.addEventListener("click", async () => {
  const payload = {
    id: settingsCache.id || 1,
    reminder_days: Number($("reminderDaysInput").value || 2),
    reminder_channel: $("reminderChannelInput").value,
    shared_password: $("sharedPasswordInput").value.trim() || "oddfellow35"
  };

  const { error } = await supabase.from("settings").upsert(payload);

  if (error) {
    console.error(error);
    showError("Kunne ikke gemme indstillinger.");
    return;
  }

  await loadAllData();
  renderAll();
  showMessage("Indstillinger gemt.");
});

(async function init() {
  try {
    await loadAllData();
    renderAll();

    const savedLogin = getSavedLogin();
    if (savedLogin?.name && savedLogin?.password) {
      $("loginFullName").value = savedLogin.name;
      $("loginPassword").value = savedLogin.password;
      await performLogin(savedLogin.name, savedLogin.password, { silent: true });
    }
  } catch (err) {
    console.error(err);
    $("setupNotice").textContent =
      "Kunne ikke hente data fra Supabase. Tjek supabase-config.js, RLS policies og at tabellerne indeholder data.";
    $("setupNotice").classList.remove("hidden");
  }
})();
