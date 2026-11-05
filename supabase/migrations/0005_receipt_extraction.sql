-- قراءة الفاتورة: تخزين ما استُخرج منها مرّةً واحدة.
--
-- ملاحظة على الترقيم: 0003 (lock_down_trigger_functions) و0004
-- (receipt_attachments) طُبِّقتا على المشروع مباشرةً ولم تُحفظا هنا، فسجلّ
-- الهجرات البعيد أكمل من هذا المجلّد. الرقم 0005 يوافق ترتيب التطبيق.
--
-- الاستخراج اقتراحٌ يُعرض على المستخدم، لا قيدٌ يُكتب تلقائيًّا. لذلك يسكن
-- في المرفَق نفسه ولا يلمس جدول العمليات: المستخدم هو من يؤكّد المبلغ.

alter table public.attachments
  add column if not exists extraction jsonb,
  add column if not exists extracted_at timestamptz;

-- إمّا نتيجةٌ وتاريخُها، وإمّا لا شيء. لا نصف صفٍّ مكتوب.
alter table public.attachments
  drop constraint if exists attachments_extraction_timestamped;
alter table public.attachments
  add constraint attachments_extraction_timestamped
  check ((extraction is null) = (extracted_at is null));

comment on column public.attachments.extraction is
  'ما قرأه النموذج من الفاتورة: {merchant,total_minor,currency,date,confidence,model,read_at}. اقتراحٌ للعرض، لا مصدرَ حقيقةٍ للمبلغ.';
comment on column public.attachments.extracted_at is
  'وقت آخر قراءة ناجحة. يُستعمل لتفادي إعادة القراءة ودفع ثمنها مرّتين.';
