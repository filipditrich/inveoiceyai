"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useModalsEvents } from "@/features/modals-manager/events";
import { ModalShell } from "@/features/modals-manager/modal-shell";
import type {
  ContextModalProps,
  ModalState,
  ModalStateContext,
  ModalStateCustom,
  ModalsProviderContextProps,
  OpenContextModal,
  OpenCustomModal,
  RegisteredModals,
} from "@/features/modals-manager/modal-types";

export type { ContextModalProps, RegisteredModals };

const ModalsProviderContext =
  React.createContext<ModalsProviderContextProps | undefined>(undefined);

export function useModalsProviderContext(): ModalsProviderContextProps {
  const ctx = React.useContext(ModalsProviderContext);
  if (!ctx)
    throw new Error(
      "useModalsProviderContext must be used within ModalsProvider",
    );
  return ctx;
}

export interface ModalsProviderProps extends React.PropsWithChildren {
  modals: RegisteredModals;
  modalDefaults?: Omit<OpenCustomModal, "children" | "modalId">;
}

const ANIM_MS = 300;

export function ModalsProvider(props: ModalsProviderProps) {
  const { children, modals, modalDefaults } = props;

  const [modalSlots, setModalSlots] = React.useState<ModalState[]>([]);
  const [closingIds, setClosingIds] = React.useState(() => new Set<string>());
  const closingRef = React.useRef<Set<string>>(new Set<string>());

  React.useLayoutEffect(() => {
    closingRef.current = closingIds;
  }, [closingIds]);

  const timeouts = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function makeId(existing?: string): string {
    return (
      existing ??
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `modal-${Math.random().toString(36).slice(2)}`)
    );
  }

  const clearTimerFor = React.useCallback((id: string) => {
    const timer = timeouts.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timeouts.current.delete(id);
    }
  }, []);

  const finalizeRemove = React.useCallback((id: string) => {
    setModalSlots((slots) => {
      const ix = slots.findIndex((s) => s.id === id);
      if (ix === -1) return slots;
      const removed = slots[ix];
      removed?.props.onClose?.();

      const nextClosing = new Set(closingRef.current);
      nextClosing.delete(id);
      closingRef.current = nextClosing;
      setClosingIds(nextClosing);

      return slots.filter((_, i) => i !== ix);
    });
  }, []);

  const scheduleRemoveAfterClose = React.useCallback(
    (id: string) => {
      clearTimerFor(id);
      timeouts.current.set(
        id,
        setTimeout(() => {
          timeouts.current.delete(id);
          finalizeRemove(id);
        }, ANIM_MS),
      );
    },
    [clearTimerFor, finalizeRemove],
  );

  const scheduleCloseModal = React.useCallback(
    (id: string) => {
      scheduleRemoveAfterClose(id);
      setClosingIds((prev) => {
        const next = new Set(prev).add(id);
        closingRef.current = next;
        return next;
      });
    },
    [scheduleRemoveAfterClose],
  );

  const closeAll = React.useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current.clear();

    setModalSlots((slots) => {
      const ids = slots.map((s) => s.id);
      const nextClosing = new Set(ids);
      closingRef.current = nextClosing;
      setClosingIds(nextClosing);

      ids.forEach((id) => {
        timeouts.current.set(
          id,
          setTimeout(() => {
            timeouts.current.delete(id);
            finalizeRemove(id);
          }, ANIM_MS),
        );
      });

      return slots;
    });
  }, [finalizeRemove]);

  const enqueueCustomModal = React.useCallback(
    (payload: OpenCustomModal): string => {
      const modalId = makeId(payload.modalId);
      const nextPayload = { ...payload, modalId };
      setModalSlots((prev) => [
        ...prev,
        { id: modalId, type: "custom", props: nextPayload } satisfies ModalStateCustom,
      ]);
      return modalId;
    },
    [],
  );

  const enqueueContextModal = React.useCallback(
    (modalKey: string, params: Omit<OpenContextModal, "modalId"> & { modalId?: string }) => {
      const modalId = makeId(params.modalId);
      const preventDuplicate =
        params.preventDuplicate ?? modalDefaults?.preventDuplicate ?? true;

      setModalSlots((prev) => {
        if (
          preventDuplicate &&
          prev.some(
            (s) =>
              s.type === "context" &&
              s.ctx === modalKey &&
              !closingRef.current.has(s.id),
          )
        )
          return prev;

        const { modalId: _, ...rest } = params;

        return [
          ...prev,
          {
            id: modalId,
            type: "context",
            props: { ...rest, modalId },
            ctx: modalKey,
          } satisfies ModalStateContext,
        ];
      });

      return modalId;
    },
    [
      modalDefaults?.preventDuplicate,
    ],
  );

  const isAnyModalOpen = React.useCallback(
    () => modalSlots.some((s) => !closingIds.has(s.id)),
    [modalSlots, closingIds],
  );

  const ctxValue = React.useMemo<ModalsProviderContextProps>(
    () => ({
      modals: modalSlots,
      openContextModal: (key, incoming) =>
        enqueueContextModal(key, incoming),
      closeContextModal: scheduleCloseModal,
      closeAll,
      closeModal: scheduleCloseModal,
      isAnyModalOpen,
      openCustomModal: enqueueCustomModal,
    }),
    [
      modalSlots,
      enqueueContextModal,
      scheduleCloseModal,
      closeAll,
      isAnyModalOpen,
      enqueueCustomModal,
    ],
  );

  useModalsEvents({
    openModal: React.useCallback(
      (incoming: unknown) => {
        enqueueCustomModal(
          incoming as OpenCustomModal & { modalId: string },
        );
      },
      [enqueueCustomModal],
    ),
    openConfirmModal: React.useCallback(
      (incoming: unknown) => {
        enqueueCustomModal(
          incoming as OpenCustomModal & { modalId: string },
        );
      },
      [enqueueCustomModal],
    ),
    openContextModal: React.useCallback(
      (incoming: unknown) => {
        const typed = incoming as Record<string, unknown> & {
          modal: string;
          modalId?: string;
        };
        const { modal, modalId, ...incomingRest } = typed;
        enqueueContextModal(modal, {
          ...(incomingRest as Omit<OpenContextModal, "modalId">),
          ...(modalId ? { modalId: String(modalId) } : {}),
        });
      },
      [enqueueContextModal],
    ),
    closeModal: React.useCallback(
      (incoming: unknown) => {
        const payload = incoming as { modalId: string };
        scheduleCloseModal(payload.modalId);
      },
      [scheduleCloseModal],
    ),
    closeAllModals: React.useCallback(() => {
      closeAll();
    }, [closeAll]),
    openCustomModal: React.useCallback(
      (incoming: unknown) => {
        enqueueCustomModal(
          incoming as OpenCustomModal & { modalId: string },
        );
      },
      [enqueueCustomModal],
    ),
  });

  React.useEffect(
    () => () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current.clear();
    },
    [],
  );

  return (
    <ModalsProviderContext value={ctxValue}>
      {children}
      {/* eslint-disable react-hooks/refs -- mapper uses state only; ref writes stay in timeouts/setState */}
      {modalSlots.map((slot) => {
        const modalId = slot.id;

        let content: React.ReactNode = null;
        let valid = false;

        if (slot.type === "custom") {
          if (typeof slot.props.children === "function") {
            content = slot.props.children({ ctx: ctxValue });
            valid = content !== undefined && content !== null;
          } else {
            content = slot.props.children;
            valid = content !== undefined && content !== null;
          }
        } else {
          const Cmp = modals[slot.ctx];
          if (Cmp) {
            const componentMode =
              slot.props.mode ?? modalDefaults?.mode ?? "drawer";
            valid = true;
            content = (
              <Cmp
                context={ctxValue}
                id={modalId}
                innerProps={slot.props.innerProps}
                mode={componentMode}
              />
            );
          } else {
            console.error(
              `[modals-manager] Modal "${slot.ctx}" is not registered.`,
            );
          }
        }

        const isClosing = closingIds.has(modalId);
        const modeUsed = slot.props.mode ?? modalDefaults?.mode ?? "drawer";
        const surfaceClass =
          [modalDefaults?.surfaceClassName, slot.props.surfaceClassName]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <ModalShell
            key={modalId}
            mode={modeUsed}
            open={Boolean(valid && !isClosing)}
            surfaceClassName={surfaceClass}
            onOpenChange={(openNext) => {
              if (!openNext) scheduleCloseModal(modalId);
            }}
          >
            <React.Suspense
              fallback={
                <div className="flex flex-col gap-4 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-[180px] w-full" />
                </div>
              }
            >
              {content}
            </React.Suspense>
          </ModalShell>
        );
      })}
      {/* eslint-enable react-hooks/refs */}
    </ModalsProviderContext>
  );
}
