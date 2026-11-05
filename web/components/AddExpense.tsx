'use client';

/**
 * إضافة مصروف — طريقان إلى النموذج نفسه.
 *
 * يكتب المستخدم ما صرفه فتُملأ الحقول، أو يملؤها بيده مباشرة. والكتابة لا
 * تحفظ شيئًا: ما فهمه التطبيق يظهر في الحقول، وما اقترحه النموذج يُوسَم
 * «مقترَح» حتّى يمسّه المستخدم أو يحفظ. الحفظ لا يكون إلّا بضغطته.
 *
 * والنموذج يأتي بعد القواعد: «قهوة 1.5» تُفهم على الجهاز بلا شبكة، وإن فشل
 * الاستدعاء بقي ما فهمته القواعد وأكمل المستخدم بيده.
 */

import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { addExpense } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';
import { amountMinorOf, limitNoteOf } from '@shared/expense';
import { fill, formatMoney, type Currency, type Lang, type Strings } from '@shared/i18n';
import { assistedQuickEntry, localToday } from '@shared/quickEntryAssist';
import type { Account, Category } from '@shared/types';

type Status = { limit: number; spent: number };

/** بصمة النموذج. ليست crypto.randomUUID: تلك تغيب عن http على شبكة البيت. */
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const NOTHING_GUESSED = { amount: false, category: false, date: false };

