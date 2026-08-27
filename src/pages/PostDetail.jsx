import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { supabase } from '../supabase.js'

export default function PostDetail() {
  const { id } = useParams(); const navigate = useNavigate(); const { user } = useAuth()
  const [post, setPost] = useState(null); const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [category, setCategory] = useState(1); const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.from('compositions').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) return setMessage('게시물을 찾지 못했어.')
      setPost(data); setTitle(data.title); setDescription(data.description); setCategory(data.category ?? 1)
    })
  }, [id])

  async function save() {
    const { error } = await supabase.from('compositions').update({ title: title.trim(), description: description.trim(), category, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return setMessage('수정하지 못했어.')
    setPost({ ...post, title: title.trim(), description: description.trim(), category }); setEditing(false); setMessage('수정했어.')
  }

  async function remove() {
    if (!window.confirm('이 게시물을 삭제할까?')) return
    const { error } = await supabase.from('compositions').delete().eq('id', id)
    if (error) return setMessage('삭제하지 못했어.')
    await supabase.storage.from('composition-thumbnails').remove([post.thumbnail_path])
    navigate('/board')
  }

  function downloadMap() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(post.composition, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `leesahm-${post.id}.json`; link.click(); URL.revokeObjectURL(url)
  }

  if (!post) return <div className="page-shell"><p className={message ? 'status error' : 'status'}>{message || '게시물을 불러오는 중...'}</p></div>
  const image = supabase.storage.from('composition-thumbnails').getPublicUrl(post.thumbnail_path).data.publicUrl
  const mine = user?.id === post.user_id
  const admin = user?.app_metadata?.role === 'admin'
  return (
    <article className="post-detail">
      <Link className="text-link" to="/board">← 게시판</Link>
      <div className="post-detail-grid"><div className="post-detail-image"><img src={image} alt={post.title} /></div><div className="post-detail-copy">
        <p className="eyebrow">{post.category ? `Category ${String(post.category).padStart(2, '0')} · ` : ''}{post.author_name} · {new Date(post.created_at).toLocaleDateString('ko-KR')}</p>
        {editing ? <><label className="post-category-label">카테고리<select value={category} onChange={(event) => setCategory(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>카테고리 {value}</option>)}</select></label><input className="post-title-input" maxLength="80" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea maxLength="2000" value={description} onChange={(event) => setDescription(event.target.value)} /><button className="button button-dark" disabled={!title.trim() || !description.trim()} onClick={save}>수정 완료</button><button className="text-button" onClick={() => setEditing(false)}>취소</button></> : <><h1>{post.title}</h1><p className="post-description">{post.description}</p></>}
        <div className="used-artworks"><p>사용 작품</p><ul>{(post.composition.placements ?? post.composition.layers).map((layer) => <li key={layer.title}>{layer.title}</li>)}</ul></div>
        <button className="text-button" onClick={downloadMap}>재현용 조합 파일 다운로드</button>
        {(mine || admin) && !editing && <div className="owner-actions"><Link to={`/compose/${post.id}`}>그림 조합 수정</Link><button onClick={() => setEditing(true)}>게시물 정보 수정</button><button onClick={remove}>게시물 삭제</button></div>}
        {message && <p className="form-message">{message}</p>}
      </div></div>
    </article>
  )
}
