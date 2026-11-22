-- The app uses a local mock bearer. Only its API establishes the student context.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'exam_runtime') THEN
    CREATE ROLE exam_runtime NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT exam_runtime TO CURRENT_USER;
GRANT USAGE ON SCHEMA exam TO exam_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA exam TO exam_runtime;
GRANT UPDATE (name, grade, school, locale) ON exam.students TO exam_runtime;
GRANT INSERT ON exam.selections, exam.attempts, exam.items, exam.scores TO exam_runtime;
GRANT UPDATE (choice) ON exam.items TO exam_runtime;
GRANT UPDATE (submitted) ON exam.attempts TO exam_runtime;

ALTER TABLE exam.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_profile ON exam.students TO exam_runtime
  USING (id = current_setting('exam.student', true));
CREATE POLICY own_selections ON exam.selections TO exam_runtime
  USING (student = current_setting('exam.student', true));
CREATE POLICY own_attempts ON exam.attempts TO exam_runtime
  USING (student = current_setting('exam.student', true));
CREATE POLICY own_items ON exam.items TO exam_runtime
  USING (EXISTS (SELECT FROM exam.attempts a WHERE a.id = items.attempt));
CREATE POLICY own_scores ON exam.scores TO exam_runtime
  USING (EXISTS (SELECT FROM exam.attempts a WHERE a.id = scores.attempt));
