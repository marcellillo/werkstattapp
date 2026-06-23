-- ============================================================
-- Kfz-Werkstatt Management Schema
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'mechaniker' CHECK (role IN ('admin', 'werkstattmeister', 'mechaniker')),
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Kunden (Customers)
CREATE TABLE IF NOT EXISTS kunden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname text NOT NULL DEFAULT '',
  nachname text NOT NULL DEFAULT '',
  firma text,
  email text,
  telefon text,
  mobil text,
  strasse text,
  plz text,
  ort text,
  notizen text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hebebühnen (Lift Bays)
CREATE TABLE IF NOT EXISTS hebebuehnen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nummer int NOT NULL UNIQUE CHECK (nummer BETWEEN 1 AND 10),
  bezeichnung text NOT NULL,
  beschreibung text,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

-- Seed: 4 Hebebühnen
INSERT INTO hebebuehnen (nummer, bezeichnung) VALUES
  (1, 'Bühne 1'),
  (2, 'Bühne 2'),
  (3, 'Bühne 3'),
  (4, 'Bühne 4')
ON CONFLICT (nummer) DO NOTHING;

-- Fahrzeuge (Vehicles)
CREATE TABLE IF NOT EXISTS fahrzeuge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunden_id uuid REFERENCES kunden(id) ON DELETE SET NULL,
  marke text NOT NULL DEFAULT '',
  modell text NOT NULL DEFAULT '',
  kennzeichen text NOT NULL DEFAULT '',
  fahrgestellnummer text,
  baujahr int,
  kilometerstand int,
  farbe text,
  motortyp text,
  hubraum text,
  leistung_kw int,
  naechste_hauptuntersuchung date,
  notizen text,
  mobile_de_id text,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

-- Auftraege (Work Orders)
CREATE TABLE IF NOT EXISTS auftraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_nr text NOT NULL,
  fahrzeug_id uuid NOT NULL REFERENCES fahrzeuge(id) ON DELETE CASCADE,
  kunden_id uuid REFERENCES kunden(id) ON DELETE SET NULL,
  hebebuehne_id uuid REFERENCES hebebuehnen(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'angenommen'
    CHECK (status IN ('angenommen', 'diagnose', 'reparatur', 'warten_teile', 'fertig', 'ausgeliefert')),
  arbeiten text,
  bemerkungen text,
  zugewiesen_an uuid REFERENCES profiles(id) ON DELETE SET NULL,
  geplante_fertigstellung date,
  fertiggestellt_am timestamptz,
  einnahmen numeric(10,2),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

-- Auto-increment Auftrag-Nummer
CREATE SEQUENCE IF NOT EXISTS auftrag_nr_seq START 1000;

-- Ersatzteile (Spare Parts)
CREATE TABLE IF NOT EXISTS ersatzteile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  bezeichnung text NOT NULL,
  teilenummer text,
  lieferant text,
  menge int NOT NULL DEFAULT 1,
  einzelpreis numeric(10,2),
  status text NOT NULL DEFAULT 'nicht_bestellt'
    CHECK (status IN ('nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut')),
  bestellt_am timestamptz,
  geliefert_am timestamptz,
  notizen text,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

-- Status-Historie (History)
CREATE TABLE IF NOT EXISTS status_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  status_alt text,
  status_neu text NOT NULL,
  geaendert_von uuid REFERENCES profiles(id) ON DELETE SET NULL,
  bemerkung text,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

-- E-Mail-Protokoll
CREATE TABLE IF NOT EXISTS email_protokoll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid REFERENCES auftraege(id) ON DELETE SET NULL,
  ersatzteil_id uuid REFERENCES ersatzteile(id) ON DELETE SET NULL,
  absender text,
  betreff text,
  inhalt text,
  empfangen_am timestamptz NOT NULL DEFAULT now(),
  erkannter_status text,
  verarbeitet boolean NOT NULL DEFAULT false
);

-- Benachrichtigungen (Notifications)
CREATE TABLE IF NOT EXISTS benachrichtigungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benutzer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  titel text NOT NULL,
  nachricht text NOT NULL,
  typ text NOT NULL DEFAULT 'info'
    CHECK (typ IN ('info', 'warnung', 'fehler', 'teil_eingetroffen', 'termin_ueberschritten', 'zu_lange_auf_buehne')),
  auftrag_id uuid REFERENCES auftraege(id) ON DELETE SET NULL,
  gelesen boolean NOT NULL DEFAULT false,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Triggers
-- ============================================================

-- Updated_at auto-update
CREATE OR REPLACE FUNCTION update_aktualisiert_am()
RETURNS TRIGGER AS $$
BEGIN
  NEW.aktualisiert_am = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fahrzeuge_updated
  BEFORE UPDATE ON fahrzeuge
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

CREATE TRIGGER trg_auftraege_updated
  BEFORE UPDATE ON auftraege
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

