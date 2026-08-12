const fs = require('fs');
const html = fs.readFileSync('renault-modeller.html', 'utf8');

// Çift kaçışlı JSON: \"label\":\"Rafale\",\"minPrice\":3748000,\"pricedVersion\":{\"code\":\"X\",\"label\":\"Y\"}
const re = /\\"label\\":\\"([^\\]+)\\",\\"minPrice\\":(\d+),\\"pricedVersion\\":\{\\"code\\":\\"[^\\]*\\",\\"label\\":\\"([^\\]+)\\"\}/g;
let m, results = [];
while ((m = re.exec(html)) !== null) {
  results.push({ model: m[1], minPrice: m[2], versiyon: m[3] });
}
console.log(JSON.stringify(results, null, 2));
console.log('Toplam:', results.length);
