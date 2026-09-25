import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'ai-studio-added-lectures'
const THEME_STORAGE_KEY = 'ai-studio-theme'

// 로고나 실제 사이트 이미지 없이 색상·톤만 참고해 만든 5가지 테마.
const THEMES = [
  { id: 'default', label: '기본', swatch: '#065fd4' },
  { id: 'black', label: '블랙', swatch: '#3ea6ff' },
  { id: 'hynix', label: 'SK하이닉스풍', swatch: '#1b3a6b' },
  { id: 'eagles', label: '한화이글스풍', swatch: '#ff3b1f' },
  { id: 'youtube-dark', label: '유튜브 다크풍', swatch: '#ff0000' },
]

function loadTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.some((theme) => theme.id === saved) ? saved : 'default'
  } catch {
    return 'default'
  }
}

const INITIAL_VIDEOS = [
  {
    id: 1,
    numberLabel: 'AI 무료 강의 01',
    title: "바이브코딩 창시자의 미친 인사이트 떠먹여드립니다 | 상위 1% AI 고수들은 '하네스'에 투자합니다",
    description:
      "바이브코딩 창시자가 말하는 AI 활용 인사이트를 다룹니다. 썸네일에 강조된 '65줄짜리 CLAUDE.md'처럼, 상위 1% AI 고수들이 왜 에이전트 '하네스'에 투자하는지 핵심 메시지를 정리합니다.",
    topic: 'Claude Code',
    thumbnail: buildYouTubeThumbnailUrl('f8sEU99XqE4'),
    preview: buildYouTubeThumbnailUrl('f8sEU99XqE4'),
    duration: '18:24',
    views: '12.4만',
    uploadedLabel: '5개월 전',
    url: 'https://www.youtube.com/watch?v=f8sEU99XqE4&list=LL&index=30&t=383s',
  },
  {
    id: 2,
    numberLabel: 'AI 무료 강의 02',
    title: '바이브 코딩 필수 개념 5가지: 컨텍스트·스킬·에이전트·훅·플러그인 총정리',
    description:
      '컨텍스트, 스킬, 에이전트, 훅, 플러그인까지 바이브 코딩의 핵심 개념 다섯 가지를 실제 사례와 함께 총정리합니다.',
    topic: '바이브 코딩',
    thumbnail: buildYouTubeThumbnailUrl('H3ALu2MNc7U'),
    preview: buildYouTubeThumbnailUrl('H3ALu2MNc7U'),
    duration: '14:52',
    views: '8.7만',
    uploadedLabel: '3개월 전',
    url: 'https://www.youtube.com/watch?v=H3ALu2MNc7U&list=LL&index=14&t=1336s',
  },
  {
    id: 3,
    numberLabel: 'AI 무료 강의 03',
    title: 'RAG 어렵다고요? PDF 하나로 5분 만에 시작하는 법 (feat. 공원나연님)',
    description:
      'PDF 문서 하나만 있으면 5분 만에 시작할 수 있는 RAG 구축법을 다룹니다.',
    topic: 'RAG',
    thumbnail: buildYouTubeThumbnailUrl('AISuJHMCWog'),
    preview: buildYouTubeThumbnailUrl('AISuJHMCWog'),
    duration: '21:10',
    views: '5.2만',
    uploadedLabel: '3주 전',
    url: 'https://www.youtube.com/watch?v=AISuJHMCWog&list=LL&index=12&t=549s',
  },
]

// 저장된 값이 깨져 있어도 앱이 죽지 않도록 방어적으로 읽는다.
function loadAddedVideos() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// LLM 없이도 YouTube 링크에서 영상 ID만 추출해 공식 썸네일 이미지를 바로 가져온다.
function extractYouTubeId(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v')
      }
      const match = parsed.pathname.match(/\/(embed|shorts)\/([^/?]+)/)
      if (match) return match[2]
    }

    return null
  } catch {
    return null
  }
}

function buildYouTubeThumbnailUrl(videoId) {
  // hqdefault는 공개 영상이면 거의 항상 존재하는 해상도라 안정적으로 쓴다.
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

// 이미지를 하나도 추가하지 않았을 때 카드가 깨지지 않도록 쓰는 기본 이미지.
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="100%" height="100%" fill="#e5e5e5"/><text x="50%" y="50%" font-size="22" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" fill="#8a8a8a">이미지 없음</text></svg>',
  )

// YouTube는 공개 API로 설명 텍스트를 제공하지 않아 제목·채널명만 가져오고, 설명은 채널명 기반으로 대신 만든다.
async function fetchYouTubeInfo(url) {
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
  if (!response.ok) throw new Error('oEmbed 요청 실패')
  return response.json()
}

