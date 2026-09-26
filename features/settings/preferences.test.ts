import { describe, expect, it } from 'vitest';

import {
  applyLocalSettingsToDocument,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_TASK_CARD_PREFERENCES,
  parseTaskCardPreferences,
  parseLocalSettings,
  REDUCED_MOTION_STYLE_ID,
  settingsStorageKey,
} from '@/features/settings/preferences';

describe('preferências locais de configurações', () => {
  it('isola a chave por usuário e workspace', () => {
    expect(settingsStorageKey('user-1', 'workspace-1')).toBe(
      'pta-settings:user-1:workspace-1',
    );
    expect(settingsStorageKey('user-1', 'workspace-2')).not.toBe(
      settingsStorageKey('user-1', 'workspace-1'),
    );
  });

  it('descarta valores inválidos sem perder campos válidos', () => {
    expect(
      parseLocalSettings(
        JSON.stringify({
          density: 'compact',
          motion: 'rápido',
          browserNotifications: false,
          notificationSounds: 'sim',
        }),
      ),
    ).toEqual({
      density: 'compact',
      motion: DEFAULT_LOCAL_SETTINGS.motion,
      browserNotifications: false,
      notificationSounds: DEFAULT_LOCAL_SETTINGS.notificationSounds,
      cards: DEFAULT_TASK_CARD_PREFERENCES,
    });
  });

  it('preserva campos válidos de cards e completa preferências antigas', () => {
    expect(
      parseTaskCardPreferences({
        version: 1,
        density: 'compact',
        visibleFields: { description: false, dueDate: false },
      }),
    ).toEqual({
      ...DEFAULT_TASK_CARD_PREFERENCES,
      density: 'compact',
      visibleFields: {
        ...DEFAULT_TASK_CARD_PREFERENCES.visibleFields,
        description: false,
        dueDate: false,
      },
    });
  });

  it('usa padrões quando o storage está ausente ou corrompido', () => {
    expect(parseLocalSettings(null)).toEqual(DEFAULT_LOCAL_SETTINGS);
    expect(parseLocalSettings('{')).toEqual(DEFAULT_LOCAL_SETTINGS);
  });

  it('aplica movimento reduzido no documento e permite restaurá-lo', () => {
    applyLocalSettingsToDocument({
      ...DEFAULT_LOCAL_SETTINGS,
      motion: 'reduced',
    });

    expect(document.documentElement.dataset.ptaMotion).toBe('reduced');
    expect(document.getElementById(REDUCED_MOTION_STYLE_ID)).not.toBeNull();

    applyLocalSettingsToDocument(DEFAULT_LOCAL_SETTINGS);

    expect(document.documentElement.dataset.ptaMotion).toBe('system');
    expect(document.getElementById(REDUCED_MOTION_STYLE_ID)).toBeNull();
  });
});
