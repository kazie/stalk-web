import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  GPUInitializationError,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { parseISO } from 'date-fns'
import {
  currentName,
  currentZoomLevel,
  freeRoamingMode,
  markers,
  setZoomLevel,
  ZoomLevel,
  zoomLevelOptions,
  type MarkerData,
} from '@/services/markerService'
import { formatMotion, motionState, shortestRotation, type MotionState } from '@/services/motion'
import { getRelativeTime } from '@/services/timeTool'
import { addStyleSwitcher } from './mapStyles'

// MapLibre resolves its worker next to its own module, which Vite neither serves nor emits.
setWorkerUrl(workerUrl)

const WEBGL_ERROR =
  "The map can't be shown because your browser doesn't support WebGL 2. The list of people still works."
const CONTEXT_LOST_ERROR = 'The map stopped working because the browser lost its WebGL context.'

// The marker and popup are built once; each tick only touches what changed.
type MarkerRecord = {
  marker: Marker
  data: MarkerData
  // data.timestamp parsed once, as epoch ms (NaN when unparseable)
  timestampMs: number
  // Last state written to the DOM, so ticks only touch what changed
  motion: MotionState | null
  // Cumulative orbit rotation in degrees, so CSS transitions take the shortest way round
  rotation: number
  frame: HTMLElement
  orbit: HTMLElement
  speedLabel: HTMLElement
  popupTime: Text
  popupMotion: HTMLElement
}

const buildAvatarUrl = (name: string): string => {
  const url = new URL('https://ui-avatars.com/api/')
  url.search = new URLSearchParams({
    name,
    background: 'random',
    format: 'svg',
    rounded: 'true',
  }).toString()
  return url.toString()
}

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  element.className = className
  parent?.appendChild(element)
  return element
}

