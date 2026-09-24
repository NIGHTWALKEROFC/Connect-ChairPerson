/**
 * admin.js
 * Handles admin login (Firebase Auth) and the complaints dashboard
 * (Firestore) with status updates: approved / rejected / custom text.
 */

function log(msg) { if (typeof vtcLog === "function") vtcLog(msg); else console.log(msg); }

log("admin.js running...");

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

// True only if firebase-config.js successfully created `auth` and `db`.
// Checked defensively here so a Firebase problem never silently blocks
// the rest of this file (like the submit handler below) from running.
const firebaseReady = (typeof auth !== "undefined" && typeof db !== "undefined" && !!auth && !!db);
log("firebaseReady = " + firebaseReady);

/* ---------------- Auth ---------------- */
if (firebaseReady) {
  auth.onAuthStateChanged(user => {
    log("onAuthStateChanged fired: " + (user ? ("signed in as " + user.email) : "signed out"));
    if (user) {
      loginWrap.hidden = true;
      dashboard.hidden = false;
      adminEmail.textContent = user.email;
      loadComplaints();
    } else {
      loginWrap.hidden = false;
      dashboard.hidden = true;
    }
  });
} else {
  log("Skipping onAuthStateChanged — Firebase is not ready. Check the errors above.");
}

// This listener is set up unconditionally (outside the firebaseReady check)
// so the Sign in button always does SOMETHING visible, even if Firebase
// itself failed to load — that's what fixes a login button that appeared
// to do "nothing" when clicked.
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  log("Login form submitted.");
  loginError.hidden = true;

  if (!firebaseReady) {
    log("Cannot sign in — firebaseReady is false.");
    loginError.textContent = "Firebase didn't load correctly, so sign-in can't run. Open the Diagnostics panel (bottom-left) for the exact error.";
    loginError.hidden = false;
    return;
  }

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  log("Attempting sign in for: " + email);

  try {
    await auth.signInWithEmailAndPassword(email, password);
    log("Sign in call succeeded.");
  } catch (err) {
    log("Sign in FAILED — code: " + err.code + ", message: " + err.message);
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
  // Fallback: show Firebase's own message so the exact cause is visible.
  return (err && err.message) ? err.message : "Sign in failed. Please try again.";
}

logoutBtn.addEventListener("click", () => { if (firebaseReady) auth.signOut(); });

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

function renderList() {
  const filtered = activeFilter === "all"
    ? allComplaints
    : allComplaints.filter(c => (c.status || "pending") === activeFilter);

  adminList.innerHTML = "";
  dashEmpty.hidden = filtered.length !== 0;
  if (filtered.length === 0) {
    dashEmpty.hidden = false;
    dashEmpty.textContent = "No complaints in this category.";
    return;
  }

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
    ${c.fileBase64 ? `<span class="attachment-flag">📎 Attachment</span>` : ""}
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
