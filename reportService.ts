
import { GoogleGenAI } from "@google/genai";

// Defining types for compliance notification events used by communication services
export type NotificationEvent = 
  | 'FAULT_LOGGED' 
  | 'FAULT_ASSIGNED' 
  | 'FAULT_RESOLVED' 
  | 'INSPECTION_COMPLETED' 
  | 'COC_ISSUED' 
  | 'MAINTENANCE_DUE' 
  | 'SECURITY_CODE';

// Defining data structure for contextual AI notification generation
export interface EmailData {
  clientName?: string;
  assetSerial?: string;
  assetType?: string;
  technicianName?: string;
  details?: string;
  date?: string;
}

export class GeminiService {
  /**
   * LOCKDOWN CONFIG:
   * temperature: 0 forces deterministic, literal technical responses.
   * topP/topK: 1 restricts sampling to the most likely technical tokens.
   * This ensures the AI behaves as a SANS regulation reference rather than a creative writer.
   */
  private readonly config = {
    temperature: 0,
    topP: 1,
    topK: 1
  };

  // Fetches regulatory advice using Google Search grounding to ensure up-to-date SANS information
  async getRegulationAdvice(query: string) {
    try {
      // Fix: Initialized GoogleGenAI with process.env.GEMINI_API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `As a South African fire safety consultant, answer this query about SANS (South African National Standards) regulations for fire equipment: ${query}. Focus on SANS 1475, SANS 10105, and SANS 10139. Keep the tone professional, literal, and concise.`,
        config: {
          ...this.config,
          tools: [{ googleSearch: {} }],
        }
      });
      
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      return {
        text: response.text || "No specific advice found for your query.",
        sources: sources as any[]
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return {
        text: "I'm sorry, I couldn't retrieve SANS regulatory advice at this moment. Please refer to your physical SANS handbook.",
        sources: []
      };
    }
  }

  // Explains a specific SANS checklist item to a technician
  async explainChecklistItem(assetType: string, label: string, description: string) {
    try {
      // Fix: Initialized GoogleGenAI with process.env.GEMINI_API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain the technical and regulatory requirement for this fire equipment checklist item in South Africa:
        Asset: ${assetType}
        Checklist Item: ${label}
        Description: ${description}
        
        Reference SANS 1475 Part 1 or 2 where applicable. Explain what the technician should look for and why this item is critical for site safety. Keep it under 100 words.`,
        config: {
          ...this.config,
          tools: [{ googleSearch: {} }],
        }
      });
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return {
        text: response.text || "Standard safety check as per SANS 1475 protocol.",
        sources: sources as any[]
      };
    } catch (error) {
      return {
        text: "Unable to fetch AI guidance. Please follow standard SANS 1475 physical inspection procedures.",
        sources: []
      };
    }
  }

  // Generates a formal decommissioning justification based on SANS 1475
  async generateDiscardJustification(assetType: string, manufacturer: string, reason: string) {
    try {
      // Fix: Initialized GoogleGenAI with process.env.GEMINI_API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a formal, technical justification for the permanent decommissioning and scrapping of a ${assetType} manufactured by ${manufacturer}. The reason identified is: ${reason}. 
        Reference SANS 1475 Part 1 & 2 requirements regarding accredited certification marks and vessel integrity. 
        Tone: Regulatory, strict, and professional. One paragraph.`,
        config: this.config
      });
      return response.text || "Asset fails to meet the minimum safety requirements set out in SANS 1475. Maintenance is prohibited on unapproved vessels.";
    } catch (error) {
      return "Asset fails to meet SANS 1475 certification requirements and has been condemned to ensure site safety.";
    }
  }

  // Uses Google Search to resolve GPS coordinates to a valid South African physical address
  async reverseGeocode(lat: number, lng: number) {
    try {
      // Fix: Initialized GoogleGenAI with process.env.GEMINI_API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `What is the exact street address for the location at GPS coordinates: Latitude ${lat}, Longitude ${lng}? Return only the formatted South African street address.`,
        config: {
          ...this.config,
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Address not found.";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { text, sources: sources as any[] };
    } catch (error) {
      console.error("Address Detection Error:", error);
      throw error;
    }
  }

  // Generates professional business messages for WhatsApp notifications tailored to the South African fire safety market
  async generateNotificationEmail(event: NotificationEvent, data: EmailData) {
    try {
      // Fix: Initialized GoogleGenAI with process.env.GEMINI_API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as the official automated communication system for Precision Fire Services (South Africa). 
        Generate a professional, high-trust WhatsApp message for the following event: ${event}.
        Site/Client Details: ${JSON.stringify(data)}.
        
        Guidelines:
        - Maintain SANS 1475 regulatory tone.
        - Be concise but reassuring.
        - Reference the asset serial number clearly if provided.
        - Tone should be informative and business-standard.
        
        Return ONLY the text content of the message.`,
        config: this.config,
      });
      return { body: response.text || "Precision Fire: Asset status updated in registry." };
    } catch (error) {
      console.error("Gemini Notification Error:", error);
      return { body: "Precision Fire: Update regarding your site's fire equipment registry." };
    }
  }
}

export const geminiService = new GeminiService();