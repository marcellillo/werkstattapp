-- ============================================
-- Bauprojekt Management App – Supabase Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase Auth users)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'monteur' CHECK (role IN ('admin','bauleiter','projektleiter','monteur','buero')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address_street TEXT,
  address_city TEXT,
  address_zip TEXT,
  address_country TEXT DEFAULT 'Deutschland',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','offer_sent','negotiating','won','lost')),
  estimated_value DECIMAL(12,2),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKFLOW TEMPLATES
-- ============================================
CREATE TABLE workflow_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_template_steps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  estimated_days INTEGER
);

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','paused','completed','cancelled')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  address_street TEXT,
  address_city TEXT,
  address_zip TEXT,
  onedrive_folder_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT STEPS
-- ============================================
CREATE TABLE project_steps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','problem')),
  order_index INTEGER NOT NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT TEAM MEMBERS
-- ============================================
CREATE TABLE project_team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_project TEXT,
  UNIQUE(project_id, profile_id)
);

-- ============================================
-- PROJECT UPDATES (Live-Updates)
-- ============================================
CREATE TABLE project_updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  step_id UUID REFERENCES project_steps(id) ON DELETE SET NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'comment' CHECK (update_type IN ('comment','status_change','document','image','milestone')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT ATTACHMENTS
-- ============================================
CREATE TABLE project_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  update_id UUID REFERENCES project_updates(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('status_change','new_document','new_image','deadline','mention','approval')),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all data
CREATE POLICY "Authenticated read" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON workflow_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON workflow_template_steps FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON project_steps FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON project_team_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON project_updates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON project_attachments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

-- Write policies (admin/projektleiter/bauleiter can write)
CREATE POLICY "Managers can write" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can write" ON leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can write" ON workflow_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can write" ON workflow_template_steps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can write" ON projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write steps" ON project_steps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write team" ON project_team_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write updates" ON project_updates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write attachments" ON project_attachments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- AUTO-GENERATE PROJECT NUMBER
-- ============================================
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO seq_num FROM projects WHERE project_number LIKE year_part || '-%';
  NEW.project_number := year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_project_number
  BEFORE INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.project_number IS NULL OR NEW.project_number = '')
  EXECUTE FUNCTION generate_project_number();

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_project_steps_updated_at BEFORE UPDATE ON project_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'monteur');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED: Default Workflow Template
-- ============================================
INSERT INTO workflow_templates (id, name, description, is_default, created_by)
VALUES ('00000000-0000-0000-0000-000000000001', 'Standard Bauablauf', 'Typischer Ablauf für Bauprojekte', TRUE, NULL);

INSERT INTO workflow_template_steps (template_id, title, order_index, estimated_days) VALUES
('00000000-0000-0000-0000-000000000001', 'Aufmaß', 1, 1),
('00000000-0000-0000-0000-000000000001', 'Angebot erstellen', 2, 3),
('00000000-0000-0000-0000-000000000001', 'Auftrag bestätigen', 3, 1),
('00000000-0000-0000-0000-000000000001', 'Material bestellen', 4, 5),
('00000000-0000-0000-0000-000000000001', 'Baustelleneinrichtung', 5, 1),
('00000000-0000-0000-0000-000000000001', 'Rohbau', 6, 14),
('00000000-0000-0000-0000-000000000001', 'Installation', 7, 7),
('00000000-0000-0000-0000-000000000001', 'Qualitätskontrolle', 8, 2),
('00000000-0000-0000-0000-000000000001', 'Abnahme', 9, 1),
('00000000-0000-0000-0000-000000000001', 'Rechnungserstellung', 10, 1);
