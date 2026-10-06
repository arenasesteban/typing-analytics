-- Remove legacy anonymous sessions that cannot be assigned to an authenticated owner.
DELETE FROM "typing_sessions";

-- AlterTable
ALTER TABLE "typing_sessions" ADD COLUMN "user_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "typing_sessions" ADD CONSTRAINT "typing_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
