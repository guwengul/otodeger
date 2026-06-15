-- Staging tablo (import sonrası silinecek)
CREATE TABLE staging_kasko (
  marka_kodu   INTEGER,
  tip_kodu     INTEGER,
  arac_yili    INTEGER,
  kasko_degeri BIGINT,
  veri_yili    INTEGER,
  veri_ay      INTEGER
);
