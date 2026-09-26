'use client';

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Braces,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Undo2,
  Unlink,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  createEmptyTaskDescription,
  isTaskDescription,
  type TaskDescription,
} from './rich-text';

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    defaultProtocol: 'https',
    protocols: ['https'],
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({
    placeholder: 'Registre contexto, objetivo e critérios importantes.',
  }),
];

type RichTextEditorProps = {
  value: TaskDescription;
  onChange: (value: TaskDescription) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  onSaveShortcut?: () => void;
  labelledBy?: string;
  className?: string;
  editorClassName?: string;
};

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  onSaveShortcut,
  labelledBy,
  className,
  editorClassName,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const [editingLink, setEditingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkFieldId = useId();

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveShortcutRef.current = onSaveShortcut;
  }, [onChange, onSaveShortcut]);

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'pta-rich-text min-h-44 px-4 py-4 outline-none sm:min-h-52 sm:px-5',
          editorClassName,
        ),
        role: 'textbox',
        'aria-multiline': 'true',
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
      },
      handleKeyDown: (_view, event) => {
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          onSaveShortcutRef.current
        ) {
          event.preventDefault();
          onSaveShortcutRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextValue = currentEditor.getJSON();
      if (isTaskDescription(nextValue)) onChangeRef.current(nextValue);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || !autoFocus || disabled) return;
    editor.commands.focus('end');
  }, [autoFocus, disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const currentValue = editor.getJSON();
    if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  function beginLinkEdit() {
    if (!editor) return;
    setLinkUrl(String(editor.getAttributes('link').href ?? ''));
    setEditingLink(true);
  }

  function applyLink() {
    if (!editor) return;
    const normalizedUrl = normalizeHttpsUrl(linkUrl);
    if (!normalizedUrl) return;
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: normalizedUrl })
      .run();
    setEditingLink(false);
    setLinkUrl('');
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-background shadow-xs transition focus-within:border-primary/55 focus-within:ring-2 focus-within:ring-primary/15',
        disabled && 'opacity-70',
        className,
      )}
    >
      <div
        className="pta-scrollbar flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b bg-muted/35 p-1.5 sm:flex-wrap"
        role="toolbar"
        aria-label="Formatação do texto"
      >
        <EditorButton
          label="Desfazer"
          disabled={!editor?.can().chain().focus().undo().run() || disabled}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Refazer"
          disabled={!editor?.can().chain().focus().redo().run() || disabled}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" />
        </EditorButton>
        <ToolbarDivider />
        <EditorButton
          label="Título principal"
          active={editor?.isActive('heading', { level: 1 })}
          disabled={disabled}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Subtítulo"
          active={editor?.isActive('heading', { level: 2 })}
          disabled={disabled}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Lista com marcadores"
          active={editor?.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Lista numerada"
          active={editor?.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Lista de verificação"
          active={editor?.isActive('taskList')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <ListChecks aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Citação"
          active={editor?.isActive('blockquote')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote aria-hidden="true" />
        </EditorButton>
        <ToolbarDivider />
        <EditorButton
          label="Negrito"
          active={editor?.isActive('bold')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Itálico"
          active={editor?.isActive('italic')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Tachado"
          active={editor?.isActive('strike')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Código"
          active={editor?.isActive('code')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Braces aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Adicionar ou editar link"
          active={editor?.isActive('link')}
          disabled={disabled}
          onClick={beginLinkEdit}
        >
          <Link2 aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Remover link"
          disabled={!editor?.isActive('link') || disabled}
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Unlink aria-hidden="true" />
        </EditorButton>
        <EditorButton
          label="Limpar formatação"
          disabled={disabled}
          onClick={() =>
            editor?.chain().focus().clearNodes().unsetAllMarks().run()
          }
        >
          <RemoveFormatting aria-hidden="true" />
        </EditorButton>
      </div>

      {editingLink ? (
        <div
          data-rich-text-link-editor
          className="flex flex-col gap-2 border-b bg-muted/15 p-3 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor={linkFieldId}>Link HTTPS</Label>
            <Input
              id={linkFieldId}
              type="url"
              inputMode="url"
              value={linkUrl}
              autoFocus
              placeholder="https://drive.google.com/..."
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setEditingLink(false);
                  editor?.commands.focus();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingLink(false);
                editor?.commands.focus();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!normalizeHttpsUrl(linkUrl)}
              onClick={applyLink}
            >
              Aplicar link
            </Button>
          </div>
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextViewer({
  value,
  className,
}: {
  value: TaskDescription;
  className?: string;
}) {
  const editor = useEditor({
    extensions,
    content: value,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn('pta-rich-text p-0 outline-none', className),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentValue = editor.getJSON();
    if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}

function EditorButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(active && 'bg-primary/12 text-primary')}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return (
    <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
  );
}

function normalizeHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s|%0d|%0a/i.test(trimmed)) return null;
  const candidate = trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function emptyRichTextValue() {
  return createEmptyTaskDescription();
}
