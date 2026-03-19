/**
 * Dummy reviews for the voice calibration onboarding flow.
 * 
 * When an owner has fewer than 3 past review responses, we present
 * them with these sample guest reviews and ask them to write their
 * natural response. This gives Claude enough signal to calibrate.
 */

export const DUMMY_REVIEWS = [
  {
    id: "dummy_1",
    rating: 5,
    guestName: "Sarah M.",
    reviewText:
      "Absolutely wonderful stay! The place was spotless, the beds were incredibly comfortable, and the kitchen had everything we needed. The host left a welcome basket with local snacks which was such a thoughtful touch. The neighborhood was charming and walkable. We will definitely be back!",
    context: "5-star positive review with specific compliments",
    promptHint:
      "This guest loved your place. How would you respond to thank them and invite them back?",
  },
  {
    id: "dummy_2",
    rating: 3,
    guestName: "James T.",
    reviewText:
      "The location was great and the space itself was nice. However, we had some trouble with the WiFi during our stay — it kept dropping. Also, the checkout instructions mentioned keys under the mat but they weren't there initially, causing some confusion. The host was responsive when we reached out.",
    context: "Mixed review with specific complaints about WiFi and check-in",
    promptHint:
      "This guest had a mostly good stay but had two specific issues. How would you respond professionally?",
  },
  {
    id: "dummy_3",
    rating: 5,
    guestName: "The Rodriguez Family",
    reviewText:
      "Perfect family getaway! The kids loved the backyard and the proximity to the beach was exactly what we needed. The host was incredibly communicative throughout our trip and even recommended their favorite local restaurant which ended up being the highlight of our trip. The space was exactly as pictured — no surprises, all good ones.",
    context: "5-star family stay with local recommendations mentioned",
    promptHint:
      "A family is thanking you for a great stay and mentioning your restaurant recommendation. How do you respond?",
  },
];

/**
 * Get the dummy reviews to show during onboarding calibration.
 * Returns 3 reviews covering positive, mixed, and family scenarios.
 */
export function getCalibrationPrompts() {
  return DUMMY_REVIEWS.map((review) => ({
    id: review.id,
    rating: review.rating,
    guestName: review.guestName,
    reviewText: review.reviewText,
    promptHint: review.promptHint,
  }));
}
