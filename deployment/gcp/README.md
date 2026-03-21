# GCP Firebase Deployment

This directory contains the production deployment assets for hosting Command Center on Firebase Hosting via Cloud Build in Google Cloud.

## Files

- `cloudbuild.yaml`: CI/CD pipeline that installs dependencies, builds the Vite app, and deploys the `dist/` output to Firebase Hosting.
- `deployment_instructions.md`: Terraform / Terragrunt handoff describing the GCP and Firebase resources this deployment path requires.
- `firebase.json`: Firebase Hosting configuration for this single-page app.

## Build Inputs

The Cloud Build pipeline expects substitutions for:

- `_FIREBASE_PROJECT_ID`: Firebase / GCP project id to deploy into.
- `_FIREBASE_HOSTING_SITE`: Firebase Hosting site id for the web app.
- `_VITE_API_BASE_URL`: public REST API base URL compiled into the frontend bundle.
- `_VITE_WS_URL`: public WebSocket URL compiled into the frontend bundle.

Optional substitutions:

- `_NODE_VERSION`: pinned Node.js builder image tag.
- `_VITE_USE_MOCK_DATA`: defaults to `false` for production deployments.
- `_VITE_BYPASS_AUTH`: defaults to `false` for production deployments.

## Trigger Guidance

For production, wire a Cloud Build trigger from your protected branch and set the substitutions in the trigger configuration rather than hardcoding project-specific values into source control.

Example manual run:

```bash
gcloud builds submit \
  --config deployment/gcp/cloudbuild.yaml \
  --substitutions=_FIREBASE_PROJECT_ID=my-prod-project,_FIREBASE_HOSTING_SITE=command-center,_VITE_API_BASE_URL=https://api.example.com/api,_VITE_WS_URL=wss://api.example.com/ws \
  .
```

## Operational Notes

- The Cloud Build service account must be allowed to deploy to Firebase Hosting in the target project.
- `firebase target:apply` is executed during the build so the repository does not need a committed `.firebaserc` for site binding.
- This pipeline assumes `npm run build` produces the static site in `dist/`.
