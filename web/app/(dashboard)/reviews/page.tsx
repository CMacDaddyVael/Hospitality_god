export default function ReviewsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-gray-500 mt-1">
          AI-drafted responses to all your guest reviews
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-50 rounded-2xl mb-4">
          <span className="text-3xl">⭐</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Review Responder — Coming Soon
        </h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          Our AI drafts responses to every guest review in your voice. Positive
          or negative — handled professionally, automatically.
        </p>
        <button className="mt-6 px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
          Join the waitlist
        </button>
      </div>
    </div>
  );
}
