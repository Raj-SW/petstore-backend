jest.mock('../models/review.model', () => ({ aggregate: jest.fn() }));

const Review = require('../models/review.model');
const { attachReviewStats } = require('./reviewStats');

const doc = (id, extra = {}) => ({
  _id: id,
  toJSON: () => ({ _id: id, name: `Product ${id}`, ...extra }),
});

describe('attachReviewStats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty array without querying for an empty list', async () => {
    await expect(attachReviewStats([])).resolves.toEqual([]);
    await expect(attachReviewStats(undefined)).resolves.toEqual([]);
    expect(Review.aggregate).not.toHaveBeenCalled();
  });

  it('attaches the count and one-decimal average to the matching product', async () => {
    Review.aggregate.mockResolvedValue([{ _id: 'a', count: 7, avg: 4.857142857142857 }]);

    const [product] = await attachReviewStats([doc('a')]);

    expect(product.reviewCount).toBe(7);
    expect(product.ratingAvg).toBe(4.9);
  });

  it('zero-fills products with no reviews', async () => {
    Review.aggregate.mockResolvedValue([{ _id: 'a', count: 2, avg: 5 }]);

    const [withReviews, without] = await attachReviewStats([doc('a'), doc('b')]);

    expect(withReviews.reviewCount).toBe(2);
    expect(without.reviewCount).toBe(0);
    expect(without.ratingAvg).toBe(0);
  });

  it('preserves fields produced by the model toJSON transform', async () => {
    Review.aggregate.mockResolvedValue([]);

    const [product] = await attachReviewStats([doc('a', { variantsView: [{ label: '5kg' }] })]);

    expect(product.name).toBe('Product a');
    expect(product.variantsView).toEqual([{ label: '5kg' }]);
  });

  it('queries once for the whole page of products', async () => {
    Review.aggregate.mockResolvedValue([]);

    await attachReviewStats([doc('a'), doc('b'), doc('c')]);

    expect(Review.aggregate).toHaveBeenCalledTimes(1);
    expect(Review.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { product: { $in: ['a', 'b', 'c'] } },
    });
  });

  it('matches ObjectId-shaped ids to their string aggregate keys', async () => {
    // Mongoose returns ObjectIds; the aggregate _id must still line up.
    const id = { toString: () => 'abc123' };
    Review.aggregate.mockResolvedValue([{ _id: 'abc123', count: 3, avg: 4 }]);

    const [product] = await attachReviewStats([{ _id: id, toJSON: () => ({ _id: id }) }]);

    expect(product.reviewCount).toBe(3);
  });

  it('handles plain objects that have no toJSON', async () => {
    Review.aggregate.mockResolvedValue([]);

    const [product] = await attachReviewStats([{ _id: 'a', name: 'Plain' }]);

    expect(product.name).toBe('Plain');
    expect(product.reviewCount).toBe(0);
  });
});
