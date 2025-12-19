
import { GoogleGenAI, Modality } from "@google/genai";

const CAR_CONTEXT = `
ROLL: Expertmekaniker för Peugeot.
FORDON: Peugeot Expert Panel Van 1.0t 1.6 HDi Manuell (2008), 90hk.
VIN: VF3XS9HUC64189021. REG: BER088.

STRUKTUR OCH STIL:
1. Svara ALLTID på svenska.
2. Var extremt kortfattad. Svara ENDAST på det användaren frågar efter. Ingen extra information eller bakgrund om det inte uttryckligen efterfrågas.
3. Använd monospaced formatering för tekniska värden.
4. Använd punktlistor (*) för specifikationer.
5. Inga hälsningar, inget "småprat", ingen avslutningsfras.
6. 100% teknisk precision krävs.

EXEMPEL PÅ FORMAT:
* **Glödstift:** 8-10 Nm.
* **Gänga:** M8x1.0.

VARNING: Om du inte är 100% säker på ett specifikt värde för BER088, säg "Data saknas".
`;

export async function getGeminiResponse(
  prompt: string, 
  history: { role: string, parts: { text: string }[] }[],
  imageMetadata?: { data: string, mimeType: string }
) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  try {
    const contents = [...history];
    const userParts: any[] = [{ text: prompt }];
    
    if (imageMetadata) {
      userParts.push({
        inlineData: imageMetadata
      });
    }
    
    contents.push({ role: 'user', parts: userParts });

    const model = 'gemini-3-pro-preview';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: CAR_CONTEXT,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let text = response.text || "";
    
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (grounding && grounding.length > 0) {
      text += "\n\n--- KÄLLOR ---\n" + grounding.map((c: any) => `- ${c.web?.title || 'Referens'}: ${c.web?.uri}`).join("\n");
    }

    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "SYSTEMFEL: Diagnostik avbruten.";
  }
}

export async function generateSpeech(text: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Läs upp detta tekniska svar tydligt på svenska: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    return null;
  }
}