// 실제 업로드 날짜만 입력받아 'n일 전' 같은 표시용 라벨을 계산으로 만든다(LLM 불필요).
function formatRelativeLabel(dateString) {
  const target = new Date(dateString)
  if (Number.isNaN(target.getTime())) return '방금 전'

  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const now = new Date()
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((startOfNow - startOfTarget) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '오늘'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return `${Math.floor(diffDays / 365)}년 전`
}

function AddLectureForm({ existingTopics, onSubmit, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [topicChoice, setTopicChoice] = useState(existingTopics[0] ?? '__custom__')
  const [customTopic, setCustomTopic] = useState('')
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('')
  const [views, setViews] = useState('')
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [error, setError] = useState('')
  const [isFetching, setIsFetching] = useState(false)

  async function handleImageChange(event, setDataUrl) {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    setDataUrl(dataUrl)
  }

  async function handleAutoFill() {
    const trimmedUrl = url.trim()
    const videoId = extractYouTubeId(trimmedUrl)
    if (!videoId) {
      setError('링크에서 영상 ID를 찾지 못했습니다. YouTube 링크 형식을 확인해 주세요.')
      return
    }

    setError('')
    setIsFetching(true)
    const autoThumbnailUrl = buildYouTubeThumbnailUrl(videoId)

    try {
      const info = await fetchYouTubeInfo(trimmedUrl)
      setTitle(info.title ?? '')
      setDescription(
        `${info.author_name ?? '업로더'} 채널에서 업로드한 영상입니다. (YouTube가 설명 텍스트는 공개 API로 제공하지 않아 자동으로 만든 문구입니다. 필요하면 직접 수정하세요.)`,
      )
      setPreviewDataUrl(autoThumbnailUrl)
      setThumbnailDataUrl(autoThumbnailUrl)
    } catch {
      setError('영상 정보를 자동으로 가져오지 못했습니다. 제목과 설명을 직접 입력해 주세요.')
      setPreviewDataUrl((prev) => prev || autoThumbnailUrl)
      setThumbnailDataUrl((prev) => prev || autoThumbnailUrl)
    } finally {
      setIsFetching(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const finalTopic = topicChoice === '__custom__' ? customTopic.trim() : topicChoice

    if (!title.trim() || !url.trim() || !finalTopic) {
      setError('제목, 링크, 카테고리는 필수 항목입니다.')
      return
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      url: url.trim(),
      topic: finalTopic,
      uploadedLabel: formatRelativeLabel(uploadDate),
      duration: duration.trim(),
      views: views.trim() || '0',
      thumbnail: thumbnailDataUrl || previewDataUrl || PLACEHOLDER_IMAGE,
      preview: previewDataUrl || thumbnailDataUrl || PLACEHOLDER_IMAGE,
    })
  }

  return (
    <form className="add-lecture-form" onSubmit={handleSubmit}>
      <label className="form-field">
        제목
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>

      <label className="form-field">
        설명
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <label className="form-field">
        YouTube 링크
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => url.trim() && !title.trim() && handleAutoFill()}
          required
        />
      </label>

      <button type="button" className="btn-secondary auto-thumb-btn" onClick={handleAutoFill} disabled={isFetching}>
        {isFetching ? '가져오는 중...' : '링크로 제목·설명·이미지 자동 채우기'}
      </button>

      <label className="form-field">
        카테고리
        <select value={topicChoice} onChange={(event) => setTopicChoice(event.target.value)}>
          {existingTopics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
          <option value="__custom__">새 카테고리 직접 입력</option>
        </select>
      </label>

      {topicChoice === '__custom__' && (
        <label className="form-field">
          새 카테고리 이름
          <input
            type="text"
            value={customTopic}
            onChange={(event) => setCustomTopic(event.target.value)}
            placeholder="예: 프롬프트 엔지니어링"
          />
        </label>
      )}

      <label className="form-field">
        업로드 날짜
        <input type="date" value={uploadDate} onChange={(event) => setUploadDate(event.target.value)} required />
      </label>

      <div className="form-row">
        <label className="form-field">
          재생 시간(선택)
          <input
            type="text"
            placeholder="예: 12:34"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
        <label className="form-field">
          조회수(선택)
          <input
            type="text"
            placeholder="예: 1.2만"
            value={views}
            onChange={(event) => setViews(event.target.value)}
          />
        </label>
      </div>

      <label className="form-field">
        대표 이미지(선택, 위 버튼으로 자동 입력 가능)
        <input type="file" accept="image/*" onChange={(event) => handleImageChange(event, setPreviewDataUrl)} />
      </label>

      <label className="form-field">
        썸네일 이미지(선택, 비우면 대표 이미지 사용)
        <input type="file" accept="image/*" onChange={(event) => handleImageChange(event, setThumbnailDataUrl)} />
      </label>

      {(previewDataUrl || thumbnailDataUrl) && (
        <div className="image-preview-row">
          {previewDataUrl && (
            <img className="image-preview" src={previewDataUrl} alt="대표 이미지 미리보기" />
          )}
          {thumbnailDataUrl && (
            <img className="image-preview" src={thumbnailDataUrl} alt="썸네일 미리보기" />
          )}
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn-primary">
          추가하기
        </button>
      </div>
    </form>
  )
}

function ThemeSwitcher({ theme, onChange }) {
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="화면 테마 선택">
      {THEMES.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={theme === option.id}
          aria-label={option.label}
          title={option.label}
          className={`theme-swatch ${theme === option.id ? 'active' : ''}`}
          style={{ '--swatch-color': option.swatch }}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState('전체')
  const [subscribed, setSubscribed] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [addedVideos, setAddedVideos] = useState(loadAddedVideos)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [theme, setTheme] = useState(loadTheme)

  // 선택한 테마는 새로고침해도 유지되도록 저장한다.
  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // 새로 추가한 강의는 새로고침해도 남아있도록 저장한다.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addedVideos))
  }, [addedVideos])

  // 모바일 메뉴나 미리보기, 강의 추가 폼이 열려 있을 때 Esc로 닫을 수 있게 한다.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setNavOpen(false)
      setSelectedId(null)
      setIsAddOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const videos = useMemo(() => [...INITIAL_VIDEOS, ...addedVideos], [addedVideos])

  const topics = useMemo(
    () => ['전체', ...Array.from(new Set(videos.map((video) => video.topic)))],
    [videos],
  )

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return videos.filter((video) => {
      const matchesTopic = activeTopic === '전체' || video.topic === activeTopic
      const matchesQuery =
        normalizedQuery.length === 0 ||
        video.title.toLowerCase().includes(normalizedQuery) ||
        video.description.toLowerCase().includes(normalizedQuery)
      return matchesTopic && matchesQuery
    })
  }, [videos, query, activeTopic])

  const selectedVideo = videos.find((video) => video.id === selectedId) ?? null

  function handleAddVideo(data) {
    setAddedVideos((prev) => [...prev, { id: Date.now(), numberLabel: '내가 추가한 강의', ...data }])
    setIsAddOpen(false)
  }

  return (
    <div className="app" data-theme={theme}>
      <ThemeSwitcher theme={theme} onChange={setTheme} />
      <header className="topbar">
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label={navOpen ? '채널 메뉴 닫기' : '채널 메뉴 열기'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          ☰
        </button>
        <span className="brand">AI 스튜디오</span>
        <form className="search-form" role="search" onSubmit={(event) => event.preventDefault()}>
          <input
            type="search"
            className="search-input"
            placeholder="강의 검색"
            aria-label="강의 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="icon-btn search-btn" aria-label="검색">
            🔍
          </button>
        </form>
        <span className="avatar-btn" aria-hidden="true">
          AI
        </span>
      </header>

      <div className="layout">
        <nav className={`side-nav ${navOpen ? 'open' : ''}`} aria-label="채널 메뉴">
          <button
            type="button"
            className="icon-btn side-nav-close"
            aria-label="채널 메뉴 닫기"
            onClick={() => setNavOpen(false)}
          >
            ✕
          </button>
          <ul>
            <li>
              <a href="#home" className="nav-link active">
                홈
              </a>
            </li>
            <li>
              <a href="#videos" className="nav-link">
                동영상
              </a>
            </li>
            <li>
              <a href="#playlists" className="nav-link">
                재생목록
              </a>
            </li>
            <li>
              <a href="#community" className="nav-link">
                커뮤니티
              </a>
            </li>
            <li>
              <a href="#about" className="nav-link">
                소개
              </a>
            </li>
          </ul>
        </nav>

        {navOpen && (
          <button
            type="button"
            className="nav-scrim"
            aria-label="메뉴 배경 닫기"
            onClick={() => setNavOpen(false)}
          />
        )}

        <main className="content">
          <section className="banner intro-banner">
            <div
              className="intro-photo-layer"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(var(--accent-rgb), 0.55), rgba(var(--accent-rgb), 0.55)), url(./media/intro-baseball.png)',
              }}
            />
            <img
              className="intro-avatar"
              src="./media/정광민_사원증.jpg"
              alt="정광민 사원증 사진"
            />
            <div className="intro-text">
              <h1>안녕하세요, 정광민입니다</h1>
              <p>
                아날로그·혼성신호 회로 설계를 공부하며 AI 도구를 활용한 작업 방식에 관심이 많습니다. 이 사이트는 제가 직접 만들어가는 개인
                공간으로, 지금은 AI 강의 채널 페이지만 열려 있고 앞으로 다른 기능도 하나씩 추가할 예정입니다.
              </p>
            </div>
          </section>

          <section className="channel-header">
            <span className="channel-avatar" aria-hidden="true">
              AI
            </span>
            <div className="channel-meta">
              <h2>AI 스튜디오</h2>
              <p className="channel-stats">구독자 3.4만명 · 동영상 {videos.length}개</p>
            </div>
            <button
              type="button"
              className={`subscribe-btn ${subscribed ? 'subscribed' : ''}`}
              aria-pressed={subscribed}
              onClick={() => setSubscribed((value) => !value)}
            >
              {subscribed ? '구독 중' : '구독'}
            </button>
          </section>

          <nav className="tabs" aria-label="채널 탭">
            <button type="button" className="tab active">
              홈
            </button>
            <button type="button" className="tab">
              동영상
            </button>
            <button type="button" className="tab">
              소개
            </button>
            <button
              type="button"
              className="tab add-tab"
              onClick={() => setIsAddOpen(true)}
            >
              + 강의 추가
            </button>
          </nav>

          {isAddOpen && (
            <>
              <button
                type="button"
                className="modal-scrim"
                aria-label="강의 추가 닫기"
                onClick={() => setIsAddOpen(false)}
              />
              <section className="modal" role="dialog" aria-modal="true" aria-label="강의 추가">
                <button
                  type="button"
                  className="icon-btn modal-close"
                  aria-label="강의 추가 닫기"
                  onClick={() => setIsAddOpen(false)}
                >
                  ✕
                </button>
                <h2>강의 추가</h2>
                <AddLectureForm
                  existingTopics={topics.filter((topic) => topic !== '전체')}
                  onSubmit={handleAddVideo}
                  onCancel={() => setIsAddOpen(false)}
                />
              </section>
            </>
          )}

          <section className="filters">
            <div className="topic-filters" role="tablist" aria-label="주제 필터">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  role="tab"
                  aria-selected={activeTopic === topic}
                  className={`chip ${activeTopic === topic ? 'active' : ''}`}
                  onClick={() => setActiveTopic(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
            <p className="result-count" aria-live="polite">
              검색 결과 {filteredVideos.length}개
            </p>
          </section>

          {selectedVideo && (
            <section className="preview-panel" aria-label={`${selectedVideo.title} 미리보기`}>
              <button
                type="button"
                className="icon-btn preview-close"
                aria-label="미리보기 닫기"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
              <img
                className="preview-image"
                src={selectedVideo.preview}
                alt={`${selectedVideo.title} 영상 미리보기 화면`}
              />
              <div className="preview-info">
                <p className="video-eyebrow">{selectedVideo.numberLabel}</p>
                <h3>{selectedVideo.title}</h3>
                <p className="video-stats">
                  {selectedVideo.views}회 시청 · {selectedVideo.uploadedLabel}
                </p>
                <p>{selectedVideo.description}</p>
                <a
                  className="watch-link"
                  href={selectedVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  YouTube에서 보기 ↗
                </a>
              </div>
            </section>
          )}

          <section className="video-grid" aria-live="polite">
            {filteredVideos.length === 0 ? (
              <p className="empty-state">조건에 맞는 강의가 없습니다.</p>
            ) : (
              filteredVideos.map((video) => (
                <article className="video-card" key={video.id}>
                  <div className="thumb-wrap">
                    <a
                      className="thumb-link"
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${video.title} YouTube에서 보기 (새 탭)`}
                    >
                      <img src={video.thumbnail} alt={`${video.title} 썸네일`} />
                      {video.duration && <span className="duration-badge">{video.duration}</span>}
                    </a>
                    <button
                      type="button"
                      className="preview-btn"
                      aria-label={`${video.title} 미리보기 열기`}
                      onClick={() => setSelectedId(video.id)}
                    >
                      미리보기
                    </button>
                  </div>
                  <div className="video-meta">
                    <p className="video-eyebrow">{video.numberLabel}</p>
                    <a
                      className="video-title-link"
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <h3 className="video-title">{video.title}</h3>
                    </a>
                    <p className="video-stats">
                      {video.views}회 시청 · {video.uploadedLabel}
                    </p>
                    <p className="video-desc">{video.description}</p>
                  </div>
                </article>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
