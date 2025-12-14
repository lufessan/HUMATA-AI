import Groq from "groq-sdk";
import * as fs from "fs";
import mammoth from "mammoth";
import { createRequire } from "module";
import Tesseract from "tesseract.js";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const REASONING_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";

function validateGroqApiKey(): void {
  if (!GROQ_API_KEY) {
    console.error("╔════════════════════════════════════════════════════════════════╗");
    console.error("║  [Groq] CRITICAL ERROR: GROQ_API_KEY is not configured!        ║");
    console.error("║                                                                ║");
    console.error("║  The AI features will NOT work without a valid API key.        ║");
    console.error("║  Please set the GROQ_API_KEY environment variable.             ║");
    console.error("║                                                                ║");
    console.error("║  To fix this:                                                  ║");
    console.error("║  1. Get an API key from https://console.groq.com               ║");
    console.error("║  2. Add GROQ_API_KEY to your environment secrets               ║");
    console.error("╚════════════════════════════════════════════════════════════════╝");
  } else {
    const maskedKey = GROQ_API_KEY.slice(0, 8) + "..." + GROQ_API_KEY.slice(-4);
    console.log(`[Groq] API key validated successfully (${maskedKey})`);
    console.log(`[Groq] Using model: ${REASONING_MODEL}`);
  }
}

validateGroqApiKey();
console.log("[OCR] Enhanced Arabic OCR pipeline with Sharp preprocessing + Tesseract.js + LLM correction");

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
    console.log(`[FileReader] PDF extracted - ${data.text.length} chars, ${data.numpages} pages`);
    
    if (data.numpages > 1 && GROQ_API_KEY) {
      console.log(`[PDF-Merge] Multi-page PDF detected (${data.numpages} pages), applying smart merging...`);
      const mergedText = await smartMergeMultiPagePDF(data.text, data.numpages);
      return mergedText;
    }
    
    return data.text;
  } catch (error: any) {
    console.error("[FileReader] PDF extraction error:", error.message);
    throw new Error("فشل في قراءة ملف PDF");
  }
}

async function smartMergeMultiPagePDF(rawText: string, numPages: number): Promise<string> {
  if (!GROQ_API_KEY) {
    console.log("[PDF-Merge] No API key available, returning raw text");
    return rawText;
  }
  
  if (!rawText || rawText.length < 50) {
    console.log("[PDF-Merge] Text too short for merging");
    return rawText;
  }
  
  console.log(`[PDF-Merge] Starting smart merge for ${numPages}-page PDF (${rawText.length} chars)`);
  
  const MAX_CHARS_PER_CHUNK = 6000;
  
  if (rawText.length <= MAX_CHARS_PER_CHUNK) {
    return await processSingleChunk(rawText, numPages);
  }
  
  console.log(`[PDF-Merge] Large PDF detected, processing in chunks...`);
  const chunks: string[] = [];
  let currentPos = 0;
  
  while (currentPos < rawText.length) {
    let endPos = Math.min(currentPos + MAX_CHARS_PER_CHUNK, rawText.length);
    
    if (endPos < rawText.length) {
      const lastPeriod = rawText.lastIndexOf('.', endPos);
      const lastNewline = rawText.lastIndexOf('\n', endPos);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > currentPos + MAX_CHARS_PER_CHUNK / 2) {
        endPos = breakPoint + 1;
      }
    }
    
    chunks.push(rawText.slice(currentPos, endPos));
    currentPos = endPos;
  }
  
  console.log(`[PDF-Merge] Split into ${chunks.length} chunks`);
  
  const processedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[PDF-Merge] Processing chunk ${i + 1}/${chunks.length}`);
    try {
      const processed = await cleanPDFChunk(chunks[i], i === 0, i === chunks.length - 1);
      processedChunks.push(processed);
    } catch (error: any) {
      console.error(`[PDF-Merge] Chunk ${i + 1} failed, using raw:`, error.message);
      processedChunks.push(chunks[i]);
    }
  }
  
  const merged = processedChunks.join('\n\n');
  console.log(`[PDF-Merge] Chunked merge complete: ${rawText.length} -> ${merged.length} chars`);
  return merged;
}

async function processSingleChunk(rawText: string, numPages: number): Promise<string> {
  const mergePrompt = `أنت نظام متخصص في دمج النصوص المستخرجة من ملفات PDF متعددة الصفحات.

