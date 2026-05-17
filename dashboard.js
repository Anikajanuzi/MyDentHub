const storagePrefix = "mydenthub";
const logoPath = "mydenthub-logo.png";
const firebaseConfig = window.mydenthubFirebaseConfig || {};
const supabaseConfig = window.mydenthubSupabaseConfig || {};
const passwordIterations = 210000;

const fields = [
  { key: "doctor", label: "Doctor" },
  { key: "technician", label: "Technician" },
  { key: "patient", label: "Patient" },
  { key: "prosthetic", label: "Prosthetic" },
  { key: "received", label: "Received" },
  { key: "due", label: "Due" },
  { key: "cost", label: "Cost" },
  { key: "notes", label: "Notes" },
];

const pageTitles = {
  home: "Home",
  data: "Data",
  profile: "Profile",
};

let state = {
  user: null,
  records: [],
  doctors: [],
  technicians: [],
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
  technicianInput: $("#technicianInput"),
  newTechnicianInput: $("#newTechnicianInput"),
  addTechnicianButton: $("#addTechnicianButton"),
  patientInput: $("#patientInput"),
  prostheticInput: $("#prostheticInput"),
  receivedInput: $("#receivedInput"),
  dueInput: $("#dueInput"),
  costInput: $("#costInput"),
  notesInput: $("#notesInput"),
  cancelRecordButton: $("#cancelRecordButton"),
  recordsTable: $("#recordsTable"),
  emptyState: $("#emptyState"),
  dataRecordCount: $("#dataRecordCount"),
  dataDoctorCount: $("#dataDoctorCount"),
  dataTotalCost: $("#dataTotalCost"),
  doctorFilter: $("#doctorFilter"),
  fieldChooser: $("#fieldChooser"),
  recordChooser: $("#recordChooser"),
  downloadPdfButton: $("#downloadPdfButton"),
  profileForm: $("#profileForm"),
  displayNameInput: $("#displayNameInput"),
  roleInput: $("#roleInput"),
  organizationInput: $("#organizationInput"),
  deleteAccountForm: $("#deleteAccountForm"),
  deletePasswordInput: $("#deletePasswordInput"),
  deleteConfirmPasswordInput: $("#deleteConfirmPasswordInput"),
  deleteAccountButton: $("#deleteAccountButton"),
  deleteAccountNotice: $("#deleteAccountNotice"),
};

function storageKey(suffix) {
  return `${storagePrefix}:${state.user.id}:${suffix}`;
}

function storageKeyForUser(userId, suffix) {
  return `${storagePrefix}:${userId}:${suffix}`;
}

function accountKey(email) {
  return `${storagePrefix}:account:${email.trim().toLowerCase()}`;
}

function userEmailKey() {
  return String(state.user?.email || state.user?.id || "user").trim().toLowerCase();
}

function userDocumentId() {
  return userEmailKey().replaceAll("/", "%2F");
}

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

function hasSupabaseConfig() {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase?.createClient);
}

function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  if (!window.mydenthubSupabaseClient) {
    window.mydenthubSupabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
  }
  return window.mydenthubSupabaseClient;
}

async function getCloudStore() {
  if (hasSupabaseConfig() && state.user.authType === "supabase") return null;
  if (!hasFirebaseConfig() || !["firebase", "google"].includes(state.user.authType)) return null;
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return {
    db: firestoreModule.getFirestore(app),
    ...firestoreModule,
  };
}

async function getFirebaseAuth() {
  if (!hasFirebaseConfig()) return null;
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return {
    auth: authModule.getAuth(app),
    ...authModule,
  };
}

