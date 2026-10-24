// Feeling words, subjects and icon words for the most common languages of popular music besides English, Hindi and Tamil
// (those live in indicLexicon.ts): Spanish, French, Portuguese, German, Italian, Korean, Japanese, Chinese, Russian, Arabic.
//
// HONEST SCOPE: short, hand-picked lists of fairly unambiguous words, matched by PREFIX (Latin stems under 4 letters by exact word).
// Words that are also common English words (pain, rose, mine, sale, gift, hell, art, tire...) are left out on purpose, so an English
// song with one French word does not turn sad. Idiom, irony and context are invisible to it, as they are in English.

import type { EmotionId } from '../kinetic/emotion';
import type { IconId } from '../kinetic/icons';

const L = (s: string) => s.split(' ');

export const WORLD_MOOD: Record<EmotionId, string[]> = {
  joy: [
    ...L('feliz alegr fiesta bailar sonrisa reír reir gozar disfrut celebr brillar heureux heureuse joie sourire souriant fête danser rire alegria sorriso festa dançar dancar glück glueck lachen lächeln laecheln feiern tanzen fröhlich froehlich felice gioia ballare ridere sorridere'),
    ...L('행복 웃음 웃어 웃는 기쁨 즐거 파티 춤을 幸せ 笑 楽し 嬉し 踊 パーティ 快乐 开心 微笑 幸福 派对 跳舞 счасть радост улыб смех праздник танц فرح سعادة ضحك ابتسام رقص حفلة'),
  ],
  love: [
    ...L('amor corazón corazon besos beso cariño cariño enamor amada pasión pasion querido amour coeur cœur baiser chéri cheri tendresse chérie passion amoureu coração coracao beijo paixão paixao carinho amado liebe herz sehnsucht zärtlich zaertlich schatz geliebt amore cuore bacio passione tesoro innamor'),
    ...L('사랑 마음 좋아해 키스 愛 恋 好き ハート 爱 喜欢 吻 любов люблю любим любил любимая сердц поцелу страст нежн حب عشق قلب حبيبي قبلة'),
  ],
  energy: [
    ...L('fuego explot perreo locura acelera ritmo feu explos folie bruit énergie fogo explod loucura feuer wild laut explo fuoco pazzo forte'),
    ...L('폭발 미쳤 뜨거 炎 爆 熱 叫 火 爆炸 疯狂 огонь взрыв безум громк نار انفجار جنون'),
  ],
  calm: [
    ...L('calma tranquil silencio suave paz despacio dormir calme douceur paisible doucement rêve reve silêncio silencio devagar ruhe stille sanft frieden traum pace dolce sogno'),
    ...L('고요 조용 평화 천천히 꿈 静か 穏やか 夢 平和 安静 平静 梦 和平 тишин спокой сон هدوء سلام سكون حلم'),
  ],
  nostalgia: [
    ...L('recuerd extraño extrano ayer pasado añoro anoro souvenir nostalg hier autrefois enfance lembrar lembranças lembrancas ontem infância infancia saudade erinnerung damals gestern kindheit früher frueher ricordo ieri infanzia passato'),
    ...L('기억 추억 그리움 옛 思い出 懐か 昨日 昔 记忆 回忆 想念 昨天 曾经 童年 помн воспомин вчера детств прошл ذكرى ذكريات أمس ماضي طفولة حنين'),
  ],
  sadness: [
    ...L('llorar lloro lágrimas lagrimas tristeza triste dolor soledad adiós adios herida larmes pleurer tristesse douleur adieu chagrin lágrimas chorar dor solidão solidao tränen traenen weinen trauer schmerz einsam abschied lacrime piangere dolore solitudine addio'),
    ...L('눈물 슬픔 슬픈 아픔 이별 외로 혼자 涙 泣 悲し 寂し 孤独 別れ 痛 泪 哭 悲伤 孤独 离别 痛苦 слёз слез плак груст боль одинок прощ دموع بكاء حزن ألم وحدة فراق'),
  ],
  anger: [
    ...L('odio rabia venganza mentira enemigo maldit haine colère colere vengeance mensonge ódio raiva vingança vinganca hass wut zorn rache lüge luege rabbia vendetta bugia'),
    ...L('미워 분노 복수 거짓말 憎 怒 復讐 嘘 恨 愤怒 复仇 谎言 ненавист злост гнев месть ложь كره غضب انتقام كذب'),
  ],
  dark: [
    ...L('muerte oscuridad sombra infierno demonio fantasma miedo mort noirceur ombre enfer fantôme fantome peur ténèbres tenebres morte escuridão escuridao medo tod dunkel schatten hölle hoelle geist angst finster buio ombra inferno paura'),
    ...L('어둠 죽음 그림자 악마 두려 闇 死 影 悪魔 恐怖 黑暗 影子 恶魔 恐惧 смерть тьма тень призрак страх موت ظلام ظل شيطان خوف'),
  ],
};

