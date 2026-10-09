import { API_URL } from '../config/constants';

export class ProductService {
  static async getProducts(page = 1, limit = 20) {
    return this.filterProducts('', 'todos', page, limit);
  }

  static async getCategories() {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      
      const iconMap = {
        'medicamentos': 'Pill',
        'perfumaria': 'Sparkles',
        'balcao': 'Droplet',
        'oficinais': 'HeartPulse',
      };
      
      return data.map(c => ({
        id: c.slug,
        name: c.name,
        icon: iconMap[c.slug] || 'Package'
      }));
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      return [];
    }
  }

  static async filterProducts(searchTerm, categorySlug, page = 1, limit = 20) {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categorySlug && categorySlug !== 'todos') params.append('category', categorySlug);
      params.append('page', page);
      params.append('limit', limit);
      
      const response = await fetch(`${API_URL}/products?${params.toString()}`);
      const result = await response.json();

      const data = result.data || result; // Fallback to array if API didn't return object

      const mappedData = data.map(product => ({
        ...product,
        oldPrice: product.old_price,
        image: product.image_url || null,
        discount: product.old_price ? true : false,
      }));

      return {
        data: mappedData,
        total: result.total || mappedData.length,
        page: result.page || 1,
        limit: result.limit || limit,
        totalPages: result.totalPages || 1
      };
    } catch (err) {
      console.error('Erro ao filtrar produtos:', err);
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }
}
