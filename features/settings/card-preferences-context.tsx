'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  DEFAULT_TASK_CARD_PREFERENCES,
  LOCAL_SETTINGS_EVENT,
  parseLocalSettings,
  settingsStorageKey,
  type TaskCardPreferences,
} from './preferences';

const TaskCardPreferencesContext = createContext<TaskCardPreferences>(
  DEFAULT_TASK_CARD_PREFERENCES,
);

export function TaskCardPreferencesProvider({
  userId,
  workspaceId,
  children,
}: {
  userId: string;
  workspaceId: string;
  children: ReactNode;
}) {
  const storageKey = settingsStorageKey(userId, workspaceId);
  const snapshot = useSyncExternalStore(
    useCallback(
      (onStoreChange) => subscribeToPreferences(storageKey, onStoreChange),
      [storageKey],
    ),
    useCallback(() => readPreferences(storageKey), [storageKey]),
    readServerPreferences,
  );
  const value = useMemo(() => parseLocalSettings(snapshot).cards, [snapshot]);

  return (
    <TaskCardPreferencesContext.Provider value={value}>
      {children}
    </TaskCardPreferencesContext.Provider>
  );
}

export function TaskCardPreferencesPreview({
  value,
  children,
}: {
  value: TaskCardPreferences;
  children: ReactNode;
}) {
  return (
    <TaskCardPreferencesContext.Provider value={value}>
      {children}
    </TaskCardPreferencesContext.Provider>
  );
}

export function useTaskCardPreferences() {
  return useContext(TaskCardPreferencesContext);
}

function subscribeToPreferences(storageKey: string, onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey) onStoreChange();
  }

  function handleLocalChange(event: Event) {
    if (event instanceof CustomEvent && event.detail === storageKey) {
      onStoreChange();
    }
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener(LOCAL_SETTINGS_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LOCAL_SETTINGS_EVENT, handleLocalChange);
  };
}

function readPreferences(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function readServerPreferences() {
  return null;
}
