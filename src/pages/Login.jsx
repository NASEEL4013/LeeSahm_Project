import { useState } from 'react'
import { useAuth } from '../AuthContext.jsx'
import { isSupabaseReady, supabase } from '../supabase.js'

export default function Login() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function signIn(event) {
    event.preventDefault(); setSending(true); setMessage('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/compose` } })
    setMessage(error ? '로그인 메일을 보내지 못했어. 주소를 확인해줘.' : '메일함에서 로그인 링크를 눌러줘. 현재 조합은 이 브라우저에 보관돼 있어.')
    setSending(false)
  }

  if (!isSupabaseReady) return <div className="account-page"><p className="eyebrow">Account</p><h1>로그인 준비 중</h1><p>게시판 저장소 연결이 끝나면 로그인할 수 있어.</p></div>
  if (loading) return <div className="account-page"><p>계정을 확인하는 중...</p></div>
  if (user) return <div className="account-page"><p className="eyebrow">Account</p><h1>로그인됨</h1><p>{user.email}</p><button className="button button-dark" onClick={() => supabase.auth.signOut()}>로그아웃</button></div>

  return (
    <div className="account-page">
      <p className="eyebrow">Account</p><h1>로그인</h1>
      <p>비밀번호 없이 이메일로 받은 링크를 누르면 로그인돼.</p>
      <form className="login-form" onSubmit={signIn}><label>이메일<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="button button-dark" disabled={sending}>{sending ? '보내는 중...' : '로그인 링크 받기'}</button></form>
      {message && <p className="form-message">{message}</p>}
    </div>
  )
}
