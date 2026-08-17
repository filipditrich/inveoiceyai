import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

export function useFileDrop(options: {
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const takeFiles = (list: FileList | null) => {
    if (!list || options.disabled) {
      return;
    }
    const files = Array.from(list);
    if (files.length === 0) {
      return;
    }
    options.onFiles(options.multiple === false ? files.slice(0, 1) : files);
  };

  const open = () => {
    if (options.disabled) {
      return;
    }
    inputRef.current?.click();
  };

  return {
    isDragging,
    open,
    inputProps: {
      ref: inputRef,
      type: "file" as const,
      accept: options.accept,
      multiple: options.multiple,
      className: "sr-only",
      tabIndex: -1 as const,
      disabled: options.disabled,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        takeFiles(event.target.files);
        event.target.value = "";
      },
    },
    surfaceProps: {
      onDragEnter: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (options.disabled) {
          return;
        }
        dragDepth.current += 1;
        setIsDragging(true);
      },
      onDragLeave: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setIsDragging(false);
        }
      },
      onDragOver: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setIsDragging(false);
        takeFiles(event.dataTransfer.files);
      },
    },
  };
}
