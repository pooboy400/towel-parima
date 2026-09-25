-- CreateEnum
CREATE TYPE "SmsLogStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "to" VARCHAR(15) NOT NULL,
    "text" TEXT NOT NULL,
    "tag" VARCHAR(50) NOT NULL,
    "status" "SmsLogStatus" NOT NULL DEFAULT 'SENT',
    "provider" VARCHAR(30) NOT NULL,
    "providerId" TEXT,
    "orderId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_tag_createdAt_idx" ON "SmsLog"("tag", "createdAt");
