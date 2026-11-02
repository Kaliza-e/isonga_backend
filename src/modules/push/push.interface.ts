export interface PushDispatchResult {
  success: boolean;
  messageId: string;
  multicastCount: number;
  error?: string;
}

export interface PushProvider {
  readonly providerName: string;
  sendPush(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushDispatchResult>;
}

