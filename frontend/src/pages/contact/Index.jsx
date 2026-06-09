import { useState } from 'react'
import { HiMail, HiPhone, HiLocationMarker, HiClock } from 'react-icons/hi'
import { useSnackbar } from 'notistack'
import { sendContactMessage } from '../../lib/contactMessages'

function Contact() {
  const { enqueueSnackbar } = useSnackbar()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      const result = await sendContactMessage(form)
      enqueueSnackbar(
        result?.message || 'Your message has been sent. We will get back to you soon.',
        { variant: 'success' },
      )
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err) {
      enqueueSnackbar(
        err?.message || 'Something went wrong. Please try again.',
        { variant: 'error' },
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="contact-page page-content">
      <section className="contact-hero">
        <div className="container">
          <p className="contact-hero-eyebrow">Contact</p>
          <h1>Let&apos;s Connect</h1>
        </div>
      </section>

      <section className="contact-content">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-form-wrapper">
              <div className="contact-section-head">
                <p className="contact-eyebrow">Write to us</p>
                <h2>Send us a Message</h2>
                <p className="contact-section-sub">
                  Fill in the form and we&apos;ll get back to you within two working days.
                </p>
              </div>

              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="What is this regarding?"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Write your message here..."
                    rows={6}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="contact-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="contact-submit-spinner" aria-label="Sending" />
                  ) : (
                    <>
                      <span>Send Message</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                        <polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="contact-info">
              <div className="contact-section-head">
                <p className="contact-eyebrow">Reach out</p>
                <h2>Get in Touch</h2>
                <p className="contact-section-sub">
                  Connect with us through any of these channels.
                </p>
              </div>

              <div className="info-cards">
                <div className="info-card">
                  <div className="info-icon"><HiLocationMarker /></div>
                  <div className="info-text">
                    <h4>Address</h4>
                    <p>Manakula Vinayagar Institute of Technology, Madagadipet, Puducherry - 605107</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon"><HiPhone /></div>
                  <div className="info-text">
                    <h4>Phone</h4>
                    <p>
                      <a href="tel:+916385155814">+91 6385155814</a>
                    </p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon"><HiMail /></div>
                  <div className="info-text">
                    <h4>Email</h4>
                    <p>
                      <a href="mailto:alumnicoordinator@smvec.ac.in">alumnicoordinator@smvec.ac.in</a>
                    </p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon"><HiClock /></div>
                  <div className="info-text">
                    <h4>Office Hours</h4>
                    <p>Mon – Sat: 9:00 AM – 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
