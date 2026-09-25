/**
 * main.js
 * All behaviour for index.html: language toggle, welcome quote, the
 * hamburger drawer, the complaint form (with Firestore + Storage), the
 * info panels (Upcoming / Done / Funds), and "My Complaints" tracking.
 */

/* ---------------- Language ---------------- */
let currentLang = localStorage.getItem("vtc_lang") || "en";

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("vtc_lang", lang);
  document.body.classList.toggle("lang-ml", lang === "ml");
  document.documentElement.lang = lang;

  const dict = TRANSLATIONS[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) {
      // Preserve child elements (e.g. the phone icon svg) for buttons that have them
      const iconEl = el.querySelector("svg");
      el.textContent = dict[key];
      if (iconEl) el.prepend(iconEl);
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
  });

  document.getElementById("langToggle").textContent = lang === "en" ? "മല" : "EN";
}

document.getElementById("langToggle").addEventListener("click", () => {
  applyLanguage(currentLang === "en" ? "ml" : "en");
});

/* ---------------- Welcome quote (fresh one each visit) ---------------- */
function showRandomQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const el = document.getElementById("quoteText");
  el.textContent = currentLang === "ml" ? q.ml : q.en;
  el.dataset.en = q.en;
  el.dataset.ml = q.ml;
}

/* ---------------- Drawer (3-bar menu) ---------------- */
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const menuOpenBtn = document.getElementById("menuOpenBtn");
const menuCloseBtn = document.getElementById("menuCloseBtn");

function openDrawer() {
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  menuOpenBtn.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  menuOpenBtn.setAttribute("aria-expanded", "false");
}
menuOpenBtn.addEventListener("click", openDrawer);
menuCloseBtn.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

/* ---------------- Info panels ---------------- */
const panelOverlay = document.getElementById("panelOverlay");
const panelCloseBtn = document.getElementById("panelCloseBtn");

function openPanel(panelId) {
  closeDrawer();
  document.querySelectorAll(".panel-section").forEach(p => p.classList.remove("active"));
  document.getElementById(panelId).classList.add("active");
  panelOverlay.classList.add("open");

  if (panelId === "panelUpcoming") loadListSection("projects_upcoming", "upcomingList", "upcomingEmpty", "project");
  if (panelId === "panelDone") loadListSection("projects_done", "doneList", "doneEmpty", "project");
  if (panelId === "panelFunds") loadListSection("funds", "fundsList", "fundsEmpty", "fund");
  if (panelId === "panelMyComplaints") {
    document.getElementById("trackInput").value = "";
    document.getElementById("trackResult").innerHTML = "";
    document.getElementById("trackNotFound").hidden = true;
  }
}
function closePanel() { panelOverlay.classList.remove("open"); }

document.querySelectorAll(".drawer-item").forEach(btn => {
  btn.addEventListener("click", () => openPanel(btn.dataset.panel));
});
panelCloseBtn.addEventListener("click", closePanel);
panelOverlay.addEventListener("click", (e) => { if (e.target === panelOverlay) closePanel(); });

