const features = [
  {
    icon: '🔍',
    tag: 'Listing Optimization',
    headline: 'Get found by more guests',
    description:
      'Your listing title, description, and tags are rewritten by AI that knows exactly what Airbnb's algorithm rewards. More search visibility means more bookings — without changing your price.',
    outcomes: [
      'Higher placement in Airbnb search',
      'More clicks from the same traffic',
      'Titles that convert browsers to bookers',
    ],
    accent: 'from-blue-500/20 to-blue-600/5',
    iconBg: 'bg-blue-500/10',
    tagColor: 'text-blue-400',
  },
  {
    icon: '⭐',
    tag: 'Review Management',
    headline: 'Never stress about a bad review again',
    description:
      'Every review — 5-star or 1-star — gets a professional, on-brand response drafted and posted automatically. You look attentive and professional without lifting a finger.',
    outcomes: [
      'Responses posted within hours, not days',
      'Consistent brand voice across every reply',
      'Negative reviews handled with care',
    ],
    accent: 'from-yellow-500/20 to-yellow-600/5',
    iconBg: 'bg-yellow-500/10',
    tagColor: 'text-yellow-400',
  },
  {
    icon: '💬',
    tag: 'Guest Communication',
    headline: 'Every guest feels taken care of, automatically',
    description:
      'Pre-arrival instructions, check-in reminders, mid-stay check-ins, and post-stay thank you messages — all sent automatically in your voice. Guests rave about communication. You do nothing.',
    outcomes: [
      'Automated pre-arrival and check-in sequences',
      'Mid-stay check-in increases 5-star reviews',
      'Post-stay review requests that actually work',
    ],
    accent: 'from-green-500/20 to-green-600/5',
    iconBg: 'bg-green-500/10',
    tagColor: 'text-green-400',
  },
]

export default function Features() {
  return (
    <section
      id="features"
      className="py-24 px-4 relative"
      aria-labelledby="features-heading"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-brand-400 font-semibold text-sm uppercase tracking-widest mb-3">
            What it does
          </p>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
          >
            Three jobs. One AI. Zero effort.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Hospitality God handles the marketing tasks that most STR owners
            either ignore or pay an agency $3,000/mo to do.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" role="list">
          {features.map((feature) => (
            <article
              key={feature.tag}
              className={`relative rounded-2xl border border-white/8 bg-gradient-to-b ${feature.accent} p-8 hover:border-white/15 transition-all duration-300 group`}
              role="listitem"
            >
              {/* Icon */}
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.iconBg} text-2xl mb-5`}
                aria-hidden="true"
              >
                {feature.icon}
              </div>

              {/* Tag */}
              <p
                className={`text-xs font-bold uppercase tracking-widest ${feature.tagColor} mb-2`}
              >
                {feature.tag}
              </p>

              {/* Headline */}
              <h3 className="text-xl font-bold text-white mb-3">
                {feature.headline}
              </h3>

              {/* Description */}
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {feature.description}
              </p>

              {/* Outcomes */}
              <ul className="space-y-2" aria-label={`${feature.tag} outcomes`}>
                {feature.outcomes.map((outcome) => (
                  <li
                    key={outcome}
                    className="flex items-start gap-2 text-sm text-gray-300"
                  >
                    <span
                      className="text-brand-400 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    >
                      →
                    </span>
                    {outcome}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Coming soon teaser */}
        <div className="mt-8 rounded-xl border border-white/5 bg-white/2 p-6 text-center">
          <p className="text-gray-500 text-sm">
            <span className="text-gray-300 font-medium">Coming in Phase 2:</span>{' '}
            Social media content, direct booking websites, email marketing, competitive intelligence, and paid ads.
          </p>
        </div>
      </div>
    </section>
  )
}
