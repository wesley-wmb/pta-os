'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useTheme } from '@/components/theme/theme-provider';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === 'dark';
  const actionLabel = dark ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary focus-visible:border-primary/45 focus-visible:ring-primary/25 dark:hover:bg-primary/15 dark:hover:text-primary dark:aria-expanded:bg-primary/15 dark:aria-expanded:text-primary"
          aria-label={actionLabel}
          aria-pressed={mounted ? dark : undefined}
          disabled={!mounted}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          <Moon aria-hidden="true" className="dark:hidden" />
          <Sun aria-hidden="true" className="hidden dark:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {actionLabel}
      </TooltipContent>
    </Tooltip>
  );
}

function subscribeToMount() {
  return () => undefined;
}
