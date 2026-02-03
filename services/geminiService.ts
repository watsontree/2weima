
import { GoogleGenAI, Type } from "@google/genai";

// Initialize GoogleGenAI correctly using named parameter and process.env.API_KEY directly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const getCreativeVariations = async (baseTexts: string[], count: number): Promise<string[]> => {
  if (!process.env.API_KEY || baseTexts.length === 0) {
    // Fallback: simple shuffling/duplication if no API key
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(baseTexts[i % baseTexts.length]);
    }
    return results;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User provided reference text: [${baseTexts.join(', ')}]. 
      Please generate ${count} variations. 
      
      STRICT CONTEXT RULES:
      - THEME FIDELITY: You must stay very close to the original meaning and context provided by the user. Do NOT invent new topics or themes. (内容范围要根据提示词来，不能偏离过大).
      - REALISM: Keep group names (群聊名称) sounding like real, professional community groups. Avoid exaggerated or "clickbaity" modifications.
      - STRUCTURE: Maintain a similar format to the reference (e.g., "Category: Name" or "Group Name").
      - LENGTH LIMITS: 
        1. Primary hook (left side/prefix): Max 4 characters.
        2. Description/Details (right side/suffix): Max 8 characters.
      - SAFETY: Strictly zero-tolerance for terms like 'making money' (赚钱), 'wealth' (财富), 'invest' (投资), 'profit' (盈利), or 'part-time' (兼职).
      - COMPLIANCE: Must adhere to Xiaohongshu community guidelines.
      
      Return as a clean JSON array of strings called 'variations'.`,
      config: {
        systemInstruction: "You are a professional copywriter. Your task is to provide close variations of user-provided text while staying strictly within the original context. You must respect character limits (4/8) and avoid banned marketing keywords.",
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
    // Ensure we don't return empty list if API fails to follow schema
    return data.variations && data.variations.length > 0 ? data.variations : baseTexts;
  } catch (error) {
    console.error("Gemini Error:", error);
    return baseTexts;
  }
};
