const ImportService = require('../services/ImportService');

class ImportController {
  async importData(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    try {
      const isPreview = req.body.preview === 'true';
      const deactivateMissing = req.body.deactivateMissing === 'true';
      const result = await ImportService.processImport(req.file.path, isPreview, deactivateMissing);
      res.json(result);
    } catch (err) {
      console.error('Erro na importação de arquivo:', err);
      res.status(500).json({ error: 'Erro interno do servidor ao processar o arquivo.' });
    }
  }
}

module.exports = new ImportController();
