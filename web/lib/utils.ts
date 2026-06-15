export function toSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}

export function fromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').toUpperCase();
}

export function formatPara(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' ₺';
}
