export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class MockMailService {
  private static sentMails: Array<MailOptions & { sentAt: Date; id: string }> = [];

  /**
   * Mock transport function simulating sending email via SMTP/API service
   */
  static async sendMail(options: MailOptions): Promise<{ success: boolean; messageId: string }> {
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      ...options,
      sentAt: new Date(),
      id: messageId
    };
    this.sentMails.push(record);

    console.log(`\n==================================================`);
    console.log(`✉️ [Mock Transport Service] Email Dispatch Log`);
    console.log(`🆔 Message ID: ${messageId}`);
    console.log(`📬 To: ${options.to}`);
    console.log(`📌 Subject: ${options.subject}`);
    if (options.text) {
      console.log(`💬 Content: ${options.text}`);
    }
    console.log(`==================================================\n`);

    return {
      success: true,
      messageId
    };
  }

  /**
   * Get list of sent messages for testing/debugging
   */
  static getSentMails() {
    return [...this.sentMails];
  }

  /**
   * Clear mail log history
   */
  static clearHistory() {
    this.sentMails = [];
  }
}
