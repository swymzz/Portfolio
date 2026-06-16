# Swayam Portfolio - Zero-Cost Build

This is the first working version of the portfolio: a premium static site with a local admin editor.

## Open Locally

Open `index.html` in a browser.

Admin page:

- File: `admin.html`
- Prototype passcode: `collision-lab`

The current admin saves edits to the same browser using `localStorage`. Use **Export JSON** after editing. In a later step, the exported JSON can replace `assets/content.js` or be connected to a free CMS/backend.

## Free Hosting Path

Best zero-budget path:

1. Host the static site on GitHub Pages or Cloudflare Pages.
2. Keep heavy raw videos off the repo. Use YouTube unlisted links for video playback.
3. Keep web-preview 3D files compressed as `.glb` when possible.
4. Use the admin editor for drafting content, then export JSON.
5. Later connect the editor to a free backend:
   - GitHub-based CMS for static content updates.
   - Supabase or Firebase free tier for auth, database, and media metadata.

## Media Strategy

Use the site for polished previews:

- YouTube links for edits and reels.
- Compressed video snippets for short, lightweight previews.
- `.glb` or `.gltf` for browser 3D previews.
- `.step`, `.stl`, `.f3d`, `.sldprt` as downloads only when file size is manageable.
- MP3 links for music snippets.

Do not host large raw client videos directly inside the repo. It will be slow and may hit free host limits.
