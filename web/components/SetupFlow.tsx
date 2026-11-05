'use client';

/**
 * الإعداد الأوّل — ثلاث خطوات بعد أوّل دخول.
 *
 * الحالة كلّها هنا، ولا يُكتب شيء قبل الضغطة الأخيرة: من أغلق الصفحة في
 * منتصفها عاد إليها من أوّلها، بلا حسابٍ نصف مبذور. والتقسيم المعروض في
 * الخطوة الثالثة يُحسب من `seedState` نفسها، فما يراه هو ما سيُكتب.
 */

import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { finishSetup } from '@/app/actions';
import {
  fill,
  formatCount,
  formatMoney,
  formatPercent,
  type Lang,
  type Strings,
} from '@shared/i18n';
import { parseIncomeInput, splitOf } from '@shared/seedPayload';
import { CURRENCIES, SITUATIONS, seedState } from '@shared/templates';
import type { IncomeShape } from '@shared/types';

type Shape = keyof Strings['setup']['shapes'];

/** مفاتيح النصوص لكلّ وضع. `satisfies` يكشف وضعًا جديدًا بلا نصوص. */
const SHAPE_TEXT = {
  fixed_salary: { name: 'fixedSalary', hint: 'fixedSalaryHint', gives: 'fixedSalaryGives' },
  variable: { name: 'variable', hint: 'variableHint', gives: 'variableGives' },
  allowance: { name: 'allowance', hint: 'allowanceHint', gives: 'allowanceGives' },
  multiple: { name: 'multiple', hint: 'multipleHint', gives: 'multipleGives' },
  none: { name: 'none', hint: 'noneHint', gives: 'noneGives' },
} as const satisfies Record<IncomeShape, { name: Shape; hint: Shape; gives: Shape }>;

