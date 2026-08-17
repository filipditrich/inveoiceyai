export {
  buildViaDisplay,
  emailFromFamily,
  getEmailTransport,
  getInboundCaptureAdapter,
  isEmailTransportConfigured,
  isValidEmailAddress,
  resolveEmailProviderId,
  resolveTransactionalFrom,
  sendTransactionalEmail,
  type EmailAttachment,
  type EmailFromFamily,
  type EmailTransport,
  type InboundCaptureAdapter,
  type ResolvedEmailFrom,
  type SendTransactionalEmailInput,
  type SendTransactionalEmailResult,
} from "./email";

export { buildViaDisplay as buildViaInvoiceyDisplayName } from "./email";
