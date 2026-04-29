const storagePrefix = "mydenthub";
const logoPath = "mydenthub-logo.png";
const fields = [
  { key: "doctor", label: "Doctor" },
  { key: "patient", label: "Patient" },
  { key: "prosthetic", label: "Prosthetic" },
  { key: "received", label: "Received" },
  { key: "due", label: "Due" },
  { key: "cost", label: "Cost" },
  { key: "notes", label: "Notes" },
];

let state = {
  user: null,
  records: [],
  profile: {},
  theme: "aqua",
  selectedRecordIds: [],
  selectedFields: fields.map((field) => field.key),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  logoutButton: $("#logoutButton"),
  userInitial: $("#userInitial"),
  userName: $("#userName"),
  userEmail: $("#userEmail"),
  pageTitle: $("#pageTitle"),
  addRecordButton: $("#addRecordButton"),
  recordForm: $("#recordForm"),
  recordId: $("#recordId"),
  doctorInput: $("#doctorInput"),
  patientInput: $("#patientInput"),
  prostheticInput: $("#prostheticInput"),
  receivedInput: $("#receivedInput"),
  dueInput: $("#dueInput"),
  costInput: $("#costInput"),
  notesInput: $("#notesInput"),
  cancelRecordButton: $("#cancelRecordButton"),
  recordsTable: $("#recordsTable"),
  emptyState: $("#emptyState"),
  doctorFilter: $("#doctorFilter"),
  fieldChooser: $("#fieldChooser"),
  recordChooser: $("#recordChooser"),
  downloadPdfButton: $("#downloadPdfButton"),
  profileForm: $("#profileForm"),
  displayNameInput: $("#displayNameInput"),
  roleInput: $("#roleInput"),
  organizationInput: $("#organizationInput"),
};

function storageKey(suffix) {
  return `${storagePrefix}:${state.user.id}:${suffix}`;
}

function loadUserData() {
  state.records = JSON.parse(localStorage.getItem(storageKey("records")) || "[]");
  state.profile = JSON.parse(localStorage.getItem(storageKey("profile")) || "{}");
  state.theme = localStorage.getItem(storageKey("theme")) || "aqua";
  state.selectedRecordIds = state.records.map((record) => record.id);
  state.selectedFields = fields.map((field) => field.key);
}

function saveRecords() {
  localStorage.setItem(storageKey("records"), JSON.stringify(state.records));
}

