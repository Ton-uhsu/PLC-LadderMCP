-- +goose Up
CREATE TABLE app.compile_runs (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, project_revision_id uuid NOT NULL,
  validation_run_id uuid NOT NULL UNIQUE, logic_hash text NOT NULL CHECK (logic_hash ~ '^[0-9a-f]{64}$'),
  plc_family text NOT NULL, plc_model text NOT NULL,
  capability_version text NOT NULL, validator_version text NOT NULL, compiler_version text NOT NULL,
  status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','PASS','FAIL','INTERRUPTED')),
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  actor_key text NOT NULL, request_id text NOT NULL,
  UNIQUE (project_id, id), UNIQUE (project_id, actor_key, request_id),
  FOREIGN KEY (project_id, project_revision_id) REFERENCES app.project_revisions(project_id, id),
  FOREIGN KEY (project_id, validation_run_id, project_revision_id) REFERENCES app.validation_runs(project_id, id, project_revision_id),
  CHECK ((status = 'STARTED') = (finished_at IS NULL))
);
CREATE VIEW app.compile_diagnostics AS
  SELECT c.id AS compile_run_id, c.project_id, c.project_revision_id,
         d.id, d.code, d.severity, d.message, d.operation_id, d.network_id, d.node_id, d.device, d.path, d.related_locations, d.context
  FROM app.compile_runs c JOIN app.validation_diagnostics d ON d.validation_run_id = c.validation_run_id;
CREATE TABLE app.export_versions (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, project_revision_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, project_revision_id), UNIQUE (project_id, project_revision_id, id),
  FOREIGN KEY (project_id, project_revision_id) REFERENCES app.project_revisions(project_id, id)
);
CREATE TABLE app.export_events (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, project_revision_id uuid NOT NULL,
  export_version_id uuid, compile_run_id uuid, adapter_validation_run_id uuid,
  target text NOT NULL CHECK (target IN ('gxworks2','samsoar2022')), ide_version text NOT NULL, format text NOT NULL,
  plc_family text NOT NULL, plc_model text NOT NULL, adapter_version text NOT NULL, build_version text NOT NULL,
  note text, status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','SUCCESS','FAILED','SUPERSEDED','INTERRUPTED')),
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  actor_key text NOT NULL, request_id text NOT NULL,
  UNIQUE (project_id, actor_key, request_id), UNIQUE (project_id, id),
  UNIQUE (id, project_revision_id, target, ide_version, format),
  FOREIGN KEY (project_id, project_revision_id) REFERENCES app.project_revisions(project_id, id),
  FOREIGN KEY (project_id, project_revision_id, export_version_id) REFERENCES app.export_versions(project_id, project_revision_id, id),
  FOREIGN KEY (project_id, compile_run_id) REFERENCES app.compile_runs(project_id, id),
  FOREIGN KEY (project_id, adapter_validation_run_id, project_revision_id) REFERENCES app.validation_runs(project_id, id, project_revision_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((status = 'STARTED') = (finished_at IS NULL)),
  CHECK (status <> 'SUCCESS' OR (export_version_id IS NOT NULL AND compile_run_id IS NOT NULL AND adapter_validation_run_id IS NOT NULL))
);
ALTER TABLE app.validation_runs ADD CONSTRAINT validation_export_same_project
  FOREIGN KEY (project_id, export_event_id) REFERENCES app.export_events(project_id, id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE app.export_artifacts (
  id uuid PRIMARY KEY, export_event_id uuid NOT NULL, project_revision_id uuid NOT NULL,
  target text NOT NULL, ide_version text NOT NULL, format text NOT NULL,
  filename text NOT NULL, media_type text NOT NULL, encoding text NOT NULL,
  content bytea NOT NULL, byte_length bigint NOT NULL, sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (export_event_id, project_revision_id, target, ide_version, format)
    REFERENCES app.export_events(id, project_revision_id, target, ide_version, format),
  CHECK (byte_length = octet_length(content)), CHECK (sha256 = encode(sha256(content), 'hex'))
);
CREATE TABLE app.audit_events (
  id uuid PRIMARY KEY, event_type text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('human','mcp','system')), actor_key text NOT NULL,
  correlation_id text NOT NULL, project_id uuid REFERENCES app.projects(id), project_revision_id uuid,
  batch_id uuid, proposal_id uuid REFERENCES app.network_proposals(id), review_round_id uuid REFERENCES app.review_rounds(id),
  validation_run_id uuid, compile_run_id uuid, export_event_id uuid,
  detail jsonb NOT NULL CHECK (jsonb_typeof(detail) = 'object'), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, project_revision_id) REFERENCES app.project_revisions(project_id, id),
  FOREIGN KEY (project_id, batch_id) REFERENCES app.change_batches(project_id, id),
  FOREIGN KEY (project_id, validation_run_id) REFERENCES app.validation_runs(project_id, id),
  FOREIGN KEY (project_id, compile_run_id) REFERENCES app.compile_runs(project_id, id),
  FOREIGN KEY (project_id, export_event_id) REFERENCES app.export_events(project_id, id),
  CHECK (project_id IS NOT NULL OR (project_revision_id IS NULL AND batch_id IS NULL AND proposal_id IS NULL AND review_round_id IS NULL AND validation_run_id IS NULL AND compile_run_id IS NULL AND export_event_id IS NULL))
);
CREATE TABLE app.request_deduplication (
  id uuid PRIMARY KEY, caller_key text NOT NULL, operation_scope text NOT NULL, idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'), result_status integer NOT NULL CHECK (result_status BETWEEN 100 AND 599),
  project_id uuid REFERENCES app.projects(id), batch_id uuid REFERENCES app.change_batches(id),
  apply_event_id uuid REFERENCES app.apply_events(id), export_event_id uuid REFERENCES app.export_events(id),
  result_body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caller_key, operation_scope, idempotency_key)
);
CREATE INDEX compile_project_history ON app.compile_runs(project_id, started_at, id);
CREATE INDEX export_project_history ON app.export_events(project_id, started_at, id);
CREATE INDEX export_artifact_event ON app.export_artifacts(export_event_id);
CREATE INDEX audit_project_history ON app.audit_events(project_id, created_at, id);
CREATE TRIGGER seal_compile BEFORE UPDATE OR DELETE ON app.compile_runs FOR EACH ROW EXECUTE FUNCTION app.reject_sealed_run_mutation();
-- Export checkpoint/result references are set during finalization; input fields remain fixed.
-- +goose StatementBegin
CREATE FUNCTION app.guard_export_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'STARTED' THEN RAISE EXCEPTION 'Sealed export cannot be changed'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','finished_at','export_version_id','adapter_validation_run_id','compile_run_id']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','finished_at','export_version_id','adapter_validation_run_id','compile_run_id']) THEN
    RAISE EXCEPTION 'Export input cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER seal_export BEFORE UPDATE OR DELETE ON app.export_events FOR EACH ROW EXECUTE FUNCTION app.guard_export_update();
