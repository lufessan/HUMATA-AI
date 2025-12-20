import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-3-flash-preview";

interface ApiKeyState {
  key: string;
  isAvailable: boolean;
  lastUsed: number;
  failureCount: number;
  cooldownUntil: number;
}

class GeminiKeyManager {
  private keys: ApiKeyState[] = [];
  private currentIndex: number = 0;
  private readonly COOLDOWN_DURATION = 60000;
  private readonly MAX_FAILURES = 3;

  constructor() {
    this.loadKeys();
  }

  private loadKeys(): void {
    const keyEnvVars = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ];

    this.keys = keyEnvVars
      .filter((key): key is string => !!key && key.trim() !== "")
      .map((key) => ({
        key: key.trim(),
        isAvailable: true,
        lastUsed: 0,
        failureCount: 0,
        cooldownUntil: 0,
      }));

    if (this.keys.length === 0) {
      console.warn("╔════════════════════════════════════════════════════════════════╗");
      console.warn("║  [Gemini] WARNING: No API keys configured!                     ║");
      console.warn("║                                                                ║");
      console.warn("║  Image/file analysis features will NOT work.                   ║");
      console.warn("║  Please add GEMINI_API_KEY to your environment secrets.        ║");
      console.warn("║                                                                ║");
      console.warn("║  You can add up to 5 keys for rotation:                        ║");
      console.warn("║  GEMINI_API_KEY, GEMINI_API_KEY_2, ... GEMINI_API_KEY_5         ║");
      console.warn("╚════════════════════════════════════════════════════════════════╝");
    } else {
      console.log(`[Gemini] Loaded ${this.keys.length} API key(s) for rotation`);
      console.log(`[Gemini] Using model: ${GEMINI_MODEL} (Best for OCR & document analysis)`);
      
      if (this.keys.length === 1) {
        console.warn("[Gemini] TIP: Add more API keys (GEMINI_API_KEY_2, etc.) for better reliability");
      }
    }
  }

  getNextAvailableKey(): string | null {
    if (this.keys.length === 0) return null;

    const now = Date.now();
    
    for (let i = 0; i < this.keys.length; i++) {
      const keyState = this.keys[i];
      
      if (keyState.cooldownUntil > now) {
        continue;
      }

      if (keyState.cooldownUntil <= now && !keyState.isAvailable) {
        keyState.isAvailable = true;
        keyState.failureCount = 0;
        console.log(`[Gemini] Key ${i + 1} recovered from cooldown`);
      }

      if (keyState.isAvailable) {
        const timeSinceLastUse = now - keyState.lastUsed;
        if (timeSinceLastUse < 1000 && this.keys.length > 1) {
          continue;
        }
        
        keyState.lastUsed = now;
        this.currentIndex = i;
        return keyState.key;
      }
    }

    const oldestCooldown = this.keys.reduce((min, key) => 
      key.cooldownUntil < min ? key.cooldownUntil : min, 
      Infinity
    );
    
    if (oldestCooldown !== Infinity) {
      const waitTime = Math.max(0, oldestCooldown - now);
      console.warn(`[Gemini] All keys on cooldown. Earliest available in ${Math.ceil(waitTime / 1000)}s`);
    }

    return null;
  }

  markKeySuccess(key: string): void {
    const keyState = this.keys.find((k) => k.key === key);
    if (keyState) {
      keyState.failureCount = 0;
      keyState.isAvailable = true;
    }
  }

  markKeyFailure(key: string, error?: string): void {
    const keyState = this.keys.find((k) => k.key === key);
    if (keyState) {
      keyState.failureCount++;
      
      if (keyState.failureCount >= this.MAX_FAILURES) {
        keyState.isAvailable = false;
        keyState.cooldownUntil = Date.now() + this.COOLDOWN_DURATION;
        console.warn(`[Gemini] Key put on cooldown for ${this.COOLDOWN_DURATION / 1000}s (${keyState.failureCount} failures)`);
      }
      
      if (error?.includes("quota") || error?.includes("rate limit")) {
        keyState.isAvailable = false;
        keyState.cooldownUntil = Date.now() + this.COOLDOWN_DURATION * 2;
        console.warn(`[Gemini] Key quota exceeded, extended cooldown applied`);
      }
    }
  }

  getStatus(): { total: number; available: number; onCooldown: number } {
    const now = Date.now();
    const available = this.keys.filter((k) => k.isAvailable && k.cooldownUntil <= now).length;
    const onCooldown = this.keys.filter((k) => k.cooldownUntil > now).length;
    
    return {
      total: this.keys.length,
      available,
      onCooldown,
    };
  }

  hasKeys(): boolean {
    return this.keys.length > 0;
  }
}

const keyManager = new GeminiKeyManager();

interface GeminiClientResult {
  client: GoogleGenerativeAI;
  key: string;
}

function getGeminiClient(): GeminiClientResult | null {
  const key = keyManager.getNextAvailableKey();
  if (!key) return null;
  return { client: new GoogleGenerativeAI(key), key };
}

export function getGeminiKeyStatus() {
  return keyManager.getStatus();
}

export function hasGeminiKeys(): boolean {
  return keyManager.hasKeys();
}

