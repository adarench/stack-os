"use client";

import { useRef } from "react";

import { Select } from "@/components/ui/form";

export function FilterSelect({
  name,
  value,
  options,
  preserve,
  action = "/work",
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  preserve: Array<[string, string]>; // other querystring entries to keep
  action?: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} method="GET" action={action} className="inline">
      {preserve.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Select
        name={name}
        defaultValue={value}
        onChange={() => formRef.current?.submit()}
        className="w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
