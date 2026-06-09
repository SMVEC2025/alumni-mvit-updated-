const mitHighlights = [
  'Autonomous institution affiliated to Pondicherry University',
  "Approved by AICTE and accredited by NBA and NAAC with 'A' Grade",
  'Established in 2008 by Sri Manakula Vinayaga Educational Trust',
]

function FounderQuote() {
  return (
    <section className="founder-quote-section">
      <div className="founder-quote-inner">
        <div className="founder-quote-left">
          <h2 className="founder-quote-heading">
            MIT is a leading autonomous engineering institution focused on academic excellence.
          </h2>

          <div className="founder-quote-text">
            <p>
              MIT is an autonomous institution in Puducherry that blends strong academics, hands-on learning, and industry exposure to prepare students for engineering careers.
            </p>
          </div>

          <ul className="founder-quote-highlights">
            {mitHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="founder-quote-divider" />
          <div className="founder-quote-attr">
            <p className="founder-name">M. Dhanasekaran</p>
            <p className="founder-title">Founder, Chairman &amp; Managing Director</p>
          </div>
        </div>

        <div className="founder-quote-right">
          <div className="founder-img-frame">
            <img
              src="/img/chairr_man.webp"
              alt="Leadership portrait for Manakula Vinayagar Institute of Technology"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default FounderQuote
