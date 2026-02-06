
import { GoogleGenAI, Type } from "@google/genai";

export const getCreativeVariations = async (baseTexts: string[], count: number): Promise<string[]> => {
  // 优先级：1. 用户在 UI 手动设置的 Key  2. 系统环境变量
  const manualKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
  const apiKey = manualKey || process.env.API_KEY;
  
  if (!apiKey || baseTexts.length === 0) {
    throw new Error("MISSING_KEY: API Key 缺失。请在【账号-AI服务配置】中设置您的 Gemini API Key。");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User provided reference text: [${baseTexts.join(', ')}]. 
      Please generate ${count} variations. 
      
      STRICT CONTEXT RULES:
      - THEME FIDELITY: Stay very close to the original context.
      - LENGTH LIMITS: Primary hook max 4 chars, description max 8 chars.
      - SAFETY: No marketing buzzwords like 'money', 'wealth', etc.
      - FORMAT: DO NOT include any brackets like (), [], {}, or symbols like 【】 in the generated text.
      - NO EXPLANATIONS: Provide only the copy text itself.
      
      Return as a clean JSON array of strings called 'variations'.`,
      config: {
        systemInstruction: "You are a professional copywriter. Maintain original context and character limits. Absolutely no brackets in results.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["variations"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"variations": []}');
    if (!data.variations || data.variations.length === 0) {
        return baseTexts;
    }
    return data.variations;
  } catch (error: any) {
    console.error("Gemini API 调用具体错误:", error);
    
    // 处理特定 API 错误
    const errorMsg = error.message || "";
    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      throw new Error("QUOTA_EXHAUSTED: 您的 Gemini API 额度已耗尽或请求过于频繁。请检查 Google AI Studio 账单或稍后再试。");
    } else if (errorMsg.includes("403") || errorMsg.includes("401") || errorMsg.includes("API_KEY_INVALID")) {
      throw new Error("INVALID_KEY: 提供的 API Key 无效或无权访问该模型。请重新在【账号】页面配置。");
    } else {
      throw new Error(`AI_ERROR: AI 服务暂时不可用 (${errorMsg})`);
    }
  }
};
