# Nova OS v6.3 — Deployment Tutorial

This release moves authentication from homegrown plaintext passwords to **Firebase Auth**, and locks down Firestore with proper security rules.

There are **three things you need to do** on the Firebase side. Steps below are click-by-click.

---

## Step 1 — Enable Email/Password sign-in (2 min)

Firebase Auth needs to know which sign-in method we're using.

1. Open the [Firebase Console](https://console.firebase.google.com/)
2. Pick your Nova OS project
3. Left sidebar → **Authentication**
4. If you've never opened it: click **Get started**
5. Tab: **Sign-in method**
6. Find **Email/Password** in the provider list → click it
7. Toggle **Enable** on (top toggle, "Email/Password")
8. Leave "Email link (passwordless sign-in)" OFF
9. Click **Save**

Done. Firebase will now accept `signInWithEmailAndPassword()` calls.

> **Why this is needed:** without it, every login attempt fails with `auth/operation-not-allowed`. New users can't register and existing users can't migrate.

---

## Step 2 — Deploy the Firestore security rules (3 min)

The rules file is at the repo root: `firestore.rules`. You have two options.

### Option A — paste into Firebase Console (no CLI needed)

1. Firebase Console → **Firestore Database** → tab **Rules**
2. Open `firestore.rules` from this repo
3. Copy the entire contents and paste into the rules editor
4. Click **Publish**
5. Wait ~30 seconds for the rules to propagate

### Option B — deploy via Firebase CLI (recommended if you'll iterate)

```bash
# one-time setup
npm install -g firebase-tools
firebase login
firebase init firestore   # accept defaults; it'll find firestore.rules

# every time you want to deploy
firebase deploy --only firestore:rules
```

> **What changes immediately:** existing pre-6.3 plaintext-password reads stop working *except* through the migration path the new auth code uses. Unauthenticated wide-open reads/writes are blocked. If you have any browser tabs still open with v6.2 code, they'll start failing — refresh them.

---

## Step 3 — Sign NovaMod in once, then promote them to mod (5 min)

The new rules check `request.auth.uid` for the moderator. Right now, no UIDs are in the `nova_mods` collection, so even after NovaMod signs in, the 🛡 delete buttons in chat will only work for their own messages.

Here's the bootstrap:

1. **Open Nova OS in a browser** (your deployed build)
2. **Sign in as NovaMod** with the existing password
   - The OS will silently migrate the account to Firebase Auth — you'll see a toast that says *"Account secured ✓ — upgraded to Firebase Auth"*
   - Behind the scenes: a Firebase Auth user was created at `novamod@nova.local`, your data doc was stamped with the new uid, and the plaintext password doc was deleted
3. **Note the UID:**
   - Firebase Console → **Authentication** → tab **Users**
   - Find the row with email `novamod@nova.local`
   - Copy the value in the **User UID** column (looks like `xK9aB...28xy`, 28 chars)
4. **Create the mod doc:**
   - Firebase Console → **Firestore Database** → tab **Data**
   - At the top-level, click **+ Start collection**
   - Collection ID: `nova_mods`
   - For the first document, **Document ID:** paste the UID you copied
   - Add one field: `username` (string) → `NovaMod` (just for human readability — rules don't check it)
   - Optionally add `addedAt` (string) → today's date
   - Click **Save**

NovaMod's mod-delete button will start working as soon as the next chat message renders. (You can verify by opening chat — the **MOD** badge in the header confirms the client-side check; the 🛡 button next to someone else's message confirms the server-side rule.)

> **To add more moderators later:** add their username to `ADMINS` in `src/lib/moderation.js` (UI badge + 🛡 button), redeploy the app, have them log in once, then add their UID under `nova_mods` (rule enforcement).
>
> **To revoke moderator status:** delete the relevant `nova_mods/<uid>` doc and remove their username from `ADMINS`.

---

## Verification checklist

After steps 1–3 are done, in this order:

- [ ] **New user registration** works (try registering `testuser` / `password123`)
- [ ] **Existing user login** works and shows the *"Account secured"* toast on first 6.3 login
- [ ] **Logout** works (no errors in console)
- [ ] **Chat send** works as any user
- [ ] **Chat delete own message** works as any user (✕ button)
- [ ] **Chat delete other user's message** is rejected for non-mods
- [ ] **Chat delete other user's message** works for NovaMod (🛡 button + confirm dialog)
- [ ] **Browser DevTools console** is clean — no `PERMISSION_DENIED` errors during normal use

If you see `PERMISSION_DENIED`:
- Hit Refresh once — old client state can be stale
- Check that your account migrated (sign out, sign back in)
- Check that the doc in question has a `uid` field matching your auth uid (Firestore Console can show you)

---

## What changed under the hood (for your reference)

**New files:**
- `src/lib/auth.js` — Firebase Auth wrapper with legacy-password migration
- `firestore.rules` — security rules

**Updated files:**
- `src/firebase.js` — already exported `auth`, no change needed
- `src/lib/db.js` — every Firestore write now stamps the caller's uid
- `src/NovaOS.jsx` — auth flow goes through `auth.js`; tracks `uid` alongside `user`
- `src/apps/ChatApp.jsx` — messages stamped with sender's uid
- `src/apps/StoreApp.jsx` — submissions and ratings stamped with uid
- `src/lib/moderation.js` — added cross-reference comment about `nova_mods`

**No data loss:** existing accounts migrate transparently on first login. The plaintext password doc gets deleted as the last step of migration, so there are zero plaintext passwords in Firestore after everyone signs in once.

**Password length:** Firebase requires passwords ≥ 6 characters. If any pre-6.3 account had a shorter password, that account will fail migration with a helpful error message asking them to contact a mod. (You can manually reset their password via the Firebase Console → Authentication → Users → Reset password.)

---

## Rolling back

If something goes wrong, you can revert to wide-open rules temporarily:

```
// In Firebase Console → Firestore → Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

Then `git checkout main` on the `nova-6-2` tag and redeploy the client. **Don't leave open rules in place** — it's a development-only fallback.
