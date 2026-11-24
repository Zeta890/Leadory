"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...p }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-2 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary", className)}
      {...p}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-foreground shadow transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
