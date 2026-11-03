import { SampleNotice } from '@/components/SampleNotice';
import { loadAppState } from '@/lib/data';
import { getLocale } from '@/lib/lang';

import { computeBudget, daysInMonth, monthKeyOf } from '@shared/budget';
import { count, fill, formatMoney, formatMonthKey, formatPercent } from '@shared/i18n';

export default async function BudgetPage() {
  const { lang, s } = await getLocale();
  const { state, isLive } = await loadAppState();

  const today = new Date();
  const month = monthKeyOf(today);
  const budget = computeBudget(state, month);
  const cur = state.income.currency;
  const daysLeft = Math.max(1, daysInMonth(month) - today.getDate() + 1);

  const catById = new Map(state.categories.map((c) => [c.id, c]));

  // التجاوز أوّلًا، ثمّ الاقتراب، ثمّ الأعلى استهلاكًا
  const rank = { over: 0, near: 1, ok: 2 } as const;
  const rows = [...budget.categories].sort(
    (a, b) => rank[a.state] - rank[b.state] || b.ratio - a.ratio,
  );

  const limitsTotal = budget.allocatedLimits + budget.unallocated;
  const leftOfLimits = limitsTotal - budget.spentTotal;

  return (
    <>
      <SampleNotice isLive={isLive} />

      <section className="card hero">
        <div>
          <p className="hero-label" style={{ margin: '0 0 6px' }}>
            {s.budget.remainingOfLimits} · {formatMonthKey(month, lang)}
          </p>
          <p className="hero-figure num" style={{ margin: 0 }}>
            {formatMoney(leftOfLimits, cur, lang)}
          </p>
        </div>
        <dl className="hero-stats" style={{ margin: 0 }}>
          <div className="hero-stat">
            <dt>{s.budget.limits}</dt>
            <dd className="num">{formatMoney(limitsTotal, cur, lang, { withSymbol: false })}</dd>
          </div>
          <div className="hero-stat">
            <dt>{s.home.spent}</dt>
            <dd className="num">
              {formatMoney(budget.spentTotal, cur, lang, { withSymbol: false })}
            </dd>
          </div>
          <div className="hero-stat">
            <dt>{s.budget.used}</dt>
            <dd className="num">
              {formatPercent(limitsTotal > 0 ? budget.spentTotal / limitsTotal : 0, lang)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="section-head">
        <h2>{s.home.categoryLimits}</h2>
        {/* العدد والمعدود: «يومان» لا «٢ أيام» */}
        <span className="muted">{count(lang, 'day', daysLeft)}</span>
      </div>

      <div className="grid">
        {rows.map((c) => {
          const cat = catById.get(c.categoryId);
          if (!cat) return null;
          const over = c.state === 'over';
          const near = c.state === 'near';
          const statusColor = over
            ? 'var(--bad-ink)'
            : near
              ? 'var(--warn)'
              : 'var(--good)';

          return (
            <section key={c.categoryId} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span className="dot" style={{ background: cat.color }} aria-hidden="true" />
                <h3 style={{ flex: '1 1 auto', minWidth: 0, fontSize: 15, fontWeight: 600 }}>
                  {cat.name}
                </h3>
                <span className="chip" style={{ color: statusColor }}>
                  {over ? s.budget.over : near ? s.budget.near : s.budget.ok}
                </span>
              </div>

              <div className="bar" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(100, c.ratio * 100)}%`,
                    background: over ? 'var(--bad)' : cat.color,
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginTop: 10,
                  fontSize: 12,
                  color: 'var(--ink-faint)',
                }}
              >
                <span className="num">
                  {formatMoney(c.spent, cur, lang, { withSymbol: false })}
                  {' / '}
                  {formatMoney(c.limit, cur, lang, { withSymbol: false })}
                </span>
                <span className="num" style={{ color: statusColor, fontWeight: 600 }}>
                  {over
                    ? s.budget.stopHere
                    : fill(s.budget.perDayLeft, {
                        amount: formatMoney(Math.floor(c.remaining / daysLeft), cur, lang, {
                          withSymbol: false,
                        }),
                      })}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
