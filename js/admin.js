/**
 * admin.js
 * Handles admin login (Firebase Auth, 24-hour session), the complaints
 * dashboard (Firestore) with status updates + replies, and the Site
 * Content manager (Upcoming Projects / Completed Projects / Funds).
 */

const loginWrap = document.getElementById("loginWrap");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmail = document.getElementById("adminEmail");
const adminList = document.getElementById("adminList");
const dashEmpty = document.getElementById("dashEmpty");

let allComplaints = [];
let activeFilter = "all";
let searchQuery = "";
let sortOrder = "newest";

// True only if firebase-config.js successfully created `auth` and `db`.
// Checked defensively here so a Firebase problem never silently blocks
// the rest of this file (like the submit handler below) from running.
const firebaseReady = (typeof auth !== "undefined" && typeof db !== "undefined" && !!auth && !!db);
if (!firebaseReady) console.error("Firebase is not ready — check js/firebase-config.js and your internet connection.");

/* ---------------- Auth + 24-hour session expiry ----------------
   Firebase, by default, keeps an admin signed in indefinitely (it silently
   refreshes the login behind the scenes). To force a fresh login every
   24 hours instead, we stamp the time of each successful sign-in in
   localStorage and check it every time the page loads, plus periodically
   while it stays open.

   `justSignedIn` avoids a race condition: onAuthStateChanged can fire
   before the code right after `await signInWithEmailAndPassword(...)`
   gets to run, so stamping the login time only after that await was
   unreliable — it could see the OLD (or missing) timestamp and instantly
   sign the person right back out, which looked like "correct password
   does nothing." Setting the flag BEFORE calling signIn, and having
   onAuthStateChanged itself do the stamping, removes that race entirely. */
const ADMIN_SESSION_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOGIN_AT_KEY = "vtc_admin_login_at";
let justSignedIn = false;

if (firebaseReady) {
  auth.onAuthStateChanged(user => {
    if (user) {
      if (justSignedIn) {
        localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
        justSignedIn = false;
      }

      const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
      const expired = !loginAt || (Date.now() - loginAt > ADMIN_SESSION_MS);
      if (expired) {
        localStorage.removeItem(LOGIN_AT_KEY);
        auth.signOut();
        return;
      }
      loginWrap.hidden = true;
      dashboard.hidden = false;
      adminEmail.textContent = user.email;
      loadComplaints();
      loadAllContentSections();
      loadSiteSettings();
    } else {
      localStorage.removeItem(LOGIN_AT_KEY);
      loginWrap.hidden = false;
      dashboard.hidden = true;
    }
  });

  // Also check periodically in case the tab is left open past 24 hours.
  setInterval(() => {
    const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
    if (auth.currentUser && loginAt && (Date.now() - loginAt > ADMIN_SESSION_MS)) {
      auth.signOut();
    }
  }, 5 * 60 * 1000);
}

// This listener is set up unconditionally (outside the firebaseReady check)
// so the Sign in button always does SOMETHING visible, even if Firebase
// itself failed to load, instead of silently doing nothing.
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  if (!firebaseReady) {
    loginError.textContent = "Firebase didn't load correctly, so sign-in can't run. Check your internet connection and try refreshing the page.";
    loginError.hidden = false;
    return;
  }

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    justSignedIn = true;
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged (above) takes it from here: it stamps the login
    // time and switches the screen to the dashboard.
  } catch (err) {
    justSignedIn = false;
    console.error(err);
    loginError.textContent = describeAuthError(err);
    loginError.hidden = false;
  }
});

function describeAuthError(err) {
  const code = err && err.code;
  if (code === "auth/unauthorized-domain") {
    return "This website's address isn't in Firebase's Authorized domains list yet. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "Incorrect email or password.";
  }
  if (code === "auth/invalid-email") {
    return "That doesn't look like a valid email address.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error — check your internet connection.";
  }
  return (err && err.message) ? err.message : "Sign in failed. Please try again.";
}

