import assert from 'node:assert/strict'
import { compositionFrame, findLargestOpenPlacement, findOpenPosition, overlaps, quarterTurn, scaleLayers, withinCanvas } from '../src/editorGeometry.js'

const square = { x: 0, y: 0, width: 100, ratio: 1, rotation: 0 }
assert.equal(overlaps(square, { ...square, x: 100 }), false, '맞닿은 작품은 겹침이 아니다')
assert.equal(overlaps(square, { ...square, x: 99 }), true, '1px 겹침을 감지해야 한다')
assert.equal(overlaps({ ...square, rotation: 45 }, { ...square, x: 100 }), true, '회전된 작품도 감지해야 한다')
assert.deepEqual(findOpenPosition(square, [square], { width: 220, height: 140 }, 20), { x: 100, y: 0 })
assert.deepEqual(findLargestOpenPlacement({ ...square, width: 100 }, [{ ...square, width: 120 }], { width: 200, height: 100 }, 40, 20), { ...square, x: 120, y: 0, width: 80 })
assert.equal(quarterTurn(44), 0)
assert.equal(quarterTurn(46), 90)
assert.equal(quarterTurn(226), 270)
assert.deepEqual(scaleLayers([{ ...square, x: 100 }], { x: 0, y: 0 }, 2)[0], { ...square, x: 200, width: 200 })
assert.equal(withinCanvas([square], { width: 100, height: 100 }), true)
assert.equal(withinCanvas([{ ...square, x: -1 }], { width: 100, height: 100 }), false)
assert.deepEqual(compositionFrame([{ ...square, x: 20, y: 30 }]), { left: 20, top: 30, width: 100, height: 100, layers: [{ ...square, x: 0, y: 0 }] })

console.log('editor geometry check passed')
