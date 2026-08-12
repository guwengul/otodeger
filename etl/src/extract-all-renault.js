const fs = require('fs');

const dosyalar = [
  { file: 'renault-yeniclio.html', marka_model: 'Yeni Clio' },
  { file: 'renault-r5.html', marka_model: 'Renault 5 E-Tech Elektrikli' },
  { file: 'renault-clio-etech.html', marka_model: 'Clio E-Tech' },
  { file: 'renault-megane-etech.html', marka_model: 'Megane E-Tech' },
  { file: 'renault-captur.html', marka_model: 'Captur' },
  { file: 'renault-duster.html', marka_model: 'Duster' },
  { file: 'renault-scenic.html', marka_model: 'Scenic E-Tech' },
  { file: 'renault-austral.html', marka_model: 'Austral' },
  { file: 'renault-boreal.html', marka_model: 'Boreal' },
  { file: 'renault-megane-sedan.html', marka_model: 'Megane Sedan' },
  { file: 'renault-rafale.html', marka_model: 'Rafale' },
];

const re = /ModelGradesV3Card__gradeLabel">([^<]+)<\/h3>.*?başlangıç fiyatı <!-- -->₺([\d.]+)/gs;

const tumSonuclar = {};
for (const { file, marka_model } of dosyalar) {
  if (!fs.existsSync(file)) { console.log(`YOK: ${file}`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  let m, sonuc = [];
  const reLocal = new RegExp(re.source, re.flags);
  while ((m = reLocal.exec(html)) !== null) {
    sonuc.push({ versiyon: m[1], fiyat: m[2] });
  }
  tumSonuclar[marka_model] = sonuc;
}

console.log(JSON.stringify(tumSonuclar, null, 2));
