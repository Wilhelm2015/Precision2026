
import { geminiService, NotificationEvent, EmailData } from './geminiService';

export interface WhatsAppMessage {
  id: string;
  from: string; 
  to: string;
  body: string;
  status: 'queued' | 'sending' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  type: string;
  directLink: string;
}

class WhatsAppService {
  private readonly SYSTEM_SENDER = '27686101310'; // Strictly requested business number

  public formatSouthAfricanNumber(phone: string): string {
    // Strip all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle international format
    if (cleaned.startsWith('27') && cleaned.length === 11) {
      return cleaned;
    }
    
    // Handle local format (e.g. 082...)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '27' + cleaned.substring(1);
    }
    
    // Handle 9-digit entry (e.g. 82...)
    if (cleaned.length === 9) {
      return '27' + cleaned;
    }
    
    return cleaned;
  }

  async sendBusinessNotification(event: NotificationEvent, data: EmailData, recipientPhone: string): Promise<WhatsAppMessage> {
    const formattedRecipient = this.formatSouthAfricanNumber(recipientPhone);
    console.log(`[PRECISION-FIRE-WA] Preparing dispatch for ${formattedRecipient} via Gateway...`);
    
    // Use Gemini to generate a SANS-compliant professional message
    const { body } = await geminiService.generateNotificationEmail(event, data);
    
    const message: WhatsAppMessage = {
      id: `wa.msg.${Math.random().toString(36).substr(2, 12)}`,
      from: `+${this.SYSTEM_SENDER}`,
      to: `+${formattedRecipient}`,
      body: body,
      status: 'sending',
      timestamp: new Date().toISOString(),
      type: event,
      directLink: `https://wa.me/${formattedRecipient}?text=${encodeURIComponent(body)}`
    };

    // Simulate Network Latency
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[GATEWAY-TX] Success: Message delivered to network provider for ${formattedRecipient}`);
        resolve({ ...message, status: 'delivered' });
      }, 1500);
    });
  }

  async sendDirectOTP(otp: string, recipientPhone: string): Promise<WhatsAppMessage> {
    const formattedRecipient = this.formatSouthAfricanNumber(recipientPhone);
    const body = `[Precision Fire Security] Your access code: ${otp}. Do not share this with anyone. SANS-AUTH-1475.`;
    
    const message: WhatsAppMessage = {
      id: `wa.otp.${Math.random().toString(36).substr(2, 12)}`,
      from: `+${this.SYSTEM_SENDER}`,
      to: `+${formattedRecipient}`,
      body: body,
      status: 'sending',
      timestamp: new Date().toISOString(),
      type: 'SECURITY_CODE',
      directLink: `https://wa.me/${formattedRecipient}?text=${encodeURIComponent(body)}`
    };

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...message, status: 'delivered' });
      }, 900);
    });
  }
}

export const whatsappService = new WhatsAppService();
