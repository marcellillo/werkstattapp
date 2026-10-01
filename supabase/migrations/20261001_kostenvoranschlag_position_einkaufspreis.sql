-- Speichert den Einkaufspreis (EK) je Position zusätzlich zum bereits
-- vorhandenen Verkaufspreis (einzelpreis, mit 45% Aufschlag). Bisher wurde der
-- EK beim Anlegen einer Kostenvoranschlag-Position (api/kostenvoranschlag/
-- add-teile) nur kurz zur Berechnung des Aufschlags verwendet und danach
-- verworfen -- für eine echte Gewinn-Berechnung (VK - EK) in den Statistiken
-- fehlte der Wert dadurch komplett.
ALTER TABLE kostenvoranschlag_position ADD COLUMN IF NOT EXISTS einkaufspreis double precision;
