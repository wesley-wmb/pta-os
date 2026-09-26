import { cn } from '@/lib/utils';

export function PtaMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 225.81 250.5"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        fill="currentColor"
        d="M109.58.03c-4.75.52-9.42 1.92-13.71 4.38L17.56 49.63c-7.13 4.12-12.45 10.53-15.27 18h107.29V.03Z"
      />
      <path
        fill="currentColor"
        d="m109.57 79.11-52.21 52.21-54.02 54.04c3 6.41 7.89 11.9 14.23 15.55l78.31 45.21c4.28 2.47 8.95 3.87 13.7 4.38l-.02-113.44V79.11Z"
      />
      <path
        fill="currentColor"
        d="m49.19 129.56 55.89-55.89H.6c-.38 2.09-.6 4.22-.6 6.38v90.42c0 2.52.36 4.97.89 7.37l45.36-45.36 2.94-2.93Z"
      />
      <path
        fill="currentColor"
        d="M116.23 0c4.75.52 9.42 1.92 13.71 4.38l78.31 45.21c7.13 4.12 12.45 10.53 15.27 18H116.23V0Z"
      />
      <path
        fill="currentColor"
        d="m116.24 79.08 52.21 52.21 54.02 54.04c-3 6.41-7.89 11.9-14.23 15.55l-78.31 45.21c-4.28 2.47-8.95 3.87-13.7 4.38l.02-113.44V79.08Z"
      />
      <path
        fill="currentColor"
        d="m176.62 129.52-55.89-55.89h104.48c.38 2.09.6 4.22.6 6.38v90.42c0 2.52-.36 4.97-.89 7.37l-45.36-45.36-2.94-2.93Z"
      />
    </svg>
  );
}
