export type WorkspaceMember = {
  id: string;
  fullName: string;
};

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type WorkspaceContext = {
  user: {
    id: string;
    fullName: string;
  };
  workspace: {
    id: string;
    name: string;
    taskPrefix: string;
    timezone: string;
    role: WorkspaceRole;
  } | null;
  members: WorkspaceMember[];
};
