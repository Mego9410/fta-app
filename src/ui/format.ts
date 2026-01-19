export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    // Fallback for runtimes without Intl support.
    return `£${Math.round(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

