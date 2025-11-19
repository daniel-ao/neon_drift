# Neon Drift

Small, host-anywhere web game: fly through a neon corridor, collect energy orbs, dodge glitch shards. Everything is plain HTML/CSS/JS — no build step or dependencies.

## Quick start
- Open `index.html` directly in a browser, or run a tiny server: `python3 -m http.server 8000` (then visit `http://localhost:8000`).
- Press `Play` (or `Enter`) to begin. Use `WASD` or arrow keys to move. Catch cyan orbs to grow your multiplier; avoid magenta shards to keep your lives.
- Dash with `Space`/`Shift` (short burst with cooldown). Blue shield pickups block the next hit. Keep streaking orbs for bonus lives every 10 grabs.
- On phones, tap **Enable Tilt** to steer by leaning your device; the on-screen dash button stays available for phasing through hazards.

## New Features (v2.0)
- **Settings & Modifiers**: Toggle CRT effects, bloom, screen shake, or try Hardcore (1 life) and Zen modes.
- **Powerups**: Magnet (M), Time Freeze (F), and Tiny Mode (T) alongside Shields.
- **Advanced Hazards**: Watch out for Homing Triangles and Zig-Zag shards.
- **Quests**: Complete dynamic objectives like "Collect 5 Orbs" for score bonuses.
- **Ghost Dash**: Dashing leaves a trail that destroys hazards for points.
- **Stats**: Detailed end-of-run report card.
- **Mobile Tilt Controls**: iOS/Android devices can steer by tilting; joystick fallback remains available if motion access is denied.

## Files
- `index.html` – page layout and copy.
- `styles.css` – neon-inspired styling, responsive layout, soft background shapes.
- `script.js` – canvas game loop, collisions, shield powerups, dash burst, HUD updates, local best score storage.

## Hosting

### GitHub Pages (Recommended)
This project is configured to automatically deploy to GitHub Pages:

1. Go to your repository **Settings** → **Pages**
2. Under "Build and deployment", set **Source** to "GitHub Actions"
3. Push to the `main` branch or manually trigger the workflow from the **Actions** tab
4. Your game will be live at `https://<username>.github.io/<repo-name>/`

The included `.github/workflows/deploy.yml` handles automatic deployment.

### Other Options
Drop the folder on any static host (Netlify, Vercel, S3, etc.). No external assets beyond Google Fonts.
