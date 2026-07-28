# Setting up and deploying the Qada Tracker

These steps take you from a fresh copy of this code to a live website on Vercel.
Everything here stays on **free** plans — Vercel Hobby for hosting, Neon Free for
the database. You will not be asked for a credit card, and there is no other
service to sign up for.

Type the commands exactly as shown. `$` is just the prompt — don't type it.

---

## Before you start

You need two things on your computer:

1. **Node.js** (version 20 or newer) — download it from https://nodejs.org and
   run the installer.
2. **A Vercel account** — sign up free at https://vercel.com.

Then open a terminal (Terminal on Mac, PowerShell on Windows), go to this
project's folder, and install the project's code libraries:

```
$ npm install
```

Install the Vercel command-line tool and sign in:

```
$ npm install -g vercel
$ vercel login
```

`vercel login` opens your browser. Approve it, then come back to the terminal.

Finally, connect this folder to a Vercel project:

```
$ vercel link
```

Answer the questions it asks (choose "create a new project" if you don't have
one yet, and accept the suggested name).

---

## Step A — Create the database

This creates a free Postgres database (Neon) through the Vercel Marketplace.
It's billed through your Vercel account, so there's no separate signup, and the
Free plan costs nothing.

```
$ vercel install neon
```

Follow the prompts and **choose the Free plan** when asked. If you're ever
offered a paid plan or an upgrade, decline it — this app doesn't need one.

> Prefer clicking to typing? Go to https://vercel.com/dashboard → your project →
> **Storage** → **Create Database** → **Neon** → **Free**, then click
> **Connect** to attach it to your project.

Either way, Vercel now stores your database connection string as an environment
variable called `DATABASE_URL` and hands it to the app automatically. You never
have to copy or paste the connection string yourself.

---

## Step B — Set the login secret (`AUTH_SECRET`)

This is a random password the app uses to sign login cookies. Nobody ever types
it — it just needs to exist and stay private.

```
$ npx auth secret
```

This generates a random secret and saves it to a local file called `.env.local`.

Now add the same secret to Vercel so the live site has it too:

```
$ vercel env add AUTH_SECRET
```

It asks which environments — choose **Production**, **Preview**, and
**Development** (press space to select each, then Enter). When it asks for the
value, open `.env.local`, copy the long random text after `AUTH_SECRET=`, and
paste it in.

---

## Step C — Create the tables in the database

The database exists but is empty. This step creates the `users` and
`prayer_days` tables.

First, download your project's settings (including the database connection
string) into `.env.local`:

```
$ vercel env pull .env.local
```

Then create the tables:

```
$ npm run db:migrate
```

You should see `migrations applied successfully`. You only ever need to do this
once — unless the database structure changes later.

> If you see "No Postgres connection string found", the `vercel env pull` step
> didn't pick up the database. Re-run Step A, then `vercel env pull .env.local`
> again.

---

## Step D — Put it online

```
$ vercel --prod
```

When it finishes it prints a URL like `https://your-project.vercel.app`. Open it
on your phone or laptop — that's your app.

From then on, sign up with a username and password, tell it how many days you
need to catch up on, and start checking prayers off. The same account works on
every device, because everything is stored in the database.

---

## Running it on your own computer first (optional)

If you'd like to try it locally before putting it online:

```
$ vercel env pull .env.local
$ npm run dev
```

Then open http://localhost:3000.

---

## Common questions

**Will any of this cost money?**
No. Vercel Hobby and Neon Free are both $0. The app never asks for a paid
feature. If a screen ever offers you an upgrade, you can safely say no.

**I forgot my password.**
There's no password reset (the app deliberately collects no email address). Sign
up under a new username, or ask a developer to reset the hash directly in the
database.

**How do I add more missed days later?**
In the app: **Settings → Add more missed days**. You can use a date range or a
quick amount, exactly like the first-time setup.

**I made a mistake and want to start over.**
Sign up under a different username. Each account has its own separate list.
