-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DEV', 'QA');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR');

-- CreateTable
CREATE TABLE "user" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "realname" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" BIGINT NOT NULL,
    "members" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "precond" TEXT,
    "steps" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "priority" TEXT,
    "requirement_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "BugSeverity" NOT NULL,
    "priority" TEXT,
    "status" "BugStatus" NOT NULL DEFAULT 'NEW',
    "module" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "actual" TEXT NOT NULL,
    "owner_id" BIGINT,
    "fixer_id" BIGINT,
    "root_cause" TEXT,
    "fix_desc" TEXT,
    "impact" TEXT,
    "requirement_id" BIGINT,
    "case_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" BIGINT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_log" (
    "id" BIGSERIAL NOT NULL,
    "bug_id" BIGINT NOT NULL,
    "operator_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" "BugStatus" NOT NULL,
    "to_status" "BugStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_plan" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "case_ids" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "project_code_key" ON "project"("code");

-- CreateIndex
CREATE INDEX "project_created_by_idx" ON "project"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_code_key" ON "requirement"("code");

-- CreateIndex
CREATE INDEX "requirement_project_id_idx" ON "requirement"("project_id");

-- CreateIndex
CREATE INDEX "test_case_project_id_idx" ON "test_case"("project_id");

-- CreateIndex
CREATE INDEX "test_case_requirement_id_idx" ON "test_case"("requirement_id");

-- CreateIndex
CREATE INDEX "test_case_module_idx" ON "test_case"("module");

-- CreateIndex
CREATE UNIQUE INDEX "bug_code_key" ON "bug"("code");

-- CreateIndex
CREATE INDEX "bug_project_id_idx" ON "bug"("project_id");

-- CreateIndex
CREATE INDEX "bug_owner_id_idx" ON "bug"("owner_id");

-- CreateIndex
CREATE INDEX "bug_fixer_id_idx" ON "bug"("fixer_id");

-- CreateIndex
CREATE INDEX "bug_requirement_id_idx" ON "bug"("requirement_id");

-- CreateIndex
CREATE INDEX "bug_case_id_idx" ON "bug"("case_id");

-- CreateIndex
CREATE INDEX "bug_status_idx" ON "bug"("status");

-- CreateIndex
CREATE INDEX "attachment_project_id_idx" ON "attachment"("project_id");

-- CreateIndex
CREATE INDEX "attachment_uploaded_by_idx" ON "attachment"("uploaded_by");

-- CreateIndex
CREATE INDEX "attachment_target_type_target_id_idx" ON "attachment"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "bug_log_bug_id_idx" ON "bug_log"("bug_id");

-- CreateIndex
CREATE INDEX "bug_log_operator_id_idx" ON "bug_log"("operator_id");

-- CreateIndex
CREATE INDEX "test_plan_project_id_idx" ON "test_plan"("project_id");

-- CreateIndex
CREATE INDEX "test_plan_owner_id_idx" ON "test_plan"("owner_id");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug" ADD CONSTRAINT "bug_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug" ADD CONSTRAINT "bug_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug" ADD CONSTRAINT "bug_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "test_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug" ADD CONSTRAINT "bug_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug" ADD CONSTRAINT "bug_fixer_id_fkey" FOREIGN KEY ("fixer_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_log" ADD CONSTRAINT "bug_log_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "bug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_log" ADD CONSTRAINT "bug_log_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plan" ADD CONSTRAINT "test_plan_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plan" ADD CONSTRAINT "test_plan_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