async function hashPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const value = `mydenthub:${normalizedEmail}:${password}`;

  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `fallback-${hash}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPasswordRecord(email, password, account) {
  if (account?.passwordVersion !== "pbkdf2-sha256" || !account.passwordSalt || !window.crypto?.subtle) {
    return account?.passwordHash === await hashPassword(email, password);
  }

  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: new TextEncoder().encode(`${email.trim().toLowerCase()}:${account.passwordSalt}`),
    iterations: account.passwordIterations || passwordIterations,
    hash: "SHA-256",
  }, keyMaterial, 256);

  return account.passwordHash === bytesToHex(new Uint8Array(derivedBits));
}

async function loadUserData() {
  const supabaseClient = getSupabaseClient();
  if (supabaseClient && state.user.authType === "supabase") {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) throw authError || new Error("Please log in again.");

    const { data, error } = await supabaseClient
      .from("user_data")
      .select("records, doctors, technicians, profile, theme")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const localUserId = `local:${userEmailKey()}`;
      const localRecords = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "records")) || "[]");
      const localDoctors = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "doctors")) || "[]");
      const localTechnicians = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "technicians")) || "[]");
      const localProfile = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "profile")) || "{}");
      const localTheme = localStorage.getItem(storageKeyForUser(localUserId, "theme")) || "aqua";

      const initialData = {
        user_id: authData.user.id,
        email: userEmailKey(),
        records: localRecords,
        doctors: localDoctors,
        technicians: localTechnicians,
        profile: localProfile,
        theme: localTheme,
        updated_at: new Date().toISOString(),
      };
      const { error: insertError } = await supabaseClient.from("user_data").insert(initialData);
      if (insertError) throw insertError;
      state.records = initialData.records;
      state.doctors = initialData.doctors;
      state.technicians = initialData.technicians;
      state.profile = initialData.profile;
      state.theme = initialData.theme;
    } else {
      state.records = data.records || [];
      state.doctors = data.doctors || [];
      state.technicians = data.technicians || [];
      state.profile = data.profile || {};
      state.theme = data.theme || "aqua";
    }

    state.doctors = normalizeDoctors([...state.doctors, ...state.records.map((record) => record.doctor)]);
    state.technicians = normalizeNames([...state.technicians, ...state.records.map((record) => record.technician)]);
    state.selectedRecordIds = state.records.map((record) => record.id);
    state.selectedFields = fields.map((field) => field.key);
    return;
  }

  const cloud = await getCloudStore();
  if (cloud) {
    const docRef = cloud.doc(cloud.db, "users", userDocumentId());
    const snapshot = await cloud.getDoc(docRef);
    let data = snapshot.exists() ? snapshot.data() : {};

    if (!snapshot.exists() && state.user.id && state.user.id !== userDocumentId()) {
      const legacyRef = cloud.doc(cloud.db, "users", state.user.id);
      const legacySnapshot = await cloud.getDoc(legacyRef);
      if (legacySnapshot.exists()) {
        data = legacySnapshot.data();
        await cloud.setDoc(docRef, data, { merge: true });
      }
    }

    if (!data.records?.length && !data.doctors?.length && !data.technicians?.length) {
      const localUserId = `local:${userEmailKey()}`;
      const localRecords = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "records")) || "[]");
      const localDoctors = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "doctors")) || "[]");
      const localTechnicians = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "technicians")) || "[]");
      const localProfile = JSON.parse(localStorage.getItem(storageKeyForUser(localUserId, "profile")) || "{}");
      const localTheme = localStorage.getItem(storageKeyForUser(localUserId, "theme"));

      if (localRecords.length || localDoctors.length || localTechnicians.length || Object.keys(localProfile).length || localTheme) {
        data = {
          records: localRecords,
          doctors: localDoctors,
          technicians: localTechnicians,
          profile: localProfile,
          theme: localTheme || "aqua",
        };
        await cloud.setDoc(docRef, {
          ...data,
          email: userEmailKey(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }

    state.records = data.records || [];
    state.doctors = data.doctors || [];
    state.technicians = data.technicians || [];
    state.profile = data.profile || {};
    state.theme = data.theme || "aqua";
  } else {
    state.records = JSON.parse(localStorage.getItem(storageKey("records")) || "[]");
    state.doctors = JSON.parse(localStorage.getItem(storageKey("doctors")) || "[]");
    state.technicians = JSON.parse(localStorage.getItem(storageKey("technicians")) || "[]");
    state.profile = JSON.parse(localStorage.getItem(storageKey("profile")) || "{}");
    state.theme = localStorage.getItem(storageKey("theme")) || "aqua";
  }

  state.doctors = normalizeDoctors([...state.doctors, ...state.records.map((record) => record.doctor)]);
  state.technicians = normalizeNames([...state.technicians, ...state.records.map((record) => record.technician)]);
  state.selectedRecordIds = state.records.map((record) => record.id);
  state.selectedFields = fields.map((field) => field.key);
}

async function saveCloudData(partial) {
  const supabaseClient = getSupabaseClient();
  if (supabaseClient && state.user.authType === "supabase") {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) throw authError || new Error("Please log in again.");

    const payload = {
      user_id: authData.user.id,
      email: userEmailKey(),
      updated_at: new Date().toISOString(),
      ...partial,
    };
    const { error } = await supabaseClient.from("user_data").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    return true;
  }

  const cloud = await getCloudStore();
  if (!cloud) return false;
  await cloud.setDoc(cloud.doc(cloud.db, "users", userDocumentId()), {
    ...partial,
    email: userEmailKey(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return true;
}

async function saveRecords() {
  if (await saveCloudData({ records: state.records, doctors: state.doctors, technicians: state.technicians })) return;
  localStorage.setItem(storageKey("records"), JSON.stringify(state.records));
  localStorage.setItem(storageKey("doctors"), JSON.stringify(state.doctors));
  localStorage.setItem(storageKey("technicians"), JSON.stringify(state.technicians));
}

async function saveProfile() {
  if (await saveCloudData({ profile: state.profile, theme: state.theme })) return;
  localStorage.setItem(storageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(storageKey("theme"), state.theme);
}

function clearLocalUserData(userId) {
  ["records", "doctors", "technicians", "profile", "theme"].forEach((suffix) => {
    localStorage.removeItem(storageKeyForUser(userId, suffix));
  });
}

function clearSessionAndRedirect() {
  const email = userEmailKey();
  sessionStorage.removeItem(`${storagePrefix}:session`);
  localStorage.removeItem(`${storagePrefix}:session`);
  if (localStorage.getItem(`${storagePrefix}:lastEmail`) === email) {
    localStorage.removeItem(`${storagePrefix}:lastEmail`);
  }
  window.location.href = "index.html";
}

async function deleteCloudUserData() {
  const supabaseClient = getSupabaseClient();
  if (supabaseClient && state.user.authType === "supabase") {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) throw authError || new Error("Please log in again.");
    const { error } = await supabaseClient.from("user_data").delete().eq("user_id", authData.user.id);
    if (error) throw error;
    return;
  }

  const cloud = await getCloudStore();
  if (!cloud) return;

  await cloud.deleteDoc(cloud.doc(cloud.db, "users", userDocumentId()));
  if (state.user.id && state.user.id !== userDocumentId()) {
    await cloud.deleteDoc(cloud.doc(cloud.db, "users", state.user.id)).catch(() => {});
  }
}

async function deleteLocalAccount(password) {
  const email = userEmailKey();
  const storedAccount = JSON.parse(localStorage.getItem(accountKey(email)) || "null");

  if (!storedAccount || !await verifyPasswordRecord(email, password, storedAccount)) {
    throw new Error("That password does not match this account.");
  }

  clearLocalUserData(state.user.id);
  clearLocalUserData(`local:${email}`);
  localStorage.removeItem(accountKey(email));
}

async function deleteFirebaseEmailAccount(password) {
  const firebase = await getFirebaseAuth();
  if (!firebase) throw new Error("Firebase is not configured for this account.");

  const credential = await firebase.signInWithEmailAndPassword(firebase.auth, userEmailKey(), password);
  await deleteCloudUserData();
  clearLocalUserData(state.user.id);
  clearLocalUserData(`local:${userEmailKey()}`);
  await firebase.deleteUser(credential.user);
}

async function deleteSupabaseAccountData(password) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) throw new Error("Supabase is not configured for this account.");

  const { error } = await supabaseClient.auth.signInWithPassword({ email: userEmailKey(), password });
  if (error) throw new Error("That password does not match this account.");

  await deleteCloudUserData();
  clearLocalUserData(state.user.id);
  clearLocalUserData(`local:${userEmailKey()}`);
  await supabaseClient.auth.signOut();
}

async function deleteAccount(event) {
  event.preventDefault();
  const password = elements.deletePasswordInput.value;
  const confirmPassword = elements.deleteConfirmPasswordInput.value;

  elements.deleteAccountNotice.textContent = "";

  if (!password || !confirmPassword) {
    elements.deleteAccountNotice.textContent = "Enter your password twice to delete the account.";
    return;
  }

  if (password !== confirmPassword) {
    elements.deleteAccountNotice.textContent = "The two passwords do not match.";
    return;
  }

  if (state.user.authType === "google") {
    elements.deleteAccountNotice.textContent = "Google sign-in accounts do not have a MyDentHub password. Use an email/password account to delete with a password.";
    return;
  }

  if (!confirm("Delete this account and all saved data? This cannot be undone.")) return;

  elements.deleteAccountButton.disabled = true;
  elements.deleteAccountButton.textContent = "Deleting...";

  try {
    if (state.user.authType === "supabase") {
      await deleteSupabaseAccountData(password);
    } else if (state.user.authType === "firebase") {
      await deleteFirebaseEmailAccount(password);
    } else {
      await deleteLocalAccount(password);
    }

    clearSessionAndRedirect();
  } catch (error) {
    elements.deleteAccountNotice.textContent = error.message || "Could not delete this account. Please try again.";
    elements.deleteAccountButton.disabled = false;
    elements.deleteAccountButton.textContent = "Delete account";
  }
}

function normalizeDoctors(doctors) {
  return normalizeNames(doctors);
}

function normalizeNames(names) {
  return [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function logout() {
  if (state.user?.authType === "supabase") {
    await getSupabaseClient()?.auth.signOut();
  }
  if (hasFirebaseConfig() && ["firebase", "google"].includes(state.user?.authType)) {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    await signOut(getAuth(app));
  }
  sessionStorage.removeItem(`${storagePrefix}:session`);
  localStorage.removeItem(`${storagePrefix}:session`);
  window.location.href = "index.html";
}

function readSession() {
  const session = sessionStorage.getItem(`${storagePrefix}:session`) || localStorage.getItem(`${storagePrefix}:session`);
  if (session && localStorage.getItem(`${storagePrefix}:session`)) {
    sessionStorage.setItem(`${storagePrefix}:session`, session);
    localStorage.removeItem(`${storagePrefix}:session`);
  }
  return session;
}

async function waitForFirebaseUser(firebase) {
  return new Promise((resolve) => {
    const unsubscribe = firebase.onAuthStateChanged(firebase.auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function validateSession() {
  if (state.user?.authType === "supabase") {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      clearSessionAndRedirect();
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data.user || data.user.email.trim().toLowerCase() !== userEmailKey()) {
      clearSessionAndRedirect();
      throw error || new Error("Your session expired. Please log in again.");
    }

    state.user = {
      ...state.user,
      id: data.user.id,
      email: data.user.email.trim().toLowerCase(),
      name: data.user.user_metadata?.display_name || state.user.name || data.user.email.split("@")[0],
    };
    return;
  }

  if (!hasFirebaseConfig() || !["firebase", "google"].includes(state.user?.authType)) return;

  const firebase = await getFirebaseAuth();
  const currentUser = await waitForFirebaseUser(firebase);
  const sessionEmail = userEmailKey();

  if (!currentUser?.email || currentUser.email.trim().toLowerCase() !== sessionEmail) {
    clearSessionAndRedirect();
    throw new Error("Your session expired. Please log in again.");
  }

  state.user = {
    ...state.user,
    id: currentUser.uid,
    email: currentUser.email.trim().toLowerCase(),
    name: currentUser.displayName || state.user.name || currentUser.email.split("@")[0],
  };
}

function renderUser(updateProfileInputs = true) {
  const profileName = state.profile.displayName || state.user.name || state.user.email;
  elements.userName.textContent = profileName;
  elements.userEmail.textContent = state.user.email;
  elements.userInitial.textContent = profileName.slice(0, 1).toUpperCase();
  if (!updateProfileInputs) return;
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
      <td>${escapeHtml(record.technician || "-")}</td>
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
  const totalCost = state.records.reduce((sum, record) => sum + Number(record.cost || 0), 0);
  elements.dataRecordCount.textContent = String(state.records.length);
  elements.dataDoctorCount.textContent = String(new Set(state.records.map((record) => record.doctor).filter(Boolean)).size);
  elements.dataTotalCost.textContent = formatCurrency(totalCost);

  const doctors = ["__all__", ...new Set(state.records.map((record) => record.doctor).filter(Boolean))];
  const selectedDoctor = elements.doctorFilter.value || "__all__";
  elements.doctorFilter.innerHTML = doctors.map((doctor) => {
    const label = doctor === "__all__" ? "All doctors" : doctor;
    return `<option value="${escapeHtml(doctor)}">${escapeHtml(label)}</option>`;
  }).join("");
  elements.doctorFilter.value = doctors.includes(selectedDoctor) ? selectedDoctor : "__all__";

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
      <label class="record-choice">
        <input type="checkbox" value="${record.id}" ${state.selectedRecordIds.includes(record.id) ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(record.patient || "Unnamed patient")}</strong>
          <small>${escapeHtml(record.doctor || "No doctor")} - ${escapeHtml(record.technician || "No technician")} - ${escapeHtml(record.prosthetic || "No prosthetic")}</small>
        </span>
      </label>
    `).join("")
    : `<p class="muted">No records match this doctor filter.</p>`;
}

