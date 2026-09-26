'use client';

import { ChevronRight, Copy, Maximize2, MoreHorizontal, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { safeTaskReturnPath } from './task-return-path';

export function TaskPeek({
  taskId,
  children,
}: {
  taskId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const search = searchParams.toString();
  const returnHref = safeTaskReturnPath(searchParams.get('retorno'));

  function closePeek() {
    router.replace(returnHref, { scroll: false });
  }

  return (
    <Dialog
      modal
      open
      onOpenChange={(open) => {
        if (!open) closePeek();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/35 backdrop-blur-[2px] dark:bg-black/55"
        className="flex h-[min(860px,calc(100dvh-32px))] !w-[min(1040px,calc(100vw-48px))] !max-w-none grid-cols-none gap-0 overflow-hidden rounded-[22px] border-border/80 bg-card p-0 shadow-[0_32px_100px_rgb(0_0_0/32%),0_8px_32px_rgb(0_0_0/18%)] sm:!max-w-none max-sm:h-dvh max-sm:!w-screen max-sm:rounded-none max-sm:border-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const activeElement = document.activeElement;
          if (
            activeElement instanceof HTMLElement &&
            activeElement !== document.body &&
            !activeElement.closest('[role="dialog"]')
          ) {
            previousFocusRef.current = activeElement;
          }
          headingRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const previousFocus = previousFocusRef.current;
          if (
            previousFocus?.isConnected &&
            previousFocus.getClientRects().length
          ) {
            previousFocus.focus({ preventScroll: true });
            return;
          }

          // A status change can replace the original card while the peek is open.
          const taskLink = Array.from(
            document.querySelectorAll<HTMLAnchorElement>('a[href]'),
          ).find(
            (link) =>
              link.pathname === `/tarefa/${taskId}` &&
              !link.closest('[role="dialog"]') &&
              link.getClientRects().length > 0,
          );
          taskLink?.focus({ preventScroll: true });
        }}
        onEscapeKeyDown={(event) => {
          if (document.activeElement?.closest('[data-task-inline-editor]'))
            event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Detalhes da tarefa</DialogTitle>
        <DialogDescription className="sr-only">
          Consulte e atualize a tarefa sem sair do quadro.
        </DialogDescription>
        <PeekFrame
          fullPageHref={`/tarefa/${taskId}${search ? `?${search}` : ''}`}
          headingRef={headingRef}
          onClose={closePeek}
        >
          {children}
        </PeekFrame>
      </DialogContent>
    </Dialog>
  );
}

function PeekFrame({
  fullPageHref,
  headingRef,
  onClose,
  children,
}: {
  fullPageHref: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  function openFullPage() {
    window.location.assign(fullPageHref);
  }

  async function copyTaskLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(fullPageHref, window.location.origin).toString(),
      );
      toast.success('Link da tarefa copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative flex h-14 shrink-0 items-center gap-2 border-b bg-card/95 px-5 text-foreground backdrop-blur-xl sm:px-7">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="relative flex min-w-0 flex-1 items-center gap-2 truncate text-sm outline-none"
        >
          <span className="text-muted-foreground">Tarefas</span>
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="truncate font-semibold text-foreground">Tarefa</span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => {
            // A document navigation intentionally escapes the intercepted route.
            openFullPage();
          }}
          aria-label="Abrir tarefa em página completa"
          title="Abrir em página completa"
        >
          <Maximize2 aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Mais opções da tarefa"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[80] min-w-52 p-1.5">
            <DropdownMenuItem onSelect={() => void copyTaskLink()}>
              <Copy aria-hidden="true" />
              Copiar link da tarefa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openFullPage}>
              <Maximize2 aria-hidden="true" />
              Abrir em página completa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
          aria-label="Fechar detalhes"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