function saveProfile() {
  localStorage.setItem(storageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(storageKey("theme"), state.theme);
}

function logout() {
  localStorage.removeItem(`${storagePrefix}:session`);
  window.location.href = "index.html";
}

function renderUser() {
  const profileName = state.profile.displayName || state.user.name || state.user.email;
  elements.userName.textContent = profileName;
  elements.userEmail.textContent = state.user.email;
  elements.userInitial.textContent = profileName.slice(0, 1).toUpperCase();
  elements.displayNameInput.value = state.profile.displayName || state.user.name || "";
  elements.roleInput.value = state.profile.role || "";
  elements.organizationInput.value = state.profile.organization || "";
}

function renderRecords() {
  elements.recordsTable.innerHTML = "";
  const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

  state.records.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.doctor)}</td>
      <td>${escapeHtml(record.patient)}</td>
      <td>${escapeHtml(record.prosthetic)}</td>
      <td>${formatDate(record.received)}</td>
      <td>${formatDate(record.due)}</td>
      <td>${currency.format(Number(record.cost || 0))}</td>
      <td>
        <div class="row-actions">
          <button class="row-action" data-edit="${record.id}" type="button">Edit</button>
          <button class="row-action delete" data-delete="${record.id}" type="button">Delete</button>
        </div>
      </td>
    `;
    elements.recordsTable.append(row);
  });

  elements.emptyState.style.display = state.records.length ? "none" : "block";
}

function renderExportControls() {
  const doctors = ["All doctors", ...new Set(state.records.map((record) => record.doctor).filter(Boolean))];
  const selectedDoctor = elements.doctorFilter.value || "All doctors";
  elements.doctorFilter.innerHTML = doctors.map((doctor) => `<option>${escapeHtml(doctor)}</option>`).join("");
  elements.doctorFilter.value = doctors.includes(selectedDoctor) ? selectedDoctor : "All doctors";

  elements.fieldChooser.innerHTML = fields.map((field) => `
    <label>
      <input type="checkbox" value="${field.key}" ${state.selectedFields.includes(field.key) ? "checked" : ""} />
      ${field.label}
    </label>
  `).join("");

  const filtered = filteredRecords();
  state.selectedRecordIds = state.selectedRecordIds.filter((id) => filtered.some((record) => record.id === id));
  if (!state.selectedRecordIds.length) state.selectedRecordIds = filtered.map((record) => record.id);

  elements.recordChooser.innerHTML = filtered.length
    ? filtered.map((record) => `
      <label>
        <input type="checkbox" value="${record.id}" ${state.selectedRecordIds.includes(record.id) ? "checked" : ""} />
        ${escapeHtml(record.doctor)} - ${escapeHtml(record.patient)} - ${escapeHtml(record.prosthetic)}
      </label>
    `).join("")
    : `<p class="muted">No records match this doctor filter.</p>`;
}

function renderAll() {
  renderUser();
  renderRecords();
  renderExportControls();
  $$(".theme-choice").forEach((button) => button.classList.toggle("active", button.dataset.theme === state.theme));
}

function filteredRecords() {
  const doctor = elements.doctorFilter.value;
  if (!doctor || doctor === "All doctors") return state.records;
  return state.records.filter((record) => record.doctor === doctor);
}

function showRecordForm(record = null) {
  elements.recordForm.hidden = false;
  elements.recordId.value = record?.id || "";
  elements.doctorInput.value = record?.doctor || "";
  elements.patientInput.value = record?.patient || "";
  elements.prostheticInput.value = record?.prosthetic || "";
  elements.receivedInput.value = record?.received || "";
  elements.dueInput.value = record?.due || "";
  elements.costInput.value = record?.cost || "";
  elements.notesInput.value = record?.notes || "";
  elements.doctorInput.focus();
}

function hideRecordForm() {
  elements.recordForm.hidden = true;
  elements.recordForm.reset();
  elements.recordId.value = "";
}

function saveRecord(event) {
  event.preventDefault();
  const id = elements.recordId.value || crypto.randomUUID();
  const record = {
    id,
    doctor: elements.doctorInput.value.trim(),
    patient: elements.patientInput.value.trim(),
    prosthetic: elements.prostheticInput.value.trim(),
    received: elements.receivedInput.value,
    due: elements.dueInput.value,
    cost: elements.costInput.value,
    notes: elements.notesInput.value.trim(),
  };

  const existingIndex = state.records.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = record;
  } else {
    state.records.push(record);
  }

  saveRecords();
  hideRecordForm();
  renderAll();
}

function deleteRecord(id) {
  if (!confirm("Delete this record?")) return;
  state.records = state.records.filter((record) => record.id !== id);
  state.selectedRecordIds = state.selectedRecordIds.filter((recordId) => recordId !== id);
  saveRecords();
  renderAll();
}

async function downloadPdf() {
  if (!window.jspdf) {
    alert("PDF tools are still loading. Try again in a moment.");
    return;
  }

  const selected = filteredRecords().filter((record) => state.selectedRecordIds.includes(record.id));
  if (!selected.length) {
    alert("Choose at least one record to download.");
    return;
  }

  if (!state.selectedFields.length) {
    alert("Choose at least one field for the PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const logoData = await getLogoDataUrl();
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 44;
  let y = 54;

  pdf.setFillColor(21, 42, 91);
  pdf.rect(0, 0, pageWidth, 112, "F");
  pdf.setFillColor(73, 185, 174);
  pdf.rect(0, 104, pageWidth, 8, "F");
  if (logoData) pdf.addImage(logoData, "PNG", margin, 18, 86, 64);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("MyDentHub Case Export", margin + 106, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Prepared for ${state.profile.displayName || state.user.email}`, margin + 106, y + 22);
  if (state.profile.organization) {
    pdf.text(`Organization: ${state.profile.organization}`, margin + 106, y + 38);
  }
  y = 148;

  selected.forEach((record, index) => {
    if (y > 690) {
      pdf.addPage();
      y = 54;
    }

    pdf.setFillColor(index % 2 === 0 ? 239 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 249 : 255);
    pdf.roundedRect(margin, y - 18, pageWidth - margin * 2, 42 + state.selectedFields.length * 18, 8, 8, "F");
    pdf.setTextColor(21, 42, 91);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(`${record.doctor} - ${record.patient}`, margin + 16, y);
    y += 22;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    state.selectedFields.forEach((fieldKey) => {
      const field = fields.find((item) => item.key === fieldKey);
      const rawValue = fieldKey === "cost" ? formatCurrency(record[fieldKey]) : fieldKey === "received" || fieldKey === "due" ? formatDate(record[fieldKey]) : record[fieldKey];
      pdf.setTextColor(93, 104, 126);
      pdf.text(`${field.label}:`, margin + 16, y);
      pdf.setTextColor(20, 32, 38);
      pdf.text(String(rawValue || "-"), margin + 112, y);
      y += 18;
    });

    y += 22;
  });

  pdf.save(`mydenthub-export-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function getLogoDataUrl() {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve("");
    image.src = logoPath;
  });
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

elements.logoutButton.addEventListener("click", logout);

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $$(".page").forEach((page) => page.classList.remove("active-page"));
    $(`#${button.dataset.page}Page`).classList.add("active-page");
    elements.pageTitle.textContent = button.textContent;
    if (button.dataset.page === "data") renderExportControls();
  });
});

elements.addRecordButton.addEventListener("click", () => showRecordForm());
elements.cancelRecordButton.addEventListener("click", hideRecordForm);
elements.recordForm.addEventListener("submit", saveRecord);

elements.recordsTable.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) showRecordForm(state.records.find((record) => record.id === editId));
  if (deleteId) deleteRecord(deleteId);
});

elements.doctorFilter.addEventListener("change", renderExportControls);
elements.fieldChooser.addEventListener("change", () => {
  state.selectedFields = $$("#fieldChooser input:checked").map((input) => input.value);
});
elements.recordChooser.addEventListener("change", () => {
  state.selectedRecordIds = $$("#recordChooser input:checked").map((input) => input.value);
});
elements.downloadPdfButton.addEventListener("click", downloadPdf);

elements.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.profile = {
    displayName: elements.displayNameInput.value.trim(),
    role: elements.roleInput.value.trim(),
    organization: elements.organizationInput.value.trim(),
  };
  saveProfile();
  renderUser();
});

$$(".theme-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    applyTheme();
    saveProfile();
    renderAll();
  });
});

const existingSession = localStorage.getItem(`${storagePrefix}:session`);
if (!existingSession) {
  window.location.href = "index.html";
} else {
  state.user = JSON.parse(existingSession);
  loadUserData();
  applyTheme();
  renderAll();
}