function renderDoctorOptions(selectedDoctor = elements.doctorInput.value) {
  const options = state.doctors.length
    ? state.doctors.map((doctor) => `<option value="${escapeHtml(doctor)}">${escapeHtml(doctor)}</option>`).join("")
    : `<option value="">Add a doctor first</option>`;
  elements.doctorInput.innerHTML = options;
  if (state.doctors.includes(selectedDoctor)) elements.doctorInput.value = selectedDoctor;
}

function renderTechnicianOptions(selectedTechnician = elements.technicianInput.value) {
  const options = state.technicians.length
    ? state.technicians.map((technician) => `<option value="${escapeHtml(technician)}">${escapeHtml(technician)}</option>`).join("")
    : `<option value="">Add a technician first</option>`;
  elements.technicianInput.innerHTML = options;
  if (state.technicians.includes(selectedTechnician)) elements.technicianInput.value = selectedTechnician;
}

function renderThemeChoices() {
  $$(".theme-choice").forEach((button) => button.classList.toggle("active", button.dataset.theme === state.theme));
}

function renderAll() {
  renderUser();
  renderDoctorOptions();
  renderTechnicianOptions();
  renderRecords();
  renderExportControls();
  renderThemeChoices();
}

function readProfileInputs() {
  return {
    displayName: elements.displayNameInput.value.trim(),
    role: elements.roleInput.value.trim(),
    organization: elements.organizationInput.value.trim(),
  };
}

