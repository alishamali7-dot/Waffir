import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsAssist, mentionsDate, mergeAssist, localToday, assistedQuickEntry, type EntrySuggestion } from './quickEntryAssist.ts';
import { parseQuickEntry, type ParsedEntry } from './quickEntry.ts';
import type { Category } from './types.ts';

const cats: Category[] = [
  {
    id: 'cat-food', name: 'أكل وشراب', color: '#E8590C', icon: 'food',
    monthlyLimit: 60000, keywords: ['قهوة', 'مطعم'], sortOrder: 1, archived: false,
  },
  {
    id: 'cat-other', name: 'متنوّع', color: '#868E96', icon: 'dots',
    monthlyLimit: null, keywords: [], sortOrder: 9, archived: false,
  },
] as Category[];

function suggestion(over: Partial<EntrySuggestion> = {}): EntrySuggestion {
  return {
    amount_text: '3.5', amount_minor: 3500, currency: 'KWD',
    label: 'قهوة', category_id: 'cat-food', date: '2026-11-02',
    confidence: 'high', model: 'test', ...over,
  };
}

test('القواعد تكفي: مبلغ وكلمة مفتاحيّة ← لا استدعاء', () => {
  const parsed = parseQuickEntry('قهوة 1.5', cats);
  assert.equal(parsed.matchedBy, 'keyword');
  assert.equal(needsAssist(parsed), false);
});

test('بلا مبلغ ← يستحقّ الاستدعاء', () => {
  const parsed = parseQuickEntry('قهوة بثلاثة ونص', cats);
  assert.equal(parsed.amount, null);
  assert.equal(needsAssist(parsed), true);
});

test('بلا كلمة مفتاحيّة ← يستحقّ الاستدعاء ولو وُجد المبلغ', () => {
  const parsed = parseQuickEntry('بنشر 7', cats);
  assert.notEqual(parsed.matchedBy, 'keyword');
  assert.equal(needsAssist(parsed), true);
});

test('رقم المستخدم لا يُنقَض باقتراح النموذج', () => {
  const parsed = parseQuickEntry('بنشر 7', cats);
  const merged = mergeAssist(parsed, suggestion({ amount_minor: 3500 }));
  assert.equal(merged.amount, 7000); // ٧ دنانير كما كتبها، لا ٣٫٥
  assert.equal(merged.amountIsSuggestion, false);
});

test('المبلغ الغائب يُملأ ويُوسَم اقتراحًا', () => {
  const parsed = parseQuickEntry('قهوة بثلاثة ونص', cats);
  const merged = mergeAssist(parsed, suggestion());
  assert.equal(merged.amount, 3500);
  assert.equal(merged.amountIsSuggestion, true);
  assert.equal(merged.assisted, true);
});

test('الكلمة المفتاحيّة المتعلَّمة تهزم فئة النموذج', () => {
  const parsed = parseQuickEntry('قهوة 1.5', cats);
  const merged = mergeAssist(parsed, suggestion({ category_id: 'cat-other' }));
  assert.equal(merged.categoryId, 'cat-food');
  assert.equal(merged.matchedBy, 'keyword');
  assert.equal(merged.suggestedCategoryId, null);
});

test('فئة النموذج تحلّ محلّ سلّة المتنوّع', () => {
  const parsed = parseQuickEntry('بنشر 7', cats);
  assert.equal(parsed.categoryId, 'cat-other');
  const merged = mergeAssist(parsed, suggestion({ category_id: 'cat-food' }));
  assert.equal(merged.categoryId, 'cat-food');
  assert.equal(merged.suggestedCategoryId, 'cat-food');
});

test('التاريخ من النموذج وحده — القواعد لا تعرفه', () => {
  const parsed = parseQuickEntry('قهوة 1.5', cats);
  assert.equal((parsed as ParsedEntry & { date?: string }).date, undefined);
  assert.equal(mergeAssist(parsed, suggestion({ date: '2026-11-01' })).date, '2026-11-01');
  assert.equal(mergeAssist(parsed, null).date, null);
});

