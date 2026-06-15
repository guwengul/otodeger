CREATE TABLE IF NOT EXISTS sifir_fiyatlari (
  id               SERIAL PRIMARY KEY,
  marka_adi        VARCHAR NOT NULL,
  model_adi        VARCHAR NOT NULL,
  versiyon         VARCHAR NOT NULL,
  fiyat            BIGINT NOT NULL,
  kaynak_url       VARCHAR,
  guncelleme_tarihi TIMESTAMPTZ DEFAULT now(),
  UNIQUE (marka_adi, model_adi, versiyon)
);
