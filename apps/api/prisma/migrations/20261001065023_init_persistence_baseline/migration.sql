-- CreateTable
CREATE TABLE "typing_texts" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "typing_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typing_sessions" (
    "id" UUID NOT NULL,
    "typing_text_id" UUID NOT NULL,
    "duration_ms" INTEGER,
    "wpm" DOUBLE PRECISION,
    "raw_wpm" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "consistency" DOUBLE PRECISION,
    "total_inputs" INTEGER,
    "correct_inputs" INTEGER,
    "incorrect_inputs" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "typing_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "typing_sessions" ADD CONSTRAINT "typing_sessions_typing_text_id_fkey" FOREIGN KEY ("typing_text_id") REFERENCES "typing_texts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
