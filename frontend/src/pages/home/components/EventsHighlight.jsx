const eventsData = [
  {
    id: 1,
    dayName: 'Mon',
    day: '5',
    month: 'Feb',
    image: '/img/alumni-events/1.jpeg',
    location: 'MVIT Campus',
    title: '4th STELLAR’S TROPHY”',
    desc: 'MVIT ALUMNI of 2013-2017 batch conducted “4th STELLAR’S TROPHY” on 5&6-2-2021.',
    tag: 'Reunion',
  },
  {
    id: 2,
    dayName: 'Mon',
    day: '14',
    month: 'Dec',
    image: '/img/alumni-events/2.jpg',
    location: 'MVIT Campus',
    title: 'Alumni Meet 2018',
    desc: 'lumni Meet at Manakula Vinayagar Institute of Technology (MVIT). ',
    tag: 'Celebration',
  },
  {
    id: 3,
    dayName: 'mon',
    day: '11',
    month: 'May',
    image: '/img/alumni-events/3.webp',
    location: 'Main Auditorium',
    title: 'Fruition 23',
    desc: 'An insightful technical talk titled “Reach the Unreached – Indian Space Programme” was successfully organized to create awareness about India’s remarkable journey in space science and its applications for national development.',
    tag: 'Ceremony',
  },
]

function EventsHighlight() {
  return (
    <section className="events-highlight-section section">
      <div className="container">
        <div className="events-highlight-header">
          <p className="events-eyebrow">What&apos;s On</p>
          <h2>Our Events</h2>
          <p className="events-sub">Don&apos;t miss out on exciting alumni events</p>
        </div>

        <div className="events-cards-grid">
          {eventsData.map((event) => (
            <div
              className="event-img-card"
              key={event.id}
              style={{ backgroundImage: `url(${event.image})` }}
            >
              {/* Dark overlay */}
              <div className="event-img-overlay" />

              {/* Top row */}
              <div className="event-img-top">
                <div className="event-date-badge">
                  <span className="edb-day-name">{event.dayName}</span>
                  <span className="edb-day">{event.day}</span>
                  <span className="edb-month">{event.month}</span>
                </div>

                <div className="event-info-btn" aria-label="Event info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="8" strokeLinecap="round" strokeWidth="2.5" />
                    <line x1="12" y1="12" x2="12" y2="16" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                  <div className="event-tooltip">{event.desc}</div>
                </div>
              </div>

              {/* Bottom info */}
              <div className="event-img-bottom">
                <span className="event-location-tag">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  {event.location}
                </span>
                <h3 className="event-img-title">{event.title}</h3>
                <a
                  href="https://mvit.edu.in/events"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-register-btn"
                >
                  View More
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="events-view-all">
          <a
            href="https://mvit.edu.in/events"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            View All Events
          </a>
        </div>
      </div>
    </section>
  )
}

export default EventsHighlight