-- +goose StatementBegin
CREATE FUNCTION app.guard_export_success() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e app.export_events;
BEGIN
  SELECT * INTO e FROM app.export_events WHERE id = NEW.id;
  IF e.status = 'SUCCESS' THEN
    IF NOT EXISTS (SELECT 1 FROM app.export_artifacts WHERE export_event_id = e.id) OR
       NOT EXISTS (SELECT 1 FROM app.compile_runs WHERE id = e.compile_run_id AND status = 'PASS') OR
       NOT EXISTS (SELECT 1 FROM app.validation_runs WHERE id = e.adapter_validation_run_id AND kind = 'adapter' AND status = 'PASS' AND export_event_id = e.id) THEN
      RAISE EXCEPTION 'Successful export requires passing gates and retained bytes';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
-- +goose StatementEnd
CREATE CONSTRAINT TRIGGER export_success_complete AFTER INSERT OR UPDATE ON app.export_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.guard_export_success();
-- +goose StatementBegin
CREATE FUNCTION app.guard_artifact_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM app.export_events WHERE id = NEW.export_event_id AND status = 'STARTED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Artifacts require an open export'; END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER artifact_open_export BEFORE INSERT ON app.export_artifacts FOR EACH ROW EXECUTE FUNCTION app.guard_artifact_insert();
-- +goose StatementBegin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['export_versions','export_artifacts','audit_events','request_deduplication'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE OR TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['compile_runs','export_events'] LOOP
    EXECUTE format('CREATE TRIGGER no_truncate_history BEFORE TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation()', t);
  END LOOP;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER compile_starts_open BEFORE INSERT ON app.compile_runs FOR EACH ROW EXECUTE FUNCTION app.require_started_run();
CREATE TRIGGER export_starts_open BEFORE INSERT ON app.export_events FOR EACH ROW EXECUTE FUNCTION app.require_started_run();
-- +goose StatementBegin
CREATE FUNCTION app.guard_compile_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.validation_runs v JOIN app.project_revisions r ON r.id = NEW.project_revision_id
    WHERE v.id = NEW.validation_run_id AND v.kind = 'compile' AND r.logic_hash = NEW.logic_hash
      AND r.plc_family = NEW.plc_family AND r.plc_model = NEW.plc_model AND v.validator_version = NEW.validator_version
      AND (NEW.status = 'STARTED' OR NEW.status = v.status)) THEN
    RAISE EXCEPTION 'Compile must match its exact revision and compile validation';
  END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER compile_input_result BEFORE INSERT OR UPDATE ON app.compile_runs FOR EACH ROW EXECUTE FUNCTION app.guard_compile_result();

-- +goose Down
DROP TABLE app.request_deduplication;
DROP TABLE app.audit_events;
DROP TABLE app.export_artifacts;
ALTER TABLE app.validation_runs DROP CONSTRAINT validation_export_same_project;
DROP TABLE app.export_events;
DROP TABLE app.export_versions;
DROP VIEW app.compile_diagnostics;
DROP TABLE app.compile_runs;
DROP FUNCTION app.guard_artifact_insert();
DROP FUNCTION app.guard_export_success();
DROP FUNCTION app.guard_export_update();
DROP FUNCTION app.guard_compile_result();