function filteredRecords() {
  const doctor = elements.doctorFilter.value;
  if (!doctor || doctor === "__all__") return state.records;
  return state.records.filter((record) => record.doctor === doctor);
}

function showRecordForm(record = null) {
  if (!state.doctors.length && !record) {
    elements.newDoctorInput.focus();
    alert("Add a doctor first, then create a patient record.");
    return;
  }

  if (!state.technicians.length && !record) {
    elements.newTechnicianInput.focus();
    alert("Add a technician first, then create a patient record.");
    return;
  }

  elements.recordForm.hidden = false;
  elements.recordId.value = record?.id || "";
  if (record?.doctor && !state.doctors.includes(record.doctor)) state.doctors = normalizeDoctors([...state.doctors, record.doctor]);
  if (record?.technician && !state.technicians.includes(record.technician)) state.technicians = normalizeNames([...state.technicians, record.technician]);
  renderDoctorOptions(record?.doctor || state.doctors[0] || "");
  renderTechnicianOptions(record?.technician || state.technicians[0] || "");
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
  const doctor = elements.doctorInput.value.trim();
  const technician = elements.technicianInput.value.trim();
  if (!doctor) {
    alert("Please add or select a doctor before saving this record.");
    elements.newDoctorInput.focus();
    return;
  }

  if (!technician) {
    alert("Please add or select a technician before saving this record.");
    elements.newTechnicianInput.focus();
    return;
  }

  const id = elements.recordId.value || crypto.randomUUID();
  const record = {
    id,
    doctor,
    technician,
    patient: elements.patientInput.value.trim(),
    prosthetic: elements.prostheticInput.value.trim(),
    received: elements.receivedInput.value,
    due: elements.dueInput.value,
    cost: elements.costInput.value,
    notes: elements.notesInput.value.trim(),
  };

  state.doctors = normalizeDoctors([...state.doctors, record.doctor]);
  state.technicians = normalizeNames([...state.technicians, record.technician]);
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
  if (!confirm("Delete this record?")) return;
  state.records = state.records.filter((record) => record.id !== id);
  state.selectedRecordIds = state.selectedRecordIds.filter((recordId) => recordId !== id);
  await saveRecords();
  renderAll();
}

