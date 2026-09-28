'use client';

import {
  Bell,
  Building2,
  Braces,
  Check,
  ChevronRight,
  CircleUserRound,
  Laptop,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  MonitorCog,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  Sun,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { useTheme, type Theme } from '@/components/theme/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { CardPreferencesSection } from './card-preferences-section';
import {
  applyLocalSettingsToDocument,
  LOCAL_SETTINGS_EVENT,
  parseLocalSettings,
  settingsStorageKey,
  type LocalSettings,
} from './preferences';

type SectionId =
  | 'account'
  | 'appearance'
  | 'cards'
  | 'notifications'
  | 'security'
  | 'workspace';

type SettingsSection = {
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string;
  administrative?: boolean;
};

const sections: SettingsSection[] = [
  {
    id: 'account',
    label: 'Minha conta',
    description: 'Identidade, e-mail e perfil pessoal',
    icon: CircleUserRound,
    keywords: 'perfil nome avatar email conta idioma',
  },
  {
    id: 'appearance',
    label: 'Aparência',
    description: 'Tema, densidade e movimento',
    icon: Palette,
    keywords: 'tema claro escuro sistema densidade compacto animação movimento',
  },
  {
    id: 'notifications',
    label: 'Notificações',
    description: 'Alertas e sons neste navegador',
    icon: Bell,
    keywords: 'avisos alertas notificações som navegador',
  },
  {
    id: 'cards',
    label: 'Cards de tarefas',
    description: 'Tamanho e informações visíveis',
    icon: LayoutGrid,
    keywords:
      'cards tarefas quadro kanban semana tamanho densidade campos prioridade prazo responsável',
  },
  {
    id: 'security',
    label: 'Segurança e sessões',
    description: 'Senha, dispositivos e acessos',
    icon: ShieldCheck,
    keywords: 'segurança senha sessão dispositivo sair acesso',
  },
  {
    id: 'workspace',
    label: 'Administração',
    description: 'Workspace, equipe e regras',
    icon: Building2,
    keywords:
      'workspace equipe membros administração permissões horário api webhook slack email e-mail integrações',
    administrative: true,
  },
];

const themeOptions: Array<{
  value: Theme;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: 'system',
    label: 'Sistema',
    description: 'Acompanha o dispositivo',
    icon: Laptop,
  },
  {
    value: 'light',
    label: 'Claro',
    description: 'Contraste para ambientes claros',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Escuro',
    description: 'Menos brilho em ambientes escuros',
    icon: Moon,
  },
];

