# Qada Tracker

A small web app for catching up on missed obligatory prayers, one day at a time.

Each missed day holds the five daily prayers — Fajr, Zuhr, Asr, Maghrib, Isha —
plus an optional Witr. You check them off as you make them up and watch the
remaining count fall. Accounts sync across devices, so the phone and the laptop
always agree.

**New here? Read [SETUP.md](./SETUP.md)** — it walks through provisioning the
database and deploying, in plain language.

## Stack

Everything runs on Vercel; there is no third-party service to sign up for, and
every piece stays on a free tier.

| Piece      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Framework  | Next.js (App Router) + TypeScript                          |
| Styling    | Tailwind CSS                                               |
| Database   | Postgres via the Vercel Marketplace (Neon Free)            |
| DB access  | Drizzle ORM                                                |
| Auth       | Auth.js (NextAuth v5), Credentials provider, bcryptjs      |
| Hosting    | Vercel (Hobby)                                             |

## Routes

| Route         | What it does                                            |
| ------------- | ------------------------------------------------------- |
| `/signup`     | Create an account (username + password)                 |
| `/login`      | Sign in, with a "remember me" option                    |
| `/onboarding` | First-time setup — how many days to catch up on         |
| `/`           | The tracker (protected)                                 |
| `/settings`   | Witr toggle, add more days, log out (protected)         |

Logged-out visitors to `/` and `/settings` are redirected to `/login` by
`src/middleware.ts`.

## How the pieces fit together

```
src/
  auth.config.ts        Edge-safe Auth.js config (used by middleware)
  auth.ts               Credentials provider + bcryptjs (Node.js runtime)
  middleware.ts         Route protection
  db/schema.ts          users + prayer_days tables
  db/index.ts           Drizzle client (connects lazily)
  lib/session.ts        requireUser() — the only source of the current user id
  lib/prayers.ts        Prayer list, labels, totals, day labels
  lib/days.ts           Date-range and quick-amount → list of days
  lib/actions/          Server actions (auth, day generation, check-offs)
  components/           Dashboard, day cards, forms, settings controls
```

### Security model

There is no database row-level security here, so the application enforces it:

- Every read and write goes through a server action or a server component.
- `requireUser()` reads the user id from the signed Auth.js session cookie —
  never from anything the browser sends.
- Every query is scoped with `eq(prayerDays.userId, user.id)`. Passing someone
  else's row id changes nothing: the `WHERE` clause matches zero rows and the
  action reports the day as unavailable.

### Counting

A day is worth 5 prayers, or 6 when the user has Witr switched on. Turning Witr
off hides it and stops counting it, but never deletes stored Witr checkmarks —
switch it back on and they're all still there.

Totals are computed in SQL across every day, so they stay correct even though
the dashboard only sends a slice of days to the browser (the 60 oldest
incomplete ones, with a "Show more" link).

## Local development

```
vercel env pull .env.local   # gets DATABASE_URL and AUTH_SECRET
npm install
npm run dev
```

## Scripts

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Development server                              |
| `npm run build`      | Production build                                |
| `npm run db:generate`| Generate migration SQL after editing the schema |
| `npm run db:migrate` | Apply migrations to the database                |
