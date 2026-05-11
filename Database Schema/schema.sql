-- ============================================================
-- TABLE 1: programs
-- ============================================================
CREATE TABLE programs (
    program_code VARCHAR(10) PRIMARY KEY,
    description  TEXT
);

INSERT INTO programs (program_code, description) VALUES
    ('AIE', 'Artificial Intelligence Engineering'),
    ('AIS', 'Artificial Intelligence Science'),
    ('CE',  'Computer Engineering'),
    ('CS',  'Computer Science');

-- ============================================================
-- TABLE 2: courses
-- ============================================================
CREATE TABLE courses (
    course_code   VARCHAR(20) PRIMARY KEY,
    course_name   TEXT NOT NULL,
    credits       INT NOT NULL DEFAULT 3,
    contact_hours INT,
    lec_hours     INT DEFAULT 0,
    tut_hours     INT DEFAULT 0,
    lab_hours     INT DEFAULT 0
);

-- ============================================================
-- TABLE 3: students
-- ============================================================
CREATE TABLE students (
    student_id           VARCHAR(20) PRIMARY KEY,
    name                 TEXT NOT NULL,
    program_code         VARCHAR(10) NOT NULL REFERENCES programs(program_code),
    cumulative_gpa       DECIMAL(4,3),
    total_credits_passed DECIMAL(6,1) DEFAULT 0
);

-- ============================================================
-- TABLE 4: student_grades
-- ============================================================
CREATE TABLE student_grades (
    id             SERIAL PRIMARY KEY,
    student_id     VARCHAR(20) NOT NULL REFERENCES students(student_id),
    course_code    VARCHAR(20) NOT NULL,
    term           VARCHAR(10) NOT NULL,
    grade          VARCHAR(5) NOT NULL,
    term_gpa       DECIMAL(4,3),
    cumulative_gpa DECIMAL(4,3),
    repeat_flag    VARCHAR(10),
    unit_taken     DECIMAL(4,1) NOT NULL DEFAULT 0,
    UNIQUE(student_id, course_code, term)
);

CREATE INDEX idx_grades_student ON student_grades(student_id);
CREATE INDEX idx_grades_course  ON student_grades(course_code);

-- ============================================================
-- TABLE 5: study_plan_entries
-- ============================================================
CREATE TABLE study_plan_entries (
    id              SERIAL PRIMARY KEY,
    program_code    VARCHAR(10) NOT NULL REFERENCES programs(program_code),
    semester_number INT NOT NULL,
    course_code     VARCHAR(20) NOT NULL,
    credits         INT NOT NULL DEFAULT 3,
    UNIQUE(program_code, semester_number, course_code)
);

CREATE INDEX idx_studyplan_program ON study_plan_entries(program_code);

-- ============================================================
-- TABLE 6: prerequisites
-- ============================================================
CREATE TABLE prerequisites (
    id                SERIAL PRIMARY KEY,
    course_code       VARCHAR(20) NOT NULL,
    prerequisite_code VARCHAR(20) NOT NULL,
    condition         VARCHAR(10) NOT NULL DEFAULT 'NONE'
                      CHECK (condition IN ('NONE', 'MANDATORY', 'AND', 'OR'))
);

CREATE INDEX idx_prereq_course ON prerequisites(course_code);

-- ============================================================
-- TABLE 7: elective_groups
-- ============================================================
CREATE TABLE elective_groups (
    id           SERIAL PRIMARY KEY,
    program_code VARCHAR(10) NOT NULL REFERENCES programs(program_code),
    group_code   VARCHAR(10) NOT NULL,
    course_code  VARCHAR(20) NOT NULL,
    course_name  TEXT,
    UNIQUE(program_code, group_code, course_code)
);

-- ============================================================
-- TABLE 8: rooms
-- ============================================================
CREATE TABLE rooms (
    room_id   VARCHAR(20) PRIMARY KEY,
    room_type VARCHAR(10) NOT NULL CHECK (room_type IN ('HALL', 'LAB')),
    capacity  INT NOT NULL,
    building  VARCHAR(10)
);

-- ============================================================
-- TABLE 9: constraints
-- ============================================================
CREATE TABLE constraints (
    constraint_id VARCHAR(10) PRIMARY KEY,
    rule_name     TEXT NOT NULL,
    gpa_min       DECIMAL(4,3),
    gpa_max       DECIMAL(4,3),
    value         INT NOT NULL,
    description   TEXT
);

-- ============================================================
-- TABLE 10: generated_schedule
-- ============================================================
CREATE TABLE generated_schedule (
    id           SERIAL PRIMARY KEY,
    course_code  VARCHAR(20) NOT NULL,
    course_name  TEXT,
    program_code VARCHAR(10),
    section      VARCHAR(10),
    component    VARCHAR(5) NOT NULL
                 CHECK (component IN ('LEC', 'TUT', 'LAB')),
    day          VARCHAR(10) NOT NULL
                 CHECK (day IN ('Sunday','Monday','Tuesday','Wednesday','Thursday')),
    period       INT NOT NULL CHECK (period BETWEEN 1 AND 4),
    room_id      VARCHAR(20) REFERENCES rooms(room_id),
    capacity     INT,
    enrolled     INT DEFAULT 0,
    instructor   TEXT,
    term         VARCHAR(10),
    status       VARCHAR(10) DEFAULT 'finalized'
);

CREATE INDEX idx_schedule_course     ON generated_schedule(course_code);
CREATE INDEX idx_schedule_program    ON generated_schedule(program_code);
CREATE INDEX idx_schedule_day_period ON generated_schedule(day, period);

-- ============================================================
-- TABLE 11: recommendation_cache
-- NOTE: source column kept as informational-only metadata
-- ============================================================
CREATE TABLE recommendation_cache (
    student_id          VARCHAR(20) PRIMARY KEY REFERENCES students(student_id),
    recommended_courses JSONB NOT NULL,
    conflict_details    JSONB,
    full_response       JSONB NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    source              VARCHAR(10)       -- informational only, not used for formatting
);

-- ============================================================
-- pgvector extension (required for policy_chunks.embedding)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ============================================================
-- TABLE 12: policy_chunks
-- ============================================================
CREATE TABLE public.policy_chunks (
    id        BIGSERIAL PRIMARY KEY,
    text      TEXT,
    metadata  JSONB DEFAULT '{}'::JSONB,
    embedding PUBLIC.VECTOR(1024)
);

-- ============================================================
-- TABLE 13: slot_requests
-- ============================================================
CREATE TABLE slot_requests (
    id           SERIAL PRIMARY KEY,
    student_id   VARCHAR(20) NOT NULL,
    course_code  VARCHAR(20) NOT NULL,
    status       VARCHAR(20) DEFAULT 'pending',
    created_at   TIMESTAMP DEFAULT NOW(),
    resolved_at  TIMESTAMP,
    advisor_note TEXT
);
