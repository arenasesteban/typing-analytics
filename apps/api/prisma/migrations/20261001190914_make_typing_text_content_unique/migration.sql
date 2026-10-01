/*
  Warnings:

  - A unique constraint covering the columns `[text]` on the table `typing_texts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "typing_texts_text_key" ON "typing_texts"("text");
