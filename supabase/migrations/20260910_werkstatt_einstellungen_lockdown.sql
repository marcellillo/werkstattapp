-- WICHTIG: Erst ausfuehren, NACHDEM der zugehoerige Code-Deploy (der alle
-- Lese-/Schreibzugriffe von werkstatt_einstellungen auf das gescopte
-- betrieb_einstellungen umstellt) live ist. Vorher ausgefuehrt wuerde dies
-- die aktive E-Mail-Synchronisation (Microsoft Graph) sofort brechen, da der
-- alte Code sonst keine Zeilen mehr lesen/schreiben kann.
--
-- Zweck: werkstatt_einstellungen bleibt als Tabelle bestehen (falls doch noch
-- irgendwo referenziert), aber die bisherige Policy "nur_auth" erlaubte JEDEM
-- eingeloggten Nutzer -- unabhaengig vom eigenen Betrieb -- Zugriff auf live
-- Secrets (Graph-OAuth-Tokens, Anthropic-API-Key, IBAN/BIC). Nach dieser
-- Migration ist die Tabelle nur noch fuer den Service-Role-Key erreichbar
-- (den nur serverseitiger Code mit SUPABASE_SERVICE_ROLE_KEY besitzt), RLS
-- blockiert jeden Zugriff ueber eine normale Nutzer-Session.

DROP POLICY IF EXISTS "nur_auth" ON werkstatt_einstellungen;
-- Keine Ersatz-Policy fuer authenticated/anon: Standardverhalten bei aktivem
-- RLS ohne passende Policy ist "kein Zugriff". Der Service-Role-Key umgeht
-- RLS ohnehin und bleibt für Admin-/Migrationszwecke nutzbar.
