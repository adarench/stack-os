"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

/**
 * Small client wrapper that submits the surrounding GET form on
 * input "Enter" or after a 500ms idle. Other filter values are passed
 * through via hidden inputs from the server page.
 */
export function WoSearch({
  defaultValue,
  preserve,
}: {
  defaultValue: string;
  preserve: Array<[string, string]>;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <form
      ref={formRef}
      method="GET"
      action="/work-orders"
      className="flex w-full items-center gap-2"
    >
      {preserve.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search title, description, or WO-#"
        autoComplete="off"
        enterKeyHint="search"
        className="flex-1"
        onChange={(e) => {
          if (timer.current) clearTimeout(timer.current);
          const value = e.currentTarget.value;
          timer.current = setTimeout(() => {
            // Only auto-submit on clear (so backspace clears results) or on
            // long stable typing — short inputs are noisy.
            if (value === "" || value.length >= 3) {
              formRef.current?.submit();
            }
          }, 450);
        }}
      />
      <Button type="submit" size="sm">
        Search
      </Button>
    </form>
  );
}
