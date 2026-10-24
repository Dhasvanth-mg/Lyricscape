// Hindi (Devanagari + romanised) and Tamil (Tamil script + romanised) vocabulary for the mood reader, the subject reader and the icons.
//
// HONEST SCOPE: a small, hand-picked list of unambiguous feeling words, not a language model. Indic words are matched by PREFIX
// (they inflect: प्यार / प्यारे, காதல் / காதலை / காதலில்), so Tamil stems are given without their final pulli. Romanised spellings vary
// wildly (pyar / pyaar / piyar); the common ones are listed. Irony, idiom and context are invisible to it, as they are in English.

import type { EmotionId } from '../kinetic/emotion';
import type { IconId } from '../kinetic/icons';

/** words per mood, for kinetic/emotion.ts */
export const INDIC_MOOD: Record<EmotionId, string[]> = {
  joy: ['खुशी', 'ख़ुशी', 'खुश', 'जश्न', 'मस्ती', 'मुस्कुरा', 'हँसी', 'हंसी', 'மகிழ்ச்சி', 'சந்தோஷ', 'கொண்டாட', 'khushi', 'khush', 'jashn', 'masti', 'muskura', 'hasi', 'magizhchi', 'santhosham', 'santhosh', 'kondattam'],
  love: ['प्यार', 'इश्क', 'मोहब्बत', 'मुहब्बत', 'सनम', 'प्रेम', 'दिलबर', 'साजन', 'காதல', 'அன்பு', 'நேசம', 'உயிரே', 'கண்மணி', 'pyaar', 'pyar', 'ishq', 'ishk', 'mohabbat', 'muhabbat', 'sanam', 'dilbar', 'saajan', 'sajna', 'kadhal', 'kaadhal', 'kaathal', 'anbe', 'anbu', 'uyire', 'kanmani'],
  energy: ['धमाल', 'धमाका', 'तूफ़ान', 'तूफान', 'जोश', 'நெருப்பு', 'புயல', 'dhamaal', 'dhamaka', 'toofan', 'josh', 'kuthu', 'theeppori'],
  calm: ['सुकून', 'शांति', 'चैन', 'அமைதி', 'நிம்மதி', 'sukoon', 'sukun', 'shanti', 'amaidhi', 'nimmadhi', 'nimmathi'],
  nostalgia: ['याद', 'यादें', 'यादों', 'पुराना', 'पुरानी', 'बचपन', 'गुज़रा', 'நினைவு', 'ஞாபக', 'பழைய', 'yaad', 'yaadein', 'yaadon', 'purana', 'purani', 'bachpan', 'guzra', 'ninaivu', 'gnabagam', 'nyabagam', 'pazhaya'],
  sadness: ['आँसू', 'आंसू', 'जुदाई', 'जुदा', 'तन्हा', 'तन्हाई', 'दर्द', 'बेवफा', 'बेवफ़ा', 'रोना', 'रोया', 'अकेला', 'अकेली', 'उदास', 'கண்ணீர', 'வலி', 'தனிமை', 'பிரிவு', 'கவலை', 'சோகம', 'aansu', 'aasu', 'judaai', 'judai', 'tanha', 'tanhai', 'dard', 'bewafa', 'bewafaa', 'royi', 'roya', 'akela', 'akeli', 'udaas', 'kanneer', 'kanner', 'vali', 'thanimai', 'pirivu', 'kavalai', 'sogam'],
  anger: ['गुस्सा', 'नफरत', 'नफ़रत', 'बदला', 'दुश्मन', 'கோபம', 'வெறுப்பு', 'பழி', 'பகை', 'gussa', 'nafrat', 'badla', 'dushman', 'kobam', 'veruppu', 'pagai'],
  dark: ['अंधेरा', 'अँधेरा', 'मौत', 'साया', 'कब्र', 'இருள', 'மரணம', 'நிழல', 'சாவு', 'andhera', 'andhere', 'maut', 'saaya', 'kabr', 'irul', 'maranam', 'nizhal', 'saavu'],
};

/** negations: they weaken the next feeling word (नहीं प्यार, "illai kadhal") */
export const INDIC_NEGATORS = ['नहीं', 'नही', 'ना', 'मत', 'बिना', 'இல்லை', 'இல்ல', 'வேண்டாம்', 'nahi', 'nahin', 'nhi', 'mat', 'bina', 'illai', 'illa', 'vendam', 'vendaam'];

/** categories of identity/text.ts (it has more than the eight moods) */
export const INDIC_TEXT: Record<string, { strong: string[]; weak: string[] }> = {
  love: { strong: [...INDIC_MOOD.love], weak: ['दिल', 'जान', 'dil', 'jaan', 'nenjam', 'நெஞ்சம'] },
  joy: { strong: [...INDIC_MOOD.joy], weak: ['नाच', 'naach'] },
  sadness: { strong: [...INDIC_MOOD.sadness], weak: ['ग़म', 'गम', 'gham', 'gum'] },
  energy: { strong: [...INDIC_MOOD.energy], weak: [] },
  calm: { strong: [...INDIC_MOOD.calm], weak: ['हवा', 'hawa', 'காற்று', 'kaatru'] },
  nostalgia: { strong: [...INDIC_MOOD.nostalgia], weak: [] },
  anger: { strong: [...INDIC_MOOD.anger], weak: [] },
  dark: { strong: [...INDIC_MOOD.dark], weak: [] },
};

