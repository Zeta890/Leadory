"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, ...p }: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-up" />
      <D.Content
        className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-2xl data-[state=open]:animate-fade-up sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl", className)}
        {...p}
      >
        <D.Title className="text-base font-semibold">{title}</D.Title>
        {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
        <div className="mt-4">{children}</div>
        <D.Close className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-foreground" aria-label="Fechar">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
