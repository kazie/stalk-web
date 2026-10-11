import { parseISO } from 'date-fns'
import type { MarkerData } from './markerService'

// Below this speed GPS bearing is mostly noise, so we don't claim a direction (~1.8 km/h)
const MOVING_MIN_SPEED_MS = 0.5

// The slowest web send rate is 10 s, and a phone that stops moving often stops producing fixes
// altogether, so it never reports speed 0. Past a few missed reports we stop claiming motion.
// Kept under a minute so the map's 1 s ticks for recent fixes drop the indicators on time.
export const MOTION_STALE_MS = 30_000

export interface MotionState {
  speedText?: string
  heading?: number
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

// Wrap any angle into [0, 360)
export const normalizeDegrees = (deg: number): number => ((deg % 360) + 360) % 360

// Convert m/s to a rounded km/h label, e.g. 8.9 -> "32 km/h"
export const formatSpeedKmh = (ms: number): string => `${Math.round(ms * 3.6)} km/h`

// 8-point compass direction for a heading in degrees clockwise from north
export const compassPoint = (deg: number): string =>
  COMPASS_POINTS[Math.round(normalizeDegrees(deg) / 45) % COMPASS_POINTS.length]!

// Speed and heading as reported for a fix; either is absent when unknown
export interface Motion {
  // Speed over ground in m/s
  speed?: number
  // Direction of travel in degrees clockwise from true north, [0, 360)
  heading?: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

// Keep only values that can be real: browsers report null when unknown, NaN heading while
// stationary and some platforms -1 for "invalid", and other clients' payloads aren't validated.
// Shared by the publisher and the subscriber so both apply the same rule.
export const sanitizeMotion = ({
  speed,
  heading,
}: {
  speed?: number | null
  heading?: number | null
}): Motion => {
  const motion: Motion = {}
  if (isFiniteNumber(speed) && speed >= 0) motion.speed = speed
  if (isFiniteNumber(heading) && heading >= 0 && heading <= 360) {
    motion.heading = normalizeDegrees(heading)
  }
  return motion
}

export const hasMotionData = ({ speed, heading }: Motion): boolean =>
  speed !== undefined || heading !== undefined

// Decide what motion indicators to show for a fix that is ageMs old.
// speedText: speed is known and the fix is fresh; below the moving threshold it reads 0 km/h
// so GPS jitter on a stationary target doesn't flicker the label.
// heading: also moving (speed above threshold, or speed unknown but heading reported).
export const motionState = ({ speed, heading }: Motion, ageMs: number): MotionState => {
  // An unparseable timestamp yields NaN and is treated as stale
  if (!(ageMs <= MOTION_STALE_MS)) return {}

  const moving = speed === undefined || speed >= MOVING_MIN_SPEED_MS
  const state: MotionState = {}
  if (speed !== undefined) state.speedText = formatSpeedKmh(moving ? speed : 0)
  if (heading !== undefined && moving) state.heading = heading
  return state
}

// Return a cumulative rotation equivalent to targetDeg that is reached from prevDeg the short way,
// so a CSS transition goes 350 -> 370 instead of spinning back 350 -> 10.
export const shortestRotation = (prevDeg: number, targetDeg: number): number => {
  const delta = normalizeDegrees(targetDeg - prevDeg + 180) - 180
  return prevDeg + delta
}

// Human-readable summary such as "32 km/h · NE"; empty when there is nothing to show
export const formatMotion = ({ speedText, heading }: MotionState, separator = ' · '): string => {
  const direction = heading !== undefined ? compassPoint(heading) : undefined
  return [speedText, direction].filter(Boolean).join(separator)
}

export const describeMotion = (
  marker: Pick<MarkerData, 'timestamp' | 'speed' | 'heading'>,
  now: number = Date.now(),
  separator?: string,
) => formatMotion(motionState(marker, now - parseISO(marker.timestamp).getTime()), separator)
