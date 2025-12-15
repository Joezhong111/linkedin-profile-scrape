import { GoogleGenAI } from "@google/genai";
import { LinkedInProfile } from "../types";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
});

export const analyzeProfile = async (
  profile: LinkedInProfile
): Promise<string> => {
  const prompt = `
    Analyze this LinkedIn profile data and provide a professional executive summary.
    Highlight their top skills, key career achievements, and suggest potential conversation starters for networking.
    
    Data:
    Name: ${profile.full_name}
    Headline: ${profile.headline}
    About: ${profile.about}
    Recent Role: ${profile.raw_data?.positions?.[0]?.title} at ${profile.raw_data?.positions?.[0]?.companyName}
    
    Response format:
    - **Summary**: (2-3 sentences)
    - **Key Strengths**: (bullet points)
    - **Outreach Tip**: (how to approach them)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "AI analysis failed.";
  }
};
