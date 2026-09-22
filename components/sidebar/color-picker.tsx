"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SWATCHES = [
  "#6366f1", "#ec4899", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#0ea5e9", "#8b5cf6",
  "#ef4444", "#64748b",
];

export function ColorPicker({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (color: string) => void;
  children: React.ReactElement;
}) {
  return (
    <Popover>
      <PopoverTrigger render={children} />
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Set color ${swatch}`}
              className={cn(
                "size-6 rounded-full ring-offset-2 ring-offset-popover transition",
                value === swatch && "ring-2 ring-foreground"
              )}
              style={{ backgroundColor: swatch }}
              onClick={() => onChange(swatch)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
