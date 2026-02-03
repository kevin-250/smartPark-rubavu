
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getParkingInsights = async (transactions: any[], stats: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Analyze the following parking data for SmartPark Rubavu:
        Stats: ${JSON.stringify(stats)}
        Recent Transactions: ${JSON.stringify(transactions.slice(-10))}
        
        Provide a brief (max 100 words) summary of performance and one actionable tip for efficiency.
      `,
      config: {
        temperature: 0.7,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at the moment. Please check your connection.";
  }
};
