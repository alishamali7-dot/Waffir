/**
 * مصدر عيّنة — يعمل بلا حساب.
 *
 * ليس بيانات مخترعة لتزيين الواجهة: يُبنى من نفس بذور الإعداد في
 * [`templates.ts`](../../../templates.ts) ثم تُضاف عمليات شهر واحد،
 * فما تراه هنا هو ما سيراه مستخدم حقيقيّ اختار «راتب شهريّ ثابت»،
 * بنفس الحدود المحسوبة بنسبة من الدخل.
 */

import { seedState } from '@shared/templates';
import { toFils, type AppState, type Attachment, type Transaction } from '@shared/types';
import { monthKeyOf } from '@shared/budget';

import type { DataSource } from './source';

/**
 * فاتورة حقيقية مرفقة بإحدى العمليات.
 *
 * `_localUri` لا `storagePath`: هذا الحقل موجود أصلًا للملفّ الذي
 * يقرأه الجهاز قبل أن يُرفع، وهو بالضبط حال ملفّ في `public/`. فلا
 * نحتاج حيلة للعيّنة — نستعمل المسار الذي صُمّم لهذه الحالة.
 */
const SAMPLE_RECEIPT: Attachment = {
  id: 'sample-receipt-1',
  transactionId: 'sample-tx-5',
  kind: 'image',
  storagePath: 'samples/receipt-rusty-anchor.jpg',
  mimeType: 'image/jpeg',
  byteSize: 94900,
  width: 1400,
  height: 781,
  _localUri: '/samples/receipt-rusty-anchor.jpg',
};

const SAMPLE_INCOME = 1250;
const USER = 'sample-user';

/** مصروفات شهر، موزّعة على فئات وأيّام بما يشبه سلوكًا فعليًّا. */
const SPEND: Array<[day: number, categoryId: string, amount: number, label: string]> = [
  // الإيجار ليس هنا عن قصد: هو التزام ثابت يُخصم تلقائيًّا، فتسجيله
  // عمليةً أيضًا يحسبه مرّتين — وهذا ما يفترض بالتطبيق أن يمنعه،
  // فلا يصحّ أن تُظهره العيّنة.
  [3, 'bills', 18.4, 'كهرباء وماء'],
  [2, 'food', 24.5, 'بقالة'],
  [2, 'cafe', 1.5, 'قهوة'],
  [4, 'transport', 12, 'بنزين'],
  [5, 'food', 18.75, 'بقالة'],
  [6, 'cafe', 8.5, 'غداء خارج البيت'],
  [7, 'health', 6, 'صيدلية'],
  [8, 'kids', 14, 'مستلزمات'],
  [9, 'shopping', 29.9, 'ملابس'],
  [10, 'food', 31.2, 'بقالة ولحم'],
  [11, 'transport', 4, 'غسيل سيارة'],
  [11, 'cafe', 2.25, 'قهوة'],
  [12, 'fun', 4.25, 'اشتراك رقميّ'],
  [12, 'cafe', 8.5, 'عشاء خارج البيت'],
  [13, 'transport', 12, 'بنزين'],
  [13, 'cafe', 1.5, 'قهوة'],
  [13, 'food', 7.65, 'بقالة'],
];

function buildTransactions(month: string, minorUnits: number): Transaction[] {
  return SPEND.map(([day, categoryId, amount, label], i) => ({
    id: `sample-tx-${i}`,
    occurredAt: `${month}-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    amount: toFils(amount, minorUnits),
    direction: 'debit' as const,
    description: label,
    categoryId,
    accountId: 'card',
    source: 'manual' as const,
    needsReview: false,
    dedupeKey: `sample-${i}`,
  }));
}

export class SampleSource implements DataSource {
  readonly kind = 'sample' as const;
  readonly isLive = false;

  async loadState(): Promise<AppState> {
    const month = monthKeyOf(new Date());
    const state = seedState('fixed_salary', SAMPLE_INCOME, 'KWD', 1);
    const mu = state.income.currency.minorUnits;

    // البذرة تضع الالتزامات بمبلغ صفر عن قصد — لا تخترع رقمًا
    // للمستخدم. لكن العيّنة غرضها إظهار الشاشة وهي تعمل، وصفرٌ في
    // «محجوز للالتزامات» لا يُظهر شيئًا. فنملؤها هنا، في العيّنة
    // وحدها، لا في البذرة.
    const amounts: Record<string, number> = { rent: 320, utilities: 38, phone: 12 };

    return {
      ...state,
      commitments: state.commitments.map((c) => ({
        ...c,
        amount: toFils(amounts[c.id] ?? 0, mu),
      })),
      transactions: buildTransactions(month, mu),
      attachments: [SAMPLE_RECEIPT],
    };
  }
}

export const SAMPLE_USER_ID = USER;
