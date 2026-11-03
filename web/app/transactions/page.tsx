import { SampleNotice } from '@/components/SampleNotice';
import { loadAppState } from '@/lib/data';
import { getLocale } from '@/lib/lang';

import { monthKeyOf } from '@shared/budget';
import { count, formatMoney, formatMonthKey } from '@shared/i18n';
import type { Attachment, Transaction } from '@shared/types';

/**
 * من أين تُعرض الفاتورة.
 *
 * `_localUri` أوّلًا: الملفّ على الجهاز يُعرض فورًا، سواء لم يُرفع
 * بعد أو كان أصلًا ملفًّا محلّيًّا كحال العيّنة. وإلّا من الـbucket —
 * وهو خاصّ، فالرابط يحتاج توقيعًا، ولذلك يُولَّد على السيرفر لا هنا.
 */
function receiptSrc(a: Attachment): string | null {
  if (a._localUri) return a._localUri;
  return null; // رابط موقَّع — يُضاف مع المصادقة
}

/** عمليات اليوم الواحد مجمّعة، أحدث يوم أوّلًا. */
function groupByDay(txs: Transaction[]) {
  const days = new Map<string, Transaction[]>();
  for (const t of txs) {
    const day = t.occurredAt.slice(0, 10);
    const list = days.get(day);
    if (list) list.push(t);
    else days.set(day, [t]);
  }
  return [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default async function TransactionsPage() {
  const { lang, s } = await getLocale();
  const { state, isLive } = await loadAppState();

  const cur = state.income.currency;
  const month = monthKeyOf(new Date());
  const catById = new Map(state.categories.map((c) => [c.id, c]));
  const accById = new Map(state.accounts.map((a) => [a.id, a]));

  // فواتير كلّ عملية
  const receiptsByTx = new Map<string, Attachment[]>();
  for (const a of state.attachments) {
    const list = receiptsByTx.get(a.transactionId);
    if (list) list.push(a);
    else receiptsByTx.set(a.transactionId, [a]);
  }

  const txs = state.transactions
    .filter((t) => t.occurredAt.startsWith(month))
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  const inflow = txs
    .filter((t) => t.direction === 'credit' && !t.transferToAccountId)
    .reduce((a, t) => a + t.amount, 0);
  const outflow = txs
    .filter((t) => t.direction === 'debit' && !t.transferToAccountId)
    .reduce((a, t) => a + t.amount, 0);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <SampleNotice isLive={isLive} />

      <section className="card" style={{ display: 'flex', gap: 0, padding: 0 }}>
        {[
          { label: s.transactions.in, value: inflow, color: 'var(--good)', signed: true },
          { label: s.transactions.out, value: -outflow, color: 'var(--bad-ink)', signed: true },
          { label: s.transactions.net, value: inflow - outflow, color: 'var(--ink)', signed: false },
        ].map((col, i) => (
          <div
            key={col.label}
            style={{
              flex: '1 1 0',
              padding: '16px 18px',
              borderInlineStart: i === 0 ? 'none' : '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{col.label}</span>
            <strong className="num" style={{ fontSize: 17, color: col.color }}>
              {formatMoney(col.value, cur, lang, {
                withSymbol: false,
                signed: col.signed,
              })}
            </strong>
          </div>
        ))}
      </section>

      <div className="section-head">
        <h2>
          {s.transactions.title} · {formatMonthKey(month, lang)}
        </h2>
        <span className="muted">{count(lang, 'entry', txs.length)}</span>
      </div>

      {txs.length === 0 ? (
        <p className="empty">{s.empty.nothingYet}</p>
      ) : (
        <div className="rows">
          {groupByDay(txs).map(([day, list]) => {
            const dayTotal = list.reduce(
              (a, t) => a + (t.direction === 'credit' ? t.amount : -t.amount),
              0,
            );
            return (
              <section key={day} style={{ display: 'contents' }}>
                <h3 className="day-head">
                  <span>
                    {day === todayIso
                      ? s.common.today
                      : new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', {
                          day: 'numeric',
                          month: 'long',
                        }).format(new Date(day))}
                  </span>
                  <span className="num" style={{ fontWeight: 500, color: 'var(--ink-faint)' }}>
                    {formatMoney(dayTotal, cur, lang, { withSymbol: false, signed: true })}
                  </span>
                </h3>

                {list.map((t) => {
                  const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
                  const acc = accById.get(t.accountId);
                  const income = t.direction === 'credit';
                  const receipts = receiptsByTx.get(t.id) ?? [];
                  const thumb = receipts.map(receiptSrc).find(Boolean) ?? null;

                  return (
                    <div key={t.id} className="row">
                      <span
                        className="dot"
                        style={{ background: cat?.color ?? 'var(--ink-ghost)' }}
                        aria-hidden="true"
                      />
                      <span className="row-main">
                        <span className="row-title">{t.description}</span>
                        <span className="row-meta">
                          {cat?.name ?? s.reports.uncategorizedHint}
                          {acc ? ` · ${acc.name}` : ''}
                        </span>
                      </span>

                      {thumb && (
                        <a
                          href={thumb}
                          target="_blank"
                          rel="noreferrer"
                          // بديل وصفيّ لا «صورة»: قارئ الشاشة يحتاج
                          // أن يعرف فاتورة ماذا، لا أنّ هنا صورة.
                          aria-label={`${s.add.photo}: ${t.description}`}
                          style={{
                            flex: '0 0 auto',
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            overflow: 'hidden',
                            border: '1px solid var(--line)',
                            display: 'block',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb}
                            alt=""
                            width={40}
                            height={40}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </a>
                      )}

                      <span
                        className="row-figure num"
                        style={{ color: income ? 'var(--good)' : 'var(--ink)' }}
                      >
                        {formatMoney(income ? t.amount : -t.amount, cur, lang, {
                          withSymbol: false,
                          signed: true,
                        })}
                      </span>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
