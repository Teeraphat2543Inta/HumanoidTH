# Vercel Deployment

## Required Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

```env
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=...
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
ADMIN_BASIC_USER=admin@example.com
ADMIN_BASIC_PASSWORD=<strong unique password>
ADMIN_SESSION_SECRET=<at least 32 random characters>
YOUTUBE_API_KEY=
GITHUB_TOKEN=
```

`DATABASE_URL` should be the Prisma Postgres connection string from the Prisma/Vercel integration.

## Deploy Flow

1. Connect this GitHub repo to Vercel.
2. Add the environment variables above.
3. Deploy.
4. Run schema push once from your local machine or Vercel CLI:

```bash
pnpm db:push
pnpm db:seed
```

Do not run `db:push` automatically during every Vercel build. Builds should generate Prisma Client and build Next.js only.

## Protected Routes

These pages require a signed admin session from `/admin-login`:

- `/admin/*`
- `/data-pulls`

These APIs require Basic Auth:

- `/api/ingest/*`
- `/api/export`

There are no default credentials. If `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASSWORD` or `ADMIN_SESSION_SECRET` is missing, or the password is still an example value such as `change-this-before-deploy`, admin login is disabled, the pages redirect to `/admin-login`, and the APIs return `503`.
