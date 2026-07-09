// ─────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = ["ASRS", "Infolog", "AMR", "Other"];

const QUICK_ERRORS = {
  ASRS: ["ASRS timeout", "ASRS bin not found", "ASRS crane fault", "ASRS communication lost"],
  Infolog: ["Infolog sync failed", "Infolog order mismatch", "Infolog connection timeout"],
  AMR: ["AMR stuck / blocked path", "AMR battery low fault", "AMR navigation error", "AMR docking failed"],
  Other: ["Network outage", "Sensor fault", "Power interruption", "Manual override triggered"]
};

let state = {
  category: "ASRS",
  photoFile: null,
  errors: [],
  filter: "All",
  search: ""
};

// ─────────────────────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────────────────────
const categoryPills = document.getElementById("categoryPills");
const quickSelect = document.getElementById("quickSelect");
const descriptionEl = document.getElementById("description");
const timestampEl = document.getElementById("timestamp");
const notesEl = document.getElementById("notes");
const nowBtn = document.getElementById("nowBtn");
const photoInput = document.getElementById("photoInput");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const photoPreview = document.getElementById("photoPreview");
const removePhotoBtn = document.getElementById("removePhoto");
const logBtn = document.getElementById("logBtn");
const formStatus = document.getElementById("formStatus");
const errorList = document.getElementById("errorList");
const emptyState = document.getElementById("emptyState");
const entryCount = document.getElementById("entryCount");
const todayCount = document.getElementById("todayCount");
const searchInput = document.getElementById("searchInput");
const filterRow = document.getElementById("filterRow");
const exportBtn = document.getElementById("exportBtn");
const exportDropdown = document.getElementById("exportDropdown");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────
function setNowInInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  timestampEl.value = d.toISOString().slice(0, 16);
}
setNowInInput();
renderQuickSelect();
loadErrors();
subscribeRealtime();

// ─────────────────────────────────────────────────────────────
// Category pills
// ─────────────────────────────────────────────────────────────
categoryPills.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  state.category = btn.dataset.cat;
  [...categoryPills.children].forEach(p => p.classList.toggle("active", p === btn));
  renderQuickSelect();
});

function renderQuickSelect() {
  quickSelect.innerHTML = "";
  (QUICK_ERRORS[state.category] || []).forEach(text => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      descriptionEl.value = text;
      descriptionEl.focus();
    });
    quickSelect.appendChild(chip);
  });
}

// ─────────────────────────────────────────────────────────────
// Now button
// ─────────────────────────────────────────────────────────────
nowBtn.addEventListener("click", setNowInInput);

// ─────────────────────────────────────────────────────────────
// Photo upload / preview
// ─────────────────────────────────────────────────────────────
photoPlaceholder.addEventListener("click", () => photoInput.click());
photoPreview.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  state.photoFile = file;
  const url = URL.createObjectURL(file);
  photoPreview.src = url;
  photoPreview.hidden = false;
  photoPlaceholder.hidden = true;
  removePhotoBtn.hidden = false;
});

removePhotoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  state.photoFile = null;
  photoInput.value = "";
  photoPreview.hidden = true;
  photoPlaceholder.hidden = false;
  removePhotoBtn.hidden = true;
});

// ─────────────────────────────────────────────────────────────
// Log error
// ─────────────────────────────────────────────────────────────
logBtn.addEventListener("click", async () => {
  const description = descriptionEl.value.trim();
  if (!description) {
    formStatus.textContent = "Please add a description.";
    formStatus.classList.add("error");
    descriptionEl.focus();
    return;
  }
  formStatus.classList.remove("error");

  logBtn.disabled = true;
  formStatus.textContent = "Saving...";

  try {
    let photo_url = null;
    if (state.photoFile) {
      photo_url = await uploadPhoto(state.photoFile);
    }

    const created_at = timestampEl.value
      ? new Date(timestampEl.value).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("errors").insert({
      category: state.category,
      description,
      notes: notesEl.value.trim() || null,
      status: "open",
      created_at,
      photo_url
    });

    if (error) throw error;

    // reset form
    descriptionEl.value = "";
    notesEl.value = "";
    state.photoFile = null;
    photoInput.value = "";
    photoPreview.hidden = true;
    photoPlaceholder.hidden = false;
    removePhotoBtn.hidden = true;
    setNowInInput();
    formStatus.textContent = "Logged.";
    setTimeout(() => { if (formStatus.textContent === "Logged.") formStatus.textContent = ""; }, 2000);

    await loadErrors();
  } catch (err) {
    console.error(err);
    formStatus.textContent = "Failed to save: " + err.message;
    formStatus.classList.add("error");
  } finally {
    logBtn.disabled = false;
  }
});

