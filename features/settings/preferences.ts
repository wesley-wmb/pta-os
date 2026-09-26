export type InterfaceDensity = 'comfortable' | 'compact';

export type MotionPreference = 'system' | 'reduced';

export type TaskCardDensity = 'compact' | 'comfortable' | 'spacious';

export type TaskCardField =
  | 'priority'
  | 'context'
  | 'description'
  | 'status'
  | 'checklist'
  | 'comments'
  | 'dueDate'
  | 'assignee';

export type TaskCardPreferences = {
  version: 1;
  density: TaskCardDensity;
  visibleFields: Record<TaskCardField, boolean>;
};

export const TASK_CARD_FIELDS: ReadonlyArray<TaskCardField> = [
  'priority',
  'context',
  'description',
  'status',
  'checklist',
  'comments',
  'dueDate',
  'assignee',
];

export const DEFAULT_TASK_CARD_PREFERENCES: TaskCardPreferences = {
  version: 1,
  density: 'comfortable',
  visibleFields: {
    priority: true,
    context: true,
    description: true,
    status: true,
    checklist: true,
    comments: true,
    dueDate: true,
    assignee: true,
  },
};

export type LocalSettings = {
  density: InterfaceDensity;
  motion: MotionPreference;
  browserNotifications: boolean;
  notificationSounds: boolean;
  cards: TaskCardPreferences;
};

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  density: 'comfortable',
  motion: 'system',
  browserNotifications: true,
  notificationSounds: false,
  cards: DEFAULT_TASK_CARD_PREFERENCES,
};

export const REDUCED_MOTION_STYLE_ID = 'pta-reduced-motion-preference';
export const LOCAL_SETTINGS_EVENT = 'pta-local-settings-change';

export function settingsStorageKey(userId: string, workspaceId: string) {
  return `pta-settings:${userId}:${workspaceId}`;
}

export function parseLocalSettings(value: string | null): LocalSettings {
  if (!value) return DEFAULT_LOCAL_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return DEFAULT_LOCAL_SETTINGS;

    return {
      density:
        parsed.density === 'compact' || parsed.density === 'comfortable'
          ? parsed.density
          : DEFAULT_LOCAL_SETTINGS.density,
      motion:
        parsed.motion === 'reduced' || parsed.motion === 'system'
          ? parsed.motion
          : DEFAULT_LOCAL_SETTINGS.motion,
      browserNotifications:
        typeof parsed.browserNotifications === 'boolean'
          ? parsed.browserNotifications
          : DEFAULT_LOCAL_SETTINGS.browserNotifications,
      notificationSounds:
        typeof parsed.notificationSounds === 'boolean'
          ? parsed.notificationSounds
          : DEFAULT_LOCAL_SETTINGS.notificationSounds,
      cards: parseTaskCardPreferences(parsed.cards),
    };
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}

export function parseTaskCardPreferences(value: unknown): TaskCardPreferences {
  if (!isRecord(value)) return DEFAULT_TASK_CARD_PREFERENCES;

  const visibleFields = isRecord(value.visibleFields)
    ? value.visibleFields
    : {};

  return {
    version: 1,
    density:
      value.density === 'compact' ||
      value.density === 'comfortable' ||
      value.density === 'spacious'
        ? value.density
        : DEFAULT_TASK_CARD_PREFERENCES.density,
    visibleFields: Object.fromEntries(
      TASK_CARD_FIELDS.map((field) => [
        field,
        typeof visibleFields[field] === 'boolean'
          ? visibleFields[field]
          : DEFAULT_TASK_CARD_PREFERENCES.visibleFields[field],
      ]),
    ) as Record<TaskCardField, boolean>,
  };
}

export function applyLocalSettingsToDocument(settings: LocalSettings) {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.ptaDensity = settings.density;
  document.documentElement.dataset.ptaMotion = settings.motion;

  let style = document.getElementById(REDUCED_MOTION_STYLE_ID);

  if (settings.motion !== 'reduced') {
    style?.remove();
    return;
  }

  if (!style) {
    style = document.createElement('style');
    style.id = REDUCED_MOTION_STYLE_ID;
    style.textContent = `
      :root[data-pta-motion='reduced'] *,
      :root[data-pta-motion='reduced'] *::before,
      :root[data-pta-motion='reduced'] *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.append(style);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
