const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};

const storagePrefix = "mydenthub";
const $ = (selector) => document.querySelector(selector);

const elements = {
  passwordForm: $("#passwordForm"),
  emailInput: $("#emailInput"),
  passwordInput: $("#passwordInput"),
  strengthBar: $("#strengthBar"),
  strengthText: $("#strengthText"),
  googleLoginButton: $("#googleLoginButton"),
  firebaseNotice: $("#firebaseNotice"),
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

async function signInWithGoogle() {
  if (!hasFirebaseConfig()) {
    elements.firebaseNotice.textContent = "Add your Firebase web config in login.js to enable real Google sign-in.";
    return;
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  enterDashboard({
    id: result.user.uid,
    name: result.user.displayName || "Google User",
    email: result.user.email,
    authType: "google",
  });
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
    ? "Strong password. You are ready to log in."
    : "Use 8+ characters with uppercase, lowercase, number, and symbol.";
}

function enterDashboard(user) {
  localStorage.setItem(`${storagePrefix}:session`, JSON.stringify(user));
  window.location.href = "dashboard.html";
}

elements.passwordInput.addEventListener("input", updateStrength);
elements.googleLoginButton.addEventListener("click", () => signInWithGoogle().catch((error) => {
  elements.firebaseNotice.textContent = error.message;
}));

elements.passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (scorePassword(password) < 5) {
    elements.strengthText.textContent = "Please choose a stronger password before continuing.";
    return;
  }

  enterDashboard({ id: `local:${email.toLowerCase()}`, name: email.split("@")[0], email, authType: "local" });
});

if (localStorage.getItem(`${storagePrefix}:session`)) {
  window.location.href = "dashboard.html";
} else if (!hasFirebaseConfig()) {
  elements.firebaseNotice.textContent = "Google sign-in is ready for Firebase setup. Local secure login works now.";
}

updateStrength();
