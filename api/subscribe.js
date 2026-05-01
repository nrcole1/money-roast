// /api/subscribe.js
// Stores newsletter signups in Supabase when configured, with webhook fallback.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const email = (body?.email || '').trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return res.status(400).json({ error: 'Please enter a valid email.' });

  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const { error } = await supabase
        .from('subscribers')
        .upsert({ email, source: 'website' }, { onConflict: 'email' });
      if (error) throw error;
    } else {
      console.log('NEW_SUBSCRIBER:', email, 'at', new Date().toISOString());
    }

    if (process.env.NOTIFY_WEBHOOK) {
      await fetch(process.env.NOTIFY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `New Signal/AI subscriber: ${email}`,
          text: `New Signal/AI subscriber: ${email}`
        })
      }).catch(err => console.error('Webhook failed:', err.message));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
  }
}
