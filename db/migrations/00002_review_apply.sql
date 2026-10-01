-- +goose Up
ALTER TABLE app.project_revisions DROP CONSTRAINT project_revisions_origin_check;
ALTER TABLE app.project_revisions ADD CONSTRAINT project_revisions_origin_check
  CHECK (origin IN ('initial', 'manual_autosave', 'ai_apply', 'restore', 'schema_migration'));
ALTER TABLE app.project_revisions ADD COLUMN restored_from_revision_id uuid;
ALTER TABLE app.project_revisions ADD CONSTRAINT restore_same_project
  FOREIGN KEY (project_id, restored_from_revision_id) REFERENCES app.project_revisions(project_id, id);

CREATE TABLE app.change_batches (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES app.projects(id),
  original_prompt text NOT NULL, retry_of_batch_id uuid, current_batch_revision_id uuid,
  cancelled_at timestamptz, actor_type text NOT NULL CHECK (actor_type IN ('human','mcp','system')),
  actor_key text NOT NULL, correlation_id text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, retry_of_batch_id) REFERENCES app.change_batches(project_id, id)
);
CREATE TABLE app.validation_runs (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES app.projects(id),
  kind text NOT NULL CHECK (kind IN ('proposal','integration','compile','adapter')),
  project_revision_id uuid, batch_revision_id uuid, export_event_id uuid,
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  payload_schema_version text NOT NULL, validator_version text NOT NULL, profile_version text NOT NULL,
  input_context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(input_context) = 'object'),
  status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','PASS','FAIL','INTERRUPTED')),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  warning_count integer NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  info_count integer NOT NULL DEFAULT 0 CHECK (info_count >= 0),
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  UNIQUE (project_id, id), UNIQUE (project_id, id, project_revision_id),
  FOREIGN KEY (project_id, project_revision_id) REFERENCES app.project_revisions(project_id, id),
  CHECK ((status = 'STARTED') = (finished_at IS NULL)),
  CHECK (status <> 'PASS' OR error_count = 0),
  CHECK ((kind = 'proposal' AND batch_revision_id IS NOT NULL AND export_event_id IS NULL) OR
         (kind = 'integration' AND batch_revision_id IS NOT NULL AND export_event_id IS NULL) OR
         (kind = 'compile' AND project_revision_id IS NOT NULL AND batch_revision_id IS NULL AND export_event_id IS NULL) OR
         (kind = 'adapter' AND project_revision_id IS NOT NULL AND export_event_id IS NOT NULL AND batch_revision_id IS NULL))
);
CREATE TABLE app.batch_revisions (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, batch_id uuid NOT NULL,
  revision_no bigint NOT NULL CHECK (revision_no > 0), parent_batch_revision_id uuid,
  base_project_revision_id uuid, plc_context jsonb NOT NULL,
  payload_schema_version text NOT NULL, operations jsonb NOT NULL CHECK (jsonb_typeof(operations) = 'array'),
  dependency_manifest jsonb NOT NULL CHECK (jsonb_typeof(dependency_manifest) = 'object'),
  candidate_ir jsonb, candidate_hash text CHECK (candidate_hash ~ '^[0-9a-f]{64}$'),
  validation_run_id uuid, submission_request_id text NOT NULL, rework_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, revision_no), UNIQUE (batch_id, id), UNIQUE (project_id, id),
  FOREIGN KEY (project_id, batch_id) REFERENCES app.change_batches(project_id, id),
  FOREIGN KEY (batch_id, parent_batch_revision_id) REFERENCES app.batch_revisions(batch_id, id),
  FOREIGN KEY (project_id, base_project_revision_id) REFERENCES app.project_revisions(project_id, id),
  FOREIGN KEY (project_id, validation_run_id) REFERENCES app.validation_runs(project_id, id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((candidate_ir IS NULL) = (candidate_hash IS NULL)),
  CHECK (candidate_ir IS NULL OR jsonb_typeof(candidate_ir) = 'object'),
  CHECK ((revision_no = 1 AND parent_batch_revision_id IS NULL) OR (revision_no > 1 AND parent_batch_revision_id IS NOT NULL))
);
ALTER TABLE app.change_batches ADD CONSTRAINT batch_head_same_owner
  FOREIGN KEY (id, current_batch_revision_id) REFERENCES app.batch_revisions(batch_id, id);
