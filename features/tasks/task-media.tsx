'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Trash2,
  Upload,
  Video,
  Music,
  Download,
} from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { MEDIA_ACCEPT, validateTaskMedia } from './task-media-validation';

const attachmentSchema = z.object({
  id: z.string(),
  object_path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size: z.number(),
  description: z.string().default(''),
  version: z.number().default(1),
  state: z.string(),
  can_remove: z.boolean(),
});
type Attachment = z.infer<typeof attachmentSchema>;
const listSchema = z.object({
  attachments: z.array(attachmentSchema),
  capabilities: z.object({ can_upload_attachment: z.boolean() }),
});
const reservationSchema = z.object({ id: z.string(), object_path: z.string() });
const removalSchema = reservationSchema.extend({ removal_token: z.string() });

export function TaskMedia({
  taskId,
  workspaceId,
  creating,
  initialDescription,
  onUploaded,
  onBusyChange,
  onClose,
  onRefresh,
}: {
  taskId: string;
  workspaceId: string;
  creating: boolean;
  initialDescription?: string;
  onUploaded?: () => void;
  onBusyChange?: (busy: boolean) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [file, setFile] = useState<File>();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Attachment>();
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<Attachment>();
  const query = useQuery({
    queryKey: ['task-media', workspaceId, taskId],
    queryFn: async () => {
      const result = await createClient().rpc('list_task_attachments', {
        p_task_id: taskId,
      });
      if (result.error) throw result.error;
      return listSchema.parse(result.data);
    },
  });
  async function refresh() {
    await query.refetch();
    await onRefresh();
  }
  async function remove(item: Pick<Attachment, 'id'>) {
    const client = createClient();
    const lease = await client.rpc('begin_remove_task_attachment', {
      p_attachment_id: item.id,
    });
    if (lease.error) throw lease.error;
    const value = removalSchema.parse(lease.data);
    const deleted = await client.storage
      .from('task-attachments')
      .remove([value.object_path]);
    if (deleted.error) {
      await client.rpc('cancel_task_attachment_removal', {
        p_attachment_id: item.id,
        p_removal_token: value.removal_token,
      });
      throw deleted.error;
    }
    const finished = await client.rpc('finalize_remove_task_attachment', {
      p_attachment_id: item.id,
      p_removal_token: value.removal_token,
    });
    if (finished.error) throw finished.error;
  }
  async function upload() {
    if (!file || busy) return;
    const validated = validateTaskMedia(file);
    if (validated.error) {
      setError(validated.error);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    let reserved: z.infer<typeof reservationSchema> | undefined;
    try {
      const client = createClient();
      const prepared = await client.rpc('prepare_task_media', {
        p_task_id: taskId,
        p_file_name: file.name,
        p_file_extension: validated.extension!,
        p_mime_type: validated.mime!,
        p_file_size: file.size,
        p_description: (initialDescription ?? description).trim(),
      });
      if (prepared.error) throw prepared.error;
      reserved = reservationSchema.parse(prepared.data);
      const result = await client.storage
        .from('task-attachments')
        .upload(reserved.object_path, file, {
          contentType: validated.mime,
          upsert: false,
        });
      if (result.error) throw result.error;
      const completed = await client.rpc('complete_task_attachment', {
        p_attachment_id: reserved.id,
      });
      if (completed.error) throw completed.error;
      setFile(undefined);
      setDescription('');
      onClose();
      onUploaded?.();
      toast.success('Arquivo adicionado.');
    } catch {
      if (reserved) {
        try {
          await remove(reserved);
        } catch {
          /* The pending item stays available for removal/recovery below. */
        }
      }
      setError(
        'Não foi possível enviar o arquivo. Confira a conexão e tente novamente.',
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      await refresh();
    }
  }
  async function saveNote() {
    if (!editing) return;
    setBusy(true);
    try {
      const result = await createClient().rpc('update_task_media_description', {
        p_attachment_id: editing.id,
        p_description: note.trim(),
        p_expected_version: editing.version,
      });
      if (result.error) throw result.error;
      setEditing(undefined);
      toast.success('Descrição atualizada.');
    } catch {
      toast.error(
        'Não foi possível salvar. Reabra a edição para carregar a versão atual.',
      );
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await remove(removing);
      setRemoving(undefined);
      toast.success('Arquivo removido.');
    } catch {
      toast.error('Não foi possível remover. Tente novamente.');
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  return (
    <div className="mt-3 space-y-3">
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as mídias.{' '}
          <button className="underline" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {creating && (
        <form
          className={
            initialDescription !== undefined
              ? 'space-y-3 border-t p-4'
              : 'space-y-3 rounded-xl border bg-muted/20 p-4'
          }
          onSubmit={(e) => {
            e.preventDefault();
            void upload();
          }}
        >
          <Label htmlFor={`media-file-${taskId}`}>Mídia ou arquivo</Label>
          <Input
            id={`media-file-${taskId}`}
            type="file"
            accept={MEDIA_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0]);
              setError('');
            }}
          />
          <p className="text-xs text-muted-foreground">
            Imagens, vídeos, áudios, PDF, DOCX, XLSX, CSV, TXT e ZIP. Até 25 MB
            por arquivo.
          </p>
          {initialDescription === undefined ? (
            <>
              <Label htmlFor={`media-description-${taskId}`}>
                Descrição ou comentário (opcional)
              </Label>
              <Textarea
                id={`media-description-${taskId}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                disabled={busy}
                placeholder="Explique o que a equipe deve observar neste arquivo."
              />
            </>
          ) : null}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setFile(undefined);
                setDescription('');
                setError('');
                onClose();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                busy || !file || !query.data?.capabilities.can_upload_attachment
              }
            >
              {busy ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {busy ? 'Enviando…' : 'Enviar arquivo'}
            </Button>
          </div>
        </form>
      )}
      {query.data?.attachments.map((item) => (
        <article key={item.id} className="border-t px-4 py-3">
          <div className="flex items-start gap-3">
            <MediaPreview item={item} workspaceId={workspaceId} />
            <div className="min-w-0 flex-1">
              <h4
                className="truncate text-sm font-semibold"
                title={item.file_name}
              >
                {item.file_name}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.file_size < 1024 * 1024
                  ? `${Math.max(1, Math.round(item.file_size / 1024))} KB`
                  : `${(item.file_size / 1024 / 1024).toFixed(1)} MB`}
                {item.state !== 'ready' ? ' · Envio incompleto' : ''}
              </p>
              {item.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm break-words">
                  {item.description}
                </p>
              )}
            </div>
            {item.can_remove && (
              <div className="flex shrink-0">
                {item.state === 'ready' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar descrição de ${item.file_name}`}
                    disabled={busy}
                    onClick={() => {
                      setEditing(item);
                      setNote(item.description);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${item.file_name}`}
                  disabled={busy}
                  onClick={() => setRemoving(item)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
          {editing?.id === item.id && (
            <div className="mt-3 space-y-2">
              <Label htmlFor={`edit-note-${item.id}`}>
                Descrição ou comentário
              </Label>
              <Textarea
                id={`edit-note-${item.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                disabled={busy}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setEditing(undefined)}
                >
                  Cancelar
                </Button>
                <Button disabled={busy} onClick={() => void saveNote()}>
                  Salvar descrição
                </Button>
              </div>
            </div>
          )}
          {removing?.id === item.id && (
            <div className="mt-3 rounded-lg border border-destructive/30 p-3">
              <p className="text-sm">
                Remover este arquivo? A mídia será excluída da tarefa e do
                armazenamento.
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRemoving(undefined)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void confirmRemove()}
                >
                  Remover arquivo
                </Button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
function MediaPreview({
  item,
  workspaceId,
}: {
  item: Attachment;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [opening, setOpening] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const previewable = item.mime_type.startsWith('image/');
  useEffect(() => {
    const element = buttonRef.current;
    if (!element || !previewable || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewable]);
  const options = {
    queryKey: ['task-media-url', workspaceId, item.id, item.object_path],
    staleTime: 240000,
    gcTime: 300000,
    queryFn: async () => {
      const result = await createClient()
        .storage.from('task-attachments')
        .createSignedUrl(item.object_path, 300);
      if (result.error) throw result.error;
      return result.data.signedUrl;
    },
  };
  const query = useQuery({
    ...options,
    enabled: item.state === 'ready' && previewable && visible,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const expandedQuery = useQuery({
    ...options,
    enabled: expanded,
    refetchOnWindowFocus: false,
  });
  async function open() {
    if (opening || item.state !== 'ready') return;
    if (previewable) {
      setExpanded(true);
      return;
    }
    const target = window.open('about:blank', '_blank');
    if (!target) {
      toast.error('Permita abrir uma nova aba para visualizar o arquivo.');
      return;
    }
    target.opener = null;
    setOpening(true);
    try {
      const url = await queryClient.fetchQuery(options);
      target.location.replace(url);
    } catch {
      target.close();
      toast.error('Não foi possível abrir o arquivo. Tente novamente.');
    } finally {
      setOpening(false);
    }
  }
  async function download() {
    if (downloading || item.state !== 'ready') return;
    setDownloading(true);
    try {
      const result = await createClient()
        .storage.from('task-attachments')
        .createSignedUrl(item.object_path, 60, { download: item.file_name });
      if (result.error) throw result.error;
      const anchor = document.createElement('a');
      anchor.href = result.data.signedUrl;
      anchor.download = item.file_name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error('Não foi possível baixar o arquivo. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  }
  const downloadButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={downloading || item.state !== 'ready'}
      aria-label={`Baixar ${item.file_name}`}
      onClick={() => void download()}
    >
      {downloading ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Download aria-hidden="true" />
      )}
      {downloading ? 'Preparando…' : 'Baixar'}
    </Button>
  );
  const Icon = item.mime_type.startsWith('image/')
    ? ImageIcon
    : item.mime_type.startsWith('video/')
      ? Video
      : item.mime_type.startsWith('audio/')
        ? Music
        : FileText;
  return (
    <>
      <div className="flex shrink-0 flex-col items-start gap-1">
        <button
          ref={buttonRef}
          type="button"
          disabled={item.state !== 'ready' || opening}
          onClick={() => void open()}
          aria-label={`Abrir ${item.file_name}`}
          title={previewable ? 'Ampliar imagem' : 'Abrir arquivo em nova aba'}
          className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${previewable ? 'h-28 w-24' : 'size-16'}`}
        >
          {opening ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : previewable && query.data && !previewFailed ? (
            <Image
              unoptimized
              fill
              sizes="96px"
              src={query.data}
              alt={`Prévia de ${item.file_name}`}
              onError={() => setPreviewFailed(true)}
              className="block h-full w-full object-contain"
            />
          ) : previewable && (query.isError || previewFailed) ? (
            <span className="px-2 text-center text-xs">
              Prévia indisponível. Clique para abrir.
            </span>
          ) : previewable && visible && query.isFetching ? (
            <LoaderCircle
              className="size-5 animate-spin"
              aria-label="Carregando prévia"
            />
          ) : (
            <Icon aria-hidden="true" className="size-6" />
          )}
        </button>
        {downloadButton}
      </div>
      {previewable && (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-3 p-4 sm:max-w-5xl">
            <DialogTitle className="truncate pr-9 text-sm">
              {item.file_name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Imagem completa. Pressione Escape para fechar.
            </DialogDescription>
            <div className="flex justify-end">{downloadButton}</div>
            <div className="flex min-h-0 items-center justify-center overflow-auto rounded-lg bg-black/20">
              {expandedQuery.isPending ? (
                <LoaderCircle
                  className="my-20 animate-spin"
                  aria-label="Carregando imagem"
                />
              ) : expandedQuery.isError ? (
                <div role="alert" className="p-8 text-center text-sm">
                  <p>Não foi possível carregar a imagem.</p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => void expandedQuery.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <Image
                  unoptimized
                  src={expandedQuery.data}
                  alt={item.file_name}
                  width={1600}
                  height={1200}
                  className="h-auto max-h-[78dvh] w-auto max-w-full object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
