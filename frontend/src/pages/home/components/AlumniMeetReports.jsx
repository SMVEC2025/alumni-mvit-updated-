import { useState } from 'react'
import { HiOutlineDocumentText, HiOutlineExternalLink } from 'react-icons/hi'
import { HiOutlineBookOpen, HiOutlineAcademicCap } from 'react-icons/hi2'

const REPORTS = [
  {
    title: 'Alumni Meet Report',
    date: '19th September 2025',
    file: '/file/alumi_meet_rpt_19th_sep_2025.pdf',
  },
  {
    title: 'Online Alumni Meet',
    date: '5th March – 21st March 2025',
    file: '/file/alumi_meet_rpt_5th_march_2025.pdf',
  },
  {
    title: 'Alumni Meet Report',
    date: '9th September 2024',
    file: '/file/alumi_meet_rpt_9th_sep_2024.pdf',
  },
]

function AlumniMeetReports() {
  const [showCertificate, setShowCertificate] = useState(false)

  return (
    <section className="alumni-reports-section">
      <div className="container alumni-reports-inner">
        <header className="alumni-reports-header">
          <span className="alumni-reports-eyebrow">Archive</span>
          <h2 className="alumni-reports-title">Alumni Meet Reports</h2>
        </header>

        <ul className="alumni-reports-list">
          {REPORTS.map((report) => (
            <li key={report.file} className="alumni-reports-item">
              <a
                href={report.file}
                target="_blank"
                rel="noopener noreferrer"
                className="alumni-reports-link"
              >
                <span className="alumni-reports-icon" aria-hidden="true">
                  <HiOutlineDocumentText />
                </span>
                <span className="alumni-reports-meta">
                  <span className="alumni-reports-name">{report.title}</span>
                  <span className="alumni-reports-date">{report.date}</span>
                </span>
                <span className="alumni-reports-action" aria-hidden="true">
                  <HiOutlineExternalLink />
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="alumni-reports-buttons">
          <a
            href="/file/bylaw.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="alumni-reports-btn"
          >
            <HiOutlineBookOpen />
            <span>Bylaw</span>
          </a>
          <button
            type="button"
            className="alumni-reports-btn"
            onClick={() => setShowCertificate(true)}
          >
            <HiOutlineAcademicCap />
            <span>Alumni Certificate</span>
          </button>
        </div>
      </div>

      {showCertificate && (
        <div
          className="alumni-certificate-overlay"
          onClick={() => setShowCertificate(false)}
        >
          <div
            className="alumni-certificate-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="alumni-certificate-close"
              onClick={() => setShowCertificate(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <img
              src="/img/certificate/Alumni_Certificate.jpg"
              alt="Alumni Certificate"
              className="alumni-certificate-img"
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default AlumniMeetReports
