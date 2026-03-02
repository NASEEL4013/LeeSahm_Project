import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './Editor.css'

export default function Editor() {
    const [searchParams] = useSearchParams()
    const canvasRef = useRef(null)
    const imageRef = useRef(null)

    // 편집 옵션 상태 (필터)
    const [brightness, setBrightness] = useState(100)
    const [contrast, setContrast] = useState(100)
    const [saturation, setSaturation] = useState(100)
    const [blur, setBlur] = useState(0)

    // 커스텀 텍스트 옵션
    const [text, setText] = useState('')
    const [textColor, setTextColor] = useState('#ffffff')

    // URL에서 전달된 이미지를 가져오거나 기본 이미지를 세팅
    const imageUrl = searchParams.get('img') || 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop'

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.crossOrigin = 'anonymous' // CORS 문제 방지

        img.onload = () => {
            imageRef.current = img
            // 캔버스 크기를 이미지 비율에 맞춰 조정
            const maxWidth = 800
            const scale = Math.min(maxWidth / img.width, 1)
            canvas.width = img.width * scale
            canvas.height = img.height * scale
            applyFilters()
        }
        img.src = imageUrl
    }, [imageUrl])

    const applyFilters = () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const img = imageRef.current
        if (!img) return

        // 필터 초기화 후 캔버스 클리어
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // CSS 필터 문자열 조립
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // 텍스트 추가 (있는 경우)
        if (text) {
            ctx.filter = 'none' // 텍스트에는 이미지 필터가 적용되지 않도록 초기화
            ctx.font = 'bold 48px Inter'
            ctx.fillStyle = textColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            // 텍스트 테두리(stroke) 주기
            ctx.strokeStyle = 'black'
            ctx.lineWidth = 4
            ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
            ctx.fillText(text, canvas.width / 2, canvas.height / 2)
        }
    }

    // 필터나 텍스트가 변경될 때마다 캔버스 다시 그리기
    useEffect(() => {
        applyFilters()
    }, [brightness, contrast, saturation, blur, text, textColor])

    const handleDownload = () => {
        const canvas = canvasRef.current
        const link = document.createElement('a')
        link.download = 'leesahm_edited_art.png'
        link.href = canvas.toDataURL()
        link.click()
    }

    const handleReset = () => {
        setBrightness(100)
        setContrast(100)
        setSaturation(100)
        setBlur(0)
        setText('')
    }

    return (
        <div className="page editor">
            <header className="editor-header">
                <h2>Canvas Editor</h2>
                <p>나만의 감각으로 원본 작품을 새롭게 디자인하세요.</p>
            </header>

            <div className="editor-layout">
                <div className="canvas-container">
                    <canvas ref={canvasRef}></canvas>
                </div>

                <div className="controls-panel">
                    <h3>Filters</h3>

                    <div className="control-group">
                        <label>Brightness: {brightness}%</label>
                        <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} />
                    </div>

                    <div className="control-group">
                        <label>Contrast: {contrast}%</label>
                        <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} />
                    </div>

                    <div className="control-group">
                        <label>Saturation: {saturation}%</label>
                        <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(e.target.value)} />
                    </div>

                    <div className="control-group">
                        <label>Blur: {blur}px</label>
                        <input type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(e.target.value)} />
                    </div>

                    <h3>Add Text</h3>
                    <div className="control-group">
                        <input
                            type="text"
                            placeholder="텍스트를 입력하세요"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="text-input"
                        />
                        <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="color-picker"
                        />
                    </div>

                    <div className="action-buttons">
                        <button className="btn-action reset" onClick={handleReset}>Reset All</button>
                        <button className="btn-action download" onClick={handleDownload}>Download Art</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
