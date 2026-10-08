ALTER TABLE "audit_logs" ADD COLUMN "entity_data" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN "previous_data" JSONB;
