
import { GoogleGenAI } from "@google/genai";

export const generateT2IImage = async (
  prompt: string, 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
): Promise<string> => {
  const manualKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
  const apiKey = manualKey || "gen-lang-client-0165996656"; // 使用内置或手动输入的 Key

  const ai = new GoogleGenAI({ apiKey });

  // 小红书审美增强 Prompt
  const enhancedPrompt = `High-aesthetic Xiaohongshu style marketing image. 
  Vibrant, professional, trendy, social media friendly, exquisite lighting, soft shadows.
  Clean layout, premium look.
  Theme/Topic: ${prompt}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: enhancedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    // 查找并返回图像数据
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("模型未返回图像数据");
  } catch (error) {
    console.error("文生图 API 错误:", error);
    throw error;
  }
};
