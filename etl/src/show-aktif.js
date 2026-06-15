require('dotenv/config');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

async function main() {
  const { data } = await sb.from('kasko_degerleri').select('arac_tip_id').eq('veri_yili', 2026);
  const ids = [...new Set((data ?? []).map(r => r.arac_tip_id))];
  console.log('Toplam aktif tip:', ids.length);

  const { data: tipler } = await sb.from('arac_tipleri').select('marka_adi,tip_adi').in('id', ids.slice(0, 50));
  tipler?.forEach(t => console.log(t.marka_adi, '|', t.tip_adi));
}
main().catch(console.error);
