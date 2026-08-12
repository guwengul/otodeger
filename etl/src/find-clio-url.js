const fs = require('fs');
const html = fs.readFileSync('renault-modeller.html', 'utf8');
const re = /\\"modelHomepageURL\\":\\"(.*?)\\"/g;
let m, results = [];
while ((m = re.exec(html)) !== null) {
  const url = m[1].replace(/\\u002F/g, '/');
  const after = html.slice(m.index, m.index + 600);
  const labelMatch = after.match(/\\"label\\":\\"(.*?)\\"/);
  results.push({ url, label: labelMatch ? labelMatch[1] : null });
}
console.log(JSON.stringify(results, null, 2));
