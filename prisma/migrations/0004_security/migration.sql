-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recoveryCodes" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpPendingEnc" TEXT,
ADD COLUMN     "totpSecretEnc" TEXT;