/** negations (they weaken the next feeling word) */
export const WORLD_NEGATORS = L('no nunca nada ni sin pas jamais rien sans não nao nunca nada sem nicht nie kein keine ohne mai niente senza 안 못 없 ない ぬ 不 没 没有 не нет никогда ни без لا لم ليس');

/** extra stems for the subject reader (what a song is about) */
export const WORLD_SUBJECT_STEMS: Record<string, string[]> = {
  romance: ['amor', 'te quiero', 'te amo', 'amour', 'je t\'aime', 'liebe', 'amore', 'ti amo', 'eu te amo', '사랑', '愛', '爱', 'любов', 'حب'],
  heartbreak: ['adiós', 'adios', 'adieu', 'abschied', 'addio', 'adeus', '이별', '別れ', '离别', 'прощ', 'فراق'],
  nightlife: ['noche', 'fiesta', 'nuit', 'noite', 'nacht', 'notte', '밤', '夜', 'ночь', 'ليل'],
  ambition: ['dinero', 'argent', 'dinheiro', 'geld', 'soldi', '돈', '金', '钱', 'деньги', 'مال'],
  memory: ['recuerd', 'souvenir', 'lembran', 'saudade', 'erinnerung', 'ricordo', '기억', '思い出', '回忆', 'помн', 'ذكر'],
  nature: ['luna', 'cielo', 'lune', 'ciel', 'lua', 'céu', 'mond', 'himmel', 'luna', 'cielo', '달', '하늘', '月', '空', '月亮', 'луна', 'небо', 'قمر', 'سماء'],
  freedom: ['libertad', 'liberté', 'liberdade', 'freiheit', 'libertà', '자유', '自由', 'свобод', 'حرية'],
  faith: ['dios', 'dieu', 'deus', 'gott', 'dio ', '하나님', '神', '上帝', 'бог', 'الله'],
  celebration: ['fiesta', 'fête', 'festa', 'feiern', 'baila', 'dança', '파티', '祭', '派对', 'праздник', 'حفلة'],
};

