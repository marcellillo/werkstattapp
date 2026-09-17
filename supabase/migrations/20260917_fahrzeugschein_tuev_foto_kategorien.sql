-- Erweitert auftrag_fotos um zwei neue Kategorien, damit Fahrzeugschein-Fotos und
-- TÜV-Berichte über den bereits vorhandenen Foto-Upload (Kamera/Galerie, pro Auftrag)
-- erfasst werden können und automatisch in der Auftragsmappe auftauchen. Betrifft
-- auch Eigenfahrzeuge, da jedes Eigenfahrzeug eine eigene auftraege-Zeile hat und
-- über dieselbe Fahrzeug-Detailseite läuft wie ein Kundenauftrag.

ALTER TABLE auftrag_fotos DROP CONSTRAINT IF EXISTS auftrag_fotos_kategorie_check;
ALTER TABLE auftrag_fotos ADD CONSTRAINT auftrag_fotos_kategorie_check
  CHECK (kategorie = ANY (ARRAY['annahme', 'reparatur', 'fertig', 'allgemein', 'fahrzeugschein', 'tuev']));
