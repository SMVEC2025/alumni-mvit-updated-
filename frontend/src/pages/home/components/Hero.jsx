import { Link } from 'react-router-dom'

function Hero() {
  return (
    <div className="hero-main">
      <video
        className="hero-bg-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/img/background/home-hero-test1.webp"
        aria-hidden="true"
      >
        <source src="/video/herobg.webm" type="video/webm" />
      </video>
      <div className="container hero-content">
        <div className="hero-title-block">
          <span className="hero-eyebrow">Welcome to</span>
          <h1>
            Manakula Vinayagar
            <span className="hero-title-suffix">Institute of Technology</span>
          </h1>
          {/* <span className="hero-sub-tag">Alumni Network</span> */}
        </div>
        <p className='hero-sub-tag'>
          Alumni Network
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary">
            Alumni registration
          </Link>

        </div>
        <div className="hero-stats">
          <div className="stat">
            <h3>10,000+</h3>
            <p>Alumni Members</p>
          </div>
          <div className="stat">
            <h3>18+</h3>
            <p>Years of Legacy</p>
          </div>
          <div className="stat">
            <h3>15+</h3>
            <p>Courses</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
