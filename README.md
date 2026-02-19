# Intervals – PWA Interval Timer

A full-featured Progressive Web App for HIIT, Tabata, and Circuit Training — deployable to GitHub Pages with zero backend.

---

## 🚀 Deploy to GitHub Pages (5 minutes)

### Step 1 – Create GitHub Repo
```
1. Go to github.com → New repository
2. Name it: intervals-timer  (or anything you like)
3. Set to Public
4. Click "Create repository"
```

### Step 2 – Push Files
```bash
cd interval-timer
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/intervals-timer.git
git push -u origin main
```

### Step 3 – Enable GitHub Pages
```
1. Go to your repo → Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: main  /  folder: / (root)
4. Save
```

Your app is live at: `https://YOUR_USERNAME.github.io/intervals-timer/`

### Step 4 – Install on iPhone
```
1. Open Safari on iPhone
2. Navigate to your GitHub Pages URL
3. Tap the Share button (box with arrow)
4. Tap "Add to Home Screen"
5. Tap "Add"
```

App now runs fullscreen, offline, like a native app.

---

## 📁 Project Structure

```
interval-timer/
├── index.html      ← App shell + all views
├── style.css       ← All styles, color states, responsive
├── app.js          ← All logic (timer, stopwatch, countdown, templates)
├── sw.js           ← Service Worker (cache-first offline strategy)
├── manifest.json   ← PWA manifest (icons, display, theme)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## ⚙️ Technology Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Vanilla JS** | Zero dependencies, instant load, static-host compatible |
| Fonts | **Barlow Condensed / Barlow** via Google Fonts | Gym-readable heavy type |
| Audio | **Web Audio API** | Synthesized beeps/bells, no audio files needed |
| Storage | **localStorage** | Offline-first template persistence |
| Offline | **Service Worker** | Cache-first strategy |
| Hosting | **GitHub Pages** | Free, HTTPS, custom domain support |

---

## 🎨 Color States

| State | Color | Hex |
|-------|-------|-----|
| Work / High Intensity | 🔴 Red | `#E8281E` |
| Rest / Low Intensity | 🟢 Green | `#5CC85A` |
| Warm-Up | 🔵 Blue | `#2C7BE5` |
| Cool-Down | 🟣 Purple | `#7B61FF` |
| Prepare | 🟡 Yellow | `#F5C518` |

---

## 📋 Service Worker Strategy

- **Cache-first** for all static assets (HTML, CSS, JS, fonts)
- **Network-fallback** for anything not cached
- **Offline navigation fallback** serves `index.html`
- Cache version is bumped on each deploy (update `CACHE_NAME` in `sw.js`)

To force-update users after a deploy: bump `CACHE_NAME` to `'intervals-v1.3'` etc.

---

## 📱 iOS PWA Limitations & Workarounds

| Limitation | Workaround Applied |
|-----------|-------------------|
| **Audio blocked until user gesture** | AudioContext unlocked on first tap of any button |
| **Background timer throttling** | Uses `performance.now()` delta — self-corrects on resume |
| **No background audio** | TTS + haptic handle attention when screen is visible |
| **Status bar height** | `env(safe-area-inset-top)` CSS variable throughout |
| **Double-tap zoom** | Suppressed via `touchend` event handler |
| **Screen sleep during workout** | Wake Lock API requested (where supported) |
| **Standalone mode detection** | `display: standalone` in manifest enables proper PWA mode |
| **No push notifications** | Not applicable; this is a local workout tool |

---

## 🔊 Audio System

All sounds are **synthesized** via Web Audio API — no external sound files needed. This means:
- Instant load (no audio files to download)
- Works fully offline
- Sounds: Beep, Bell chord, Warning double-beep, Start fanfare
- Optional **Text-to-Speech** announces interval names
- **Haptic feedback** on interval transitions (where supported)

---

## 💾 State Management

All state lives in memory (`IT`, `SW`, `CD` objects in `app.js`). Templates are persisted to `localStorage`. No backend, no accounts, no sync.

---

## 📦 Adding Custom Updates

To update the deployed app:
```bash
git add .
git commit -m "Update"
git push
```
GitHub Pages auto-deploys within 1–2 minutes. Bump `CACHE_NAME` in `sw.js` to ensure users get the update.