async function uploadPhoto(file) {
  const ext = file.name.split(".").pop();
  const path = `errors/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─────────────────────────────────────────────────────────────
// Load + render errors
// ─────────────────────────────────────────────────────────────
async function loadErrors() {
  const { data, error } = await supabase
    .from("errors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    errorList.innerHTML = `<div class="empty-state">Could not load data: ${escapeHtml(error.message)}</div>`;
    return;
  }
  state.errors = data || [];
  renderStats();
  renderList();
}

function subscribeRealtime() {
  supabase
    .channel("errors-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "errors" }, () => {
      loadErrors();
    })
    .subscribe();
}

function renderStats() {
  const counts = { ASRS: 0, Infolog: 0, AMR: 0, Other: 0 };
  const todayStr = new Date().toDateString();
  let todayN = 0;
  state.errors.forEach(e => {
    counts[e.category] = (counts[e.category] || 0) + 1;
    if (new Date(e.created_at).toDateString() === todayStr) todayN++;
  });
  document.getElementById("statASRS").textContent = counts.ASRS;
  document.getElementById("statInfolog").textContent = counts.Infolog;
  document.getElementById("statAMR").textContent = counts.AMR;
  document.getElementById("statOther").textContent = counts.Other;
  todayCount.textContent = todayN;
}

function renderList() {
  let list = state.errors;
  if (state.filter !== "All") list = list.filter(e => e.category === state.filter);
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(e =>
      (e.description || "").toLowerCase().includes(q) ||
      (e.notes || "").toLowerCase().includes(q)
    );
  }

  entryCount.textContent = `${list.length} entr${list.length === 1 ? "y" : "ies"}`;

  if (!list.length) {
    errorList.innerHTML = "";
    errorList.appendChild(emptyState);
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  errorList.innerHTML = "";

  list.forEach(e => {
    const item = document.createElement("div");
    item.className = `error-item cat-${e.category} ${e.status === "solved" ? "solved" : ""}`;

    const thumb = e.photo_url
      ? `<img class="error-thumb" src="${e.photo_url}" data-full="${e.photo_url}" />`
      : "";

    const statusBadge = e.status === "solved"
      ? `<span class="badge badge-solved"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>SOLVED</span>`
      : `<span class="badge badge-open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>OPEN</span>`;

    const created = new Date(e.created_at);
    const createdStr = created.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    let metaHtml = `<span>${createdStr}</span>`;
    if (e.status === "solved" && e.solved_at) {
      const solved = new Date(e.solved_at);
      const durMin = Math.max(0, Math.round((solved - created) / 60000));
      metaHtml += `<span>·</span><span class="solved-time">Solved in ${formatDuration(durMin)}</span>`;
    }

    item.innerHTML = `
      ${thumb}
      <div class="error-body">
        <div class="error-badges">
          <span class="badge badge-cat-${e.category}">${e.category}</span>
          ${statusBadge}
        </div>
        <p class="error-title">${escapeHtml(e.description)}</p>
        ${e.notes ? `<p class="error-notes">${escapeHtml(e.notes)}</p>` : ""}
        <div class="error-meta">${metaHtml}</div>
      </div>
      <div class="error-actions">
        ${e.status === "solved"
          ? `<button class="icon-btn reopen" title="Reopen" data-action="reopen" data-id="${e.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2-9.5L1 10"/></svg></button>`
          : `<button class="icon-btn solve" title="Mark solved" data-action="solve" data-id="${e.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></button>`
        }
        <button class="icon-btn delete" title="Delete" data-action="delete" data-id="${e.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg></button>
      </div>
    `;
    errorList.appendChild(item);
  });
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// ─────────────────────────────────────────────────────────────
// Actions: solve / reopen / delete / photo click
// ─────────────────────────────────────────────────────────────
errorList.addEventListener("click", async (e) => {
  const thumb = e.target.closest(".error-thumb");
  if (thumb) {
    lightboxImg.src = thumb.dataset.full;
    lightbox.classList.add("open");
    return;
  }

  const btn = e.target.closest(".icon-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "solve") {
    await supabase.from("errors").update({ status: "solved", solved_at: new Date().toISOString() }).eq("id", id);
  } else if (action === "reopen") {
    await supabase.from("errors").update({ status: "open", solved_at: null }).eq("id", id);
  } else if (action === "delete") {
    if (!confirm("Delete this error entry? This cannot be undone.")) return;
    await supabase.from("errors").delete().eq("id", id);
  }
  await loadErrors();
});

lightbox.addEventListener("click", () => { lightbox.classList.remove("open"); });

// ─────────────────────────────────────────────────────────────
// Search + filter
// ─────────────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  renderList();
});

filterRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-pill");
  if (!btn) return;
  state.filter = btn.dataset.filter;
  [...filterRow.children].forEach(p => p.classList.toggle("active", p === btn));
  renderList();
});

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────
exportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  exportDropdown.hidden = !exportDropdown.hidden;
});
document.addEventListener("click", () => { exportDropdown.hidden = true; });

exportDropdown.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-format]");
  if (!btn) return;
  exportData(btn.dataset.format);
});

function buildExportRows() {
  return state.errors.map(e => ({
    ID: e.id,
    Category: e.category,
    Description: e.description,
    Notes: e.notes || "",
    Status: e.status,
    "Logged At": new Date(e.created_at).toLocaleString(),
    "Solved At": e.solved_at ? new Date(e.solved_at).toLocaleString() : "",
    "Duration (min)": e.solved_at ? Math.round((new Date(e.solved_at) - new Date(e.created_at)) / 60000) : "",
    "Photo URL": e.photo_url || ""
  }));
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportData(format) {
  const rows = buildExportRows();
  const stamp = new Date().toISOString().slice(0, 10);

  if (!rows.length) {
    alert("No data to export yet.");
    return;
  }

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `error-tracker-${stamp}.xlsx`);
  } else if (format === "csv") {
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
    ];
    downloadBlob(csvLines.join("\n"), `error-tracker-${stamp}.csv`, "text/csv");
  } else if (format === "txt") {
    const lines = rows.map(r =>
      Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" + "-".repeat(40)
    );
    downloadBlob(lines.join("\n"), `error-tracker-${stamp}.txt`, "text/plain");
  }
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
