import { formatDistanceToNow, parseISO } from 'date-fns'

export function getRelativeTime(isoString: string): string {
  const date = parseISO(isoString)
  return formatDistanceToNow(date, { addSuffix: true, includeSeconds: true })
}
