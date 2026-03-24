-- AlterTable
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "acceptedPayments" TEXT[] DEFAULT ARRAY['cash']::TEXT[],
ADD COLUMN IF NOT EXISTS "paymentEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT,
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_locationId_orderNumber_key" ON "Order"("locationId", "orderNumber");
