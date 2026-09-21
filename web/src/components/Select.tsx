"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

// Radix disallows an item value of "" (its sentinel for "no selection"), but
// our filter dropdowns use "" to mean "All ..." - so it's remapped to this
// internal-only token at the Radix boundary and translated back on change.
const ALL_TOKEN = "__all__";

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, onChange, options, placeholder, className = "", id, ...aria },
  ref
) {
  const radixValue = value === "" ? ALL_TOKEN : value;

  return (
    <RadixSelect.Root
      value={radixValue}
      onValueChange={(v) => onChange(v === ALL_TOKEN ? "" : v)}
    >
      <RadixSelect.Trigger
        ref={ref}
        id={id}
        aria-label={aria["aria-label"]}
        className={`flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-900 outline-none transition-shadow focus:border-green-600 focus:ring-2 focus:ring-green-100 data-[placeholder]:text-gray-400 ${className}`}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={15} className="shrink-0 text-gray-400" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          side="bottom"
          avoidCollisions={false}
          sideOffset={6}
          className="z-[200] max-h-[min(320px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-gray-400">
            <ChevronDown size={14} className="rotate-180" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1.5">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value || ALL_TOKEN}
                value={opt.value === "" ? ALL_TOKEN : opt.value}
                className="relative flex cursor-pointer items-center rounded-lg py-2 pr-8 pl-3 text-[13.5px] text-gray-700 outline-none select-none data-[highlighted]:bg-green-50 data-[highlighted]:text-green-800 data-[state=checked]:font-semibold data-[state=checked]:text-green-800"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2.5 flex items-center">
                  <Check size={15} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex items-center justify-center py-1 text-gray-400">
            <ChevronDown size={14} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
});
