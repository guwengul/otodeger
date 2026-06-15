-- TSB ham veri
CREATE TABLE raw_tsb_uploads (
  id             SERIAL PRIMARY KEY,
  dosya_adi      VARCHAR NOT NULL,
  veri_yili      INTEGER NOT NULL,
  veri_ay        INTEGER NOT NULL,
  ham_json       JSONB NOT NULL,
  yukleme_tarihi TIMESTAMPTZ DEFAULT now(),
  UNIQUE (veri_yili, veri_ay)
);

-- Araç tipleri (TSB'den gelen)
CREATE TABLE arac_tipleri (
  id         SERIAL PRIMARY KEY,
  marka_kodu INTEGER NOT NULL,
  tip_kodu   INTEGER NOT NULL,
  marka_adi  VARCHAR NOT NULL,
  tip_adi    VARCHAR NOT NULL,
  UNIQUE (marka_kodu, tip_kodu)
);

-- Kasko değerleri (pivot/long format)
CREATE TABLE kasko_degerleri (
  id           SERIAL PRIMARY KEY,
  arac_tip_id  INTEGER NOT NULL REFERENCES arac_tipleri(id),
  arac_yili    INTEGER NOT NULL,
  kasko_degeri BIGINT NOT NULL,
  veri_yili    INTEGER NOT NULL,
  veri_ay      INTEGER NOT NULL,
  kaynak_id    INTEGER REFERENCES raw_tsb_uploads(id),
  UNIQUE (arac_tip_id, arac_yili, veri_yili, veri_ay)
);

-- Araç özellikleri (LLM enrich)
CREATE TABLE arac_ozellikleri (
  id               SERIAL PRIMARY KEY,
  arac_tip_id      INTEGER NOT NULL REFERENCES arac_tipleri(id) UNIQUE,
  model_adi        VARCHAR,
  versiyon         VARCHAR,
  motor_hacmi      INTEGER,
  motor_gucu       INTEGER,
  yakit_tipi       VARCHAR,
  sanziman         VARCHAR,
  kasa_tipi        VARCHAR,
  segment          VARCHAR,
  koltuk_sayisi    INTEGER,
  arac_tipi        VARCHAR,
  llm_modeli       VARCHAR,
  guven_skoru      SMALLINT,
  manuel_kontrol   BOOLEAN DEFAULT false,
  olusturma_tarihi TIMESTAMPTZ DEFAULT now()
);

-- Araç donanım (LLM enrich, JSONB)
CREATE TABLE arac_donanim (
  id               SERIAL PRIMARY KEY,
  arac_tip_id      INTEGER NOT NULL REFERENCES arac_tipleri(id) UNIQUE,
  donanim          JSONB,
  llm_modeli       VARCHAR,
  guven_skoru      SMALLINT,
  manuel_kontrol   BOOLEAN DEFAULT false,
  olusturma_tarihi TIMESTAMPTZ DEFAULT now()
);

-- Sorgulama performansı için index'ler
CREATE INDEX idx_arac_tipleri_marka ON arac_tipleri(marka_adi);
CREATE INDEX idx_kasko_degerleri_tip ON kasko_degerleri(arac_tip_id);
CREATE INDEX idx_kasko_degerleri_veri_donem ON kasko_degerleri(veri_yili, veri_ay);
