/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 7;

-- CreateIndex
CREATE UNIQUE INDEX "Order_token_key" ON "Order"("token");
