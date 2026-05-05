"use client";

import { useRef } from "react";

export function FilterSelect({
  name,
  value,
  options,
  preserve,
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  preserve: Array<[string, string]>; // other querystring entries to keep
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} method="GET" action="/board" className="inline">
      {preserve.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name={name}
        defaultValue={value}
        onChange={() => formRef.current?.submit()}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
