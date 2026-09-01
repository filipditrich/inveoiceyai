export type {
  ContextModalProps,
  ModalSettings,
  ModalsProviderContextProps,
  OpenContextModal,
  OpenCustomModal,
  RegisteredModalProps,
  RegisteredModals,
  ModalState,
} from "@/features/modals-manager/modal-types";
export type { ModalMode } from "@/features/modals-manager/modal-shell";
export { ModalShell } from "@/features/modals-manager/modal-shell";
export {
  ModalsProvider,
  useModalsProviderContext,
} from "@/features/modals-manager/modals-provider";
export {
  closeAllModals,
  closeModal,
  openConfirmModal,
  openContextModal,
  openCustomModalEvent,
  openModal,
  useModalsEvents,
} from "@/features/modals-manager/events";
export { registeredModals } from "@/features/modals-manager/registered-modals";
