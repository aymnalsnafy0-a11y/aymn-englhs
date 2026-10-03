/**
 * محتوى ثابت لكلمات ملف التطوير (data/sample.csv).
 * في المرحلة 4 سيُولَّد هذا المحتوى بالذكاء الاصطناعي لكل كلمة مرة واحدة ويُخزَّن.
 */
export type MemoryKind = 'link' | 'story' | 'family'

export interface Example {
  en: string
  ar: string
}

export interface FamilyMember {
  en: string
  pos: string
  ar: string
}

export interface WordContent {
  meaningAr: string
  /** تقسيم المقاطع بنقطة وسطى، مثل pa·tience */
  syllables: string
  examples: Example[]
  memory: { kind: MemoryKind; text: string }
  family?: FamilyMember[]
}

const c = (
  meaningAr: string,
  syllables: string,
  examples: [string, string][],
  memory: WordContent['memory'],
  family?: [string, string, string][],
): WordContent => ({
  meaningAr,
  syllables,
  examples: examples.map(([en, ar]) => ({ en, ar })),
  memory,
  family: family?.map(([en, pos, ar]) => ({ en, pos, ar })),
})

export const SAMPLE_CONTENT: Record<string, WordContent> = {
  // ——— A1 ———
  'apple|noun': c('تفاحة', 'ap·ple', [
    ['I eat an apple every morning.', 'آكل تفاحة كل صباح.'],
    ['This apple is red and sweet.', 'هذه التفاحة حمراء وحلوة.'],
  ], { kind: 'link', text: 'شعار شركة Apple تفاحة مقضومة — تذكّر الشعار تتذكّر الكلمة.' }),

  'baby|noun': c('طفل رضيع', 'ba·by', [
    ['The baby is sleeping now.', 'الطفل الرضيع نائم الآن.'],
    ['My sister has a new baby.', 'أختي عندها طفل رضيع جديد.'],
  ], { kind: 'link', text: '«بيبي» — نفس الكلمة التي نقولها للطفل الصغير في البيت.' }),

  'bed|noun': c('سرير', 'bed', [
    ['I go to bed at ten o’clock.', 'أذهب إلى السرير الساعة العاشرة.'],
    ['There is a big bed in my room.', 'يوجد سرير كبير في غرفتي.'],
  ], { kind: 'story', text: 'شكل الكلمة b-e-d يشبه سريرًا: حرف b رأس السرير وحرف d نهايته.' }, [
    ['bedroom', 'noun', 'غرفة النوم'],
    ['bedtime', 'noun', 'وقت النوم'],
  ]),

  'beautiful|adjective': c('جميل', 'beau·ti·ful', [
    ['What a beautiful day!', 'يا له من يوم جميل!'],
    ['She has a beautiful voice.', 'لديها صوت جميل.'],
  ], { kind: 'family', text: 'beauty (جمال) + ful (مليء بـ) = مليء بالجمال.' }, [
    ['beauty', 'noun', 'جمال'],
    ['beautiful', 'adjective', 'جميل'],
    ['beautifully', 'adverb', 'بشكل جميل'],
  ]),

  'big|adjective': c('كبير', 'big', [
    ['They live in a big house.', 'يعيشون في بيت كبير.'],
    ['Is this shirt too big for me?', 'هل هذا القميص كبير جدًا عليّ؟'],
  ], { kind: 'link', text: '«بِق» على وزن «بيغ بن» Big Ben — الساعة الكبيرة في لندن.' }),

  'bread|noun': c('خبز', 'bread', [
    ['We buy fresh bread every day.', 'نشتري خبزًا طازجًا كل يوم.'],
    ['Can you pass me the bread, please?', 'هل تناولني الخبز من فضلك؟'],
  ], { kind: 'story', text: 'تخيّل خبزًا ساخنًا «بريد» يصل إليك مع ساعي البريد كل صباح.' }),

  'brother|noun': c('أخ', 'broth·er', [
    ['My brother is older than me.', 'أخي أكبر مني.'],
    ['I have one brother and two sisters.', 'لديّ أخ واحد وأختان.'],
  ], { kind: 'link', text: '«بروذر» — تشبه «بُر» (البِرّ): البِرّ بأخيك.' }),

  'bus|noun': c('حافلة (باص)', 'bus', [
    ['I take the bus to school.', 'آخذ الحافلة إلى المدرسة.'],
    ['The bus is late today.', 'الحافلة متأخرة اليوم.'],
  ], { kind: 'link', text: 'نفس كلمة «باص» التي نستخدمها بالعربية.' }),

  'car|noun': c('سيارة', 'car', [
    ['My father drives a white car.', 'أبي يقود سيارة بيضاء.'],
    ['Where did you park the car?', 'أين أوقفت السيارة؟'],
  ], { kind: 'link', text: '«كار» — صوت السيارة وهي تتحرك: كاااار!' }),

  'child|noun': c('طفل', 'child', [
    ['Every child needs love.', 'كل طفل يحتاج إلى الحب.'],
    ['When I was a child, I lived in a village.', 'عندما كنت طفلًا، عشت في قرية.'],
  ], { kind: 'family', text: 'الجمع غير منتظم: child ← children.' }, [
    ['children', 'noun', 'أطفال'],
    ['childhood', 'noun', 'طفولة'],
  ]),

  'city|noun': c('مدينة', 'cit·y', [
    ['Cairo is a very big city.', 'القاهرة مدينة كبيرة جدًا.'],
    ['I want to live in the city.', 'أريد أن أعيش في المدينة.'],
  ], { kind: 'link', text: '«سيتي» — مثل اسم نادي «مانشستر سيتي»: مدينة مانشستر.' }),

  'coffee|noun': c('قهوة', 'cof·fee', [
    ['I drink coffee with milk.', 'أشرب القهوة مع الحليب.'],
    ['Let’s meet for a coffee.', 'لنلتقِ على فنجان قهوة.'],
  ], { kind: 'link', text: 'أصل الكلمة عربي: «قهوة» ← kahve ← coffee.' }),

  'day|noun': c('يوم', 'day', [
    ['Have a nice day!', 'أتمنى لك يومًا سعيدًا!'],
    ['I study English every day.', 'أدرس الإنجليزية كل يوم.'],
  ], { kind: 'family', text: 'كلمات كثيرة مبنية عليها: today (اليوم)، birthday (عيد الميلاد)، Sunday.' }, [
    ['today', 'adverb', 'اليوم'],
    ['daily', 'adjective', 'يومي'],
  ]),

  'door|noun': c('باب', 'door', [
    ['Please close the door.', 'من فضلك أغلق الباب.'],
    ['Someone is at the door.', 'هناك شخص عند الباب.'],
  ], { kind: 'link', text: '«دور» — كل «دَور» في العمارة له باب.' }),

  'drink|verb': c('يشرب', 'drink', [
    ['You should drink more water.', 'يجب أن تشرب ماءً أكثر.'],
    ['What do you want to drink?', 'ماذا تريد أن تشرب؟'],
  ], { kind: 'family', text: 'فعل غير منتظم: drink ← drank ← drunk. وهو اسم أيضًا: a drink = مشروب.' }, [
    ['drink', 'noun', 'مشروب'],
    ['drank', 'verb', 'شَرِبَ (ماضٍ)'],
  ]),

  'eat|verb': c('يأكل', 'eat', [
    ['We eat dinner at eight.', 'نتناول العشاء في الثامنة.'],
    ['Do you eat meat?', 'هل تأكل اللحم؟'],
  ], { kind: 'family', text: 'فعل غير منتظم: eat ← ate ← eaten.' }, [
    ['ate', 'verb', 'أَكَلَ (ماضٍ)'],
    ['eaten', 'verb', 'مأكول (تصريف ثالث)'],
  ]),

  'egg|noun': c('بيضة', 'egg', [
    ['I have two eggs for breakfast.', 'آكل بيضتين على الفطور.'],
    ['How do you like your eggs?', 'كيف تحب البيض؟'],
  ], { kind: 'story', text: 'انظر إلى حرفي gg في egg: بيضتان جنبًا إلى جنب.' }),

  'family|noun': c('عائلة', 'fam·i·ly', [
    ['My family is very important to me.', 'عائلتي مهمة جدًا بالنسبة لي.'],
    ['How many people are in your family?', 'كم شخصًا في عائلتك؟'],
  ], { kind: 'link', text: '«فاميلي» — تُقال في لهجات عربية كثيرة: «الفاميلية».' }),

  'father|noun': c('أب', 'fa·ther', [
    ['My father works in a bank.', 'أبي يعمل في بنك.'],
    ['He is a good father.', 'هو أب جيد.'],
  ], { kind: 'link', text: 'father و mother و brother كلها تنتهي بـ ther — عائلة واحدة.' }),

  'friend|noun': c('صديق', 'friend', [
    ['She is my best friend.', 'هي أعز صديقة لي.'],
    ['I met a friend at the café.', 'قابلت صديقًا في المقهى.'],
  ], { kind: 'story', text: 'انتبه للإملاء: فيها كلمة end — «الصديق يبقى معك حتى النهاية» fri-END.' }, [
    ['friendly', 'adjective', 'ودود'],
    ['friendship', 'noun', 'صداقة'],
  ]),

  'good|adjective': c('جيد', 'good', [
    ['This is a good idea.', 'هذه فكرة جيدة.'],
    ['She is good at maths.', 'هي جيدة في الرياضيات.'],
  ], { kind: 'family', text: 'التفضيل غير منتظم: good ← better ← best.' }, [
    ['better', 'adjective', 'أفضل'],
    ['best', 'adjective', 'الأفضل'],
  ]),

  'happy|adjective': c('سعيد', 'hap·py', [
    ['I am happy to see you.', 'أنا سعيد برؤيتك.'],
    ['Happy birthday!', 'عيد ميلاد سعيد!'],
  ], { kind: 'family', text: 'happy ← happiness (سعادة) ← unhappy (غير سعيد).' }, [
    ['happiness', 'noun', 'سعادة'],
    ['happily', 'adverb', 'بسعادة'],
    ['unhappy', 'adjective', 'تعيس'],
  ]),

  'hotel|noun': c('فندق', 'ho·tel', [
    ['We stayed at a hotel near the sea.', 'أقمنا في فندق قرب البحر.'],
    ['The hotel has a nice pool.', 'في الفندق مسبح جميل.'],
  ], { kind: 'link', text: 'نفس الكلمة بالعربية: «أوتيل».' }),

  'house|noun': c('بيت، منزل', 'house', [
    ['Their house has a big garden.', 'لبيتهم حديقة كبيرة.'],
    ['Come to my house after school.', 'تعال إلى بيتي بعد المدرسة.'],
  ], { kind: 'story', text: 'house = المبنى، home = المكان الذي تشعر فيه بالانتماء.' }),

  'kitchen|noun': c('مطبخ', 'kitch·en', [
    ['My mother is cooking in the kitchen.', 'أمي تطبخ في المطبخ.'],
    ['The kitchen is next to the living room.', 'المطبخ بجانب غرفة المعيشة.'],
  ], { kind: 'link', text: '«كِتشِن» — قريبة من «كِتشب» الذي تجده في المطبخ.' }),

  'milk|noun': c('حليب', 'milk', [
    ['Children need milk.', 'الأطفال يحتاجون إلى الحليب.'],
    ['Do you take milk in your tea?', 'هل تضع حليبًا في الشاي؟'],
  ], { kind: 'link', text: '«مِلك» — الحليب «مِلك» البقرة.' }),

  'morning|noun': c('صباح', 'morn·ing', [
    ['Good morning!', 'صباح الخير!'],
    ['I run every morning.', 'أجري كل صباح.'],
  ], { kind: 'family', text: 'أجزاء اليوم: morning ← afternoon ← evening ← night.' }),

  'mother|noun': c('أم', 'moth·er', [
    ['My mother is a teacher.', 'أمي معلمة.'],
    ['I called my mother yesterday.', 'اتصلت بأمي أمس.'],
  ], { kind: 'link', text: '«مذر» — mother و father و brother: كلها بنهاية ther.' }),

  'night|noun': c('ليل، ليلة', 'night', [
    ['Good night!', 'تصبح على خير!'],
    ['I can’t sleep at night.', 'لا أستطيع النوم في الليل.'],
  ], { kind: 'story', text: 'حرفا gh صامتان — هادئان مثل الليل.' }, [
    ['tonight', 'adverb', 'الليلة'],
    ['midnight', 'noun', 'منتصف الليل'],
  ]),

  'room|noun': c('غرفة', 'room', [
    ['My room is on the second floor.', 'غرفتي في الطابق الثاني.'],
    ['This room is very cold.', 'هذه الغرفة باردة جدًا.'],
  ], { kind: 'family', text: 'bedroom (غرفة نوم)، bathroom (حمام)، classroom (فصل).' }, [
    ['bedroom', 'noun', 'غرفة نوم'],
    ['bathroom', 'noun', 'حمّام'],
  ]),

  'school|noun': c('مدرسة', 'school', [
    ['I walk to school.', 'أمشي إلى المدرسة.'],
    ['School starts at seven thirty.', 'تبدأ المدرسة في السابعة والنصف.'],
  ], { kind: 'story', text: 'تُنطق «سكول» — حرف h صامت.' }),

  'sister|noun': c('أخت', 'sis·ter', [
    ['My sister is a doctor.', 'أختي طبيبة.'],
    ['I share a room with my sister.', 'أتقاسم الغرفة مع أختي.'],
  ], { kind: 'link', text: '«سِستر» — مثل «سِتّ» أي سيدة: أختك ستّ البيت.' }),

  'small|adjective': c('صغير', 'small', [
    ['They have a small car.', 'لديهم سيارة صغيرة.'],
    ['This T-shirt is too small.', 'هذا القميص صغير جدًا.'],
  ], { kind: 'story', text: 'عكس big. تذكّر: Small مقاس S على الملابس.' }),

  'street|noun': c('شارع', 'street', [
    ['I live on this street.', 'أسكن في هذا الشارع.'],
    ['Be careful when you cross the street.', 'انتبه عندما تعبر الشارع.'],
  ], { kind: 'link', text: '«ستريت» ← «سِراط»: الطريق المستقيم.' }),

  'table|noun': c('طاولة', 'ta·ble', [
    ['The keys are on the table.', 'المفاتيح على الطاولة.'],
    ['Let’s sit at this table.', 'لنجلس على هذه الطاولة.'],
  ], { kind: 'link', text: '«تيبل» — قريبة من «طاولة».' }),

  'time|noun': c('وقت', 'time', [
    ['What time is it?', 'كم الساعة؟'],
    ['I don’t have time today.', 'ليس لديّ وقت اليوم.'],
  ], { kind: 'story', text: 'عبارة شهيرة: Time is money — الوقت من ذهب.' }),

  'today|adverb': c('اليوم', 'to·day', [
    ['Today is Friday.', 'اليوم هو الجمعة.'],
    ['I am very busy today.', 'أنا مشغول جدًا اليوم.'],
  ], { kind: 'family', text: 'to + day: today (اليوم)، tonight (الليلة)، tomorrow (غدًا).' }),

  'travel|verb': c('يسافر', 'trav·el', [
    ['I love to travel.', 'أحب السفر.'],
    ['We travel by train.', 'نسافر بالقطار.'],
  ], { kind: 'family', text: 'travel ← traveller (مسافر) ← travel agent (وكيل سفر).' }, [
    ['traveller', 'noun', 'مسافر'],
    ['travel', 'noun', 'السفر'],
  ]),

  'water|noun': c('ماء', 'wa·ter', [
    ['Can I have a glass of water?', 'هل يمكنني الحصول على كوب ماء؟'],
    ['The water is very cold.', 'الماء بارد جدًا.'],
  ], { kind: 'story', text: 'تخيّل «ووتر» صوت الماء وهو يتدفق.' }),

  'week|noun': c('أسبوع', 'week', [
    ['I go to the gym three times a week.', 'أذهب إلى النادي ثلاث مرات في الأسبوع.'],
    ['See you next week!', 'أراك الأسبوع القادم!'],
  ], { kind: 'family', text: 'weekend = نهاية الأسبوع، weekly = أسبوعي.' }, [
    ['weekend', 'noun', 'عطلة نهاية الأسبوع'],
    ['weekly', 'adjective', 'أسبوعي'],
  ]),

  // ——— A2 ———
  'abroad|adverb': c('في الخارج', 'a·broad', [
    ['She wants to study abroad.', 'تريد أن تدرس في الخارج.'],
    ['Have you ever been abroad?', 'هل سبق أن سافرت إلى الخارج؟'],
  ], { kind: 'story', text: 'a + broad (واسع): تخرج إلى العالم الواسع.' }),

  'accident|noun': c('حادث', 'ac·ci·dent', [
    ['He had a car accident last year.', 'تعرّض لحادث سيارة العام الماضي.'],
    ['I’m sorry, it was an accident.', 'آسف، لم يكن مقصودًا.'],
  ], { kind: 'family', text: 'by accident = بالصدفة / دون قصد.' }, [
    ['accidental', 'adjective', 'عَرَضي'],
    ['accidentally', 'adverb', 'بالخطأ'],
  ]),

  'afraid|adjective': c('خائف', 'a·fraid', [
    ['Don’t be afraid.', 'لا تخف.'],
    ['She is afraid of dogs.', 'هي تخاف من الكلاب.'],
  ], { kind: 'story', text: 'تأتي بعدها of: afraid of the dark = خائف من الظلام.' }),

  'alone|adjective': c('وحيد، بمفرده', 'a·lone', [
    ['He lives alone.', 'يعيش بمفرده.'],
    ['Leave me alone, please.', 'اتركني وشأني من فضلك.'],
  ], { kind: 'story', text: 'a + lone ← one: شخص «واحد» = بمفرده.' }),

  'angry|adjective': c('غاضب', 'an·gry', [
    ['Why are you angry with me?', 'لماذا أنت غاضب مني؟'],
    ['The customer was very angry.', 'كان الزبون غاضبًا جدًا.'],
  ], { kind: 'family', text: 'anger (غضب) ← angry (غاضب) ← angrily (بغضب).' }, [
    ['anger', 'noun', 'غضب'],
    ['angrily', 'adverb', 'بغضب'],
  ]),

  'arrive|verb': c('يصل', 'ar·rive', [
    ['What time does the train arrive?', 'متى يصل القطار؟'],
    ['We arrived in Dubai at night.', 'وصلنا إلى دبي ليلًا.'],
  ], { kind: 'family', text: 'arrive ← arrival (وصول). Arrivals في المطار = صالة الوصول.' }, [
    ['arrival', 'noun', 'وصول'],
  ]),

  'cloud|noun': c('سحابة', 'cloud', [
    ['There isn’t a cloud in the sky.', 'لا توجد سحابة في السماء.'],
    ['Dark clouds mean rain.', 'الغيوم الداكنة تعني المطر.'],
  ], { kind: 'link', text: 'التخزين السحابي = Cloud storage.' }, [
    ['cloudy', 'adjective', 'غائم'],
  ]),

  'company|noun': c('شركة', 'com·pa·ny', [
    ['She works for a big company.', 'تعمل في شركة كبيرة.'],
    ['The company has 200 employees.', 'لدى الشركة 200 موظف.'],
  ], { kind: 'link', text: '«كومباني» — تُقال «الكومبانية» في بعض اللهجات.' }),

  'earn|verb': c('يكسب (مالًا)', 'earn', [
    ['How much do you earn a month?', 'كم تكسب في الشهر؟'],
    ['He earned the respect of his team.', 'كسب احترام فريقه.'],
  ], { kind: 'story', text: 'تُنطق «إيرن». تذكّر: تتعلّم learn ثم تكسب earn — نفس الحروف!' }, [
    ['earnings', 'noun', 'أرباح، دخل'],
  ]),

  'forest|noun': c('غابة', 'for·est', [
    ['We walked through the forest.', 'مشينا عبر الغابة.'],
    ['Many animals live in the forest.', 'حيوانات كثيرة تعيش في الغابة.'],
  ], { kind: 'story', text: 'for + rest: تذهب إلى الغابة من أجل الراحة.' }),

  'island|noun': c('جزيرة', 'is·land', [
    ['Bahrain is an island.', 'البحرين جزيرة.'],
    ['They spent their holiday on an island.', 'قضوا إجازتهم في جزيرة.'],
  ], { kind: 'story', text: 'حرف s صامت: تُنطق «آيلند». is + land: هي أرض وسط الماء.' }),

  'journey|noun': c('رحلة', 'jour·ney', [
    ['The journey takes three hours.', 'تستغرق الرحلة ثلاث ساعات.'],
    ['Have a safe journey!', 'رحلة آمنة!'],
  ], { kind: 'story', text: 'journey = المسافة من مكان لآخر، trip = الرحلة كلها بما فيها الإقامة.' }),

  'luggage|noun': c('أمتعة', 'lug·gage', [
    ['How much luggage do you have?', 'كم لديك من الأمتعة؟'],
    ['My luggage is still at the airport.', 'أمتعتي ما زالت في المطار.'],
  ], { kind: 'story', text: 'اسم غير معدود: لا نقول luggages. نقول a piece of luggage.' }),

  'manager|noun': c('مدير', 'man·ag·er', [
    ['I want to speak to the manager.', 'أريد التحدث إلى المدير.'],
    ['She is the manager of a hotel.', 'هي مديرة فندق.'],
  ], { kind: 'family', text: 'manage (يدير) ← management (إدارة) ← manager (مدير).' }, [
    ['manage', 'verb', 'يدير'],
    ['management', 'noun', 'إدارة'],
  ]),

  'medicine|noun': c('دواء', 'med·i·cine', [
    ['Take this medicine twice a day.', 'تناول هذا الدواء مرتين يوميًا.'],
    ['He studies medicine at university.', 'يدرس الطب في الجامعة.'],
  ], { kind: 'story', text: 'معنيان: دواء، وعلم الطب. medical = طبي.' }, [
    ['medical', 'adjective', 'طبي'],
  ]),

  'meeting|noun': c('اجتماع', 'meet·ing', [
    ['I have a meeting at ten.', 'لديّ اجتماع في العاشرة.'],
    ['The meeting was very long.', 'كان الاجتماع طويلًا جدًا.'],
  ], { kind: 'family', text: 'meet (يقابل) + ing = اجتماع.' }, [
    ['meet', 'verb', 'يقابل'],
  ]),

  'passport|noun': c('جواز سفر', 'pass·port', [
    ['Don’t forget your passport!', 'لا تنسَ جواز سفرك!'],
    ['My passport expires next year.', 'ينتهي جواز سفري العام القادم.'],
  ], { kind: 'story', text: 'pass (يعبر) + port (ميناء): الورقة التي تعبر بها الموانئ.' }),

  'storm|noun': c('عاصفة', 'storm', [
    ['The storm destroyed many trees.', 'دمّرت العاصفة أشجارًا كثيرة.'],
    ['There was a storm last night.', 'كانت هناك عاصفة الليلة الماضية.'],
  ], { kind: 'link', text: 'Brainstorm = عاصفة ذهنية.' }, [
    ['stormy', 'adjective', 'عاصف'],
  ]),

  'surprised|adjective': c('متفاجئ', 'sur·prised', [
    ['I was surprised to see him.', 'تفاجأت برؤيته.'],
    ['She looked surprised.', 'بدت متفاجئة.'],
  ], { kind: 'family', text: 'surprise (مفاجأة) ← surprised (متفاجئ) ← surprising (مفاجِئ).' }, [
    ['surprise', 'noun', 'مفاجأة'],
    ['surprising', 'adjective', 'مُفاجِئ'],
  ]),

  'worried|adjective': c('قلق', 'wor·ried', [
    ['I’m worried about my exam.', 'أنا قلق بشأن امتحاني.'],
    ['Don’t look so worried.', 'لا تبدُ قلقًا هكذا.'],
  ], { kind: 'family', text: 'worry (يقلق) ← worried (قلق) — تأتي بعدها about.' }, [
    ['worry', 'verb', 'يقلق'],
  ]),
}

export function contentFor(id: string): WordContent | undefined {
  return SAMPLE_CONTENT[id]
}
