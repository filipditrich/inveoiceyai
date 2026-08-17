export {
  buildViaDisplay,
  emailFromFamily,
  isValidEmailAddress,
  resolveTransactionalFrom,
  type EmailFromFamily,
  type ResolvedEmailFrom,
} from "./from";
export {
  parseResendDeliveryEvent,
  parseResendDeliveryEventType,
  type ResendDeliveryWebhookPayload,
} from "./resend-delivery";
export {
  createResendInboundCaptureAdapter,
  parseResendInboundEvent,
} from "./resend-inbound";
export { createResendEmailTransport } from "./resend-transport";
export {
  getEmailTransport,
  getInboundCaptureAdapter,
  isEmailTransportConfigured,
  resolveEmailProviderId,
} from "./resolve";
export {
  sendTransactionalEmail,
  type SendTransactionalEmailInput,
  type SendTransactionalEmailResult,
} from "./send";
export type {
  EmailAttachment,
  EmailDeliveryEventKind,
  EmailProviderId,
  EmailTransport,
  EmailTransportSendInput,
  EmailTransportSendResult,
  InboundAttachment,
  InboundCaptureAdapter,
  InboundReceivedEmail,
  NormalizedEmailDeliveryEvent,
  NormalizedInboundNotification,
} from "./types";
export { EMAIL_PROVIDERS } from "./types";
