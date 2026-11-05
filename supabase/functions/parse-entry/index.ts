// parse-entry — يفهم ما كتبه المستخدم بالعاميّة ويقترح حقول العملية.
//
// موقعها من `quickEntry.ts`: الأخيرة تعمل أوّلًا، مجّانًا وبلا إنترنت،
// وتكفي لـ«قهوة ١٫٥». هذه الدالّة تُستدعى حين تقصُر القواعد وحدها:
//  • رقمٌ بالحروف: «بخمسة دنانير»، «ثلاثة ونص»
//  • تاريخٌ نسبيّ: «أمس»، «الخميس اللي فات» — وقواعدنا لا تعرف التاريخ
//  • فئةٌ بلا كلمةٍ مفتاحيّة مسجّلة
//
// حدودٌ مقصودة:
//  • تقترح ولا تكتب. لا INSERT هنا؛ الحقول تُعرض في النموذج ليؤكّدها.
//  • الفئات والعملة تُقرأان من القاعدة بتوكن المستخدم، لا من جسم الطلب:
//    قائمةٌ يبعثها العميل قائمةٌ يمكن أن تُزوَّر.
//  • `category_id` العائد يُطابق قائمةَ المستخدم أو يُرفض. النموذج لا
//    يخترع معرّفًا ويمرّ.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseAmountToMinor } from '../_shared/parse-amount.ts';

const MAX_TEXT = 500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const MODEL = Deno.env.get('OPENROUTER_MODEL') ?? 'google/gemini-2.5-flash';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** يومٌ واحدٌ قُدُمًا يكفي لفروق المناطق الزمنيّة؛ ما بعده ليس مصروفًا وقع. */
const MAX_FUTURE_DAYS = 1;
const MAX_PAST_DAYS = 730;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  let body: { text?: string; today?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'missing_text' }, 400);
  if (text.length > MAX_TEXT) return json({ error: 'text_too_long', max: MAX_TEXT }, 413);

  // يوم المستخدم لا يوم السيرفر: الكويت تتقدّم UTC بثلاث ساعات، فـ«اليوم»
  // عنده قد يكون «غدًا» عندنا. العميل يبعث تاريخه، ونتحقّق من شكله.
  const today = typeof body.today === 'string' && ISO_DATE.test(body.today)
    ? body.today
    : new Date().toISOString().slice(0, 10);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'invalid_token' }, 401);

  const [{ data: categories, error: catError }, { data: profile }] = await Promise.all([
    supabase.from('categories')
      .select('id, name, keywords')
      .eq('archived', false)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase.from('profiles').select('currency_code').maybeSingle(),
  ]);

  if (catError) return json({ error: 'lookup_failed', detail: catError.message }, 500);
  if (!categories || categories.length === 0) return json({ error: 'no_categories' }, 409);

  const currency = (profile?.currency_code ?? 'KWD').toUpperCase();

  const allowed = new Set(categories.map((c) => String(c.id)));
  const catalogue = categories
    .map((c) => {
      const kws = Array.isArray(c.keywords) && c.keywords.length
        ? ` (${c.keywords.slice(0, 8).join(', ')})`
        : '';
      return `${c.id} = ${c.name}${kws}`;
    })
    .join('\n');

  const system = [
    'You turn one short, informally written spending note into structured fields.',
    'The writer is logging their own expense, often in Gulf/Kuwaiti Arabic dialect, sometimes in English.',
    '',
    'Rules:',
    `- Today is ${today}. Resolve relative dates ("أمس", "اول امس", "الخميس اللي فات", "yesterday") against it. Return YYYY-MM-DD, or null if no time is mentioned.`,
    `- The writer's currency is ${currency}. Return the amount as digits only, e.g. "3.5" for "ثلاثة ونص" and "5" for "بخمسة دنانير". No currency symbol, no thousands separators.`,
    '- If several numbers appear, return the one actually paid in total.',
    '- Pick category_id from this list and copy the id EXACTLY. Use null if none fits:',
    catalogue,
    '- label: a short name for the expense in the writer\'s own words, without the amount.',
    '- Return null for anything not stated. Do not invent an amount, a date, or a category.',
    '- confidence reflects the amount only: high if stated plainly, low if you inferred it.',
  ].join('\n');

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'entry',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['amount', 'label', 'category_id', 'date', 'confidence'],
          properties: {
            amount: { type: ['string', 'null'] },
            label: { type: ['string', 'null'] },
            category_id: { type: ['string', 'null'] },
            date: { type: ['string', 'null'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
        },
      },
    },
    provider: { require_parameters: true },
    temperature: 0,
    max_tokens: 300,
  };

  // يُفحص هنا لا في الأعلى: الهويّة والمدخلات تُفحص أوّلًا، فلا يُخبَر
  // مجهولٌ بحال إعدادات السيرفر، ولا يُحجب خطأُ مدخلٍ خلف نقص مفتاح.
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return json({ error: 'missing_openrouter_key' }, 500);

  let orResponse: Response;
  try {
    orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Mwaffir quick entry',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: 'openrouter_unreachable', detail: String(e) }, 502);
  }

  if (!orResponse.ok) {
    const detail = (await orResponse.text()).slice(0, 500);
    return json({ error: 'openrouter_failed', status: orResponse.status, detail }, 502);
  }

  const completion = await orResponse.json();
  const raw = completion?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') return json({ error: 'empty_completion' }, 502);

  let fields: Record<string, unknown>;
  try {
    fields = JSON.parse(raw);
  } catch {
    return json({ error: 'unparseable_completion', detail: raw.slice(0, 300) }, 502);
  }

  const amountText = typeof fields.amount === 'string' ? fields.amount : null;
  const amountMinor = amountText ? parseAmountToMinor(amountText, currency) : null;

  // معرّفٌ ليس في قائمة المستخدم يُطرح: النموذج لا يخترع فئة.
  const categoryId = typeof fields.category_id === 'string' && allowed.has(fields.category_id)
    ? fields.category_id
    : null;

  let date: string | null = null;
  if (typeof fields.date === 'string' && ISO_DATE.test(fields.date) && !Number.isNaN(Date.parse(fields.date))) {
    const delta = daysBetween(fields.date, today);
    if (delta <= MAX_FUTURE_DAYS && delta >= -MAX_PAST_DAYS) date = fields.date;
  }

  return json({
    suggestion: {
      amount_text: amountText,
      amount_minor: amountMinor,
      currency,
      label: typeof fields.label === 'string' ? fields.label.slice(0, 80) : null,
      category_id: categoryId,
      date,
      confidence: fields.confidence === 'high' || fields.confidence === 'medium'
        ? fields.confidence
        : 'low',
      model: completion?.model ?? MODEL,
    },
  });
});
