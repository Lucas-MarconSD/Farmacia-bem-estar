export function formatCurrency(value) {
  if (typeof value !== 'number') return '0,00';
  return value.toFixed(2).replace('.', ',');
}
