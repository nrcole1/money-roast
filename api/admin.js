// /api/admin.js
// Password-protected admin endpoint for articles, projects, portfolio, and links.

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const TABLES = {
  articles: 'articles',
  projects: 'projects',
  portfolio: 'portfolio_items',
  links: 'links'
};

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 40;
const attempts = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
  }

  if (!isAuthorized(req.headers['x-admin-password'])) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase admin environment variables.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const action = body?.action || '';
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    if (action === 'fetch-metadata') {
      return res.status(200).json(await fetchMetadata(body.url));
    }

    const [resource, verb] = action.split(':');
    const table = TABLES[resource];
    if (!table) return res.status(400).json({ error: `Unknown resource: ${resource}` });

    if (verb === 'list') {
      const orderField = body.orderBy || defaultOrder(resource);
      const ascending = body.ascending ?? false;
      const { data, error } = await supabase.from(table).select('*').order(orderField, { ascending });
      if (error) throw error;
      return res.status(200).json({ items: data });
    }

    if (verb === 'add') {
      const payload = sanitize(resource, body);
      if (!validateRequired(resource, payload)) {
        return res.status(400).json({ error: `Missing required fields for ${resource}` });
      }
      const { data, error } = await supabase.from(table).insert([payload]).select().single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'This entry already exists.' });
        throw error;
      }
      return res.status(200).json({ item: data });
    }

    if (verb === 'update') {
      const { id, ...rest } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      delete rest.action;
      const payload = sanitize(resource, rest);
      if (resource === 'projects') payload.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json({ item: data });
    }

    if (verb === 'delete') {
      if (!body.id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from(table).delete().eq('id', body.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown verb: ${verb}` });
  } catch (err) {
    console.error('Admin error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function isAuthorized(password) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!password || !expected) return false;
  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = attempts.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  attempts.set(ip, bucket);
  return bucket.count > RATE_LIMIT_MAX;
}

function defaultOrder(resource) {
  if (resource === 'articles') return 'created_at';
  if (resource === 'projects') return 'updated_at';
  if (resource === 'portfolio') return 'completed_date';
  if (resource === 'links') return 'sort_order';
  return 'created_at';
}

function validateRequired(resource, p) {
  if (resource === 'articles') return p.title && p.url;
  if (resource === 'projects') return p.title;
  if (resource === 'portfolio') return p.name;
  if (resource === 'links') return p.platform && p.url;
  return true;
}

function sanitize(resource, body) {
  const allowed = {
    articles: ['title', 'description', 'url', 'source', 'image_url', 'tag', 'featured', 'published_at'],
    projects: ['title', 'client_name', 'description', 'status', 'progress', 'start_date', 'due_date',
               'hourly_rate', 'budget', 'hours_logged', 'tags', 'show_publicly', 'notes', 'repo_url'],
    portfolio: ['name', 'description', 'repo_url', 'live_url', 'language', 'language_color',
                'tech_stack', 'stars', 'completed_date', 'category', 'pinned'],
    links: ['platform', 'url', 'label', 'sort_order']
  };
  const out = {};
  for (const key of allowed[resource] || []) {
    if (key in body) {
      const v = body[key];
      out[key] = typeof v === 'string' ? v.trim() : v;
    }
  }
  return out;
}

async function fetchMetadata(rawUrl) {
  const checked = validateExternalUrl(rawUrl);
  if (!checked.ok) return { error: checked.error };

  try {
    const response = await fetch(checked.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Signal-AI-Bot/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return { error: `Fetch failed: ${response.status}` };
    const html = await response.text();
    return {
      title: decodeEntities(meta(html, 'og:title') || meta(html, 'twitter:title') || extractTag(html, 'title') || '').trim(),
      description: decodeEntities(meta(html, 'og:description') || meta(html, 'twitter:description') || meta(html, 'description') || '').trim().slice(0, 250),
      image_url: absolutizeUrl(meta(html, 'og:image') || meta(html, 'twitter:image') || '', checked.url),
      source: decodeEntities(meta(html, 'og:site_name') || new URL(checked.url).hostname.replace('www.', '') || '').trim()
    };
  } catch (err) {
    return { error: err.message };
  }
}

function validateExternalUrl(rawUrl) {
  if (!rawUrl) return { ok: false, error: 'No URL provided' };
  try {
    const url = new URL(rawUrl);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: 'Only http and https URLs are supported.' };
    if (blockedHosts.includes(url.hostname) || url.hostname.endsWith('.local')) {
      return { ok: false, error: 'Local and private hostnames are not supported.' };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }
}

function absolutizeUrl(value, base) {
  if (!value) return '';
  try { return new URL(value, base).toString(); } catch { return value.trim(); }
}

function meta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return '';
}

function extractTag(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1] : '';
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}
