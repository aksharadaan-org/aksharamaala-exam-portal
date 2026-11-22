# Aksharamaala Exam Portal — setup and operations

This is the manual command reference for the standalone Expo mobile app, mock HTTP API, Docker PostgreSQL 17 database, GitHub CI, repository permissions, and hosted blueprint.

Run each section in order and check its expected result. Stop at a failed command and resolve it before continuing. Commands are for macOS with zsh. Shell variables apply only to the current Terminal session. Replace the explicitly marked usernames before running invitation commands.

## Contents

1. [Current state and remaining setup](#1-current-state-and-remaining-setup)
2. [Tools and GitHub authentication](#2-tools-and-github-authentication)
3. [Existing checkout or fresh clone](#3-existing-checkout-or-fresh-clone)
4. [Install dependencies and verify naming](#4-install-dependencies-and-verify-naming)
5. [Local PostgreSQL and migrations](#5-local-postgresql-and-migrations)
6. [Tests and verification commands](#6-tests-and-verification-commands)
7. [Run the API and mobile app](#7-run-the-api-and-mobile-app)
8. [Android emulator setup](#8-android-emulator-setup)
9. [GitHub CI workflow](#9-github-ci-workflow)
10. [Direct reviewers and the pending governance PR](#10-direct-reviewers-and-the-pending-governance-pr)
11. [Protect main and restrict merging](#11-protect-main-and-restrict-merging)
12. [Invite interns with Write access](#12-invite-interns-with-write-access)
13. [Host the blueprint from this repository](#13-host-the-blueprint-from-this-repository)
14. [Daily contribution and merge workflow](#14-daily-contribution-and-merge-workflow)
15. [Schema and fixture changes](#15-schema-and-fixture-changes)
16. [Backup, recovery, shutdown and deliberate reset](#16-backup-recovery-shutdown-and-deliberate-reset)
17. [Troubleshooting](#17-troubleshooting)
18. [Final handover checklist](#18-final-handover-checklist)

## 1. Current state and remaining setup

Inspected on 22 November 2026.

| Item | Observed state |
| --- | --- |
| Repository | `aksharadaan-org/aksharamaala-exam-portal` |
| Visibility | Public |
| Default branch | `main` |
| Main protection | Enabled, currently refers to `exam-maintainers` team |
| CI | `Database and API` and `Mobile TypeScript` passed |
| Local checkout | On `chore/repository-governance`, tracking origin |
| Governance PR | PR #1 is open and requires approval |
| CODEOWNERS | Team reference is present on the PR branch, absent on main |
| GitHub Pages | Site has not been configured |
| Existing admin accounts | `aksharadaan-dev`, `Akankshg-ByteWizard` |

**For your existing checkout, sections 2–9 are the reproducible setup reference. Resume the remaining governance work at section 10, then complete sections 11–13.** Avoid recreating the already existing GitHub repository.

The proposed direct-reviewer configuration uses the two existing admin accounts above. Confirm they represent your intended trusted reviewers before applying it. An author cannot approve their own PR. Arrange a second trusted person for independent review of maintainer-authored changes.

The executable starter supplies the student API, seeded data, migration runner, tests, and a mobile connection screen. The blueprint specifies the native assessment screens and staff services that the team will implement. Browser previews in `docs/` use their own synthetic design fixtures.

## 2. Tools and GitHub authentication

Required tools are Node 22.13+ in the 22.x line, npm, Git, Docker with Compose, and GitHub CLI. Your Mac already has these.

```sh
node --version
npm --version
git --version
docker --version
docker compose version
gh --version
```

For a new Mac, install missing tools using their official installers or Homebrew. With Homebrew installed on Apple Silicon, this provides the CLI tools:

```sh
brew install node@22 git gh
brew install --cask docker
```

If Node 22 is installed by Homebrew and is absent from PATH, add this once:

```sh
cat >> ~/.zshrc <<'EOF'

# Node 22 from Homebrew on Apple Silicon
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
EOF
source ~/.zshrc
node --version
```

If you already use nvm, use `nvm install 22` and `nvm use 22` instead of changing Node installation methods.

Start Docker Desktop and wait until its server is ready:

```sh
open -a Docker
docker info
```

Check authentication first:

```sh
gh auth status
```

If authentication is missing, log in using a browser:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
```

For subsequent commands in this Terminal:

```sh
export GH_REPO="aksharadaan-org/aksharamaala-exam-portal"
```

`gh api user --jq .login` displays your authenticated username. Repository settings and invitations require an account with repository Admin permission. Each reviewer should authenticate with their own account.

## 3. Existing checkout or fresh clone

### Existing checkout on your Mac

```sh
cd /Users/akankshgatla/Documents/Aksharadaan/aksharamaala-exam-portal
git status --short --branch
git remote set-url origin https://github.com/aksharadaan-org/aksharamaala-exam-portal.git
git fetch origin
git remote -v
```

Your current branch contains the open governance PR. Continue section 10 on that branch. Preserve uncommitted work before switching branches.

### First checkout for an intern

Run this only if the destination directory does not already exist:

```sh
mkdir -p "$HOME/Documents/Aksharadaan"
cd "$HOME/Documents/Aksharadaan"
gh repo clone aksharadaan-org/aksharamaala-exam-portal
cd aksharamaala-exam-portal
```

For normal work after governance is merged, use main:

```sh
git switch main
git pull --ff-only origin main
```

The canonical URL is now under `aksharadaan-org`. Instructions for creating a repository under the former personal account have already been completed and are superseded by this clone workflow.

## 4. Install dependencies and verify naming

From the repository root:

```sh
npm ci
npm --prefix mobile ci
```

The two directories have separate lock files. Use `npm ci` for a reproducible checkout. Use `npm install` when intentionally changing dependencies and commit the corresponding lock file.

Confirm the configured names:

```sh
node --input-type=module <<'EOF'
import fs from 'node:fs';
for (const file of ['package.json', 'mobile/package.json', 'mobile/app.json']) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(file, value.expo ? value.expo.name : value.name);
}
EOF
```

Expected names are `aksharamaala-exam-portal`, `aksharamaala-exam-portal-mobile`, and `Aksharamaala Exam Portal`. The Expo slug is `aksharamaala-exam-portal`. The starter's native package identifiers and `assessmentlab` development link scheme remain provisional until the native integration is built.

## 5. Local PostgreSQL and migrations

If the older `assessment-intern-starter` container is still using port 55432, stop its database from its own directory first:

```sh
cd /Users/akankshgatla/Documents/Aksharadaan/assessment-intern-starter
npm run db:stop
cd /Users/akankshgatla/Documents/Aksharadaan/aksharamaala-exam-portal
```

Start the new repository's database, then apply its migrations:

```sh
npm run db:start
npm run db:refresh
npm run db:refresh
```

The first refresh applies pending SQL. The next should print `Database is current.`

| Setting | Local value |
| --- | --- |
| Compose project | `aksharamaala-exam-portal` |
| Image | `postgres:17-alpine` |
| Host and port | `127.0.0.1:55432` |
| Database | `assessment` |
| Application schema | `exam` |
| Database owner | `exam_owner` |
| Local password | `local_exam_only` |
| Storage | Docker volume `aksharamaala-exam-portal_exam_data` |

These checked-in credentials belong to the local development container. The API connects through `db/store.mjs`. Mobile clients call the HTTP API.

Verify the running service, version, migrations and fixture counts:

```sh
docker compose ps

docker compose exec -T db psql -U exam_owner -d assessment \
  -c "SHOW server_version;"

docker compose exec -T db psql -U exam_owner -d assessment \
  -c "SELECT name, applied_at FROM public.exam_migrations ORDER BY name;"

docker compose exec -T db psql -U exam_owner -d assessment \
  -c "SELECT (SELECT count(*) FROM exam.schools) AS schools, (SELECT count(*) FROM exam.students) AS students, (SELECT count(*) FROM exam.qualities) AS qualities, (SELECT count(*) FROM exam.stage_windows) AS stages;"
```

Expect PostgreSQL 17.x and the initial fixture counts `2 schools`, `2 students`, `24 qualities`, `5 stages`. The image follows the PostgreSQL 17 patch line, so the patch number can change between fresh pulls.

The initial migration sequence is:

```text
0001_schema.sql
0002_fixtures.sql
0003_access.sql
```

Local attempts are retained during ordinary migration refreshes and container restarts.

## 6. Tests and verification commands

```sh
npm run check
npm test
npm run check:mobile
```

Or run all three in sequence:

```sh
npm run verify
```

If recreating scripts in a fresh copy of the original starter is necessary, these are the complete definitions already present in your repository:

```sh
npm pkg set \
  'scripts.check=node --check api/server.mjs && node --check db/migrate.mjs && node --check db/store.mjs && node --check db/sync.mjs' \
  'scripts.check:mobile=npm --prefix mobile run check' \
  'scripts.verify=npm run check && npm test && npm run check:mobile'
```

The current four integration tests exercise the five-stage exam journey, repeated and concurrent submits, stage windows, populated-database upgrades, migration rollback and checksum validation, and PostgreSQL row isolation. Tests create and drop temporary databases in the local exam container. They leave the development `assessment` database's practice records intact.

## 7. Run the API and mobile app

### Terminal A — database and API

```sh
cd /Users/akankshgatla/Documents/Aksharadaan/aksharamaala-exam-portal
npm run db:start
npm run db:refresh
npm start
```

Expect `Mock API at http://127.0.0.1:4177/v1`. Leave this process running.

### Terminal B — mobile bundler

```sh
cd /Users/akankshgatla/Documents/Aksharadaan/aksharamaala-exam-portal/mobile
npm start
```

After an emulator is running, press `a` for Android. Press `i` only with Xcode and an iOS simulator installed. The connection screen should show `Connected as Learner A` after its sign-in check.

The seeded mock login uses `demo-a` or `demo-b` with code `246810`. Its bearer expires after one hour or API restart. No SMS is sent. The Android emulator reaches the Mac at `10.0.2.2`; the iOS simulator uses `127.0.0.1`. A physical phone needs a separately configured reachable API address and bind/forwarding setup. Scanning the Metro QR code alone does not change the API address.

Use Ctrl+C to stop a server. Ctrl+Z suspends it. If you suspended a server in the same shell:

```sh
jobs
fg
```

Then either keep it running or stop it with Ctrl+C.

## 8. Android emulator setup

Install Android Studio for Apple Silicon. One installation option is:

```sh
brew install --cask android-studio
open -a "Android Studio"
```

Complete the standard setup wizard. In More Actions → SDK Manager, confirm SDK location `$HOME/Library/Android/sdk`. Install Android SDK Platform-Tools, Android Emulator, a stable Android SDK Platform, and Command-line Tools.

Add the paths once:

```sh
cat >> ~/.zshrc <<'EOF'

# Android development
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
EOF
source ~/.zshrc
adb version
```

In Android Studio's Virtual Device Manager, create a Pixel device with an ARM64 / arm64-v8a system image, download the image and start the device. Wait for its home screen.

```sh
emulator -list-avds
adb devices
```

Expect an emulator in the `device` state. Restart Metro in Terminal B after setting SDK paths, then press `a`. If Expo reports an Expo Go SDK-version mismatch, install the Android Expo Go version compatible with this starter's Expo SDK 54 from https://expo.dev/go and retry. The emulator supports installing older compatible Expo Go versions.

## 9. GitHub CI workflow

Your repository already contains `.github/workflows/check.yml`. The following is its complete reproducible definition. Run this block only when intentionally replacing that file on a feature branch:

```sh
mkdir -p .github/workflows
cat > .github/workflows/check.yml <<'EOF'
name: Aksharamaala Exam Portal CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: exam-portal-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  database-api:
    name: Database and API
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - name: Preserve merged migrations
        if: github.event_name == 'pull_request'
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: |
          changes=$(git diff --no-renames --name-only --diff-filter=MD \
            "$BASE_SHA"...HEAD -- db/migrations/)
          if [ -n "$changes" ]; then
            echo "Add a new migration instead of changing a merged migration."
            echo "$changes"
            exit 1
          fi
      - run: npm run check
      - name: Start PostgreSQL 17
        run: npm run db:start
      - name: Apply migrations
        run: npm run db:refresh
      - name: Verify repeatable refresh
        run: npm run db:refresh
      - name: Run PostgreSQL integration tests
        run: npm test
      - name: Print database logs on failure
        if: failure()
        run: docker compose logs --no-color db
      - name: Remove CI database
        if: always()
        run: docker compose down -v

  mobile:
    name: Mobile TypeScript
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
        working-directory: mobile
      - run: npm run check
        working-directory: mobile
EOF
```

This workflow validates backend integration and mobile TypeScript. Native UI and device tests are future additions as the screens are implemented.

Inspect CI using an actual numeric run ID, assigned automatically below:

```sh
gh run list --repo aksharadaan-org/aksharamaala-exam-portal --workflow check.yml --limit 5

EXAM_RUN_ID=$(gh run list \
  --repo aksharadaan-org/aksharamaala-exam-portal \
  --workflow check.yml --limit 1 --json databaseId --jq '.[0].databaseId')

gh run watch "$EXAM_RUN_ID" \
  --repo aksharadaan-org/aksharamaala-exam-portal --exit-status
```

If it fails:

```sh
gh run view "$EXAM_RUN_ID" \
  --repo aksharadaan-org/aksharamaala-exam-portal --log-failed
```

For a manual rerun on main:

```sh
gh workflow run check.yml --repo aksharadaan-org/aksharamaala-exam-portal --ref main
```

## 10. Direct reviewers and the pending governance PR

Interns receive direct repository Write access in section 12. Use individual trusted reviewer accounts in CODEOWNERS and main protection.

The following commands update the existing PR #1 on `chore/repository-governance`. Confirm that the listed accounts are your intended reviewers before running them.

```sh
cd /Users/akankshgatla/Documents/Aksharadaan/aksharamaala-exam-portal
git status --short
git switch chore/repository-governance
git pull --ff-only origin chore/repository-governance

cat > .github/CODEOWNERS <<'EOF'
# Trusted reviewers for all repository files, including this ownership file.
* @aksharadaan-dev @Akankshg-ByteWizard
EOF

touch docs/.nojekyll

git add .github/CODEOWNERS docs/.nojekyll SETUP_AND_OPERATIONS.md
git commit -m "Document setup and use direct exam portal reviewers"
git push

gh pr view 1 --repo aksharadaan-org/aksharamaala-exam-portal
gh pr checks 1 --repo aksharadaan-org/aksharamaala-exam-portal --watch
```

Apply section 11's direct-user protection configuration before merging. It replaces the existing team restrictions with the two trusted accounts. The existing team can remain in the organization; this runbook does not require deleting it.

**The independent reviewer** must approve PR #1 from their own authenticated account. They inspect the diff first:

```sh
gh pr diff 1 --repo aksharadaan-org/aksharamaala-exam-portal
gh pr review 1 --repo aksharadaan-org/aksharamaala-exam-portal \
  --approve --body "Reviewed the repository setup and direct reviewer configuration."
```

The PR author cannot supply that approval. Do not switch between accounts to simulate independent human review. If no other trusted reviewer is available, leave this PR pending until one is appointed.

After approval and passing checks, an allowed admin merges:

```sh
gh pr merge 1 --repo aksharadaan-org/aksharamaala-exam-portal --squash --delete-branch

git switch main
git pull --ff-only origin main
```

For a future fresh clone where PR #1 is already merged, use a new feature branch and a new PR for governance changes. Never reuse a merged branch as an onboarding step.

## 11. Protect main and restrict merging

Run these commands as a repository administrator. They update the repository's merge settings and replace the existing classic main protection configuration with direct-user restrictions.

GitHub does not provide a repository setting that hides the Approve button from every Write user. An intern may still select **Approve** in the review menu, but that review does not satisfy the protected branch because only the two users listed in `CODEOWNERS` can provide the required code-owner approval. Interns can comment, request changes and participate in review. They cannot satisfy the merge gate or merge `main`.

```sh
gh repo edit aksharadaan-org/aksharamaala-exam-portal \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge

cat > /tmp/aksharamaala-main-protection.json <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Database and API", "Mobile TypeScript"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": true,
    "dismissal_restrictions": {
      "users": ["aksharadaan-dev", "Akankshg-ByteWizard"],
      "teams": []
    }
  },
  "restrictions": {
    "users": ["aksharadaan-dev", "Akankshg-ByteWizard"],
    "teams": [],
    "apps": []
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

gh api --method PUT \
  repos/aksharadaan-org/aksharamaala-exam-portal/branches/main/protection \
  --input /tmp/aksharamaala-main-protection.json
```

Verify:

```sh
gh api repos/aksharadaan-org/aksharamaala-exam-portal/branches/main/protection \
  --jq '{checks:.required_status_checks.contexts, approvals:.required_pull_request_reviews.required_approving_review_count, code_owner_review:.required_pull_request_reviews.require_code_owner_reviews, admins_enforced:.enforce_admins.enabled, merge_users:[.restrictions.users[].login], merge_teams:[.restrictions.teams[].slug]}'
```

Expect both checks, one approval, code owner review and admin enforcement enabled, the two reviewer accounts in merge_users and an empty merge_teams list. Administrator accounts retain administration authority and can change settings. Select admins only from trusted project leads.

The branch must be up to date, review conversations resolved and CI green. A fresh push dismisses stale approval. Intern Write access permits feature-branch pushes, while protected-main restrictions limit merges to the two named accounts and administrators. Keep `require_code_owner_reviews` enabled. `CODEOWNERS` must contain this exact rule on `main`:

```text
* @aksharadaan-dev @Akankshg-ByteWizard
```

After the governance PR is merged, verify the live file:

```sh
gh api "repos/aksharadaan-org/aksharamaala-exam-portal/contents/.github/CODEOWNERS?ref=main" \
  --jq '.content' | base64 --decode
```

If it still contains `@aksharadaan-org/exam-maintainers`, update it in a new PR before relying on this approval policy.

## 12. Invite interns with Write access

The organization's base permission was Read when inspected. Invite new interns as outside collaborators to this repository to scope private-repository access to explicit invitations. Existing organization members retain permissions they inherit from the organization and other grants.

For each intern, set their actual GitHub username:

```sh
EXAM_INTERN="REPLACE_WITH_INTERN_GITHUB_USERNAME"
```

Then send the repository invitation:

```sh
gh api --method PUT \
  "repos/aksharadaan-org/aksharamaala-exam-portal/collaborators/$EXAM_INTERN" \
  -f permission="push"
```

The API value `push` means the GitHub Write role. The intern must accept the invitation. Repeat with each username.

Inspect pending invitations and accepted access:

```sh
gh api repos/aksharadaan-org/aksharamaala-exam-portal/invitations \
  --jq '.[] | {id,username:.invitee.login,permissions}'

gh api repos/aksharadaan-org/aksharamaala-exam-portal/collaborators \
  --jq '.[] | {username:.login,role:.role_name}'

gh api "repos/aksharadaan-org/aksharamaala-exam-portal/collaborators/$EXAM_INTERN/permission" \
  --jq '{username:.user.login,permission}'
```

Expected effective permission for an intern is `write`.

At offboarding, remove their accepted repository grant:

```sh
gh api --method DELETE \
  "repos/aksharadaan-org/aksharamaala-exam-portal/collaborators/$EXAM_INTERN"
```

To cancel a pending invitation, use its numeric ID:

```sh
EXAM_INVITATION_ID="REPLACE_WITH_NUMERIC_INVITATION_ID"
gh api --method DELETE \
  "repos/aksharadaan-org/aksharamaala-exam-portal/invitations/$EXAM_INVITATION_ID"
```

Removing a direct grant does not remove independent grants from organization roles or teams. Public source remains readable after Write access is removed.

## 13. Host the blueprint from this repository

Section 10 adds `docs/.nojekyll`. Merge it first. The repository's static pages use relative links, so they can be served at the project URL. GitHub Pages publication makes the blueprint publicly accessible.

The site files already live in `docs/` and include `index.html`, `guide.css`, `student.html`, `staff.html`, `student.js`, `staff.js`, `workflows.html`, `wiring.html`, `contracts.html`, `storage.html`, `refresh.html` and `acceptance.html`. You do not need a separate website repository.

Open the Pages settings:

```sh
open "https://github.com/aksharadaan-org/aksharamaala-exam-portal/settings/pages"
```

Choose **Deploy from a branch**, select **main** and **/docs**, then Save.

The equivalent CLI command for a site that has not yet been created is:

```sh
gh api --method POST \
  repos/aksharadaan-org/aksharamaala-exam-portal/pages \
  -f build_type="legacy" \
  -f 'source[branch]=main' \
  -f 'source[path]=/docs'
```

The POST command is for first-time creation only. Run it once. If GitHub says the Pages site already exists, do not repeat it. Use the settings page to change its source.

Choose either the settings screen or the POST command. If the site already exists, inspect it instead of repeating creation:

```sh
gh api repos/aksharadaan-org/aksharamaala-exam-portal/pages \
  --jq '{url:.html_url,status,source}'
gh run list --repo aksharadaan-org/aksharamaala-exam-portal --limit 10
```

Wait for the Pages deployment to succeed, then open:

```sh
open "https://aksharadaan-org.github.io/aksharamaala-exam-portal/"
```

Check the source and deployment from the command line:

```sh
gh api repos/aksharadaan-org/aksharamaala-exam-portal/pages \
  --jq '{url:.html_url,status,source}'

gh run list \
  --repo aksharadaan-org/aksharamaala-exam-portal \
  --limit 10
```

Publish later documentation changes through PRs modifying `docs/`. A merge to main triggers Pages deployment. The root Markdown runbook is readable directly on GitHub; link it from README when ready.

## 14. Daily contribution and merge workflow

### Start a task from clean main

Stop your API with Ctrl+C in its terminal before changing code or schema. Run:

```sh
cd /Users/akankshgatla/Documents/Aksharadaan/aksharamaala-exam-portal
git status --short
git switch main
npm run sync
npm ci
npm --prefix mobile ci
npm run verify
git switch -c feat/quality-selection
```

`sync` requires a clean main checkout. It fetches and fast-forwards origin/main, installs changed root dependencies, starts the Docker database and applies pending migrations. The explicit npm ci commands cover both lock files.

### Finish a task

```sh
npm run verify
git diff --check
git status --short
# Stage the actual paths changed by this feature.
git add mobile api contracts db tests docs package.json package-lock.json
git diff --cached --stat
git commit -m "Add quality selection"
git push -u origin HEAD

gh pr create --repo aksharadaan-org/aksharamaala-exam-portal --base main --fill
```

Add `.github`, root documentation, or other paths explicitly when the task changes them. Inspect staged files before committing.

The PR author checks CI:

```sh
gh pr checks --repo aksharadaan-org/aksharamaala-exam-portal --watch
```

A trusted reviewer, from their own account, inspects and approves the actual PR number:

```sh
EXAM_PR_NUMBER="REPLACE_WITH_NUMERIC_PR_NUMBER"
gh pr diff "$EXAM_PR_NUMBER" --repo aksharadaan-org/aksharamaala-exam-portal
gh pr review "$EXAM_PR_NUMBER" --repo aksharadaan-org/aksharamaala-exam-portal --approve
```

An allowed maintainer/admin merges after all requirements pass:

```sh
gh pr checks "$EXAM_PR_NUMBER" --repo aksharadaan-org/aksharamaala-exam-portal --watch
gh pr merge "$EXAM_PR_NUMBER" --repo aksharadaan-org/aksharamaala-exam-portal --squash --delete-branch
```

### Bring main into an active feature branch

Commit or otherwise preserve current edits, then:

```sh
git fetch origin
git merge origin/main
# Resolve any merge conflicts before continuing.
npm ci
npm --prefix mobile ci
npm run db:start
npm run db:refresh
npm run verify
git push
```

Expect another review if the push dismissed prior approval.

## 15. Schema and fixture changes

Inspect the migration directory before choosing the next number:

```sh
ls db/migrations
```

If the latest file is still `0003_access.sql`, create the following example file on your feature branch. Otherwise choose the next unused consecutive number and adjust the filename.

```sh
cat > db/migrations/0004_feedback_bands.sql <<'EOF'
CREATE TABLE exam.feedback_bands (
  id text PRIMARY KEY,
  min_percent integer NOT NULL CHECK (min_percent BETWEEN 0 AND 100),
  en text NOT NULL,
  te text NOT NULL
);
INSERT INTO exam.feedback_bands VALUES
  ('all-correct', 100, 'All items correct', 'అన్ని సమాధానాలు సరైనవి');
EOF

npm run db:refresh
npm run db:refresh
npm run verify
```

This is an authoring example. Add it only when implementing that feature. Add an upgrade test under `tests/` for its intended data transformation and access behavior before committing.

The migration runner checks consecutive filenames, SHA-256 history, and PostgreSQL major version. A transaction-level advisory lock serializes refreshes. SQL and ledger writes commit together. A failed pending batch rolls back. Use schema-qualified names and keep transaction-control statements outside migration SQL files.

Keep merged migrations byte-stable. The existing `.gitattributes` normalizes SQL line endings. New fixture data goes into a new migration with deterministic IDs. Avoid changing old published question rows used by historical attempts.

If two feature branches choose the same number, integrate main and renumber the unpublished migration. If it was already applied locally, use a fresh local sandbox or restore a matching backup before retesting. A PostgreSQL database that has extra branch-specific migrations cannot be refreshed from an older checkout without resolving the mismatch. Parallel checkouts currently share the Compose project and volume on a machine.

## 16. Backup, recovery, shutdown and deliberate reset

### Back up local practice data

With the API stopped, choose a fresh backup path outside the repository:

```sh
EXAM_BACKUP="$HOME/Documents/aksharamaala-exam-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -Fc -U exam_owner assessment > "$EXAM_BACKUP"
ls -lh "$EXAM_BACKUP"
docker compose exec -T db pg_restore -l < "$EXAM_BACKUP"
```

### Inspect a restore in a new database

```sh
docker compose exec -T db createdb -U exam_owner assessment_recovery
docker compose exec -T db pg_restore -U exam_owner \
  -d assessment_recovery --exit-on-error < "$EXAM_BACKUP"
docker compose exec -T db psql -U exam_owner -d assessment_recovery \
  -c 'SELECT count(*) FROM exam.attempts;'
```

Choose another recovery name if that database already exists. Inspect and reconcile with matching code before replacing the working database.

### Stop and resume

```sh
npm run db:stop
```

This retains the Docker volume. Resume with:

```sh
npm run db:start
npm run db:refresh
npm start
```

### Deliberately discard the local exam volume

Only run the following when you intend to remove local learners' practice records in the sandbox. Stop the API and take a backup first if those records matter:

```sh
npm run reset
npm run verify
```

The reset command uses `docker compose down -v`, starts a new exam container and applies all migrations. It also removes any temporary recovery databases in that volume.

## 17. Troubleshooting

### Port 55432 is already allocated

```sh
docker ps --format '{{.Names}} {{.Ports}}'
```

Identify the container owning that port. Stop the old exam starter using its own `npm run db:stop` command, then start the canonical repository's database. Keep host-port values in Compose and `db/store.mjs` synchronized if you intentionally change them.

### EADDRINUSE on API port 4177

```sh
lsof -nP -iTCP:4177 -sTCP:LISTEN
jobs
```

Stop or resume the identified API in its original terminal. Start one API process for the checkout you are using.

### Expo cannot find adb

Complete section 8, open a new Terminal and verify:

```sh
command -v adb
adb version
adb devices
```

### Emulator opens but the sign-in check fails

Ensure the database and HTTP API are running. In a separate Terminal:

```sh
curl -i -X POST http://127.0.0.1:4177/v1/challenges \
  -H 'Content-Type: application/json' \
  -d '{"handle":"demo-a"}'
```

Expect HTTP 200 and a challenge ID. A phone cannot use an emulator's host address unchanged.

### CI command returns 404

Use the actual repository name and numeric run ID from section 9. A literal RUN_ID is not a valid run. Verify `gh auth status` if access fails.

### PR is blocked after green CI

```sh
gh pr view --repo aksharadaan-org/aksharamaala-exam-portal \
  --json reviewDecision,mergeStateStatus,statusCheckRollup
```

Check that a different trusted person approved the latest push, code owners are valid, the branch is current, and review conversations are resolved. Reviewers should avoid editing a PR immediately before attempting their own approval because latest-push approval must come from someone other than the pusher.

### npm reports vulnerabilities

```sh
npm audit
npm --prefix mobile audit
```

Inspect the dependency paths and compatible updates. Apply updates on a feature branch, commit lock files and rerun verification plus the affected mobile startup flow. Avoid blindly applying `npm audit fix --force`, which can change major versions across the Expo dependency set.

### Database migration reports history differs

Preserve the current DB. Restore the original applied SQL file from Git and place the desired correction in a new migration. For a disposable branch experiment, use the deliberate reset process after checking that its data can be discarded.

## 18. Final handover checklist

- [ ] A new developer can clone `aksharadaan-org/aksharamaala-exam-portal` and install both lock files.
- [ ] Docker PostgreSQL reports major version 17 and expected synthetic fixtures.
- [ ] Refresh is repeatable and local attempts survive normal migration upgrades.
- [ ] `npm run verify` passes.
- [ ] API and mobile connection check work together on an emulator.
- [ ] CI checks pass on the final merged commit.
- [ ] CODEOWNERS uses the intended direct reviewer accounts on main.
- [ ] Main protection lists individual merge accounts and no required maintainer team.
- [ ] Interns accepted direct Write invitations and have the intended effective access.
- [ ] The hosted blueprint loads under the organization Pages URL.
- [ ] Interns know the PR, migration, backup and refresh workflows.

## References

- GitHub protected branches and merge restrictions — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Branch protection API — https://docs.github.com/en/rest/branches/branch-protection
- Individual CODEOWNERS and review behavior — https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- Outside collaborator access — https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-outside-collaborators/adding-outside-collaborators-to-repositories-in-your-organization
- GitHub CLI — https://cli.github.com/manual/
- GitHub Pages publishing — https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Android emulator setup — https://docs.expo.dev/workflow/android-studio-emulator/
- Docker PostgreSQL image — https://hub.docker.com/_/postgres
