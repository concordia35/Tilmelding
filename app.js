import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;
let currentEvent = null;
let membersCache = [];
let eventsCache = [];
let absencesCache = [];
let settingsCache = { reminder_days: 2, reminder_channel: "mail", shared_password: "oddfellow35" };

const $ = (id) => document.getElementById(id);

function normalizeName(value) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function escapeLike(value) {
  return value.replace(/[%_]/g, "");
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

async function loadAllData() {
  const [{ data: members }, { data: events }, { data: absences }, { data: settings }] =
    await Promise.all([
      supabase.from("members").select("*").order("name"),
      supabase.from("events").select("*").order("date"),
      supabase.from("absences").select("*"),
      supabase.from("settings").select("*").limit(1).maybeSingle()
    ]);

  membersCache = members || [];
  eventsCache = events || [];
  absencesCache = absences || [];
  settingsCache = settings || settingsCache;

  if (!currentEvent && eventsCache.length > 0) {
    currentEvent = eventsCache[0];
  }
}

function renderAuth() {
  if (currentUser) {
    $("authLoggedOut").classList.add("hidden");
    $("authLoggedIn").classList.remove("hidden");
    $("currentUserText").textContent = `${currentUser.name}`;
    $("appArea").classList.remove("hidden");
  } else {
    $("authLoggedOut").classList.remove("hidden");
    $("authLoggedIn").classList.add("hidden");
    $("appArea").classList.add("hidden");
  }
}

function renderAll() {
  renderAuth();
}

//
// 🔐 LOGIN (FIXED VERSION)
//
$("loginBtn").addEventListener("click", async () => {
  const rawName = $("loginFullName").value;
  const password = $("loginPassword").value;
  const name = normalizeName(rawName);

  if (!name) {
    showError("Skriv dit fulde navn.");
    return;
  }

  try {
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("shared_password")
      .limit(1)
      .maybeSingle();

    const sharedPassword = settingsRow?.shared_password || "oddfellow35";

    if (password !== sharedPassword) {
      showError("Forkert password.");
      return;
    }

    const { data: candidates } = await supabase
      .from("members")
      .select("*")
      .ilike("name", escapeLike(rawName.trim()))
      .limit(10);

    const exactMatch = (candidates || []).find(
      (m) => normalizeName(m.name) === name
    );

    if (!exactMatch) {
      showError("Navn ikke fundet. Skriv præcist.");
      console.log("DEBUG kandidater:", candidates);
      return;
    }

    currentUser = exactMatch;

    await loadAllData();
    renderAll();

    showMessage("Du er logget ind.");
  } catch (err) {
    console.error(err);
    showError("Login fejlede.");
  }
});

$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  $("loginFullName").value = "";
  $("loginPassword").value = "";
  renderAll();
});

//
// ENTER = LOGIN
//
["loginFullName", "loginPassword"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      $("loginBtn").click();
    }
  });
});

(async function init() {
  try {
    await loadAllData();
    renderAll();
  } catch (err) {
    console.error(err);
  }
})();
