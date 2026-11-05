// تحويل المبلغ كما طُبع على الفاتورة إلى وحداتٍ صغرى صحيحة.
//
// النموذج يُعيد المبلغ نصًّا كما قرأه، والحساب يجري هنا لا عنده: ضرب
// العشريّات داخل نموذجٍ لغويّ ليس حسابًا يُعتمد عليه في المال.
//
// هذا الملفّ لا يستورد شيئًا — يعمل في Deno داخل الدالّة، وفي Node داخل
// الاختبار، بلا تهيئةٍ لأيّهما.

/** حيث تخالف ISO 4217 الاثنتين المعتادتين. */
const MINOR_UNITS: Readonly<Record<string, number>> = {
  KWD: 3, BHD: 3, OMR: 3, JOD: 3, TND: 3, LYD: 3, IQD: 3,
  JPY: 0, KRW: 0, VND: 0, CLP: 0, ISK: 0, XAF: 0, XOF: 0,
};

/** الاثنتان هما الغالب، فهما الافتراض عند عملةٍ لا نعرفها. */
export const ISO_DEFAULT_MINOR_UNITS = 2;

export function minorUnitsFor(currency: string): number {
  if (typeof currency !== 'string') return ISO_DEFAULT_MINOR_UNITS;
  return MINOR_UNITS[currency.trim().toUpperCase()] ?? ISO_DEFAULT_MINOR_UNITS;
}

const AR_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC = '۰۱۲۳۴۵۶۷۸۹'; // أرقامٌ فارسيّة، تظهر على بعض الفواتير

/**
 * توحيد الأرقام: ١٢٫٧٥٠ و۱۲٫۷۵۰ و12.750 تصير صورةً واحدة.
 * الفاتورة الكويتيّة تُطبع بالعربيّة كثيرًا، فهذه ليست حالةً نادرة.
 */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const ai = AR_INDIC.indexOf(ch);
    if (ai >= 0) { out += String(ai); continue; }
    const fa = EXT_ARABIC.indexOf(ch);
    if (fa >= 0) { out += String(fa); continue; }
    out += ch;
  }
  return out;
}

// الفاصلة العشريّة العربيّة (٫) تُقرأ نقطةً، وفاصلة الآلاف العربيّة (٬)
// تُقرأ فاصلة. الخلط بينهما هو ما يحوّل ١٢٫٧٥٠ إلى اثني عشر ألفًا.
const DECIMAL_LIKE = new Set(['.', '٫']);
const GROUP_LIKE = new Set([',', '٬']);
const DROPPED = new Set([' ', ' ', ' ', "'", '’']);

/** ما فوقه قراءةٌ خاطئة لا فاتورة. */
const SANE_MAX_MINOR = 1e15;

/**
 * يُعيد المبلغ بالوحدات الصغرى، أو null إن كان النصّ ملتبسًا.
 *
 * الالتباس يُرفض ولا يُخمَّن: رقمٌ خاطئ يمرّ بثقةٍ أسوأ من رقمٍ لم يُقرأ،
 * لأنّ المستخدم يراجع ما ظهر له ولا يراجع ما لم يظهر. «12.750» بالدولار
 * مثالُه: هي إمّا 12.75 وإمّا 12,750، وبينهما ألفُ ضعف.
 *
 * القيمة مطلقة؛ اتّجاه العملية (مصروف أم دخل) يُقرَّر فوق هذه الدالّة.
 */
export function parseAmountToMinor(raw: string, currency: string): number | null {
  if (typeof raw !== 'string') return null;

  const minor = minorUnitsFor(currency);

  // نُبقي الأرقام والفواصل وحدها: رموز العملة والمسافات تسقط.
  let cleaned = '';
  for (const ch of normalizeDigits(raw)) {
    if (ch >= '0' && ch <= '9') cleaned += ch;
    else if (DECIMAL_LIKE.has(ch)) cleaned += '.';
    else if (GROUP_LIKE.has(ch)) cleaned += ',';
    else if (DROPPED.has(ch)) continue;
  }
  if (!/[0-9]/.test(cleaned)) return null;

  // فاصلةٌ طرفيّة ليست عشريّة: «12.750 د.ك» تُخرج نقطةَ الرمز، ولو بقيت
  // لحُسب الكسر فارغًا فصار المبلغ ألفَ ضعفه.
  cleaned = cleaned.replace(/^[.,]+/, '').replace(/[.,]+$/, '');
  if (!cleaned) return null;

  const cut = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));

  let whole: string;
  let fraction: string;

  if (cut < 0) {
    whole = cleaned;
    fraction = '';
  } else {
    const cutChar = cleaned[cut];
    const tail = cleaned.slice(cut + 1).replace(/[^0-9]/g, '');
    const head = cleaned.slice(0, cut).replace(/[^0-9]/g, '');

    if (tail.length === minor) {
      // ١٢٫٧٥٠ بالدينار، و12.50 بالدولار.
      whole = head;
      fraction = tail;
    } else if (tail.length < minor) {
      // 12.5 بالدينار: تُكمَّل أصفارًا يمينًا (12.500 لا 12.005).
      whole = head;
      fraction = tail.padEnd(minor, '0');
    } else if (tail.length === 3 && cutChar === ',') {
      // 1,250 بالدولار: فاصلةُ آلافٍ صريحة.
      whole = head + tail;
      fraction = '';
    } else {
      // لا هي عشريّةٌ ولا آلاف. لا نُخمِّن.
      return null;
    }
  }

  whole = whole.replace(/[^0-9]/g, '') || '0';
  const combined = (whole + fraction.padEnd(minor, '0')).replace(/^0+(?=\d)/, '');
  const value = Number(combined);

  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) return null;
  if (value > SANE_MAX_MINOR) return null;
  return value;
}
