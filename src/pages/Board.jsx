import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { isSupabaseReady, supabase } from '../supabase.js'

const thumbnailUrl = (path) => supabase.storage.from('composition-thumbnails').getPublicUrl(path).data.publicUrl

const imageRatio = (url) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image.naturalHeight / image.naturalWidth)
  image.onerror = reject
  image.src = url
})

export default function Board() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(isSupabaseReady)
  const [error, setError] = useState('')
  const [columns, setColumns] = useState(3)
  const [category, setCategory] = useState('all')
  const [backfilling, setBackfilling] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.from('compositions').select('id,title,description,author_name,thumbnail_path,category,created_at').order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => { setPosts(data ?? []); setError(loadError ? '게시물을 불러오지 못했어.' : ''); setLoading(false) })
  }, [])

  const visiblePosts = category === 'all' ? posts : posts.filter((post) => post.category === category)

  async function backfillCompositions() {
    setBackfilling(true); setError('')
    try {
      const [{ data: rows, error: loadError }, wave, notes] = await Promise.all([
        supabase.from('compositions').select('id,composition'),
        fetch('/artworks/data.json').then((response) => response.json()),
        fetch('/artworks/notes/data.json').then((response) => response.json()),
      ])
      if (loadError) throw loadError
      const artworks = new Map([...wave, ...notes].map((artwork) => [artwork.title, artwork]))
      const targets = rows.filter((row) => row.composition?.format === 'leesahm-mapping' && row.composition.version === 1)
      const ratios = new Map()
      await Promise.all([...new Set(targets.flatMap((row) => row.composition.placements.map((placement) => placement.title)))].map(async (title) => {
        const artwork = artworks.get(title)
        if (!artwork) throw new Error(`작품을 찾지 못했어: ${title}`)
        ratios.set(title, await imageRatio(artwork.previewUrl))
      }))
      for (const row of targets) {
        const composition = { ...row.composition, placements: row.composition.placements.map((placement) => ({ ...placement, artworkId: artworks.get(placement.title).id, ratio: ratios.get(placement.title) })) }
        const { error: updateError } = await supabase.from('compositions').update({ composition }).eq('id', row.id).select('id').single()
        if (updateError) throw updateError
      }
      setError(`기존 COMBI ${targets.length}개의 작품 ID와 비율을 채웠어.`)
    } catch { setError('기존 COMBI 데이터 보강에 실패했어. 다시 시도해줘.') }
    finally { setBackfilling(false) }
  }

  return (
    <div className="page-shell board-page">
      <div className="page-heading"><div><p className="eyebrow">Community</p><h1 className="display-title">COMBI</h1></div><div><p>Lee Sahm의 작품으로 만든 조합과 그 이야기를 만나보세요.</p>{user ? <Link className="text-link" to="/compose">새 작품 만들기 →</Link> : <Link className="text-link" to="/login">로그인하고 게시하기 →</Link>}</div></div>
      {!isSupabaseReady && <p className="status">게시판 저장소 연결을 기다리고 있어.</p>}
      {loading && <p className="status">게시물을 불러오는 중...</p>}
      {error && <p className="status error">{error}</p>}
      {user?.app_metadata?.role === 'admin' && <button type="button" onClick={backfillCompositions} disabled={backfilling}>{backfilling ? '기존 데이터 보강 중...' : '기존 COMBI 데이터 보강'}</button>}
      {!loading && isSupabaseReady && !error && !posts.length && <p className="status">아직 게시된 조합이 없어. 첫 작품을 만들어봐.</p>}
      {!!posts.length && <div className="board-toolbar"><div className="category-filters" aria-label="카테고리">{['all', 1, 2, 3, 4, 5].map((value) => <button type="button" className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => setCategory(value)} key={value}>{value === 'all' ? 'ALL' : String(value).padStart(2, '0')}</button>)}</div><div className="board-view-controls" aria-label="보기 밀도">{[3, 6, 10].map((count) => <button type="button" className={columns === count ? 'selected' : ''} aria-label={`한 행에 ${count}개 보기`} title={`한 행에 ${count}개 보기`} aria-pressed={columns === count} onClick={() => setColumns(count)} key={count}><span className={`density-icon density-${count}`} aria-hidden="true" /></button>)}</div></div>}
      <div className={`post-grid columns-${columns}`}>{visiblePosts.map((post) => <Link className="post-card" to={`/board/${post.id}`} key={post.id}><img src={thumbnailUrl(post.thumbnail_path)} alt={post.title} loading="lazy" /><div><p>{post.category ? `CATEGORY ${String(post.category).padStart(2, '0')} · ` : ''}{post.author_name}</p><h2>{post.title}</h2><span>{post.description}</span><time>{new Date(post.created_at).toLocaleDateString('ko-KR')}</time></div></Link>)}</div>
      {!!posts.length && !visiblePosts.length && <p className="status">이 카테고리에는 아직 게시물이 없어.</p>}
    </div>
  )
}
