# MyDentHub

A private, browser-based dental work organizer with:

- Separate login page: `index.html`.
- Separate logged-in workspace: `dashboard.html`.
- Firebase Google sign-in support.
- Local strong-password access for personal use.
- Side navigation for Home, Data, and Profile.
- Add, edit, and delete doctor case records.
- Doctor, patient, prosthetic type, received date, due date, cost, and notes fields.
- Selective PDF export by doctor, record, and field.
- Profile settings and theme choices.
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
5. Paste it into `firebaseConfig` at the top of `login.js`.

```js
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "your-app-id",
};
```

## Storage Note

The current version stores records in the browser's `localStorage` under each signed-in user. For use by many people across different devices, connect the app to a database such as Firebase Firestore.
