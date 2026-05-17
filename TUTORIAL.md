# NOVA OS v2.0 — Deployment & Dev Guide

Everything you need to get NOVA OS running as a real website, and how to build v3.0.

---

## What You'll Need

- **Node.js** (v18 or later) — download at https://nodejs.org (pick "LTS")
- **A GitHub account** — https://github.com (free)
- **A Vercel account** — https://vercel.com (free, sign in with GitHub)
- **A Firebase account** — https://firebase.google.com (free, sign in with Google)
- A code editor — **VS Code** is recommended: https://code.visualstudio.com

---

## Part 1 — Set Up the Project Locally

### Step 1 — Unzip the project

Unzip the `nova-os-web.zip` file somewhere easy to find, like your Desktop or Documents.
You should see a folder called `nova-os-web/` with this structure:

```
nova-os-web/
├── package.json
├── vite.config.js
├── index.html
├── .env.example
├── .gitignore
└── src/
    ├── main.jsx
    ├── firebase.js
    └── NovaOS.jsx
```

### Step 2 — Install dependencies

Open a terminal (on Mac: Terminal app; on Windows: PowerShell or Command Prompt).
Navigate into the project folder:

```bash
cd path/to/nova-os-web
```

Then install the project's dependencies:

```bash
npm install
```

This downloads React, Firebase, and Vite into a `node_modules/` folder. It may take a minute.

---

## Part 2 — Set Up Firebase (your database)

Firebase is what stores user accounts and data. It's free for small projects.

### Step 1 — Create a Firebase project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it `nova-os` (or anything you like), click through the steps
4. When asked about Google Analytics, you can turn it off — you don't need it

### Step 2 — Create a Firestore database

1. In the left sidebar, click **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (this lets anyone read/write — fine for a toy OS)
4. Pick any location (e.g. `us-east1`), click **Done**

> ⚠️ Test mode expires after 30 days. When it does, go back to Firestore → Rules and
> paste this to keep it open:
> ```
> rules_version = '2';
> service cloud.firestore {
>   match /databases/{database}/documents {
>     match /nova_storage/{doc} {
>       allow read, write: if true;
>     }
>   }
> }
> ```

### Step 3 — Register a Web App and get your config keys

1. Click the gear icon (⚙) next to "Project Overview" → **"Project settings"**
2. Scroll down to "Your apps" and click the **`</>`** (Web) icon
3. Name it `nova-os-web`, leave Firebase Hosting unchecked, click **"Register app"**
4. You'll see a `firebaseConfig` object — keep this page open, you'll need these values

### Step 4 — Create your .env file

In the `nova-os-web/` folder, copy the example env file:

```bash
cp .env.example .env
```

Open `.env` in VS Code and fill in the values from your Firebase config:

```
VITE_FIREBASE_API_KEY=AIzaSy_your_actual_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

---

## Part 3 — Run It Locally

With your `.env` set up, start the dev server:

```bash
npm run dev
```

Open your browser and go to `http://localhost:5173` — you should see NOVA OS boot up!

Try creating an account. If it works and your data saves (you can log out and back in), 
your Firebase connection is working.

---

## Part 4 — Deploy to Vercel (publish to the internet)

### Step 1 — Push your code to GitHub

1. Go to https://github.com and create a **New Repository** (call it `nova-os`)
2. Make it **Public** (or Private if you prefer)
3. Back in your terminal, inside `nova-os-web/`:

```bash
git init
git add .
git commit -m "NOVA OS v2.0 initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nova-os.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 2 — Import to Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New… → Project"**
3. Find and import your `nova-os` repository
4. Vercel will auto-detect it's a Vite project — leave the build settings as-is

### Step 3 — Add your environment variables to Vercel

Before clicking Deploy, expand **"Environment Variables"** and add each one from your `.env` file:

| Name                              | Value                  |
|-----------------------------------|------------------------|
| VITE_FIREBASE_API_KEY             | your value             |
| VITE_FIREBASE_AUTH_DOMAIN         | your value             |
| VITE_FIREBASE_PROJECT_ID          | your value             |
| VITE_FIREBASE_STORAGE_BUCKET      | your value             |
| VITE_FIREBASE_MESSAGING_SENDER_ID | your value             |
| VITE_FIREBASE_APP_ID              | your value             |

Click **Deploy**. Vercel will build and publish your site. In about 60 seconds you'll get a 
live URL like `https://nova-os-yourname.vercel.app` — share that link with your Discord friends!

### Step 4 — Custom domain (optional)

In Vercel, go to your project → **"Domains"** → add a custom domain if you have one 
(e.g. `novaos.yourdomain.com`).

---

## Part 5 — How to Update the OS

After deploying, any changes you push to GitHub automatically redeploy on Vercel.

### Workflow for updates:

```bash
# Make your changes in VS Code, then:
git add .
git commit -m "describe what you changed"
git push
# Vercel picks it up automatically — usually live in under a minute
```

### Key places to edit in `src/NovaOS.jsx`:

