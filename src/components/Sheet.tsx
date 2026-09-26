"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { useIsDesktop } from "@/lib/useMediaQuery";

/**
 * Frame for the log sheets (food + workout).
 * Phone: bottom sheet you can drag down. Desktop: a centred modal that rises and fades in (`modal-pop` in
 * globals.css), close to where the pointer already is; closes with Esc or a click outside. Dragging is off on desktop.
 * `size` sets the desktop width: "wide" for two-pane layouts.
 */
export function Sheet({ open, onClose, size, children }: {
  open: boolean;
  onClose: () => void;
  /** undefined while closing keeps the last width, so the modal doesn't jump mid-animation */
  size?: "narrow" | "normal" | "wide";
  children: React.ReactNode;
}) {
  const desktop = useIsDesktop();
  const [kept, setKept] = useState(size ?? "normal");
  if (size && size !== kept) setKept(size);
  const width = kept === "wide" ? "w-[min(1120px,calc(100vw-4rem))]" : kept === "narrow" ? "w-[min(500px,calc(100vw-4rem))]" : "w-[min(680px,calc(100vw-4rem))]";

  return (
    <Drawer.Root
      key={desktop ? "modal" : "bottom"}
      open={open}
      onOpenChange={(o) => !o && onClose()}
      direction="bottom"
      handleOnly={desktop}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[3px]" />
        <Drawer.Content
          // a field with something to clear (e.g. a search box) handles Esc itself: clear it, keep the sheet open
          onEscapeKeyDown={(e) => {
            if (document.activeElement?.closest("[data-escape-clears]")) e.preventDefault();
          }}
          // floating UI above the sheet (the rest timer, D40) is part of the workout, not a click "outside"
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement | null)?.closest?.("[data-float-ui]")) e.preventDefault();
          }}
          className={`fixed z-50 flex flex-col border-line-strong bg-surface outline-none after:hidden ${
            desktop
              ? `modal-pop inset-0 m-auto h-[min(84dvh,860px)] ${width} overflow-hidden rounded-[2rem] border pt-5 shadow-2xl shadow-black/60`
              : "inset-x-0 bottom-0 mx-auto h-[92dvh] max-w-md rounded-t-[2rem] border-t"
          }`}
        >
          {!desktop && <div className="mx-auto mb-2 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />}
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
