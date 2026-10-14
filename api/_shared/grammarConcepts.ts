import type { GrammarConcept } from "../../src/types";

// The grammar syllabus the app can generate and grade sentences for, roughly
// A1–B2. Ids are stored in user settings and concept stats, so an existing
// id must never change or be removed — rename or reword freely instead.
// Names carry the suffix in its e-harmony or a-harmony form so they're easy
// to find by typing what you'd see in a textbook.
export const grammarConcepts: GrammarConcept[] = [
  // Tenses
  {
    id: "tense-present-continuous",
    name: "Present continuous (-iyor)",
    category: "Tenses",
    description: "Ongoing or current actions using the -Iyor suffix, e.g. gidiyorum (I am going).",
  },
  {
    id: "tense-present-formal",
    name: "Present continuous, formal (-makta/-mekte)",
    category: "Tenses",
    description:
      "Formal or written ongoing action with -mAktA, e.g. çalışmaktayım (I am working), toplantı devam etmektedir (the meeting is continuing).",
  },
  {
    id: "tense-past-definite",
    name: "Past definite (-di)",
    category: "Tenses",
    description: "Witnessed/definite past tense using the -DI suffix, e.g. gittim (I went).",
  },
  {
    id: "tense-future",
    name: "Future (-yacak/-yecek)",
    category: "Tenses",
    description: "Future tense using the -yAcAk suffix, e.g. gideceğim (I will go).",
  },
  {
    id: "tense-aorist",
    name: "Aorist (-ir/-ar)",
    category: "Tenses",
    description: "Habitual, general-truth, or polite-future actions using the aorist suffix, e.g. giderim (I go / I would go).",
  },
  {
    id: "tense-habitual-past",
    name: "Habitual past 'used to' (-irdi/-ardı)",
    category: "Tenses",
    description:
      "Used to / would, the aorist plus the past copula, e.g. her yaz denize giderdik (we used to go to the sea every summer), eskiden sigara içerdi (he used to smoke).",
  },
  {
    id: "tense-reported-past",
    name: "Reported past (-miş)",
    category: "Tenses",
    description: "Inferential or reported past using the -mIş suffix, e.g. gitmiş (apparently he/she went).",
  },
  {
    id: "tense-reported-other",
    name: "Reported present/future (-iyormuş/-acakmış)",
    category: "Tenses",
    description:
      "The -mIş evidential added after another tense for hearsay or inference, e.g. geliyormuş (apparently he's coming), gidecekmiş (she'll go, I hear), yaparmış (apparently he does).",
  },
  {
    id: "tense-past-continuous",
    name: "Past continuous (-iyordu)",
    category: "Tenses",
    description: "Ongoing action in the past, combining -Iyor with the past copula, e.g. gidiyordum (I was going).",
  },
  {
    id: "tense-past-perfect",
    name: "Past perfect (-mişti)",
    category: "Tenses",
    description: "An action completed before another past point, e.g. gitmiştim (I had gone).",
  },
  {
    id: "tense-future-in-past",
    name: "Future in the past (-(y)acaktı)",
    category: "Tenses",
    description: "Something that was going to happen, viewed from the past, e.g. gidecektim (I was going to go).",
  },
  {
    id: "tense-future-perfect",
    name: "Future perfect (-miş olacak)",
    category: "Tenses",
    description:
      "Will have done, with -mIş plus olmak in the future, e.g. saat beşte bitirmiş olacağım (I'll have finished by five).",
  },

  // 'To be' & existence
  {
    id: "be-personal-endings",
    name: "'To be' endings on nouns/adjectives (-im, -sin, -iz)",
    category: "'To be' & existence",
    description:
      "Turkish am/are/is as suffixes on the predicate, e.g. öğretmenim (I am a teacher), yorgunsun (you are tired), evdeyiz (we are at home), Türkler (they are Turkish).",
  },
  {
    id: "be-past",
    name: "Past of 'to be' (-ydi/-ydı)",
    category: "'To be' & existence",
    description:
      "Was/were with the past copula -(y)DI, e.g. yorgundum (I was tired), evdeydik (we were at home), hava güzeldi (the weather was nice).",
  },
  {
    id: "be-reported",
    name: "Reported 'to be' (-ymiş/-ymış)",
    category: "'To be' & existence",
    description:
      "Apparently is/was, with -(y)mIş on a noun or adjective, e.g. hastaymış (apparently she's ill), öğretmenmiş (he's a teacher, I hear), çok pahalıymış (it's very expensive, they say).",
  },
  {
    id: "be-negation-degil",
    name: "Negation with değil",
    category: "'To be' & existence",
    description:
      "Negates nouns, adjectives and 'to be', taking the personal ending itself, e.g. öğretmen değilim (I'm not a teacher), evde değiller (they aren't at home), pahalı değildi (it wasn't expensive).",
  },
  {
    id: "structure-existential",
    name: "Existential var/yok",
    category: "'To be' & existence",
    description:
      "Expresses existence or possession using var (there is / have) and yok (there isn't / don't have), e.g. masada kitap var (there's a book on the table), arabam yok (I don't have a car).",
  },
  {
    id: "structure-copula",
    name: "Copula (-dir, olmak)",
    category: "'To be' & existence",
    description:
      "The generalising/formal -DIr and olmak for 'to be/become' in tenses that need a verb, e.g. su sağlıklıdır (water is healthy), doktor oldu (she became a doctor), yarın evde olacağım (I'll be at home tomorrow).",
  },

  // Cases
  {
    id: "case-nominative",
    name: "Nominative case",
    category: "Cases",
    description: "The unmarked base form of a noun, used for subjects and indefinite objects, e.g. kitap okudum (I read a book).",
  },
  {
    id: "case-accusative",
    name: "Accusative case (-i/-ı/-u/-ü)",
    category: "Cases",
    description: "Marks a definite direct object using the -I suffix, e.g. kitabı okudum (I read the book).",
  },
  {
    id: "case-dative",
    name: "Dative case (-e/-a)",
    category: "Cases",
    description: "Marks direction/recipient 'to' using the -A suffix, e.g. eve gidiyorum (I'm going home), sana (to you).",
  },
  {
    id: "case-locative",
    name: "Locative case (-de/-da)",
    category: "Cases",
    description: "Marks location 'at/in/on' using the -DA suffix, e.g. evde (at home), saat üçte (at three).",
  },
  {
    id: "case-ablative",
    name: "Ablative case (-den/-dan)",
    category: "Cases",
    description: "Marks source 'from' using the -DAn suffix, e.g. evden (from home), senden (from you).",
  },
  {
    id: "case-genitive",
    name: "Genitive case (-in/-ın)",
    category: "Cases",
    description:
      "Marks the possessor 'of' using the -(n)In suffix, paired with a possessive suffix on the possessed noun, e.g. Ali'nin arabası (Ali's car), evin kapısı (the door of the house).",
  },

  // Nouns & pronouns
  {
    id: "noun-compound",
    name: "Noun compounds (-(s)i)",
    category: "Nouns & pronouns",
    description:
      "Two nouns joined with a third-person possessive on the second, no genitive on the first, e.g. araba anahtarı (car key), Türkçe dersi (Turkish lesson), kapı kolu (door handle).",
  },
  {
    id: "pronoun-personal-cases",
    name: "Personal pronouns & their case forms",
    category: "Nouns & pronouns",
    description:
      "ben/sen/o/biz/siz/onlar with their irregular case forms, e.g. bana (to me), sana (to you), onu (him/her/it), bizde (at ours), benim (my/mine).",
    pervasive: true,
  },
  {
    id: "pronoun-demonstrative",
    name: "Demonstratives (bu/şu/o)",
    category: "Nouns & pronouns",
    description:
      "Pointing words used as adjectives or pronouns, taking -n- before case endings, e.g. bu kitap (this book), şunu (that one), onda (on that / on him), bunlar (these).",
    pervasive: true,
  },
  {
    id: "pronoun-reflexive",
    name: "Reflexive & reciprocal pronouns (kendi, birbiri)",
    category: "Nouns & pronouns",
    description:
      "kendi with possessive endings for '-self' or emphasis, and birbiri for 'each other', e.g. kendim yaptım (I did it myself), kendine iyi bak (take care of yourself), birbirimizi seviyoruz (we love each other).",
  },
  {
    id: "pronoun-indefinite",
    name: "Indefinite pronouns & hiç (herkes, kimse, hiçbir)",
    category: "Nouns & pronouns",
    description:
      "herkes (everyone), biri (someone), bir şey (something), and the negative-polarity words kimse, hiçbir şey, hiç, which need a negative verb, e.g. kimse gelmedi (nobody came), hiç gitmedim (I've never been), hiçbir şey görmedim (I saw nothing).",
  },
  {
    id: "question-words",
    name: "Question words (ne, kim, nerede, nasıl…)",
    category: "Nouns & pronouns",
    description:
      "Wh-questions with ne (what), kim (who), nerede/nereye/nereden (where), ne zaman (when), nasıl (how), neden/niçin (why), hangi (which), kaç (how many), placed where the answer would go, e.g. nereye gidiyorsun? (where are you going?).",
    pervasive: true,
  },
  {
    id: "numbers-counting",
    name: "Numbers & counting",
    category: "Nouns & pronouns",
    description:
      "Cardinal numbers and counting rules: no plural after a numeral (üç kitap, not üç kitaplar), the classifier tane, and distributives with -(ş)Ar, e.g. iki tane elma (two apples), ikişer elma (two apples each).",
    pervasive: true,
  },
  {
    id: "proper-noun-apostrophe",
    name: "Proper nouns with apostrophe (Ankara'ya)",
    category: "Nouns & pronouns",
    description:
      "Case and possessive suffixes on names and places are separated with an apostrophe and still follow vowel harmony, e.g. Ankara'da (in Ankara), Ali'nin (Ali's), İstanbul'a (to Istanbul).",
    pervasive: true,
  },
  {
    id: "time-expressions",
    name: "Telling the time & time phrases",
    category: "Nouns & pronouns",
    description:
      "saat kaç? / saat kaçta?, e.g. saat üç (three o'clock), saat üçte (at three), üçü çeyrek geçe (quarter past three), üçe on kala (ten to three), saat üç buçukta (at half past three), sabahleyin (in the morning).",
  },

  // Suffixes & word formation
  {
    id: "suffix-plural",
    name: "Plural suffix (-ler/-lar)",
    category: "Suffixes & word formation",
    description: "Pluralizes nouns using -lAr, e.g. kitaplar (books).",
  },
  {
    id: "suffix-possessive",
    name: "Possessive suffixes (-im, -in, -i, -imiz…)",
    category: "Suffixes & word formation",
    description:
      "Marks my/your/his/her/our/their via suffixes on the noun, e.g. kitabım (my book), evin (your house), arabası (his/her car), annemiz (our mother).",
  },
  {
    id: "suffix-vowel-harmony",
    name: "Vowel harmony",
    category: "Suffixes & word formation",
    description: "The rule that suffix vowels change to match the preceding vowel's frontness/roundness, e.g. evler / kitaplar, gözü / kolu.",
    pervasive: true,
  },
  {
    id: "suffix-consonant-mutation",
    name: "Consonant mutation (p/ç/t/k → b/c/d/g)",
    category: "Suffixes & word formation",
    description: "Word-final hard consonants soften when a vowel-initial suffix is added, e.g. kitap → kitabı, ağaç → ağacı, renk → rengi.",
    pervasive: true,
  },
  {
    id: "suffix-buffer-consonants",
    name: "Buffer consonants (y, n, s, ş)",
    category: "Suffixes & word formation",
    description: "Extra consonants inserted between a vowel-final stem and a vowel-initial suffix to keep vowels apart, e.g. araba-y-a, araba-s-ı, araba-n-ın.",
    pervasive: true,
  },
  {
    id: "suffix-instrumental",
    name: "Instrumental/comitative (-(y)le/-(y)la)",
    category: "Suffixes & word formation",
    description: "Suffixed form of 'ile', meaning 'with/by means of', e.g. arabayla (by car), kaşıkla (with a spoon), annemle (with my mother).",
  },
  {
    id: "suffix-with",
    name: "Having/with (-li/-lı)",
    category: "Suffixes & word formation",
    description: "Adjective-forming suffix meaning 'having/with', e.g. tuzlu (salty/with salt), şekerli (with sugar), İstanbullu (from Istanbul).",
  },
  {
    id: "suffix-without",
    name: "Without (-siz/-sız)",
    category: "Suffixes & word formation",
    description: "Adjective-forming suffix meaning 'without', the opposite of -lI, e.g. şekersiz (without sugar), tuzsuz (without salt), evsiz (homeless).",
  },
  {
    id: "suffix-lik",
    name: "Abstract/purpose nouns (-lik/-lık)",
    category: "Suffixes & word formation",
    description:
      "Forms nouns for a quality, a place, or 'for/worth', e.g. güzellik (beauty), çocukluk (childhood), kitaplık (bookcase), haftalık (weekly), yüzlük (a hundred-lira note).",
  },
  {
    id: "suffix-ci",
    name: "Agent/profession (-ci/-cı/-çi/-çı)",
    category: "Suffixes & word formation",
    description: "Marks a person associated with something, e.g. kitapçı (bookseller), işçi (worker), futbolcu (footballer), yolcu (traveller).",
  },
  {
    id: "suffix-verb-forming",
    name: "Verb-forming suffixes (-le/-la, -leş/-laş)",
    category: "Suffixes & word formation",
    description:
      "Makes verbs from nouns and adjectives: -lA 'do/apply', -lAş 'become', e.g. temizlemek (to clean), başlamak (to start), güzelleşmek (to become beautiful), yerleşmek (to settle).",
  },
  {
    id: "suffix-diminutive",
    name: "Diminutive (-cik/-cık)",
    category: "Suffixes & word formation",
    description: "Small or endearing forms, e.g. kedicik (kitty), evcik (little house), azıcık (a tiny bit), annecim (mummy).",
  },
  {
    id: "suffix-relative-ki",
    name: "Relative/possessive -ki",
    category: "Suffixes & word formation",
    description: "Turns a noun or locative phrase into a pronoun-like adjective, e.g. benimki (mine), masadaki kitap (the book on the table), dünkü (yesterday's).",
  },
  {
    id: "suffix-ordinal",
    name: "Ordinal numbers (-(i)nci)",
    category: "Suffixes & word formation",
    description: "Forms ordinal numbers from cardinal numbers, e.g. üçüncü (third), birinci (first).",
  },
  {
    id: "suffix-adverbial",
    name: "Adverbial/manner suffix (-ce/-ca)",
    category: "Suffixes & word formation",
    description: "Forms adverbs or 'in the manner/language of', e.g. yavaşça (slowly), Türkçe (in Turkish), bence (in my opinion).",
  },
  {
    id: "suffix-reduplication",
    name: "Reduplication (kıpkırmızı, yavaş yavaş)",
    category: "Suffixes & word formation",
    description:
      "Emphatic reduplication of adjectives with an m/p/r/s syllable, and doubling for manner or distribution, e.g. kıpkırmızı (bright red), bembeyaz (pure white), yavaş yavaş (slowly), ev ev dolaştık (we went house to house).",
  },

  // Modality
  {
    id: "modal-ability",
    name: "Ability / possibility (-ebilir/-abilir)",
    category: "Modality",
    description:
      "Can/may using -(y)Abil plus a tense — most often the aorist, giving -Abilir — e.g. gidebilirim (I can/may go), yüzebiliyor (she can swim), yardım edebilir misiniz? (could you help?), yağmur yağabilir (it might rain).",
  },
  {
    id: "modal-inability",
    name: "Inability (-eme/-ama)",
    category: "Modality",
    description:
      "Cannot — the negative of -Abil, where the -bil drops, e.g. gidemem (I can't go), yüzemiyorum (I can't swim), gelemedi (she couldn't come), yapamayacağım (I won't be able to do it).",
  },
  {
    id: "modal-necessity",
    name: "Necessity (-meli/-malı)",
    category: "Modality",
    description: "Expresses obligation or 'should' using the -mAlI suffix, e.g. gitmeliyim (I must go), erken yatmalısın (you should go to bed early).",
  },
  {
    id: "modal-lazim",
    name: "Necessity with lazım/gerek (-mem lazım)",
    category: "Modality",
    description:
      "Have to / need to using the possessed verbal noun plus lazım, gerek or gerekiyor, e.g. gitmem lazım (I have to go), erken kalkman gerekiyor (you need to get up early), dinlenmesi gerek (he needs to rest).",
  },
  {
    id: "modal-zorunda",
    name: "Obligation with zorunda (-mek zorunda)",
    category: "Modality",
    description:
      "Be obliged to, with the infinitive plus zorunda and personal endings, e.g. çalışmak zorundayım (I have to work), gitmek zorunda kaldık (we had to go), gelmek zorunda değilsin (you don't have to come).",
  },
  {
    id: "modal-conditional",
    name: "Hypothetical conditional (-se/-sa)",
    category: "Modality",
    description:
      "If-clauses on the bare verb stem (or with olsa) for hypothetical or wished-for conditions, e.g. gitsem (if I were to go), param olsa alırdım (if I had money I'd buy it), zamanın olsa (if you had time).",
  },
  {
    id: "modal-conditional-real",
    name: "Real conditional (-(y)se/-(y)sa after a tense)",
    category: "Modality",
    description:
      "If-clauses formed by adding -(y)sA to an already tensed verb or to a noun, e.g. geliyorsan (if you're coming), yağmur yağarsa (if it rains), bitirdiysen (if you've finished), yorgunsan (if you're tired).",
  },
  {
    id: "modal-counterfactual",
    name: "Past counterfactual & wishes (-seydi/-saydı, keşke)",
    category: "Modality",
    description:
      "If only / would have, with -sAydI and often keşke, e.g. keşke gelseydin (I wish you had come), bilseydim söylerdim (if I had known I would have told you), keşke daha çok çalışsaydım (if only I had studied more).",
  },
  {
    id: "modal-optative",
    name: "Optative / suggestion (-(y)eyim/-(y)elim)",
    category: "Modality",
    description: "Expresses a wish or suggestion for 'let me/us', e.g. gidelim (let's go), bakayım (let me see), ne yapalım? (what shall we do?).",
  },
  {
    id: "modal-imperative",
    name: "Imperative mood (git, gidin, gitsin)",
    category: "Modality",
    description:
      "Commands and requests, including the third person with -sIn, e.g. git! (go!), gidin (go — formal/plural), lütfen oturun (please sit down), gitsin (let him/her go), gelmesinler (they shouldn't come).",
  },

  // Verb forms
  {
    id: "verb-passive",
    name: "Passive voice (-il/-in/-n)",
    category: "Verb forms",
    description: "The subject receives the action rather than performing it, e.g. yazıldı (it was written), kapı açıldı (the door was opened), burada sigara içilmez (no smoking here).",
  },
  {
    id: "verb-causative",
    name: "Causative (-dir/-t/-ir)",
    category: "Verb forms",
    description: "Marks causing or letting someone else perform the action, e.g. yazdırdım (I had it written), bekletti (she kept us waiting), güldürdü (he made me laugh).",
  },
  {
    id: "verb-reflexive",
    name: "Reflexive (-in/-n)",
    category: "Verb forms",
    description: "The subject performs the action on itself, e.g. yıkanmak (to wash oneself), giyinmek (to get dressed), övünmek (to boast).",
  },
  {
    id: "verb-reciprocal",
    name: "Reciprocal (-iş/-ış)",
    category: "Verb forms",
    description: "Marks an action done to each other or together, e.g. görüşmek (to see each other), tanışmak (to get acquainted), yazışmak (to correspond).",
  },
  {
    id: "verb-compound",
    name: "Compound verbs (etmek, olmak, yapmak)",
    category: "Verb forms",
    description:
      "Noun plus light verb constructions, e.g. yardım etmek (to help), telefon etmek (to phone), hasta olmak (to get ill), alışveriş yapmak (to shop), kabul etmek (to accept).",
  },
  {
    id: "verb-iver",
    name: "Quick/casual action (-iver)",
    category: "Verb forms",
    description: "Doing something quickly, easily or offhand with -(y)Iver, e.g. yapıver (just do it quickly), bir bakıvereyim (let me take a quick look), kapıyı kapatıverdi (she just shut the door).",
  },

  // Verbal nouns
  {
    id: "verbal-noun-infinitive",
    name: "Infinitive (-mek/-mak)",
    category: "Verbal nouns",
    description:
      "The dictionary form used as a noun, with istemek, and before postpositions, e.g. gitmek istiyorum (I want to go), yüzmek güzel (swimming is nice), okumak için (in order to read).",
  },
  {
    id: "verbal-noun-dative",
    name: "Verbal noun + dative (-meye/-maya)",
    category: "Verbal nouns",
    description:
      "The -mA verbal noun in the dative case, used after verbs of starting, trying, going or continuing, e.g. yüzmeye gidiyorum (I'm going swimming), çalışmaya başladım (I started working), gitmeye çalışıyorum (I'm trying to go).",
  },
  {
    id: "verbal-noun-accusative",
    name: "Verbal noun + accusative (-meyi/-mayı)",
    category: "Verbal nouns",
    description:
      "The -mA verbal noun in the accusative case as the object of verbs like sevmek, unutmak, bilmek, denemek, bitirmek, e.g. yüzmeyi seviyorum (I love swimming), gitmeyi unuttum (I forgot to go), okumayı bitirdim (I finished reading).",
  },
  {
    id: "verbal-noun-ablative",
    name: "Infinitive + ablative (-mekten/-maktan)",
    category: "Verbal nouns",
    description:
      "With verbs of fearing, enjoying, tiring of, giving up, e.g. gitmekten korkuyorum (I'm afraid of going), yüzmekten hoşlanıyorum (I enjoy swimming), beklemekten bıktım (I'm sick of waiting), sigaradan vazgeçtim (I gave up smoking).",
  },
  {
    id: "verbal-noun-possessed",
    name: "Possessed verbal noun (-mesi/-ması)",
    category: "Verbal nouns",
    description:
      "The -mA noun with a possessive marking who does the action, e.g. gelmesini istiyorum (I want him to come), erken kalkmam lazım (I need to get up early), sigara içmeniz yasak (you're not allowed to smoke).",
  },

  // Sentence structure
  {
    id: "structure-word-order",
    name: "Word order & emphasis (SOV)",
    category: "Sentence structure",
    description:
      "Subject–object–verb as the default, with the emphasised element placed right before the verb, e.g. ben kitabı dün aldım (I bought the book yesterday) vs. kitabı dün ben aldım (it was me who bought it yesterday).",
    pervasive: true,
  },
  {
    id: "structure-question",
    name: "Question particle (mi/mı/mu/mü)",
    category: "Sentence structure",
    description: "Forms yes/no questions using the separate mI particle, placed after the word being asked about, e.g. gidiyor musun? (are you going?), sen mi geldin? (was it you who came?).",
  },
  {
    id: "structure-tag-question",
    name: "Tag questions (değil mi?)",
    category: "Sentence structure",
    description: "Seeking agreement with değil mi at the end of a statement, e.g. geliyorsun, değil mi? (you're coming, aren't you?), güzel, değil mi? (nice, isn't it?).",
  },
  {
    id: "structure-negation",
    name: "Verb negation (-me/-ma)",
    category: "Sentence structure",
    description: "Negates verbs using the -mA suffix inserted before the tense suffix, e.g. gitmiyorum (I'm not going), gelmedi (he didn't come), yapmayacağım (I won't do it).",
  },
  {
    id: "structure-postpositions",
    name: "Postpositions (için, gibi, ile, kadar)",
    category: "Sentence structure",
    description: "Words like için (for), gibi (like), ile (with), kadar (as much as) that follow the noun they relate to, e.g. senin için (for you), çocuk gibi (like a child).",
  },
  {
    id: "structure-postpositions-dative",
    name: "Postpositions taking the dative (-e kadar, göre, doğru, karşı)",
    category: "Sentence structure",
    description:
      "e.g. eve kadar (as far as home), bana göre (in my opinion), akşama doğru (towards evening), soğuğa karşı (against the cold), sana rağmen (despite you).",
  },
  {
    id: "structure-postpositions-ablative",
    name: "Postpositions taking the ablative (-den beri, sonra, önce, başka)",
    category: "Sentence structure",
    description:
      "e.g. sabahtan beri (since morning), yemekten sonra (after the meal), dersten önce (before class), senden başka (apart from you), bu yüzden (because of this), evden dolayı (owing to the house).",
  },
  {
    id: "structure-spatial-nouns",
    name: "Spatial relational nouns (alt, üst, iç, ön, arka, yan…)",
    category: "Sentence structure",
    description:
      "Turkish expresses 'under/inside/in front of' with a NOUN, not a preposition: the thing located takes the genitive, and the spatial noun takes a possessive suffix and then a case — masanın altında (under the table), evin içine (into the house), kapının önünde (in front of the door), sokağın karşısında (across the street), odanın köşesinde (in the corner of the room), yolun kenarında (at the side of the road). The set includes alt, üst, iç, dış, ön, arka, yan, kenar, karşı, köşe, ara, orta, etraf, çevre.",
  },
  {
    id: "structure-conjunctions",
    name: "Conjunctions (ve, ama, çünkü, ki)",
    category: "Sentence structure",
    description: "Connecting words such as ve (and), ama/fakat (but), çünkü (because), o yüzden (so), yoksa (otherwise/or), e.g. geç kalktım, o yüzden geç kaldım (I got up late, so I was late).",
  },
  {
    id: "structure-correlative",
    name: "Correlative conjunctions (hem…hem, ya…ya, ne…ne)",
    category: "Sentence structure",
    description:
      "hem…hem (both…and), ya…ya (either…or), ne…ne (neither…nor, with a positive verb), e.g. hem çalışıyor hem okuyor (she both works and studies), ne çay ne kahve içerim (I drink neither tea nor coffee).",
  },
  {
    id: "structure-ki",
    name: "Clauses with ki",
    category: "Sentence structure",
    description:
      "The conjunction ki introducing a following clause, e.g. biliyorum ki geleceksin (I know that you'll come), o kadar yorgunum ki (I'm so tired that…), umarım ki (I hope that).",
  },
  {
    id: "structure-comparison",
    name: "Comparison (daha, en, kadar)",
    category: "Sentence structure",
    description:
      "Comparatives and superlatives with -DAn daha (more than), en (most), and kadar (as…as), e.g. senden daha uzun (taller than you), en güzel (the most beautiful), benim kadar (as much as me).",
  },
  {
    id: "structure-as-if",
    name: "As if (-mış gibi, sanki)",
    category: "Sentence structure",
    description: "e.g. hiçbir şey olmamış gibi (as if nothing had happened), sanki beni tanımıyor (as if he doesn't know me), bilmiyormuş gibi yaptı (she acted as if she didn't know).",
  },
  {
    id: "structure-indirect-speech",
    name: "Reported/indirect speech",
    category: "Sentence structure",
    description:
      "Relaying what someone else said, typically with -DIğIni/-(y)AcAğInI clauses and demek/söylemek, or quoting with diye, e.g. geleceğini söyledi (he said he'd come), 'gel' diye bağırdı (she shouted 'come').",
  },

  // Converbs & clauses
  {
    id: "converb-ip",
    name: "Sequential converb (-ip/-ıp)",
    category: "Converbs & clauses",
    description: "Links two actions by the same subject as 'and (then)', e.g. gidip aldım (I went and got it), oturup konuştuk (we sat and talked), kalkıp gitti (he got up and left).",
  },
  {
    id: "converb-arak",
    name: "Manner converb (-erek/-arak)",
    category: "Converbs & clauses",
    description: "Describes an action done 'by/while doing' another, e.g. koşarak geldi (came running), gülerek söyledi (said it laughing), çalışarak öğrendim (I learned by working).",
  },
  {
    id: "converb-a-a",
    name: "Repetitive converb (-e -e / -a -a)",
    category: "Converbs & clauses",
    description: "Doubled -(y)A for 'by repeatedly doing / while doing', e.g. koşa koşa geldi (came running), güle güle (go happily — goodbye), düşüne düşüne (thinking it over and over).",
  },
  {
    id: "converb-madan",
    name: "Negative converb (-meden/-madan)",
    category: "Converbs & clauses",
    description: "Means 'without doing', e.g. bakmadan (without looking), düşünmeden konuştu (he spoke without thinking).",
  },
  {
    id: "converb-ken",
    name: "Simultaneity (-ken)",
    category: "Converbs & clauses",
    description: "Means 'while/when', attached to a verb stem plus tense or to a noun, e.g. giderken (while going), çocukken (when I was a child), yemek yerken (while eating).",
  },
  {
    id: "converb-inca",
    name: "Temporal clause (-ince/-ınca)",
    category: "Converbs & clauses",
    description: "Means 'when / as soon as / once', e.g. gidince (once he goes), eve gelince ara (call me when you get home), haberi duyunca ağladı (she cried when she heard the news).",
  },
  {
    id: "clause-when",
    name: "When clauses (-diğinde, -diği zaman)",
    category: "Converbs & clauses",
    description: "e.g. eve geldiğimde (when I came home), onu gördüğüm zaman (when I saw him), küçükken / çocuk olduğum zaman (when I was little).",
  },
  {
    id: "clause-before-after",
    name: "Before/after clauses (-meden önce, -dikten sonra)",
    category: "Converbs & clauses",
    description: "e.g. yemek yemeden önce ellerini yıka (wash your hands before eating), işi bitirdikten sonra eve gittim (after finishing the work I went home).",
  },
  {
    id: "clause-as-soon-as",
    name: "As soon as (-ir -mez)",
    category: "Converbs & clauses",
    description: "The aorist positive plus negative pair, e.g. gelir gelmez (as soon as he arrives), görür görmez tanıdım (I recognised her the moment I saw her), uyanır uyanmaz (as soon as I wake up).",
  },
  {
    id: "clause-until-since",
    name: "Until / since clauses (-ene kadar, -eli)",
    category: "Converbs & clauses",
    description: "e.g. sen gelene kadar bekledim (I waited until you came), bitirinceye kadar (until it's finished), İstanbul'a taşınalı üç yıl oldu (it's been three years since we moved to Istanbul).",
  },
  {
    id: "clause-dikce",
    name: "The more… / as long as (-dikçe/-dıkça)",
    category: "Converbs & clauses",
    description: "e.g. okudukça öğreniyorum (the more I read, the more I learn), yaşadıkça (as long as you live), gittikçe zorlaşıyor (it's getting harder and harder).",
  },
  {
    id: "clause-purpose",
    name: "Purpose clauses (-mek için, -sin diye, -mesi için)",
    category: "Converbs & clauses",
    description:
      "e.g. Türkçe öğrenmek için (in order to learn Turkish), geç kalmayayım diye erken çıktım (I left early so that I wouldn't be late), gelmesi için aradım (I called so that he'd come).",
  },
  {
    id: "clause-reason",
    name: "Reason clauses (-diği için, -diğinden)",
    category: "Converbs & clauses",
    description: "e.g. hasta olduğum için gelemedim (I couldn't come because I was ill), yağmur yağdığından evde kaldık (since it rained we stayed home).",
  },
  {
    id: "clause-concession",
    name: "Concession (-se de, -se bile, -mesine rağmen)",
    category: "Converbs & clauses",
    description:
      "Even if / although, e.g. yorgun olsam da geldim (I came even though I was tired), gitsen bile (even if you go), çok çalışmasına rağmen kazanamadı (despite working hard he didn't win).",
  },
  {
    id: "structure-relative-clause",
    name: "Object relative clauses (-diği/-eceği)",
    category: "Converbs & clauses",
    description:
      "Relative clauses where the head noun is the object, place or time of the verb, with the participle taking a possessive, e.g. okuduğum kitap (the book I read), gideceğimiz yer (the place we'll go), tanıştığımız gün (the day we met).",
  },
  {
    id: "clause-subject-participle",
    name: "Subject participle (-en/-an)",
    category: "Converbs & clauses",
    description:
      "Relative clauses where the head noun is the subject, e.g. gelen adam (the man who is coming), çalışan öğrenciler (the students who work), kırılan cam (the glass that broke), konuşan kim? (who's speaking?).",
  },
  {
    id: "clause-mis-participle",
    name: "Past participle as adjective (-miş/-mış)",
    category: "Converbs & clauses",
    description: "e.g. kırılmış cam (broken glass), pişmiş yemek (cooked food), tanınmış yazar (a well-known writer), okunmuş kitap (a read book).",
  },
  {
    id: "clause-noun-clause",
    name: "Noun clauses (-diğini, -eceğini)",
    category: "Converbs & clauses",
    description:
      "A verb phrase as the object of knowing, seeing, thinking, hearing, e.g. geldiğini biliyorum (I know that he came), ne yapacağımı bilmiyorum (I don't know what I'll do), gittiğinizi duydum (I heard you'd gone).",
  },
];

export const grammarConceptCategories = Array.from(
  new Set(grammarConcepts.map((c) => c.category))
);
