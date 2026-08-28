import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadBlob } from '../src/download.js'

test('downloadBlob clicks an attached link before revoking its URL', () => {
  const calls = []
  const link = {
    click: () => calls.push('click'),
    remove: () => calls.push('remove'),
  }
  const originalDocument = globalThis.document
  const originalWindow = globalThis.window
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL

  globalThis.document = {
    createElement: () => link,
    body: { append: () => calls.push('append') },
  }
  globalThis.window = { setTimeout: (callback) => { calls.push('timeout'); callback() } }
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => calls.push('revoke')

  try {
    downloadBlob(new Blob(['test']), 'test.txt')
    assert.equal(link.href, 'blob:test')
    assert.equal(link.download, 'test.txt')
    assert.deepEqual(calls, ['append', 'click', 'remove', 'timeout', 'revoke'])
  } finally {
    globalThis.document = originalDocument
    globalThis.window = originalWindow
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})
