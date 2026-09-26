import { z } from 'zod';

export type TaskDescriptionMark = {
  type: 'bold' | 'italic' | 'strike' | 'code' | 'link';
  attrs?: {
    href?: string;
    target?: string | null;
    rel?: string | null;
    class?: string | null;
  };
};

export type TaskDescriptionNode = {
  type:
    | 'paragraph'
    | 'heading'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
    | 'taskList'
    | 'taskItem'
    | 'blockquote'
    | 'text'
    | 'hardBreak';
  attrs?: Record<string, string | number | boolean | null | undefined>;
  content?: TaskDescriptionNode[];
  text?: string;
  marks?: TaskDescriptionMark[];
};

export type TaskDescription = {
  type: 'doc';
  content: TaskDescriptionNode[];
};

export const EMPTY_TASK_DESCRIPTION: TaskDescription = {
  type: 'doc',
  content: [],
};

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
]);
const INLINE_TYPES = new Set(['text', 'hardBreak']);
const SIMPLE_MARKS = new Set(['bold', 'italic', 'strike', 'code']);
const MAX_DEPTH = 10;
const MAX_NODES = 3000;

export const taskDescriptionSchema = z.custom<TaskDescription>(
  isTaskDescription,
  {
    message: 'A descrição contém formatação não permitida.',
  },
);

export function createEmptyTaskDescription(): TaskDescription {
  return { type: 'doc', content: [] };
}

export function isTaskDescription(value: unknown): value is TaskDescription {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['type', 'content']) ||
    value.type !== 'doc' ||
    !Array.isArray(value.content)
  ) {
    return false;
  }

  const nodeCount = { value: 0 };
  return value.content.every(
    (node) =>
      isRecord(node) &&
      BLOCK_TYPES.has(String(node.type)) &&
      isTaskDescriptionNode(node, 0, nodeCount),
  );
}

export function hasTaskDescriptionContent(description: TaskDescription) {
  return description.content.some(nodeHasContent);
}