export async function analyzeImageWithGemini(
  base64Data: string,
  mimeType: string,
  customPrompt?: string
): Promise<string> {
  const clientResult = getGeminiClient();
  
  if (!clientResult) {
    console.error("[Gemini] No available API keys");
    return `[تحليل الصورة]

عذراً، لم يتم تكوين مفتاح API لـ Gemini.
يرجى إضافة GEMINI_API_KEY إلى إعدادات البيئة للحصول على تحليل الصور والملفات.`;
  }

  const { client, key } = clientResult;
  console.log(`[Gemini] Analyzing image with ${GEMINI_MODEL}`);

  const prompt = customPrompt || `أنت نظام ذكاء اصطناعي متخصص في التحليل الشامل للصور بدقة عالية.

مهمتك الأساسية - حلل الصورة بشكل شامل:

1. التعرف على الأشخاص والشخصيات:
   - إذا كانت الصورة تحتوي على أشخاص حقيقيين، حاول التعرف عليهم إذا كانوا مشهورين
   - إذا كانت شخصيات كرتونية أو أنيمي، تعرف عليها واذكر اسمها والعمل الفني الذي تنتمي إليه
   - صف الأشخاص بالتفصيل: ملامحهم، ملابسهم، تعبيراتهم، وضعياتهم

2. تحليل المحتوى المرئي:
   - صف ما تراه في الصورة بالتفصيل
   - حدد الأماكن والخلفيات والعناصر المرئية
   - اذكر الألوان والتكوين الفني

3. قراءة النصوص (إذا وجدت):
   - اقرأ كل النص الموجود في الصورة بدقة
   - إذا كانت مسائل رياضية أو علمية، اقرأها بالكامل
   - حافظ على تنسيق النص الأصلي

4. التفسير والسياق:
   - اشرح ما يحدث في الصورة
   - قدم معلومات إضافية مفيدة عن الأشخاص أو الشخصيات المعروفة

قواعد مهمة:
- اكتب باللغة العربية الفصحى فقط
- لا تستخدم رموز ماركداون
- كن دقيقاً ومفصلاً في التحليل
- إذا تعرفت على شخص أو شخصية بثقة عالية، اذكر ذلك بوضوح
- إذا لم تكن متأكداً، قدم وصفاً تفصيلياً بدلاً من التخمين

الآن، حلل الصورة التالية بشكل شامل:`;

  try {
    const model = client.getGenerativeModel({ 
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    });

    const imagePart: Part = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    keyManager.markKeySuccess(key);
    console.log(`[Gemini] Analysis successful - ${text.length} chars`);
    
    return text;
  } catch (error: any) {
    console.error("[Gemini] Analysis error:", error.message);
    keyManager.markKeyFailure(key, error.message);

    const retryResult = getGeminiClient();
    if (retryResult && retryResult.key !== key) {
      console.log("[Gemini] Retrying with different key...");
      return analyzeImageWithGemini(base64Data, mimeType, customPrompt);
    }

    throw new Error(`فشل في تحليل الصورة: ${error.message}`);
  }
}

export async function analyzeDocumentWithGemini(
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const clientResult = getGeminiClient();
  
  if (!clientResult) {
    console.error("[Gemini] No available API keys");
    return `[تحليل المستند: ${fileName}]

عذراً، لم يتم تكوين مفتاح API لـ Gemini.`;
  }

  const { client, key } = clientResult;
  console.log(`[Gemini] Analyzing document: ${fileName}`);

  const prompt = `أنت نظام متخصص في قراءة المستندات والملفات. اقرأ المستند التالي بدقة واستخرج كل المحتوى النصي منه.

اسم الملف: ${fileName}

قواعد:
- اقرأ كل النص بدقة تامة
- حافظ على التنسيق والهيكل الأصلي
- إذا كان هناك جداول أو قوائم، حافظ على شكلها
- اكتب باللغة العربية الفصحى
- لا تستخدم رموز ماركداون

اقرأ المستند:`;

  try {
    const model = client.getGenerativeModel({ 
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    });

    const filePart: Part = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    const response = result.response;
    const text = response.text();

    keyManager.markKeySuccess(key);
    console.log(`[Gemini] Document analysis successful - ${text.length} chars`);
    
    return text;
  } catch (error: any) {
    console.error("[Gemini] Document analysis error:", error.message);
    keyManager.markKeyFailure(key, error.message);
    throw new Error(`فشل في تحليل المستند: ${error.message}`);
  }
}

export async function solveMathProblemWithGemini(
  base64Data: string,
  mimeType: string
): Promise<string> {
  const prompt = `أنت معلم رياضيات خبير. انظر إلى الصورة التالية التي تحتوي على مسألة رياضية.

مهمتك:
1. اقرأ المسألة بدقة تامة (كل الأرقام والرموز والمعادلات)
2. افهم المطلوب
3. قدم الحل خطوة بخطوة
4. اشرح كل خطوة بوضوح
5. قدم الإجابة النهائية

قواعد مهمة:
- اكتب باللغة العربية الفصحى
- لا تستخدم رموز ماركداون
- كن دقيقاً جداً في قراءة الأرقام
- إذا كانت المسألة غير واضحة، اذكر ذلك

الآن، اقرأ وحل المسألة:`;

  return analyzeImageWithGemini(base64Data, mimeType, prompt);
}
