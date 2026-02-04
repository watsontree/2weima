
import { GoogleGenAI, Type } from "@google/genai";

export const getCreativeVariations = async (baseTexts: string[], count: number): Promise<string[]> => {
  // 优先级：1. 用户在 UI 手动设置的 Key  2. 系统环境变量
  const manualKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
  const apiKey = manualKey || process.env.API_KEY;
  
  if (!apiKey || baseTexts.length === 0) {
    console.warn("API Key 缺失。请在【账号-AI服务配置】中设置您的 Gemini API Key。");
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(baseTexts[i % baseTexts.length]);
    }
    return results;
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
      
      Return as a clean JSON array of strings called 'variations'.`,
      config: {
        systemInstruction: "You are a professional copywriter. Maintain original context and character limits.",
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
    return data.variations && data.variations.length > 0 ? data.variations : baseTexts;
  } catch (error: any) {
    console.error("Gemini API 调用失败:", error);
    return baseTexts;
  }
};
