import { useIsomorphicEffect } from "@/features/modals-manager/utils/use-isomorphic-effect";

/** CustomEvent bus shaped like Mantine `createUseExternalEvents`. */
export function createUseExternalEvents<
	THandlers extends Record<string, (...args: unknown[]) => void>,
>(prefix: string) {
  function dispatchEvent(type: string, detail?: unknown) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function useExternalEvents(events: THandlers) {
    const handlers = (
      Object.keys(events) as (keyof THandlers)[]
    ).reduce<Record<string, (evt: CustomEvent<unknown>) => void>>((acc, eventKey) => {
      const handler = events[eventKey];
      if (handler !== undefined && handler !== null) {
        acc[`${prefix}:${String(eventKey)}`] = (event: CustomEvent<unknown>) => {
          handler(event.detail);
        };
      }
      return acc;
    }, {});

    useIsomorphicEffect(() => {
      if (typeof window === "undefined") return undefined;

      const eventKeys = Object.keys(handlers);
      eventKeys.forEach((eventKey) => {
        const handler = handlers[eventKey];
        if (handler !== undefined && handler !== null) {
          window.removeEventListener(eventKey, handler as EventListener);
          window.addEventListener(eventKey, handler as EventListener);
        }
      });

      return () => {
        eventKeys.forEach((eventKey) => {
          const handler = handlers[eventKey];
          if (handler)
            window.removeEventListener(eventKey, handler as EventListener);
        });
      };
    }, [handlers]);
  }

  function createEvent<TEventKey extends keyof THandlers>(event: TEventKey) {
    type Parameter = Parameters<THandlers[TEventKey]>[0];
    return (
      ...payload: Parameter extends undefined ? [undefined?] : [Parameter]
    ) =>
      dispatchEvent(
        `${prefix}:${String(event)}`,
        payload[0] === undefined ? undefined : payload[0],
      );
  }

  return [useExternalEvents, createEvent] as const;
}
