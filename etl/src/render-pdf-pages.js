const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = path.join(__dirname, '../../Renault-Fiyat-Listesi.pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Sayfa sayısı:', doc.numPages);

  const outDir = path.join(__dirname, '../renault-pdf-pages');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const outPath = path.join(outDir, `page-${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log('Kaydedildi:', outPath);
  }
}
main().catch(err => { console.error('Hata:', err); process.exit(1); });
