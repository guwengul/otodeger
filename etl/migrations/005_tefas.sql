-- TEFAS fon verileri (YAT + EMK + BYF)
CREATE TABLE IF NOT EXISTS tefas_fon_verileri (
  id                 BIGSERIAL PRIMARY KEY,
  tarih              DATE        NOT NULL,
  "fonTipi"          VARCHAR(3)  NOT NULL DEFAULT 'YAT', -- YAT | EMK | BYF
  "fonKodu"          TEXT        NOT NULL,
  "fonUnvan"         TEXT,
  "fiyat"            NUMERIC,
  "tedPaySayisi"     NUMERIC,
  "kisiSayisi"       INTEGER,
  "portfoyBuyukluk"  NUMERIC,
  "borsaBultenFiyat" NUMERIC,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tarih, "fonTipi", "fonKodu")
);

CREATE INDEX IF NOT EXISTS idx_tefas_tarih      ON tefas_fon_verileri (tarih);
CREATE INDEX IF NOT EXISTS idx_tefas_fonkodu    ON tefas_fon_verileri ("fonKodu");
CREATE INDEX IF NOT EXISTS idx_tefas_tip_kod    ON tefas_fon_verileri ("fonTipi", "fonKodu");
CREATE INDEX IF NOT EXISTS idx_tefas_tarih_tip  ON tefas_fon_verileri (tarih, "fonTipi");
