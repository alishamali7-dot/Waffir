/**
 * النصوص العربية — المرجع الذي تُقاس عليه بقيّة اللغات.
 *
 * سياسة اللغة (قرار ٣ نوفمبر ٢٠٢٦):
 *
 * ١. **فصحى ميسّرة، لا عاميّة.** التطبيق على البلايستور يقرأه مصريّ
 *    ومغربيّ وسوريّ وخليجيّ. «وش» و«شلون» و«وين» و«مقاضي» تُفهم في
 *    الخليج وحده، فحُذفت كلّها.
 *
 * ٢. **لا تفخيم.** فصحى قصيرة واضحة: «المتبقّي لك» لا «المبلغ المتبقّي
 *    تحت تصرّفكم». النصّ في تطبيق مالٍ يُقرأ في ثانية، لا يُتأمَّل.
 *
 * ٣. **الشدّة حيث ترفع اللبس فقط.** «حدّ» لا «حد» (تُقرأ حَدَ)،
 *    و«أيّ» لا «أي». أمّا ياء النسبة (الميزانية، العملية) فالعُرف
 *    تركها، والتشكيل الكامل في الواجهات غلط لا دقّة.
 *
 * ٤. **الأرقام لاتينيّة للمال، عربيّة للعدد.** 142.500 د.ك تُقرأ أسرع
 *    بالصيغة اللاتينية، و«١٢ يومًا» أليَق في النصّ العربيّ.
 *
 * التصحيحات ومواضعها: i18n/ARABIC-REVIEW.md
 */

