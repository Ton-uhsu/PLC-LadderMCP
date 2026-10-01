-- +goose Up
CREATE SCHEMA evidence;
CREATE TABLE evidence.poc_fixtures (
  id uuid PRIMARY KEY, fixture_key text NOT NULL UNIQUE, name text NOT NULL,
  feature text NOT NULL, instruction text, classification text NOT NULL CHECK (classification IN ('common','vendor_specific')),
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE evidence.poc_fixture_files (
  id uuid PRIMARY KEY, fixture_id uuid NOT NULL REFERENCES evidence.poc_fixtures(id),
  version_no bigint NOT NULL CHECK (version_no > 0), vendor text NOT NULL, ide_version text NOT NULL, format text NOT NULL,
  filename text NOT NULL, encoding text NOT NULL, media_type text NOT NULL, content bytea NOT NULL,
  byte_length bigint NOT NULL, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, version_no), UNIQUE (fixture_id, id),
  CHECK (byte_length = octet_length(content)), CHECK (sha256 = encode(sha256(content), 'hex'))
);
CREATE TABLE evidence.poc_runs (
  id uuid PRIMARY KEY, fixture_id uuid NOT NULL, source_fixture_file_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('import','export','round_trip')),
  target text NOT NULL CHECK (target IN ('gxworks2','samsoar2022')), ide_version text NOT NULL,
  plc_family text NOT NULL, plc_model text NOT NULL, adapter_version text NOT NULL, build_version text NOT NULL,
  status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','PASS','FAIL','PARTIAL','INTERRUPTED')),
  unavailable_roles jsonb NOT NULL DEFAULT '[]', actor_key text NOT NULL, request_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  UNIQUE (actor_key, request_id), UNIQUE (id, direction),
  FOREIGN KEY (fixture_id, source_fixture_file_id) REFERENCES evidence.poc_fixture_files(fixture_id, id),
  CHECK ((status = 'STARTED') = (finished_at IS NULL)), CHECK (jsonb_typeof(unavailable_roles) = 'array')
);
CREATE TABLE evidence.poc_run_artifacts (
  id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES evidence.poc_runs(id),
  role text NOT NULL CHECK (role IN ('original_source','generated_file','expected_ir','actual_ir')),
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  content bytea, ir_snapshot jsonb, ir_schema_version text,
  filename text, format text NOT NULL, encoding text, media_type text NOT NULL,
  byte_length bigint, sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), source_mapping jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (run_id, role, ordinal), UNIQUE (run_id, id),
  CHECK ((content IS NOT NULL) <> (ir_snapshot IS NOT NULL)),
  CHECK ((role IN ('original_source','generated_file') AND content IS NOT NULL AND filename IS NOT NULL AND encoding IS NOT NULL AND byte_length IS NOT NULL AND ir_schema_version IS NULL) OR
         (role IN ('expected_ir','actual_ir') AND ir_snapshot IS NOT NULL AND ir_schema_version IS NOT NULL AND jsonb_typeof(ir_snapshot) = 'object' AND ir_snapshot->>'version' = ir_schema_version)),
  CHECK (content IS NULL OR byte_length = octet_length(content)),
  CHECK (content IS NULL OR sha256 = encode(sha256(content), 'hex'))
);
CREATE TABLE evidence.compatibility_results (
  id uuid PRIMARY KEY, run_id uuid NOT NULL, feature text NOT NULL, instruction text, operand_form text NOT NULL,
  direction text NOT NULL, result text NOT NULL CHECK (result IN ('PASS','FAIL','PARTIAL','N_A')),
  diagnostics jsonb NOT NULL DEFAULT '[]', metadata_fidelity jsonb NOT NULL DEFAULT '{}',
  expected_artifact_id uuid, actual_artifact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (run_id, direction) REFERENCES evidence.poc_runs(id, direction),
  FOREIGN KEY (run_id, expected_artifact_id) REFERENCES evidence.poc_run_artifacts(run_id, id),
  FOREIGN KEY (run_id, actual_artifact_id) REFERENCES evidence.poc_run_artifacts(run_id, id)
);
CREATE INDEX poc_run_scope ON evidence.poc_runs(fixture_id, target, direction, started_at, id);
CREATE INDEX compatibility_scope ON evidence.compatibility_results(feature, operand_form, direction, run_id);
CREATE VIEW evidence.latest_compatibility_results AS
  SELECT DISTINCT ON (f.fixture_key, r.target, r.ide_version, r.plc_family, r.plc_model, r.adapter_version, c.feature, c.instruction, c.operand_form, c.direction)
    c.id, c.run_id, f.fixture_key, r.target, r.ide_version, r.plc_family, r.plc_model, r.adapter_version,
    c.feature, c.instruction, c.operand_form, c.direction, c.result, c.diagnostics, c.metadata_fidelity, r.finished_at
  FROM evidence.compatibility_results c JOIN evidence.poc_runs r ON r.id = c.run_id
  JOIN evidence.poc_fixtures f ON f.id = r.fixture_id
  WHERE r.status <> 'STARTED'
  ORDER BY f.fixture_key, r.target, r.ide_version, r.plc_family, r.plc_model, r.adapter_version,
    c.feature, c.instruction, c.operand_form, c.direction, r.finished_at DESC, r.id DESC, c.id DESC;
