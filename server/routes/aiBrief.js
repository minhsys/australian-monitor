import fetch from 'node-fetch'

const BRIEF_INTERVAL_MS = 15 * 60 * 1000
const RETRY_INTERVAL_MS = 60 * 1000

const SYSTEM_PROMPT = `You are a strategic intelligence analyst briefing Australia's National Security Committee.
Analyse these Australian news headlines and produce exactly 3 bullet points.
Focus on: defence & security threats, economic risk indicators, and regional/Pacific stability.
Format each bullet as: "▶ [CATEGORY]: [Assessment, max 35 words]"
Be analytical and concise. Identify patterns, not just facts.`

async function callGPT4o(headlines) {
  const key = process.env.GPT4O_KEY
  if (!key) throw new Error('GPT4O_KEY not set')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Headlines:\n${headlines.join('\n')}` },
      ],
      max_tokens: 300,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenAI response')
  return { brief: text.trim(), model: 'gpt-4o' }
}

async function callGemini(headlines) {
  const key = process.env.GEMINI_KEY
  if (!key) throw new Error('GEMINI_KEY not set')

  const prompt = `${SYSTEM_PROMPT}\n\nHeadlines:\n${headlines.join('\n')}`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  return { brief: text.trim(), model: 'gemini-2.5-flash' }
}

async function callOpenRouter(headlines) {
  const key = process.env.OPENROUTER_KEY
  if (!key) throw new Error('OPENROUTER_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemma-4-31b-it:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Headlines:\n${headlines.join('\n')}` },
      ],
      max_tokens: 300,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenRouter response')
  return { brief: text.trim(), model: 'gemma-4-31b-it:free' }
}

export async function generateAiBrief(newsItems) {
  if (!newsItems?.length) return null
  const headlines = newsItems.slice(0, 20).map(i => `[${i.cat.toUpperCase()}] ${i.text}`)
  const [gpt, gemini, openrouter] = await Promise.allSettled([
    callGPT4o(headlines),
    callGemini(headlines),
    callOpenRouter(headlines),
  ])

  if (gpt.status        === 'fulfilled') return { ...gpt.value,        generatedAt: new Date().toISOString() }
  if (gemini.status     === 'fulfilled') return { ...gemini.value,     generatedAt: new Date().toISOString() }
  if (openrouter.status === 'fulfilled') return { ...openrouter.value, generatedAt: new Date().toISOString() }

  console.warn('[AI BRIEF] All providers failed —', gpt.reason?.message, '/', gemini.reason?.message, '/', openrouter.reason?.message)
  return null
}

export function startAiBriefPoller(broadcast, store) {
  async function poll() {
    if (!store.news?.length) {
      setTimeout(poll, RETRY_INTERVAL_MS)
      return
    }

    const result = await generateAiBrief(store.news)
    if (result) {
      store.aiBrief = result
      broadcast('ai_brief', result)
      console.log(`[AI BRIEF] Generated via ${result.model}`)
      setTimeout(poll, BRIEF_INTERVAL_MS)
    } else {
      console.warn('[AI BRIEF] Generation failed — retrying in 60s')
      setTimeout(poll, RETRY_INTERVAL_MS)
    }
  }

  setTimeout(poll, 30_000)          // first brief after news has loaded
}
