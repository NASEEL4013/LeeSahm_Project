import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { isAGroupArtwork, loadArtworks, migrateArtworkDraft } from './artworks.js'

test('approved A group contains 93 Wave and 9 Sahm works with original identities', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/artworks/data.json', import.meta.url), 'utf8'))
    .map((art) => ({ ...art, series: 'wave' }))
  const selected = catalog.filter(isAGroupArtwork)
  assert.equal(selected.length, 102)
  assert.equal(new Set(selected.map((art) => art.id)).size, 102)
  assert.equal(selected.filter((art) => art.title.startsWith('wave-')).length, 93)
  assert.deepEqual(selected.filter((art) => art.title.startsWith('sahm-')).map((art) => art.title).sort(),
    ['sahm-002', 'sahm-003', 'sahm-005', 'sahm-006', 'sahm-007', 'sahm-008', 'sahm-009', 'sahm-012', 'sahm-014'])
  assert.equal(isAGroupArtwork({ title: 'WAVE-001', series: 'wave' }), true)
  assert.equal(isAGroupArtwork({ title: 'sahm-001', series: 'wave' }), false)
  assert.equal(isAGroupArtwork({ title: 'wave-002', series: 'wave' }), false)
  assert.equal(isAGroupArtwork({ title: 'WAVE-001', series: 'notes' }), false)
  const draft = { artworkSeries: 'a-group', layers: [selected[0]] }
  assert.deepEqual(migrateArtworkDraft(draft), draft)
})

test('Sahm artwork loads inside Wave with its saved identity and only two catalogs', async (t) => {
  const catalogs = {
    '/artworks/data.json': [{ id: 419, title: 'wave-419' }, { id: 20001, title: 'sahm-001' }],
    '/artworks/notes/data.json': [{ id: 10001, title: 'SAHMLEE1' }],
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.cache, 'no-cache')
    assert.ok(catalogs[url], `Unexpected catalog: ${url}`)
    return { ok: true, json: async () => catalogs[url] }
  })
  const artworks = await loadArtworks()
  assert.deepEqual(artworks.map(({ id, series }) => [id, series]), [[419, 'wave'], [20001, 'wave'], [10001, 'notes']])
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }))
  await assert.rejects(loadArtworks(), /작품 목록/)
})

test('existing Sahm drafts switch to Wave without changing saved geometry or image paths', () => {
  const layer = { id: 20001, series: 'sahm', x: 32, y: 80, rotation: 90, previewUrl: '/artworks/sahm/previews/001.webp' }
  const draft = { artworkSeries: 'sahm', layers: [layer], postTitle: 'Existing draft' }
  assert.deepEqual(migrateArtworkDraft(draft), { ...draft, artworkSeries: 'wave', layers: [{ ...layer, series: 'wave' }] })
  assert.equal(draft.layers[0].series, 'sahm')
  const notes = { artworkSeries: 'notes', layers: [{ id: 10001, series: 'notes' }] }
  assert.deepEqual(migrateArtworkDraft(notes), notes)
})
