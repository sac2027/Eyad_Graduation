import type { CollegeId } from '@/domain/types'

export interface Persona {
  id: string
  role: 'graduate' | 'guest' | 'admin'
  gender: 'm' | 'f'
  name: { ar: string; en: string }
  college: CollegeId
  gpa: number
}

/** Mock people only. No real names. */
export const PERSONAS: Persona[] = [
  { id: 'grad-m-gold', role: 'graduate', gender: 'm', name: { ar: 'خالد العتيبي', en: 'Khaled Alotaibi' }, college: 'engineering', gpa: 3.92 },
  { id: 'grad-f-gold', role: 'graduate', gender: 'f', name: { ar: 'ريم الدوسري', en: 'Reem Aldosari' }, college: 'computing', gpa: 3.88 },
  { id: 'grad-m-silver', role: 'graduate', gender: 'm', name: { ar: 'فهد الشهري', en: 'Fahad Alshehri' }, college: 'petroleum', gpa: 3.55 },
  { id: 'grad-f-silver', role: 'graduate', gender: 'f', name: { ar: 'لينا الحربي', en: 'Lina Alharbi' }, college: 'business', gpa: 3.4 },
  { id: 'grad-m-bronze', role: 'graduate', gender: 'm', name: { ar: 'سلطان الزهراني', en: 'Sultan Alzahrani' }, college: 'design', gpa: 3.1 },
  { id: 'grad-f-bronze', role: 'graduate', gender: 'f', name: { ar: 'نورة القحطاني', en: 'Noura Alqahtani' }, college: 'chemicals', gpa: 3.05 },
  { id: 'grad-m-none', role: 'graduate', gender: 'm', name: { ar: 'ماجد المطيري', en: 'Majed Almutairi' }, college: 'business', gpa: 2.7 },
  { id: 'grad-f-none', role: 'graduate', gender: 'f', name: { ar: 'هند السبيعي', en: 'Hind Alsubaie' }, college: 'computing', gpa: 2.85 },
  {
    id: 'grad-long-name',
    role: 'graduate',
    gender: 'm',
    name: {
      ar: 'عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي الشمري',
      en: 'Abdulrahman bin Mohammed bin Abdulaziz bin Saud bin Faisal Al-Ghamdi Al-Shammari',
    },
    college: 'engineering',
    gpa: 3.8,
  },
  { id: 'grad-short-name', role: 'graduate', gender: 'f', name: { ar: 'ن', en: 'N' }, college: 'computing', gpa: 3.3 },
  { id: 'guest', role: 'guest', gender: 'm', name: { ar: 'ضيف', en: 'Guest' }, college: 'general-studies', gpa: 0 },
  { id: 'admin', role: 'admin', gender: 'm', name: { ar: 'مشرف شؤون الطلاب', en: 'Student Affairs admin' }, college: 'general-studies', gpa: 0 },
]
