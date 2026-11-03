/**
 * إرفاق فاتورة بعملية — كاميرا، أو صورة، أو PDF.
 *
 * يحتاج:
 *   npx expo install expo-image-picker expo-document-picker \
 *     expo-image-manipulator expo-file-system expo-crypto
 *
 * المنطق كلّه في [`attachments/`](../attachments): هذا الملفّ عرضٌ
 * وتفاعل فقط، ويستقبل محوّلاته حقنًا ليبقى قابلًا للتركيب والاختبار.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  captureFromCamera,
  pickFromLibrary,
  pickPdf,
  rejectionMessage,
  type CaptureDeps,
  type CaptureResult,
} from '../attachments/capture';
import { createAttachment, isExhausted } from '../attachments/queue';
import { strings, type Lang } from '../i18n';
import type { Attachment } from '../types';

type Source = 'camera' | 'gallery' | 'pdf';

type Props = {
  lang: Lang;
  userId: string;
  transactionId: string;
  attachments: Attachment[];
  deps: CaptureDeps;
  /** يولّد معرّفًا على الجهاز — expo-crypto randomUUID */
  newId: () => string;
  onAdd: (a: Attachment) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
  onRetry: (id: string) => Promise<void> | void;
};

export function ReceiptPicker({
  lang,
  userId,
  transactionId,
  attachments,
  deps,
  newId,
  onAdd,
  onRemove,
  onRetry,
}: Props) {
  const s = strings(lang);
  const rtl = lang === 'ar';
  const [busy, setBusy] = useState<Source | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (source: Source) => {
      // قفلٌ بسيط: ضغطتان سريعتان تفتحان منتقيَين وتُنشئان مرفقين
      if (busy) return;
      setBusy(source);
      setNotice(null);
      try {
        const res: CaptureResult =
          source === 'camera'
            ? await captureFromCamera(deps)
            : source === 'gallery'
              ? await pickFromLibrary(deps)
              : await pickPdf(deps);

        if (res.status === 'canceled') return;
        if (res.status === 'denied') return setNotice(s.receipts.cameraDenied);
        if (res.status === 'rejected') {
          return setNotice(rejectionMessage(res.problem, lang));
        }

        await onAdd(
          createAttachment({
            id: newId(),
            userId,
            transactionId,
            file: res.file,
            valid: res.valid,
          }),
        );
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [busy, deps, lang, newId, onAdd, s, transactionId, userId],
  );

  const confirmRemove = useCallback(
    (id: string) => {
      // الحذف يطال الجهاز والسيرفر، فلا يُنفَّذ بضغطة واحدة
      Alert.alert(s.receipts.confirmRemove, undefined, [
        { text: s.common.cancel, style: 'cancel' },
        { text: s.receipts.remove, style: 'destructive', onPress: () => void onRemove(id) },
      ]);
    },
    [onRemove, s],
  );

  const buttons: Array<{ key: Source; label: string }> = [
    { key: 'camera', label: s.receipts.camera },
    { key: 'gallery', label: s.receipts.gallery },
    { key: 'pdf', label: s.receipts.pdf },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, rtl && styles.rtl]}>{s.receipts.title}</Text>

      {attachments.length === 0 ? (
        <Text style={[styles.empty, rtl && styles.rtl]}>{s.receipts.none}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
          {attachments.map((a) => (
            <ReceiptTile
              key={a.id}
              a={a}
              lang={lang}
              onRemove={() => confirmRemove(a.id)}
              onRetry={() => void onRetry(a.id)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        {buttons.map((b) => (
          <Pressable
            key={b.key}
            onPress={() => void run(b.key)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={b.label}
            accessibilityState={{ disabled: busy !== null, busy: busy === b.key }}
            style={({ pressed }) => [
              styles.action,
              (pressed || busy === b.key) && styles.actionPressed,
              busy !== null && busy !== b.key && styles.actionDim,
            ]}
          >
            {busy === b.key ? (
              <ActivityIndicator size="small" color={INK_SOFT} />
            ) : (
              <Text style={styles.actionText}>{b.label}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {notice && (
        // role="alert" ليُعلَن فورًا: الرفض يحدث بعد رحلة للمنتقي
        // ورجوع، ولو مرّ صامتًا ظنّ المستخدم أنّ الإرفاق نجح.
        <Text accessibilityRole="alert" style={[styles.notice, rtl && styles.rtl]}>
          {notice}
        </Text>
      )}
    </View>
  );
}

function ReceiptTile({
  a,
  lang,
  onRemove,
  onRetry,
}: {
  a: Attachment;
  lang: Lang;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const s = strings(lang);
  const pending = a._pendingUpload === true;
  const dead = pending && isExhausted(a);
  const isPdf = a.kind === 'pdf';

  return (
    <View style={styles.tile}>
      {isPdf ? (
        <View style={[styles.thumb, styles.pdfThumb]}>
          <Text style={styles.pdfMark}>PDF</Text>
        </View>
      ) : (
        <Image
          source={{ uri: a._localUri }}
          style={styles.thumb}
          // الفاتورة قد تكون أطول من مربّعها بكثير
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel={a.caption ?? s.receipts.open}
        />
      )}

      {dead ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.badgeBad}>
          <Text style={styles.badgeBadText} numberOfLines={2}>
            {s.receipts.retry}
          </Text>
        </Pressable>
      ) : pending ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {s.receipts.pending}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={s.receipts.remove}
        hitSlop={8}
        style={styles.remove}
      >
        <Text style={styles.removeMark}>×</Text>
      </Pressable>
    </View>
  );
}

const INK = '#212529';
const INK_SOFT = '#495057';
const INK_FAINT = '#6B6257';
const LINE = '#EFE7DC';
const SUNKEN = '#F1E9DD';
const WARN = '#8C5000';
const WARN_TINT = '#FDF0E6';
const BAD = '#B01B1B';

const rtlText = { writingDirection: 'rtl' as const };

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  rtl: rtlText,
  heading: { fontSize: 14, fontWeight: '700', color: INK },
  empty: { fontSize: 12, color: INK_FAINT },

  strip: { flexGrow: 0 },
  tile: { marginEnd: 8, width: 84 },

  thumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: SUNKEN,
    borderWidth: 1,
    borderColor: LINE,
  },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  pdfMark: { fontSize: 13, fontWeight: '700', color: INK_SOFT, letterSpacing: 1 },

  badge: {
    marginTop: 5,
    backgroundColor: WARN_TINT,
    borderRadius: 7,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 10, color: WARN, ...rtlText },

  badgeBad: {
    marginTop: 5,
    backgroundColor: BAD,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 30,
    justifyContent: 'center',
  },
  badgeBadText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF', ...rtlText },

  remove: {
    position: 'absolute',
    top: -6,
    insetInlineEnd: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMark: { color: '#FFFFFF', fontSize: 15, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8 },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: SUNKEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionPressed: { opacity: 0.7 },
  actionDim: { opacity: 0.4 },
  actionText: { fontSize: 13, fontWeight: '600', color: INK_SOFT, ...rtlText },

  notice: { fontSize: 12, color: BAD, ...rtlText },
});
