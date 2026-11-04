/* Receives a wish from the site and hands it to the Telegram bot. It stores nothing.
   The token lives here as a secret because the site's own code is public: whoever
   holds the token could read back everything the bot has received. */
const ORIGIN = 'https://ayyubxonahmadjonov.github.io';
const MAX_TEXT = 1500, MAX_PHOTO = 10 * 1024 * 1024;
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
const reply = status => new Response(null, { status, headers: cors });

async function telegram(env, method, fields) {
  const body = new FormData();
  body.set('chat_id', env.CHAT_ID);
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', body });
  if (!r.ok) throw new Error(`${method} answered ${r.status}`);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return reply(204);
    if (req.method !== 'POST') return reply(405);
    if (req.headers.get('Origin') !== ORIGIN) return reply(403);

    let form;
    try { form = await req.formData(); } catch { return reply(400); }
    const text = String(form.get('text') || '').trim().slice(0, MAX_TEXT);
    const photo = form.get('photo');
    const hasPhoto = photo && typeof photo !== 'string' && photo.size > 0;
    if (!text && !hasPhoto) return reply(400);
    if (hasPhoto && photo.size > MAX_PHOTO) return reply(413);

    try {
      await telegram(env, 'sendMessage', { text: `🕯 Saytdan yangi tilak${text ? `:\n\n${text}` : ' (faqat rasm)'}` });
      if (hasPhoto) await telegram(env, 'sendPhoto', { photo });
      return reply(204);
    } catch (e) {
      console.error(e.message);
      return reply(502);
    }
  }
};
