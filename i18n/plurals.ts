/**
 * العدد والمعدود.
 *
 * هذا الملف موجود لأن «٢ حسابات» خطأ نحويّ صريح، و«١ عمليات» أسوأ.
 * العربية تميّز ستّ حالات حيث تميّز الإنجليزية حالتين، ولا تُحلّ
 * المسألة بجمع واحد مع رقم أمامه.
 *
 * القاعدة (وهي نفسها تصنيف CLDR للعربية):
 *
 * | العدد | الحالة | المثال |
 * |---|---|---|
 * | ٠ | zero | لا توجد عمليات |
 * | ١ | one | عملية واحدة |
 * | ٢ | two | عمليتان — مثنّى، لا «٢ عمليات» |
 * | ٣–١٠ | few | ٣ عمليات — جمع |
 * | ١١–٩٩ | many | ٢٥ عملية — مفرد منصوب |
 * | ١٠٠+ | other | ١٠٠ عملية — مفرد مجرور |
 *
 * «few» و«many» تُحسبان على باقي القسمة على ١٠٠: فـ١٠٥ حالتها few
 * (١٠٥ عمليات)، و١١٥ حالتها many (١١٥ عملية).
 *
 * الإنجليزية تستخدم one للواحد و other لما سواه، فتُهمل البقيّة.
 */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** تصنيف العربية. مطابق لقواعد CLDR، لا اجتهاد. */
export function arabicCategory(n: number): PluralCategory {
  if (!Number.isFinite(n)) return 'other';
  const abs = Math.abs(Math.trunc(n));
  if (abs === 0) return 'zero';
  if (abs === 1) return 'one';
  if (abs === 2) return 'two';
  const mod100 = abs % 100;
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  if (mod100 >= 11 && mod100 <= 99) return 'many';
  return 'other';
}

export function englishCategory(n: number): PluralCategory {
  return Math.abs(Math.trunc(n)) === 1 ? 'one' : 'other';
}

/** صيغ المعدود. العربية تلزمها الحالات الستّ، الإنجليزية ثنتان. */
export type PluralForms = Partial<Record<PluralCategory, string>> & {
  other: string;
};

type Countable =
  | 'account'
  | 'category'
  | 'goal'
  | 'entry'
  | 'item'
  | 'day'
  | 'month'
  | 'streakDay'
  | 'dismissed';

export const AR_PLURALS: Record<Countable, PluralForms> = {
  account: {
    zero: 'لا توجد حسابات',
    one: 'حساب واحد',
    two: 'حسابان',
    few: '{n} حسابات',
    many: '{n} حسابًا',
    other: '{n} حساب',
  },
  category: {
    zero: 'لا توجد فئات',
    one: 'فئة واحدة',
    two: 'فئتان',
    few: '{n} فئات',
    many: '{n} فئة',
    other: '{n} فئة',
  },
  goal: {
    zero: 'لا توجد أهداف',
    one: 'هدف واحد',
    two: 'هدفان',
    few: '{n} أهداف',
    many: '{n} هدفًا',
    other: '{n} هدف',
  },
  entry: {
    zero: 'لا توجد عمليات',
    one: 'عملية واحدة',
    two: 'عمليتان',
    few: '{n} عمليات',
    many: '{n} عملية',
    other: '{n} عملية',
  },
  item: {
    zero: 'لا توجد بنود',
    one: 'بند واحد',
    two: 'بندان',
    few: '{n} بنود',
    many: '{n} بندًا',
    other: '{n} بند',
  },
  day: {
    zero: 'لم يبق يوم',
    one: 'يوم واحد',
    two: 'يومان',
    few: '{n} أيام',
    many: '{n} يومًا',
    other: '{n} يوم',
  },
  month: {
    zero: 'لا أشهر',
    one: 'شهر واحد',
    two: 'شهران',
    few: '{n} أشهر',
    many: '{n} شهرًا',
    other: '{n} شهر',
  },
  streakDay: {
    zero: 'لم تبدأ بعد',
    one: 'يوم واحد متواصل',
    two: 'يومان متواصلان',
    few: '{n} أيام متواصلة',
    many: '{n} يومًا متواصلًا',
    other: '{n} يوم متواصل',
  },
  dismissed: {
    zero: 'لم تتجاهل شيئًا',
    one: 'متجاهَل واحد',
    two: 'متجاهَلان',
    few: '{n} متجاهَلة',
    many: '{n} متجاهَلًا',
    other: '{n} متجاهَل',
  },
};

export const EN_PLURALS: Record<Countable, PluralForms> = {
  account: { zero: 'No accounts', one: '1 account', other: '{n} accounts' },
  category: { zero: 'No categories', one: '1 category', other: '{n} categories' },
  goal: { zero: 'No goals', one: '1 goal', other: '{n} goals' },
  entry: { zero: 'No entries', one: '1 entry', other: '{n} entries' },
  item: { zero: 'No items', one: '1 item', other: '{n} items' },
  day: { zero: 'No days left', one: '1 day', other: '{n} days' },
  month: { zero: 'No months', one: '1 month', other: '{n} months' },
  streakDay: {
    zero: 'Not started',
    one: '1 day in a row',
    other: '{n} days in a row',
  },
  dismissed: { zero: 'None dismissed', one: '1 dismissed', other: '{n} dismissed' },
};

export type { Countable };

/**
 * يختار الصيغة ويضع الرقم.
 *
 * `digits` يحوّل الرقم لأرقام عربية-هندية. نستعمله للأعداد في النصّ
 * («٢٥ عملية») ولا نستعمله للمال أبدًا: المبالغ تُقرأ أسرع بالصيغة
 * اللاتينية، وهذا عُرف تطبيقات الخليج.
 */
export function plural(
  lang: 'ar' | 'en',
  kind: Countable,
  n: number,
  digits = lang === 'ar',
): string {
  const table = lang === 'ar' ? AR_PLURALS : EN_PLURALS;
  const forms = table[kind];

  /**
   * الصفر يُقدَّم على التصنيف.
   *
   * CLDR للإنجليزية تعرف صيغتين فقط (one/other)، فالصفر يقع في other
   * ويخرج «0 entries» — صحيح نحويًّا وركيك في الواجهة. فمتى أعلنت
   * القائمة صيغة `zero` استعملناها في اللغتين: «No entries» و«لا توجد
   * عمليات». هذا اختيار واجهة فوق القاعدة، لا مخالفة لها.
   */
  if (Math.trunc(n) === 0 && forms.zero) return forms.zero;

  const category = lang === 'ar' ? arabicCategory(n) : englishCategory(n);
  const template = forms[category] ?? forms.other;
  const shown = digits ? toArabicDigits(n) : String(Math.trunc(n));
  return template.replace('{n}', shown);
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}
