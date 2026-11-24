"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export function TabsList({ className, ...p }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex gap-1 rounded-lg border border-border bg-background/50 p-1", className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof T.Trigger>) {
  return <T.Trigger className={cn("rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors data-[state=active]:bg-surface-2 data-[state=active]:text-primary-strong", className)} {...p} />;
}
export const TabsContent = T.Content;
