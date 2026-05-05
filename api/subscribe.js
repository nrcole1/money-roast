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

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM_EMAIL || 'EyeOnAI <onboarding@resend.dev>',
          to: email,
          subject: 'You\'re subscribed to EyeOnAI',
          text: [
            'You\'re in.',
            '',
            'Every Sunday you\'ll get the 5 things in AI that actually mattered that week, plus one tool worth testing.',
            '',
            'No hype, no threads, no hedging — just signal.',
            '',
            '— Noah Coleman',
            'EyeOnAI · eyeonai.vercel.app',
            '',
            'To unsubscribe, reply with "unsubscribe" in the subject line.'
          ].join('\n'),
          html: `
            <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#05080f;color:#e6edf7;">
              <p style="font-size:28px;font-weight:700;margin:0 0 24px;letter-spacing:-0.02em;">You're in.</p>
              <p style="color:#8a96ac;line-height:1.6;margin:0 0 16px;">Every Sunday you'll get the 5 things in AI that actually mattered that week, plus one tool worth testing.</p>
              <p style="color:#8a96ac;line-height:1.6;margin:0 0 32px;">No hype, no threads, no hedging — just signal.</p>
              <p style="color:#e6edf7;margin:0 0 4px;">— Noah Coleman</p>
              <p style="color:#546075;font-size:13px;margin:0 0 40px;"><a href="https://eyeonai.vercel.app" style="color:#4d8dff;text-decoration:none;">EyeOnAI · eyeonai.vercel.app</a></p>
              <p style="color:#546075;font-size:11px;margin:0;">To unsubscribe, reply with "unsubscribe" in the subject line.</p>
            </div>
          `
        })
      }).catch(err => console.error('Resend welcome email failed:', err.message));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
  }
}
