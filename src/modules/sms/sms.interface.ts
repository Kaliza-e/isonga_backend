export interface SmsDispatchResult {
  success: boolean;
  messageId: string;
  provider: string;
  rawResponse?: any;
  error?: string;
}

export interface SmsProvider {
  readonly providerName: string;
  sendSms(to: string, message: string): Promise<SmsDispatchResult>;
}

