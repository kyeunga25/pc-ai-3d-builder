PRAGMA foreign_keys = ON;

CREATE TRIGGER generation_jobs_validate_codes_insert
BEFORE INSERT ON generation_jobs
FOR EACH ROW
WHEN (
  NEW.failure_code IS NOT NULL
  AND (
    length(NEW.failure_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.failure_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.failure_code GLOB '*[^A-Z0-9_]*'
  )
) OR (
  NEW.validation_code IS NOT NULL
  AND (
    length(NEW.validation_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.validation_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.validation_code GLOB '*[^A-Z0-9_]*'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_CODE_INVALID');
END;

CREATE TRIGGER generation_jobs_validate_codes_update
BEFORE UPDATE OF failure_code, validation_code ON generation_jobs
FOR EACH ROW
WHEN (
  NEW.failure_code IS NOT NULL
  AND (
    length(NEW.failure_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.failure_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.failure_code GLOB '*[^A-Z0-9_]*'
  )
) OR (
  NEW.validation_code IS NOT NULL
  AND (
    length(NEW.validation_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.validation_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.validation_code GLOB '*[^A-Z0-9_]*'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_CODE_INVALID');
END;

CREATE TRIGGER generation_job_events_validate_code_insert
BEFORE INSERT ON generation_job_events
FOR EACH ROW
WHEN NEW.failure_code IS NOT NULL
  AND (
    length(NEW.failure_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.failure_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.failure_code GLOB '*[^A-Z0-9_]*'
  )
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_CODE_INVALID');
END;

CREATE TRIGGER generation_job_events_validate_code_update
BEFORE UPDATE OF failure_code ON generation_job_events
FOR EACH ROW
WHEN NEW.failure_code IS NOT NULL
  AND (
    length(NEW.failure_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.failure_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.failure_code GLOB '*[^A-Z0-9_]*'
  )
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_CODE_INVALID');
END;

CREATE TRIGGER generation_provider_attempts_validate_code_insert
BEFORE INSERT ON generation_provider_attempts
FOR EACH ROW
WHEN NEW.validation_code IS NOT NULL
  AND (
    length(NEW.validation_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.validation_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.validation_code GLOB '*[^A-Z0-9_]*'
  )
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_CODE_INVALID');
END;

CREATE TRIGGER generation_provider_attempts_validate_code_update
BEFORE UPDATE OF validation_code ON generation_provider_attempts
FOR EACH ROW
WHEN NEW.validation_code IS NOT NULL
  AND (
    length(NEW.validation_code) NOT BETWEEN 1 AND 128
    OR substr(NEW.validation_code, 1, 1) NOT GLOB '[A-Z]'
    OR NEW.validation_code GLOB '*[^A-Z0-9_]*'
  )
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_CODE_INVALID');
END;

UPDATE generation_jobs
SET failure_code = failure_code,
    validation_code = validation_code
WHERE failure_code IS NOT NULL OR validation_code IS NOT NULL;

UPDATE generation_job_events
SET failure_code = failure_code
WHERE failure_code IS NOT NULL;

UPDATE generation_provider_attempts
SET validation_code = validation_code
WHERE validation_code IS NOT NULL;

UPDATE rigstage_metadata
SET value = '15', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
