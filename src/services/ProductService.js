class ProductService {
  constructor() {
    this.baseUrl = 'http://localhost:5000/api/products';
  }

  async fetchProductsByCategory(category) {
    try {
      const response = await fetch(`${this.baseUrl}?category=${category}`);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }
}

export default new ProductService();
