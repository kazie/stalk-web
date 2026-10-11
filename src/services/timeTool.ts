import { formatDistanceToNow, parseISO } from 'date-fns'

// Accepts an ISO string, or epoch ms when the caller has already parsed it
export function getRelativeTime(time: string | number): string {
  const date = typeof time === 'string' ? parseISO(time) : time
  return formatDistanceToNow(date, { addSuffix: true, includeSeconds: true })
}
