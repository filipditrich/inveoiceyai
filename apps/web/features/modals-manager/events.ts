"use client";

import { createUseExternalEvents } from "@/features/modals-manager/utils/create-use-external-events";
import type { OpenContextModal, OpenCustomModal } from "@/features/modals-manager/modal-types";

type ModalsEvents = {
  openModal: (payload: unknown) => void;
  openConfirmModal: (payload: unknown) => void;
  openContextModal: (payload: unknown) => void;
  closeModal: (payload: unknown) => void;
  closeAllModals: () => void;
  openCustomModal: (payload: unknown) => void;
};

const [useModalsEvents, createEvent] =
  createUseExternalEvents<ModalsEvents>("invoicey-modals");

export { useModalsEvents };

function nextModalId(explicit?: string): string {
  return (
    explicit ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `modal-${Math.random().toString(36).slice(2)}`)
  );
}

export function openModal(
  payload: OpenCustomModal & { modalId?: string },
): string {
  const id = nextModalId(payload.modalId);
  createEvent("openModal")({ ...payload, modalId: id });
  return id;
}

export function openConfirmModal(
  payload: OpenCustomModal & { modalId?: string },
): string {
  const id = nextModalId(payload.modalId);
  createEvent("openConfirmModal")({ ...payload, modalId: id });
  return id;
}

export function openContextModal(
  payload: OpenContextModal<Record<string, unknown>> & {
    modal: string;
    modalId?: string;
  },
): string {
  const id = nextModalId(payload.modalId);
  createEvent("openContextModal")({ ...payload, modalId: id });
  return id;
}

export function closeModal(payload: { modalId: string }): void {
  createEvent("closeModal")(payload);
}

export function closeAllModals(): void {
  createEvent("closeAllModals")();
}

export function openCustomModalEvent(
  payload: OpenCustomModal & { modalId?: string },
): string {
  const id = nextModalId(payload.modalId);
  createEvent("openCustomModal")({ ...payload, modalId: id });
  return id;
}
