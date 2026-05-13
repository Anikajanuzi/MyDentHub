const firebaseConfig = window.mydenthubFirebaseConfig || {};
const storagePrefix = "mydenthub";
const $ = (selector) => document.querySelector(selector);

const text = {
  firebaseLocal: "Firebase is not configured, so email accounts work only on this device for now.",
  firebaseGoogleSetup: "Add your Firebase web config in firebase-config.js to enable real Google sign-in.",
  accountCreated: "Account created. You are signed in. Check your email later to verify the account.",
  localAccountCreated: "Account created. You can now log in with this email and password.",
  verifyFirst: "Please verify your email first. A new verification email was sent.",
  accountExists: "An account already exists for this email on this device. Use the Log in section.",
  noLocalAccount: "No local account exists for this email yet. Create an account first.",
  passwordMismatch: "That password does not match this MyDentHub account.",
  passwordHint: "Use 8+ characters with uppercase, lowercase, number, and symbol.",
  passwordStrong: "Strong password. You are ready.",
  passwordWeak: "Password must be stronger: use 8+ characters with uppercase, lowercase, a number, and a symbol.",
  genericError: "Something went wrong. Please try again.",
};

const elements = {
  loginForm: $("#loginForm"),
  createForm: $("#createForm"),
  loginEmailInput: $("#loginEmailInput"),
  loginPasswordInput: $("#loginPasswordInput"),
  createEmailInput: $("#createEmailInput"),
  createPasswordInput: $("#createPasswordInput"),
  rememberEmailInput: $("#rememberEmailInput"),
  createStrengthBar: $("#createStrengthBar"),
  createStrengthText: $("#createStrengthText"),
  googleLoginButton: $("#googleLoginButton"),
  firebaseNotice: $("#firebaseNotice"),
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
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

async function signInWithGoogle() {
  try {
    if (!hasFirebaseConfig()) {
      elements.firebaseNotice.textContent = text.firebaseGoogleSetup;
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
  } catch (error) {
    elements.firebaseNotice.textContent = error.message || text.genericError;
  }
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

function updateCreateStrength() {
  const password = elements.createPasswordInput.value;
  const score = scorePassword(password);
  elements.createStrengthBar.style.width = `${Math.min(score * 20, 100)}%`;
  elements.createStrengthBar.style.background = score >= 5 ? "#49b9ae" : score >= 3 ? "#8b84d7" : "#c7463b";
  elements.createStrengthText.textContent = password ? score >= 5 ? text.passwordStrong : text.passwordWeak : text.passwordHint;
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

function rememberEmail(email) {
  if (elements.rememberEmailInput.checked) {
    localStorage.setItem(`${storagePrefix}:lastEmail`, email);
  } else {
    localStorage.removeItem(`${storagePrefix}:lastEmail`);
  }
}

function enterDashboard(user) {
  localStorage.setItem(`${storagePrefix}:session`, JSON.stringify(user));
  localStorage.setItem(`${storagePrefix}:lastEmail`, user.email);
  window.location.href = "dashboard.html";
}

async function handleLogin(event) {
  event.preventDefault();
  const email = elements.loginEmailInput.value.trim().toLowerCase();
  const password = elements.loginPasswordInput.value;

  try {
    const firebase = await getFirebaseAuth();
    if (firebase) {
      const credential = await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
      rememberEmail(email);
      enterDashboard({
        id: credential.user.uid,
        name: credential.user.displayName || email.split("@")[0],
        email,
        authType: "firebase",
      });
      return;
    }

    const storedAccount = JSON.parse(localStorage.getItem(accountKey(email)) || "null");
    if (!storedAccount) {
      elements.firebaseNotice.textContent = text.noLocalAccount;
      return;
    }

    const passwordHash = await hashPassword(email, password);
    if (storedAccount.passwordHash !== passwordHash) {
      elements.firebaseNotice.textContent = text.passwordMismatch;
      return;
    }

    rememberEmail(email);
    enterDashboard({ id: `local:${email}`, name: email.split("@")[0], email, authType: "local" });
  } catch (error) {
    elements.firebaseNotice.textContent = error.message || text.genericError;
  }
}

async function handleCreateAccount(event) {
  event.preventDefault();
  const email = elements.createEmailInput.value.trim().toLowerCase();
  const password = elements.createPasswordInput.value;

  try {
    if (scorePassword(password) < 5) {
      elements.firebaseNotice.textContent = text.passwordWeak;
      updateCreateStrength();
      return;
    }

    const firebase = await getFirebaseAuth();
    if (firebase) {
      const credential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
      firebase.sendEmailVerification(credential.user).catch(() => {});
      rememberEmail(email);
      enterDashboard({
        id: credential.user.uid,
        name: credential.user.displayName || email.split("@")[0],
        email,
        authType: "firebase",
      });
      return;
    }

    if (localStorage.getItem(accountKey(email))) {
      elements.firebaseNotice.textContent = text.accountExists;
      return;
    }

    const passwordHash = await hashPassword(email, password);
    localStorage.setItem(accountKey(email), JSON.stringify({
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    }));
    enterDashboard({ id: `local:${email}`, name: email.split("@")[0], email, authType: "local" });
  } catch (error) {
    elements.firebaseNotice.textContent = error.message || text.genericError;
  }
}

elements.loginForm.addEventListener("submit", handleLogin);
elements.createForm.addEventListener("submit", handleCreateAccount);
elements.createPasswordInput.addEventListener("input", updateCreateStrength);
elements.googleLoginButton.addEventListener("click", signInWithGoogle);

if (localStorage.getItem(`${storagePrefix}:session`)) {
  window.location.href = "dashboard.html";
}

const rememberedEmail = localStorage.getItem(`${storagePrefix}:lastEmail`);
if (rememberedEmail) {
  elements.loginEmailInput.value = rememberedEmail;
  elements.createEmailInput.value = rememberedEmail;
}

if (!hasFirebaseConfig()) {
  elements.firebaseNotice.textContent = text.firebaseLocal;
}
updateCreateStrength();