export const ar = {
  app: {
    name: 'مُوَفِّر',
    tagline: 'ميزانيتك في جيبك',
  },

  nav: {
    home: 'الرئيسية',
    transactions: 'العمليات',
    budget: 'الميزانية',
    reports: 'التقارير',
    add: 'إضافة عملية',
    more: 'المزيد',
  },

  auth: {
    signInTitle: 'أهلًا بك',
    signInSubtitle: 'سجّل الدخول لتظهر بياناتك على أجهزتك كلّها.',
    signUpTitle: 'حساب جديد',
    signUpSubtitle: 'حسابٌ واحد يجمع ميزانيتك على الجوّال والحاسوب.',

    email: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    password: 'كلمة المرور',
    passwordHint: 'ثمانية أحرف على الأقلّ.',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',

    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء الحساب',
    signingIn: 'جارٍ الدخول…',
    signingUp: 'جارٍ الإنشاء…',
    signOut: 'تسجيل الخروج',

    noAccount: 'لا حساب لك؟',
    createOne: 'أنشئ واحدًا',
    haveAccount: 'لك حساب؟',
    goSignIn: 'سجّل الدخول',

    checkEmailTitle: 'تحقّق من بريدك',
    checkEmail: 'أرسلنا رابط التأكيد إلى {email}. افتحه لتُكمل إنشاء حسابك.',

    errInvalid: 'البريد أو كلمة المرور غير صحيحة.',
    errTaken: 'هذا البريد مسجّل. سجّل الدخول به.',
    errWeak: 'كلمة المرور قصيرة — ثمانية أحرف على الأقلّ.',
    errEmailFormat: 'صيغة البريد غير صحيحة.',
    errUnconfirmed: 'لم يُؤكَّد بريدك بعد. افتح الرابط المرسل إليك.',
    errRate: 'محاولات كثيرة. انتظر قليلًا ثمّ أعد المحاولة.',
    errNetwork: 'لا اتصال. تحقّق من الشبكة ثمّ أعد المحاولة.',
    errGeneric: 'تعذّر إكمال الطلب. أعد المحاولة.',
    errConfig: 'مفاتيح Supabase غير مضبوطة على هذا الجهاز.',
  },

  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    change: 'تغيير',
    back: 'رجوع',
    next: 'التالي',
    skip: 'تخطّي',
    done: 'تمّ',
    all: 'الكل',
    viewAll: 'عرض الكل',
    today: 'اليوم',
    yesterday: 'أمس',
    optional: 'اختياريّ',
    currency: 'د.ك',
    search: 'بحث',
    filter: 'تصفية',
    add: 'إضافة',
    none: 'لا يوجد',
    // اسم منقوص: التنوين على النون المحذوفة لا على الياء
    seconds: 'ثوانٍ',
    perDay: 'يوميًّا',
    perMonth: 'شهريًّا',
    daysLeft: 'يومًا متبقّيًا',
  },

  home: {
    greeting: 'مرحبًا بك',
    monthIncome: 'دخل {month}',
    // «المتبقّي» معرَّفًا: يرفع إشكال الاسم المنقوص ويقرأ أوضح من «باقي»
    remaining: 'المتبقّي لك هذا الشهر',
    spent: 'المصروف',
    reservedFixed: 'محجوز للالتزامات',
    // اسم لا فعل: أدقّ وأقصر من «تقدر تصرف باليوم»
    dailyAllowance: 'المتاح للصرف يوميًّا',
    needsAttention: 'يحتاج انتباهك',
    // «أين ذهب» بدل «وين راحت»
    whereItWent: 'أين ذهب دخلك',
    categoryLimits: 'حدود الفئات',
    addExpense: 'إضافة مصروف',
  },

  add: {
    titleExpense: 'مصروف',
    titleIncome: 'دخل',
    titleTransfer: 'تحويل',
    amount: 'المبلغ',
    category: 'الفئة',
    tapToChange: 'اضغط لتغييرها',
    account: 'الحساب',
    date: 'التاريخ',
    note: 'ملاحظة',
    recurring: 'متكرّر',
    photo: 'صورة',
    understood: 'هذا ما فهمه التطبيق',
    // «يبقى لك» فصحى سليمة وأقصر من «سيبقى لديك»
    willRemain: 'يبقى لك {amount} في هذه الفئة',
    onlyRemains: 'يبقى لك {amount} فقط في هذه الفئة',
    overLimit: 'يتجاوز حدّ الفئة بمقدار {amount}',
    lastEntries: 'آخر ما سجّلته',
    clear: 'مسح',
    backspace: 'حذف رقم',
    // «ثوانٍ» لا «ثواني»
    savedIn: 'يُسجَّل في ثوانٍ',
    smartLabel: 'اكتب ما صرفته',
    smartPlaceholder: 'غداء أمس بثلاثة ونصف',
    understand: 'افهم',
    understanding: 'لحظة…',
    suggested: 'مقترَح',
    partial: 'تعذّر فهم كلّ شيء. أكمل الباقي بيدك.',
    saving: 'جارٍ الحفظ…',
    saved: 'سُجِّلت العملية',
    errAmount: 'اكتب مبلغًا صحيحًا أكبر من صفر.',
    errDate: 'التاريخ غير صالح.',
    errSave: 'تعذّر الحفظ ولم تُسجَّل العملية. أعد المحاولة.',
  },

  receipts: {
    title: 'الفواتير',
    none: 'لا فاتورة مرفقة',
    camera: 'التقاط',
    gallery: 'من الصور',
    pdf: 'ملفّ PDF',
    pending: 'بانتظار الرفع',
    uploading: 'يُرفع…',
    failed: 'تعذّر الرفع',
    retry: 'أعد المحاولة',
    remove: 'حذف',
    open: 'فتح الفاتورة',
    cameraDenied: 'الكاميرا تحتاج إذنًا من إعدادات الجهاز',
    // الحذف يمسح الملفّ من الجهاز والسيرفر معًا، فيُسأل عنه
    confirmRemove: 'حذف هذه الفاتورة؟',
    offlineHint: 'تُرفع وحدها عند عودة الاتصال',
    exhausted: 'توقّفت المحاولات — أعد الالتقاط أو احذفها',
  },

  income: {
    title: 'الدخل',
    subtitle: 'من أين يأتي دخلك',
    salaryOf: 'راتب {month}',
    arrived: 'وصل',
    // «إذا» بدل «لو» في سياق تقريريّ
    editIfDifferent: 'عدّل المبلغ إذا وصل مختلفًا هذا الشهر',
    onlyThisMonth:
      'التعديل يسري على {month} فقط. الأشهر السابقة لا تتغيّر، والمعتاد يبقى {amount}.',
    payDay: 'يوم الدخل',
    payDayHint: 'هنا يبدأ شهرك الماليّ، لا في الأوّل من الشهر',
    otherSources: 'مصادر دخل أخرى',
    addSource: 'إضافة مصدر',
    salaryHistory: 'سجلّ الدخل',
    usual: 'المعتاد',
    irregular: 'غير منتظم',
    noFixedIncome:
      'ليس لديك دخل ثابت؟ احذف هذا المصدر وسجّل دخلك عند وصوله من زرّ الإضافة.',
    kinds: {
      salary: 'راتب',
      salaryHint: 'يصل كلّ شهر في يوم معروف',
      extra: 'دخل إضافيّ',
      extraHint: 'عمل حرّ، بيع، إيجار، عمولة',
      bonus: 'مكافأة أو بدل',
      bonusHint: 'مرّة واحدة، لا يتكرّر',
      refund: 'مبلغ مُستردّ',
      refundHint: 'أُعيد إليك مبلغ مصروف سابق',
    },
    receivedIn: 'يُضاف إلى',
    treatAsSalary: 'اعتبره راتبي الشهريّ',
    treatAsSalaryHint: 'يُعيد حساب حدودك على هذا المبلغ، ويتكرّر كلّ شهر',
  },

  budget: {
    title: 'الميزانية',
    periods: {
      weekly: 'أسبوعيّة',
      monthly: 'شهريّة',
      yearly: 'سنويّة',
      custom: 'مخصّصة',
    },
    remainingOfLimits: 'المتبقّي من حدود الفئات',
    limits: 'الحدود',
    used: 'مُستهلَك',
    // «اقترب من الحدّ» أوضح من «قارب الحدّ» التي تحتاج منصوبًا ظاهرًا
    near: 'اقترب من الحدّ',
    over: 'تجاوز الحدّ',
    ok: 'في الحدّ',
    remainingAmount: 'المتبقّي {amount}',
    overBy: 'تجاوز بمقدار {amount}',
    stopHere: 'أوقف الصرف هنا',
    perDayLeft: '{amount} يوميًّا',
    addCategory: 'أضف فئة أو حدًّا جديدًا',
  },

  category: {
    manageTitle: 'الفئات',
    dragToReorder: 'اسحب لإعادة الترتيب',
    tabs: { expense: 'مصروف', income: 'دخل', archived: 'مؤرشفة' },
    newCategory: 'فئة جديدة',
    name: 'اسم الفئة',
    icon: 'الأيقونة',
    color: 'اللون',
    monthlyLimit: 'حدّ شهريّ',
    monthlyLimitHint: 'اتركه فارغًا إذا لم ترغب في تنبيه لهذه الفئة',
    keywords: 'كلمات تساعد التصنيف',
    keywordsHint: 'يستخدمها التطبيق في الإدخال النصيّ',
    addKeyword: 'كلمة',
    takesRemainder: 'يأخذ المتبقّي تلقائيًّا',
    noLimit: 'بلا حدّ',
    limitIs: 'حدّ شهريّ {amount}',
    archive: 'أرشفة الفئة',
    // «يفسد» بدل «يخرّب»
    archiveHint:
      'حذف فئة فيها عمليات يفسد تقاريرك السابقة. التطبيق يؤرشفها بدلًا من الحذف: تختفي من قوائم الإدخال ويبقى تاريخها سليمًا.',
    restoreDefaults: 'استرجاع الافتراضية',
    thisMonthEntries: 'عمليات هذا الشهر',
    lastSixMonths: 'آخر ستّة أشهر',
    average: 'المعدّل',
    raiseLimit: 'ارفع الحدّ',
    moveFromAnother: 'انقل مبلغًا من فئة أخرى',
    addToThis: 'أضف مصروفًا في «{name}»',
    defaults: {
      food: 'طعام وشراب',
      cafe: 'مطاعم وقهوة',
      transport: 'مواصلات',
      bills: 'فواتير وإيجار',
      shopping: 'تسوُّق',
      health: 'صحّة',
      kids: 'أطفال وتعليم',
      fun: 'ترفيه',
      other: 'أخرى',
    },
  },

  accounts: {
    title: 'الحسابات',
    subtitle: 'أين أموالك محفوظة',
    total: 'مجموع ما لديك',
    accountCount: '{count} حسابات',
    oneCurrency: 'عملة واحدة',
    addAccount: 'إضافة حساب',
    transfer: 'تحويل بين حسابين',
    from: 'من',
    to: 'إلى',
    doTransfer: 'حوّل مبلغًا',
    // الجوهر: التحويل ليس صرفًا
    transferHint:
      'التحويل ليس مصروفًا: لا يُحسب على أيّ فئة ولا يُنقص ميزانيتك. هذه أكثر نقطة يُخطئ فيها الناس في تطبيقات الميزانية.',
    currencyHint:
      'تريد عملة أخرى؟ كلّ حساب يمكن أن يكون بعملته، والتطبيق يوحّدها في المجموع بسعر تحدّده أنت.',
    kinds: {
      cash: 'نقد',
      cashHint: 'ما في جيبك',
      card: 'بطاقة',
      cardHint: 'الدخل يُضاف هنا',
      savings: 'حساب ادِّخار',
      savingsHint: 'منفصل · لا يُصرف منه',
      wallet: 'محفظة الجوّال',
      walletHint: 'للمشتريات الصغيرة',
      other: 'آخر',
    },
  },

  recurring: {
    title: 'الثابت والمتكرّر',
    subtitle: 'يُسجَّل تلقائيًّا كلّ شهر',
    monthlyTotal: 'يُخصم كلّ شهر',
    ofIncome: '{percent} من دخلك',
    itemCount: '{count} بندًا',
    tabs: {
      fixed: 'ثابت',
      installments: 'أقساط',
      subscriptions: 'اشتراكات',
      seasonal: 'موسميّ',
    },
    addFixed: 'أضف التزامًا ثابتًا',
    dayOfMonth: 'يوم {day}',
    automatic: 'تلقائيّ',
    approximate: 'مبلغ تقديريّ',
    deductedFromSalary: 'يُخصم من الراتب',
    remainingBalance: 'المتبقّي {amount}',
    monthlyInstallment: 'القسط الشهريّ',
    endsOn: 'ينتهي في {date}',
    seasonalHint:
      'لديك مصروف سنويّ كبير (رسوم، تأمين، سفر)؟ ضعه في «موسميّ» فيقسّمه التطبيق على اثني عشر شهرًا ويحجزه شهريًّا، فلا يفاجئك.',
  },

  goals: {
    title: 'أهداف الادِّخار',
    subtitle: 'اختياريّ · التطبيق يعمل بدونها',
    newGoal: 'هدف جديد',
    activeGoal: 'هدف نشط',
    savedToday: 'حُفظ اليوم',
    logToday: 'سجّل حفظ اليوم',
    savedOfTarget: '{saved} من {target} هذا الشهر',
    streak: '{count} يومًا متواصلًا',
    everyDay: 'كلّ يوم',
    balance: 'الرصيد',
    account: 'الحساب',
    dayByDay: '{month} — يومًا بيوم',
    legend: { saved: 'محفوظ', missed: 'فائت', upcoming: 'قادم' },
    otherGoals: 'أهداف أخرى',
    paused: 'متوقّف مؤقّتًا',
    savedSoFar: '{amount} محفوظة',
    progressOf: '{saved} من هدف {target}',
    cadenceHint:
      'الهدف يقبل أيّ إيقاع: يوميّ، أسبوعيّ، شهريّ، أو مبلغ وتاريخ فيحسب التطبيق القسط.',
    cadences: { daily: 'يوميّ', weekly: 'أسبوعيّ', monthly: 'شهريّ' },
    emergencyFund: 'صندوق الطوارئ',
  },

  transactions: {
    title: 'العمليات',
    in: 'داخل',
    out: 'خارج',
    net: 'الفرق',
    allCategories: 'كلّ الفئات',
    allAccounts: 'كلّ الحسابات',
    count: '{count} عمليات',
  },

  reports: {
    title: 'التقارير',
    export: 'تصدير',
    spendingSixMonths: 'الصرف في آخر ستّة أشهر',
    // «الماضي» بدل «اللي فات»
    lowerThanLast: '{month} أقلّ من الشهر الماضي بمقدار {amount}',
    higherThanLast: '{month} أعلى من الشهر الماضي بمقدار {amount}',
    whereItWent: 'أين ذهب دخلك هذا الشهر',
    topDay: 'أكثر أيّام الأسبوع صرفًا',
    topCategory: 'أكثر الفئات',
    ofSpending: '{percent} من الصرف',
    uncategorized: 'لديك {count} عمليات بلا فئة',
    uncategorizedHint: 'صنّفها لتصبح التقارير دقيقة',
    classify: 'صنّف',
    share: 'مشاركة التقرير',
  },

  alerts: {
    title: 'التنبيهات',
    needCount: '{count} تحتاج انتباهك',
    settings: 'إعدادات التنبيهات',
    actionable: 'يستدعي تصرّفًا',
    informational: 'للعلم',
    dismiss: 'تجاهل',
    dismissedThisMonth: 'متجاهَلة هذا الشهر: {count}',
    show: 'عرض',
    warnAt: 'نبّهني عند الوصول إلى',
    warnAtHint: 'من حدّ أيّ فئة',
    duplicateSubs: 'تنبيه الاشتراكات المكرّرة',
    duplicateSubsHint: 'إذا خُصم الاشتراك نفسه مرّتين',
    dailyReminder: 'تذكير الحفظ اليوميّ',
    dailyReminderHint: 'كلّ يوم في الساعة {time}',
    kinds: {
      categoryOver: 'تجاوزت حدّ {name}',
      categoryOverBody:
        'صرفت {spent} من حدّ {limit}. بقي {days} من الشهر — ارفع الحدّ أو خفّض الصرف.',
      categoryNear: 'اقتربت من حدّ {name}',
      categoryNearBody: '{spent} من {limit} — {percent}',
      duplicateSub: 'اشتراك خُصم مرّتين',
      duplicateSubBody:
        '{name} بمبلغ {amount} خُصم في {date1} و{date2}. غالبًا حساب مكرّر أو تجديد خاطئ.',
      savingsMissed: 'فاتك حفظ {date}',
      savingsMissedBody: 'تأخّرت بمقدار {amount} عن جدول الادِّخار',
      sinkingDue: '{name} بعد {months} أشهر',
      sinkingDueBody: 'المتجمّع {accrued} — المتبقّي {remaining}',
      incomeArrived: 'وصل دخل {month}',
      incomeArrivedBody: '{amount} · تأكّد من صحّة المبلغ',
    },
    openCategory: 'افتح الفئة',
    reviewEntries: 'راجع العمليات',
  },

  /**
   * أسماء البذور بلغة المستخدم، بمفاتيح معرّفات `templates.ts`.
   * تُكتب في حسابه مرّة واحدة عند الإعداد، ثمّ تصير بياناته يغيّرها كما يشاء.
   */
  seed: {
    cash: 'كاش',
    card: 'البطاقة الرئيسية',
    savings: 'حساب الادخار',
    food: 'أكل وشراب',
    cafe: 'مطاعم وقهوة',
    transport: 'مواصلات',
    bills: 'فواتير وإيجار',
    shopping: 'تسوّق',
    health: 'صحة',
    kids: 'أطفال وتعليم',
    fun: 'ترفيه',
    other: 'أخرى',
    rent: 'إيجار',
    utilities: 'كهرباء وماء',
    phone: 'إنترنت وجوال',
    emergency: 'صندوق الطوارئ',
    primary: 'الدخل الأساسي',
    allowance: 'مصروف',
  },

  setup: {
    step: 'الخطوة {n} من {total}',
    lastStep: 'الخطوة {n} من {total} — الأخيرة',
    // ١
    currencyTitle: 'ما عملتك؟',
    currencyHint:
      'تُعرض كلّ الأرقام في التطبيق بهذه العملة. يمكنك تغييرها لاحقًا.',
    searchCurrency: 'عملة أخرى — ابحث في أكثر من ١٥٠ عملة',
    language: 'لغة التطبيق',
    languageArabic: 'العربية · من اليمين إلى اليسار',
    languageEnglish: 'الإنجليزية · من اليسار إلى اليمين',
    decimals: 'الخانات العشرية',
    decimalsHint: '{count} خانات · تتبع العملة',
    privacy:
      'بياناتك تتزامن بين أجهزتك بحسابك وحده. ولا نطلب ربطًا بأيّ بنك، لا الآن ولا لاحقًا.',
    // ٢
    shapeTitle: 'كيف يأتيك دخلك؟',
    shapeHint:
      'جوابك يحدّد الفئات والحدود التي نجهّزها لك. ليس قالبًا جاهزًا — يمكنك تعديل كلّ شيء بعده.',
    mostCommon: 'الأكثر',
    shapeNotFound:
      'لم تجد حالتك؟ اختر أيّ واحدة وعدّل بعدها — الفئات والحدود كلّها قابلة للتغيير والحذف.',
    startBlank: 'ابدأ من الصفر بلا فئات جاهزة',
    shapes: {
      fixedSalary: 'راتب شهريّ ثابت',
      fixedSalaryHint: 'يصل في يوم معروف كلّ شهر',
      fixedSalaryGives:
        'يجهّز: التزامات ثابتة + حدودًا شهرية + شهرًا ماليًّا يبدأ يوم الراتب',
      variable: 'دخل متغيّر',
      variableHint: 'عمل حرّ، تجارة، عمولة — يختلف كلّ شهر',
      variableGives: 'يجهّز: حدودًا بنسبة من الدخل الفعليّ، لا مبالغ ثابتة',
      allowance: 'مصروف أو مساعدة',
      allowanceHint: 'طالب، أو يأتيك مبلغ من أحد',
      allowanceGives: 'يجهّز: فئات أقلّ وأبسط، بلا التزامات كبيرة',
      multiple: 'مصادر متعدّدة',
      multipleHint: 'راتب ومعه دخل ثانٍ أو أكثر',
      multipleGives: 'يجهّز: مصادر دخل منفصلة، كلّ واحد بيومه',
      none: 'ابدأ من الصفر',
      noneHint: 'بلا دخل مُسجَّل — أسجّل مصروفاتي فقط',
      noneGives: 'يجهّز: فئة واحدة، وتضيف الباقي بنفسك',
    },
    // ٣
    incomeTitle: 'كم دخلك؟',
    incomeHint:
      'عليه نحسب حدودك. لا تريد كتابته الآن؟ تخطّه وسجّل مصروفاتك فقط — التطبيق يعمل بلا دخل.',
    incomeAmount: 'المبلغ الذي يصل كلّ شهر',
    payDayHint: 'هنا يبدأ شهرك الماليّ',
    varyingIncome: 'دخلي يختلف من شهر إلى شهر',
    varyingIncomeHint: 'نسألك عن المبلغ الفعليّ في أوّل كلّ شهر',
    initialSplit: 'كيف نقسّم {amount} مبدئيًّا',
    splitHint: 'تقسيم مبدئيّ يمكنك تغييره كلّه من شاشة الميزانية.',
    splitRows: {
      fixed: 'التزامات ثابتة',
      limits: 'حدود الصرف',
      savings: 'ادِّخار',
      free: 'فائض مرن',
    },
    finish: 'تمّ — ابدأ الاستخدام',
    skipIncome: 'تخطّي — أسجّل مصروفاتي فقط',
    payDay: 'يصل يوم',
    saving: 'جارٍ التجهيز…',
    errIncome: 'اكتب المبلغ بالأرقام، مثل 1250.500',
    errSave: 'تعذّر حفظ الإعداد ولم يُكتب شيء. أعد المحاولة.',
  },

  empty: {
    // «لم تُسجّل» بدل «ما سجّلت»، و«أيّ» بالشدّة
    nothingYet: 'لم تُسجّل أيّ عملية بعد',
    nothingYetBody:
      'سجّل أوّل مصروف — ولو قهوة بنصف دينار. من ثلاث عمليات يبدأ التطبيق يعرف فئاتك ويعطيك أرقامًا ذات معنى.',
    firstExpense: 'سجّل أوّل مصروف',
    twoSteps: 'خطوتان تجعلان الأرقام أدقّ',
    steps: {
      income: 'أضف دخلك',
      incomeHint: 'عندها يعرف التطبيق كم بقي لك، لا كم صرفت فقط',
      limits: 'حدّد حدود الفئات',
      limitsHint: 'كم تريد أن تصرف على الطعام والمواصلات شهريًّا',
      reminder: 'فعّل تذكيرًا يوميًّا',
      reminderHint: 'التسجيل عادة — دقيقة في اليوم تكفي',
    },
    noneRequired: 'ولا شيء من هذا ضروريّ',
    noneRequiredBody:
      'سجّل مصروفاتك فقط — التطبيق يعمل هكذا. الدخل والحدود والأهداف كلّها تحسينات، لا شروط.',
  },

  more: {
    title: 'المزيد',
    groups: {
      money: 'أموالك',
      app: 'التطبيق',
      other: 'غير ذلك',
    },
    income: 'الدخل',
    incomeHint: 'المبلغ، يوم الوصول، المصادر',
    accounts: 'الحسابات والمحافظ',
    accountsHint: 'نقد، بطاقة، ادِّخار',
    categories: 'الفئات والحدود',
    categoriesHint: '{count} فئات · أضف واحذف',
    recurring: 'الثابت والمتكرّر',
    recurringHint: 'إيجار، أقساط، اشتراكات',
    goals: 'أهداف الادِّخار',
    goalsHint: '{count} أهداف · اختياريّ',
    alerts: 'التنبيهات',
    alertsHint: 'متى ننبّهك ومتى نسكت',
    backup: 'نسخة احتياطية وتصدير',
    backupHint: 'ملفّ على جهازك · CSV',
    sync: 'المزامنة بين أجهزتك',
    syncHint: 'تلقائيّة · تعمل في الخلفية',
    lock: 'قفل التطبيق',
    lockHint: 'بصمة أو رقم سرّيّ',
    theme: 'المظهر',
    themeHint: 'فاتح · داكن · يتبع النظام',
    languageCurrency: 'اللغة والعملة',
    rate: 'قيّم التطبيق',
    rateHint: 'يساعد غيرك على إيجاده',
    help: 'مساعدة وأسئلة',
    helpHint: 'كيف أعدّل حدًّا؟ كيف أضيف فئة؟',
    version: '{name} · الإصدار {version}',
    dataLocal: 'بياناتك متزامنة بحسابك',
  },

  months: [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ],

  monthsShort: [
    'ينا', 'فبر', 'مار', 'أبر', 'مايو', 'يون',
    'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس',
  ],

  weekdays: [
    'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
    'الخميس', 'الجمعة', 'السبت',
  ],
};

/**
 * شكل القائمة، مشتقٌّ من العربية.
 *
 * بلا `as const` عن قصد: معه يصير كلّ نصّ **نوعًا حرفيًّا**، فتُطالب
 * الإنجليزية بأن تكون «الرئيسية» حرفًا بحرف. ما نريده هو تطابق
 * المفاتيح لا القيم، وهذا ما يعطيه `typeof` على كائن عاديّ: مفتاح
 * ناقص أو زائد خطأ ترجمة، والقيمة حرّة.
 */
export type Strings = typeof ar;