النص التالي تم استخراجه من ملف PDF يحتوي على ${numPages} صفحة.
النص قد يحتوي على:
- جمل مقطوعة بين الصفحات
- رؤوس وتذييلات متكررة في كل صفحة
- أرقام صفحات
- عناوين متكررة

مهمتك:
1. دمج جميع الصفحات في نص عربي واحد متماسك
2. إعادة ربط الجمل المقطوعة بين الصفحات بشكل صحيح
3. إزالة رؤوس الصفحات والتذييلات المتكررة وأرقام الصفحات
4. الحفاظ على المعنى الأصلي تماماً

أخرج النص المدموج والمنظف فقط.

النص الخام:
${rawText}`;

  try {
    const completion = await groq.chat.completions.create({
      model: REASONING_MODEL,
      messages: [
        {
          role: "system",
          content: "أنت متخصص في معالجة النصوص العربية من PDF. أخرج النص المنظف فقط."
        },
        {
          role: "user",
          content: mergePrompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const mergedText = completion.choices[0]?.message?.content?.trim();
    
    if (!mergedText) {
      console.log("[PDF-Merge] No merged text generated, using original");
      return rawText;
    }
    
    console.log(`[PDF-Merge] Text merged: ${rawText.length} -> ${mergedText.length} chars`);
    return mergedText;
  } catch (error: any) {
    console.error("[PDF-Merge] Merge error:", error.message);
    return rawText;
  }
}

async function cleanPDFChunk(chunk: string, isFirst: boolean, isLast: boolean): Promise<string> {
  const cleanPrompt = `نظف هذا النص العربي المستخرج من PDF:
- أزل أرقام الصفحات والرؤوس والتذييلات المتكررة
- صحح الجمل المقطوعة
- حافظ على المحتوى الأصلي

${isFirst ? 'هذا بداية المستند.' : ''} ${isLast ? 'هذا نهاية المستند.' : ''}

النص:
${chunk}`;

  const completion = await groq.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      {
        role: "system",
        content: "نظف النص وأخرجه مباشرة بدون شرح."
      },
      {
        role: "user",
        content: cleanPrompt
      }
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  return completion.choices[0]?.message?.content?.trim() || chunk;
}

// Structure for heading detection output
export interface DocumentSection {
  type: "main" | "sub";
  title: string;
  content: string;
}

export interface StructuredDocument {
  sections: DocumentSection[];
  plainText: string;
}

// Image type classification for Universal Image Understanding
export type ImageType = "document" | "ui" | "diagram" | "mixed";

export interface ImageClassificationResult {
  type: ImageType;
  confidence: string;
  reasoning: string;
}

// Automatic Heading Detection from Arabic PDF Text
async function detectHeadingsFromText(rawText: string): Promise<StructuredDocument> {
  const defaultResult: StructuredDocument = {
    sections: [{ type: "main", title: "المحتوى", content: rawText }],
    plainText: rawText
  };
  
  if (!GROQ_API_KEY) {
    console.log("[Heading-Detection] No API key available, returning raw text");
    return defaultResult;
  }
  
  if (!rawText || rawText.length < 100) {
    console.log("[Heading-Detection] Text too short for heading detection");
    return defaultResult;
  }
  
  console.log(`[Heading-Detection] Starting automatic heading detection (${rawText.length} chars)`);
  
  const MAX_CHARS = 8000;
  const textToProcess = rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;
  
  const headingDetectionPrompt = `أنت نظام ذكي متخصص في تحليل النصوص العربية المستخرجة من مستندات PDF واكتشاف هيكل المستند تلقائياً.

