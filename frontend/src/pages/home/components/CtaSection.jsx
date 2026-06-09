import { Link } from 'react-router-dom'

function CtaSection() {
  return (
    <section className="cta-section">
      {/* Tossed graduation cap — floats above the section */}
      {/* <img
        src="/img/gradaution.png"
        alt=""
        className="cta-cap-toss"
        aria-hidden="true"
      /> */}

      {/* Background photo */}
      <div className="cta-bg" />

      {/* Dark overlay */}
      <div className="cta-overlay" />

      <div className="container cta-content">
        <p className="cta-eyebrow">Your Journey Continues</p>
        <h2>Join the MVIT Alumni Network</h2>
        <p className="cta-desc">
          Register now to reconnect with fellow graduates, access exclusive events,
          and build a lifelong professional community.
        </p>
        <div className="cta-actions">
          <Link to="/register" className="btn cta-btn-primary">
            Register Now
          </Link>
          <Link to="/login" className="btn cta-btn-ghost">
            Already a Member? Login
          </Link>
        </div>
      </div>
    </section>
  )
}

export default CtaSection
