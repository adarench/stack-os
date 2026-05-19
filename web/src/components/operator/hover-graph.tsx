"use client";

import * as React from "react";

/**
 * Cross-entity hover graph. The moat play.
 *
 * Any element rendered with `data-ref="WO-1043"` (or `AP-…`, `INS-…`,
 * `PRJ-…`) participates. When the operator hovers one of them, every
 * *other* on-screen element with the same ref is tagged
 * `data-hover-related="true"`. CSS in globals.css paints them with a
 * faint background tint.
 *
 * Why a document-level listener (not per-element React handlers): the
 * graph spans many independently-mounted components — rows, drawer
 * sections, activity strip, money cards, compliance disclosures.
 * Wiring handlers per component would be brittle. One delegated
 * listener at the document is simpler and faster.
 *
 * The interaction is non-destructive: it only toggles a single data
 * attribute. There is no React re-render. No state. No animation.
 */
export function HoverGraphProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    let currentRef: string | null = null;

    function findRefAncestor(el: EventTarget | null): {
      ref: string | null;
      element: HTMLElement | null;
    } {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        const ref = node.dataset?.["ref"];
        if (ref) return { ref, element: node };
        node = node.parentElement;
      }
      return { ref: null, element: null };
    }

    function clearAll(ref: string | null) {
      if (!ref) return;
      const sel = `[data-ref="${cssEscape(ref)}"][data-hover-related="true"]`;
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        delete el.dataset["hoverRelated"];
      });
    }

    function applyTo(ref: string) {
      // Apply to *all* on-screen elements with this ref, including the
      // hovered one. That way the row + drawer + inbox + money card all
      // light up together — the operator sees the system of references.
      const sel = `[data-ref="${cssEscape(ref)}"]`;
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        el.dataset["hoverRelated"] = "true";
      });
    }

    function onPointerOver(e: PointerEvent) {
      const { ref } = findRefAncestor(e.target);
      if (ref === currentRef) return;
      if (currentRef) clearAll(currentRef);
      currentRef = ref;
      if (ref) applyTo(ref);
    }

    function onPointerLeave(e: PointerEvent) {
      // Only clear when the pointer leaves the document entirely. Within
      // the document, onPointerOver handles the transitions.
      const to = e.relatedTarget as Node | null;
      if (to && document.body.contains(to)) return;
      if (currentRef) {
        clearAll(currentRef);
        currentRef = null;
      }
    }

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerleave", onPointerLeave);
      if (currentRef) clearAll(currentRef);
    };
  }, []);

  return <>{children}</>;
}

/**
 * CSS.escape polyfill — for selector safety. Entity refs are
 * alphanumeric with a single hyphen so this rarely matters in practice,
 * but we handle it correctly anyway.
 */
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9-_]/g, "\\$&");
}
