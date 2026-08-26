PRAGMA foreign_keys = ON;

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  input_json TEXT NOT NULL,
  weather_json TEXT,
  judge_model_id TEXT,
  successful_output_count INTEGER NOT NULL CHECK (successful_output_count >= 0),
  top_candidate_output_id TEXT,
  error_message TEXT
);

CREATE TABLE candidate_outputs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  model_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'timed_out')),
  lyrics TEXT,
  response_time_ms INTEGER,
  estimated_cost_usd REAL,
  error_message TEXT,
  UNIQUE (run_id, position)
);

CREATE TABLE judge_evaluations (
  candidate_output_id TEXT PRIMARY KEY REFERENCES candidate_outputs(id) ON DELETE CASCADE,
  instruction_following_score REAL NOT NULL,
  instruction_following_reasoning TEXT NOT NULL,
  lyrical_quality_score REAL NOT NULL,
  lyrical_quality_reasoning TEXT NOT NULL,
  creativity_score REAL NOT NULL,
  creativity_reasoning TEXT NOT NULL,
  weather_relevance_score REAL NOT NULL,
  weather_relevance_reasoning TEXT NOT NULL
);

CREATE TABLE candidate_rankings (
  candidate_output_id TEXT PRIMARY KEY REFERENCES candidate_outputs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ranked', 'unranked')),
  quality_score REAL NOT NULL,
  cost_score REAL,
  speed_score REAL,
  overall_value REAL,
  rank INTEGER
);

CREATE INDEX runs_created_at_id_desc ON runs (created_at DESC, id DESC);
CREATE INDEX candidate_outputs_run_position ON candidate_outputs (run_id, position);
