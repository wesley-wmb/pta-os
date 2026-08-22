'use client';

import { Maximize2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function TaskPeek({
  taskId,
  children,
}: {
  taskId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    headingRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const frame = (
    <PeekFrame
      taskId={taskId}
      headingRef={headingRef}
      onClose={() => router.back()}
    >
      {children}
    </PeekFrame>
  );

  if (isMobile) {
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) router.back();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="h-dvh gap-0 p-0 shadow-none data-[side=right]:w-full data-[side=right]:sm:max-w-none md:hidden"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            headingRef.current?.focus();
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhes da demanda</SheetTitle>
            <SheetDescription>
              Consulte e atualize esta demanda.
            </SheetDescription>
          </SheetHeader>
          {frame}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 hidden w-[clamp(480px,58vw,680px)] flex-col border-l bg-background shadow-[-18px_0_42px_rgb(55_53_47/10%)] md:flex"
      aria-label="Detalhes da demanda"
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          event.currentTarget.contains(event.target as Node)
        )
          router.back();
      }}
    >
      {frame}
    </aside>
  );
}

function PeekFrame({
  taskId,
  headingRef,
  onClose,
  children,
}: {
  taskId: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 flex-1 truncate text-sm font-medium outline-none"
        >
          Detalhes da demanda
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            // A document navigation intentionally escapes the intercepted route.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign(`/tarefa/${taskId}`);
          }}
          aria-label="Abrir em página completa"
        >
          <Maximize2 aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fechar detalhes"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
