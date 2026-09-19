import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadArtworks } from './artworks.js'

test('all three series load with stable identities and revalidated catalogs', async (t) => {
  const catalogs = {
    '/artworks/data.json': [{ id: 419, title: 'wave-419' }],
    '/artworks/notes/data.json': [{ id: 10001, title: 'SAHMLEE1' }],
    '/artworks/sahm/data.json': [{ id: 20001, title: 'Sahm sample' }],
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.cache, 'no-cache')
    assert.ok(catalogs[url], `Unexpected catalog: ${url}`)
    return { ok: true, json: async () => catalogs[url] }
  })
  const artworks = await loadArtworks()
  assert.deepEqual(artworks.map(({ id, series }) => [id, series]), [[419, 'wave'], [10001, 'notes'], [20001, 'sahm']])
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }))
  await assert.rejects(loadArtworks(), /작품 목록/)
})
