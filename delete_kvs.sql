-- Delete the two Kostenvoranschläge
DELETE FROM kostenvoranschlag_positionen 
WHERE kostenvoranschlag_id IN (
  SELECT id FROM kostenvoranschlaege 
  WHERE nummer IN ('KV-260002', 'KV-260001')
);

DELETE FROM kostenvoranschlaege 
WHERE nummer IN ('KV-260002', 'KV-260001');
