export const projectViewValues = [
  'overview',
  'board',
  'list',
  'timeline',
  'calendar',
  'resources',
  'team',
  'activity',
  'settings',
] as const;

export type ProjectView = (typeof projectViewValues)[number];

export type ProjectViewLayout = {
  order: ProjectView[];
  hidden: ProjectView[];
};

export const defaultProjectViewLayout: ProjectViewLayout = {
  order: [...projectViewValues],
  hidden: [],
};

export function projectViewLayoutPreferenceKey(
  userId: string,
  workspaceId: string,
  projectId: string,
) {
  return `pta-project-tabs:${userId}:${workspaceId}:${projectId}`;
}

export function normalizeProjectViewLayout(value: unknown): ProjectViewLayout {
  if (!value || typeof value !== 'object') return defaultProjectViewLayout;

  const candidate = value as { order?: unknown; hidden?: unknown };
  const order = uniqueProjectViews(candidate.order);
  for (const view of projectViewValues) {
    if (!order.includes(view)) order.push(view);
  }

  const hidden = uniqueProjectViews(candidate.hidden).filter((view) =>
    order.includes(view),
  );
  if (hidden.length >= projectViewValues.length) hidden.shift();

  return { order, hidden };
}

export function visibleProjectViews(layout: ProjectViewLayout) {
  return layout.order.filter((view) => !layout.hidden.includes(view));
}

export function hiddenProjectViews(layout: ProjectViewLayout) {
  return layout.order.filter((view) => layout.hidden.includes(view));
}

export function reorderVisibleProjectViews(
  layout: ProjectViewLayout,
  active: ProjectView,
  over: ProjectView,
): ProjectViewLayout {
  if (active === over) return layout;
  const visible = visibleProjectViews(layout);
  const from = visible.indexOf(active);
  const to = visible.indexOf(over);
  if (from < 0 || to < 0) return layout;

  const reordered = [...visible];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return {
    order: [...reordered, ...hiddenProjectViews(layout)],
    hidden: [...layout.hidden],
  };
}

export function hideProjectView(
  layout: ProjectViewLayout,
  view: ProjectView,
): ProjectViewLayout {
  const visible = visibleProjectViews(layout);
  if (!visible.includes(view) || visible.length <= 1) return layout;

  const nextVisible = visible.filter((item) => item !== view);
  const nextHidden = [
    ...hiddenProjectViews(layout).filter((item) => item !== view),
    view,
  ];
  return {
    order: [...nextVisible, ...nextHidden],
    hidden: nextHidden,
  };
}

export function showProjectView(
  layout: ProjectViewLayout,
  view: ProjectView,
): ProjectViewLayout {
  if (!layout.hidden.includes(view)) return layout;

  const nextHidden = hiddenProjectViews(layout).filter((item) => item !== view);
  return {
    order: [...visibleProjectViews(layout), view, ...nextHidden],
    hidden: nextHidden,
  };
}

function uniqueProjectViews(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: ProjectView[] = [];
  for (const item of value) {
    if (
      typeof item === 'string' &&
      projectViewValues.includes(item as ProjectView) &&
      !result.includes(item as ProjectView)
    ) {
      result.push(item as ProjectView);
    }
  }
  return result;
}
