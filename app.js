import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;
let currentEvent = null;

document.getElementById("loginBtn").onclick = async () => {
  const name = document.getElementById("nameInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  if (!name) {
    alert("Skriv dit fulde navn");
    return;
  }

  if (password !== "oddfellow35") {
    alert("Forkert password");
    return;
  }

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Fejl ved login-opslag:", error);
    alert("Fejl ved opslag i medlemmer");
    return;
  }

  if (!data) {
    alert("Navn ikke fundet");
    return;
  }

  currentUser = data;

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  await loadEvents();
  await loadMyAttendance();
};

async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Fejl ved hentning af events:", error);
    alert("Kunne ikke hente logeaftener");
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById("events").innerHTML =
      `<div class="card">Ingen logeaftener fundet</div>`;
    return;
  }

  currentEvent = data[0];

  document.getElementById("events").innerHTML = `
    <div class="card">
      <strong>${currentEvent.title}</strong><br>
      ${currentEvent.date}${currentEvent.time ? ` kl. ${currentEvent.time}` : ""}<br>
      ${currentEvent.location || ""}
    </div>
  `;
}

async function loadMyAttendance() {
  if (!currentUser || !currentEvent) return;

  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("member_id", currentUser.id)
    .eq("event_id", currentEvent.id)
    .maybeSingle();

  if (error) {
    console.error("Fejl ved hentning af tilmelding:", error);
    return;
  }

  if (!data) {
    document.getElementById("attending").checked = true;
    document.getElementById("wantsFood").checked = true;
    document.getElementById("bringsGuest").checked = false;
    document.getElementById("guestName").value = "";
    document.getElementById("guestWantsFood").checked = false;
    document.getElementById("guestFields").classList.add("hidden");
    return;
  }

  document.getElementById("attending").checked = data.attending ?? true;
  document.getElementById("wantsFood").checked = data.wants_food ?? true;
  document.getElementById("bringsGuest").checked = data.brings_guest ?? false;
  document.getElementById("guestName").value = data.guest_name ?? "";
  document.getElementById("guestWantsFood").checked = data.guest_wants_food ?? false;

  if (data.brings_guest) {
    document.getElementById("guestFields").classList.remove("hidden");
  } else {
    document.getElementById("guestFields").classList.add("hidden");
  }
}

document.getElementById("bringsGuest").onchange = () => {
  const checked = document.getElementById("bringsGuest").checked;
  document.getElementById("guestFields").classList.toggle("hidden", !checked);

  if (!checked) {
    document.getElementById("guestName").value = "";
    document.getElementById("guestWantsFood").checked = false;
  }
};

document.getElementById("saveBtn").onclick = async () => {
  if (!currentUser || !currentEvent) {
    alert("Du er ikke logget ind korrekt");
    return;
  }

  const attending = document.getElementById("attending").checked;
  const wantsFood = document.getElementById("wantsFood").checked;
  const bringsGuest = document.getElementById("bringsGuest").checked;
  const guestName = document.getElementById("guestName").value.trim();
  const guestWantsFood = document.getElementById("guestWantsFood").checked;

  if (bringsGuest && !guestName) {
    alert("Skriv gæstens navn");
    return;
  }

  const payload = {
    member_id: currentUser.id,
    event_id: currentEvent.id,
    attending,
    wants_food: wantsFood,
    brings_guest: bringsGuest,
    guest_name: bringsGuest ? guestName : null,
    guest_wants_food: bringsGuest ? guestWantsFood : false
  };

  const { error } = await supabase
    .from("absences")
    .upsert(payload, { onConflict: "event_id,member_id" });

  if (error) {
    console.error("Fejl ved gem:", error);
    alert("Kunne ikke gemme");
    return;
  }

  alert("Gemt!");
};
