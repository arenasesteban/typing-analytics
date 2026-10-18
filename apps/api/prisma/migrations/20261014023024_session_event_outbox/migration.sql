-- CreateEnum
CREATE TYPE "EventDeliveryStatus" AS ENUM ('UNAVAILABLE', 'PENDING', 'READY');

-- AlterTable
ALTER TABLE "typing_sessions" ADD COLUMN     "event_delivery_status" "EventDeliveryStatus" NOT NULL DEFAULT 'UNAVAILABLE';

-- CreateTable
CREATE TABLE "session_event_outbox" (
    "session_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leased_until" TIMESTAMP(3),
    "lease_token" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_event_outbox_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE INDEX "session_event_outbox_due_idx" ON "session_event_outbox"("next_attempt_at", "leased_until");

-- AddForeignKey
ALTER TABLE "session_event_outbox" ADD CONSTRAINT "session_event_outbox_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "typing_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
