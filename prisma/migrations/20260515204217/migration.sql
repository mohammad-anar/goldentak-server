/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `horses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "horses_name_key" ON "horses"("name");
