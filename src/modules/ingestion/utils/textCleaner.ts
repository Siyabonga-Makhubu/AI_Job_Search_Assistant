export function cleanText(rawText: string): string {
  if (!rawText) return "";

  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\t\f]/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +/g, " ")
    .replace(/\n +/g, "\n")
    .replace(/ +\n/g, "\n")
    .trim();
}