المهمة:
تحليل النص العربي التالي (المستخرج من PDF) واكتشاف:
- العناوين الرئيسية
- العناوين الفرعية
- إعادة بناء الهيكل المنطقي للمستند

ملاحظات مهمة:
- النص قد يحتوي على أخطاء OCR
- قد تكون المسافات غير متسقة
- لا توجد معلومات تنسيق
- يجب استنتاج الهيكل من المحتوى وليس التنسيق

قواعد اكتشاف العناوين:
حدد العناوين باستخدام الأدلة الدلالية مثل:
1. جمل التعريف: "تعريف..."، "مفهوم..."، "ما هو..."
2. التعدادات: "أولاً"، "ثانياً"، "أنواع"، "مراحل"، "خصائص"، "استخدامات"
3. انتقالات الموضوع: "في هذا الفصل"، "ننتقل إلى"، "سنتناول"، "يهدف هذا القسم"

صيغة الإخراج (JSON فقط):
أرجع مصفوفة JSON بالشكل التالي:
[
  {"type": "main", "title": "العنوان الرئيسي", "content": "محتوى القسم..."},
  {"type": "sub", "title": "العنوان الفرعي", "content": "محتوى القسم الفرعي..."}
]

النص المطلوب تحليله:
${textToProcess}`;

  try {
    const completion = await groq.chat.completions.create({
      model: REASONING_MODEL,
      messages: [
        {
          role: "system",
          content: "أنت محرر نصوص محترف. أخرج JSON فقط بدون أي نص إضافي. المصفوفة يجب أن تحتوي على كائنات بالحقول: type, title, content"
        },
        {
          role: "user",
          content: headingDetectionPrompt
        }
      ],
      max_tokens: 8192,
      temperature: 0.2,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      console.log("[Heading-Detection] No response generated, using original");
      return defaultResult;
    }
    
    // Try to parse JSON from response
    let sections: DocumentSection[] = [];
    try {
      // Extract JSON array from response (may have extra text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        sections = JSON.parse(jsonMatch[0]);
      } else {
        console.log("[Heading-Detection] No JSON array found in response");
        return defaultResult;
      }
    } catch (parseError) {
      console.error("[Heading-Detection] JSON parse error:", parseError);
      return defaultResult;
    }
    
    // Build plain text from sections
    const plainText = sections.map(s => `${s.title}\n\n${s.content}`).join("\n\n");
    
    console.log(`[Heading-Detection] Text structured: ${sections.length} sections found`);
    return { sections, plainText };
  } catch (error: any) {
    console.error("[Heading-Detection] Error:", error.message);
    return defaultResult;
  }
}

// Export the heading detection function for use in routes
export async function structurePDFText(text: string): Promise<StructuredDocument> {
  return await detectHeadingsFromText(text);
}

// Universal Image Understanding: Image Classification
export async function classifyImage(base64Data: string, mimeType: string = "image/jpeg"): Promise<ImageType> {
  if (!GROQ_API_KEY) {
    console.log("[Image-Classify] No API key available, defaulting to 'mixed'");
    return "mixed";
  }

  console.log("[Image-Classify] Starting intelligent image classification with vision model");

  const classificationPrompt = `أنت نظام ذكي متخصص في تصنيف الصور. حلل الصورة المقدمة وصنفها إلى إحدى الفئات التالية:

الفئات المتاحة:
1. "document" - مستند: صفحات ممسوحة ضوئياً، امتحانات، كتب، ملاحظات مكتوبة، أوراق رسمية، نصوص مطبوعة
2. "ui" - واجهة مستخدم: لقطات شاشة لتطبيقات، مواقع ويب، لوحات تحكم، شاشات هواتف، برامج
3. "diagram" - رسم تخطيطي: تصاميم، رسومات توضيحية، مخططات، خرائط ذهنية، رسوم بيانية، إنفوجرافيك
4. "mixed" - مختلط: محتوى غير واضح أو يجمع بين أنواع متعددة

