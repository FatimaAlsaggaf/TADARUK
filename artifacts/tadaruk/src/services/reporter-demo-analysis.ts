import type { TicketAnalysis, TicketAnalysisInput } from '@workspace/api-client-react';

export type ReporterDemoAnalysisRequest = TicketAnalysisInput & {
  locale: 'ar' | 'en';
};

export type ReporterDemoAnalysisResult = TicketAnalysis & {
  mode: 'demo';
};

type Scenario = {
  keywords: string[];
  category: string;
  specialization: string;
  title: [string, string];
  description: [string, string];
  priority: TicketAnalysis['priority'];
  locationKeywords: string[];
  defaultLocation: [string, string];
};

export const PRESET_DEMO_SCENARIOS = [
  {
    id: 'leak',
    emoji: '💧',
    label: { ar: 'تسرب مياه تحت المغسلة', en: 'Water leak under sink' },
    description: {
      ar: 'يوجد تسرب مياه نشط أسفل حوض التحضير في المطبخ، المياه تتجمع على الأرض ويصعب العمل.',
      en: 'There is an active water leak under the kitchen prep sink, pooling on the floor.',
    },
    location: { ar: 'المطبخ - أسفل حوض التحضير', en: 'Kitchen - beneath prep sink' },
    photoUrl: '/demo-photos/ticket-demo-2401.jpg',
  },
  {
    id: 'ac',
    emoji: '❄️',
    label: { ar: 'عطل في مكيف الصالة', en: 'AC fault in customer hall' },
    description: {
      ar: 'المكيف في صالة العملاء لا يبرد نهائياً ويخرج هواء حار مع صوت اهتزاز متقطع.',
      en: 'The AC in the main customer area is not cooling at all and blowing warm air.',
    },
    location: { ar: 'صالة العملاء', en: 'Customer area' },
    photoUrl: '/demo-photos/ticket-demo-2402.jpg',
  },
  {
    id: 'spark',
    emoji: '⚡',
    label: { ar: 'فيش كهرباء يصدر شرراً', en: 'Electrical socket sparking' },
    description: {
      ar: 'مقبس الكهرباء في منطقة التحضير يصدر شرارة ورائحة احتراق خفيفة عند توصيل الأجهزة.',
      en: 'Wall electrical socket in the prep area sparks and emits a burnt odor when connected.',
    },
    location: { ar: 'المطبخ - جدار التحضير', en: 'Kitchen - prep wall' },
    photoUrl: '/demo-photos/ticket-demo-2403.jpg',
  },
];

const scenarios: Scenario[] = [
  {
    keywords: ['تسرب', 'تسريب', 'موية', 'ماء', 'حوض', 'water leak', 'leaking', 'leak', 'sink', 'سباكة'],
    category: 'plumbing',
    specialization: 'plumbing',
    title: ['تسرب مياه أسفل حوض التحضير', 'Water leak beneath the prep sink'],
    description: [
      'لوحظ تسرب مياه أسفل حوض التحضير. يُرجى فحص توصيلات السباكة ومصدر التسرب وإصلاحه لمنع تراكم المياه.',
      'A leak was noticed beneath the prep sink. Please inspect the plumbing connections and repair the leak.',
    ],
    priority: 'urgent',
    locationKeywords: ['مطبخ', 'حوض', 'sink', 'kitchen', 'bathroom', 'حمام', 'دورة المياه', 'مستودع', 'صالة'],
    defaultLocation: ['المطبخ - أسفل حوض التحضير', 'Kitchen - beneath the prep sink'],
  },
  {
    keywords: ['مكيف', 'تكييف', 'بارد', 'تبريد', 'حرارة', 'ac', 'air conditioner', 'cooling', 'not cold', 'not cooling'],
    category: 'cooling',
    specialization: 'cooling',
    title: ['ضعف تبريد وحدة التكييف', 'Air-conditioning unit cooling failure'],
    description: [
      'لوحظ ضعف شديد في تبريد وحدة التكييف وخروج هواء دافئ. يُرجى فحص أداء الكمبروسر وفلاتر التبريد.',
      'The air-conditioning unit is not cooling and blowing warm air. Please inspect the unit compressor and filters.',
    ],
    priority: 'high',
    locationKeywords: ['مطبخ', 'مكتب', 'صالة', 'منطقة العملاء', 'kitchen', 'office', 'lobby', 'customer area', 'المستودع'],
    defaultLocation: ['صالة العملاء', 'Customer area'],
  },
  {
    keywords: ['ثلاجة', 'براد', 'فريزر', 'refrigerator', 'fridge', 'freezer'],
    category: 'cooling',
    specialization: 'cooling',
    title: ['ارتفاع حرارة وصوت غير طبيعي من الثلاجة', 'High temperature and unusual noise from refrigerator'],
    description: [
      'يصدر من الثلاجة صوت اهتزاز غير معتاد مع ارتفاع في درجة الحرارة الداخلية. يُرجى فحص دورة التبريد.',
      'The refrigerator is making an unusual noise with elevated internal temperature. Please inspect the cooling cycle.',
    ],
    priority: 'high',
    locationKeywords: ['مطبخ', 'تحضير', 'مستودع', 'kitchen', 'prep', 'storage', 'back room'],
    defaultLocation: ['المطبخ - منطقة التحضير', 'Kitchen - preparation area'],
  },
  {
    keywords: ['كهرباء', 'تماس', 'قاطع', 'فيش', 'مقبس', 'شرر', 'شرارة', 'electrical', 'outlet', 'socket', 'breaker', 'sparking'],
    category: 'electrical',
    specialization: 'electrical',
    title: ['شرر كهربائي في مقبس الجدار', 'Electrical sparking at wall socket'],
    description: [
      'تم رصد شرر كهربائي متقطع في المقبس ويحتاج الموقع إلى فحص آمن وفوري من فني كهرباء معتمد.',
      'Intermittent electrical sparks were reported at the socket. Requires immediate safe inspection by a certified electrician.',
    ],
    priority: 'urgent',
    locationKeywords: ['مطبخ', 'لوحة', 'مكتب', 'مستودع', 'kitchen', 'panel', 'office', 'storage'],
    defaultLocation: ['المطبخ - جدار التحضير', 'Kitchen - prep wall'],
  },
  {
    keywords: ['لمبة', 'إنارة', 'اضاءة', 'ضوء', 'lighting', 'light', 'bulb', 'lamp'],
    category: 'electrical',
    specialization: 'electrical',
    title: ['عطل في إنارة منطقة الاستلام', 'Lighting malfunction in pickup area'],
    description: [
      'لا تعمل وحدات الإنارة بالشكل المعتاد، مما يؤثر على وضوح الرؤية في الموقع. يُرجى فحص التوصيلات واستبدال المصابيح.',
      'The lighting fixtures are not working properly. Please inspect connections and replace faulty fixtures.',
    ],
    priority: 'low',
    locationKeywords: ['مطبخ', 'صالة', 'مدخل', 'ممر', 'حمام', 'kitchen', 'lobby', 'entrance', 'hallway', 'restroom'],
    defaultLocation: ['منطقة الاستلام', 'Pickup area'],
  },
];

