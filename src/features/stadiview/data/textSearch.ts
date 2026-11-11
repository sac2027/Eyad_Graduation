/**
 * Brings text to one plain form so that a search finds a name however it was typed: without
 * Arabic vowel marks, with the hamza and ending variants folded together, with any kind of digit
 * as a Latin digit, in lower case, and with single spaces.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    // Vowel marks (tashkeel), the superscript alef, and the stretching stroke (tatweel).
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // Arabic-Indic and Persian digits.
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim()
}
