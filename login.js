const firebaseConfig = window.mydenthubFirebaseConfig || {};
const storagePrefix = "mydenthub";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const i18n = window.MyDentHubI18n;
const t = (key) => i18n.t(key);

const elements = {
  passwordForm: $("#passwordForm"),
  emailInput: $("#emailInput"),
  passwordInput: $("#passwordInput"),
  rememberEmailInput: $("#rememberEmailInput"),
  authSubmitButton: $("#authSubmitButton"),
  strengthBar: $("#strengthBar"),
  strengthText: $("#strengthText"),
  googleLoginButton: $("#googleLoginButton"),
  firebaseNotice: $("#firebaseNotice"),
};

let authMode = "login";

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

async function signInWithGoogle() {
  if (!hasFirebaseConfig()) {
    elements.firebaseNotice.textContent = t("firebaseGoogleSetup");
    return;
  }

  const firebase = await getFirebaseAuth();
  const provider = new firebase.GoogleAuthProvider();
  const result = await firebase.signInWithPopup(firebase.auth, provider);
  enterDashboard({
    id: result.user.uid,
    name: result.user.displayName || "Google User",
    email: result.user.email,
    authType: "google",
  });
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

function scorePassword(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function updateStrength() {
  const score = scorePassword(elements.passwordInput.value);
  elements.strengthBar.style.width = `${Math.min(score * 20, 100)}%`;
  elements.strengthBar.style.background = score >= 5 ? "#49b9ae" : score >= 3 ? "#8b84d7" : "#c7463b";
  elements.strengthText.textContent = score >= 5
    ? t("passwordStrong")
    : t("passwordWeak");
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

function accountKey(email) {
  return `${storagePrefix}:account:${email.trim().toLowerCase()}`;
}

function enterDashboard(user) {
  localStorage.setItem(`${storagePrefix}:session`, JSON.stringify(user));
  localStorage.setItem(`${storagePrefix}:lastEmail`, user.email);
  window.location.href = "dashboard.html";
}

function setAuthMode(mode) {
  authMode = mode;
  $$(".auth-tab").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  elements.authSubmitButton.textContent = mode === "create" ? t("createAccount") : t("login");
  elements.passwordInput.autocomplete = mode === "create" ? "new-password" : "current-password";
  elements.firebaseNotice.textContent = hasFirebaseConfig()
    ? mode === "create"
      ? t("createVerify")
      : t("loginVerified")
    : t("firebaseLocal");
  updateStrength();
}

elements.passwordInput.addEventListener("input", updateStrength);
$$(".auth-tab").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});
elements.googleLoginButton.addEventListener("click", () => signInWithGoogle().catch((error) => {
  elements.firebaseNotice.textContent = error.message;
}));

elements.passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  const normalizedEmail = email.toLowerCase();

  try {
    if (scorePassword(password) < 5) {
      elements.strengthText.textContent = t("passwordWeak");
      return;
    }

    const firebase = await getFirebaseAuth();
    if (firebase) {
      if (authMode === "create") {
        const credential = await firebase.createUserWithEmailAndPassword(firebase.auth, normalizedEmail, password);
        await firebase.sendEmailVerification(credential.user);
        elements.firebaseNotice.textContent = t("accountCreated");
        return;
      }

      const credential = await firebase.signInWithEmailAndPassword(firebase.auth, normalizedEmail, password);
      if (!credential.user.emailVerified) {
        await firebase.sendEmailVerification(credential.user);
        elements.firebaseNotice.textContent = t("verifyFirst");
        await firebase.signOut(firebase.auth);
        return;
      }

      enterDashboard({
        id: credential.user.uid,
        name: credential.user.displayName || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        authType: "firebase",
      });
      return;
    }

    const storedAccount = JSON.parse(localStorage.getItem(accountKey(email)) || "null");
    const passwordHash = await hashPassword(email, password);

    if (authMode === "create" && storedAccount) {
      elements.strengthText.textContent = t("accountExists");
      return;
    }

    if (authMode === "login" && !storedAccount) {
      elements.strengthText.textContent = t("noLocalAccount");
      return;
    }

    if (storedAccount && storedAccount.passwordHash !== passwordHash) {
      elements.strengthText.textContent = t("passwordMismatch");
      return;
    }

    if (authMode === "create") {
      localStorage.setItem(accountKey(email), JSON.stringify({
        email: normalizedEmail,
        passwordHash,
        createdAt: new Date().toISOString(),
      }));
    }

    if (elements.rememberEmailInput.checked) {
      localStorage.setItem(`${storagePrefix}:lastEmail`, normalizedEmail);
    } else {
      localStorage.removeItem(`${storagePrefix}:lastEmail`);
    }

    enterDashboard({ id: `local:${normalizedEmail}`, name: normalizedEmail.split("@")[0], email: normalizedEmail, authType: "local" });
  } catch (error) {
    elements.firebaseNotice.textContent = error.message || t("genericError");
  }
});

if (localStorage.getItem(`${storagePrefix}:session`)) {
  window.location.href = "dashboard.html";
} else if (!hasFirebaseConfig()) {
  elements.firebaseNotice.textContent = t("firebaseLocal");
}

const rememberedEmail = localStorage.getItem(`${storagePrefix}:lastEmail`);
if (rememberedEmail) {
  elements.emailInput.value = rememberedEmail;
}

i18n.bindLanguageControls();
window.addEventListener("mydenthub:languagechange", () => setAuthMode(authMode));
updateStrength();
setAuthMode("login");