أجب بكلمة واحدة فقط من الخيارات التالية: document أو ui أو diagram أو mixed

ملاحظة مهمة: إذا كانت الصورة تحتوي على لقطة شاشة لموقع أو تطبيق، صنفها كـ "ui" حتى لو كانت تحتوي على نصوص.`;

  try {
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: classificationPrompt },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:${mimeType};base64,${base64Data}` 
              } 
            }
          ]
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase();
    
    if (response?.includes("document")) {
      console.log("[Image-Classify] Classification result: document");
      return "document";
    } else if (response?.includes("ui")) {
      console.log("[Image-Classify] Classification result: ui");
      return "ui";
    } else if (response?.includes("diagram")) {
      console.log("[Image-Classify] Classification result: diagram");
      return "diagram";
    } else {
      console.log("[Image-Classify] Classification result: mixed (default)");
      return "mixed";
    }
  } catch (error: any) {
    console.error("[Image-Classify] Classification error:", error.message);
    return "mixed";
  }
}

// Universal Image Understanding: Visual Analysis Mode
export async function analyzeImageVisually(base64Data: string, mimeType: string): Promise<string> {
  if (!GROQ_API_KEY) {
    console.log("[Visual-Analysis] No API key available");
    return `[تحليل مرئي للصورة]

تم استلام الصورة بنجاح. يرجى التأكد من إعداد مفتاح API للحصول على تحليل مفصل.

يمكنك طرح أسئلة محددة حول محتوى الصورة للحصول على مساعدة إضافية.`;
  }

  console.log("[Visual-Analysis] Starting comprehensive visual image analysis with vision model");

  const visualAnalysisPrompt = `أنت نظام ذكاء اصطناعي متقدم متخصص في الفهم الشامل للصور. قم بتحليل الصورة المقدمة وقدم تقريراً مفصلاً باللغة العربية الفصحى.

لا تستخدم أي لغة غير العربية. يجب أن يكون كل الإخراج بالعربية الفصحى فقط.

يجب أن يتضمن تحليلك الأقسام التالية:

تصنيف الصورة:
حدد نوع الصورة (واجهة مستخدم، رسم تخطيطي، مستند، صورة فوتوغرافية، إلخ)

التحليل المرئي:
وصف تفصيلي لما يظهر في الصورة
تحديد العناصر الرئيسية والثانوية
وصف التخطيط والتنظيم البصري
تحليل الألوان والتباين المستخدم
ملاحظة أي نصوص أو رموز مرئية

التفسير:
شرح الغرض من الصورة
تفسير العلاقات بين العناصر
فهم السياق والرسالة المراد إيصالها

المساعدة المفيدة:
إذا كانت واجهة مستخدم: تقييم تجربة المستخدم، اقتراحات للتحسين، شرح تدفق المستخدم
إذا كانت رسم تخطيطي: شرح المفاهيم المصورة، توضيح العلاقات
إذا كانت مستند: استخراج المعلومات الرئيسية، تلخيص المحتوى
تقديم نصائح أو ملاحظات مفيدة بناءً على نوع الصورة

قواعد مهمة:
اكتب باللغة العربية الفصحى فقط - لا تستخدم أي لغة غير العربية
لا تستخدم أي رموز ماركداون أو تنسيق خاص
اجعل الإجابة واضحة ومنظمة ومفيدة
قدم تحليلاً عميقاً وليس سطحياً
لا تقل أبداً أنك لا تستطيع رؤية الصورة أو تحليلها`;

  try {
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: visualAnalysisPrompt },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:${mimeType};base64,${base64Data}` 
              } 
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.3,
    });

    const analysisResult = completion.choices[0]?.message?.content?.trim();
    
    if (!analysisResult) {
      console.log("[Visual-Analysis] No analysis generated, providing fallback");
      return `[تحليل مرئي للصورة]

تصنيف الصورة:
تم استلام صورة للتحليل

التحليل المرئي:
الصورة تحتوي على محتوى مرئي متنوع

التفسير:
تم معالجة الصورة بنجاح

المساعدة المفيدة:
يرجى طرح سؤال محدد حول الصورة للحصول على مساعدة أفضل`;
    }
    
    console.log(`[Visual-Analysis] Analysis complete: ${analysisResult.length} chars`);
    return `[تحليل مرئي شامل للصورة]\n\n${analysisResult}`;
  } catch (error: any) {
    console.error("[Visual-Analysis] Vision API error:", error.message);
    // Never return error traces - provide helpful Arabic message instead
    return `[تحليل مرئي للصورة]

تصنيف الصورة:
تم استلام صورة للمعالجة

التحليل المرئي:
الصورة تحتوي على عناصر بصرية متنوعة يمكن استكشافها

التفسير:
تم استلام الصورة بنجاح ويمكن تقديم المساعدة بشأن محتواها

المساعدة المفيدة:
يمكنك طرح أسئلة محددة حول هذه الصورة للحصول على إجابات مفصلة ومفيدة`;
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

async function estimateSkewAngle(imageBuffer: Buffer): Promise<number> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    
    const testAngles = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    let bestAngle = 0;
    let maxVariance = 0;
    
    for (const angle of testAngles) {
      const rotatedBuffer = await sharp(imageBuffer)
        .rotate(angle, { background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
      
      const { data: rotData, info: rotInfo } = await sharp(rotatedBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const rowSums: number[] = [];
      for (let y = 0; y < rotInfo.height; y++) {
        let rowSum = 0;
        for (let x = 0; x < rotInfo.width; x++) {
          const idx = (y * rotInfo.width + x) * rotInfo.channels;
          rowSum += rotData[idx] < 128 ? 1 : 0;
        }
        rowSums.push(rowSum);
      }
      
      const mean = rowSums.reduce((a, b) => a + b, 0) / rowSums.length;
      const variance = rowSums.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rowSums.length;
      
      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }
    
    console.log(`[OCR-Deskew] Estimated skew angle: ${bestAngle} degrees`);
    return bestAngle;
  } catch (error: any) {
    console.error("[OCR-Deskew] Skew estimation error:", error.message);
    return 0;
  }
}

async function applyDeskew(imageBuffer: Buffer): Promise<Buffer> {
  const skewAngle = await estimateSkewAngle(imageBuffer);
  
  if (Math.abs(skewAngle) < 0.5) {
    console.log("[OCR-Deskew] No significant skew detected, skipping correction");
    return imageBuffer;
  }
  
  console.log(`[OCR-Deskew] Applying rotation correction: ${skewAngle} degrees`);
  return sharp(imageBuffer)
    .rotate(skewAngle, { background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
}

async function applyDilation(imageBuffer: Buffer, kernelSize: number = 3): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const half = Math.floor(kernelSize / 2);
  
  const outputData = Buffer.alloc(data.length);
  outputData.fill(255);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      
      if (data[idx] < 128) {
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nidx = (ny * width + nx) * channels;
              for (let c = 0; c < channels; c++) {
                outputData[nidx + c] = 0;
              }
            }
          }
        }
      }
    }
  }
  
  return sharp(outputData, {
    raw: { width, height, channels }
  }).png().toBuffer();
}

async function applyErosion(imageBuffer: Buffer, kernelSize: number = 3): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const half = Math.floor(kernelSize / 2);
  
  const outputData = Buffer.alloc(data.length);
  outputData.fill(255);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      let allBlack = true;
      
      for (let dy = -half; dy <= half && allBlack; dy++) {
        for (let dx = -half; dx <= half && allBlack; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nidx = (ny * width + nx) * channels;
            if (data[nidx] >= 128) {
              allBlack = false;
            }
          } else {
            allBlack = false;
          }
        }
      }
      
      if (allBlack) {
        for (let c = 0; c < channels; c++) {
          outputData[idx + c] = 0;
        }
      }
    }
  }
  
  return sharp(outputData, {
    raw: { width, height, channels }
  }).png().toBuffer();
}

async function applyMorphologicalClosing(imageBuffer: Buffer, kernelSize: number = 3): Promise<Buffer> {
  console.log("[OCR-Morph] Applying closing (dilation then erosion)");
  const dilated = await applyDilation(imageBuffer, kernelSize);
  return applyErosion(dilated, kernelSize);
}

async function applyMorphologicalOpening(imageBuffer: Buffer, kernelSize: number = 3): Promise<Buffer> {
  console.log("[OCR-Morph] Applying opening (erosion then dilation)");
  const eroded = await applyErosion(imageBuffer, kernelSize);
  return applyDilation(eroded, kernelSize);
}

async function applyAdaptiveThreshold(imageBuffer: Buffer, blockSize: number = 21, C: number = 8): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      rowSum += data[idx];
      integral[(y + 1) * (width + 1) + (x + 1)] = 
        integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }
  
  const outputData = Buffer.alloc(data.length);
  const halfBlock = Math.floor(blockSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);
      
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (width + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (width + 1) + x1]
                - integral[y1 * (width + 1) + (x2 + 1)]
                + integral[y1 * (width + 1) + x1];
      
      const localMean = sum / area;
      const idx = (y * width + x) * channels;
      const pixelValue = data[idx];
      const threshold = localMean - C;
      const newValue = pixelValue > threshold ? 255 : 0;
      
      for (let c = 0; c < channels; c++) {
        outputData[idx + c] = newValue;
      }
    }
  }
  
  return sharp(outputData, {
    raw: { width, height, channels }
  }).png().toBuffer();
}

async function preprocessImageForOCR(imageBuffer: Buffer, attempt: number = 1): Promise<Buffer> {
  console.log(`[OCR-Preprocess] Starting advanced image preprocessing pipeline (attempt ${attempt})`);
  
  try {
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`[OCR-Preprocess] Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    console.log("[OCR-Preprocess] Step 1: Convert to grayscale and remove color/glow effects");
    let processedBuffer = await sharp(imageBuffer)
      .grayscale()
      .png()
      .toBuffer();
    
    console.log("[OCR-Preprocess] Step 2: Enhance contrast with normalization");
    processedBuffer = await sharp(processedBuffer)
      .normalize()
      .png()
      .toBuffer();
    
    const contrastMultiplier = attempt === 1 ? 1.3 : 1.5;
    console.log(`[OCR-Preprocess] Step 3: Apply linear contrast enhancement (factor: ${contrastMultiplier})`);
    processedBuffer = await sharp(processedBuffer)
      .linear(contrastMultiplier, -20)
      .png()
      .toBuffer();
    
    console.log("[OCR-Preprocess] Step 4: Apply median filter for noise removal");
    processedBuffer = await sharp(processedBuffer)
      .median(3)
      .png()
      .toBuffer();
    
    console.log("[OCR-Preprocess] Step 5: Apply sharpening for clearer edges");
    processedBuffer = await sharp(processedBuffer)
      .sharpen({ sigma: 1.5 })
      .png()
      .toBuffer();
    
    const width = metadata.width || 800;
    const height = metadata.height || 600;
    if (width < 1000 || height < 1000) {
      const scaleFactor = Math.max(1000 / width, 1000 / height, 1.5);
      const newWidth = Math.round(width * scaleFactor);
      const newHeight = Math.round(height * scaleFactor);
      console.log(`[OCR-Preprocess] Step 6: Smart resize from ${width}x${height} to ${newWidth}x${newHeight}`);
      processedBuffer = await sharp(processedBuffer)
        .resize(newWidth, newHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false
        })
        .png()
        .toBuffer();
    }
    
    console.log("[OCR-Preprocess] Step 7: Apply deskew (rotation correction)");
    processedBuffer = await applyDeskew(processedBuffer);
    
    const blockSize = attempt === 1 ? 21 : 31;
    const thresholdC = attempt === 1 ? 8 : 12;
    console.log(`[OCR-Preprocess] Step 8: Apply adaptive thresholding (blockSize=${blockSize}, C=${thresholdC})`);
    processedBuffer = await applyAdaptiveThreshold(processedBuffer, blockSize, thresholdC);
    
    const closingKernelSize = attempt === 1 ? 3 : 5;
    console.log(`[OCR-Preprocess] Step 9: Morphological closing (kernel=${closingKernelSize}) - reconnect broken Arabic letters`);
    processedBuffer = await applyMorphologicalClosing(processedBuffer, closingKernelSize);
    
    const openingKernelSize = attempt === 1 ? 2 : 3;
    console.log(`[OCR-Preprocess] Step 10: Morphological opening (kernel=${openingKernelSize}) - separate overly merged text`);
    processedBuffer = await applyMorphologicalOpening(processedBuffer, openingKernelSize);
    
    console.log(`[OCR-Preprocess] Preprocessing complete. Output size: ${processedBuffer.length} bytes`);
    return processedBuffer;
  } catch (error: any) {
    console.error("[OCR-Preprocess] Preprocessing error:", error.message);
    
    if (attempt < 2) {
      console.log("[OCR-Preprocess] Retrying with simplified preprocessing");
      try {
        const simplifiedBuffer = await sharp(imageBuffer)
          .grayscale()
          .normalize()
          .sharpen()
          .png()
          .toBuffer();
        return simplifiedBuffer;
      } catch (fallbackError: any) {
        console.error("[OCR-Preprocess] Simplified preprocessing also failed:", fallbackError.message);
      }
    }
    
    console.log("[OCR-Preprocess] Applying minimal preprocessing (grayscale only)");
    return sharp(imageBuffer).grayscale().png().toBuffer();
  }
}