logoutBtn.addEventListener("click", () => { if (firebaseReady) auth.signOut(); });

/* ---------------- Tabs ---------------- */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = true; });
    const panel = document.getElementById(btn.dataset.tab);
    panel.hidden = false;
    if (btn.dataset.tab === "tabContent") loadAllContentSections();
  });
});

/* ---------------- Load & render complaints ---------------- */
async function loadComplaints() {
  try {
    const snap = await db.collection("complaints").orderBy("createdAt", "desc").get();
    allComplaints = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderList();
  } catch (err) {
    console.error(err);
    dashEmpty.hidden = false;
    dashEmpty.textContent = "Could not load complaints. Check your Firestore rules and connection.";
  }
}

function getVisibleComplaints() {
  let list = activeFilter === "all"
    ? allComplaints.slice()
    : allComplaints.filter(c => (c.status || "pending") === activeFilter);

  if (searchQuery) {
    list = list.filter(c =>
      (c.name || "").toLowerCase().includes(searchQuery) ||
      (c.studentClass || "").toLowerCase().includes(searchQuery) ||
      (c.trackingId || "").toLowerCase().includes(searchQuery)
    );
  }

  list.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return sortOrder === "oldest" ? ta - tb : tb - ta;
  });

  return list;
}

function renderList() {
  const filtered = getVisibleComplaints();

  adminList.innerHTML = "";
  if (filtered.length === 0) {
    dashEmpty.hidden = false;
    dashEmpty.textContent = allComplaints.length === 0
      ? "No complaints yet."
      : "No complaints match your search or filter.";
    return;
  }
  dashEmpty.hidden = true;
  filtered.forEach(c => adminList.appendChild(buildCard(c)));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function buildCard(c) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "admin-card";
  const date = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleString() : "";
  const excerpt = (c.complaintText || "").slice(0, 90) + ((c.complaintText || "").length > 90 ? "…" : "");

  card.innerHTML = `
    <div class="admin-card-head">
      <div>
        <h3>${escapeHtml(c.name)} <span class="class-tag">Class ${escapeHtml(c.studentClass)}</span></h3>
        <p class="student-meta">${date} · ${escapeHtml(c.trackingId)}</p>
      </div>
      ${statusPillHtml(c)}
    </div>
    <p class="complaint-excerpt">${escapeHtml(excerpt)}</p>
    <div class="card-flags">
      ${c.fileBase64 ? `<span class="attachment-flag">📎 Attachment</span>` : ""}
      ${c.adminReply ? `<span class="reply-flag">💬 Replied</span>` : ""}
    </div>
  `;

  card.addEventListener("click", () => openDetail(c));
  return card;
}

function statusPillHtml(c) {
  const status = c.status || "pending";
  let cls = "status-pending", label = "Pending";
  if (status === "approved") { cls = "status-approved"; label = "Approved"; }
  else if (status === "rejected") { cls = "status-rejected"; label = "Rejected"; }
  else if (status === "custom") { cls = "status-custom"; label = c.customStatusText || "Custom"; }
  return `<span class="status-pill ${cls}">${escapeHtml(label)}</span>`;
}

/* ---------------- Detail modal ---------------- */
const detailOverlay = document.getElementById("detailOverlay");
const detailContent = document.getElementById("detailContent");
const detailCloseBtn = document.getElementById("detailCloseBtn");

function closeDetail() { detailOverlay.classList.remove("open"); }
detailCloseBtn.addEventListener("click", closeDetail);
detailOverlay.addEventListener("click", (e) => { if (e.target === detailOverlay) closeDetail(); });

