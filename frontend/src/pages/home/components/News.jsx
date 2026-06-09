import { HiNewspaper } from 'react-icons/hi'

const newsData = [
  {
    id: 1,
    date: 'Feb 15, 2026',
    title: 'Annual Alumni Meet 2026 Announced',
    description: 'The grand alumni reunion is scheduled for March 2026. Register now to be part of the celebration.',
  },
  {
    id: 2,
    date: 'Feb 10, 2026',
    title: 'MVIT Ranked Among Top Engineering Colleges',
    description: 'Our institution has been recognized for excellence in education and research by NIRF rankings.',
  },
  {
    id: 3,
    date: 'Jan 28, 2026',
    title: 'Alumni Mentorship Program Launch',
    description: 'Connect with current students and guide them through our new mentorship initiative.',
  },
]

function News() {
  return (
    <section className="news-section section">
      <div className="container">
        <div className="section-header">
          <h2>Latest News</h2>
          <p>Stay updated with the latest happenings at MVIT</p>
        </div>

        <div className="news-grid">
          {newsData.map((news) => (
            <div className="news-card card" key={news.id}>
              <div className="news-img">
                <HiNewspaper />
              </div>
              <div className="news-body">
                <span className="news-date">{news.date}</span>
                <h3>{news.title}</h3>
                <p>{news.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default News
