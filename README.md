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
| Styling    | Tailwind CSS v4, driven entirely by CSS custom properties  |
| Fonts      | Bricolage Grotesque, Instrument Sans, IBM Plex Mono        |
| Database   | Postgres via the Vercel Marketplace (Neon Free)            |
| DB access  | Drizzle ORM                                                |
| Auth       | Auth.js (NextAuth v5), Credentials provider, bcryptjs      |
| Hosting    | Vercel (Hobby)                                             |

Fonts are downloaded at build time by `next/font` and served from the app's own
origin, so there is no font CDN in the critical path.

## Design tokens

`src/app/globals.css` is the single source of truth for colour, type, spacing,
radius and motion. Every value is a CSS custom property, mirrored into Tailwind's
`@theme inline` so utilities like `bg-surface` and `text-ink-2` resolve to the
same variables and theme switching stays live. Dark is the base theme; an
explicit Dark/Light choice is stamped on `<html>` as `data-theme` and beats the
system preference.

Saturated green is reserved for progress, so a filled ledger cell actually reads
as filled. The warm `--today` accent marks *where to act next* and never doubles
as a success colour. Red appears only in destructive confirmations.

## Routes

| Route         | What it does                                                     |
| ------------- | ---------------------------------------------------------------- |
| `/signup`     | Create an account (username + password)                          |
| `/login`      | Sign in, with a "remember me" option                             |
| `/onboarding` | The empty state — how much you're making up                      |
| `/`           | Today: log make-up prayers, today's goal, masjid strip, grid     |
| `/ledger`     | The full day record — grid and list views, per-day editing       |
| `/masjid`     | Congregation history and the patterns in it                      |
| `/settings`   | Goal, Witr, add/remove days, theme, export, account              |

Three destinations appear in the nav (Today, Ledger, Settings); `/masjid` is a
detail screen reached from the Today screen's masjid section, the way the grid
links through to the full ledger. Logged-out visitors are redirected to
`/login` by `src/middleware.ts`.

## How logging works

The primary action is **FIFO logging**, not picking a date. Tapping `+` on Asr
marks the *oldest incomplete Asr slot* in the ledger done and stamps it with the
real time you pressed it. Nobody thinks "I am making up the Asr of 17 May 2025",
so the app doesn't ask.

Each slot carries two timestamps: the ledger date it belongs to (`day_date`) and
when it was logged (`fajr_at`, `zuhr_at`, …). Pace and history read the second;
the ledger view reads the first. Manual per-day editing stays fully available in
the Ledger — FIFO is the fast path, not the only one.

The target is recomputed from the table on every write rather than cached, so
clearing a day in the middle of the ledger can't leave a stale pointer.

## Tracking prayers at the masjid

Separate from the qada ledger, the Today screen records where each of today's
five prayers was prayed: **at the masjid**, **on my own**, or **missed**. Anything
other than the masjid offers a note — chosen from suggestions or typed — and
`/masjid` turns those notes into something usable: which prayer is hardest to
make, and what most often gets in the way.

Three states rather than a checkbox is deliberate. "Prayed on my own" is the
common middle case, and folding it into "missed" would make both the record and
the tone wrong.

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
