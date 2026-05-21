const { handleCors, sendJson, readJson } = require('../_supabase')
const { normalizeCraftsPayload, verifyAdminSecret } = require('../../lib/crafts-store')

const VISION_PROMPT = `You extract Minecraft craft recipe data from a Korean game screenshot.
Return ONLY valid JSON (no markdown) in this shape:
{
  "crafts": [
    {
      "name": "item name in Korean",
      "price": 12345,
      "timeMinutes": 1,
      "inputs": [{ "name": "material", "count": 1 }]
    }
  ]
}
Rules:
- "group" is always craft (공예품).
- price is integer gold (G, 골드).
- timeMinutes is craft duration in minutes (제작 시간).
- Include every craft recipe visible in the image.
- Use exact Korean names from the image.`

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const auth = verifyAdminSecret(req)
  if (!auth.ok) {
    sendJson(res, 401, { error: auth.error })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    sendJson(res, 500, { error: 'OPENAI_API_KEY not configured' })
    return
  }

  try {
    const body = await readJson(req)
    const imageBase64 = String(body.imageBase64 || '').trim()
    const mimeType = String(body.mimeType || 'image/png').trim()
    if (!imageBase64) {
      sendJson(res, 400, { error: 'imageBase64 is required' })
      return
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      sendJson(res, 502, { error: 'Vision API failed', detail: errText.slice(0, 500) })
      return
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content || '{}'
    let parsed = {}
    try {
      parsed = JSON.parse(content)
    } catch (_) {
      sendJson(res, 502, { error: 'Vision response was not valid JSON', raw: content.slice(0, 800) })
      return
    }

    const catalog = normalizeCraftsPayload({
      version: 1,
      updatedAt: new Date().toISOString(),
      crafts: parsed.crafts || (parsed.name ? [parsed] : [])
    })

    sendJson(res, 200, {
      catalog,
      model: result.model || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      usage: result.usage || null
    })
  } catch (error) {
    sendJson(res, 500, { error: String(error.message || error) })
  }
}
