CREATE TABLE IF NOT EXISTS sifir_fiyat_eslesme (
  arac_tip_id    INTEGER PRIMARY KEY REFERENCES arac_tipleri(id),
  sifir_fiyat_id INTEGER REFERENCES sifir_fiyatlari(id),
  eslesme_skoru  NUMERIC(4,3),
  manuel_kontrol BOOLEAN DEFAULT false,
  olusturma_tarihi TIMESTAMPTZ DEFAULT now()
);