function openDetail(c) {
  const date = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleString() : "";

  detailContent.innerHTML = `
    <h2 id="detailName">${escapeHtml(c.name)}</h2>
    <p class="detail-meta-row">
      <span><strong>Class:</strong> ${escapeHtml(c.studentClass)}</span>
      <span><strong>Submitted:</strong> ${date}</span>
      <span><strong>Tracking ID:</strong> ${escapeHtml(c.trackingId)}</span>
    </p>

    <div class="detail-complaint-box">${escapeHtml(c.complaintText)}</div>

    <div class="detail-attachment" id="detailAttachment"></div>

    <div class="detail-reply-block">
      <label for="detailReplyText" class="detail-attachment-label">Reply to this complaint</label>
      <textarea id="detailReplyText" rows="3" placeholder="Write a reply — the student will see this when they check their tracking ID.">${escapeHtml(c.adminReply || "")}</textarea>
      <div class="detail-reply-actions">
        <button class="btn btn-primary" id="detailReplySaveBtn" type="button">Save Reply</button>
        <span class="save-note" id="detailReplySaveNote">Saved</span>
      </div>
    </div>

    <div class="status-controls">
      <select class="status-select" id="detailStatusSelect">
        <option value="pending" ${c.status === "pending" || !c.status ? "selected" : ""}>Pending</option>
        <option value="approved" ${c.status === "approved" ? "selected" : ""}>Approved</option>
        <option value="rejected" ${c.status === "rejected" ? "selected" : ""}>Rejected</option>
        <option value="custom" ${c.status === "custom" ? "selected" : ""}>Custom</option>
      </select>
      <input type="text" class="custom-text" id="detailCustomText" placeholder="Custom status text"
        value="${escapeHtml(c.customStatusText || "")}"
        style="display:${c.status === "custom" ? "inline-block" : "none"};">
      <button class="btn btn-primary" id="detailSaveBtn">Update status</button>
      <span class="save-note" id="detailSaveNote">Saved</span>
    </div>

    <button class="btn-delete" id="detailDeleteBtn" type="button">Delete this complaint</button>
  `;

  const attachmentEl = document.getElementById("detailAttachment");
  if (c.fileBase64) {
    attachmentEl.innerHTML = `
      <p class="detail-attachment-label">📎 ${escapeHtml(c.fileName || "Attachment")}</p>
      <div class="detail-attachment-actions">
        <a class="btn btn-outline" href="${c.fileBase64}" target="_blank" rel="noopener">Open</a>
        <a class="btn btn-outline" href="${c.fileBase64}" download="${escapeHtml(c.fileName || "attachment")}">Download</a>
      </div>
    `;
  } else {
    attachmentEl.innerHTML = `<p class="detail-attachment-label" style="color:var(--grey);">No file attached.</p>`;
  }

  const select = document.getElementById("detailStatusSelect");
  const customInput = document.getElementById("detailCustomText");
  const saveBtn = document.getElementById("detailSaveBtn");
  const saveNote = document.getElementById("detailSaveNote");
  const deleteBtn = document.getElementById("detailDeleteBtn");
  const replyText = document.getElementById("detailReplyText");
  const replySaveBtn = document.getElementById("detailReplySaveBtn");
  const replySaveNote = document.getElementById("detailReplySaveNote");

  select.addEventListener("change", () => {
    customInput.style.display = select.value === "custom" ? "inline-block" : "none";
  });

  saveBtn.addEventListener("click", async () => {
    const newStatus = select.value;
    const customText = customInput.value.trim();
    saveBtn.disabled = true;
    try {
      await db.collection("complaints").doc(c.id).update({
        status: newStatus,
        customStatusText: newStatus === "custom" ? customText : ""
      });
      c.status = newStatus;
      c.customStatusText = customText;
      saveNote.classList.add("show");
      setTimeout(() => saveNote.classList.remove("show"), 1800);
      renderList();
    } catch (err) {
      console.error(err);
      alert("Could not update status. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  });

  replySaveBtn.addEventListener("click", async () => {
    const text = replyText.value.trim();
    replySaveBtn.disabled = true;
    try {
      await db.collection("complaints").doc(c.id).update({
        adminReply: text,
        adminReplyAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      c.adminReply = text;
      replySaveNote.classList.add("show");
      setTimeout(() => replySaveNote.classList.remove("show"), 1800);
      renderList();
    } catch (err) {
      console.error(err);
      alert("Could not save the reply. Please try again.");
    } finally {
      replySaveBtn.disabled = false;
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const confirmed = confirm(`Delete this complaint from ${c.name}? This cannot be undone.`);
    if (!confirmed) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    try {
      await db.collection("complaints").doc(c.id).delete();
      allComplaints = allComplaints.filter(x => x.id !== c.id);
      closeDetail();
      renderList();
    } catch (err) {
      console.error(err);
      alert("Could not delete this complaint. Please try again.");
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete this complaint";
    }
  });

  detailOverlay.classList.add("open");
}

document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    renderList();
  });
});

/* ---------------- Search & sort ---------------- */
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderList();
});

sortSelect.addEventListener("change", () => {
  sortOrder = sortSelect.value;
  renderList();
});

/* ---------------- Export to CSV ---------------- */
const exportCsvBtn = document.getElementById("exportCsvBtn");

function csvEscape(value) {
  const s = String(value === undefined || value === null ? "" : value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function statusLabelForExport(c) {
  if (c.status === "custom") return c.customStatusText || "Custom";
  if (c.status === "approved") return "Approved";
  if (c.status === "rejected") return "Rejected";
  return "Pending";
}

exportCsvBtn.addEventListener("click", () => {
  const list = getVisibleComplaints();
  if (list.length === 0) {
    alert("There are no complaints to export with the current filter/search.");
    return;
  }

  const header = ["Tracking ID", "Name", "Class", "Status", "Complaint", "Admin Reply", "Submitted On", "Has Attachment"];
  const rows = list.map(c => {
    const date = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleString() : "";
    return [
      c.trackingId || "",
      c.name || "",
      c.studentClass || "",
      statusLabelForExport(c),
      c.complaintText || "",
      c.adminReply || "",
      date,
      c.fileBase64 ? "Yes" : "No"
    ];
  });

  const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `complaints-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ================= SITE CONTENT MANAGER =================
   Lets the admin add / edit / delete entries in the three collections
   that power the public site's Upcoming Projects, Completed Projects,
   and Funds sections — no need to touch the Firebase Console anymore. */

const CONTENT_CONFIG = {
  projects_upcoming: {
    fields: ["title", "description"],
    display: d => `<h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.description)}</p>`
  },
  projects_done: {
    fields: ["title", "description"],
    display: d => `<h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.description)}</p>`
  },
  funds: {
    fields: ["title", "collected", "usedFor"],
    display: d => `<h3>${escapeHtml(d.title)}</h3><p>Collected: ${escapeHtml(d.collected)}</p><p>Used for: ${escapeHtml(d.usedFor)}</p>`
  },
  resolved_cases: {
    fields: ["title", "complaint", "solution"],
    display: d => `<h3>${escapeHtml(d.title)}</h3><p><strong>Complaint:</strong> ${escapeHtml(d.complaint)}</p><p><strong>Solution:</strong> ${escapeHtml(d.solution)}</p>`
  }
};

function loadAllContentSections() {
  Object.keys(CONTENT_CONFIG).forEach(loadContentSection);
}

async function loadContentSection(collectionName) {
  const container = document.getElementById(`contentList_${collectionName}`);
  if (!container) return;
  container.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const snap = await db.collection(collectionName).orderBy("order", "asc").get();
    container.innerHTML = "";
    if (snap.empty) {
      container.innerHTML = `<p class="empty-note">No entries yet — add one above.</p>`;
      return;
    }
    snap.forEach(doc => container.appendChild(buildContentItem(collectionName, doc.id, doc.data())));
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="empty-note">Could not load this section. Check your Firestore rules and connection.</p>`;
  }
}

