"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useUI } from "@/lib/store";

/** One toast at a time, above the bottom nav and open sheets (z 55; the grain overlay is 60); auto-hides after 4.5 s. */
export function Toaster() {
  const toast = useUI((s) => s.toast);
  const dismiss = useUI((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 4500);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.2rem+var(--safe-bottom))] z-[55] flex justify-center px-4 lg:bottom-4 lg:left-64">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-cream py-3 pl-4 pr-2 text-sm font-semibold text-bg shadow-2xl shadow-black/40"
          >
            <span>{toast.text}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.run();
                  dismiss();
                }}
                className="rounded-xl bg-bg px-3 py-1.5 font-bold text-cream hover:opacity-90"
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
