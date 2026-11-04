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

const scenarios: Scenario[] = [
  {
    keywords: ['تسرب', 'تسريب', 'موية', 'ماء', 'water leak', 'leaking', 'leak'],
    category: 'plumbing',
    specialization: 'plumbing',
    title: ['تسرب مياه يحتاج إلى فحص', 'Water leak requires inspection'],
    description: ['تم الإبلاغ عن تسرب مياه، ويحتاج مصدره إلى فحص من فريق السباكة.', 'A water leak was reported and its source needs inspection by the plumbing team.'],
    priority: 'medium',
    locationKeywords: ['مطبخ', 'حوض', 'sink', 'kitchen', 'bathroom', 'حمام', 'دورة المياه', 'مستودع', 'صالة'],
    defaultLocation: ['موقع التسرب', 'Leak area'],
  },
  {
    keywords: ['مكيف', 'تكييف', 'بارد', 'تبريد', 'ac', 'air conditioner', 'cooling', 'not cold', 'not cooling'],
    category: 'cooling',
    specialization: 'cooling',
    title: ['مكيف لا يبرّد بالشكل المعتاد', 'Air conditioner is not cooling'],
    description: ['تم الإبلاغ عن ضعف في التبريد، ويحتاج جهاز التكييف إلى فحص.', 'Reduced cooling was reported; the air-conditioning unit needs inspection.'],
    priority: 'medium',
    locationKeywords: ['مطبخ', 'مكتب', 'صالة', 'منطقة العملاء', 'kitchen', 'office', 'lobby', 'customer area', 'المستودع'],
    defaultLocation: ['منطقة المكيف', 'Air-conditioning area'],
  },
  {
    keywords: ['ثلاجة', 'براد', 'فريزر', 'refrigerator', 'fridge', 'freezer', 'لا تبرد'],
    category: 'cooling',
    specialization: 'cooling',
    title: ['عطل في الثلاجة يحتاج إلى فحص', 'Refrigerator needs inspection'],
    description: ['تم الإبلاغ عن خلل في الثلاجة، ويحتاج الجهاز إلى فحص للحفاظ على أدائه.', 'A refrigerator issue was reported and the unit needs inspection to restore normal operation.'],
    priority: 'high',
    locationKeywords: ['مطبخ', 'تحضير', 'مستودع', 'kitchen', 'prep', 'storage', 'back room'],
    defaultLocation: ['منطقة الثلاجة', 'Refrigerator area'],
  },
  {
    keywords: ['لمبة', 'إنارة', 'اضاءة', 'ضوء', 'lighting', 'light', 'bulb', 'lamp'],
    category: 'electrical',
    specialization: 'electrical',
    title: ['تعطل الإنارة في الموقع', 'Lighting is not working'],
    description: ['تم الإبلاغ عن تعطل الإنارة، ويحتاج مصدر الضوء والتوصيلات إلى فحص.', 'A lighting fault was reported; the light source and connections need inspection.'],
    priority: 'low',
    locationKeywords: ['مطبخ', 'صالة', 'مدخل', 'ممر', 'حمام', 'kitchen', 'lobby', 'entrance', 'hallway', 'restroom'],
    defaultLocation: ['منطقة الإنارة', 'Lighting area'],
  },
  {
    keywords: ['كهرباء', 'تماس', 'قاطع', 'فيش', 'مقبس', 'شرر', 'electrical', 'outlet', 'socket', 'breaker', 'sparking'],
    category: 'electrical',
    specialization: 'electrical',
    title: ['مشكلة كهربائية تحتاج إلى فحص', 'Electrical issue requires inspection'],
    description: ['تم الإبلاغ عن مشكلة كهربائية، ويحتاج الموقع إلى فحص آمن من فني مختص.', 'An electrical issue was reported and the area needs a safe inspection by a qualified technician.'],
    priority: 'high',
    locationKeywords: ['مطبخ', 'لوحة', 'مكتب', 'مستودع', 'kitchen', 'panel', 'office', 'storage', 'server room'],
    defaultLocation: ['موقع المشكلة الكهربائية', 'Electrical issue area'],
  },
];

const includesAny = (source: string, words: string[]) => words.some(word => source.includes(word));

function findProvidedLocation(source: string, scenario: Scenario): string {
  const knownLocations: Array<[string[], string, string]> = [
    [['المطبخ', 'مطبخ', 'kitchen'], 'المطبخ', 'Kitchen'],
    [['حوض', 'sink'], 'منطقة الحوض', 'Sink area'],
    [['صالة العملاء', 'صالة', 'customer area', 'lobby'], 'صالة العملاء', 'Customer area'],
    [['المستودع', 'مستودع', 'storage', 'back room'], 'المستودع', 'Storage'],
    [['دورات المياه', 'دورة المياه', 'حمام', 'restroom', 'bathroom'], 'دورات المياه', 'Restrooms'],
    [['المدخل', 'مدخل', 'entrance'], 'المدخل', 'Entrance'],
    [['الممر', 'ممر', 'hallway'], 'الممر', 'Hallway'],
    [['المكتب', 'مكتب', 'office'], 'المكتب', 'Office'],
    [['غرفة الموظفين', 'staff room'], 'غرفة الموظفين', 'Staff room'],
  ];
  const match = knownLocations.find(([keys]) => includesAny(source, keys));
  return match ? match[1] : '';
}

export const reporterDemoAnalysisAdapter = {
  async analyze(request: ReporterDemoAnalysisRequest): Promise<ReporterDemoAnalysisResult> {
    // Small deliberate pause makes the analysis step visible without implying a live AI service.
    await new Promise(resolve => window.setTimeout(resolve, 520));
    const source = `${request.description} ${request.location ?? ''}`.toLocaleLowerCase();
    const scenario = scenarios.find(item => includesAny(source, item.keywords)) ?? {
      keywords: [],
      category: 'general',
      specialization: 'general',
      title: ['طلب صيانة يحتاج إلى فحص', 'Maintenance issue needs inspection'],
      description: ['تم الإبلاغ عن مشكلة صيانة، ويحتاج الموقع إلى فحص لتحديد الإجراء المناسب.', 'A maintenance issue was reported and needs inspection to determine the appropriate action.'],
      priority: 'medium',
      locationKeywords: [],
      defaultLocation: ['', ''],
    };
    const localeIndex = request.locale === 'ar' ? 0 : 1;
    const providedLocation = request.location?.trim() || findProvidedLocation(source, scenario);
    const needsClarification = !providedLocation;
    return {
      title: scenario.title[localeIndex],
      description: scenario.description[localeIndex],
      category: scenario.category,
      specialization: scenario.specialization,
      priority: scenario.priority,
      location: providedLocation || '',
      needsClarification,
      mode: 'demo',
    };
  },
};
