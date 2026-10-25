import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'

// Adds the "in" state once the element scrolls into view (used for the steps animation).
function useInView(threshold = 0.2) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setSeen(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen]
}

const LANGS = ['English', 'हिन्दी', 'తెలుగు', 'മലയാളം', 'ಕನ್ನಡ', 'தமிழ்', 'Español']

const FAQ = [
  ['What can I upload?', 'Audio, video, or a plain text transcript (.txt). You can also record a meeting live in your browser.'],
  ['How does live recording work?', "Choose Record live, then share the meeting's tab or your screen with audio turned on. Keep the page open until the meeting ends. Chrome on desktop works best."],
  ['How long do the minutes take?', 'Short meetings finish quickly. Long meetings can take a few minutes, and you can leave the processing page open while you wait.'],
  ['What can I download?', 'The minutes as a PDF or a Word file, in English, Hindi, Telugu, Malayalam, Kannada, Tamil, or Spanish.'],
]

const FEATURES = [
  ['Live recording', 'Capture a meeting tab with audio, right in the browser.'],
  ['Upload anything', 'Audio, video, or a text transcript.'],
  ['Key points', 'The few things that mattered, at the top.'],
  ['Chapters', 'The meeting split into topics you can open one by one.'],
  ['PDF and Word export', 'Download the minutes to share with your team.'],
  ['History', 'Every meeting you have processed, ready to reopen.'],
]

export default function HomePage() {
  const { user } = useAuth()
  const [stepsRef, stepsIn] = useInView()

  const primary = user ? { to: '/new', label: 'New meeting' } : { to: '/login?mode=register', label: 'Get started' }
  const secondary = user ? { to: '/history', label: 'View history' } : { to: '/login', label: 'Log in' }

  const cta = (
    <div className="lp-cta">
      <Link className="btn btn-hl btn-lg" to={primary.to}>{primary.label}</Link>
      <Link className="btn btn-ghost-light btn-lg" to={secondary.to}>{secondary.label}</Link>
    </div>
  )

  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-wrap">
          {!user && (
            <header className="lp-nav">
              <Link to="/" className="brand"><Logo size={28} />Meeting <span className="hl">Minutes</span></Link>
              <nav className="lp-links" aria-label="Sections">
                <a href="#how">How it works</a>
                <a href="#features">Features</a>
                <a href="#faq">FAQ</a>
              </nav>
              <Link className="btn btn-ghost-light btn-sm" to="/login">Log in</Link>
              <Link className="btn btn-hl btn-sm" to="/login?mode=register">Get started</Link>
            </header>
          )}

          <div className="lp-hero-grid">
            <div>
              <Logo size={44} />
              <h1>Meeting Minutes Generator</h1>
              <p className="lede">
                Record a call or upload a recording. Get the key points, the chapters, and
                who needs to do what by when.
              </p>
              {cta}
              <p className="lp-note">Audio, video, or a text transcript. Live recording works best in Chrome on desktop.</p>
            </div>

            <div className="sheet" aria-hidden="true">
              <div className="sheet-head">
                <strong>Q3 sales review</strong>
                <span>Meeting minutes</span>
              </div>
              <h3>Key points</h3>
              <ul>
                <li>Sales in the northern region are down this quarter.</li>
                <li>The team agreed to bring in an external researcher.</li>
              </ul>
              <h3>Action items</h3>
              <ul className="sheet-actions">
                <li>
                  <span className="hl sweep">Send the revised numbers to finance</span>
                  <span className="chip owner">Rahul</span>
                  <span className="chip">by Thursday</span>
                </li>
                <li>
                  <span className="hl sweep">Find a market research company</span>
                  <span className="chip owner">David</span>
                  <span className="chip">No due date</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="how">
        <div className="lp-wrap lp-center">
          <h2>How it works</h2>
          <p className="sub">You add the meeting. The app writes the minutes.</p>

          <div className={`lp-steps ${stepsIn ? 'in' : ''}`} ref={stepsRef}>
            <div className="lp-track" aria-hidden="true"><i /></div>
            <ol>
              <li className="lp-step" style={{ '--i': 0 }}>
                <span className="lp-node">1</span>
                <div className="lp-vis" aria-hidden="true">
                  <div className="lp-wave">
                    {Array.from({ length: 20 }, (_, k) => <b key={k} style={{ '--k': k }} />)}
                  </div>
                </div>
                <h3>Record or upload</h3>
                <p>Capture a call live in your browser, or add an audio, video, or text file.</p>
              </li>
              <li className="lp-step" style={{ '--i': 1 }}>
                <span className="lp-node">2</span>
                <div className="lp-vis" aria-hidden="true">
                  <div className="lp-lines">
                    <i /><i className="mark" /><i /><i className="short" />
                  </div>
                </div>
                <h3>Transcribe and summarize</h3>
                <p>Speech becomes text. Then come the key points, the chapters, and the action items.</p>
              </li>
              <li className="lp-step" style={{ '--i': 2 }}>
                <span className="lp-node">3</span>
                <div className="lp-vis" aria-hidden="true">
                  <div className="lp-files"><span className="lp-doc">PDF</span><span className="lp-doc">DOCX</span></div>
                </div>
                <h3>Review and download</h3>
                <p>Check the minutes on screen, then download them in the language your team reads.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-alt" id="features">
        <div className="lp-wrap">
          <h2>Everything the minutes need</h2>
          <p className="sub">The part people read first is the list of who does what.</p>
          <div className="lp-feat">
            <div className="panel">
              <h3>Action items with an owner and a deadline</h3>
              <p>
                Each task comes with the person responsible, the due date when one was
                mentioned, and the sentence it came from.
              </p>
              <ul className="actions" aria-hidden="true">
                <li className="action">
                  <span className="avatar">R</span>
                  <div>
                    <p className="task"><span className="hl">Send the revised numbers to finance</span></p>
                    <div className="meta"><span className="chip owner">Rahul</span><span className="chip">by Thursday</span></div>
                    <p className="quote">“Rahul, can you send the numbers to finance by Thursday? Sure.”</p>
                  </div>
                </li>
                <li className="action">
                  <span className="avatar">D</span>
                  <div>
                    <p className="task"><span className="hl">Find a market research company</span></p>
                    <div className="meta"><span className="chip owner">David</span><span className="chip">No due date</span></div>
                  </div>
                </li>
              </ul>
            </div>
            <ul className="lp-list">
              {FEATURES.map(([title, text]) => (
                <li key={title}><strong>{title}</strong><span>{text}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-lang">
        <div className="lp-wrap lp-center">
          <h2>Minutes in the language your team reads</h2>
          <div className="lp-chips">
            {LANGS.map((l) => <span key={l}>{l}</span>)}
          </div>
        </div>
      </section>

      <section className="lp-sec" id="faq">
        <div className="lp-wrap">
          <h2 className="lp-center">Questions</h2>
          <div className="lp-faq">
            {FAQ.map(([q, a]) => (
              <details className="chapter" key={q}>
                <summary>{q}</summary>
                <p className="sum">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>Ready for your next meeting?</h2>
        {cta}
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <span>Meeting Minutes Generator</span>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            {!user && <Link to="/login">Log in</Link>}
          </nav>
        </div>
      </footer>
    </div>
  )
}
