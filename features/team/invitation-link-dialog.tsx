'use client';

import { Check, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function InvitationLinkDialog({
  open,
  onOpenChange,
  inviteUrl,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteUrl: string;
  email: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Link do convite copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link manualmente.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setCopied(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Link2 aria-hidden="true" className="size-4" />
          </span>
          <DialogTitle>Link de convite pronto</DialogTitle>
          <DialogDescription>
            Envie este link para {email}. Ele deixa de funcionar depois do uso
            ou do prazo de validade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="generated-invite-link"
            className="text-xs font-medium"
          >
            Link de uso único
          </label>
          <div className="flex gap-2">
            <Input
              id="generated-invite-link"
              value={inviteUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={copyLink}
              aria-label="Copiar link do convite"
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {copied ? 'Copiado' : 'Copiar'}
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function createInvitationUrl(rawToken: string) {
  return `${window.location.origin}/convite/${encodeURIComponent(rawToken)}`;
}
