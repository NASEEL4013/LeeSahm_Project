import assert from 'node:assert/strict'
import test from 'node:test'
import { boundedExportScale } from '../src/editorGeometry.js'

test('boundedExportScale respects source, edge, and pixel limits', () => {
  const frame = { width: 1000, height: 1000 }
  assert.equal(boundedExportScale(frame, [4, 3], 16384, 48_000_000), 4)
  assert.equal(boundedExportScale(frame, [40], 3000, 48_000_000), 3)
  assert.equal(boundedExportScale(frame, [40], 16384, 4_000_000), 2)
})
