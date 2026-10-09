const DotCompanyService = require('../services/DotCompanyService');

const { DOTCOMPANY_ENABLED } = require('../config/env');

class DotCompanyController {
  async testEan(req, res) {
    if (!DOTCOMPANY_ENABLED) return res.status(403).json({ error: 'Integração DotCompany está temporariamente desativada' });
    
    const { ean } = req.params;
    try {
      const data = await DotCompanyService.fetchProductImage(ean);
      if (!data) return res.status(404).json({ error: 'EAN não encontrado na base externa' });
      res.json(data);
    } catch (err) {
      console.error('Erro teste API DotCompany:', err.message);
      res.status(500).json({ error: err.message || 'Erro ao consultar API externa' });
    }
  }
}

module.exports = new DotCompanyController();