ALTER TABLE app.validation_runs ADD CONSTRAINT validation_batch_same_project
  FOREIGN KEY (project_id, batch_revision_id) REFERENCES app.batch_revisions(project_id, id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE app.validation_diagnostics (
  id uuid PRIMARY KEY, validation_run_id uuid NOT NULL REFERENCES app.validation_runs(id),
  code text NOT NULL, severity text NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR')),
  message text NOT NULL, operation_id text, network_id bigint, node_id text, device text, path text,
  related_locations jsonb NOT NULL DEFAULT '[]', context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.network_proposals (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, batch_id uuid NOT NULL, network_id bigint NOT NULL,
  current_proposal_revision_id uuid,
  current_state text NOT NULL CHECK (current_state IN ('PENDING','APPROVED','REJECTED','APPLIED','CANCELLED','STALE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, network_id), UNIQUE (batch_id, id), UNIQUE (project_id, batch_id, id, network_id),
  FOREIGN KEY (project_id, batch_id) REFERENCES app.change_batches(project_id, id)
);
CREATE TABLE app.network_proposal_revisions (
  id uuid PRIMARY KEY, batch_id uuid NOT NULL, proposal_id uuid NOT NULL,
  revision_no bigint NOT NULL CHECK (revision_no > 0), parent_proposal_revision_id uuid,
  origin_batch_revision_id uuid NOT NULL, before_network jsonb, after_network jsonb,
  change_kind text NOT NULL CHECK (change_kind IN ('add','edit','delete','move')),
  order_change jsonb, diff jsonb NOT NULL, summary text NOT NULL, dependencies jsonb NOT NULL,
  scope_warning text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, revision_no), UNIQUE (proposal_id, id), UNIQUE (batch_id, proposal_id, id), UNIQUE (batch_id, id),
  FOREIGN KEY (batch_id, proposal_id) REFERENCES app.network_proposals(batch_id, id),
  FOREIGN KEY (batch_id, origin_batch_revision_id) REFERENCES app.batch_revisions(batch_id, id),
  FOREIGN KEY (proposal_id, parent_proposal_revision_id) REFERENCES app.network_proposal_revisions(proposal_id, id),
  CHECK ((revision_no = 1 AND parent_proposal_revision_id IS NULL) OR (revision_no > 1 AND parent_proposal_revision_id IS NOT NULL)),
  CHECK ((change_kind = 'add' AND before_network IS NULL AND after_network IS NOT NULL) OR
         (change_kind = 'delete' AND before_network IS NOT NULL AND after_network IS NULL) OR
         (change_kind IN ('edit','move') AND before_network IS NOT NULL AND after_network IS NOT NULL)),
  CHECK (change_kind <> 'move' OR order_change IS NOT NULL)
);
ALTER TABLE app.network_proposals ADD CONSTRAINT proposal_head_same_owner
  FOREIGN KEY (id, current_proposal_revision_id) REFERENCES app.network_proposal_revisions(proposal_id, id);
CREATE TABLE app.batch_revision_items (
  batch_id uuid NOT NULL, batch_revision_id uuid NOT NULL, proposal_id uuid NOT NULL, proposal_revision_id uuid NOT NULL,
  PRIMARY KEY (batch_revision_id, proposal_id),
  FOREIGN KEY (batch_id, batch_revision_id) REFERENCES app.batch_revisions(batch_id, id),
  FOREIGN KEY (batch_id, proposal_id, proposal_revision_id) REFERENCES app.network_proposal_revisions(batch_id, proposal_id, id)
);
CREATE TABLE app.review_rounds (
  id uuid PRIMARY KEY, batch_id uuid NOT NULL, batch_revision_id uuid NOT NULL,
  round_no bigint NOT NULL CHECK (round_no > 0), opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
  UNIQUE (batch_id, round_no), UNIQUE (batch_id, id),
  FOREIGN KEY (batch_id, batch_revision_id) REFERENCES app.batch_revisions(batch_id, id),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE TABLE app.review_round_items (
  batch_id uuid NOT NULL, round_id uuid NOT NULL, proposal_revision_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('actionable','context')), PRIMARY KEY (round_id, proposal_revision_id),
  FOREIGN KEY (batch_id, round_id) REFERENCES app.review_rounds(batch_id, id),
  FOREIGN KEY (batch_id, proposal_revision_id) REFERENCES app.network_proposal_revisions(batch_id, id)
);
CREATE TABLE app.review_events (
  id uuid PRIMARY KEY, round_id uuid NOT NULL, proposal_revision_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('APPROVE','REJECT')),
  feedback text, actor_key text NOT NULL, request_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, actor_key, request_id), UNIQUE (id, round_id, proposal_revision_id, event_type),
  FOREIGN KEY (round_id, proposal_revision_id) REFERENCES app.review_round_items(round_id, proposal_revision_id),
  CHECK (event_type <> 'REJECT' OR length(trim(feedback)) > 0 AND feedback IS NOT NULL)
);
CREATE TABLE app.network_review_locks (
  project_id uuid NOT NULL, network_id bigint NOT NULL, batch_id uuid NOT NULL, proposal_id uuid NOT NULL,
  PRIMARY KEY (project_id, network_id),
  FOREIGN KEY (project_id, batch_id, proposal_id, network_id) REFERENCES app.network_proposals(project_id, batch_id, id, network_id)
);
CREATE TABLE app.apply_events (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, batch_id uuid NOT NULL, review_round_id uuid NOT NULL,
  from_revision_id uuid, to_revision_id uuid, integration_validation_run_id uuid,
  result text NOT NULL CHECK (result IN ('SUCCESS','NO_OP','STALE','FAILED','INTERRUPTED')),
  actor_key text NOT NULL, request_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, actor_key, request_id), UNIQUE (id, result, review_round_id),
  FOREIGN KEY (project_id, batch_id) REFERENCES app.change_batches(project_id, id),
  FOREIGN KEY (batch_id, review_round_id) REFERENCES app.review_rounds(batch_id, id),
  FOREIGN KEY (project_id, from_revision_id) REFERENCES app.project_revisions(project_id, id),
  FOREIGN KEY (project_id, to_revision_id) REFERENCES app.project_revisions(project_id, id),
  FOREIGN KEY (project_id, integration_validation_run_id) REFERENCES app.validation_runs(project_id, id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (result <> 'SUCCESS' OR (to_revision_id IS NOT NULL AND integration_validation_run_id IS NOT NULL AND to_revision_id IS DISTINCT FROM from_revision_id)),
  CHECK (result IN ('SUCCESS','NO_OP') OR to_revision_id IS NULL),
  CHECK (result <> 'NO_OP' OR (from_revision_id IS NOT NULL AND to_revision_id = from_revision_id))
);
CREATE TABLE app.apply_event_items (
  apply_event_id uuid NOT NULL, result text NOT NULL, review_round_id uuid NOT NULL,
  proposal_revision_id uuid NOT NULL, approval_event_id uuid NOT NULL,
  approval_type text NOT NULL DEFAULT 'APPROVE' CHECK (approval_type = 'APPROVE'),
  PRIMARY KEY (apply_event_id, proposal_revision_id),
  FOREIGN KEY (apply_event_id, result, review_round_id) REFERENCES app.apply_events(id, result, review_round_id),
  FOREIGN KEY (approval_event_id, review_round_id, proposal_revision_id, approval_type)
    REFERENCES app.review_events(id, round_id, proposal_revision_id, event_type)
);
CREATE UNIQUE INDEX one_successful_apply_per_proposal ON app.apply_event_items(proposal_revision_id) WHERE result = 'SUCCESS';
CREATE INDEX batch_project_history ON app.change_batches(project_id, created_at, id);
CREATE INDEX validation_project_history ON app.validation_runs(project_id, started_at, id);
CREATE INDEX diagnostic_run_severity ON app.validation_diagnostics(validation_run_id, severity);
CREATE INDEX apply_project_history ON app.apply_events(project_id, created_at, id);

-- +goose StatementBegin
CREATE FUNCTION app.reject_sealed_run_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'STARTED' THEN
    RAISE EXCEPTION 'Sealed run cannot be changed' USING ERRCODE = '55000';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status','finished_at','error_count','warning_count','info_count']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','finished_at','error_count','warning_count','info_count']) THEN
    RAISE EXCEPTION 'Run input cannot be changed' USING ERRCODE = '55000';
  END IF;
  IF NEW.status <> 'STARTED' AND TG_TABLE_NAME = 'validation_runs' THEN
    IF NEW.error_count <> (SELECT count(*) FROM app.validation_diagnostics WHERE validation_run_id = NEW.id AND severity = 'ERROR') OR
       NEW.warning_count <> (SELECT count(*) FROM app.validation_diagnostics WHERE validation_run_id = NEW.id AND severity = 'WARNING') OR
       NEW.info_count <> (SELECT count(*) FROM app.validation_diagnostics WHERE validation_run_id = NEW.id AND severity = 'INFO') THEN
      RAISE EXCEPTION 'Diagnostic counts must agree at sealing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER seal_validation_run BEFORE UPDATE OR DELETE ON app.validation_runs FOR EACH ROW EXECUTE FUNCTION app.reject_sealed_run_mutation();