CREATE TRIGGER trg_ersatzteile_updated
  BEFORE UPDATE ON ersatzteile
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

-- Status-Änderung → Historie eintragen
CREATE OR REPLACE FUNCTION log_auftrag_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_historie (auftrag_id, status_alt, status_neu)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auftrag_status_log
  AFTER UPDATE ON auftraege
  FOR EACH ROW EXECUTE FUNCTION log_auftrag_status_change();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;
ALTER TABLE hebebuehnen ENABLE ROW LEVEL SECURITY;
ALTER TABLE fahrzeuge ENABLE ROW LEVEL SECURITY;
ALTER TABLE auftraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE ersatzteile ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_historie ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_protokoll ENABLE ROW LEVEL SECURITY;
ALTER TABLE benachrichtigungen ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write everything (role-based in app)
CREATE POLICY "auth_all" ON profiles FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON kunden FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON hebebuehnen FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON fahrzeuge FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON auftraege FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON ersatzteile FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON status_historie FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON email_protokoll FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON benachrichtigungen FOR ALL TO authenticated USING (benutzer_id = auth.uid());

-- Profile auto-create on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Demo-Daten
-- ============================================================

-- Demo-Kunde
INSERT INTO kunden (id, vorname, nachname, firma, telefon, mobil, ort)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Hans', 'Müller', NULL, '0711 123456', '0171 9876543', 'Stuttgart'),
  ('22222222-2222-2222-2222-222222222222', 'Maria', 'Schmidt', 'Schmidt GmbH', '0711 654321', '0172 1234567', 'Esslingen'),
  ('33333333-3333-3333-3333-333333333333', 'Klaus', 'Wagner', NULL, '0711 111222', '0173 5556667', 'Sindelfingen'),
  ('44444444-4444-4444-4444-444444444444', 'Anna', 'Becker', 'Becker Transport', '0711 333444', '0174 8889990', 'Ludwigsburg')
ON CONFLICT DO NOTHING;

-- Demo-Fahrzeuge
INSERT INTO fahrzeuge (id, kunden_id, marke, modell, kennzeichen, baujahr, kilometerstand)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'BMW', '3er (F30)', 'S-AB 1234', 2019, 87000),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Mercedes', 'C-Klasse', 'ES-SC 5678', 2020, 52000),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'VW', 'Golf 8', 'SYN-WA 91', 2022, 31000),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 'Audi', 'A4', 'LB-BE 2024', 2021, 43000)
ON CONFLICT DO NOTHING;

-- Demo-Aufträge (mit Hebebühnen-Zuweisungen)
INSERT INTO auftraege (id, auftrag_nr, fahrzeug_id, kunden_id, hebebuehne_id, status, arbeiten, geplante_fertigstellung)
SELECT
  'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
  'AU-1001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  h.id,
  'reparatur',
  'Bremsen vorne erneuern, Ölwechsel',
  CURRENT_DATE + interval '2 days'
FROM hebebuehnen h WHERE h.nummer = 1
ON CONFLICT DO NOTHING;

INSERT INTO auftraege (id, auftrag_nr, fahrzeug_id, kunden_id, hebebuehne_id, status, arbeiten, geplante_fertigstellung)
SELECT
  'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
  'AU-1002',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  h.id,
  'warten_teile',
  'Kupplung wechseln',
  CURRENT_DATE + interval '5 days'
FROM hebebuehnen h WHERE h.nummer = 2
ON CONFLICT DO NOTHING;

INSERT INTO auftraege (id, auftrag_nr, fahrzeug_id, kunden_id, hebebuehne_id, status, arbeiten, geplante_fertigstellung)
SELECT
  'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
  'AU-1003',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '33333333-3333-3333-3333-333333333333',
  h.id,
  'diagnose',
  'TÜV vorbereiten, Inspektion',
  CURRENT_DATE + interval '1 day'
FROM hebebuehnen h WHERE h.nummer = 3
ON CONFLICT DO NOTHING;

-- Demo-Ersatzteile
INSERT INTO ersatzteile (auftrag_id, bezeichnung, teilenummer, lieferant, menge, einzelpreis, status)
VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Bremsscheiben vorne', 'TRW-BRC-1234', 'TRW', 2, 89.90, 'geliefert'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Bremsbeläge vorne', 'FER-BP-5678', 'Ferodo', 1, 45.50, 'eingebaut'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'Kupplung komplett', 'LUK-CLK-9012', 'LuK', 1, 320.00, 'unterwegs'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'Ausrücklager', 'SKF-BRG-3456', 'SKF', 1, 35.00, 'bestellt'),
  ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'Ölfilter', 'MAN-OLF-7890', 'Mann Filter', 1, 12.90, 'geliefert')
ON CONFLICT DO NOTHING;