/** word -> icon (exact normalised words) */
export const WORLD_ICONS: Record<string, IconId> = {
  // Spanish
  corazón: 'heart', corazon: 'heart', amor: 'heart', beso: 'heart', besos: 'heart', luna: 'moon', noche: 'moon', estrella: 'star', estrellas: 'star', fuego: 'flame', lluvia: 'rain', sol: 'sun', lágrimas: 'tear', lagrimas: 'tear',
  flor: 'flower', flores: 'flower', mar: 'wave', cielo: 'cloud', viento: 'wind', casa: 'house', dinero: 'cash', música: 'note', musica: 'note', canción: 'note', cancion: 'note', ojos: 'eye', alas: 'wing', tiempo: 'clock',
  sueño: 'cloud', mundo: 'planet', muerte: 'skull', fiesta: 'party', baile: 'note', bailar: 'note', ángel: 'wing', angel: 'wing', corona: 'crown', diamante: 'diamond',
  // French
  coeur: 'heart', cœur: 'heart', amour: 'heart', baiser: 'heart', lune: 'moon', nuit: 'moon', étoile: 'star', etoile: 'star', étoiles: 'star', feu: 'flame', pluie: 'rain', soleil: 'sun', larmes: 'tear', fleur: 'flower', fleurs: 'flower',
  mer: 'wave', ciel: 'cloud', vent: 'wind', maison: 'house', argent: 'cash', musique: 'note', chanson: 'note', yeux: 'eye', ailes: 'wing', temps: 'clock', rêve: 'cloud', reve: 'cloud', monde: 'planet', mort: 'skull', fête: 'party',
  // Portuguese
  coração: 'heart', coracao: 'heart', beijo: 'heart', saudade: 'heart', lua: 'moon', noite: 'moon', estrela: 'star', fogo: 'flame', chuva: 'rain', céu: 'cloud', vento: 'wind', dinheiro: 'cash', canção: 'note',
  olhos: 'eye', asas: 'wing', sonho: 'cloud', festa: 'party',
  // German
  liebe: 'heart', herz: 'heart', mond: 'moon', nacht: 'moon', stern: 'star', sterne: 'star', feuer: 'flame', regen: 'rain', sonne: 'sun', tränen: 'tear', blume: 'flower', blumen: 'flower', meer: 'wave', himmel: 'cloud', haus: 'house',
  geld: 'cash', musik: 'note', lied: 'note', augen: 'eye', flügel: 'wing', zeit: 'clock', traum: 'cloud', welt: 'planet', tod: 'skull',
  // Italian
  amore: 'heart', cuore: 'heart', bacio: 'heart', notte: 'moon', stella: 'star', stelle: 'star', fuoco: 'flame', pioggia: 'rain', sole: 'sun', lacrime: 'tear', fiore: 'flower', fiori: 'flower', mare: 'wave', soldi: 'cash',
  canzone: 'note', occhi: 'eye', ali: 'wing', sogno: 'cloud', mondo: 'planet', morte: 'skull',
  // Korean
  사랑: 'heart', 마음: 'heart', 달: 'moon', 밤: 'moon', 별: 'star', 불: 'flame', 비: 'rain', 해: 'sun', 눈물: 'tear', 꽃: 'flower', 바다: 'wave', 하늘: 'cloud', 바람: 'wind', 집: 'house', 돈: 'cash', 노래: 'note', 음악: 'note', 눈: 'eye',
  날개: 'wing', 시간: 'clock', 꿈: 'cloud', 세상: 'planet',
  // Japanese
  愛: 'heart', 恋: 'heart', 心: 'heart', 月: 'moon', 夜: 'moon', 星: 'star', 火: 'flame', 炎: 'flame', 雨: 'rain', 太陽: 'sun', 涙: 'tear', 花: 'flower', 海: 'wave', 空: 'cloud', 風: 'wind', 家: 'house', 夢: 'cloud', 世界: 'planet', 時間: 'clock', 歌: 'note',
  // Chinese
  爱: 'heart', 月亮: 'moon', 星星: 'star', 太阳: 'sun', 泪: 'tear', 天空: 'cloud', 风: 'wind', 梦: 'cloud', 时间: 'clock',
  // Russian
  любовь: 'heart', сердце: 'heart', луна: 'moon', ночь: 'moon', звезда: 'star', звезды: 'star', огонь: 'flame', дождь: 'rain', солнце: 'sun', слёзы: 'tear', слезы: 'tear', цветок: 'flower', цветы: 'flower', море: 'wave',
  небо: 'cloud', ветер: 'wind', дом: 'house', деньги: 'cash', музыка: 'note', песня: 'note', глаза: 'eye', крылья: 'wing', время: 'clock', мечта: 'cloud', смерть: 'skull',
  // Arabic
  حب: 'heart', قلب: 'heart', قمر: 'moon', ليل: 'moon', نجمة: 'star', نجوم: 'star', نار: 'flame', مطر: 'rain', شمس: 'sun', دموع: 'tear', وردة: 'flower', زهرة: 'flower', بحر: 'wave', سماء: 'cloud', ريح: 'wind', بيت: 'house', مال: 'cash',
  أغنية: 'note', موسيقى: 'note', عيون: 'eye', جناح: 'wing', وقت: 'clock', حلم: 'cloud', عالم: 'planet', موت: 'skull',
};
