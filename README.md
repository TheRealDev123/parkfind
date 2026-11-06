# ParkFind

A mobile-friendly parking finder for GitHub Pages.

## Features

- **Map:** drag and pinch-zoom; save GPS location or tap to choose a spot. The map frames your current position and destination at startup, then preserves your manual zoom/pan while GPS updates.
- **Walking navigation:** tap **Start walking** to enable live location, follow your position on the map, and request a pedestrian route with turn-by-turn steps. The blue route and instructions are fetched from the public OpenStreetMap-based foot router at `routing.openstreetmap.de` (no key); the app recalculates if your location moves well away from the route. Google Maps is an optional walking-directions link (`travelmode=walking`).
- **Home:** responsive parking dashboard with map/recents/settings/reviews shortcuts, a saved-spot summary, recent spots, rotating tips, and a quick parking checklist.
- **Recents:** keep 5, 10, or 20 distinct parking spots; tap one to restore it as the active spot.
- **More:** menu with separate Settings, Reviews, and Profile & account screens. Expanded navigation reveals one, two, or three More pages as tabs as screen width grows; the setting can be turned off to keep every page in the More menu. Settings also includes UI Zoom (80–120%, default 100%), units, live map following, map zoom controls, recent history size, coordinate visibility, deletion confirmations, 24-hour time, and an animation-mode selector for Normal, Super, or Reduced; preferences are saved on this device only. Super mode reveals an intensity slider and plays a brief full-screen celebration each time it is selected. Reduced mode disables Super effects. The optional display name is edited on Profile & account. Reviews require an account, but sign-in and account syncing are not implemented.
- **Browser navigation:** tabs and More subpages update the URL and browser history, so Back and Forward move between screens.

Parking coordinates, name, preferences, and recents are saved on this device only. Account sign-in and syncing data across logged-in accounts are not available yet. GPS needs HTTPS and permission. Map tiles and walking route requests need internet. The public route service may be unavailable or rate-limited; it is not guaranteed. Walking directions are for general orientation and are not a safety-certified navigation system; check surroundings and follow local signs.

For GitHub Pages, publish `main` from `/ (root)` under **Settings → Pages**.