export function SettingsView({
  user,
  workspace,
  workspaceCount,
}: {
  user: { id: string; fullName: string };
  workspace: {
    id: string;
    name: string;
    role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  };
  workspaceCount: number;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>('account');
  const [query, setQuery] = useState('');
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
  const storageKey = settingsStorageKey(user.id, workspace.id);
  const storedSettings = useSyncExternalStore(
    useCallback(
      (onStoreChange) => subscribeToLocalSettings(storageKey, onStoreChange),
      [storageKey],
    ),
    useCallback(() => readStoredSettings(storageKey), [storageKey]),
    readServerSettings,
  );
  const settings = useMemo(
    () => parseLocalSettings(storedSettings),
    [storedSettings],
  );
  const updateSettings = useCallback(
    (nextSettings: LocalSettings) => {
      applyLocalSettingsToDocument(nextSettings);

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextSettings));
        window.dispatchEvent(
          new CustomEvent(LOCAL_SETTINGS_EVENT, { detail: storageKey }),
        );
      } catch {
        toast.error('Não foi possível salvar a preferência neste navegador.');
      }
    },
    [storageKey],
  );
  const canAdminister =
    workspace.role === 'owner' || workspace.role === 'admin';

  useEffect(() => {
    if (!mounted) return;

    applyLocalSettingsToDocument(settings);
  }, [mounted, settings]);

  const visibleSections = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return sections;

    return sections.filter((section) =>
      normalize(
        `${section.label} ${section.description} ${section.keywords}`,
      ).includes(normalizedQuery),
    );
  }, [query]);

  const displayedSection = visibleSections.some(
    (section) => section.id === activeSection,
  )
    ? activeSection
    : (visibleSections[0]?.id ?? activeSection);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Preferências
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Configurações
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ajuste sua experiência e consulte os controles administrativos do
          workspace atual.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
        <aside
          className="lg:sticky lg:top-6"
          aria-label="Seções de configurações"
        >
          <div className="relative mb-3">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar configurações"
              aria-label="Buscar configurações"
              className="h-10 bg-card pl-9"
            />
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const active = section.id === displayedSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:w-full',
                    active
                      ? 'bg-primary/12 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'size-[18px] shrink-0',
                      active && 'text-primary',
                    )}
                  />
                  <span className="whitespace-nowrap text-sm font-medium lg:whitespace-normal">
                    {section.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {visibleSections.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
              Nenhuma configuração encontrada.
            </p>
          ) : null}
        </aside>

        <section
          className="min-w-0"
          aria-live="polite"
          aria-label="Preferências"
        >
          {displayedSection === 'account' ? (
            <AccountSection user={user} workspaceName={workspace.name} />
          ) : null}
          {displayedSection === 'appearance' ? (
            <AppearanceSection
              settings={settings}
              onSettingsChange={updateSettings}
            />
          ) : null}
          {displayedSection === 'notifications' ? (
            <NotificationSection
              settings={settings}
              onSettingsChange={updateSettings}
            />
          ) : null}
          {displayedSection === 'cards' ? (
            <CardPreferencesSection
              preferences={settings.cards}
              onChange={(cards) => updateSettings({ ...settings, cards })}
            />
          ) : null}
          {displayedSection === 'security' ? <SecuritySection /> : null}
          {displayedSection === 'workspace' ? (
            <WorkspaceSection
              canAdminister={canAdminister}
              role={workspace.role}
              workspaceName={workspace.name}
              workspaceCount={workspaceCount}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function AccountSection({
  user,
  workspaceName,
}: {
  user: { id: string; fullName: string };
  workspaceName: string;
}) {
  return (
    <SettingsPanel
      eyebrow="Pessoal"
      title="Minha conta"
      description="Estas informações acompanham você em todos os workspaces."
    >
      <div className="flex items-center gap-4 py-1">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {initials(user.fullName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.fullName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Conectado a {workspaceName}
          </p>
        </div>
      </div>
      <SettingsLink
        href="/perfil"
        icon={UserRoundCog}
        title="Editar perfil"
        description="Nome, foto e informações pessoais"
      />
    </SettingsPanel>
  );
}

function AppearanceSection({
  settings,
  onSettingsChange,
}: {
  settings: LocalSettings;
  onSettingsChange: (settings: LocalSettings) => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsPanel
      eyebrow="Pessoal · neste dispositivo"
      title="Aparência"
      description="Escolha uma interface confortável para o seu ritmo de trabalho."
    >
      <FieldGroup
        title="Tema"
        description="A mudança é aplicada imediatamente."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'relative rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]',
                  selected
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border bg-background hover:border-primary/30 hover:bg-muted/45',
                )}
              >
                <span className="mb-4 flex items-center justify-between">
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'size-5 text-muted-foreground',
                      selected && 'text-primary',
                    )}
                  />
                  {selected ? (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup
        title="Densidade"
        description="Define quanto conteúdo cabe na tela."
      >
        <div className="inline-flex rounded-xl border bg-muted/45 p-1">
          {(['comfortable', 'compact'] as const).map((density) => (
            <button
              key={density}
              type="button"
              aria-pressed={settings.density === density}
              onClick={() => onSettingsChange({ ...settings, density })}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                settings.density === density
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {density === 'comfortable' ? 'Confortável' : 'Compacta'}
            </button>
          ))}
        </div>
      </FieldGroup>

      <PreferenceRow
        icon={MonitorCog}
        title="Reduzir movimento"
        description="Limita transições decorativas nesta experiência."
        checked={settings.motion === 'reduced'}
        onCheckedChange={(checked) =>
          onSettingsChange({
            ...settings,
            motion: checked ? 'reduced' : 'system',
          })
        }
      />
    </SettingsPanel>
  );
}

function NotificationSection({
  settings,
  onSettingsChange,
}: {
  settings: LocalSettings;
  onSettingsChange: (settings: LocalSettings) => void;
}) {
  return (
    <SettingsPanel
      eyebrow="Pessoal · neste navegador"
      title="Notificações"
      description="Controle como os avisos do PTA OS chamam sua atenção."
    >
      <PreferenceRow
        icon={Bell}
        title="Alertas no aplicativo"
        description="A central de notificações permanece ativa. A personalização dos alertas ainda não está disponível."
        checked={true}
        disabled
        onCheckedChange={(browserNotifications) =>
          onSettingsChange({ ...settings, browserNotifications })
        }
      />
      <PreferenceRow
        icon={MonitorCog}
        title="Som de notificação"
        description="Ainda não disponível. O aplicativo não reproduz sons de alerta."
        checked={false}
        disabled
        onCheckedChange={(notificationSounds) =>
          onSettingsChange({ ...settings, notificationSounds })
        }
      />
      <p className="rounded-xl bg-muted/55 px-4 py-3 text-xs leading-5 text-muted-foreground">
        Preferências de e-mail e resumos pertencem ao workspace e só aparecem
        para administradores quando estiverem disponíveis no servidor.
      </p>
    </SettingsPanel>
  );
}

function SecuritySection() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOutEverywhere() {
    setSigningOut(true);
    const { error } = await createClient().auth.signOut({ scope: 'global' });

    if (error) {
      setSigningOut(false);
      toast.error('Não foi possível encerrar as sessões. Tente novamente.');
      return;
    }

    router.replace('/login');
    router.refresh();
  }

  return (
    <SettingsPanel
      eyebrow="Pessoal"
      title="Segurança e sessões"
      description="Revise seu acesso e encerre sessões quando necessário."
    >
      <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
          <LockKeyhole className="size-[18px]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sessão atual protegida</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Autenticação gerenciada pelo Supabase. O PTA OS não armazena sua
            senha.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Encerrar todas as sessões</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Revoga o acesso em todos os dispositivos conectados à sua conta.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={signingOut}
          onClick={signOutEverywhere}
        >
          <LogOut aria-hidden="true" />
          {signingOut ? 'Encerrando…' : 'Encerrar sessões'}
        </Button>
      </div>
    </SettingsPanel>
  );
}

function WorkspaceSection({
  canAdminister,
  role,
  workspaceName,
  workspaceCount,
}: {
  canAdminister: boolean;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  workspaceName: string;
  workspaceCount: number;
}) {
  return (
    <SettingsPanel
      eyebrow="Workspace"
      title="Administração"
      description={`Controles compartilhados de ${workspaceName}.`}
    >
      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">Seu papel: {roleLabel(role)}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {canAdminister
            ? 'Você pode alterar configurações administrativas deste workspace.'
            : 'As opções administrativas são somente leitura para o seu papel.'}
        </p>
      </div>

      <SettingsLink
        href="/configuracoes/workspace"
        icon={Building2}
        title="Configurações do workspace"
        description="Identidade, calendário e preferências operacionais"
        disabled={!canAdminister}
      />
      <SettingsLink
        href="/pessoas"
        icon={UserRoundCog}
        title="Pessoas e permissões"
        description="Membros, convites, papéis e responsabilidades"
        disabled={!canAdminister}
      />
      <SettingsLink
        href="/configuracoes/api"
        icon={Braces}
        title="API e integrações"
        description="Chaves, webhooks, Slack e notificações por e-mail"
        disabled={!canAdminister}
      />

      {workspaceCount > 1 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Estas opções afetam apenas {workspaceName}. Troque de workspace no
          menu lateral para configurar outro ambiente.
        </p>
      ) : null}
    </SettingsPanel>
  );
}

function SettingsPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="pta-page-enter rounded-2xl border bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-7">
      <header className="mb-6 border-b pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{title}</legend>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">{description}</p>
      {children}
    </fieldset>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-colors hover:border-primary/30',
        disabled && 'cursor-not-allowed opacity-55',
      )}
    >
      <Icon
        aria-hidden="true"
        className="size-[18px] shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-muted-foreground/25 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2"
      />
    </label>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
  disabled = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </>
  );

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-16 items-center gap-3 rounded-xl border bg-background px-4 py-3 opacity-55"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-[border-color,background-color,transform] hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.995]"
    >
      {content}
    </Link>
  );
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function roleLabel(role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer') {
  return {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gestor',
    member: 'Membro',
    viewer: 'Visualizador',
  }[role];
}

function subscribeToMount() {
  return () => undefined;
}

function subscribeToLocalSettings(
  storageKey: string,
  onStoreChange: () => void,
) {
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

function readStoredSettings(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function readServerSettings() {
  return null;
}
