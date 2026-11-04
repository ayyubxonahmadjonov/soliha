/* Receives a wish from the site and hands it to the Telegram bot. It stores nothing.
   The token lives in this project's environment because the site's own code is public:
   whoever holds the token could read back everything the bot has received. */
const ORIGIN = 'https://ayyubxonahmadjonov.github.io';
const MAX_TEXT = 1500, MAX_PHOTO = 4 * 1024 * 1024;   // Vercel caps a request at 4.5 MB

const reply = status => new Response(null, {
  status,
  headers: { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
});

async function telegram(method, fields) {
  const body = new FormData();
  body.set('chat_id', process.env.CHAT_ID);
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const r = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, { method: 'POST', body });
  if (!r.ok) throw new Error(`${method} answered ${r.status}`);
}

export function OPTIONS() {
  return reply(204);
}

export async function POST(req) {
  if (req.headers.get('origin') !== ORIGIN) return reply(403);

  let form;
  try { form = await req.formData(); } catch { return reply(400); }
  const text = String(form.get('text') || '').trim().slice(0, MAX_TEXT);
  const photo = form.get('photo');
  const hasPhoto = photo && typeof photo !== 'string' && photo.size > 0;
  if (!text && !hasPhoto) return reply(400);
  if (hasPhoto && photo.size > MAX_PHOTO) return reply(413);

  try {
    await telegram('sendMessage', { text: `🕯 Saytdan yangi tilak${text ? `:\n\n${text}` : ' (faqat rasm)'}` });
    if (hasPhoto) await telegram('sendPhoto', { photo });
    return reply(204);
  } catch (e) {
    console.error(e.message);
    return reply(502);
  }
}
