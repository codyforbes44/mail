import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function summarizeEmail(body: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize the following email concisely:\n\n${body}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error summarizing email:", error);
    return "Failed to summarize email.";
  }
}

export async function generateSmartReply(body: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, professional reply to the following email:\n\n${body}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating smart reply:", error);
    return "Failed to generate reply.";
  }
}

export async function draftEmailWithThinking(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Draft a professional email based on the following request:\n\n${prompt}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error drafting email:", error);
    return "Failed to draft email.";
  }
}

export async function searchWebForContext(query: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search the web for information related to: ${query}. Provide a brief summary of the findings.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return {
      text: response.text,
      sources: chunks ? chunks.map(c => c.web?.uri).filter(Boolean) : []
    };
  } catch (error) {
    console.error("Error searching web:", error);
    return { text: "Failed to search web.", sources: [] };
  }
}

export async function findPlacesMentioned(body: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find places mentioned in the following text and provide information about them:\n\n${body}`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return {
      text: response.text,
      sources: chunks ? chunks.map(c => c.maps?.uri).filter(Boolean) : []
    };
  } catch (error) {
    console.error("Error finding places:", error);
    return { text: "Failed to find places.", sources: [] };
  }
}
