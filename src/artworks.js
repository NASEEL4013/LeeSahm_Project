export const ARTWORK_SERIES = [
  ['wave', 'Wave', '/artworks/data.json'],
  ['notes', 'Notes', '/artworks/notes/data.json'],
]

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