/** extra stems for the subject reader (what a song is about) */
export const INDIC_SUBJECT_STEMS: Record<string, string[]> = {
  romance: ['प्यार', 'इश्क', 'मोहब्बत', 'காதல', 'pyaar', 'pyar', 'ishq', 'mohabbat', 'kadhal', 'kaadhal', 'sanam'],
  heartbreak: ['जुदाई', 'बेवफा', 'तन्हा', 'பிரிவு', 'judaai', 'bewafa', 'tanha', 'pirivu'],
  nightlife: ['रात', 'இரவு', 'raat', 'iravu'],
  ambition: ['पैसा', 'दौलत', 'பணம', 'paisa', 'daulat', 'panam'],
  memory: ['याद', 'நினைவு', 'yaad', 'ninaivu'],
  nature: ['चाँद', 'चांद', 'आसमान', 'बारिश', 'நிலா', 'வானம', 'மழை', 'chand', 'aasman', 'baarish', 'nila', 'vaanam', 'mazhai'],
  freedom: ['आज़ाद', 'आजाद', 'சுதந்திர', 'azaad', 'azad', 'suthandhiram'],
  faith: ['ख़ुदा', 'खुदा', 'रब', 'भगवान', 'ईश्वर', 'கடவுள', 'khuda', 'rab', 'bhagwan', 'kadavul'],
  celebration: ['जश्न', 'नाच', 'கொண்டாட்ட', 'jashn', 'naach'],
};

/** word -> icon (exact normalised words; inflected forms are listed where common) */
export const INDIC_ICONS: Record<string, IconId> = {
  // Hindi
  दिल: 'heart', प्यार: 'heart', इश्क: 'heart', मोहब्बत: 'heart', सनम: 'heart', जान: 'heart', चाँद: 'moon', चांद: 'moon', रात: 'moon', रातें: 'moon', सितारा: 'star', सितारे: 'star', तारे: 'star', आग: 'flame',
  बारिश: 'rain', सूरज: 'sun', आँसू: 'tear', आंसू: 'tear', दर्द: 'heartbreak', फूल: 'flower', फूलों: 'flower', समंदर: 'wave', सागर: 'wave', आसमान: 'cloud', हवा: 'wind', घर: 'house', पैसा: 'cash', गीत: 'note', गाना: 'note',
  संगीत: 'note', आँखें: 'eye', आंखें: 'eye', नज़र: 'eye', नजर: 'eye', पंख: 'wing', वक़्त: 'clock', वक्त: 'clock', समय: 'clock', सपना: 'cloud', सपने: 'cloud', ख्वाब: 'cloud', दुनिया: 'planet',
  // Tamil
  காதல்: 'heart', இதயம்: 'heart', நெஞ்சம்: 'heart', உயிர்: 'heart', உயிரே: 'heart', நிலா: 'moon', நிலவு: 'moon', இரவு: 'moon', நட்சத்திரம்: 'star', விண்மீன்: 'star', தீ: 'flame', நெருப்பு: 'flame', மழை: 'rain',
  சூரியன்: 'sun', கண்ணீர்: 'tear', வலி: 'heartbreak', பூ: 'flower', பூக்கள்: 'flower', கடல்: 'wave', வானம்: 'cloud', காற்று: 'wind', வீடு: 'house', பணம்: 'cash', பாடல்: 'note', இசை: 'note', கண்: 'eye', கண்கள்: 'eye',
  சிறகு: 'wing', நேரம்: 'clock', கனவு: 'cloud', உலகம்: 'planet',
  // romanised
  dil: 'heart', pyaar: 'heart', pyar: 'heart', ishq: 'heart', mohabbat: 'heart', sanam: 'heart', jaan: 'heart', chand: 'moon', raat: 'moon', sitara: 'star', sitare: 'star', taare: 'star', aag: 'flame', baarish: 'rain',
  barish: 'rain', suraj: 'sun', aansu: 'tear', dard: 'heartbreak', phool: 'flower', samandar: 'wave', aasman: 'cloud', hawa: 'wind', ghar: 'house', paisa: 'cash', geet: 'note', gaana: 'note', sangeet: 'note',
  aankhein: 'eye', nazar: 'eye', waqt: 'clock', sapna: 'cloud', khwaab: 'cloud', duniya: 'planet',
  kadhal: 'heart', kaadhal: 'heart', nenjam: 'heart', uyire: 'heart', nila: 'moon', iravu: 'moon', neruppu: 'flame', mazhai: 'rain', sooriyan: 'sun', kanneer: 'tear', vali: 'heartbreak', poo: 'flower', kadal: 'wave',
  vaanam: 'cloud', kaatru: 'wind', veedu: 'house', panam: 'cash', paadal: 'note', isai: 'note', kangal: 'eye', siragu: 'wing', neram: 'clock', kanavu: 'cloud', ulagam: 'planet',
};
