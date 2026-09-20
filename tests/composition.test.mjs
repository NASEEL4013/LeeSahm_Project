import assert from 'node:assert/strict'
import test from 'node:test'
import { CM_PER_PIXEL, restoreComposition } from '../src/composition.js'
import { physicalMapping } from '../src/editorGeometry.js'

test('saved mapping preserves coordinates, rotations and ratios in the detail map', async () => {
  const layers = [
    { id: 1, title: 'wave-001', x: 120, y: 120, width: 420, ratio: 0.75, rotation: 90 },
    { id: 2, title: 'wave-002', x: 300, y: 140, width: 336, ratio: 1.25, rotation: 270 },
  ]
  const mapping = physicalMapping(layers, CM_PER_PIXEL)
  const saved = { format: 'leesahm-mapping', version: 1, composition: mapping, placements: mapping.placements }
  const restored = await restoreComposition(saved, layers, { allowOverlap: true })
  assert.deepEqual(physicalMapping(restored.layers, CM_PER_PIXEL), mapping)
})

test('legacy composition retains its saved size and placement', async () => {
  const layer = { artworkId: 1, title: 'wave-001', x: 40, y: 50, width: 300, ratio: 0.75, rotation: 0 }
  const restored = await restoreComposition({ format: 'leesahm-composition', version: 2, canvas: { width: 1200, height: 900 }, layers: [layer] }, [{ id: 1, title: layer.title }])
  assert.deepEqual(physicalMapping(restored.layers, CM_PER_PIXEL), physicalMapping([{ ...layer, id: 1 }], CM_PER_PIXEL))
})