| What you want to change | Where to look |
|-------------------------|---------------|
| Add a new app icon      | `const APPS = [...]` array at the top |
| Add new app content     | The `{wins.map(...)}` block — add a new `{win.app === "yourapp" && <YourApp />}` line |
| Add a new wallpaper     | `const WALLPAPERS = {...}` object |
| Change the OS name/version | Search for "NOVA" and "v2.0" |
| Change boot messages    | `const BOOT_MSGS = [...]` |
| Change the accent color | Search for `#60b8ff` and replace |
| Change the taskbar      | Find the `{/* Taskbar */}` comment |

### Adding a completely new app:

```jsx
// 1. Add to the APPS array:
{ id: "calculator", icon: "🧮", label: "Calculator" },

// 2. Create a component:
function CalculatorApp({ data, updateData }) {
  // ... your app code
  return <div style={{ width: 320 }}>...</div>;
}

// 3. Add a render line in the window body section:
{win.app === "calculator" && <CalculatorApp data={data} updateData={updateData} />}
```

### Updating user data structure (e.g. adding a new field):

The user data object looks like:
```js
{ notes: [], tasks: [], wallpaper: "bliss", bio: "", joined: Date.now() }
```

To add a new field, add it to the `init` object in `handleAuth` (the register block) and
use it in your app component via `data.yourField` and `updateData({ yourField: value })`.

---

## Part 6 — Building NOVA OS v3.0

Here's a roadmap of features to build, roughly ordered easiest to hardest.
When you're ready, just paste your current `NovaOS.jsx` into a new Claude chat and say what
you want to add — Claude can slot features in without breaking what's there.

### 🟢 Easy additions (great starting points)

- **Clock app** — a full-screen analog or digital clock widget
- **Weather app** — use the Open-Meteo API (free, no key needed) to show local weather
- **Calculator app** — basic arithmetic in a window
- **Color theme picker** — let users pick a custom accent color in Profile instead of just blue
- **Right-click desktop menu** — context menu with "Open app", "Change wallpaper", etc.
- **Window minimize** — hide a window to taskbar without closing it
- **Notification history** — a small bell icon showing recent notifications

### 🟡 Medium features

- **Paint app** — an HTML canvas drawing tool, save drawings to Firestore as base64
- **Music player** — embed a playlist using the Web Audio API or a public stream
- **Markdown notes** — upgrade Notes to render markdown (use the `marked` npm package)
- **File manager** — a visual browser for the user's notes and tasks, with rename/move
- **Custom wallpaper upload** — let users paste an image URL as their wallpaper
- **Multiple desktops** — tab between 2-3 virtual desktops

### 🔴 Harder features (great for v3.0 flagship)

- **Real authentication** — swap plaintext passwords for Firebase Auth (email/password)
  This makes accounts actually secure. Firebase Auth is free and well-documented.
- **User avatars** — let users upload a profile picture using Firebase Storage
- **Live chat app** — a chat window using Firestore real-time listeners (`onSnapshot`)
  so messages appear instantly across all connected users
- **Shared corkboard** — a sticky-note board everyone can post to in real time
- **App store** — a menu of mini-apps users can "install" (toggle on/off per account)
- **Mobile support** — add touch events for drag, responsive layout for phones

### 🔵 Architecture upgrades

- **Split into multiple files** — as the OS grows, break each app into its own file
  (e.g. `src/apps/Notes.jsx`, `src/apps/Tasks.jsx`)
- **TypeScript** — add types for safety; Claude can convert the file for you
- **Proper Firestore structure** — move from flat key-value to nested collections:
  ```
  /users/{uid}/profile
  /users/{uid}/notes/{noteId}
  /users/{uid}/tasks/{taskId}
  ```

---

## Troubleshooting

**"Cannot find module './firebase.js'"**
→ Make sure you created `.env` (not just `.env.example`) with your actual Firebase values.

**"FirebaseError: Missing or insufficient permissions"**
→ Your Firestore security rules have expired. Re-paste the open rules from Part 2, Step 3.

**Vercel deploy fails**
→ Double-check all 6 environment variables are added in Vercel's project settings.
→ In Vercel, go to your project → Settings → Environment Variables.

**Changes aren't showing on the live site**
→ Make sure you pushed to GitHub (`git push`). Vercel only deploys from GitHub commits.

**Data not saving**
→ Open your browser's DevTools (F12) → Console tab. Look for Firebase errors.
→ Make sure your Firebase project ID in `.env` matches the one in Firebase Console.

---

## Security notes (important for a real deployment)

1. **Passwords are stored in plain text.** This is fine for a fun toy, but for a real product
   you'd use Firebase Authentication which handles this properly.

2. **Anyone can read anyone's data** in test mode. The Firestore rules above (`allow read, write: if true`)
   mean any user could technically read any document if they knew the key. For a real app, 
   use Firebase Auth and restrict reads with `allow read: if request.auth.uid == resource.data.uid`.

3. **Your Firebase API keys are public** — this is normal and expected for Firebase web apps.
   Firebase security is enforced by Firestore rules, not by keeping the API key secret.
   Never expose private server keys (like service account JSON files).

---

*NOVA OS v2.0 — Nova Systems*
*Guide version 1.0*
