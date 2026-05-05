-- === USERS ===
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','lecturer','admin')),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reg_no TEXT UNIQUE,
  ic_no TEXT,
  diploma_institution TEXT,
  diploma_programme TEXT,
  cgpa REAL,
  intended_programme_id TEXT
);

CREATE TABLE IF NOT EXISTS lecturers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT,
  faculty TEXT DEFAULT 'FTSM'
);

-- === UNIVERSITY DATA (seeded) ===
CREATE TABLE IF NOT EXISTS uni_programmes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  faculty TEXT NOT NULL DEFAULT 'FTSM',
  university TEXT NOT NULL DEFAULT 'UKM'
);

CREATE TABLE IF NOT EXISTS uni_subjects (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES uni_programmes(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  credit INTEGER NOT NULL,
  status TEXT,
  synopsis TEXT,
  topics_json TEXT NOT NULL,
  references_json TEXT NOT NULL,
  prerequisites TEXT,
  UNIQUE(programme_id, code)
);

-- === DIPLOMA DATA (pool) ===
CREATE TABLE IF NOT EXISTS diploma_subjects (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  credit INTEGER NOT NULL,
  institution TEXT NOT NULL,
  synopsis TEXT,
  topics_json TEXT NOT NULL,
  references_json TEXT NOT NULL,
  prerequisites TEXT,
  pdf_path TEXT
);

-- === STUDENT UPLOADS ===
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(user_id),
  pdf_hash TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  parsed_json TEXT NOT NULL,
  cgpa REAL,
  uploaded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript_entries (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  credit INTEGER NOT NULL,
  grade TEXT NOT NULL,
  semester TEXT,
  remark TEXT
);

CREATE TABLE IF NOT EXISTS uploaded_syllabi (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(user_id),
  analysis_id TEXT,
  pdf_hash TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  parsed_json TEXT,
  subject_code TEXT,
  uploaded_at INTEGER NOT NULL
);

-- === ANALYSIS ===
CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(user_id),
  type TEXT NOT NULL CHECK(type IN ('credit_transfer','pre_enrolment')),
  target_programme_id TEXT NOT NULL REFERENCES uni_programmes(id),
  status TEXT NOT NULL CHECK(status IN ('pending','running','complete','failed')),
  prompt_text TEXT,
  transcript_id TEXT REFERENCES transcripts(id),
  syllabus_ids_json TEXT,
  result_json TEXT,
  strategies_json TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- === CACHE ===
CREATE TABLE IF NOT EXISTS match_cache (
  cache_key TEXT PRIMARY KEY,
  uni_subject_code TEXT NOT NULL,
  diploma_subject_codes_json TEXT NOT NULL,
  phase1_result_json TEXT NOT NULL,
  llm_verdict_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- === APPLICATIONS ===
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(user_id),
  analysis_id TEXT NOT NULL REFERENCES analyses(id),
  target_programme_id TEXT NOT NULL REFERENCES uni_programmes(id),
  chosen_strategy_index INTEGER NOT NULL,
  strategy_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('submitted','in_review','approved','rejected','partial','abandoned')),
  report_pdf_path TEXT,
  submitted_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  last_student_activity_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS application_items (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  uni_subject_code TEXT NOT NULL,
  diploma_subject_codes_json TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK(claim_type IN ('standalone','combo')),
  agent_verdict TEXT NOT NULL,
  agent_reason TEXT NOT NULL,
  agent_coverage_percent INTEGER NOT NULL,
  lecturer_decision TEXT CHECK(lecturer_decision IN ('approved','rejected','pending')) DEFAULT 'pending',
  lecturer_note TEXT,
  decided_at INTEGER,
  decided_by TEXT REFERENCES users(id)
);

-- === NOTIFICATIONS ===
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- === AUDIT LOG ===
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_uni_subjects_programme ON uni_subjects(programme_id);
CREATE INDEX IF NOT EXISTS idx_diploma_subjects_code ON diploma_subjects(code);
CREATE INDEX IF NOT EXISTS idx_analyses_student ON analyses(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_application_items_app ON application_items(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
