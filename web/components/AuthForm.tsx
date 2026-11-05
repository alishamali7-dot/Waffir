'use client';

/**
 * نموذج الدخول وإنشاء الحساب — حالةٌ واحدة لوضعين.
 *
 * الحقول نفسها في الوضعين، فلا شاشتان ولا مسارَا تحقّقٍ يفترقان ثمّ
 * يختلفان. والتبديل يُحرّك حبّة الاختيار ولا يُعيد بناء النموذج، فما
 * كتبه المستخدم لا يضيع إن بدّل وهو في منتصف الكتابة.
 *
 * ورسائل Supabase إنجليزيّة من الخدمة، فتُترجم هنا بمطابقة نصّها.
 * ما لا يُطابق يسقط على رسالةٍ عامّة ولا يُعرض خامًا: «AuthApiError»
 * في وجه المستخدم ليست رسالة.
 */

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import type { Strings } from '@shared/i18n';

import { createClient } from '@/lib/supabase/client';

type AuthStrings = Strings['auth'];
type Mode = 'in' | 'up';

/** أقصر كلمة مرور نقبلها. أطول من حدّ Supabase (ستّة) عن قصد. */
const MIN_PASSWORD = 8;

/** تحقّقٌ مبدئيّ فقط — الخدمة هي الحكم، وهذا يوفّر رحلةً ضائعة. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function translateError(raw: string, s: AuthStrings): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return s.errInvalid;
  if (m.includes('already registered') || m.includes('already been registered')) return s.errTaken;
  if (m.includes('password should be') || m.includes('password is too short')) return s.errWeak;
  if (m.includes('unable to validate email') || m.includes('invalid format')) return s.errEmailFormat;
  if (m.includes('email not confirmed')) return s.errUnconfirmed;
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many')) {
    return s.errRate;
  }
  if (m.includes('failed to fetch') || m.includes('network')) return s.errNetwork;
  return s.errGeneric;
}

export function AuthForm({
  s,
  configured,
}: {
  s: AuthStrings;
  configured: boolean;
}) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();

  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // مفتاحٌ يتغيّر مع كلّ خطأ، فتُعاد حركة الاهتزاز ولو تكرّر الخطأ نفسه.
  const [shake, setShake] = useState(0);

  function fail(message: string) {
    setError(message);
    setShake((n) => n + 1);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!configured) return fail(s.errConfig);
    if (!EMAIL_SHAPE.test(email.trim())) return fail(s.errEmailFormat);
    if (password.length < MIN_PASSWORD) return fail(s.errWeak);

    setBusy(true);
    const supabase = createClient();

    try {
      if (mode === 'in') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) return fail(translateError(err.message, s));
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (err) return fail(translateError(err.message, s));

        // بلا جلسة = تأكيد البريد مطلوب في إعدادات المشروع. لا نَعِد
        // بالدخول ثمّ نُرجع المستخدم إلى نموذجٍ فارغ.
        if (!data.session) {
          setBusy(false);
          setSent(email.trim());
          return;
        }
      }

      // refresh قبل push: مكوّنات السيرفر تُعاد مع الكوكي الجديد،
      // فلا تظهر الصفحة التالية ببيانات الزائر.
      router.refresh();
      router.push('/');
    } catch (cause) {
      fail(translateError(String(cause), s));
    }
  }

  if (sent) {
    // bdi لا نصّ عاديّ: بريدٌ لاتينيّ داخل جملةٍ عربيّة ينكسر ترتيبه
    // بلا عزل، فتظهر النقطة أو الشرطة في غير موضعها.
    const [head, tail] = s.checkEmail.split('{email}');

    return (
      <div className="auth-card auth-done" role="status">
        <span className="auth-done-mark" aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </span>
        <h1 className="auth-title">{s.checkEmailTitle}</h1>
        <p className="auth-sub">
          {head}
          <bdi dir="ltr">{sent}</bdi>
          {tail}
        </p>
        <button
          type="button"
          className="auth-ghost"
          onClick={() => {
            setSent(null);
            setMode('in');
          }}
        >
          {s.goSignIn}
        </button>
      </div>
    );
  }

  const label = mode === 'in' ? s.signIn : s.signUp;

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <div className="auth-switch" role="radiogroup" aria-label={label}>
        <span className="auth-pill" data-mode={mode} aria-hidden="true" />
        {(['in', 'up'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className="auth-tab"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
          >
            {m === 'in' ? s.signIn : s.signUp}
          </button>
        ))}
      </div>

      <header className="auth-head">
        <h1 className="auth-title">{mode === 'in' ? s.signInTitle : s.signUpTitle}</h1>
        <p className="auth-sub">{mode === 'in' ? s.signInSubtitle : s.signUpSubtitle}</p>
      </header>

      <div className="auth-field" style={{ '--i': 1 } as React.CSSProperties}>
        <label htmlFor={emailId}>{s.email}</label>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder={s.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="auth-field" style={{ '--i': 2 } as React.CSSProperties}>
        <label htmlFor={passwordId}>{s.password}</label>
        <div className="auth-secret">
          <input
            id={passwordId}
            type={reveal ? 'text' : 'password'}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD}
          />
          <button
            type="button"
            className="auth-eye"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? s.hidePassword : s.showPassword}
            aria-pressed={reveal}
          >
            {reveal ? (
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" />
                <path d="M6.5 6.6C4.6 7.9 3.2 9.8 2.5 12c1.5 4 5.2 6.5 9.5 6.5 1.6 0 3.1-.35 4.4-1M17.9 17.3c1.7-1.3 3-3.1 3.6-5.3-1.5-4-5.2-6.5-9.5-6.5-.7 0-1.4.07-2 .2" />
              </svg>
            ) : (
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M2.5 12C4 8 7.7 5.5 12 5.5s8 2.5 9.5 6.5c-1.5 4-5.2 6.5-9.5 6.5S4 16 2.5 12z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            )}
          </button>
        </div>
        {/* 0fr ← 1fr: ارتفاعٌ متحرّك بلا رقمٍ مكتوبٍ بيد */}
        <div className="auth-hint" data-show={mode === 'up'}>
          <span>{s.passwordHint}</span>
        </div>
      </div>

      {error && (
        <p key={shake} className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="auth-go" disabled={busy}>
        {busy ? (
          <>
            <span className="auth-spin" aria-hidden="true" />
            {mode === 'in' ? s.signingIn : s.signingUp}
          </>
        ) : (
          label
        )}
      </button>

      <p className="auth-alt">
        {mode === 'in' ? s.noAccount : s.haveAccount}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
          }}
        >
          {mode === 'in' ? s.createOne : s.goSignIn}
        </button>
      </p>
    </form>
  );
}
