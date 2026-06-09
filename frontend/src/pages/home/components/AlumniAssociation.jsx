const COMMITTEE_MEMBERS = [
  { name: 'Dr. S. Malarkkan', role: 'Patron & Ex-officio Chairman' },
  { name: 'Mr. M. Velmurugan', role: 'President' },
  { name: 'Mr. A. Dhinesh Kumar', role: 'Vice President' },
  { name: 'Mr. S. Premkumar', role: 'General Secretary' },
  { name: 'Mr. S. Mukilan', role: 'Joint Secretary' },
  { name: 'Ms. Priya Sharma', role: 'Treasurer' },
  { name: 'Mr. Samuel Vijayakumar', role: 'Executive Member' },
  { name: 'Mr. G. Selvam', role: 'Executive Member' },
  { name: 'Ms. N. Sangeetha', role: 'Executive Member' },
  { name: 'Mr. S. Sajeed Khan', role: 'Executive Member' },
  { name: 'Mr. T. Vignesh Kumar', role: 'Executive Member' },
  { name: 'Mr. J. Cyril Antony', role: 'Executive Member' },
  { name: 'Mr. Jayaraj Rajendiran', role: 'Executive Member' },
  { name: 'Mr. S. Sasidharan', role: 'Executive Member' },
  { name: 'Mr. Vijay Augustin', role: 'Executive Member' },
]

function AlumniAssociation() {
  return (
    <section className="alumni-association-section">
      <div className="container alumni-association-inner">
        <header className="alumni-association-header">
          <span className="alumni-association-eyebrow">Governance</span>
          <h2 className="alumni-association-title">Alumni Association</h2>

        </header>

        <table className="alumni-association-table">
          <thead>
            <tr>
              <th scope="col" className="aa-col-no">No</th>
              <th scope="col" className="aa-col-name">Member</th>
              <th scope="col" className="aa-col-role">Position</th>
            </tr>
          </thead>
          <tbody>
            {COMMITTEE_MEMBERS.map((member, index) => (
              <tr key={member.name}>
                <td className="aa-col-no">{String(index + 1).padStart(2, '0')}</td>
                <td className="aa-col-name">{member.name}</td>
                <td className="aa-col-role">{member.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AlumniAssociation