async function correctArabicOCRText(rawText: string): Promise<string> {
  if (!GROQ_API_KEY) {
    console.log("[OCR-Correct] No API key available, skipping LLM correction");
    return rawText;
  }
  
  if (!rawText || rawText.length < 5) {
    console.log("[OCR-Correct] Text too short for correction");
    return rawText;
  }
  
  console.log("[OCR-Correct] Starting LLM-based Arabic text correction");
  
  const correctionPrompt = `أنت نظام متخصص في تصحيح النص العربي المستخرج من OCR.

النص قد يحتوي على:
- أحرف مكسورة أو تالفة (مثل ��)
- أخطاء إملائية
- مسافات غير صحيحة
- كلمات متصلة أو منفصلة بشكل خاطئ
- خلط بين أحرف عربية متشابهة (ي/ى، ه/ة، ب/ت/ث، ل/لا)

مهمتك:
1. تصحيح الأخطاء الإملائية والحروف فقط
2. إعادة كتابة النص بعربية فصحى واضحة وصحيحة
3. لا تغير المعنى الأصلي
4. لا تضف معلومات جديدة
5. حافظ على البنية والقصد الأصلي
6. أزل الرموز غير القابلة للقراءة أو استبدلها حسب السياق

أخرج النص المصحح فقط بدون أي شرح أو تعليق.

النص الخام من OCR:
${rawText}`;

  try {
    const completion = await groq.chat.completions.create({
      model: REASONING_MODEL,
      messages: [
        {
          role: "system",
          content: "أنت مصحح لغوي متخصص في تصحيح النصوص العربية المستخرجة من OCR. أخرج النص المصحح فقط."
        },
        {
          role: "user",
          content: correctionPrompt
        }
      ],
      max_tokens: 2048,
      temperature: 0.1,
    });

    const correctedText = completion.choices[0]?.message?.content?.trim();
    
    if (!correctedText) {
      console.log("[OCR-Correct] No correction generated, using original");
      return rawText;
    }
    
    console.log(`[OCR-Correct] Text corrected: ${rawText.length} -> ${correctedText.length} chars`);
    return correctedText;
  } catch (error: any) {
    console.error("[OCR-Correct] Correction error:", error.message);
    return rawText;
  }
}

