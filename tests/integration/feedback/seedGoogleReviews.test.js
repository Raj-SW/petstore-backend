const Feedback = require("../../../src/models/feedback.model");
const { seedGoogleReviews } = require("../../../scripts/seedGoogleReviews");
const { GOOGLE_REVIEWS_SEED } = require("../../../src/data/googleReviews.seed");

describe("seedGoogleReviews", () => {
  it("inserts all reviews as approved google source, and is idempotent", async () => {
    const first = await seedGoogleReviews(Feedback);
    expect(first.inserted).toBe(GOOGLE_REVIEWS_SEED.length);
    const count = await Feedback.countDocuments({ source: "google", approved: true });
    expect(count).toBe(GOOGLE_REVIEWS_SEED.length);

    const second = await seedGoogleReviews(Feedback);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(GOOGLE_REVIEWS_SEED.length);
    expect(await Feedback.countDocuments({ source: "google" })).toBe(GOOGLE_REVIEWS_SEED.length);
  });

  it("removes known test entries", async () => {
    await Feedback.create({ name: "TestUser", rating: 5, message: "test entry to remove", approved: true });
    await Feedback.create({ name: "Moisa", rating: 5, message: "another test entry here", approved: true });
    const res = await seedGoogleReviews(Feedback);
    expect(res.removed).toBe(2);
    expect(await Feedback.countDocuments({ name: { $in: ["TestUser", "Moisa"] } })).toBe(0);
  });
});
