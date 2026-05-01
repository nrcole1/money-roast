# Signal/AI — Deployment guide (v2)

Full site: curated AI news/tools homepage, IT services page, **public projects/portfolio page**, and a password-protected admin panel managing everything.

## 📁 Files

```
/
├── index.html               ← Homepage (news + tools + newsletter)
├── services.html            ← IT services page
├── projects.html            ← NEW: public projects + portfolio + socials
├── admin.html               ← Password-protected admin (now tabbed)
├── package.json
├── supabase-schema.sql      ← Run FIRST in Supabase
├── supabase-schema-v2.sql   ← Run SECOND after v1 (adds projects/portfolio/links)
└── api/
    ├── articles.js          ← Homepage articles feed
    ├── public.js            ← NEW: feeds projects.html (public read-only)
    ├── admin.js             ← Admin CRUD (now namespaced: "articles:add", "projects:list", etc)
    ├── subscribe.js
    └── contact.js
```

---

## 🚀 Setup (if fresh — 15 min)

### Supabase project
1. [supabase.com](https://supabase.com) → Start your project → sign up → create project
2. SQL Editor → paste contents of **`supabase-schema.sql`** → Run
3. SQL Editor → New query → paste contents of **`supabase-schema-v2.sql`** → Run

### Vercel env vars
In Vercel → Settings → Environment Variables:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://abc.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable/anon key |
| `SUPABASE_SERVICE_KEY` | service_role key (secret!) |
| `ADMIN_PASSWORD` | Your admin password |
| `NOTIFY_WEBHOOK` | *(optional)* Discord/Slack webhook |

### Deploy
```bash
git add .
git commit -m "Add projects + portfolio + socials"
git push
```

---

## 🚀 Setup (if upgrading from v1)

You already have the articles setup. Add three things:

1. **Run `supabase-schema-v2.sql`** in Supabase SQL Editor (creates `projects`, `portfolio_items`, `links` tables — won't touch your articles).
2. **Replace these files in your repo:**
   - `admin.html` (now has tabs)
   - `api/admin.js` (actions now namespaced — old `articles:add` will work, old bare `add` will not)
3. **Add these new files:**
   - `projects.html`
   - `api/public.js`

Redeploy. Log in to `/admin.html` — you'll see four tabs: Articles, Projects, Portfolio, Links.

---

## 🎛 How to use each tab

### Articles tab
Same as before. Paste URL → Auto-fetch → Save.

### Projects tab (ongoing contracted work)
Private by default. Tracks:
- Status (Planning, In progress, In review, Blocked, Completed)
- Progress bar (0-100%, quick +10% button)
- Hours logged + hourly rate → auto-calculates billable revenue
- Client name, budget, private notes (all hidden from public)
- Start/due dates, tags, repo URL

**"Show publicly" checkbox** = exposes an anonymized view on `projects.html` (title, description, status, progress, tags, dates only — no client, no money, no notes). Use this to show prospective clients what you're working on without leaking confidential info.

Dashboard at the top shows: active count, total hours, billable revenue, project count.

### Portfolio tab (completed work — GitHub-style grid)
Public. Every item has:
- Name, description, category (Web/AI/Infrastructure/Mobile/Data/Other)
- Primary language + color dot (mimics GitHub's repo list)
- Tech stack tags
- Repo URL + live URL
- Pin to top checkbox (pinned items show first with an accent border)

### Links tab (socials + business)
Public. Shows as a row of pills at the top of `projects.html`. Pre-loaded: GitHub, LinkedIn, Email (placeholder URLs — edit them on first login).

Supported platforms with custom icons: github, linkedin, twitter, x, youtube, instagram, email, website, mastodon, bluesky, dribbble, other.

---

## 🔒 Privacy model

| Data | Who sees it |
|---|---|
| Articles (featured) | Everyone |
| Portfolio items | Everyone |
| Links | Everyone |
| Projects with `show_publicly = false` | Only you (admin) |
| Projects with `show_publicly = true` | Everyone sees title/desc/status/progress — **never client name, rates, budget, or notes** |
| Client names, rates, budgets, notes, hours | Only you (admin), always |

Enforced at the database level via Row Level Security AND at the API level (`/api/public` never SELECTs sensitive columns even if RLS failed).

---

## 🔧 Customizing

**Add a new project status** — edit `STATUS_LABELS` in both `admin.html` and `projects.html`, and optionally add a matching `.status-newstatus` CSS class.

**Change the category list for portfolio** — edit the `<select id="f-category">` options in `admin.html`. Filters on `projects.html` auto-build from whatever categories exist.

**Retheme** — `:root` CSS variables at the top of any HTML file.

---

## 🐛 Troubleshooting

**Admin tabs show "Unknown resource"** — env vars not set or stale build. Check `SUPABASE_SERVICE_KEY` is set and redeploy.

**Projects tab empty after saving** — RLS blocking read. The admin uses the service key which bypasses RLS, so this usually means the v2 schema didn't run. Re-run it.

**`/api/public` returns empty projects** — make sure at least one project has `show_publicly = true`. RLS filters out everything else.

**Changed admin password but still works with old one** — Vercel env vars need a redeploy to take effect.
