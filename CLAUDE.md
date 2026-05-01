# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal/AI is a serverless portfolio + AI news curation platform. It has no build step — HTML/CSS/JS files are served as-is, and the backend consists of Vercel serverless functions.

## Deployment

Hosted on Vercel. Serverless functions in `/api/*.js` are auto-deployed. No build pipeline. To deploy: push to the connected Git repo.

**Required environment variables (set in Vercel dashboard):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `ADMIN_PASSWORD`
- `NOTIFY_WEBHOOK` (optional — Discord/Slack/Make webhook for signups/contacts)

There are no local dev scripts defined. To test API functions locally, use the Vercel CLI (`vercel dev`).

## Architecture

**Frontend** — four static HTML pages, no framework, no bundler:
- `index.html` — AI news feed (articles + RSS) + tools directory + newsletter signup
- `projects.html` — public portfolio: active projects + shipped work + social links
- `services.html` — IT services landing page with contact form
- `admin.html` — password-gated dashboard (password stored in `sessionStorage`)

**Backend** — five Vercel serverless functions (`/api/*.js`, ES modules):
- `articles.js` — merges Supabase featured articles with 6 RSS feeds; 10-minute in-memory cache
- `admin.js` — single CRUD endpoint for all admin operations; password validated via `x-admin-password` header
- `public.js` — read-only data for `projects.html`; 1-minute in-memory cache
- `subscribe.js` — newsletter signup; logs to Vercel + optional webhook
- `contact.js` — contact form handler; logs to Vercel + optional webhook/Resend email

**Database** — Supabase (PostgreSQL) with Row Level Security:
- `articles`, `subscribers`, `contact_submissions` — defined in `supabase-schema.sql`
- `projects`, `portfolio_items`, `links` — added in `supabase-schema-v2.sql`

Run `supabase-schema.sql` first, then `supabase-schema-v2.sql` when setting up a new instance.

## Key Patterns

**Admin API action format:** `resource:verb` — e.g., `"articles:add"`, `"projects:list"`, `"portfolio:delete"`. The `admin.js` function routes on this string and sanitizes fields to an allowlist per resource.

**Privacy enforcement is dual-layered:** RLS at the DB level (Supabase policies) + explicit column selection at the API level in `public.js`. The `projects` table has sensitive fields (`client_name`, `hourly_rate`, `budget`, `notes`) that are never returned by the public endpoint — only `show_publicly=true` rows are exposed, and only safe columns are selected.

**Admin authentication:** No sessions or JWTs. The `ADMIN_PASSWORD` env var is compared against the `x-admin-password` request header. Admin uses the Supabase service key (bypasses RLS); public endpoints use the anon key (RLS enforced).

**RSS parsing:** Custom regex-based XML parser in `articles.js` handles both RSS 2.0 and Atom formats with no external dependencies.

**In-memory caching:** Vercel function instances cache responses in module-level variables. Cache is per-instance and lost on cold starts — this is intentional (cheap, no external cache needed).

## Database Schema Notes

`projects.status` is an enum: `'active'`, `'paused'`, `'completed'`, `'cancelled'`.

`projects.progress` is an integer 0–100.

`portfolio_items.tech_stack` and `projects.tags` are PostgreSQL arrays.