-- +goose StatementBegin
CREATE FUNCTION evidence.guard_open_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM evidence.poc_runs WHERE id = NEW.run_id AND status = 'STARTED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evidence requires an open POC run'; END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER artifact_open_run BEFORE INSERT ON evidence.poc_run_artifacts FOR EACH ROW EXECUTE FUNCTION evidence.guard_open_run();
CREATE TRIGGER result_open_run BEFORE INSERT ON evidence.compatibility_results FOR EACH ROW EXECUTE FUNCTION evidence.guard_open_run();
-- +goose StatementBegin
CREATE FUNCTION evidence.guard_run_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'STARTED' THEN RAISE EXCEPTION 'Sealed POC run cannot be changed'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','finished_at','unavailable_roles']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','finished_at','unavailable_roles']) THEN
    RAISE EXCEPTION 'POC run input cannot be changed';
  END IF;
  IF NEW.status = 'PASS' AND NEW.direction = 'round_trip' AND
     (SELECT count(DISTINCT role) FROM evidence.poc_run_artifacts WHERE run_id = NEW.id) <> 4 THEN
    RAISE EXCEPTION 'Successful round trip requires source, generated file and expected/actual IR';
  END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER poc_starts_open BEFORE INSERT ON evidence.poc_runs FOR EACH ROW EXECUTE FUNCTION app.require_started_run();
CREATE TRIGGER seal_poc_run BEFORE UPDATE OR DELETE ON evidence.poc_runs FOR EACH ROW EXECUTE FUNCTION evidence.guard_run_update();
CREATE TRIGGER no_truncate_poc BEFORE TRUNCATE ON evidence.poc_runs FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation();
-- +goose StatementBegin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['poc_fixture_files','poc_run_artifacts','compatibility_results'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE OR TRUNCATE ON evidence.%I FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation()', t);
  END LOOP;
END;
$$;
-- +goose StatementEnd
-- No PUBLIC/PostgREST grants: ingestion functions and dedicated roles arrive with the evidence API slice.
REVOKE ALL ON SCHEMA evidence FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA evidence FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA evidence FROM PUBLIC;

-- +goose Down
DROP VIEW evidence.latest_compatibility_results;
DROP TABLE evidence.compatibility_results;
DROP TABLE evidence.poc_run_artifacts;
DROP TABLE evidence.poc_runs;
DROP TABLE evidence.poc_fixture_files;
DROP TABLE evidence.poc_fixtures;
DROP FUNCTION evidence.guard_run_update();
DROP FUNCTION evidence.guard_open_run();
DROP SCHEMA evidence;
