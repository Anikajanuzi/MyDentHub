# MyDentHub

A private, browser-based dental work organizer with:

- Separate login page: `index.html`.
- Separate logged-in workspace: `dashboard.html`.
- Firebase Google sign-in support.
- Firebase email/password account support with email verification.
- Supabase email/password account support for cross-device saved data.
- Local strong-password access for personal use.
- Local accounts remember saved data by email and verify the same password on future logins on the same device.
- Cloud records, profile, doctors, and theme sync across devices when Firebase Firestore is configured.
- Side navigation for Home, Data, and Profile.
- Add, edit, and delete doctor case records.
- Doctor, patient, prosthetic type, received date, due date, cost, and notes fields.
- Selective PDF export by doctor, record, and field.
- Profile settings and saved theme choices, including Light, Aqua, Lavender, Midnight, and Dark.
- MyDentHub logo branding in the app and exported PDFs.
- Basic browser hardening with a Content Security Policy and referrer policy.
- Firestore security rules for email-owned user documents.

## Open the App

Open `index.html` in a browser.

For Google sign-in, run the site from `localhost` or a deployed domain after Firebase is configured. The local password login can be used by opening the file directly.

## Enable Supabase Cross-Device Accounts

Supabase is the recommended setup if you want the same email account to work across phones, tablets, and computers.

1. Create a Supabase project.
2. Open the SQL editor and run `supabase-schema.sql`.
3. Open Project Settings, then API.
4. Copy the Project URL and public anon key into `supabase-config.js`.
5. In Authentication, enable Email provider.
6. In Authentication URL settings, add your Vercel site URL.

```js
window.mydenthubSupabaseConfig = {
  url: "https://your-project.supabase.co",
  anonKey: "your-public-anon-key",
};
```

Never put the Supabase `service_role` key in this website or in a public Vercel environment variable.

## Enable Real Google Accounts

Google accounts do not let third-party websites set a user's real Google password. This app supports real Google sign-in through Firebase Authentication.

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Open Authentication, then enable the Google provider.
3. Add your local domain or deployed domain under authorized domains.
4. Copy the Firebase web app config.
5. Paste it into `firebase-config.js`.
6. In Firebase Authentication, enable Google and Email/Password providers.
7. In Firestore Database, create a database for cross-device saved data.
8. Publish `firestore.rules` in Firebase so each signed-in account can only read and write its own saved data.

```js
window.mydenthubFirebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "your-app-id",
};
```

## Storage Note

Without Supabase or Firebase, records are stored in the browser's `localStorage` under each signed-in user, so they stay on the same device. Local passwords are not stored as plain text; new local accounts use a salted PBKDF2 password hash, and older local accounts are upgraded after a successful login. With Supabase configured, records, doctors, technicians, profile, and theme save to Supabase so the same email account can access them from another device. With Firebase configured, those same fields save to Firestore.

## Security Note

For real account security, deploy the app over HTTPS and use Supabase with the included `supabase-schema.sql` RLS policies, or configure Firebase Authentication and publish the included `firestore.rules`. Local-only accounts are useful for one-device personal use, but browser storage can be cleared or inspected by someone with access to that device.
