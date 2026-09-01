-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'BUILDING', 'REGRESSION', 'GATE_CHECK', 'AWAITING_MERGE', 'MERGED', 'RELEASED', 'ABANDONED');

-- CreateTable
CREATE TABLE "change_request" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" BIGINT,
    "version" TEXT,
    "src_branch" TEXT NOT NULL,
    "dst_branch" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'MEDIUM',
    "need_regression" BOOLEAN NOT NULL DEFAULT true,
    "status" "ChangeStatus" NOT NULL DEFAULT 'DRAFT',
    "owner_id" BIGINT NOT NULL,
    "reviewer_id" BIGINT,
    "backflow_status" TEXT,
    "conflict_files" JSONB,
    "rolled_back" BOOLEAN NOT NULL DEFAULT false,
    "merged_at" TIMESTAMP(3),
    "merged_by" BIGINT,
    "merged_sha" TEXT,
    "tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "id" BIGSERIAL NOT NULL,
    "cr_id" BIGINT NOT NULL,
    "operator_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" "ChangeStatus" NOT NULL,
    "to_status" "ChangeStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "change_request_code_key" ON "change_request"("code");

-- CreateIndex
CREATE INDEX "change_request_project_id_idx" ON "change_request"("project_id");

-- CreateIndex
CREATE INDEX "change_request_owner_id_idx" ON "change_request"("owner_id");

-- CreateIndex
CREATE INDEX "change_request_reviewer_id_idx" ON "change_request"("reviewer_id");

-- CreateIndex
CREATE INDEX "change_request_merged_by_idx" ON "change_request"("merged_by");

-- CreateIndex
CREATE INDEX "change_request_status_idx" ON "change_request"("status");

-- CreateIndex
CREATE INDEX "change_request_source_type_source_id_idx" ON "change_request"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "change_log_cr_id_idx" ON "change_log"("cr_id");

-- CreateIndex
CREATE INDEX "change_log_operator_id_idx" ON "change_log"("operator_id");

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_merged_by_fkey" FOREIGN KEY ("merged_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
