/**
 * شاشة لوحة البيانات — React Native مع RTL.
 *
 * RTL: لا تستخدم I18nManager.forceRTL هنا. حدّه في index.js قبل أول render،
 * لأنه يحتاج reload للتطبيق كامل:
 *
 *   // index.js — قبل AppRegistry.registerComponent
 *   import { I18nManager } from 'react-native';
 *   I18nManager.allowRTL(true);
 *   I18nManager.forceRTL(true);
 *
 * وبعدها استخدم start/end بدل left/right في كل مكان، فتشتغل الشاشة
 * صح بالعربي والإنجليزي بدون شرط.
 */

import React, { useMemo } from 'react';
import {
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppState, Category, formatKWD } from './types';
import { computeBudget, computeSavingsStatus, monthKeyOf } from './budget';

/** الأرقام تبقى لاتينية حتى داخل نص عربي — أسهل للقراءة في المال. */
const money = (fils: number) => formatKWD(fils);

type Props = {
  state: AppState;
  today?: Date;
  onQuickAdd: () => void;
  onOpenGoal: (goalId: string) => void;
  onOpenCategory: (categoryId: string) => void;
  onOpenSalary: () => void;
};

export default function DashboardScreen({
  state,
  today = new Date(),
  onQuickAdd,
  onOpenGoal,
  onOpenCategory,
  onOpenSalary,
}: Props) {
  const month = monthKeyOf(today);

  const budget = useMemo(() => computeBudget(state, month), [state, month]);

  const catsById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of state.categories) m.set(c.id, c);
    return m;
  }, [state.categories]);

  const primaryGoal = state.goals.find((g) => g.active);
  const goalStatus = useMemo(
    () =>
      primaryGoal
        ? computeSavingsStatus(state, primaryGoal.id, month, today)
        : null,
    [state, primaryGoal, month, today],
  );

  // الفئات اللي تستاهل الانتباه أولًا: تجاوز، ثم قارب الحد، ثم الأكثر صرفًا
  const ranked = useMemo(
    () =>
      [...budget.categories].sort((a, b) => {
        const w = { over: 0, near: 1, ok: 2 } as const;
        if (w[a.state] !== w[b.state]) return w[a.state] - w[b.state];
        return b.ratio - a.ratio;
      }),
    [budget.categories],
  );

  const miscId = state.categories.find((c) => c.monthlyLimit === null)?.id;
  const freeRemaining =
    budget.categories.find((c) => c.categoryId === miscId)?.remaining ??
    budget.unallocated;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>مُوَفِّر</Text>
          <Text style={styles.subtle}>{monthLabel(month)}</Text>
        </View>
        <Pressable
          onPress={onOpenSalary}
          accessibilityRole="button"
          accessibilityLabel="تعديل راتب هذا الشهر"
          style={styles.salaryPill}
          hitSlop={8}
        >
          <Text style={styles.salaryPillText}>
            الراتب {money(budget.income)}
          </Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>المتبقي الحر بعد الالتزامات والحدود</Text>
        <View style={styles.heroAmountRow}>
          <Text style={styles.heroAmount}>{money(freeRemaining)}</Text>
          <Text style={styles.heroUnit}>د.ك</Text>
        </View>
        <View style={styles.heroStats}>
          <HeroStat label="الثابت" value={money(budget.fixedTotal)} />
          <HeroStat label="الأقساط" value={money(budget.installmentsTotal)} />
          <HeroStat label="الادخار" value={money(budget.savingsTotal)} />
        </View>
      </View>

      {primaryGoal && goalStatus && (
        <Pressable
          onPress={() => onOpenGoal(primaryGoal.id)}
          accessibilityRole="button"
          accessibilityLabel={`${primaryGoal.name}: محفوظ ${goalStatus.periodsHit} من ${goalStatus.periodsElapsed}`}
          style={[styles.goalCard, { borderColor: primaryGoal.color + '55' }]}
        >
          <View style={[styles.goalBadge, { backgroundColor: primaryGoal.color }]}>
            <Text style={styles.goalBadgeText}>
              {Math.round(primaryGoal.amountPerPeriod / 1000)}
            </Text>
          </View>
          <View style={styles.flex1}>
            <View style={styles.rowBetween}>
              <Text style={styles.goalName}>{primaryGoal.name}</Text>
              <Text style={[styles.goalMeta, { color: primaryGoal.color }]}>
                {goalStatus.periodsHit} من {goalStatus.periodsElapsed} يوم
              </Text>
            </View>
            <Bar
              ratio={goalStatus.savedThisMonth / goalStatus.monthlyTarget}
              color={primaryGoal.color}
              track={primaryGoal.color + '33'}
            />
            <Text style={styles.subtle}>
              {money(goalStatus.savedThisMonth)} من {money(goalStatus.monthlyTarget)} د.ك
              {goalStatus.behindBy > 0
                ? ` · متأخر ${money(goalStatus.behindBy)}`
                : ' · على الجدول'}
            </Text>
          </View>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>حدود الفئات</Text>

      {ranked.map((cs) => {
        const cat = catsById.get(cs.categoryId);
        if (!cat) return null;
        return (
          <Pressable
            key={cs.categoryId}
            onPress={() => onOpenCategory(cs.categoryId)}
            accessibilityRole="button"
            accessibilityLabel={`${cat.name}: صرفت ${money(cs.spent)} من ${money(cs.limit)} دينار`}
            style={[styles.catCard, { backgroundColor: cat.color + '14' }]}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.catName}>{cat.name}</Text>
              <Text style={[styles.catStatus, statusStyle(cs.state)]}>
                {statusLabel(cs.state, cs.remaining)}
              </Text>
            </View>
            <Bar
              ratio={cs.ratio}
              color={cs.state === 'over' ? CRITICAL : cat.color}
              track={cat.color + '33'}
            />
            <View style={styles.rowBetween}>
              <Text style={styles.catMeta}>صرفت {money(cs.spent)}</Text>
              <Text style={styles.catMeta}>الحد {money(cs.limit)}</Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable
        onPress={onQuickAdd}
        accessibilityRole="button"
        accessibilityLabel="إضافة مصروف سريع"
        style={styles.cta}
      >
        <Text style={styles.ctaText}>+ إضافة مصروف سريع</Text>
      </Pressable>
    </ScrollView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function Bar({
  ratio,
  color,
  track,
}: {
  ratio: number;
  color: string;
  track: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={[styles.barTrack, { backgroundColor: track }]}>
      <View
        style={[styles.barFill, { backgroundColor: color, width: `${pct * 100}%` }]}
      />
    </View>
  );
}

const CRITICAL = '#B01B1B';
const WARN = '#8C5000';
const OK = '#2B6B2F';

const statusStyle = (s: 'ok' | 'near' | 'over') => ({
  color: s === 'over' ? CRITICAL : s === 'near' ? WARN : OK,
});

const statusLabel = (s: 'ok' | 'near' | 'over', remaining: number) =>
  s === 'over'
    ? `تجاوز ${money(-remaining)}`
    : s === 'near'
      ? `باقي ${money(remaining)}`
      : `باقي ${money(remaining)}`;

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${AR_MONTHS[m - 1]} ${y}`;
}

/**
 * writingDirection: 'rtl' على كل نص عربي — بدونه السطر اللي يبدأ
 * برقم أو بـ"+" ينقلب ويطلع المحرف في الطرف الغلط.
 */
const rtlText = { writingDirection: 'rtl' as const };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF7F2' },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  flex1: { flex: 1, gap: 6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  brand: { fontSize: 20, fontWeight: '700', color: '#0B4F63', ...rtlText },
  subtle: { fontSize: 12, color: '#6B6257', ...rtlText },

  salaryPill: {
    backgroundColor: '#F1E9DD',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  salaryPillText: { fontSize: 12, fontWeight: '600', color: '#495057', ...rtlText },

  hero: {
    backgroundColor: '#0B4F63',
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  heroLabel: { fontSize: 12, color: '#BBDCE6', ...rtlText },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  heroAmount: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  heroUnit: { fontSize: 14, color: '#BBDCE6', paddingBottom: 5 },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroStat: {
    flex: 1,
    backgroundColor: '#11637C',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  heroStatLabel: { fontSize: 10, color: '#BBDCE6', ...rtlText },
  heroStatValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  goalBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBadgeText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  goalName: { fontSize: 13, fontWeight: '600', color: '#212529', ...rtlText },
  goalMeta: { fontSize: 11, fontWeight: '600', ...rtlText },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
    marginTop: 8,
    ...rtlText,
  },

  catCard: { borderRadius: 17, padding: 13, gap: 8 },
  catName: { fontSize: 14, fontWeight: '500', color: '#212529', flexShrink: 1, ...rtlText },
  catStatus: { fontSize: 12, fontWeight: '600', ...rtlText },
  catMeta: { fontSize: 11, color: '#574F45', ...rtlText },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  cta: {
    marginTop: 14,
    backgroundColor: '#E8590C',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  ctaText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', ...rtlText },
});

/** ما نستخدمه، بس نتركه مرجعًا: هل التطبيق حالياً RTL فعلاً؟ */
export const isRTL = I18nManager.isRTL;
