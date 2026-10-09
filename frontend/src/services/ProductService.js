import { supabase } from '../config/supabaseClient';

export class ProductService {
  static async getProducts(page = 1, limit = 20) {
    return this.filterProducts('', 'todos', page, limit);
  }

  static async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('name');
        
      if (error) throw error;
      
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
      let query = supabase.from('products').select('*, categories!inner(slug)', { count: 'exact' });

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      if (categorySlug && categorySlug !== 'todos') {
        query = query.eq('categories.slug', categorySlug);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      query = query.order('name', { ascending: true }).range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;

      const mappedData = data.map(product => ({
        ...product,
        oldPrice: product.old_price,
        image: product.image_url || null,
        discount: product.old_price ? true : false,
      }));

      return {
        data: mappedData,
        total: count || mappedData.length,
        page: page,
        limit: limit,
        totalPages: Math.ceil((count || mappedData.length) / limit) || 1
      };
    } catch (err) {
      console.error('Erro ao filtrar produtos:', err);
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }
}
