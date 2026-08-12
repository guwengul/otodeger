const fs = require('fs');
const html = fs.readFileSync('renault-yeniclio.html', 'utf8');

const re = /ModelGradesV3Card__gradeLabel">([^<]+)<\/h3>.*?başlangıç fiyatı <!-- -->₺([\d.]+)/gs;
let m, results = [];
while ((m = re.exec(html)) !== null) {
  results.push({ versiyon: m[1], fiyat: m[2] });
}
console.log(JSON.stringify(results, null, 2));
console.log('Toplam:', results.length);
