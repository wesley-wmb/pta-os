import { describe, expect, it } from 'vitest';

import {
  ACCESS_ROLE_POLICIES,
  canAssignTaskTo,
  canCreateTask,
  DEFAULT_MARKETING_WORKFLOW,
  FUNCTIONAL_ROLE_KEYS,
  getDependencySatisfiedWorkflowSteps,
  OPERATING_DEFAULTS,
  STANDARD_FUNCTIONAL_ROLES,
  WORKSPACE_ACCESS_ROLES,
  WORKFLOW_STEP_KEYS,
  type WorkflowStepKey,
} from './operating-model';

describe('team operating model', () => {
  it('defines one complete policy for every access role', () => {
    expect(Object.keys(ACCESS_ROLE_POLICIES).sort()).toEqual(
      [...WORKSPACE_ACCESS_ROLES].sort(),
    );
    expect(canCreateTask('owner')).toBe(true);
    expect(canCreateTask('member')).toBe(true);
    expect(canCreateTask('viewer')).toBe(false);
  });

  it('lets contributors create work without granting unrestricted assignment', () => {
    expect(canAssignTaskTo('member', 'self')).toBe(true);
    expect(canAssignTaskTo('member', 'own_team_queue')).toBe(true);
    expect(canAssignTaskTo('member', 'workflow_next_owner')).toBe(true);
    expect(canAssignTaskTo('member', 'workspace_member')).toBe(false);
    expect(canAssignTaskTo('manager', 'workspace_member')).toBe(true);
    expect(canAssignTaskTo('viewer', 'self')).toBe(false);
  });

  it('keeps functional roles independent and uniquely identified', () => {
    const keys = STANDARD_FUNCTIONAL_ROLES.map((role) => role.key);

    expect(keys).toEqual(FUNCTIONAL_ROLE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    expect(STANDARD_FUNCTIONAL_ROLES).toHaveLength(12);
  });

  it('defines an acyclic workflow with valid dependencies', () => {
    const known = new Set<WorkflowStepKey>();
    const stepKeys = DEFAULT_MARKETING_WORKFLOW.steps.map((step) => step.key);

    expect(stepKeys).toEqual(WORKFLOW_STEP_KEYS);

    for (const step of DEFAULT_MARKETING_WORKFLOW.steps) {
      for (const dependency of step.dependsOn) {
        expect(known.has(dependency)).toBe(true);
      }
      known.add(step.key);
    }
  });

  it('opens parallel lanes only after their prerequisites finish', () => {
    expect(
      getDependencySatisfiedWorkflowSteps([]).map((step) => step.key),
    ).toEqual(['intake']);
    expect(
      getDependencySatisfiedWorkflowSteps(['intake']).map((step) => step.key),
    ).toEqual(['briefing']);
    expect(
      getDependencySatisfiedWorkflowSteps(['intake', 'briefing']).map(
        (step) => step.key,
      ),
    ).toEqual(['copy', 'media_plan']);

    expect(
      getDependencySatisfiedWorkflowSteps([
        'intake',
        'briefing',
        'copy',
        'copy_review',
      ]).map((step) => step.key),
    ).toEqual(['design', 'web', 'media_plan']);
  });

  it('holds campaign setup until creative, web and media are complete', () => {
    const completed: WorkflowStepKey[] = [
      'intake',
      'briefing',
      'copy',
      'copy_review',
      'design',
      'creative_review',
      'web',
    ];

    expect(
      getDependencySatisfiedWorkflowSteps(completed).map((step) => step.key),
    ).toEqual(['media_plan']);

    expect(
      getDependencySatisfiedWorkflowSteps([...completed, 'media_plan']).map(
        (step) => step.key,
      ),
    ).toEqual(['campaign_setup']);
  });

  it('starts with a soft WIP limit and an early risk warning', () => {
    expect(OPERATING_DEFAULTS.softWipLimitPerContributor).toBe(2);
    expect(OPERATING_DEFAULTS.riskWarningPercent).toBe(75);
    expect(OPERATING_DEFAULTS.handoffAcceptanceBusinessHours).toBe(4);
  });
});
