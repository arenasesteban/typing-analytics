-- CreateIndex
CREATE INDEX "typing_sessions_user_history_idx" ON "typing_sessions"("user_id", "completed_at", "id");
