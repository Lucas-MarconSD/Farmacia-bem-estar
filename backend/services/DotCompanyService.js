// Usa o fetch nativo do Node (disponível globalmente desde o Node 18).
const ProductRepository = require('../repositories/ProductRepository');
const { DOTCOMPANY_API_KEY, DOTCOMPANY_ENABLED } = require('../config/env');

class DotCompanyService {
  async fetchProductImage(ean) {
    if (!DOTCOMPANY_ENABLED) throw new Error('Integração DotCompany está temporariamente desativada');
    if (!DOTCOMPANY_API_KEY) throw new Error('API Key não configurada');
    
    const url = `https://api.dotcompany.com.br/api/v2/products/ean/${ean}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${DOTCOMPANY_API_KEY}`
      }
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API Error: ${res.status}`);
    }

    const data = await res.json();
    return data;
  }

  async processImagesForEans(eansToFetch) {
    if (!DOTCOMPANY_ENABLED) return;
    if (!DOTCOMPANY_API_KEY) return;
    
    for (const item of eansToFetch) {
      try {
        const data = await this.fetchProductImage(item.barcode);
        if (data && data.image_url) {
          ProductRepository.updateImageUrl(item.id, data.image_url);
        }
      } catch (err) {
        console.error(`Erro buscando imagem dotcompany p/ EAN ${item.barcode}:`, err.message);
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Sleep 500ms
    }
  }
}

module.exports = new DotCompanyService();
