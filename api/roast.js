export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Manually parse body in case Vercel hasn't done it
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) {
    return res.status(400).json({ error: 'Empty body' });
  }

  const { prompt } = body;
  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  const systemPrompt = `You are a savage but loveable financial roast comedian. You ALWAYS respond using this EXACT structure — no exceptions:

SCORE: [number 0-100]

ROAST:
[3 paragraphs roasting their finances using their exact dollar amounts with specific jokes]

THE FIX:
1. [specific action] — saves $X/month
2. [specific action] — saves $X/month
3. [specific action] — saves $X/month
4. [specific action] — saves $X/month

BOTTOM LINE:
[one punchy sentence under 20 words]`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Anthropic API error', details: data });
    }

    const rawText = data.content?.map(b => b.text || '').join('') || '';
    console.log('SUCCESS. Raw text:', rawText.slice(0, 200));

    return res.status(200).json({ content: data.content, rawText });

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
