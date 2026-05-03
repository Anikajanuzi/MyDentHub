# MyDentHub

A private, browser-based dental work organizer with:

- Separate login page: `index.html`.
- Separate logged-in workspace: `dashboard.html`.
- Firebase Google sign-in support.
- Firebase email/password account support with email verification.
- Local strong-password access for personal use.
- Local accounts remember saved data by email and verify the same password on future logins on the same device.
- Cloud records, profile, doctors, and theme sync across devices when Firebase Firestore is configured.
- Side navigation for Home, Data, and Profile.
- Add, edit, and delete doctor case records.
- Doctor, patient, prosthetic type, received date, due date, cost, and notes fields.
- Selective PDF export by doctor, record, and field.
- Profile settings and saved theme choices, including Light, Aqua, Lavender, Midnight, and Dark.
- MyDentHub logo branding in the app and exported PDFs.

## Open the App

Open `index.html` in a browser.

For Google sign-in, run the site from `localhost` or a deployed domain after Firebase is configured. The local password login can be used by opening the file directly.

## Enable Real Google Accounts

Google accounts do not let third-party websites set a user's real Google password. This app supports real Google sign-in through Firebase Authentication.

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Open Authentication, then enable the Google provider.
3. Add your local domain or deployed domain under authorized domains.
4. Copy the Firebase web app config.
5. Paste it into `firebase-config.js`.
6. In Firebase Authentication, enable Google and Email/Password providers.
7. In Firestore Database, create a database for cross-device saved data.

```js
window.mydenthubFirebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "your-app-id",
};
```

## Storage Note

Without Firebase, records are stored in the browser's `localStorage` under each signed-in user, so they stay on the same device. Local passwords are not stored as plain text; the app stores a password hash for matching future logins. With Firebase configured, records, doctors, profile, and theme save to Firestore so the same verified account can access them from another device.
