export type HostedPaymentRequest = {
  amountMinor: number;
  currency: "HKD";
  reference: string;
};

export type HostedPaymentResult = {
  status: "disabled";
};

export interface PaymentProvider {
  createHostedRequest(
    input: HostedPaymentRequest,
  ): Promise<HostedPaymentResult>;
}

export class PaymentProviderUnavailableError extends Error {
  readonly code = "PAYMENT_DISABLED";

  constructor() {
    super("Payment is disabled.");
    this.name = "PaymentProviderUnavailableError";
  }
}

class DisabledPaymentProvider implements PaymentProvider {
  createHostedRequest(): Promise<HostedPaymentResult> {
    return Promise.reject(new PaymentProviderUnavailableError());
  }
}

export function createPaymentProvider(): PaymentProvider {
  return new DisabledPaymentProvider();
}
