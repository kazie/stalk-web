import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { englishLabel, toEnglishLabels, withElevation } from '../mapStyles'

const style = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
    {
      id: 'label_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: {
        'text-field': [
          'case',
          ['has', 'name:nonlatin'],
          ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']],
          ['coalesce', ['get', 'name_en'], ['get', 'name']],
        ],
        'text-size': 14,
      },
    },
    {
      id: 'road_shield',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      layout: { 'text-field': ['to-string', ['get', 'ref']] },
    },
    { id: 'icon_only', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi' },
  ],
} as StyleSpecification

describe('toEnglishLabels', () => {
  const result = toEnglishLabels(style)
  const layer = (id: string) => result.layers.find((l) => l.id === id) as any

  it('prefers English names on name-based label layers', () => {
    expect(layer('label_city').layout['text-field']).toEqual(englishLabel)
  })

  it('keeps other layout properties', () => {
    expect(layer('label_city').layout['text-size']).toBe(14)
  })

  it('leaves non-name labels and non-symbol layers alone', () => {
    expect(layer('road_shield')).toBe(style.layers[3])
    expect(layer('background')).toBe(style.layers[0])
    expect(layer('water')).toBe(style.layers[1])
    expect(layer('icon_only')).toBe(style.layers[4])
  })

  it('does not mutate the input style', () => {
    expect((style.layers[2] as any).layout['text-field'][0]).toBe('case')
  })
})

describe('withElevation', () => {
  const result = withElevation(style)

  it('adds hill shading below the first label layer', () => {
    expect(result.layers.map((layer) => layer.id)).toEqual([
      'background',
      'water',
      'hillshade',
      'label_city',
      'road_shield',
      'icon_only',
    ])
  })

  it('adds 3D terrain from its own elevation source', () => {
    expect(result.terrain).toEqual({ source: 'terrain' })
    expect(result.sources.terrain?.type).toBe('raster-dem')
    expect(result.sources.hillshade?.type).toBe('raster-dem')
  })
})
