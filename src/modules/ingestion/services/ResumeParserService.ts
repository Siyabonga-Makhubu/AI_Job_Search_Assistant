import fs from "node:fs/promises";
import { cleanText } from "../utils/textCleaner";

const { PDFParse } = require("pdf-parse");

export class ResumeParserService {
  async extractTextFromPdf(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const pdfData = new Uint8Array(buffer);
    const pdf = new PDFParse(pdfData);
    const data = await pdf.getText();
    const rawText = typeof data === "string" ? data : data?.text ?? "";
    return cleanText(rawText);
  }
}