/* ---------------- Load Upcoming / Done / Funds from Firestore ----------------
   Firestore structure (create these collections + docs from the Firebase
   Console, no admin UI needed for these):

   projects_upcoming / {autoId}  -> { title, description, order }
   projects_done     / {autoId}  -> { title, description, order }
   funds             / {autoId}  -> { title, collected, usedFor, order }
------------------------------------------------------------------------- */
async function loadListSection(collectionName, listElId, emptyElId, kind) {
  const listEl = document.getElementById(listElId);
  const emptyEl = document.getElementById(emptyElId);
  listEl.innerHTML = "";
  emptyEl.hidden = true;

  try {
    const snap = await db.collection(collectionName).orderBy("order", "asc").get();
    if (snap.empty) { emptyEl.hidden = false; return; }

    snap.forEach(doc => {
      const d = doc.data();
      const card = document.createElement("div");
      card.className = "card";
      if (kind === "project") {
        card.innerHTML = `<h3>${escapeHtml(d.title || "")}</h3><p>${escapeHtml(d.description || "")}</p>`;
      } else {
        const dict = TRANSLATIONS[currentLang];
        card.innerHTML = `<h3>${escapeHtml(d.title || "")}</h3>
          <p>${dict.fundsCollected}: ${escapeHtml(d.collected || "")}</p>
          <p>${dict.fundsUsed}: ${escapeHtml(d.usedFor || "")}</p>`;
      }
      listEl.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    emptyEl.hidden = false;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- Complaint form ---------------- */
const formOverlay = document.getElementById("formOverlay");
const connectBtn = document.getElementById("connectBtn");
const formCloseBtn = document.getElementById("formCloseBtn");
const formCancelBtn = document.getElementById("formCancelBtn");
const complaintForm = document.getElementById("complaintForm");
const formStep = document.getElementById("formStep");
const formSuccessStep = document.getElementById("formSuccessStep");
const formSuccessCloseBtn = document.getElementById("formSuccessCloseBtn");
const fileInput = document.getElementById("fFile");
const fileError = document.getElementById("fileError");
const formGenericError = document.getElementById("formGenericError");
const submitBtn = document.getElementById("formSubmitBtn");

// 700KB, not 5MB: attachments are stored as base64 text directly inside the
// Firestore document (no Firebase Storage = stays on the free Spark plan).
// Firestore caps a document at 1MB, and base64 text is ~37% larger than the
// original file, so 700KB of real file data safely fits.
const MAX_FILE_BYTES = 700 * 1024;

/* ---------------- Spam protection ----------------
   Three lightweight, free (no extra service) layers:
   1. Honeypot field (#fWebsite) — invisible to people, bots often fill it.
   2. Minimum fill time — reject a submit that happens implausibly fast
      after the form opened (real people take at least a few seconds).
   3. Cooldown — one submission per device per COOLDOWN_MS, tracked in
      localStorage, to stop rapid repeat/flood submissions.
--------------------------------------------------- */
const MIN_FILL_MS = 4000;              // 4 seconds minimum before a submit is accepted
const COOLDOWN_MS = 2 * 60 * 1000;     // 2 minutes between submissions, per device
const LAST_SUBMIT_KEY = "vtc_last_submit_at";
let formOpenedAt = 0;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // "data:<type>;base64,xxxx"
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openForm() {
  formOverlay.classList.add("open");
  formStep.hidden = false;
  formSuccessStep.hidden = true;
  complaintForm.reset();
  fileError.hidden = true;
  formGenericError.hidden = true;
  formOpenedAt = Date.now();
}
function closeForm() { formOverlay.classList.remove("open"); }

connectBtn.addEventListener("click", openForm);
formCloseBtn.addEventListener("click", closeForm);
formCancelBtn.addEventListener("click", closeForm);
formOverlay.addEventListener("click", (e) => { if (e.target === formOverlay) closeForm(); });
formSuccessCloseBtn.addEventListener("click", closeForm);

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileError.hidden = true;
  if (file && file.size > MAX_FILE_BYTES) {
    fileError.hidden = false;
    fileInput.value = "";
  }
});

function generateTrackingId() {
  // The random part is now also the "access key" for this complaint (see
  // firestore.rules — reading a complaint requires knowing its exact ID),
  // so it uses 8 random characters (36^8 ≈ 2.8 trillion combinations)
  // instead of a short, easily-guessable one.
  const rand = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join("").toUpperCase();
  const date = new Date();
  const stamp = `${date.getFullYear().toString().slice(2)}${(date.getMonth()+1).toString().padStart(2,"0")}${date.getDate().toString().padStart(2,"0")}`;
  return `VTC-${stamp}-${rand}`;
}

complaintForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formGenericError.hidden = true;

  // 1. Honeypot: if this hidden field has anything in it, it was a bot.
  // Pretend success (so the bot doesn't learn to adapt) but save nothing.
  const honeypot = document.getElementById("fWebsite").value;
  if (honeypot) {
    document.getElementById("trackingIdDisplay").textContent = generateTrackingId();
    formStep.hidden = true;
    formSuccessStep.hidden = false;
    return;
  }

  // 2. Minimum fill time.
  if (Date.now() - formOpenedAt < MIN_FILL_MS) {
    formGenericError.textContent = TRANSLATIONS[currentLang].formErrorTooFast;
    formGenericError.hidden = false;
    return;
  }

  // 3. Cooldown between submissions on this device.
  const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
  if (Date.now() - lastSubmit < COOLDOWN_MS) {
    formGenericError.textContent = TRANSLATIONS[currentLang].formErrorCooldown;
    formGenericError.hidden = false;
    return;
  }

  const name = document.getElementById("fName").value.trim();
  const studentClass = document.getElementById("fClass").value.trim();
  const complaintText = document.getElementById("fComplaint").value.trim();
  const file = fileInput.files[0];

  if (!name || !studentClass || !complaintText) {
    formGenericError.textContent = TRANSLATIONS[currentLang].formErrorRequired;
    formGenericError.hidden = false;
    return;
  }
  if (file && file.size > MAX_FILE_BYTES) {
    fileError.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = TRANSLATIONS[currentLang].submittingBtn;

  try {
    const trackingId = generateTrackingId();
    let fileBase64 = null;
    let fileName = null;
    let fileType = null;

    if (file) {
      fileBase64 = await fileToBase64(file); // "data:image/png;base64,...."
      fileName = file.name;
      fileType = file.type;
    }

    // trackingId is used as the actual Firestore document ID (not just a
    // field) — see firestore.rules. This means reading a complaint back
    // requires knowing its exact ID; there is no way to list/browse all
    // complaints without being signed in as admin.
    await db.collection("complaints").doc(trackingId).set({
      trackingId,
      name,
      studentClass,
      complaintText,
      fileBase64,
      fileName,
      fileType,
      status: "pending",
      customStatusText: "",
      language: currentLang,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById("trackingIdDisplay").textContent = trackingId;
    localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
    formStep.hidden = true;
    formSuccessStep.hidden = false;
  } catch (err) {
    console.error(err);
    formGenericError.textContent = TRANSLATIONS[currentLang].formErrorGeneric;
    formGenericError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = TRANSLATIONS[currentLang].submitBtn;
  }
});

/* ---------------- Copy tracking ID ---------------- */
document.getElementById("copyIdBtn").addEventListener("click", async () => {
  const id = document.getElementById("trackingIdDisplay").textContent;
  const btn = document.getElementById("copyIdBtn");
  try {
    await navigator.clipboard.writeText(id);
  } catch (err) {
    // Fallback for browsers without Clipboard API permission
    const ta = document.createElement("textarea");
    ta.value = id;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { console.error(e); }
    document.body.removeChild(ta);
  }
  const original = btn.textContent;
  btn.textContent = TRANSLATIONS[currentLang].copyIdCopied;
  setTimeout(() => { btn.textContent = original; }, 1800);
});

/* ---------------- My Complaints (tracking by ID only) ----------------
   Deliberately no auto-listing of "complaints submitted from this device":
   on a shared/public device, that would reveal a previous student's
   complaint to the next person without them ever typing an ID. A visitor
   can only ever see a complaint by typing its exact tracking ID. */

function statusPillHtml(status, customText) {
  const dict = TRANSLATIONS[currentLang];
  let cls = "status-pending", label = dict.status_pending;
  if (status === "approved") { cls = "status-approved"; label = dict.status_approved; }
  else if (status === "rejected") { cls = "status-rejected"; label = dict.status_rejected; }
  else if (status === "custom") { cls = "status-custom"; label = customText || status; }
  return `<span class="status-pill ${cls}">${escapeHtml(label)}</span>`;
}

function complaintCardHtml(d) {
  const dict = TRANSLATIONS[currentLang];
  const date = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleDateString() : "";
  const replyHtml = d.adminReply
    ? `<div class="admin-reply-box"><p class="admin-reply-label">${dict.adminReplyLabel}</p><p class="admin-reply-text">${escapeHtml(d.adminReply)}</p></div>`
    : "";
  return `<div class="card">
    <h3>${escapeHtml(d.complaintText.slice(0, 60))}${d.complaintText.length > 60 ? "…" : ""}</h3>
    <p>${dict.trackingIdLabel}: <strong>${escapeHtml(d.trackingId)}</strong></p>
    <p class="meta">${dict.submittedOn}: ${date}</p>
    <p style="margin-top:8px;">${statusPillHtml(d.status, d.customStatusText)}</p>
    ${replyHtml}
  </div>`;
}

document.getElementById("trackBtn").addEventListener("click", async () => {
  const id = document.getElementById("trackInput").value.trim();
  const resultEl = document.getElementById("trackResult");
  const notFoundEl = document.getElementById("trackNotFound");
  resultEl.innerHTML = "";
  notFoundEl.hidden = true;
  if (!id) return;

  try {
    const doc = await db.collection("complaints").doc(id).get();
    if (!doc.exists) {
      notFoundEl.hidden = false;
    } else {
      resultEl.innerHTML = complaintCardHtml(doc.data());
    }
  } catch (err) {
    console.error(err);
    notFoundEl.hidden = false;
  }
});

/* ---------------- Init ---------------- */
applyLanguage(currentLang);
showRandomQuote();
