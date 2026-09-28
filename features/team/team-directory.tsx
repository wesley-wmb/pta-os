'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ListTodo, Search, UsersRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { OperatingTeam } from './directory-schemas';

export const teamColors: Record<string, string> = {
  blue: '#78b8ff',
  green: '#79cda4',
  purple: '#b6a1f2',
  orange: '#f1af68',
  pink: '#ed9ac4',
  red: '#ed8b87',
  gray: '#a5aab4',
};
export function TeamDirectory({ teams }: { teams: OperatingTeam[] }) {
  const [search, setSearch] = useState('');
  const visible = teams.filter((team) =>
    `${team.name} ${team.description ?? ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  return (
    <section aria-label="Equipes do workspace">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {teams.length} {teams.length === 1 ? 'equipe' : 'equipes'}
        </p>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden
            className="absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <Input
            aria-label="Buscar equipes"
            placeholder="Buscar equipes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((team) => (
          <Link
            key={team.id}
            href={`/equipes/${team.id}`}
            className="group flex min-h-52 min-w-0 flex-col rounded-xl border border-border/65 bg-card/40 p-5 transition-colors hover:border-pta-blue/45 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="mb-5 flex items-center justify-between">
              <span
                className="flex size-11 items-center justify-center rounded-xl"
                style={{
                  color: teamColors[team.color] ?? teamColors.blue,
                  backgroundColor: `${teamColors[team.color] ?? teamColors.blue}18`,
                }}
              >
                <UsersRound aria-hidden className="size-5" />
              </span>
              <ArrowRight
                aria-hidden
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
              />
            </div>
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {team.name}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {team.description || 'Tarefas e pessoas desta equipe.'}
            </p>
            <div className="mt-auto flex items-center gap-5 pt-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ListTodo aria-hidden className="size-3.5" />
                {team.task_count} {team.task_count === 1 ? 'tarefa' : 'tarefas'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UsersRound aria-hidden className="size-3.5" />
                {team.member_count}{' '}
                {team.member_count === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {search
            ? 'Nenhuma equipe encontrada.'
            : 'Crie uma equipe para começar a organizar o trabalho.'}
        </p>
      )}
    </section>
  );
}
