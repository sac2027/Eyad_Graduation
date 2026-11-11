/**
 * Name parts for the mock graduates. They are common given and family names, combined at random:
 * no entry is a real student.
 */
export interface NamePart {
  ar: string
  en: string
}

const pairs = (list: string): NamePart[] =>
  list
    .trim()
    .split('\n')
    .map((line) => {
      const [ar, en] = line.trim().split('|')
      return { ar, en }
    })

export const MALE_NAMES = pairs(`
محمد|Mohammed
عبدالله|Abdullah
أحمد|Ahmed
خالد|Khaled
فهد|Fahad
سلطان|Sultan
عبدالرحمن|Abdulrahman
سعود|Saud
فيصل|Faisal
تركي|Turki
ناصر|Nasser
عمر|Omar
علي|Ali
يوسف|Yousef
إبراهيم|Ibrahim
ماجد|Majed
بندر|Bandar
سلمان|Salman
نواف|Nawaf
مشعل|Mishal
راكان|Rakan
زياد|Ziyad
عبدالعزيز|Abdulaziz
حسن|Hassan
حمد|Hamad
سعد|Saad
طلال|Talal
وليد|Waleed
هشام|Hisham
أنس|Anas
ريان|Rayan
مهند|Muhannad
عادل|Adel
بدر|Badr
ثامر|Thamer
معاذ|Muath
`)

export const FEMALE_NAMES = pairs(`
نورة|Noura
سارة|Sarah
ريم|Reem
لينا|Lina
هند|Hind
فاطمة|Fatimah
مريم|Maryam
عائشة|Aisha
جواهر|Jawaher
دانة|Dana
لمى|Lama
شهد|Shahad
غادة|Ghada
منيرة|Munirah
أمل|Amal
هيفاء|Haifa
رغد|Raghad
جود|Joud
ليان|Layan
روان|Rawan
أسماء|Asma
العنود|Alanoud
بشاير|Bashayer
وعد|Waad
حصة|Hessa
ندى|Nada
رهف|Rahaf
تالا|Tala
لطيفة|Latifah
ملاك|Malak
`)

export const FAMILY_NAMES = pairs(`
العتيبي|Alotaibi
الدوسري|Aldosari
الشهري|Alshehri
الحربي|Alharbi
الزهراني|Alzahrani
القحطاني|Alqahtani
المطيري|Almutairi
السبيعي|Alsubaie
الغامدي|Alghamdi
الشمري|Alshammari
العنزي|Alanazi
المالكي|Almalki
الخالدي|Alkhaldi
البلوي|Albalawi
الجهني|Aljuhani
العمري|Alamri
الأحمدي|Alahmadi
السلمي|Alsulami
الرشيدي|Alrashidi
الهاجري|Alhajri
العجمي|Alajmi
المري|Almarri
اليامي|Alyami
الشريف|Alsharif
النعيمي|Alnuaimi
البقمي|Albuqami
الثبيتي|Althubaiti
العسيري|Alasiri
الفيفي|Alfaifi
الحازمي|Alhazmi
الصالح|Alsaleh
الناصر|Alnasser
الفهد|Alfahad
الراشد|Alrashed
السعيد|Alsaeed
المحمد|Almohammed
العبدالله|Alabdullah
الحسن|Alhassan
الخليفة|Alkhalifah
الملحم|Almulhim
النجار|Alnajjar
البوعينين|Albuainain
الهزاع|Alhazza
التميمي|Altamimi
القرني|Alqarni
`)
