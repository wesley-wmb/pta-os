import { Link2 } from 'lucide-react';

import { OperationEmptyState } from './shared';

export function ResourcesView() {
  return (
    <OperationEmptyState
      icon={Link2}
      title="Nenhum link ou material cadastrado"
    />
  );
}