async function addDoctor() {
  const doctor = elements.newDoctorInput.value.trim();
  if (!doctor) {
    elements.newDoctorInput.focus();
    return;
  }

  state.doctors = normalizeDoctors([...state.doctors, doctor]);
  elements.newDoctorInput.value = "";
  renderDoctorOptions(doctor);
  await saveRecords();
}

async function addTechnician() {
  const technician = elements.newTechnicianInput.value.trim();
  if (!technician) {
    elements.newTechnicianInput.focus();
    return;
  }

  state.technicians = normalizeNames([...state.technicians, technician]);
  elements.newTechnicianInput.value = "";
  renderTechnicianOptions(technician);
  await saveRecords();
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
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 48;
  let y = 148;

  function drawHeader() {
    pdf.setFillColor(21, 42, 91);
    pdf.rect(0, 0, pageWidth, 112, "F");
    pdf.setFillColor(73, 185, 174);
    pdf.rect(0, 104, pageWidth, 8, "F");
    if (logoData) pdf.addImage(logoData, "PNG", margin, 16, 128, 72);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("MyDentHub Case Export", margin + 148, 54);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Prepared for ${state.profile.displayName || state.user.email}`, margin + 148, 76);
    if (state.profile.organization) {
      pdf.text(`Organization: ${state.profile.organization}`, margin + 148, 92);
    }
  }

  drawHeader();

  selected.forEach((record, index) => {
    const selectedEntries = state.selectedFields.map((fieldKey) => {
      const field = fields.find((item) => item.key === fieldKey);
      const rawValue = formatPdfValue(record, fieldKey) || "-";
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      return {
        label: field.label,
        lines: pdf.splitTextToSize(String(rawValue), contentWidth - 144),
      };
    });
    const detailsHeight = selectedEntries.reduce((height, entry) => height + Math.max(entry.lines.length, 1) * 13 + 6, 0);
    const boxHeight = 46 + detailsHeight + 16;

    if (y + boxHeight > pageHeight - bottomMargin) {
      pdf.addPage();
      drawHeader();
      y = 148;
    }

    const boxTop = y;
    pdf.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 253 : 255, index % 2 === 0 ? 252 : 255);
    pdf.setDrawColor(190, 220, 221);
    pdf.setLineWidth(0.9);
    pdf.roundedRect(margin, boxTop, contentWidth, boxHeight, 8, 8, "FD");

    pdf.setTextColor(21, 42, 91);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(`${record.patient || "Unnamed patient"}`, margin + 16, y + 24);
    pdf.setTextColor(93, 104, 126);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`${record.doctor || "No doctor"} - ${record.technician || "No technician"} - ${record.prosthetic || "No prosthetic"}`, margin + 16, y + 40);

    y += 62;

    selectedEntries.forEach((entry) => {
      pdf.setTextColor(93, 104, 126);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${entry.label}:`, margin + 16, y);
      pdf.setTextColor(20, 32, 38);
      pdf.setFont("helvetica", "normal");
      pdf.text(entry.lines, margin + 112, y);
      y += Math.max(entry.lines.length, 1) * 13 + 6;
    });

    y = boxTop + boxHeight + 16;
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
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatPdfValue(record, fieldKey) {
  if (fieldKey === "cost") return formatCurrency(record[fieldKey]);
  if (fieldKey === "received" || fieldKey === "due") return formatDate(record[fieldKey]);
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
    elements.pageTitle.textContent = pageTitles[button.dataset.page] || button.textContent;
    if (button.dataset.page === "data") renderExportControls();
  });
});

elements.addRecordButton.addEventListener("click", () => showRecordForm());
elements.addDoctorButton.addEventListener("click", addDoctor);
elements.newDoctorInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDoctor();
  }
});
elements.addTechnicianButton.addEventListener("click", addTechnician);
elements.newTechnicianInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTechnician();
  }
});
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
  state.profile = readProfileInputs();
  await saveProfile();
  renderUser();
});

elements.deleteAccountForm.addEventListener("submit", deleteAccount);

$$(".theme-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.profile = readProfileInputs();
    state.theme = button.dataset.theme;
    applyTheme();
    saveProfile();
    renderThemeChoices();
    renderUser(false);
  });
});

const existingSession = readSession();
if (!existingSession) {
  window.location.href = "index.html";
} else {
  state.user = JSON.parse(existingSession);
  validateSession().then(loadUserData).then(() => {
    applyTheme();
    renderAll();
  }).catch((error) => {
    alert(error.message || "Could not load your saved data.");
    window.location.href = "index.html";
  });
}