export function taskDescriptionsEqual(
  left: TaskDescription,
  right: TaskDescription,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function plainTextToTaskDescription(text: string): TaskDescription {
  const normalized = text.replace(/\r\n/g, '\n').trimEnd();
  if (!normalized) return createEmptyTaskDescription();
  return {
    type: 'doc',
    content: normalized.split('\n').map((paragraph) => ({
      type: 'paragraph',
      content: paragraph
        ? [{ type: 'text', text: paragraph } satisfies TaskDescriptionNode]
        : [],
    })),
  };
}

export function taskDescriptionToPlainText(description: TaskDescription) {
  return description.content.map(nodeToPlainText).join('\n').trimEnd();
}

function isTaskDescriptionNode(
  node: Record<string, unknown>,
  depth: number,
  nodeCount: { value: number },
): node is TaskDescriptionNode {
  nodeCount.value += 1;
  if (depth > MAX_DEPTH || nodeCount.value > MAX_NODES) return false;

  switch (node.type) {
    case 'text':
      return (
        hasOnlyKeys(node, ['type', 'text', 'marks']) &&
        typeof node.text === 'string' &&
        node.text.length <= 50000 &&
        (node.marks === undefined ||
          (Array.isArray(node.marks) &&
            node.marks.length <= 12 &&
            node.marks.every(isTaskDescriptionMark)))
      );
    case 'hardBreak':
      return hasOnlyKeys(node, ['type']);
    case 'paragraph':
      return (
        hasOnlyKeys(node, ['type', 'content']) &&
        isValidChildren(node.content, INLINE_TYPES, depth, nodeCount, true)
      );
    case 'heading':
      return (
        hasOnlyKeys(node, ['type', 'attrs', 'content']) &&
        isHeadingAttrs(node.attrs) &&
        isValidChildren(node.content, INLINE_TYPES, depth, nodeCount, true)
      );
    case 'bulletList':
    case 'orderedList':
      return (
        hasOnlyKeys(node, ['type', 'attrs', 'content']) &&
        (node.type !== 'orderedList' || isOrderedListAttrs(node.attrs)) &&
        (node.type !== 'bulletList' || node.attrs === undefined) &&
        isValidChildren(
          node.content,
          new Set(['listItem']),
          depth,
          nodeCount,
          false,
        )
      );
    case 'taskList':
      return (
        hasOnlyKeys(node, ['type', 'content']) &&
        isValidChildren(
          node.content,
          new Set(['taskItem']),
          depth,
          nodeCount,
          false,
        )
      );
    case 'listItem':
      return (
        hasOnlyKeys(node, ['type', 'content']) &&
        isValidChildren(
          node.content,
          new Set([
            'paragraph',
            'bulletList',
            'orderedList',
            'taskList',
            'blockquote',
          ]),
          depth,
          nodeCount,
          false,
        )
      );
    case 'taskItem':
      return (
        hasOnlyKeys(node, ['type', 'attrs', 'content']) &&
        isTaskItemAttrs(node.attrs) &&
        isValidChildren(
          node.content,
          new Set([
            'paragraph',
            'bulletList',
            'orderedList',
            'taskList',
            'blockquote',
          ]),
          depth,
          nodeCount,
          false,
        )
      );
    case 'blockquote':
      return (
        hasOnlyKeys(node, ['type', 'content']) &&
        isValidChildren(node.content, BLOCK_TYPES, depth, nodeCount, false)
      );
    default:
      return false;
  }
}

function isValidChildren(
  value: unknown,
  allowedTypes: Set<string>,
  depth: number,
  nodeCount: { value: number },
  allowMissing: boolean,
) {
  if (value === undefined) return allowMissing;
  return (
    Array.isArray(value) &&
    value.every(
      (child) =>
        isRecord(child) &&
        allowedTypes.has(String(child.type)) &&
        isTaskDescriptionNode(child, depth + 1, nodeCount),
    )
  );
}

function isTaskDescriptionMark(value: unknown): value is TaskDescriptionMark {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (SIMPLE_MARKS.has(value.type)) {
    return hasOnlyKeys(value, ['type']);
  }
  if (
    value.type !== 'link' ||
    !hasOnlyKeys(value, ['type', 'attrs']) ||
    !isRecord(value.attrs) ||
    !hasOnlyKeys(value.attrs, ['href', 'target', 'rel', 'class']) ||
    typeof value.attrs.href !== 'string' ||
    !isSafeHttpsUrl(value.attrs.href)
  ) {
    return false;
  }
  return (
    isNullableString(value.attrs.target, 40) &&
    isNullableString(value.attrs.rel, 120) &&
    isNullableString(value.attrs.class, 120) &&
    (value.attrs.target === undefined ||
      value.attrs.target === null ||
      value.attrs.target === '_blank')
  );
}

function isHeadingAttrs(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['level']) &&
    Number.isInteger(value.level) &&
    Number(value.level) >= 1 &&
    Number(value.level) <= 3
  );
}

function isOrderedListAttrs(value: unknown) {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['start', 'type']) &&
    (value.start === undefined ||
      (Number.isInteger(value.start) && Number(value.start) >= 1)) &&
    (value.type === undefined ||
      value.type === null ||
      ['1', 'a', 'A', 'i', 'I'].includes(String(value.type)))
  );
}

function isTaskItemAttrs(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['checked']) &&
    typeof value.checked === 'boolean'
  );
}

function isSafeHttpsUrl(value: string) {
  if (
    value.length > 2048 ||
    /\s|%0d|%0a/i.test(value) ||
    !value.startsWith('https://')
  ) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function nodeHasContent(node: TaskDescriptionNode): boolean {
  if (node.type === 'text') return Boolean(node.text?.trim());
  return node.content?.some(nodeHasContent) ?? false;
}

function nodeToPlainText(node: TaskDescriptionNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  const content = node.content?.map(nodeToPlainText) ?? [];
  if (node.type === 'listItem' || node.type === 'taskItem') {
    const prefix =
      node.type === 'taskItem' && node.attrs?.checked ? '[x] ' : '- ';
    return `${prefix}${content.join('')}`;
  }
  if (
    node.type === 'bulletList' ||
    node.type === 'orderedList' ||
    node.type === 'taskList'
  ) {
    return content.join('\n');
  }
  return content.join('');
}

function isNullableString(value: unknown, maxLength: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.length <= maxLength)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}
