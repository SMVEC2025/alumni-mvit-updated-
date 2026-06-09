import Hero from './components/Hero'
import AlumniCell from './components/AlumniCell'
import AlumniAssociation from './components/AlumniAssociation'
import AlumniMeetReports from './components/AlumniMeetReports'
import FounderQuote from './components/FounderQuote'
import EventsHighlight from './components/EventsHighlight'
import CtaSection from './components/CtaSection'

function Home() {
  return (
    <div className="home-main page-content">
      <Hero />
      <AlumniCell />
      <FounderQuote />
      <AlumniAssociation />
      <AlumniMeetReports />
      {/* <NotableAlumni /> */}
      <EventsHighlight />
      <CtaSection />
    </div>
  )
}

export default Home
