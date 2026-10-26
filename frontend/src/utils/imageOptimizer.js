/**
 * Otimiza e converte qualquer imagem para WebP no navegador do cliente antes de enviar ao Storage.
 * - Redimensiona imagens gigantes de câmera/celular (4000x3000px) para até 800x800px (tamanho ideal de e-commerce).
 * - Converte para WebP com qualidade 82% (alta nitidez visual).
 * - Preserva transparência se houver canal alfa (PNG).
 * - Reduz fotos de 3MB ~ 8MB para ~60KB ~ 90KB (economia de até 98% do espaço no Supabase Storage).
 * 
 * Com isso, o limite gratuito de 1 GB comporta tranquilamente mais de 12.000 fotos de produtos!
 */
export async function optimizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.82) {
  // Se não for arquivo de imagem, ou for SVG / GIF animado, não processa
  if (!file || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Se a imagem já for menor que o limite máximo e já for WebP ou muito leve, pode manter
        if (width <= maxWidth && height <= maxHeight && file.size < 100 * 1024 && file.type === 'image/webp') {
          resolve(file);
          return;
        }

        // Redimensiona proporcionalmente mantendo o aspecto original
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Suavização bilinear de alta qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Desenha a imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Converte diretamente para formato WebP
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'product';
              const optimizedFile = new File([blob], `${baseName}.webp`, {
                type: 'image/webp',
                lastModified: Date.now()
              });
              resolve(optimizedFile);
            } else {
              // Fallback para arquivo original caso toBlob não seja suportado
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
