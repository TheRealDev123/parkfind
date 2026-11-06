# ParkFind

A mobile-friendly parking finder for GitHub Pages.

## Features

- **Map:** drag and pinch-zoom; save GPS location or tap to choose a spot. The map frames your current position and destination at startup, then preserves your manual zoom/pan while GPS updates.
- **Walking navigation:** tap **Start walking** to enable live location, follow your position on the map, and request a pedestrian route with turn-by-turn steps. The blue route and instructions are fetched from the public OpenStreetMap-based foot router at `routing.openstreetmap.de` (no key); the app recalculates if your location moves well away from the route. Google Maps is an optional walking-directions link (`travelmode=walking`).
- **Home:** optional display name stored locally.
- **Recents:** the last ten distinct parking spots; tap one to restore it as the active spot.
- **Account:** local guest profile. Sign-in and photo upload are not implemented.

Parking coordinates, name, and recents live in local storage on this browser/device. GPS needs HTTPS and permission. Map tiles and walking route requests need internet. The public route service may be unavailable or rate-limited; it is not guaranteed. Walking directions are for general orientation and are not a safety-certified navigation system; check surroundings and follow local signs.

For GitHub Pages, publish `main` from `/ (root)` under **Settings → Pages**.
