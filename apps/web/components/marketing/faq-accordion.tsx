"use client";

import { useId, useState } from "react";
import { ChevronRightIcon } from "lucide-react";

type FaqItem = {
  readonly answer: string;
  readonly question: string;
};

export function FaqAccordion({
  items,
}: Readonly<{ items: readonly FaqItem[] }>) {
  const accordionId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y border-y">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${accordionId}-panel-${index}`;
        const triggerId = `${accordionId}-trigger-${index}`;

        return (
          <div key={item.question}>
            <h3>
              <button
                id={triggerId}
                type="button"
                aria-controls={panelId}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-5 rounded-md py-5 text-left text-base font-medium transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                {item.question}
                <ChevronRightIcon
                  aria-hidden="true"
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none ${isOpen ? "rotate-90" : "rotate-0"}`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!isOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
