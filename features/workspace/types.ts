export type WorkspaceMember = {
  id: string;
  fullName: string;
};

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type AvailableWorkspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceContext = {
  user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  workspace: {
    id: string;
    name: string;
    taskPrefix: string;
    timezone: string;
    role: WorkspaceRole;
  } | null;
  availableWorkspaces: AvailableWorkspace[];
  members: WorkspaceMember[];
};