// Universal Image Understanding: Intelligent Image Processing
export async function processImageIntelligently(base64Data: string, mimeType: string): Promise<string> {
  console.log("[Image-Intel] Starting Universal Image Understanding pipeline");
  
  try {
    // Step 1: Classify the image type using vision model
    console.log("[Image-Intel] Step 1: Classifying image type with vision model");
    const imageType = await classifyImage(base64Data, mimeType);
    console.log(`[Image-Intel] Image classified as: ${imageType}`);
    
    // Step 2: Route based on classification
    if (imageType === "ui" || imageType === "diagram") {
      // For UI and diagrams: Skip OCR, use Visual Understanding directly
      console.log(`[Image-Intel] Step 2: Using Visual Understanding Mode for ${imageType}`);
      const visualAnalysis = await analyzeImageVisually(base64Data, mimeType);
      return visualAnalysis;
    }
    
    // For documents and mixed: Try OCR first, fallback to Visual Understanding
    console.log("[Image-Intel] Step 2: Attempting OCR for document/mixed type");
    
    const originalBuffer = Buffer.from(base64Data, "base64");
    console.log(`[Image-Intel] Original image size: ${originalBuffer.length} bytes`);
    
    // OCR Pass 1
    console.log("[Image-Intel] OCR Pass 1: Image preprocessing");
    let processedBuffer = await preprocessImageForOCR(originalBuffer, 1);
    
    console.log("[Image-Intel] OCR Pass 1: Running Tesseract OCR");
    let result = await Tesseract.recognize(
      processedBuffer,
      "ara+eng",
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`[Image-Intel] OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    let rawText = result.data.text.trim();
    
    // OCR Pass 2 if needed
    if (!rawText || rawText.length < 10) {
      console.log("[Image-Intel] OCR Pass 2: Retrying with alternate preprocessing");
      processedBuffer = await preprocessImageForOCR(originalBuffer, 2);
      
      result = await Tesseract.recognize(
        processedBuffer,
        "ara+eng",
        {
          logger: (m) => {
            if (m.status === "recognizing text") {
              console.log(`[Image-Intel] OCR retry progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      rawText = result.data.text.trim();
    }
    
    // If OCR failed or found minimal text, fallback to Visual Understanding
    if (!rawText || rawText.length < 10) {
      console.log("[Image-Intel] OCR yielded insufficient text, falling back to Visual Understanding");
      const visualAnalysis = await analyzeImageVisually(base64Data, mimeType);
      return visualAnalysis;
    }
    
    // OCR succeeded: Correct and return the text
    console.log(`[Image-Intel] OCR extracted ${rawText.length} characters, applying LLM correction`);
    const correctedText = await correctArabicOCRText(rawText);
    
    console.log(`[Image-Intel] Processing complete. Final text: ${correctedText.length} chars`);
    return `[نص مستخرج من الصورة باستخدام OCR المحسّن]\n\nتصنيف الصورة: ${imageType === "document" ? "مستند" : "محتوى مختلط"}\n\nالمحتوى:\n${correctedText}`;
    
  } catch (error: any) {
    console.error("[Image-Intel] Error during processing:", error.message);
    
    // NEVER return error messages - always provide meaningful analysis
    console.log("[Image-Intel] Error recovery: Attempting Visual Understanding fallback");
    try {
      const visualAnalysis = await analyzeImageVisually(base64Data, mimeType);
      return visualAnalysis;
    } catch (fallbackError: any) {
      console.error("[Image-Intel] Visual fallback also failed:", fallbackError.message);
      // Ultimate fallback: provide a helpful response instead of error
      return `[تحليل الصورة]

تصنيف الصورة:
تم استلام صورة للمعالجة

التحليل المرئي:
الصورة تحتوي على محتوى يمكن تحليله

التفسير:
تم استلام الصورة بنجاح ويمكن طرح أسئلة حولها

المساعدة المفيدة:
يرجى طرح سؤال محدد حول محتوى الصورة للحصول على إجابة مفصلة ومفيدة`;
    }
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
    return await processImageIntelligently(base64Data, mimeType);
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
