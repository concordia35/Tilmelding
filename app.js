import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;
let currentEvent = null;

document.getElementById("loginBtn").onclick = async () => {
  const name = document.getElementById("nameInput").value;
  const password = document.getElementById("passwordInput").value;

  if (password !== "oddfellow35") {
    alert("Forkert password");
    return;
  }

  const { data } = await supabase
    .from("members")
    .select("*")
    .ilike("full_name", name)
    .single();

  if (!data) {
    alert("Navn ikke fundet");
    return;
  }

  currentUser = data;

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  loadEvents();
};

async function loadEvents() {
  const { data } = await supabase.from("events").select("*").limit(1);

  currentEvent = data[0];

  document.getElementById("events").innerHTML =
    `<div class="card">${currentEvent.title}</div>`;
}

document.getElementById("bringsGuest").onchange = () => {
  document.getElementById("guestFields").classList.toggle("hidden");
};

document.getElementById("saveBtn").onclick = async () => {

  const attending = document.getElementById("attending").checked;
  const wantsFood = document.getElementById("wantsFood").checked;
  const bringsGuest = document.getElementById("bringsGuest").checked;
  const guestName = document.getElementById("guestName").value;
  const guestWantsFood = document.getElementById("guestWantsFood").checked;

  await supabase.from("absences").upsert({
    member_id: currentUser.id,
    event_id: currentEvent.id,
    attending,
    wants_food: wantsFood,
    brings_guest: bringsGuest,
    guest_name: guestName,
    guest_wants_food: guestWantsFood
  });

  alert("Gemt!");
};
