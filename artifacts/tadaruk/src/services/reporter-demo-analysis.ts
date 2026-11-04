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
    title: ['تسرب مياه أسفل حوض التحضير', 'Water leak beneath the prep sink'],
    description: ['لوحظ تسرب مياه أسفل حوض التحضير. يُرجى فحص التوصيلات ومصدر التسرب.', 'A leak was noticed beneath the prep sink. Please inspect the connections and source of the leak.'],
    priority: 'medium',
    locationKeywords: ['مطبخ', 'حوض', 'sink', 'kitchen', 'bathroom', 'حمام', 'دورة المياه', 'مستودع', 'صالة'],
    defaultLocation: ['أسفل حوض التحضير', 'Beneath the prep sink'],
  },
  {
    keywords: ['مكيف', 'تكييف', 'بارد', 'تبريد', 'ac', 'air conditioner', 'cooling', 'not cold', 'not cooling'],
    category: 'cooling',
    specialization: 'cooling',
    title: ['ضعف تبريد وحدة التكييف', 'Air-conditioning unit cooling is weak'],
    description: ['لوحظ ضعف في تبريد وحدة التكييف. يُرجى فحص أداء الوحدة وفتحات التهوية.', 'The air-conditioning unit is cooling poorly. Please inspect the unit and its vents.'],
    priority: 'medium',
    locationKeywords: ['مطبخ', 'مكتب', 'صالة', 'منطقة العملاء', 'kitchen', 'office', 'lobby', 'customer area', 'المستودع'],
    defaultLocation: ['منطقة التكييف', 'Air-conditioning area'],
  },
  {
    keywords: ['ثلاجة', 'براد', 'فريزر', 'refrigerator', 'fridge', 'freezer', 'لا تبرد'],
    category: 'cooling',
    specialization: 'cooling',
    title: ['صوت غير طبيعي من الثلاجة', 'Unusual noise from the refrigerator'],
    description: ['يصدر من الثلاجة صوت غير معتاد. يُرجى فحص الجهاز والتأكد من سلامة تشغيله.', 'The refrigerator is making an unusual noise. Please inspect the unit and verify it is operating correctly.'],
    priority: 'high',
    locationKeywords: ['مطبخ', 'تحضير', 'مستودع', 'kitchen', 'prep', 'storage', 'back room'],
    defaultLocation: ['منطقة التحضير', 'Preparation area'],
  },
  {
    keywords: ['لمبة', 'إنارة', 'اضاءة', 'ضوء', 'lighting', 'light', 'bulb', 'lamp'],
    category: 'electrical',
    specialization: 'electrical',
    title: ['عطل في إنارة منطقة الاستلام', 'Lighting fault in the pickup area'],
    description: ['لا تعمل الإنارة في منطقة الاستلام بالشكل المعتاد. يُرجى فحص المصابيح والتوصيلات.', 'The lighting in the pickup area is not working as expected. Please inspect the fixtures and connections.'],
    priority: 'low',
    locationKeywords: ['مطبخ', 'صالة', 'مدخل', 'ممر', 'حمام', 'kitchen', 'lobby', 'entrance', 'hallway', 'restroom'],
    defaultLocation: ['منطقة الاستلام', 'Pickup area'],
  },
  {
    keywords: ['كهرباء', 'تماس', 'قاطع', 'فيش', 'مقبس', 'شرر', 'electrical', 'outlet', 'socket', 'breaker', 'sparking'],
    category: 'electrical',
    specialization: 'electrical',
    title: ['مشكلة كهربائية تحتاج إلى فحص', 'Electrical issue requires inspection'],
    description: ['تم الإبلاغ عن مشكلة كهربائية، ويحتاج الموقع إلى فحص آمن من فني مختص.', 'An electrical issue was reported and the area needs a safe inspection by a qualified technician.'],
    priority: 'high',
    locationKeywords: ['مطبخ', 'لوحة', 'مكتب', 'مستودع', 'kitchen', 'panel', 'office', 'storage', 'server room'],
    defaultLocation: ['موقع المشكلة', 'Issue area'],
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
    const matchedScenario = scenarios.find(item => includesAny(source, item.keywords));
    const scenario = matchedScenario ?? (!request.description.trim() ? scenarios[0] : {
      keywords: [],
      category: 'general',
      specialization: 'general',
      title: ['طلب صيانة يحتاج إلى فحص', 'Maintenance issue needs inspection'],
      description: ['تم الإبلاغ عن مشكلة صيانة، ويحتاج الموقع إلى فحص لتحديد الإجراء المناسب.', 'A maintenance issue was reported and needs inspection to determine the appropriate action.'],
      priority: 'medium',
      locationKeywords: [],
      defaultLocation: ['موقع البلاغ داخل الفرع', 'Report location in the branch'],
    });
    const localeIndex = request.locale === 'ar' ? 0 : 1;
    const providedLocation = request.location?.trim() || findProvidedLocation(source, scenario);
    const finalLocation = providedLocation || scenario.defaultLocation[localeIndex];
    return {
      title: scenario.title[localeIndex],
      description: scenario.description[localeIndex],
      category: scenario.category,
      specialization: scenario.specialization,
      priority: scenario.priority,
      location: finalLocation,
      needsClarification: false,
      mode: 'demo',
    };
  },
};
