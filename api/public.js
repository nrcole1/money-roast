// /api/public.js
// Public read-only endpoint for the projects.html page.
// Returns links, portfolio items, and a sanitized view of ongoing projects
// (only those with show_publicly = true, and only non-sensitive fields).

import { createClient } from '@supabase/supabase-js';

let cache = { data: null, ts: 0 };
const CACHE_MS = 60 * 1000; // 1 min — balances freshness with cold-start cost

export default async function handler(req, res) {
  try {
    if (cache.data && Date.now() - cache.ts < CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(cache.data);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // RLS ensures only public rows come back, but we also explicitly strip sensitive fields
    const [linksRes, portfolioRes, projectsRes] = await Promise.all([
      supabase.from('links').select('*').order('sort_order', { ascending: true }),
      supabase.from('portfolio_items').select('*').order('pinned', { ascending: false }).order('completed_date', { ascending: false }),
      supabase.from('projects').select('id, title, description, status, progress, tags, start_date, due_date').eq('show_publicly', true).order('updated_at', { ascending: false })
    ]);

    const payload = {
      links: linksRes.data || [],
      portfolio: portfolioRes.data || [],
      projects: projectsRes.data || []
    };

    cache = { data: payload, ts: Date.now() };
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Public API error:', err.message);
    return res.status(500).json({ error: err.message, links: [], portfolio: [], projects: [] });
  }
}