CREATE TRIGGER no_truncate_validation BEFORE TRUNCATE ON app.validation_runs FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation();
-- +goose StatementBegin
CREATE FUNCTION app.guard_diagnostic_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM app.validation_runs WHERE id = NEW.validation_run_id AND status = 'STARTED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Diagnostics require an open run'; END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER diagnostic_open_run BEFORE INSERT ON app.validation_diagnostics FOR EACH ROW EXECUTE FUNCTION app.guard_diagnostic_insert();
-- +goose StatementBegin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['batch_revisions','network_proposal_revisions','batch_revision_items','review_round_items','review_events','validation_diagnostics','apply_events','apply_event_items'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE OR TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation()', t);
  END LOOP;
END;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION app.require_started_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'STARTED' THEN RAISE EXCEPTION 'Runs must be created STARTED and finalized explicitly'; END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER validation_starts_open BEFORE INSERT ON app.validation_runs FOR EACH ROW EXECUTE FUNCTION app.require_started_run();
-- +goose StatementBegin
CREATE FUNCTION app.guard_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM r.id FROM app.review_rounds r JOIN app.review_round_items i ON i.round_id = r.id
    WHERE r.id = NEW.round_id AND i.proposal_revision_id = NEW.proposal_revision_id AND i.role = 'actionable' AND r.closed_at IS NULL FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review requires an actionable item in an open round'; END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER review_open_round BEFORE INSERT ON app.review_events FOR EACH ROW EXECUTE FUNCTION app.guard_review_insert();
-- +goose StatementBegin
CREATE FUNCTION app.guard_apply_success() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result = 'SUCCESS' AND NOT EXISTS (
    SELECT 1 FROM app.validation_runs v JOIN app.batch_revisions b ON b.id = v.batch_revision_id
    WHERE v.id = NEW.integration_validation_run_id AND v.kind = 'integration' AND v.status = 'PASS'
      AND b.batch_id = NEW.batch_id AND v.project_revision_id IS NOT DISTINCT FROM NEW.from_revision_id
  ) THEN RAISE EXCEPTION 'Successful Apply requires the passing integration for its batch and exact base'; END IF;
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER apply_passing_integration BEFORE INSERT ON app.apply_events FOR EACH ROW EXECUTE FUNCTION app.guard_apply_success();

-- +goose Down
DROP TABLE app.apply_event_items;
DROP TABLE app.apply_events;
DROP TABLE app.network_review_locks;
DROP TABLE app.review_events;
DROP TABLE app.review_round_items;
DROP TABLE app.review_rounds;
DROP TABLE app.batch_revision_items;
ALTER TABLE app.network_proposals DROP CONSTRAINT proposal_head_same_owner;
DROP TABLE app.network_proposal_revisions;
DROP TABLE app.network_proposals;
ALTER TABLE app.validation_runs DROP CONSTRAINT validation_batch_same_project;
ALTER TABLE app.change_batches DROP CONSTRAINT batch_head_same_owner;
DROP TABLE app.batch_revisions;
DROP TABLE app.validation_diagnostics;
DROP TABLE app.validation_runs;
DROP TABLE app.change_batches;
DROP FUNCTION app.guard_diagnostic_insert();
DROP FUNCTION app.require_started_run();
DROP FUNCTION app.guard_review_insert();
DROP FUNCTION app.guard_apply_success();
DROP FUNCTION app.reject_sealed_run_mutation();
ALTER TABLE app.project_revisions DROP CONSTRAINT restore_same_project;
ALTER TABLE app.project_revisions DROP COLUMN restored_from_revision_id;
ALTER TABLE app.project_revisions DROP CONSTRAINT project_revisions_origin_check;
-- Fail rather than lose Apply/restore provenance when older history is incompatible.
ALTER TABLE app.project_revisions ADD CONSTRAINT project_revisions_origin_check CHECK (origin IN ('initial','manual_autosave'));
