# Deployment

This directory holds environment-specific delivery assets for Command Center.

## Layout

- `gcp/`: Google Cloud Build and Firebase Hosting deployment assets for the production web app.

## Maintenance Notes

- Keep deployment assets close to the platform they target instead of mixing them into app source.
- Treat `VITE_*` values as public configuration. They are compiled into the browser bundle and must not contain secrets.
