-- Wartungs-Spezifikationen (Herstellervorgaben)
CREATE TABLE maintenance_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Fahrzeugidentifikation
  fahrzeugtyp TEXT NOT NULL, -- z.B. "W205" (Mercedes C-Klasse)
  marke TEXT NOT NULL,       -- z.B. "Mercedes-Benz"
  modell TEXT NOT NULL,      -- z.B. "C 200"
  baujahr_von INT,
  baujahr_bis INT,

  -- Motoröl
  motoroel_typ TEXT,         -- z.B. "5W-30"
  motoroel_menge DECIMAL(4, 2), -- in Litern

  -- Klimagas
  klimagas_typ TEXT,         -- z.B. "R134a"
  klimagas_menge DECIMAL(5, 2), -- in Gramm

  -- Andere Flüssigkeiten
  kuehler_typ TEXT,
  kuehler_menge DECIMAL(4, 2),
  bremsflussigkeit_typ TEXT,
  bremsflussigkeit_menge DECIMAL(4, 2),
  lenkoel_typ TEXT,
  lenkoel_menge DECIMAL(4, 2),

  -- Wartungsintervalle (in Monaten/KM)
  oelwechsel_km INT,        -- z.B. 15000
  oelwechsel_monate INT,    -- z.B. 12
  luftfilter_km INT,
  luftfilter_monate INT,

  -- Quelle & Verifizierung
  quelle TEXT,              -- z.B. "pv-kompass", "mobile.de", "manuell"
  verifiziert_am DATE,
  notizen TEXT,

  erstellt_am TIMESTAMPTZ DEFAULT NOW(),
  aktualisiert_am TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(betrieb_id, fahrzeugtyp, baujahr_von, baujahr_bis)
);

-- Indexes
CREATE INDEX idx_maintenance_betrieb ON maintenance_specs(betrieb_id);
CREATE INDEX idx_maintenance_fahrzeugtyp ON maintenance_specs(fahrzeugtyp);
CREATE INDEX idx_maintenance_marke_modell ON maintenance_specs(marke, modell);

-- RLS Policies
ALTER TABLE maintenance_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "betrieb_select" ON maintenance_specs FOR SELECT
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));

CREATE POLICY "betrieb_insert" ON maintenance_specs FOR INSERT
  WITH CHECK (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));

CREATE POLICY "betrieb_update" ON maintenance_specs FOR UPDATE
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));
