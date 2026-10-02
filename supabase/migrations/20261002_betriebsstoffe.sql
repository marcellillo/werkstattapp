-- Betriebsstoffe (Motoröl, Wischwasser, ...): Flüssigkeiten, die in Litern eingefüllt
-- und dem Kunden zu einem festen Literpreis berechnet werden, inkl. Bestandsführung.
--
--   betriebsstoffe            Stoffarten mit Literpreis (VK netto) und optionalem Einkaufspreis
--   betriebsstoff_zugaenge    Bestandszugänge (Fass gekauft, Anfangsbestand, Korrekturen)
--   rechnung_betriebsstoffe   Verkauf: Liter je Rechnung (Schnappschuss von Name/Preis)
--
-- Bestand = Summe Zugänge - Summe verkaufter Liter (nicht stornierter Rechnungen).
-- Wird eine Rechnung gelöscht, verschwinden ihre Zeilen per CASCADE; bei Storno werden
-- sie in der Bestandsberechnung ausgefiltert -- die Liter sind automatisch wieder im Bestand.

CREATE TABLE IF NOT EXISTS betriebsstoffe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  einheit TEXT NOT NULL DEFAULT 'L',
  preis_pro_einheit NUMERIC(10,2) NOT NULL DEFAULT 0,
  einkaufspreis_pro_einheit NUMERIC(10,2),
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  sortierung INTEGER NOT NULL DEFAULT 0,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (betrieb_id, name)
);

CREATE TABLE IF NOT EXISTS betriebsstoff_zugaenge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  betriebsstoff_id UUID NOT NULL REFERENCES betriebsstoffe(id) ON DELETE CASCADE,
  menge NUMERIC(10,2) NOT NULL CHECK (menge <> 0),
  bemerkung TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rechnung_betriebsstoffe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  rechnung_id UUID NOT NULL REFERENCES kunden_rechnungen(id) ON DELETE CASCADE,
  betriebsstoff_id UUID REFERENCES betriebsstoffe(id) ON DELETE SET NULL,
  bezeichnung TEXT NOT NULL,
  einheit TEXT NOT NULL DEFAULT 'L',
  menge NUMERIC(10,2) NOT NULL CHECK (menge > 0),
  preis_pro_einheit NUMERIC(10,2) NOT NULL,
  einkaufspreis_pro_einheit NUMERIC(10,2),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_betriebsstoff_zugaenge_stoff ON betriebsstoff_zugaenge(betriebsstoff_id);
CREATE INDEX IF NOT EXISTS idx_rechnung_betriebsstoffe_rechnung ON rechnung_betriebsstoffe(rechnung_id);
CREATE INDEX IF NOT EXISTS idx_rechnung_betriebsstoffe_stoff ON rechnung_betriebsstoffe(betriebsstoff_id);

ALTER TABLE betriebsstoffe ENABLE ROW LEVEL SECURITY;
ALTER TABLE betriebsstoff_zugaenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE rechnung_betriebsstoffe ENABLE ROW LEVEL SECURITY;

-- Lesen/Anlegen/Ändern: jedes Mitglied des Betriebs (Mechaniker füllen ein und buchen Zugänge).
-- Löschen von Stoffarten und Zugangsbuchungen: nur Admin/Superadmin.
CREATE POLICY "betriebsstoffe_select" ON betriebsstoffe FOR SELECT TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
CREATE POLICY "betriebsstoffe_insert" ON betriebsstoffe FOR INSERT TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
CREATE POLICY "betriebsstoffe_update" ON betriebsstoffe FOR UPDATE TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
CREATE POLICY "betriebsstoffe_delete" ON betriebsstoffe FOR DELETE TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "betriebsstoff_zugaenge_select" ON betriebsstoff_zugaenge FOR SELECT TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
CREATE POLICY "betriebsstoff_zugaenge_insert" ON betriebsstoff_zugaenge FOR INSERT TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
CREATE POLICY "betriebsstoff_zugaenge_delete" ON betriebsstoff_zugaenge FOR DELETE TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Verkaufszeilen sind Schnappschüsse einer ausgestellten Rechnung: nur lesen und beim
-- Erstellen der Rechnung anlegen, nicht nachträglich ändern.
CREATE POLICY "rechnung_betriebsstoffe_select" ON rechnung_betriebsstoffe FOR SELECT TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
CREATE POLICY "rechnung_betriebsstoffe_insert" ON rechnung_betriebsstoffe FOR INSERT TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
