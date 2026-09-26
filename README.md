# Keep — Personal Manager

A personal task manager with Tasks, Hot List, Friend Circle and Site Visits
sections. Installable as an app once hosted here.

## Files

- `index.html` — the whole app (HTML + CSS + JS)
- `manifest.json` — web app manifest (name, icons, colors)
- `sw.js` — service worker (required for the native "Install app" prompt)
- `icons/icon-192.png`, `icons/icon-512.png` — app icons

## Deploy on GitHub Pages (free)

1. Create a new GitHub repository and upload all these files to it,
   keeping the same folder structure (the `icons` folder must stay a folder).
2. Go to the repo's **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, pick the `main`
   branch and `/ (root)` folder, then **Save**.
4. Wait a minute or two, then GitHub gives you a link like:
   `https://<your-username>.github.io/<repo-name>/`
5. Open that link on your phone in Chrome (Android) or Safari (iPhone).
   - **Android Chrome**: after a couple of visits, an "Install app" prompt
     will appear automatically, or tap the in-app **Install app** button.
   - **iPhone Safari**: tap Share → **Add to Home Screen** (iOS never shows
     an automatic install prompt for any web app — this is Apple's rule,
     not something any app can change).

## Notes

- All data is stored only in the browser on each device (`localStorage`).
  There is no shared server, so the same list will not sync across devices
  unless you build that separately.
- To update the app later, edit `index.html` and push the change — GitHub
  Pages redeploys automatically within a minute or two.
