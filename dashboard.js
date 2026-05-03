const storagePrefix = "mydenthub";
const logoPath = "mydenthub-logo.png";
const firebaseConfig = window.mydenthubFirebaseConfig || {};
const i18n = window.MyDentHubI18n;
const t = (key) => i18n.t(key);
const fields = [
  { key: "doctor", labelKey: "doctor" },
  { key: "patient", labelKey: "patient" },
  { key: "prosthetic", labelKey: "prosthetic" },
  { key: "received", labelKey: "received" },
  { key: "due", labelKey: "due" },
  { key: "cost", labelKey: "cost" },
  { key: "notes", labelKey: "notes" },
];

const prostheticTranslationKeys = {
  "Crown": "crown",
  "Bridge": "bridge",
  "Denture": "denture",
  "Partial denture": "partialDenture",
  "Implant crown": "implantCrown",
  "Implant bridge": "implantBridge",
  "Veneer": "veneer",
  "Night guard": "nightGuard",
  "Retainer": "retainer",
  "Temporary prosthetic": "temporaryProsthetic",
  "Repair": "repair",
  "Other": "other",
};

let state = {
  user: null,
  records: [],
  doctors: [],
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
  newDoctorInput: $("#newDoctorInput"),
  addDoctorButton: $("#addDoctorButton"),
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

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

async function getCloudStore() {
  if (!hasFirebaseConfig() || !["firebase", "google"].includes(state.user.authType)) return null;
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return {
    db: firestoreModule.getFirestore(app),
    ...firestoreModule,
  };
}

async function loadUserData() {
  const cloud = await getCloudStore();
  if (cloud) {
    const docRef = cloud.doc(cloud.db, "users", state.user.id);
    const snapshot = await cloud.getDoc(docRef);
    const data = snapshot.exists() ? snapshot.data() : {};
    state.records = data.records || [];
    state.doctors = data.doctors || [];
    state.profile = data.profile || {};
    state.theme = data.theme || "aqua";
  } else {
    state.records = JSON.parse(localStorage.getItem(storageKey("records")) || "[]");
    state.doctors = JSON.parse(localStorage.getItem(storageKey("doctors")) || "[]");
    state.profile = JSON.parse(localStorage.getItem(storageKey("profile")) || "{}");
    state.theme = localStorage.getItem(storageKey("theme")) || "aqua";
  }
  state.doctors = normalizeDoctors([...state.doctors, ...state.records.map((record) => record.doctor)]);
  state.selectedRecordIds = state.records.map((record) => record.id);
  state.selectedFields = fields.map((field) => field.key);
}

async function saveCloudData(partial) {
  const cloud = await getCloudStore();
  if (!cloud) return false;
  await cloud.setDoc(cloud.doc(cloud.db, "users", state.user.id), partial, { merge: true });
  return true;
}

async function saveRecords() {
  if (await saveCloudData({ records: state.records, doctors: state.doctors })) return;
  localStorage.setItem(storageKey("records"), JSON.stringify(state.records));
  localStorage.setItem(storageKey("doctors"), JSON.stringify(state.doctors));
}

async function saveProfile() {
  if (await saveCloudData({ profile: state.profile, theme: state.theme })) return;
  localStorage.setItem(storageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(storageKey("theme"), state.theme);
}

function normalizeDoctors(doctors) {
  return [...new Set(doctors.map((doctor) => String(doctor || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function logout() {
  if (hasFirebaseConfig() && ["firebase", "google"].includes(state.user?.authType)) {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    await signOut(getAuth(app));
  }
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
      <td>${escapeHtml(formatProsthetic(record.prosthetic))}</td>
      <td>${formatDate(record.received)}</td>
      <td>${formatDate(record.due)}</td>
      <td>${currency.format(Number(record.cost || 0))}</td>
      <td>
        <div class="row-actions">
          <button class="row-action" data-edit="${record.id}" type="button">${t("edit")}</button>
          <button class="row-action delete" data-delete="${record.id}" type="button">${t("delete")}</button>
        </div>
      </td>
    `;
    elements.recordsTable.append(row);
  });

  elements.emptyState.style.display = state.records.length ? "none" : "block";
}

function renderExportControls() {
  const doctors = ["__all__", ...new Set(state.records.map((record) => record.doctor).filter(Boolean))];
  const selectedDoctor = elements.doctorFilter.value || "__all__";
  elements.doctorFilter.innerHTML = doctors.map((doctor) => {
    const label = doctor === "__all__" ? t("allDoctors") : doctor;
    return `<option value="${escapeHtml(doctor)}">${escapeHtml(label)}</option>`;
  }).join("");
  elements.doctorFilter.value = doctors.includes(selectedDoctor) ? selectedDoctor : "__all__";

  elements.fieldChooser.innerHTML = fields.map((field) => `
    <label>
      <input type="checkbox" value="${field.key}" ${state.selectedFields.includes(field.key) ? "checked" : ""} />
      ${t(field.labelKey)}
    </label>
  `).join("");

  const filtered = filteredRecords();
  state.selectedRecordIds = state.selectedRecordIds.filter((id) => filtered.some((record) => record.id === id));
  if (!state.selectedRecordIds.length) state.selectedRecordIds = filtered.map((record) => record.id);

  elements.recordChooser.innerHTML = filtered.length
    ? filtered.map((record) => `
      <label>
        <input type="checkbox" value="${record.id}" ${state.selectedRecordIds.includes(record.id) ? "checked" : ""} />
        ${escapeHtml(record.doctor)} - ${escapeHtml(record.patient)} - ${escapeHtml(formatProsthetic(record.prosthetic))}
      </label>
    `).join("")
    : `<p class="muted">${t("noDoctorRecords")}</p>`;
}

function renderAll() {
  renderUser();
  renderDoctorOptions();
  renderRecords();
  renderExportControls();
  $$(".theme-choice").forEach((button) => button.classList.toggle("active", button.dataset.theme === state.theme));
}

function renderDoctorOptions(selectedDoctor = elements.doctorInput.value) {
  const options = state.doctors.length
    ? state.doctors.map((doctor) => `<option value="${escapeHtml(doctor)}">${escapeHtml(doctor)}</option>`).join("")
    : `<option value="">${t("addDoctorFirst")}</option>`;
  elements.doctorInput.innerHTML = options;
  if (state.doctors.includes(selectedDoctor)) elements.doctorInput.value = selectedDoctor;
}

function filteredRecords() {
  const doctor = elements.doctorFilter.value;
  if (!doctor || doctor === "__all__") return state.records;
  return state.records.filter((record) => record.doctor === doctor);
}

function showRecordForm(record = null) {
  elements.recordForm.hidden = false;
  elements.recordId.value = record?.id || "";
  if (record?.doctor && !state.doctors.includes(record.doctor)) state.doctors = normalizeDoctors([...state.doctors, record.doctor]);
  renderDoctorOptions(record?.doctor || state.doctors[0] || "");
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

async function saveRecord(event) {
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
  state.doctors = normalizeDoctors([...state.doctors, record.doctor]);

  const existingIndex = state.records.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = record;
  } else {
    state.records.push(record);
  }

  await saveRecords();
  hideRecordForm();
  renderAll();
}

async function deleteRecord(id) {
  if (!confirm(t("deleteConfirm"))) return;
  state.records = state.records.filter((record) => record.id !== id);
  state.selectedRecordIds = state.selectedRecordIds.filter((recordId) => recordId !== id);
  await saveRecords();
  renderAll();
}

async function addDoctor() {
  const doctor = elements.newDoctorInput.value.trim();
  if (!doctor) return;
  state.doctors = normalizeDoctors([...state.doctors, doctor]);
  elements.newDoctorInput.value = "";
  renderDoctorOptions(doctor);
  await saveRecords();
}

async function downloadPdf() {
  if (!window.jspdf) {
    alert(t("pdfLoading"));
    return;
  }

  const selected = filteredRecords().filter((record) => state.selectedRecordIds.includes(record.id));
  if (!selected.length) {
    alert(t("chooseOneRecord"));
    return;
  }

  if (!state.selectedFields.length) {
    alert(t("chooseOneField"));
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
  if (logoData) pdf.addImage(logoData, "PNG", margin, 16, 128, 72);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(t("pdfTitle"), margin + 148, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`${t("preparedFor")} ${state.profile.displayName || state.user.email}`, margin + 148, y + 22);
  if (state.profile.organization) {
    pdf.text(`${t("organization")}: ${state.profile.organization}`, margin + 148, y + 38);
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
      const rawValue = formatPdfValue(record, fieldKey);
      pdf.setTextColor(93, 104, 126);
      pdf.text(`${t(field.labelKey)}:`, margin + 16, y);
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
      const sourceX = image.naturalWidth * 0.08;
      const sourceY = image.naturalHeight * 0.16;
      const sourceWidth = image.naturalWidth * 0.84;
      const sourceHeight = image.naturalHeight * 0.52;
      canvas.width = Math.round(sourceWidth);
      canvas.height = Math.round(sourceHeight);
      const context = canvas.getContext("2d");
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
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
  const locale = i18n.getLanguage() === "sq" ? "sq-AL" : undefined;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatProsthetic(value) {
  return prostheticTranslationKeys[value] ? t(prostheticTranslationKeys[value]) : value;
}

function formatPdfValue(record, fieldKey) {
  if (fieldKey === "cost") return formatCurrency(record[fieldKey]);
  if (fieldKey === "received" || fieldKey === "due") return formatDate(record[fieldKey]);
  if (fieldKey === "prosthetic") return formatProsthetic(record[fieldKey]);
  return record[fieldKey];
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
    elements.pageTitle.dataset.pageTitleKey = button.dataset.page;
    elements.pageTitle.textContent = t(button.dataset.page);
    if (button.dataset.page === "data") renderExportControls();
  });
});

elements.addRecordButton.addEventListener("click", () => showRecordForm());
elements.addDoctorButton.addEventListener("click", addDoctor);
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

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.profile = {
    displayName: elements.displayNameInput.value.trim(),
    role: elements.roleInput.value.trim(),
    organization: elements.organizationInput.value.trim(),
  };
  await saveProfile();
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
i18n.applyTranslations();

if (!existingSession) {
  window.location.href = "index.html";
} else {
  state.user = JSON.parse(existingSession);
  loadUserData().then(() => {
    applyTheme();
    elements.pageTitle.textContent = t(elements.pageTitle.dataset.pageTitleKey || "home");
    renderAll();
  }).catch((error) => {
    alert(error.message || t("couldNotLoad"));
    window.location.href = "index.html";
  });
}