export function AddExpense({
  s,
  common,
  lang,
  currency,
  categories,
  accounts,
  statuses,
  warnAt,
  defaultAccountId,
  defaultCategoryId,
}: {
  s: Strings['add'];
  common: Strings['common'];
  lang: Lang;
  currency: Currency;
  categories: Category[];
  accounts: Account[];
  statuses: Record<string, Status>;
  warnAt: number;
  defaultAccountId: string;
  defaultCategoryId: string;
}) {
  const textId = useId();
  const amountId = useId();
  const dateId = useId();
  const noteId = useId();
  const accountId = useId();
  const textRef = useRef<HTMLInputElement>(null);
  const key = useRef(newKey());

  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultCategoryId);
  const [account, setAccount] = useState(defaultAccountId);
  const [date, setDate] = useState('');
  const [today, setToday] = useState('');
  const [note, setNote] = useState('');

  const [guessed, setGuessed] = useState(NOTHING_GUESSED);
  // ما فُهم من النصّ: يُحفظ معه، ويُتعلَّم منه إن لم تأتِ الفئة من كلمة مسجّلة.
  const [parsed, setParsed] = useState<{
    raw: string;
    label: string;
    ruleCategory: string | null;
  } | null>(null);
  const [pulse, setPulse] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [saved, setSaved] = useState(0);
  const [saving, start] = useTransition();

  // «اليوم» من ساعة الجهاز لا السيرفر، فلا يُرسم في السيرفر أصلًا.
  useEffect(() => {
    const t = localToday();
    setToday(t);
    setDate(t);
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(0), 2800);
    return () => clearTimeout(timer);
  }, [saved]);

  const money = (minor: number) => formatMoney(minor, currency, lang);

  async function understand(e: React.FormEvent) {
    e.preventDefault();
    const raw = text.trim();
    if (!raw || thinking) return;

    setThinking(true);
    setError(null);
    setNotice(null);

    const out = await assistedQuickEntry(createClient(), raw, categories, {
      today: today || localToday(),
      minorUnits: currency.minorUnits,
    });
    const entry = out.entry;

    // جملةٌ جديدة تُسقط ما اقترحته السابقة، وإلّا بقي تاريخها صامتًا بلا وسم.
    // وما كتبه المستخدم بيده لا يُمسّ إن لم تذكره الجملة.
    if (entry.amount !== null) {
      setAmount((entry.amount / 10 ** currency.minorUnits).toFixed(currency.minorUnits));
    } else if (guessed.amount) {
      setAmount('');
    }
    if (entry.categoryId) setCategory(entry.categoryId);
    if (entry.date) setDate(entry.date);
    else if (guessed.date) setDate(today);
    setNote(entry.label);

    setGuessed({
      amount: entry.amountIsSuggestion,
      category: entry.suggestedCategoryId !== null,
      date: entry.date !== null,
    });
    setParsed({
      raw,
      label: entry.label,
      ruleCategory: entry.suggestedCategoryId ? null : entry.categoryId,
    });
    if (!out.ok) setNotice(s.partial);

    setPulse((n) => n + 1);
    setThinking(false);
  }

  function fail(message: string) {
    setError(message);
    setShake((n) => n + 1);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (saving) return;
    if (amountMinorOf(amount, currency.code) === null) return fail(s.errAmount);

    start(async () => {
      const result = await addExpense({
        amount,
        categoryId: category,
        accountId: account,
        date,
        note,
        rawText: parsed?.raw,
        // الكلمة من الاسم لا النصّ كاملًا: «بثلاثة» ليست كلمةً تدلّ على فئة.
        learnFrom: parsed && category !== parsed.ruleCategory ? parsed.label : undefined,
        key: key.current,
      });

      if ('error' in result) {
        if (result.error === 'amount') fail(s.errAmount);
        else if (result.error === 'date') fail(s.errDate);
        else fail(s.errSave);
        return;
      }

      // بصمةٌ جديدة: المصروف التالي عمليةٌ أخرى ولو طابق هذا.
      key.current = newKey();
      setText('');
      setAmount('');
      setNote('');
      setDate(today);
      setCategory(defaultCategoryId);
      setGuessed(NOTHING_GUESSED);
      setParsed(null);
      setNotice(null);
      setSaved((n) => n + 1);
      textRef.current?.focus();
    });
  }

  const minor = amountMinorOf(amount, currency.code);
  const sameMonth = date.slice(0, 7) === today.slice(0, 7);
  const status = statuses[category];
  const limit = minor && status && sameMonth ? limitNoteOf(status, minor, warnAt) : null;

  return (
    <div className="add-flow">
      <form className="add-smart" onSubmit={understand}>
        <label htmlFor={textId}>{s.smartLabel}</label>
        <div className="add-smart-row">
          <input
            ref={textRef}
            id={textId}
            type="text"
            dir="auto"
            autoComplete="off"
            maxLength={500}
            placeholder={s.smartPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" disabled={thinking || !text.trim()}>
            {thinking ? (
              <>
                <span className="auth-spin" aria-hidden="true" />
                {s.understanding}
              </>
            ) : (
              s.understand
            )}
          </button>
        </div>
        {notice && (
          <p className="add-notice" role="status">
            {notice}
          </p>
        )}
      </form>

      <form className="auth-card add-card" onSubmit={save} noValidate>
        <div key={`amount-${pulse}`} className="add-amount" data-pulse={pulse > 0}>
          <label htmlFor={amountId}>
            {s.amount}
            {guessed.amount && <span className="add-tag">{s.suggested}</span>}
          </label>
          <div className="add-amount-row">
            <input
              id={amountId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              placeholder={(0).toFixed(currency.minorUnits)}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setGuessed((g) => ({ ...g, amount: false }));
              }}
            />
            <bdi>{currency.symbol}</bdi>
          </div>
        </div>

        {limit && (
          <p className="add-limit" data-kind={limit.kind} role="status">
            {fill(
              limit.kind === 'over'
                ? s.overLimit
                : limit.kind === 'low'
                  ? s.onlyRemains
                  : s.willRemain,
              { amount: money(limit.amount) },
            )}
          </p>
        )}

        <fieldset className="add-cats">
          <legend>
            {s.category} — {s.tapToChange}
            {guessed.category && <span className="add-tag">{s.suggested}</span>}
          </legend>
          <div>
            {categories.map((c) => (
              <label
                key={c.id}
                className="add-cat"
                data-on={c.id === category}
                style={{ '--c': c.color } as React.CSSProperties}
              >
                <input
                  type="radio"
                  name="category"
                  checked={c.id === category}
                  onChange={() => {
                    setCategory(c.id);
                    setGuessed((g) => ({ ...g, category: false }));
                  }}
                />
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={c.icon} />
                </svg>
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="add-row">
          <div className="auth-field">
            <label htmlFor={dateId}>
              {s.date}
              {guessed.date && <span className="add-tag">{s.suggested}</span>}
            </label>
            <input
              id={dateId}
              type="date"
              dir="ltr"
              max={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setGuessed((g) => ({ ...g, date: false }));
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor={accountId}>{s.account}</label>
            <select id={accountId} value={account} onChange={(e) => setAccount(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor={noteId}>{s.note}</label>
          <input
            id={noteId}
            type="text"
            dir="auto"
            maxLength={200}
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <p key={shake} className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="auth-go" disabled={saving || !date}>
          {saving ? (
            <>
              <span className="auth-spin" aria-hidden="true" />
              {s.saving}
            </>
          ) : (
            common.save
          )}
        </button>

        {saved > 0 && (
          <p key={saved} className="add-saved" role="status">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
            {s.saved}
          </p>
        )}
      </form>
    </div>
  );
}
