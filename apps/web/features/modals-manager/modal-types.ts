import type * as React from "react";

import type { ModalMode } from "@/features/modals-manager/modal-shell";

export interface ModalSettings {
  modalId?: string;
  preventDuplicate?: boolean;
  onClose?: () => void;
  mode?: ModalMode;
  surfaceClassName?: string;
}

export interface OpenContextModal<
  TCustomProps extends Record<string, unknown> = Record<string, unknown>,
> extends ModalSettings {
  innerProps: TCustomProps;
}

export interface OpenCustomModal extends ModalSettings {
  children:
    | React.ReactNode
    /** `ctx` is the live modals manager API (narrow at call-site if needed). */
    | ((opts: { ctx: unknown }) => React.ReactNode);
}

export interface ModalStateContext {
  id: string;
  type: "context";
  props: OpenContextModal;
  ctx: string;
}

export interface ModalStateCustom {
  id: string;
  type: "custom";
  props: OpenCustomModal;
}

export type ModalState = ModalStateContext | ModalStateCustom;

/** Modal manager API exposed from provider and `context` prop. */
export interface ModalsProviderContextProps {
  modals: ModalState[];
  openContextModal: (
    modalKey: string,
    props: OpenContextModal & { modalId?: string; preventDuplicate?: boolean },
  ) => string;
  closeContextModal: (id: string) => void;
  closeAll: () => void;
  closeModal: (id: string) => void;
  isAnyModalOpen: () => boolean;
  openCustomModal: (payload: OpenCustomModal) => string;
}

export interface ContextModalProps<TInnerProps = Record<string, unknown>> {
  context: ModalsProviderContextProps;
  innerProps: TInnerProps;
  id: string;
  mode?: ModalMode;
}

/** Key → component lookup for context modals. */
export type RegisteredModals = Record<
  string,
  React.ComponentType<ContextModalProps<Record<string, unknown>>>
>;

export type RegisteredModalProps<TModal extends keyof RegisteredModals> =
  React.ComponentProps<RegisteredModals[TModal]>;