function buildContentItem(collectionName, id, data) {
  const config = CONTENT_CONFIG[collectionName];
  const item = document.createElement("div");
  item.className = "content-item";
  item.innerHTML = `
    <div class="content-item-display">${config.display(data)}</div>
    <div class="content-item-actions">
      <button type="button" class="btn-mini edit-btn">Edit</button>
      <button type="button" class="btn-mini delete-btn">Delete</button>
    </div>
  `;

  item.querySelector(".delete-btn").addEventListener("click", async () => {
    const ok = confirm(`Delete "${data.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await db.collection(collectionName).doc(id).delete();
      item.remove();
    } catch (err) {
      console.error(err);
      alert("Could not delete this entry. Please try again.");
    }
  });

  item.querySelector(".edit-btn").addEventListener("click", () => {
    startEditContentItem(item, collectionName, id, data);
  });

  return item;
}

function startEditContentItem(item, collectionName, id, data) {
  const config = CONTENT_CONFIG[collectionName];
  const LONG_FIELDS = ["description", "complaint", "solution"];
  const fieldsHtml = config.fields.map(f => {
    const val = escapeHtml(data[f] || "");
    return LONG_FIELDS.includes(f)
      ? `<textarea name="${f}" rows="2">${val}</textarea>`
      : `<input type="text" name="${f}" value="${val}">`;
  }).join("");

  item.innerHTML = `
    <div class="content-item-edit-form">
      ${fieldsHtml}
      <div class="content-item-actions">
        <button type="button" class="btn-mini save-edit-btn">Save</button>
        <button type="button" class="btn-mini cancel-edit-btn">Cancel</button>
      </div>
    </div>
  `;

  item.querySelector(".cancel-edit-btn").addEventListener("click", () => {
    item.replaceWith(buildContentItem(collectionName, id, data));
  });

  item.querySelector(".save-edit-btn").addEventListener("click", async () => {
    const updated = {};
    config.fields.forEach(f => {
      updated[f] = item.querySelector(`[name="${f}"]`).value.trim();
    });
    try {
      await db.collection(collectionName).doc(id).update(updated);
      const newData = Object.assign({}, data, updated);
      item.replaceWith(buildContentItem(collectionName, id, newData));
    } catch (err) {
      console.error(err);
      alert("Could not save changes. Please try again.");
    }
  });
}

document.querySelectorAll(".content-add-form").forEach(form => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const collectionName = form.dataset.collection;
    const config = CONTENT_CONFIG[collectionName];
    const data = {};
    let allFilled = true;
    config.fields.forEach(f => {
      const val = form.querySelector(`[name="${f}"]`).value.trim();
      if (!val) allFilled = false;
      data[f] = val;
    });
    if (!allFilled) return;
    data.order = Date.now(); // new entries sort after existing ones

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      await db.collection(collectionName).add(data);
      form.reset();
      loadContentSection(collectionName);
    } catch (err) {
      console.error(err);
      alert("Could not add this entry. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });
});

/* ================= SITE SETTINGS =================
   Currently just the Call Chairperson button on/off toggle. Stored in
   Firestore at settings/site so every visitor's page can read it, and
   only a signed-in admin can change it (see firestore.rules). */

const callButtonToggle = document.getElementById("callButtonToggle");
const settingsSaveNote = document.getElementById("settingsSaveNote");

async function loadSiteSettings() {
  try {
    const doc = await db.collection("settings").doc("site").get();
    const data = doc.exists ? doc.data() : {};
    callButtonToggle.checked = data.callButtonEnabled !== false; // defaults to on
  } catch (err) {
    console.error(err);
  }
}

callButtonToggle.addEventListener("change", async () => {
  const enabled = callButtonToggle.checked;
  callButtonToggle.disabled = true;
  try {
    await db.collection("settings").doc("site").set(
      { callButtonEnabled: enabled },
      { merge: true }
    );
    settingsSaveNote.classList.add("show");
    setTimeout(() => settingsSaveNote.classList.remove("show"), 1800);
  } catch (err) {
    console.error(err);
    alert("Could not save this setting. Please try again.");
    callButtonToggle.checked = !enabled; // revert the switch on failure
  } finally {
    callButtonToggle.disabled = false;
  }
});
