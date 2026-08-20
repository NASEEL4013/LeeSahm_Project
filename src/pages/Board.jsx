import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { isSupabaseReady, supabase } from '../supabase.js'

const thumbnailUrl = (path) => supabase.storage.from('composition-thumbnails').getPublicUrl(path).data.publicUrl

export default function Board() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(isSupabaseReady)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.from('compositions').select('id,title,description,author_name,thumbnail_path,created_at').order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => { setPosts(data ?? []); setError(loadError ? '게시물을 불러오지 못했어.' : ''); setLoading(false) })
  }, [])

  return (
    <div className="page-shell board-page">
      <div className="page-heading"><div><p className="eyebrow">Community</p><h1 className="display-title">Compositions</h1></div><div><p>Lee Sahm의 작품으로 만든 조합과 그 이야기를 만나보세요.</p>{user ? <Link className="text-link" to="/compose">새 작품 만들기 →</Link> : <Link className="text-link" to="/login">로그인하고 게시하기 →</Link>}</div></div>
      {!isSupabaseReady && <p className="status">게시판 저장소 연결을 기다리고 있어.</p>}
      {loading && <p className="status">게시물을 불러오는 중...</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && isSupabaseReady && !error && !posts.length && <p className="status">아직 게시된 조합이 없어. 첫 작품을 만들어봐.</p>}
      <div className="post-grid">{posts.map((post) => <Link className="post-card" to={`/board/${post.id}`} key={post.id}><img src={thumbnailUrl(post.thumbnail_path)} alt={post.title} loading="lazy" /><div><p>{post.author_name}</p><h2>{post.title}</h2><span>{post.description}</span><time>{new Date(post.created_at).toLocaleDateString('ko-KR')}</time></div></Link>)}</div>
    </div>
  )
}