test('بلا اقتراح: ناتج القواعد يمرّ كما هو', () => {
  const parsed = parseQuickEntry('قهوة 1.5', cats);
  const merged = mergeAssist(parsed, null);
  assert.equal(merged.amount, 1500);
  assert.equal(merged.assisted, false);
  assert.equal(merged.amountIsSuggestion, false);
});

test('تاريخ اليوم محلّيّ لا UTC', () => {
  // ٣ نوفمبر ٢:٠٠ صباحًا بتوقيت الكويت هو ٢ نوفمبر ٢٣:٠٠ بـUTC.
  // toISOString كان سيُعطي اليوم السابق.
  assert.equal(localToday(new Date(2026, 10, 3, 2, 0, 0)), '2026-11-03');
  assert.equal(localToday(new Date(2026, 0, 9)), '2026-01-09');
});

test('فشل الشبكة لا يُفقد ناتج القواعد', async () => {
  const client = {
    functions: {
      invoke: async () => { throw new Error('offline'); },
    },
  };
  const out = await assistedQuickEntry(client, 'بنشر 7', cats);
  assert.equal(out.ok, false);
  assert.equal(out.entry.amount, 7000);
  if (!out.ok) assert.match(out.error, /offline/);
});

test('خطأ الدالّة يعود بسببه لا بانهيار', async () => {
  const client = {
    functions: {
      invoke: async () => ({ data: { error: 'missing_openrouter_key' }, error: null }),
    },
  };
  const out = await assistedQuickEntry(client, 'قهوة بثلاثة ونص', cats);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.error, 'missing_openrouter_key');
  assert.equal(out.entry.amount, null); // القواعد لم تجد مبلغًا، ولا نخترعه
});

test('لا استدعاء حين تكفي القواعد', async () => {
  let called = 0;
  const client = {
    functions: {
      invoke: async () => { called++; return { data: { suggestion: suggestion() }, error: null }; },
    },
  };
  const out = await assistedQuickEntry(client, 'قهوة 1.5', cats);
  assert.equal(called, 0);
  assert.equal(out.ok, true);
  assert.equal(out.entry.amount, 1500);

  // force يتجاوز القواعد عند طلب المستخدم صراحةً
  await assistedQuickEntry(client, 'قهوة 1.5', cats, { force: true });
  assert.equal(called, 1);
});

test('كلمة زمنيّة تستدعي النموذج ولو كفت القواعد للمبلغ والفئة', () => {
  assert.equal(needsAssist(parseQuickEntry('قهوة 1.5 امس', cats)), true);
  assert.equal(needsAssist(parseQuickEntry('قهوة 1.5 أمس', cats)), true);
  assert.equal(needsAssist(parseQuickEntry('قهوة 1.5 يوم الخميس', cats)), true);
  assert.equal(needsAssist(parseQuickEntry('قهوة 1.5 yesterday', cats)), true);
  // لا شيء زمنيّ: تبقى بلا شبكة
  assert.equal(needsAssist(parseQuickEntry('قهوة 1.5', cats)), false);
  // «أمسية» ليست «أمس»
  assert.equal(mentionsDate('قهوة أمسية'), false);
});

test('المسار كاملًا يستدعي النموذج لـ«امس» ويحفظ رقم المستخدم', async () => {
  let called = 0;
  const client = {
    functions: {
      invoke: async () => {
        called++;
        return { data: { suggestion: suggestion({ amount_minor: 9000, date: '2026-11-04', label: 'قهوة', category_id: 'cat-other' }) }, error: null };
      },
    },
  };
  const out = await assistedQuickEntry(client, 'قهوة 1.5 امس', cats, { minorUnits: 3 });
  assert.equal(called, 1);
  assert.equal(out.entry.amount, 1500);
  assert.equal(out.entry.categoryId, 'cat-food');
  assert.equal(out.entry.date, '2026-11-04');
  assert.equal(out.entry.label, 'قهوة');
});

test('الخانات تصل إلى القواعد في المسار كاملًا', async () => {
  const client = { functions: { invoke: async () => ({ data: null, error: new Error('no') }) } };
  const out = await assistedQuickEntry(client, 'بنشر 1.5', cats, { minorUnits: 2 });
  assert.equal(out.entry.amount, 150);
});
