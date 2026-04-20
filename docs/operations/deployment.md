# Deployment

This repository intentionally does not hardcode host-specific SPA fallback rules for static
deployments.

The application uses client-side routing through `react-router-dom`, so direct navigation to routes
like `/login`, `/app`, or `/app/widgets/:widgetId` requires the hosting platform to serve the SPA
entry document for navigation requests that do not match a static asset.

## Principle

- The repo stays hosting-neutral.
- Fork deployers configure SPA fallback behavior in their own host.
- Host-specific routing rules should live in the deploy target, not in shared repo defaults.

## Mock deploys in forks

If a fork deploys the app with:

```bash
VITE_USE_MOCK_DATA=true
```

the frontend can run as a static site, but the host still needs SPA routing support.

Examples:

- Firebase Hosting: configure rewrites in `firebase.json`
- Netlify: configure `_redirects`
- Vercel: configure rewrites in `vercel.json`
- Cloudflare Pages: use Cloudflare Pages' own SPA/static routing behavior instead of committing a
  generic repo-wide redirect rule

## Why this matters

Different hosts implement SPA fallback differently. A rule that works on one provider can be
invalid or harmful on another. Keeping those rules out of the shared repository avoids breaking
fork deploys and keeps the app portable.