const PAY_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export function SetupFlow({
  s,
  common,
  lang,
}: {
  s: Strings['setup'];
  common: Strings['common'];
  lang: Lang;
}) {
  const incomeId = useId();
  const payDayId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState(1);
  const [code, setCode] = useState('KWD');
  const [shape, setShape] = useState<IncomeShape>('fixed_salary');
  const [income, setIncome] = useState('');
  const [payDay, setPayDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [saving, start] = useTransition();

  // «من الصفر» لا دخل فيها فلا خطوة ثالثة.
  const total = shape === 'none' ? 2 : 3;
  const last = step === total;

  // تغيّر الخطوة تغيّر الصفحة: قارئ الشاشة يبدأ من عنوانها الجديد.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [step]);

  const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
  const names = new Intl.DisplayNames(lang, { type: 'currency' });

  const amount = parseIncomeInput(income);
  const split =
    amount && amount > 0 ? splitOf(seedState(shape, amount, code, payDay)) : null;

  function fail(message: string) {
    setError(message);
    setShake((n) => n + 1);
  }

  function finish(incomeText: string) {
    setError(null);
    if (parseIncomeInput(incomeText) === null) return fail(s.errIncome);

    start(async () => {
      const result = await finishSetup({ currency: code, shape, income: incomeText, payDay });
      if (result) fail(result.error === 'income' ? s.errIncome : s.errSave);
    });
  }

  function next() {
    setError(null);
    if (last) finish(shape === 'none' ? '' : income);
    else setStep(step + 1);
  }

  const rows = split
    ? [
        { key: 'fixed', label: s.splitRows.fixed, value: split.fixed, color: 'var(--brand)' },
        { key: 'limits', label: s.splitRows.limits, value: split.limits, color: 'var(--accent)' },
        { key: 'savings', label: s.splitRows.savings, value: split.savings, color: '#C2185B' },
        { key: 'free', label: s.splitRows.free, value: split.free, color: 'var(--good)' },
      ].filter((r) => r.value > 0)
    : [];

  return (
    <div className="auth-card setup-card">
      <div className="setup-progress">
        <div className="setup-bars" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} data-on={i < step} />
          ))}
        </div>
        <span className="setup-count">
          {fill(last ? s.lastStep : s.step, {
            n: formatCount(step, lang),
            total: formatCount(total, lang),
          })}
        </span>
      </div>

      {/* المفتاح يعيد تركيب الخطوة، فتعمل حركة الدخول مع كلّ انتقال. */}
      <div key={step} className="setup-step">
        {step === 1 && (
          <>
            <header className="auth-head">
              <h1 ref={heading} tabIndex={-1} className="auth-title">
                {s.currencyTitle}
              </h1>
              <p className="auth-sub">{s.currencyHint}</p>
            </header>

            <fieldset className="setup-grid">
              <legend className="setup-sr">{s.currencyTitle}</legend>
              {CURRENCIES.map((c) => (
                <label key={c.code} className="setup-option" data-on={c.code === code}>
                  <input
                    type="radio"
                    name="currency"
                    checked={c.code === code}
                    onChange={() => setCode(c.code)}
                  />
                  <span className="setup-option-name">{names.of(c.code)}</span>
                  <bdi className="setup-symbol">{c.symbol}</bdi>
                </label>
              ))}
            </fieldset>

            <p className="setup-note">{s.privacy}</p>
          </>
        )}

        {step === 2 && (
          <>
            <header className="auth-head">
              <h1 ref={heading} tabIndex={-1} className="auth-title">
                {s.shapeTitle}
              </h1>
              <p className="auth-sub">{s.shapeHint}</p>
            </header>

            <fieldset className="setup-list">
              <legend className="setup-sr">{s.shapeTitle}</legend>
              {SITUATIONS.map((item) => {
                const text = SHAPE_TEXT[item.shape];
                const on = item.shape === shape;
                return (
                  <label key={item.shape} className="setup-option setup-wide" data-on={on}>
                    <input
                      type="radio"
                      name="shape"
                      checked={on}
                      onChange={() => setShape(item.shape)}
                    />
                    <span className="setup-option-body">
                      <span className="setup-option-line">
                        <span className="setup-option-name">{s.shapes[text.name]}</span>
                        {item.popular && <span className="setup-badge">{s.mostCommon}</span>}
                      </span>
                      <span className="setup-option-hint">{s.shapes[text.hint]}</span>
                      <span className="auth-hint" data-show={on}>
                        <span>{s.shapes[text.gives]}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <p className="setup-note">{s.shapeNotFound}</p>
          </>
        )}

        {step === 3 && (
          <>
            <header className="auth-head">
              <h1 ref={heading} tabIndex={-1} className="auth-title">
                {s.incomeTitle}
              </h1>
              <p className="auth-sub">{s.incomeHint}</p>
            </header>

            <div className="auth-field">
              <label htmlFor={incomeId}>{s.incomeAmount}</label>
              <div className="setup-money">
                <input
                  id={incomeId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  dir="ltr"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  aria-invalid={amount === null}
                />
                <bdi className="setup-symbol">{currency.symbol}</bdi>
              </div>
            </div>

            {shape !== 'variable' && (
              <div className="setup-payday">
                <label htmlFor={payDayId}>
                  <span className="setup-option-name">{s.payDay}</span>
                  <span className="setup-option-hint">{s.payDayHint}</span>
                </label>
                <select
                  id={payDayId}
                  value={payDay}
                  onChange={(e) => setPayDay(Number(e.target.value))}
                >
                  {PAY_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {formatCount(d, lang)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 0fr ← 1fr كما في تلميح كلمة المرور: يظهر مع أوّل رقمٍ صحيح. */}
            <div className="setup-reveal" data-show={split !== null}>
              <div>
                {split && (
                  <section className="setup-split">
                    <h2>
                      {fill(s.initialSplit, {
                        amount: formatMoney(split.total, currency, lang, { withSymbol: false }),
                      })}
                    </h2>
                    <div className="setup-stack" aria-hidden="true">
                      {rows.map((r) => (
                        <span
                          key={r.key}
                          style={{ flexGrow: r.value, background: r.color }}
                        />
                      ))}
                    </div>
                    <ul>
                      {rows.map((r) => (
                        <li key={r.key}>
                          <i style={{ background: r.color }} aria-hidden="true" />
                          <span>{r.label}</span>
                          <span className="setup-pct">
                            {formatPercent(r.value / split.total, lang)}
                          </span>
                          <span className="setup-amount num">
                            {formatMoney(r.value, currency, lang, { withSymbol: false })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p>{s.splitHint}</p>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <p key={shake} className="auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="setup-actions">
        {step > 1 && (
          <button
            type="button"
            className="auth-ghost"
            disabled={saving}
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            {common.back}
          </button>
        )}
        <button type="button" className="auth-go" disabled={saving} onClick={next}>
          {saving ? (
            <>
              <span className="auth-spin" aria-hidden="true" />
              {s.saving}
            </>
          ) : last ? (
            s.finish
          ) : (
            common.next
          )}
        </button>
      </div>

      {step === 3 && (
        <button
          type="button"
          className="setup-skip"
          disabled={saving}
          onClick={() => finish('')}
        >
          {s.skipIncome}
        </button>
      )}
    </div>
  );
}
