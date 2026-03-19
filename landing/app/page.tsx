import Hero from '@/components/Hero'
import Features from '@/components/Features'
import HowItWorks from '@/components/HowItWorks'
import SocialProof from '@/components/SocialProof'
import Pricing from '@/components/Pricing'
import WaitlistForm from '@/components/WaitlistForm'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'

export const revalidate = 60 // Revalidate waitlist count every 60s

export default function Home() {
  return (
    <main className="min-h-screen bg-dark-900 text-gray-100">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <SocialProof />
      <Pricing />
      <section
        id="waitlist"
        className="py-24 px-4 relative overflow-hidden"
        aria-labelledby="waitlist-heading"
      >
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-600/10 blur-3xl" />
        </div>

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <p className="text-brand-400 font-semibold text-sm uppercase tracking-widest mb-4">
            Beta launching April 2026
          </p>
          <h2
            id="waitlist-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight"
          >
            Grab your spot before
            <br />
            <span className="gradient-text">your competition does</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Beta spots are limited. Join the waitlist — we'll reach out before
            public launch.
          </p>
          <WaitlistForm />
          <p className="text-gray-600 text-sm mt-6">
            No spam. No credit card. Just a heads-up when we're ready for you.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  )
}
