import Link from 'next/link';

import { SampleNotice } from '@/components/SampleNotice';
import { loadAppState } from '@/lib/data';
import { getLocale } from '@/lib/lang';

import { computeBudget, daysInMonth, monthKeyOf } from '@shared/budget';
import { fill, formatCount, formatMoney, formatMonthKey, formatPercent } from '@shared/i18n';

/**
 * لوحة البيانات.
 *
 * البحث في أنماط تطبيقات الميزانية انتهى إلى أنّ اللوحة تجيب ثلاثة
 * أسئلة ولا رابعًا: **كم صرفت؟ وما المتبقّي؟ وما يحتاج انتباهي؟**
 * فهذا ترتيب الشاشة، وكلّ ما سواه نزل إلى صفحة أخرى.
 *
 * والحساب كلّه من `budget.ts` المشترك مع تطبيق الجوّال. لا نسخة
 * ثانية من منطق المال على الويب، فلا رقمان مختلفان للشيء نفسه.
 */
export default async function DashboardPage() {
  const { lang, s } = await getLocale();
  const { state, isLive } = await loadAppState();

  const today = new Date();
  const month = monthKeyOf(today);
  const budget = computeBudget(state, month);
  const cur = state.income.currency;

  const catById = new Map(state.categories.map((c) => [c.id, c]));
  const daysLeft = Math.max(1, daysInMonth(month) - today.getDate() + 1);

  // فئة «خذ المتبقّي» هي حدّ الصرف الحرّ
  const remainderId = state.categories.find((c) => c.monthlyLimit === null)?.id;
  const free =
    budget.categories.find((c) => c.categoryId === remainderId)?.remaining ??
    budget.unallocated;

  const perDay = Math.max(0, Math.floor(free / daysLeft));

  // ما يحتاج انتباهًا أوّلًا: التجاوز ثمّ الاقتراب
  const attention = budget.categories
    .filter((c) => c.state !== 'ok')
    .sort((a, b) => b.ratio - a.ratio);

  const spentRows = [...budget.categories]
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  const totalSpent = spentRows.reduce((a, c) => a + c.spent, 0);

  return (
    <>
      <SampleNotice isLive={isLive} />

      <section className="card hero">
        <div>
          <p className="hero-label" style={{ margin: '0 0 6px' }}>
            {s.home.remaining} · {formatMonthKey(month, lang)}
          </p>
          <p className="hero-figure num" style={{ margin: 0 }}>
            {formatMoney(free, cur, lang)}
          </p>
        </div>

        <dl className="hero-stats" style={{ margin: 0 }}>
          <div className="hero-stat">
            <dt>{s.home.spent}</dt>
            <dd className="num">{formatMoney(budget.spentTotal, cur, lang, { withSymbol: false })}</dd>
          </div>
          <div className="hero-stat">
            <dt>{s.home.reservedFixed}</dt>
            <dd className="num">
              {formatMoney(budget.fixedTotal + budget.installmentsTotal, cur, lang, {
                withSymbol: false,
              })}
            </dd>
          </div>
          <div className="hero-stat">
            <dt>{s.home.dailyAllowance}</dt>
            <dd className="num">{formatMoney(perDay, cur, lang, { withSymbol: false })}</dd>
          </div>
        </dl>
      </section>

      {attention.length > 0 && (
        <>
          <div className="section-head">
            <h2>{s.home.needsAttention}</h2>
            <span className="muted">{formatCount(attention.length, lang)}</span>
          </div>
          <div className="rows">
            {attention.map((c) => {
              const cat = catById.get(c.categoryId);
              if (!cat) return null;
              const over = c.state === 'over';
              return (
                <Link key={c.categoryId} href="/budget" className="row">
                  <span
                    className="dot"
                    style={{ background: over ? 'var(--bad)' : 'var(--warn)' }}
                    aria-hidden="true"
                  />
                  <span className="row-main">
                    <span className="row-title">{cat.name}</span>
                    <span className="row-meta">
                      {over ? s.budget.over : s.budget.near} · {formatPercent(c.ratio, lang)}
                    </span>
                  </span>
                  <span
                    className="row-figure num"
                    style={{ color: over ? 'var(--bad-ink)' : 'var(--warn)' }}
                  >
                    {/* عند البلوغ تمامًا لا يصحّ «تجاوز بمقدار ٠» */}
                    {over && c.remaining === 0
                      ? s.budget.stopHere
                      : over
                        ? fill(s.budget.overBy, {
                            amount: formatMoney(-c.remaining, cur, lang, { withSymbol: false }),
                          })
                        : fill(s.budget.remainingAmount, {
                            amount: formatMoney(c.remaining, cur, lang, { withSymbol: false }),
                          })}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="section-head">
        <h2>{s.home.whereItWent}</h2>
        <Link href="/budget" className="muted">
          {s.budget.title}
        </Link>
      </div>

      {spentRows.length === 0 ? (
        <p className="empty">{s.empty.nothingYet}</p>
      ) : (
        <section className="card">
          <div className="split" style={{ marginBottom: 16 }}>
            {spentRows.map((c) => {
              const cat = catById.get(c.categoryId);
              if (!cat) return null;
              return (
                <span
                  key={c.categoryId}
                  style={{
                    width: `${(c.spent / totalSpent) * 100}%`,
                    background: cat.color,
                  }}
                />
              );
            })}
          </div>

          <div className="rows">
            {spentRows.map((c) => {
              const cat = catById.get(c.categoryId);
              if (!cat) return null;
              return (
                <div
                  key={c.categoryId}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span className="swatch" style={{ background: cat.color }} aria-hidden="true" />
                  <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 14 }}>{cat.name}</span>
                  <span className="muted num" style={{ flex: '0 0 auto' }}>
                    {formatPercent(c.spent / totalSpent, lang)}
                  </span>
                  <span
                    className="row-figure num"
                    style={{ minWidth: 92, textAlign: 'end' }}
                  >
                    {formatMoney(c.spent, cur, lang, { withSymbol: false })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
