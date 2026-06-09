const alumniData = [
  {
    id: 1,
    video: '/video/alumni/1.mp4',
    name: 'Dr. Rajesh Kumar',
    role: 'Chief Technology Officer',
    company: 'TechCorp India',
    dept: 'Computer Science & Engineering',
    batch: '2005',
  },
  {
    id: 2,
    video: '/video/alumni/2.mp4',
    name: 'Priya Sharma',
    role: 'Director of Operations',
    company: 'Global Systems Ltd.',
    dept: 'Electronics & Communication',
    batch: '2008',
  },
  {
    id: 3,
    video: '/video/alumni/3.mp4',
    name: 'Arun Venkatesh',
    role: 'Founder & CEO',
    company: 'StartupHub Ventures',
    dept: 'Mechanical Engineering',
    batch: '2003',
  },
  {
    id: 4,
    video: '/video/alumni/4.mp4',
    name: 'Meena Lakshmi',
    role: 'Senior Vice President',
    company: 'Infosys Technologies',
    dept: 'Information Technology',
    batch: '2006',
  },
]

function NotableAlumni() {
  return (
    <section className="notable-alumni-section">
      <div className="notable-alumni-header">
        <p className="notable-alumni-eyebrow">Our Graduates</p>
        <h2>Notable Alumni</h2>
        <p className="notable-alumni-sub">Pioneers shaping industries and communities across the globe</p>
      </div>

      <div className="alumni-video-grid">
        {alumniData.map((alumni) => (
          <div className="alumni-video-card" key={alumni.id}>
            <video
              src={alumni.video}
              autoPlay
              muted
              loop
              playsInline
              className="alumni-video"
            />
            <div className="alumni-video-overlay" />
            <div className="alumni-video-info">
              <span className="alumni-dept">{alumni.dept} · {alumni.batch}</span>
              <h3 className="alumni-name">{alumni.name}</h3>
              <p className="alumni-role">{alumni.role}</p>
              <p className="alumni-company">{alumni.company}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default NotableAlumni
