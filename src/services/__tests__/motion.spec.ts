import { describe, expect, it } from 'vitest'
import {
  compassPoint,
  describeMotion,
  formatSpeedKmh,
  MOTION_STALE_MS,
  motionState,
  sanitizeMotion,
  shortestRotation,
} from '../motion'

const NOW = Date.parse('2025-06-01T12:00:00Z')
const at = (msAgo: number): string => new Date(NOW - msAgo).toISOString()

describe('motion', () => {
  describe('formatSpeedKmh', () => {
    it('converts m/s to rounded km/h', () => {
      expect(formatSpeedKmh(0)).toBe('0 km/h')
      expect(formatSpeedKmh(8.9)).toBe('32 km/h')
      expect(formatSpeedKmh(8.3333)).toBe('30 km/h')
      expect(formatSpeedKmh(0.1)).toBe('0 km/h')
    })
  })

  describe('compassPoint', () => {
    it.each([
      [0, 'N'],
      [22.4, 'N'],
      [22.5, 'NE'],
      [45, 'NE'],
      [90, 'E'],
      [135, 'SE'],
      [180, 'S'],
      [225, 'SW'],
      [270, 'W'],
      [315, 'NW'],
      [337.4, 'NW'],
      [337.5, 'N'],
      [359.9, 'N'],
      [360, 'N'],
      [-90, 'W'],
    ])('%s degrees is %s', (deg, expected) => {
      expect(compassPoint(deg)).toBe(expected)
    })
  })

  describe('sanitizeMotion', () => {
    it('keeps valid values', () => {
      expect(sanitizeMotion({ speed: 0, heading: 0 })).toStrictEqual({ speed: 0, heading: 0 })
      expect(sanitizeMotion({ speed: 8.9, heading: 359.9 })).toStrictEqual({
        speed: 8.9,
        heading: 359.9,
      })
    })

    it('wraps a heading of 360 to 0', () => {
      expect(sanitizeMotion({ heading: 360 })).toStrictEqual({ heading: 0 })
    })

    it('drops null, non-finite and out-of-range values', () => {
      expect(sanitizeMotion({ speed: null, heading: null })).toStrictEqual({})
      expect(sanitizeMotion({ speed: NaN, heading: NaN })).toStrictEqual({})
      expect(sanitizeMotion({ speed: Infinity, heading: -Infinity })).toStrictEqual({})
      expect(sanitizeMotion({ speed: -1, heading: -1 })).toStrictEqual({})
      expect(sanitizeMotion({ heading: 361 })).toStrictEqual({})
    })
  })

  describe('motionState', () => {
    it('shows speed and heading for a fresh, moving fix', () => {
      expect(motionState({ speed: 8.9, heading: 45 }, 5_000)).toEqual({
        speedText: '32 km/h',
        heading: 45,
      })
    })

    it('reads 0 km/h without a heading below the moving threshold', () => {
      expect(motionState({ speed: 0.49, heading: 45 }, 0)).toEqual({ speedText: '0 km/h' })
      expect(motionState({ speed: 0, heading: 45 }, 0)).toEqual({ speedText: '0 km/h' })
      expect(motionState({ speed: 0.5, heading: 45 }, 0)).toEqual({
        speedText: '2 km/h',
        heading: 45,
      })
    })

    it('shows the heading when speed is unknown', () => {
      expect(motionState({ heading: 90 }, 0)).toEqual({ heading: 90 })
    })

    it('shows nothing without data', () => {
      expect(motionState({}, 0)).toEqual({})
    })

    it('hides everything once the fix is stale', () => {
      const marker = { speed: 25, heading: 180 }
      expect(motionState(marker, MOTION_STALE_MS)).toEqual({ speedText: '90 km/h', heading: 180 })
      expect(motionState(marker, MOTION_STALE_MS + 1)).toEqual({})
      // An unparseable timestamp gives a NaN age
      expect(motionState(marker, NaN)).toEqual({})
    })
  })

  describe('describeMotion', () => {
    it('joins speed and compass direction', () => {
      expect(describeMotion({ timestamp: at(0), speed: 8.9, heading: 45 }, NOW)).toBe(
        '32 km/h · NE',
      )
      expect(describeMotion({ timestamp: at(0), speed: 8.9, heading: 45 }, NOW, ' ')).toBe(
        '32 km/h NE',
      )
      expect(describeMotion({ timestamp: at(0), speed: 0 }, NOW)).toBe('0 km/h')
      expect(describeMotion({ timestamp: at(0), heading: 180 }, NOW)).toBe('S')
      expect(describeMotion({ timestamp: at(0) }, NOW)).toBe('')
      expect(describeMotion({ timestamp: at(MOTION_STALE_MS + 1), speed: 5 }, NOW)).toBe('')
    })
  })

  describe('shortestRotation', () => {
    it('moves directly when no wrap is involved', () => {
      expect(shortestRotation(0, 45)).toBe(45)
      expect(shortestRotation(90, 10)).toBe(10)
    })

    it('wraps forwards across 360', () => {
      expect(shortestRotation(350, 10)).toBe(370)
    })

    it('wraps backwards across 0', () => {
      expect(shortestRotation(10, 350)).toBe(-10)
    })

    it('keeps accumulating from an already wrapped rotation', () => {
      expect(shortestRotation(370, 20)).toBe(380)
      expect(shortestRotation(370, 340)).toBe(340)
      expect(shortestRotation(-10, 10)).toBe(10)
      expect(shortestRotation(720, 0)).toBe(720)
    })

    it('treats a half turn as -180', () => {
      expect(shortestRotation(0, 180)).toBe(-180)
    })
  })
})
