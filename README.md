# Standalone assessment sandbox

Open **docs/index.html** for the mobile blueprint, UI previews, API contracts, data model, migration workflow and verification scenarios.

## First run

Install Node 22.13+ and Docker with the Compose v2 plugin. Start Docker, open a terminal at this repository root and run:

    npm ci
    npm run db:start
    npm run db:refresh
    npm test
    npm start

Compose starts one service using the official postgres:17-alpine image. It binds 127.0.0.1:55432 to the container’s PostgreSQL port. The database is assessment, the application tables are in the exam schema, and a Docker volume stores local data across restarts. Connection settings in db/store.mjs match compose.yaml. Use `docker compose exec db psql -U exam_owner -d assessment` to inspect the sandbox.

The mock HTTP API listens on 127.0.0.1:4177. Synthetic handles demo-a and demo-b use code 246810. Sessions expire after one hour or on API restart. Per-request transactions set a restricted role and the verified learner ID for PostgreSQL row policies. The mobile client calls the API.

In a second terminal, from the root:

    cd mobile
    npm ci
    npm run check
    npm start

Use an iOS simulator or Android emulator to run the mobile connection check.

## Daily refresh

Clone the new team repository with origin configured. On clean main, run `npm run sync` to fetch and fast-forward, start the database and apply pending migrations. If package-lock.json changes, run npm ci before starting the API. On feature branches, merge origin/main, then run npm run db:refresh with the container running. For an extracted ZIP use the first-run commands.

Add new, consecutive NNNN_description.sql files in db/migrations, including stable synthetic fixture changes. The runner validates checksums in public.exam_migrations and applies pending files atomically. Local drafts survive normal refresh. Tests create and drop isolated test databases in the same container. The CI workflow starts the same container and exercises upgrades against a populated test database.

To pause the database, run npm run db:stop. Use npm run reset only when you intend to discard the entire exam sandbox volume and recreate its synthetic data. An older SQLite starter's local file stays separate; the PostgreSQL sandbox starts from its own fixtures.