const includesAny = (source: string, words: string[]) => words.some(word => source.includes(word));

function findProvidedLocation(source: string): string {
  const knownLocations: Array<[string[], string, string]> = [
    [['المطبخ', 'مطبخ', 'kitchen'], 'المطبخ', 'Kitchen'],
    [['حوض التحضير', 'حوض', 'sink'], 'المطبخ - أسفل الحوض', 'Kitchen - sink area'],
    [['صالة العملاء', 'صالة', 'customer area', 'lobby', 'dining'], 'صالة العملاء', 'Customer area'],
    [['المستودع', 'مستودع', 'storage', 'back room'], 'المستودع', 'Storage'],
    [['دورات المياه', 'دورة المياه', 'حمام', 'restroom', 'bathroom'], 'دورات المياه', 'Restrooms'],
    [['المدخل', 'مدخل', 'entrance'], 'المدخل الرئيسي', 'Main entrance'],
    [['الممر', 'ممر', 'hallway'], 'الممر الخلفي', 'Back hallway'],
    [['المكتب', 'مكتب', 'office'], 'المكتب الإداري', 'Admin office'],
    [['غرفة الموظفين', 'staff room'], 'غرفة الموظفين', 'Staff room'],
  ];
  const match = knownLocations.find(([keys]) => includesAny(source, keys));
  return match ? match[1] : '';
}

function deriveTitleFromDescription(description: string, fallbackAr: string, fallbackEn: string): [string, string] {
  const clean = description.replace(/[.،!؟\n].*$/su, '').trim();
  if (clean.length >= 8 && clean.length <= 60) {
    return [clean, clean];
  }
  return [fallbackAr, fallbackEn];
}

export const reporterDemoAnalysisAdapter = {
  async analyze(request: ReporterDemoAnalysisRequest): Promise<ReporterDemoAnalysisResult> {
    // Deliberate pause allows the 3 analysis stages to be seen
    await new Promise(resolve => window.setTimeout(resolve, 600));

    const rawInput = `${request.description || ''} ${request.location || ''}`.trim().toLowerCase();
    const matchedScenario = scenarios.find(item => includesAny(rawInput, item.keywords));

    const localeIndex = request.locale === 'ar' ? 0 : 1;
    const providedLocation = request.location?.trim() || findProvidedLocation(rawInput);

    // If no scenario matched and input is sparse, use realistic water leak fixture
    const scenario = matchedScenario || (request.description.trim().length > 0 ? {
      keywords: [],
      category: 'general',
      specialization: 'general',
      title: deriveTitleFromDescription(request.description, 'طلب صيانة يحتاج إلى فحص', 'Maintenance request needs inspection'),
      description: [
        request.description.trim() || 'تم الإبلاغ عن مشكلة صيانة في الموقع وبانتظار التقييم الميداني.',
        request.description.trim() || 'A maintenance issue was reported and awaits field assessment.',
      ] as [string, string],
      priority: 'medium' as const,
      locationKeywords: [],
      defaultLocation: ['داخل الفرع', 'Inside the branch'] as [string, string],
    } : scenarios[0]);

    // Check if location clarification is required:
    // Required only when no location was explicitly passed or detected in the text
    const needsClarification = !providedLocation && !request.location?.trim();
    const finalLocation = providedLocation || (needsClarification ? '' : scenario.defaultLocation[localeIndex]);

    return {
      title: scenario.title[localeIndex],
      description: scenario.description[localeIndex],
      category: scenario.category,
      specialization: scenario.specialization,
      priority: scenario.priority,
      location: finalLocation,
      needsClarification,
      mode: 'demo',
    };
  },
};
