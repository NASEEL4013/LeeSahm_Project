import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Gallery from './pages/Gallery'
import Editor from './pages/Editor'
import Board from './pages/Board'
import PostDetail from './pages/PostDetail'
import Login from './pages/Login'
import { AuthProvider } from './AuthContext'
import './App.css'

function About() {
  const slides = [
    '/artworks/previews/001-1riNwZli.webp',
    '/artworks/previews/075-14ze9-ej.webp',
    '/artworks/previews/120-1ewyeyw1.webp',
    '/artworks/previews/200-16NpL5Si.webp',
    '/artworks/previews/300-1eyIdwLm.webp',
  ]
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  return (
    <div className="page-shell about-page">
      <p className="eyebrow">Artist</p>
      <h1 className="display-title">Lee Sahm</h1>
      <div className="about-grid">
        <div className="about-portrait">
          <div className="artist-slides">{slides.map((src, index) => <img key={src} className={slide === index ? 'visible' : ''} src={src} alt={`Lee Sahm 대표 작품 ${index + 1}`} />)}</div>
          <div className="slide-dots" aria-label="대표 작품 선택">{slides.map((_, index) => <button key={index} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`${index + 1}번째 작품 보기`} />)}</div>
        </div>
        <div className="about-copy">
          <p className="lead">반복되는 선은 일상이자, 시간과 노력을 묵묵히 쌓아 올린 기록이다.</p>
          <p>작은 파동이 모여 하나의 흐름이 되듯, 각각의 작품은 서로 만나고 겹치며 더 큰 에너지를 만든다.</p>
          <p>Lee Sahm의 작업은 반복과 축적, 그 안에서 생겨나는 미세한 차이에 주목한다. 화면을 가로지르는 리듬은 멈춰 있는 이미지가 아니라 계속 이어지는 시간의 단면이다.</p>
          <blockquote>“나의 파동이 당신에게 닿아, 새로운 울림이 되기를 바랍니다.”</blockquote>
          <p className="note">작가 약력과 전시 이력은 자료가 준비되는 대로 추가됩니다.</p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/compose" element={<Editor />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/board" element={<Board />} />
          <Route path="/board/:id" element={<PostDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Home />} />
        </Routes></main>
      </AuthProvider>
    </BrowserRouter>
  )
}
