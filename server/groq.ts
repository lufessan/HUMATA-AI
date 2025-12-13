import Groq from "groq-sdk";
import * as fs from "fs";
import mammoth from "mammoth";
import { createRequire } from "module";
import Tesseract from "tesseract.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const REASONING_MODEL = "llama-3.3-70b-versatile";

if (!GROQ_API_KEY) {
  console.error("[Groq] CRITICAL: No GROQ_API_KEY environment variable is set!");
} else {
  console.log(`[Groq] API key configured, using model: ${REASONING_MODEL} (reasoning)`);
}

console.log("[OCR] Using Tesseract.js for local image text extraction (no API key required)");

const groq = new Groq({
  apiKey: GROQ_API_KEY || "",
});

export interface GroqChatOptions {
  systemPrompt?: string;
  base64Data?: string;
  mimeType?: string;
  fileName?: string;
  enableGrounding?: boolean;
  files?: Array<{ base64Data: string; mimeType: string; fileName: string }>;
}

export function getApiKeyStatus() {
  return {
    total: GROQ_API_KEY ? 1 : 0,
    available: GROQ_API_KEY ? 1 : 0,
    failed: 0
  };
}

const HUMATA_SYSTEM_PROMPT = `You are Humata AI. In 'Scientific Mode', explain concepts step-by-step. In 'Doctor Mode', provide guidance with disclaimers. In 'Khedive Mode', speak historically.

IMPORTANT LANGUAGE REQUIREMENT: You must output ONLY in standard Arabic (العربية الفصحى). Do not use Chinese, English, Latin, or any other non-Arabic characters whatsoever. Translate ALL technical terms to Arabic. Ensure the text is 100% pure Arabic script only. Never mix languages.

CRITICAL OUTPUT REQUIREMENT: Your responses MUST be clean, readable, professional prose. AVOID using any decorative Markdown characters like asterisks (*), hashtags (#), backticks (\`), or excessive formatting symbols. Focus on clear, clean text only. Use simple line breaks for paragraph separation instead of Markdown formatting.

When processing OCR text from images, please clean up any recognition errors and understand the context to provide accurate responses.`;

async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const data = await pdfParse(buffer);
    console.log(`[FileReader] PDF extracted - ${data.text.length} chars`);
    return data.text;
  } catch (error: any) {
    console.error("[FileReader] PDF extraction error:", error.message);
    throw new Error("فشل في قراءة ملف PDF");
  }
}

async function extractTextFromDOCX(base64Data: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const result = await mammoth.extractRawText({ buffer });
    console.log(`[FileReader] DOCX extracted - ${result.value.length} chars`);
    return result.value;
  } catch (error: any) {
    console.error("[FileReader] DOCX extraction error:", error.message);
    throw new Error("فشل في قراءة ملف Word");
  }
}

async function extractTextFromImageWithOCR(base64Data: string, mimeType: string): Promise<string> {
  console.log("[OCR] Starting local Tesseract.js OCR (no API key required)");
  
  try {
    const imageBuffer = Buffer.from(base64Data, "base64");
    
    const result = await Tesseract.recognize(
      imageBuffer,
      "ara+eng",
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    const extractedText = result.data.text.trim();
    
    if (!extractedText) {
      console.log("[OCR] No text found in image");
      return "[صورة - لم يتم العثور على نص قابل للقراءة في الصورة]";
    }
    
    console.log(`[OCR] Successfully extracted ${extractedText.length} characters from image`);
    return `[نص مستخرج من الصورة باستخدام OCR]:\n${extractedText}`;
  } catch (error: any) {
    console.error("[OCR] Error during text extraction:", error.message);
    return "[صورة - فشل في استخراج النص من الصورة]";
  }
}

async function processFileContent(base64Data: string, mimeType: string, fileName: string): Promise<string> {
  console.log(`[FileReader] Processing file: ${fileName}, type: ${mimeType}`);

  if (mimeType === "application/pdf") {
    return await extractTextFromPDF(base64Data);
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      mimeType === "application/msword") {
    return await extractTextFromDOCX(base64Data);
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    const text = Buffer.from(base64Data, "base64").toString("utf-8");
    console.log(`[FileReader] Text file read - ${text.length} chars`);
    return text;
  }

  if (mimeType.startsWith("image/")) {
    return await extractTextFromImageWithOCR(base64Data, mimeType);
  }

  return `[ملف: ${fileName}] - نوع الملف غير مدعوم للقراءة التلقائية`;
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  options: GroqChatOptions = {}
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("لا يوجد مفتاح API متاح - يرجى إضافة GROQ_API_KEY");
  }

  try {
    let fileContent = "";

    if (options.base64Data && options.mimeType) {
      console.log(`[Hybrid] Processing uploaded file: ${options.fileName}`);
      fileContent = await processFileContent(options.base64Data, options.mimeType, options.fileName || "file");
    }

    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        console.log(`[Hybrid] Processing file: ${file.fileName}`);
        const content = await processFileContent(file.base64Data, file.mimeType, file.fileName);
        fileContent += `\n\n[${file.fileName}]\n${content}`;
      }
    }

    console.log(`[Hybrid] Sending to Groq Reasoning with ${REASONING_MODEL}`);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

    let systemPrompt = HUMATA_SYSTEM_PROMPT;
    if (options.systemPrompt) {
      systemPrompt = `${HUMATA_SYSTEM_PROMPT}\n\n${options.systemPrompt}`;
    }

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    for (const msg of history) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    let userMessage = message;
    if (fileContent) {
      userMessage = `[محتوى الملف/الصورة]:\n${fileContent}\n\n[سؤال المستخدم]:\n${message}`;
    }

    messages.push({
      role: "user",
      content: userMessage,
    });

    console.log(`[Hybrid] Groq request - messagesCount: ${messages.length}, hasFileContent: ${!!fileContent}`);

    const completion = await groq.chat.completions.create({
      model: REASONING_MODEL,
      messages: messages,
      max_tokens: 4096,
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error("No response generated from AI");
    }

    console.log(`[Hybrid] Response received successfully`);
    return responseText;
  } catch (error: any) {
    console.error("[Hybrid] API error:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });

    if (error.status === 429 || error.message?.includes("rate") || error.message?.includes("limit")) {
      console.log("[Hybrid] Rate limited on reasoning, waiting and retrying...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      return sendChatMessage(message, history, options);
    }

    if (error.message?.includes("API key") || error.status === 401) {
      throw new Error("خطأ في مفتاح API - تحقق من إعدادات الخادم");
    }

    throw new Error(error.message || "حدث خطأ في معالجة الرسالة");
  }
}

export async function uploadFile(
  filePath: string,
  mimeType: string,
  fileName: string
): Promise<{ base64Data: string; mimeType: string; fileName: string }> {
  try {
    console.log(`[FileReader] Reading file: ${fileName}, mimeType: ${mimeType}`);
    console.log(`[FileReader] File path: ${filePath}`);

    const fileBytes = fs.readFileSync(filePath);
    console.log(`[FileReader] File read successfully - size: ${fileBytes.length} bytes`);

    const base64Data = fileBytes.toString("base64");
    console.log(`[FileReader] File converted to base64 - length: ${base64Data.length}`);

    return {
      base64Data,
      mimeType,
      fileName,
    };
  } catch (error: any) {
    console.error("[FileReader] File read error:", error);
    console.error("[FileReader] Error stack:", error.stack);
    throw new Error(error.message || "Failed to process file");
  }
}
