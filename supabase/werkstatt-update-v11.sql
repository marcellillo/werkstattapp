-- v11: Add fahrzeugtyp field for vehicle model codes (W205, F31, MQB, etc.)

-- Add fahrzeugtyp column
ALTER TABLE fahrzeuge ADD COLUMN fahrzeugtyp text;

-- Create index for performance (will be frequently searched in PV Kompass links)
CREATE INDEX idx_fahrzeuge_fahrzeugtyp ON fahrzeuge(fahrzeugtyp);
