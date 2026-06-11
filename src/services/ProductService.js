class ProductService {
  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:5000/api/products';
  }

  async fetchProductsByCategory(category) {
    try {
      const response = await fetch(`${this.baseUrl}/category/${encodeURIComponent(category)}`);

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

  async fetchAllProducts(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`${this.baseUrl}?${queryParams}`);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async fetchProductById(productId) {
    try {
      const response = await fetch(`${this.baseUrl}/${productId}`);

      if (response.status === 404) {
        throw new Error('Product not found');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async searchProducts(searchQuery, filters = {}) {
    try {
      const queryParams = new URLSearchParams({
        search: searchQuery,
        ...filters,
      });

      const response = await fetch(`${this.baseUrl}?${queryParams}`);

      if (!response.ok) {
        throw new Error(`Failed to search products: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
}

export default new ProductService();
