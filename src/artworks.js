export const ARTWORK_SERIES = [
  ['wave', 'Wave', '/artworks/data.json'],
  ['notes', 'Notes', '/artworks/notes/data.json'],
]

// A군: LEESAHM_ABC_INTEGRATED_APPROVED_2026-10-05.pdf, pages 2–7 (102 works).
const A_GROUP_TITLES = new Set([
  ...[1, 17, 22, 25, 27, 36, 43, 44, 48, 52, 57, 63, 78, 83, 86, 91, 94, 101, 106, 112,
    119, 120, 123, 125, 132, 138, 147, 150, 151, 156, 160, 163, 164, 165, 168, 175, 178, 179, 181, 184,
    191, 193, 198, 200, 206, 212, 216, 221, 222, 223, 226, 233, 237, 238, 241, 245, 246, 247, 250, 252,
    254, 255, 259, 267, 269, 272, 275, 278, 282, 286, 287, 295, 298, 300, 307, 311, 317, 318, 325, 332,
    335, 344, 354, 355, 359, 366, 383, 388, 394, 406, 413, 421, 424].map((number) => `wave-${String(number).padStart(3, '0')}`),
  ...[2, 3, 5, 6, 7, 8, 9, 12, 14].map((number) => `sahm-${String(number).padStart(3, '0')}`),
])

export function isAGroupArtwork(artwork) {
  return artwork.series === 'wave' && A_GROUP_TITLES.has(artwork.title.toLowerCase())
}

export function migrateArtworkDraft(draft) {
  return {
    ...draft,
    artworkSeries: (draft.artworkSeries ?? draft.layers?.[0]?.series) === 'sahm' ? 'wave' : draft.artworkSeries,
    layers: draft.layers.map((layer) => layer.series === 'sahm' ? { ...layer, series: 'wave' } : layer),
  }
}

export async function loadArtworks() {
  const collections = await Promise.all(ARTWORK_SERIES.map(async ([series, , url]) => {
    const response = await fetch(url, { cache: 'no-cache' })
    if (!response.ok) throw new Error('작품 목록을 불러오지 못했습니다.')
    return (await response.json()).map((artwork) => ({ ...artwork, series }))
  }))
  return collections.flat()
}
