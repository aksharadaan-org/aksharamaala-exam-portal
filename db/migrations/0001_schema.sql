CREATE SCHEMA exam;
SET search_path = exam;
CREATE TABLE schools(id TEXT PRIMARY KEY, district TEXT NOT NULL);
CREATE TABLE students(id TEXT PRIMARY KEY, school TEXT NOT NULL REFERENCES schools, name TEXT NOT NULL, grade TEXT NOT NULL, locale TEXT NOT NULL CHECK(locale IN ('en','te')));
CREATE TABLE qualities(id TEXT PRIMARY KEY, dimension TEXT NOT NULL, en TEXT NOT NULL, te TEXT NOT NULL);
CREATE TABLE selections(student TEXT REFERENCES students, quality TEXT REFERENCES qualities, PRIMARY KEY(student,quality));
CREATE TABLE questions(id TEXT PRIMARY KEY, quality TEXT NOT NULL REFERENCES qualities, en TEXT NOT NULL, te TEXT NOT NULL, options JSONB NOT NULL, correct INTEGER NOT NULL CHECK(correct IN (0,1)));
CREATE TABLE attempts(id TEXT PRIMARY KEY, student TEXT NOT NULL REFERENCES students, stage INTEGER NOT NULL CHECK(stage BETWEEN 0 AND 4), created TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, submitted TIMESTAMPTZ, UNIQUE(student,stage));
CREATE TABLE items(attempt TEXT REFERENCES attempts, question TEXT REFERENCES questions, choice INTEGER CHECK(choice IN (0,1)), PRIMARY KEY(attempt,question));
CREATE TABLE scores(attempt TEXT REFERENCES attempts, quality TEXT REFERENCES qualities, earned INTEGER NOT NULL, possible INTEGER NOT NULL, PRIMARY KEY(attempt,quality));

CREATE TABLE stage_windows (
  stage INTEGER PRIMARY KEY CHECK(stage BETWEEN 0 AND 4),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL CHECK(closes_at > opens_at)
);
CREATE INDEX questions_by_quality ON questions(quality);
