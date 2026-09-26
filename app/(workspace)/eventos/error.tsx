'use client';

import { OperationsError } from '@/features/operations/operations-error';

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <OperationsError error={error} reset={reset} />;
}
