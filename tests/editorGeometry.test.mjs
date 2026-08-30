import assert from 'node:assert/strict'
import test from 'node:test'
import { boundedExportScale, physicalMapping } from '../src/editorGeometry.js'

test('boundedExportScale respects source, edge, and pixel limits', () => {
  const frame = { width: 1000, height: 1000 }
  assert.equal(boundedExportScale(frame, [4, 3], 16384, 48_000_000), 4)
  assert.equal(boundedExportScale(frame, [40], 3000, 48_000_000), 3)
  assert.equal(boundedExportScale(frame, [40], 16384, 4_000_000), 2)
})

test('physicalMapping keeps artwork identity and ratio for reliable editing', () => {
  const mapping = physicalMapping([{ id: 7, title: 'wave-007', x: 0, y: 0, width: 420, ratio: 0.75, rotation: 0 }], 1)
  assert.deepEqual(mapping.placements[0], { artworkId: 7, title: 'wave-007', ratio: 0.75, x: 0, y: 0, rotation: 0 })
})
