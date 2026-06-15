import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
);

export const ENRICH_SYSTEM_PROMPT = `Sen bir Türkiye otomotiv piyasası uzmanısın. Verilen araç marka ve tip adından özellikleri JSON formatında çıkar.

ÇIKTI ALANLARI:
- model_adi: Ana model adı (örn: "Giulietta", "Mito", "Corolla")
- versiyon: Donanım/versiyon paketi (örn: "Distinctive", "Progression Plus", "Quadrifoglio Verde")
- motor_hacmi: cc cinsinden integer (örn: 1400, 1598, 1750)
- motor_gucu: HP cinsinden integer (örn: 120, 155, 170)
- yakit_tipi: "Benzin" | "Dizel" | "Elektrik" | "Hibrit" | "LPG"
- sanziman: "Manuel" | "Otomatik" | "Yarı Otomatik"
- kasa_tipi: "Sedan" | "Hatchback" | "Station Wagon" | "SUV" | "Coupe" | "Cabrio" | "Van" | "Pickup"
- koltuk_sayisi: integer
- segment: "A" | "B" | "C" | "D" | "E" | "F" | "SUV" | "MPV" | "Ticari"
- arac_tipi: "Binek" | "Hafif Ticari" | "Ağır Ticari" | "Motosiklet"
- guven_skoru: 0-100 arası integer (ne kadar emin olduğun)

ŞANZIMAN KURALLARI — bu alan boş bırakılamaz:
- Tip adında "OTOMATIK" veya "AT" geçiyorsa → "Otomatik"
- Tip adında "DSG", "DCT", "PDK", "TCT", "EDC" geçiyorsa → "Yarı Otomatik"
- Açıkça yazılmamışsa Türkiye'de satılan bu modeli bil ve çıkar
- Örnek: Giulietta 1.4 TB 120 → Manuel, Giulietta 1.4 TB Multiair 170 TCT → Yarı Otomatik
- Emin değilsen en yaygın versiyonu yaz, guven_skoru düşür (60-70)

DİĞER KURALLAR:
- TB / TBI = Turbo Benzin
- JTD / CDTi / TDI / HDi = Dizel
- Parantez içi sayı genellikle HP: (155) = 155 HP
- 3 KAPI / 5 KAPI = Hatchback
- Sadece JSON döndür, açıklama ekleme`;

// Şanzıman string'den parse et (LLM'den önce)
function parseSanziman(tipAdi: string): string | null {
  const upper = tipAdi.toUpperCase();
  if (/\bOTOMATIK\b|AUTO\b|\bAT\b/.test(upper)) return 'Otomatik';
  if (/\bDSG\b|\bDCT\b|\bPDK\b|\bTCT\b|\bEDC\b|\bS-TRONIC\b|\bPOWERSHIFT\b/.test(upper)) return 'Yarı Otomatik';
  if (/\bMANUEL\b|\bMT\b/.test(upper)) return 'Manuel';
  return null; // LLM'e bırak
}

// LLM yerine hardcoded sonuç — pipeline testi için
function mockEnrich(markaAdi: string, tipAdi: string) {
  const sanziman = parseSanziman(tipAdi);
  console.log(`  String parse → şanzıman: ${sanziman ?? '(bulunamadı, LLM bulacak)'}`);

  // GIULIETTA 1.4 TB 120 DISTINCTIVE için hardcoded
  return {
    model_adi: 'Giulietta',
    versiyon: 'Distinctive',
    motor_hacmi: 1400,
    motor_gucu: 120,
    yakit_tipi: 'Benzin',
    sanziman: sanziman ?? 'Manuel',  // LLM bilgisi: Giulietta 1.4 120 Türkiye'de manuel geldi
    kasa_tipi: 'Hatchback',
    segment: 'C',
    koltuk_sayisi: 5,
    arac_tipi: 'Binek',
    llm_modeli: 'mock',
    guven_skoru: sanziman ? 95 : 80,  // LLM'den geldiyse biraz düşük
  };
}

async function main() {
  // 1. DB'den araç tip ID'sini al
  console.log('Araç aranıyor...');
  const { data: arac, error: fetchErr } = await supabase
    .from('arac_tipleri')
    .select('id, marka_adi, tip_adi')
    .eq('marka_kodu', 3)
    .eq('tip_kodu', 218)  // GIULIETTA 1.4 TB 120 DISTINCTIVE
    .single();

  if (fetchErr || !arac) {
    console.error('Araç bulunamadı:', fetchErr?.message);
    return;
  }

  console.log(`Bulundu: [${arac.id}] ${arac.marka_adi} - ${arac.tip_adi}`);

  // 2. Enrich
  console.log('\nEnrich başlıyor...');
  const enriched = mockEnrich(arac.marka_adi, arac.tip_adi);
  console.log('\nSonuç:');
  console.log(JSON.stringify(enriched, null, 2));

  // 3. DB'ye yaz
  const { error: insertErr } = await supabase
    .from('arac_ozellikleri')
    .upsert({
      arac_tip_id: arac.id,
      ...enriched,
    }, { onConflict: 'arac_tip_id' });

  if (insertErr) {
    console.error('\nDB yazma hatası:', insertErr.message);
    return;
  }

  console.log('\nDB\'ye yazıldı!');

  // 4. Geri oku — doğrula
  const { data: kontrol } = await supabase
    .from('arac_ozellikleri')
    .select('*')
    .eq('arac_tip_id', arac.id)
    .single();

  console.log('\nDB\'den okunan:');
  console.log(JSON.stringify(kontrol, null, 2));
}

main().catch(console.error);