const createAvatar = (name: string, parent: HTMLElement): HTMLImageElement => {
  const avatar = createElement('img', 'stalk-avatar', parent)
  avatar.width = avatar.height = 50
  avatar.alt = name
  if (name.toLowerCase() === 'kazie') {
    avatar.src = 'https://avatars.githubusercontent.com/u/1390887'
    avatar.classList.add('rounded-icon')
  } else {
    avatar.src = buildAvatarUrl(name)
  }
  return avatar
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// Avatar ball with a direction arrow orbiting just outside it and a speed label on its lower rim.
// The frame counter-rotates with the map's bearing (no transition, so it tracks map rotation
// exactly) and the orbit inside it turns to the heading (with a transition).
const createMarkerElement = (name: string) => {
  const root = createElement('div', 'stalk-marker')
  createAvatar(name, root)

  const frame = createElement('div', 'heading-frame', root)
  const orbit = createElement('div', 'heading-orbit', frame)
  orbit.hidden = true
  // SVG rather than a CSS-border triangle so the arrow can have a real outline
  const arrow = document.createElementNS(SVG_NS, 'svg')
  arrow.setAttribute('class', 'heading-arrow')
  arrow.setAttribute('viewBox', '0 0 16 14')
  const shape = document.createElementNS(SVG_NS, 'polygon')
  shape.setAttribute('points', '8,1.5 14.5,12.5 1.5,12.5')
  arrow.appendChild(shape)
  orbit.appendChild(arrow)

  const speedLabel = createElement('div', 'speed-label', root)
  speedLabel.hidden = true
  return { root, frame, orbit, speedLabel }
}

// Popup built from DOM nodes, so the name never needs escaping
const createPopupContent = (name: string) => {
  const content = createElement('div', '')
  createElement('b', '', content).textContent = name
  const popupTime = document.createTextNode('')
  content.append(' ', popupTime)
  const popupMotion = createElement('div', '', content)
  popupMotion.hidden = true
  return { content, popupTime, popupMotion }
}

const createMarker = (data: MarkerData, bearing: number): MarkerRecord => {
  const { root, frame, orbit, speedLabel } = createMarkerElement(data.name)
  const { content, popupTime, popupMotion } = createPopupContent(data.name)
  const marker = new Marker({ element: root }).setPopup(
    new Popup({ offset: 25 }).setDOMContent(content),
  )
  frame.style.transform = `rotate(${-bearing}deg)`
  return {
    marker,
    data,
    timestampMs: parseISO(data.timestamp).getTime(),
    motion: null,
    rotation: 0,
    frame,
    orbit,
    speedLabel,
    popupTime,
    popupMotion,
  }
}

// The toolbar preset closest to a free zoom, so a pinch-zoomed view survives re-centering
const nearestZoomLevel = (zoom: number): ZoomLevel =>
  zoomLevelOptions
    .map((option) => option.level)
    .reduce((best, level) => (Math.abs(level - zoom) < Math.abs(best - zoom) ? level : best))

const sameMotion = (a: MotionState | null, b: MotionState): boolean =>
  a !== null && a.speedText === b.speedText && a.heading === b.heading

// Sync the arrow and speed label with the given motion state. Mutates the existing DOM so the
// rotation transition stays smooth and nothing flickers. Returns whether anything changed.
const applyMotion = (record: MarkerRecord, motion: MotionState): boolean => {
  if (sameMotion(record.motion, motion)) return false
  record.motion = motion
  const { speedText, heading } = motion
  if (heading !== undefined) {
    record.rotation = shortestRotation(record.rotation, heading)
    record.orbit.style.transform = `rotate(${record.rotation}deg)`
  }
  record.orbit.hidden = heading === undefined
  record.speedLabel.textContent = speedText ?? ''
  record.speedLabel.hidden = speedText === undefined
  return true
}

// motionChanged comes from applyMotion, so unchanged motion text isn't rebuilt every tick
const updatePopup = (record: MarkerRecord, motionChanged: boolean): void => {
  record.popupTime.data = getRelativeTime(record.timestampMs)
  if (!motionChanged) return
  record.popupMotion.textContent = formatMotion(record.motion ?? {})
  record.popupMotion.hidden = !record.popupMotion.textContent
}

export const useMapMarkers = () => {
  const mapContainer = ref<HTMLElement | null>(null)
  const mapError = ref<string | null>(null)
  let autoEnforcedFreeRoaming = false
  // The next stop of free roaming must not re-fit: the update that stops it fits already, or the
  // markers it needs are still on their way
  let skipRefit = false
  let map: MapLibreMap | null = null
  const markerByName = new Map<string, MarkerRecord>()
  let popupUpdateTimer: ReturnType<typeof setTimeout> | null = null

  const refreshMarkers = (): void => {
    const now = Date.now()
    for (const record of markerByName.values()) {
      const motionChanged = applyMotion(record, motionState(record.data, now - record.timestampMs))
      updatePopup(record, motionChanged)
    }
  }

  // Fixes under a minute old (which covers MOTION_STALE_MS) tick every second
  const computeNextDelayMs = (): number => {
    const now = Date.now()
    for (const record of markerByName.values()) {
      if (now - record.timestampMs < 60_000) return 1000
    }
    return Math.max(500, 60_000 - (now % 60_000))
  }

  // Refresh now, then reschedule: fresh data may need a faster tick than the pending one
  const tick = (): void => {
    refreshMarkers()
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    popupUpdateTimer = setTimeout(tick, computeNextDelayMs())
  }

  // Arrows show true-north headings, so counter-rotate them when the map is rotated.
  const syncBearing = (): void => {
    if (!map) return
    const transform = `rotate(${-map.getBearing()}deg)`
    for (const record of markerByName.values()) record.frame.style.transform = transform
  }

  const updateMapMarkers = (): void => {
    if (!map) return

    if (markers.value.length === 0) {
      if (!freeRoamingMode.value) {
        freeRoamingMode.value = true
        autoEnforcedFreeRoaming = true
      }
    } else if (autoEnforcedFreeRoaming && freeRoamingMode.value) {
      skipRefit = true
      freeRoamingMode.value = false
      autoEnforcedFreeRoaming = false
    }

    const bounds = new LngLatBounds()
    const incomingNames = new Set<string>()

    for (const markerData of markers.value) {
      const { name, latitude, longitude } = markerData
      incomingNames.add(name)
      const position: [number, number] = [longitude, latitude]
      bounds.extend(position)

      const existing = markerByName.get(name)
      if (existing) {
        existing.marker.setLngLat(position)
        // Unchanged markers keep their object identity, so only parse what actually changed
        if (existing.data !== markerData) {
          existing.data = markerData
          existing.timestampMs = parseISO(markerData.timestamp).getTime()
        }
        // Motion indicators and popup are synced by tick() below
      } else {
        const record = createMarker(markerData, map.getBearing())
        // Set the initial state before the marker hits the DOM so it doesn't animate in from 0deg
        applyMotion(record, motionState(markerData, Date.now() - record.timestampMs))
        updatePopup(record, true)
        // MapLibre needs the position before the marker joins the map.
        record.marker.setLngLat(position).addTo(map)
        markerByName.set(name, record)
      }
    }

    for (const [name, record] of markerByName.entries()) {
      if (!incomingNames.has(name)) {
        record.marker.remove()
        markerByName.delete(name)
      }
    }

    const [only, ...others] = markers.value
    if (only && !freeRoamingMode.value) {
      if (others.length === 0)
        map.easeTo({ center: [only.longitude, only.latitude], zoom: currentZoomLevel.value })
      // Keep the user's rotation, and don't zoom past the tiles' detail for markers close together.
      else
        map.fitBounds(bounds, {
          padding: 50,
          bearing: map.getBearing(),
          maxZoom: ZoomLevel.Close,
        })
    }
    tick()
  }

  watch(markers, updateMapMarkers, { deep: true })

  // The user zoomed (pinch, wheel, +/- buttons) since following stopped
  let userZoomed = false

  // Moving the map by hand stops following the targets, so the next update doesn't snap it back.
  // Every frame of a user's move carries originalEvent (drag, pinch, wheel, keyboard, the zoom
  // and compass buttons); our own easeTo/fitBounds don't.
  const onUserMove = (event: { type: string; originalEvent?: unknown }): void => {
    if (!event.originalEvent || markers.value.length === 0) return
    if (event.type === 'zoom') userZoomed = true
    autoEnforcedFreeRoaming = false
    freeRoamingMode.value = true
  }

  // Follow the targets again. A single target keeps a pinch-zoomed level, as the nearest preset.
  const resumeFollowing = (): void => {
    const keepZoom = userZoomed && markers.value.length === 1
    userZoomed = false
    if (map && keepZoom) {
      const level = nearestZoomLevel(map.getZoom())
      if (level !== currentZoomLevel.value) {
        setZoomLevel(level) // its watcher re-fits
        return
      }
    }
    updateMapMarkers()
  }

  // Covers the Follow button and the toolbar toggle alike
  watch(freeRoamingMode, (roaming) => {
    if (roaming) return
    if (skipRefit) skipRefit = false
    else resumeFollowing()
  })

  // A zoom level picked in the toolbar applies right away, and wins over an earlier pinch
  watch(currentZoomLevel, () => {
    userZoomed = false
    if (!freeRoamingMode.value) updateMapMarkers()
  })

  // Picking another target (or everyone) follows again. Sync, so it's in place before the new
  // markers arrive; they do the fit.
  watch(
    currentName,
    () => {
      userZoomed = false
      if (!freeRoamingMode.value || autoEnforcedFreeRoaming) return
      skipRefit = true
      freeRoamingMode.value = false
    },
    { flush: 'sync' },
  )

  // Re-fits even when already following, e.g. after tapping the current target
  const recenter = (): void => {
    if (freeRoamingMode.value) freeRoamingMode.value = false
    else resumeFollowing()
  }

  const createMap = (container: HTMLElement): MapLibreMap | null => {
    try {
      return new MapLibreMap({ container, center: [15, 62], zoom: ZoomLevel.CountryFar })
    } catch (error) {
      if (!(error instanceof GPUInitializationError)) throw error
      console.error(error)
      mapError.value = WEBGL_ERROR
      return null
    }
  }

  onMounted(() => {
    if (!mapContainer.value) return
    map = createMap(mapContainer.value)
    if (!map) return

    // Zoom buttons plus a compass that shows the tilt; clicking it resets to north-up and flat.
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-left')
    addStyleSwitcher(map)
    map.on('rotate', syncBearing)
    map.on('move', onUserMove)
    map.on('zoom', onUserMove)
    // A lost context (GPU reset, driver crash, too many tabs) leaves a blank map.
    map.on('webglcontextlost', () => {
      mapError.value = CONTEXT_LOST_ERROR
    })
    map.on('webglcontextrestored', () => {
      if (mapError.value === CONTEXT_LOST_ERROR) mapError.value = null
    })

    // Markers may have arrived before the map was created. Fit again once loaded, as the
    // container may only have its final size by then; MapLibre tracks later resizes itself.
    updateMapMarkers()
    map.once('load', updateMapMarkers)
  })

  onUnmounted(() => {
    if (popupUpdateTimer) clearTimeout(popupUpdateTimer)
    map?.remove()
    map = null
  })

  return { mapContainer, mapError, recenter }
}
