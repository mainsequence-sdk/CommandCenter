# Terraform / Terragrunt Deployment Instructions

This document is the handoff for the infrastructure developer who will productionize the CI/CD path defined in [cloudbuild.yaml](/Users/jose/code/MainSequenceClientSide/CommandCenter/deployment/gcp/cloudbuild.yaml).

The goal is to provision the GCP and Firebase infrastructure required so that this repository can be deployed automatically to Firebase Hosting from Cloud Build.

## What this pipeline expects

The current deployment flow is:

1. Cloud Build runs `npm ci`
2. Cloud Build runs `npm run build`
3. The generated `dist/` folder is deployed to Firebase Hosting
4. The Firebase Hosting target name used by the repo is always `app`
5. The actual Firebase Hosting site is injected at deploy time through `_FIREBASE_HOSTING_SITE`

This means Terraform / Terragrunt must provision:

- a GCP project suitable for production hosting
- Firebase enabled on that project
- at least one Firebase Hosting site
- a Cloud Build trigger that points to this repository and uses `deployment/gcp/cloudbuild.yaml`
- a dedicated build service account with the IAM needed to deploy Hosting

## One-time manual prerequisite

Before the first fully automated apply, a platform owner must make sure Firebase Terms are accepted for the Google account used to bootstrap Firebase for the target project.

Why this matters:

- Firebase documents that accepting Firebase Terms cannot be done by CLI, REST, or Terraform
- Firebase also documents that enabling Firebase on an existing GCP project requires that terms acceptance step first

Practical instruction:

1. Open the Firebase console with an admin account
2. Add Firebase to the target GCP project if the project is not already Firebase-enabled
3. Accept the Firebase Terms if prompted

After that, Terraform / Terragrunt can manage the remaining project state.

Official references:

- [Get started using Firebase with an existing Google Cloud project](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project)
- [Get started with Terraform and Firebase](https://firebase.google.com/docs/projects/terraform/get-started)

## Scope to manage in Terraform / Terragrunt

## Required Terraform providers

The infra implementation should assume:

- `hashicorp/google`
- `hashicorp/google-beta`

Why both:

- plain GCP resources like `google_project_service`, `google_service_account`, and `google_cloudbuild_trigger` normally come from `google`
- Firebase resources are commonly exposed through `google-beta`, including `google_firebase_project`

Recommended provider pattern:

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
```

## Recommended Terraform module split

Do not implement this as one flat root module. At minimum, split it into three modules.

Suggested module names:

1. `project_services`
2. `firebase_hosting`
3. `cloudbuild_delivery`

If your organization already has standard shared modules for project creation, API enablement, IAM, or CI/CD, use those. The important point is that the deployed stack still covers the resources below.

### 1. Project foundation

Provision or consume:

- the production GCP project
- billing attachment if your organization does not already manage it centrally
- labels, org policies, and baseline IAM according to your platform standards

If the project is already created by a separate platform layer, this deployment stack should consume the existing `project_id` and not try to recreate the project.

### 2. Required APIs

Enable at minimum:

- `cloudbuild.googleapis.com`
- `firebase.googleapis.com`
- `firebasehosting.googleapis.com`
- `serviceusage.googleapis.com`
- `iam.googleapis.com`
- `logging.googleapis.com`

Depending on how source repositories are connected, you may also need provider-specific APIs for the SCM integration you choose.

Concrete Terraform implementation:

- use `google_project_service`
- set `disable_on_destroy = false`
- preferably drive it from a local list or variable so API enablement is declarative and reviewable

Example:

```hcl
locals {
  required_services = [
    "cloudbuild.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "serviceusage.googleapis.com",
  ]
}

resource "google_project_service" "required" {
  for_each = toset(local.required_services)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
```

### 3. Firebase enablement

Manage Firebase enablement with Terraform using the Firebase-capable Google provider resources, typically via `google-beta`.

At minimum:

- enable Firebase on the project with `google_firebase_project`

Concrete Terraform implementation:

- use `google_firebase_project`
- point it at the existing `project_id`
- import it if Firebase has already been enabled manually

Example:

```hcl
resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id
}
```

Notes:

- If the project is already Firebase-enabled, import it into Terraform state instead of trying to recreate it.
- This repository does not currently need a Firebase Web App resource because it is only being hosted on Firebase Hosting. The frontend is configured through public `VITE_*` environment variables, not Firebase SDK project config.

### 4. Firebase Hosting site

Provision the Hosting site that Cloud Build will deploy to.

Requirements:

- there must be a default Hosting site before Firebase Hosting deployments can succeed
- the site id used by the pipeline must match `_FIREBASE_HOSTING_SITE`

Recommended approach:

- if this app will use the default Hosting site, set `_FIREBASE_HOSTING_SITE` to that default site id
- if this app should use a dedicated non-default site, provision that site as well and still ensure the default site exists

Concrete Terraform implementation:

- preferred: manage the site in Terraform if your pinned provider version exposes the Hosting site resource your platform supports
- fallback: treat `hosting_site_id` as an input and import or bootstrap the site outside Terraform, then let Terraform manage everything around it

Important implementation note:

- provider support for Firebase Hosting site management can vary by provider version and by whether your org is pinned to `google` or `google-beta`
- because of that, the Terraform module contract for this repo should always expose `hosting_site_id` explicitly, even if the site is also provisioned by Terraform

Module contract requirement:

- the output consumed by CI/CD must always be the exact site id passed into `_FIREBASE_HOSTING_SITE`

Relevant details from Firebase:

- each Hosting site has its own `SITE_ID`
- `firebase target:apply hosting app <SITE_ID>` maps the repo's fixed target name `app` to the real site id during the build

Official references:

- [Deploy targets](https://firebase.google.com/docs/cli/targets)
- [Firebase Hosting API: Site resource](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites)
- [Deploy using the Hosting REST API](https://firebase.google.com/docs/hosting/api-deploy)

### 5. Dedicated Cloud Build service account

Do not rely on whichever default Cloud Build identity happens to exist in the project.

Create a dedicated service account for builds, for example:

- `command-center-cloudbuild@<project>.iam.gserviceaccount.com`

Concrete Terraform implementation:

- use `google_service_account`
- bind project roles with `google_project_iam_member`

Grant the minimum roles required for this repo's current pipeline:

- `roles/logging.logWriter`
  Reason: Cloud Build requires a logs destination when using a user-specified service account, and this repo uses `CLOUD_LOGGING_ONLY`
- `roles/firebasehosting.admin`
  Reason: the build needs to create releases and manage Hosting site state for deployment
- `roles/serviceusage.apiKeysViewer`
  Reason: Firebase documents this is required for Firebase CLI based deployments

Depending on your organization, you may choose to grant the broader `roles/firebase.admin`, but for least privilege the narrower Hosting-focused role is preferred.

Example:

```hcl
resource "google_service_account" "cloudbuild" {
  project      = var.project_id
  account_id   = var.cloudbuild_service_account_name
  display_name = "Command Center Cloud Build"
}

locals {
  cloudbuild_roles = [
    "roles/logging.logWriter",
    "roles/firebasehosting.admin",
    "roles/serviceusage.apiKeysViewer",
  ]
}

resource "google_project_iam_member" "cloudbuild" {
  for_each = toset(local.cloudbuild_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
```

Official references:

- [Configure user-specified service accounts for Cloud Build](https://cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts)
- [Deploy to Firebase with Cloud Build](https://cloud.google.com/build/docs/deploying-builds/deploy-firebase)
- [Firebase Hosting roles and permissions](https://cloud.google.com/iam/docs/roles-permissions/firebasehosting)
- [Firebase product-level predefined roles](https://firebase.google.com/docs/projects/iam/roles-predefined-product)

### 6. Cloud Build trigger

Provision a production Cloud Build trigger that:

- points at this repository
- runs `deployment/gcp/cloudbuild.yaml`
- targets the protected production branch or release tag
- uses the dedicated build service account
- passes the required substitutions

Required substitutions:

- `_FIREBASE_PROJECT_ID`
- `_FIREBASE_HOSTING_SITE`
- `_VITE_API_BASE_URL`
- `_VITE_WS_URL`

Recommended substitutions:

- `_NODE_VERSION`
- `_VITE_USE_MOCK_DATA=false`
- `_VITE_BYPASS_AUTH=false`

Recommended trigger controls for production:

- branch or tag restriction to the release path only
- `included_files` / equivalent filters so docs-only changes do not always deploy
- approval gate enabled if your release policy requires human approval before prod deploys

Important Cloud Build behavior:

- when a trigger runs, the trigger's configured service account is what matters
- do not assume a service account declared elsewhere in build tooling will be used for triggered builds

Concrete Terraform implementation:

- use `google_cloudbuild_trigger`
- set `filename = "deployment/gcp/cloudbuild.yaml"`
- set `location` explicitly
- set the trigger service account explicitly
- populate substitutions so they match the variables expected by the checked-in build file

Minimum trigger fields this repo needs:

- `name`
- `location`
- source repository definition
- branch or tag filter
- `filename`
- `service_account`
- `substitutions`

Example shape:

```hcl
resource "google_cloudbuild_trigger" "production" {
  project         = var.project_id
  name            = "command-center-production"
  description     = "Deploy Command Center to Firebase Hosting"
  filename        = "deployment/gcp/cloudbuild.yaml"
  service_account = google_service_account.cloudbuild.id

  substitutions = {
    _FIREBASE_PROJECT_ID = var.project_id
    _FIREBASE_HOSTING_SITE = var.hosting_site_id
    _NODE_VERSION = var.node_version
    _VITE_API_BASE_URL = var.vite_api_base_url
    _VITE_WS_URL = var.vite_ws_url
    _VITE_USE_MOCK_DATA = tostring(var.vite_use_mock_data)
    _VITE_BYPASS_AUTH = tostring(var.vite_bypass_auth)
  }

  included_files = [
    "deployment/gcp/**",
    "src/**",
    "extensions/**",
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "index.html",
  ]

  # Fill in the repository block that matches your SCM integration model.
}
```

### Trigger creation patterns the infra module should support

This was the main implementation gap: the trigger needs both the trigger resource and the correct repository source block.

There are two practical trigger patterns for this project.

#### Option A: first-generation GitHub trigger

Use this only if your platform still standardizes on first-generation GitHub integration.

Main resource:

- `google_cloudbuild_trigger`

Typical source block:

```hcl
resource "google_cloudbuild_trigger" "production" {
  project         = var.project_id
  location        = var.trigger_region
  name            = "command-center-production"
  filename        = "deployment/gcp/cloudbuild.yaml"
  service_account = google_service_account.cloudbuild.id

  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = var.production_branch_regex
    }
  }

  substitutions = {
    _FIREBASE_PROJECT_ID  = var.project_id
    _FIREBASE_HOSTING_SITE = var.hosting_site_id
    _NODE_VERSION         = var.node_version
    _VITE_API_BASE_URL    = var.vite_api_base_url
    _VITE_WS_URL          = var.vite_ws_url
    _VITE_USE_MOCK_DATA   = tostring(var.vite_use_mock_data)
    _VITE_BYPASS_AUTH     = tostring(var.vite_bypass_auth)
  }
}
```

Use this when:

- the repository is already connected through the classic GitHub integration
- your org does not want to provision `cloudbuildv2` connection resources

#### Option B: second-generation repository connection trigger

Use this if your platform standard is connection-based Cloud Build repositories.

Expected resources:

- `google_cloudbuildv2_connection`
- `google_cloudbuildv2_repository`
- `google_cloudbuild_trigger`

Recommended ownership:

- if SCM connections are shared across multiple repositories, keep `google_cloudbuildv2_connection` in a separate shared infra layer
- the app-specific delivery module can then own the repository registration and the trigger

Typical shape:

```hcl
resource "google_cloudbuildv2_repository" "repo" {
  project            = var.project_id
  location           = var.trigger_region
  name               = "command-center"
  parent_connection  = var.cloudbuild_connection_name
  remote_uri         = var.repository_remote_uri
}

resource "google_cloudbuild_trigger" "production" {
  project         = var.project_id
  location        = var.trigger_region
  name            = "command-center-production"
  filename        = "deployment/gcp/cloudbuild.yaml"
  service_account = google_service_account.cloudbuild.id

  repository_event_config {
    repository = google_cloudbuildv2_repository.repo.id

    push {
      branch = var.production_branch_regex
    }
  }

  substitutions = {
    _FIREBASE_PROJECT_ID   = var.project_id
    _FIREBASE_HOSTING_SITE = var.hosting_site_id
    _NODE_VERSION          = var.node_version
    _VITE_API_BASE_URL     = var.vite_api_base_url
    _VITE_WS_URL           = var.vite_ws_url
    _VITE_USE_MOCK_DATA    = tostring(var.vite_use_mock_data)
    _VITE_BYPASS_AUTH      = tostring(var.vite_bypass_auth)
  }
}
```

Use this when:

- your organization uses second-generation Cloud Build repository connections
- repository connection governance is centralized
- you want a cleaner separation between SCM connection state and trigger state

### Trigger settings this repo specifically needs

Regardless of source pattern, the trigger should set:

- `filename = "deployment/gcp/cloudbuild.yaml"`
- `service_account = <dedicated build service account>`
- `_FIREBASE_PROJECT_ID = var.project_id`
- `_FIREBASE_HOSTING_SITE = var.hosting_site_id`
- `_VITE_API_BASE_URL = var.vite_api_base_url`
- `_VITE_WS_URL = var.vite_ws_url`
- `_VITE_USE_MOCK_DATA = false`
- `_VITE_BYPASS_AUTH = false`

Recommended extras:

- `included_files` so docs-only changes do not deploy
- `ignored_files` for markdown-only or docs-site-only changes if desired
- `approval_config { approval_required = true }` in production if your release process requires it
- branch regex pinned to your protected branch, for example `^main$`

### Trigger module inputs

The delivery module should expose enough data to create the trigger without editing Terraform source per environment.

Minimum trigger-related inputs:

- `trigger_name`
- `trigger_region`
- `production_branch_regex`
- `cloudbuild_yaml_path`
- `hosting_site_id`
- `node_version`
- `vite_api_base_url`
- `vite_ws_url`
- `vite_use_mock_data`
- `vite_bypass_auth`
- source-specific inputs:
  - first-gen GitHub: `github_owner`, `github_repo`
  - second-gen: `cloudbuild_connection_name`, `repository_remote_uri`

### Trigger module outputs

At minimum output:

- `cloudbuild_trigger_id`
- `cloudbuild_trigger_name`
- `cloudbuild_trigger_location`
- `cloudbuild_trigger_repository_reference`

### Trigger validation checks

The infra developer should validate all of the following after apply:

1. the trigger exists in the expected region
2. the trigger is bound to the dedicated service account, not the default one
3. the trigger points to `deployment/gcp/cloudbuild.yaml`
4. the substitutions contain the production values
5. a test commit to the production branch starts a build
6. the build deploys to the expected Firebase Hosting site

Official references:

- [Create and manage build triggers](https://cloud.google.com/build/docs/automating-builds/create-manage-triggers)
- [Default Cloud Build service account behavior](https://cloud.google.com/build/docs/cloud-build-service-account)

### 7. Source repository connection

If repository integration is managed as code in your organization, provision the SCM connection and repository binding that the Cloud Build trigger depends on.

This is intentionally left provider-specific because the implementation differs depending on whether you use:

- GitHub App based Cloud Build integration
- Bitbucket
- GitLab
- Secure Source Manager
- another internal source integration pattern

The important requirement is that the trigger created above must resolve this repository and run against the production branch policy.

Concrete implementation guidance:

- if your organization still uses first-generation GitHub triggers, model the repository directly in `google_cloudbuild_trigger`
- if your organization uses second-generation repository connections, split the repository integration into a separate SCM module and have the trigger depend on it

Recommended module boundary:

- keep source connection resources out of the Firebase module
- either place them in `cloudbuild_delivery` or in a separate `scm_connection` module if shared across repos

### 8. Optional but production-recommended items

These are not strictly required for the first deploy, but should usually exist in a real production stack:

- custom domain mapping for the Hosting site
- DNS records for that domain
- uptime checks or synthetic checks against the production URL
- alerting on failed Cloud Build trigger executions
- alerting on Hosting availability or SSL/domain misconfiguration
- separate environments such as `dev`, `staging`, and `prod` rather than sharing one Firebase Hosting site

Official reference:

- [Connect a custom domain to Firebase Hosting](https://firebase.google.com/docs/hosting/custom-domain)

## Recommended module contracts

This is the missing implementation layer the infra developer should actually build.

### Module: `project_services`

Purpose:

- enable required project services for this app
- optionally consume or create the base project

Expected resources:

- `google_project_service`
- optionally `google_project` if project creation is in scope for this stack

Suggested inputs:

- `project_id`
- `required_services`
- `billing_account` if project creation is included
- `labels`

Suggested outputs:

- `project_id`
- `enabled_services`

### Module: `firebase_hosting`

Purpose:

- turn the project into a Firebase project
- ensure the Hosting site id used by this repository exists or is imported

Expected resources:

- `google_firebase_project`
- optionally provider-supported Firebase Hosting site resource if your pinned provider version supports it

Suggested inputs:

- `project_id`
- `hosting_site_id`
- `manage_hosting_site`

Suggested outputs:

- `project_id`
- `hosting_site_id`
- `hosting_default_url` if available from the managed resource

### Module: `cloudbuild_delivery`

Purpose:

- create the build service account
- grant deploy permissions
- create the production Cloud Build trigger

Expected resources:

- `google_service_account`
- `google_project_iam_member`
- `google_cloudbuild_trigger`
- optionally SCM connection resources depending on your repository integration model

Suggested inputs:

- `project_id`
- `region`
- `hosting_site_id`
- `cloudbuild_service_account_name`
- `production_branch`
- `node_version`
- `vite_api_base_url`
- `vite_ws_url`
- `vite_use_mock_data`
- `vite_bypass_auth`
- repository locator inputs such as repo owner / repo name / connection id

Suggested outputs:

- `cloudbuild_service_account_email`
- `cloudbuild_trigger_id`
- `cloudbuild_trigger_name`

## Example Terragrunt layout

One clean way to structure this is:

```text
live/
  prod/
    command-center/
      project-services/
        terragrunt.hcl
      firebase-hosting/
        terragrunt.hcl
      cloudbuild-delivery/
        terragrunt.hcl

modules/
  project_services/
  firebase_hosting/
  cloudbuild_delivery/
```

Dependency flow:

1. `project-services`
2. `firebase-hosting`
3. `cloudbuild-delivery`

Example dependency wiring:

```hcl
dependency "project_services" {
  config_path = "../project-services"
}

dependency "firebase_hosting" {
  config_path = "../firebase-hosting"
}

inputs = {
  project_id      = dependency.project_services.outputs.project_id
  hosting_site_id = dependency.firebase_hosting.outputs.hosting_site_id
}
```

## Recommended Terragrunt split

Do not put all of this into one huge root stack. Split it by responsibility.

Suggested layout:

1. `project-services`
   Purpose: project lookup or creation, API enablement, baseline labels
2. `firebase-hosting`
   Purpose: Firebase enablement and Hosting site provisioning
3. `cicd`
   Purpose: build service account, IAM, source connection, Cloud Build trigger

Recommended dependency order:

1. `project-services`
2. `firebase-hosting`
3. `cicd`

## Inputs the infra stack should expose

At minimum, make these inputs configurable through Terraform variables or Terragrunt inputs:

- `project_id`
- `project_number` if not derived
- `region` if your organization requires explicit trigger region selection
- `hosting_site_id`
- `production_branch` or release tag pattern
- `vite_api_base_url`
- `vite_ws_url`
- `vite_use_mock_data`
- `vite_bypass_auth`
- `cloudbuild_service_account_name`

## Useful outputs to expose

Export these outputs so application and platform teams can verify the deployment surface:

- `project_id`
- `hosting_site_id`
- `hosting_default_url`
- `cloudbuild_service_account_email`
- `cloudbuild_trigger_id`
- `cloudbuild_trigger_name`

## What should not be managed in Terraform

Do not try to put the following in infra state:

- built frontend artifacts from `dist/`
- `node_modules/`
- `.firebaserc` generated locally for developers
- secrets inside `VITE_*` variables

Important:

- `VITE_*` values are public frontend configuration and are compiled into the browser bundle
- if any true secret is introduced later, it must not be passed through `VITE_*`

## How this maps to this repository

The infrastructure developer should treat these repository files as the contract:

- [deployment/gcp/cloudbuild.yaml](/Users/jose/code/MainSequenceClientSide/CommandCenter/deployment/gcp/cloudbuild.yaml)
- [deployment/gcp/firebase.json](/Users/jose/code/MainSequenceClientSide/CommandCenter/deployment/gcp/firebase.json)

Current assumptions encoded in those files:

- Hosting target name is fixed to `app`
- build output directory is `dist`
- routing is SPA-style and rewrites all unmatched paths to `/index.html`
- static assets are cacheable, but `index.html` is not

If infra wants to change any of those assumptions, change the repo files first and keep the Terraform / Terragrunt layer aligned with them.
