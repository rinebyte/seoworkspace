-- Data per user: setiap aset punya pemilik (ownerId).
-- Data lama otomatis dimiliki admin pertama.

DROP INDEX "Domain_name_key";

ALTER TABLE "Hosting" ADD COLUMN "ownerId" TEXT;
UPDATE "Hosting" SET "ownerId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;
ALTER TABLE "Hosting" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Hosting" ADD CONSTRAINT "Hosting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Hosting_ownerId_idx" ON "Hosting"("ownerId");

ALTER TABLE "Vps" ADD COLUMN "ownerId" TEXT;
UPDATE "Vps" SET "ownerId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;
ALTER TABLE "Vps" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Vps" ADD CONSTRAINT "Vps_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Vps_ownerId_idx" ON "Vps"("ownerId");

ALTER TABLE "Domain" ADD COLUMN "ownerId" TEXT;
UPDATE "Domain" SET "ownerId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;
ALTER TABLE "Domain" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Domain_ownerId_name_key" ON "Domain"("ownerId", "name");

ALTER TABLE "EmailAccount" ADD COLUMN "ownerId" TEXT;
UPDATE "EmailAccount" SET "ownerId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;
ALTER TABLE "EmailAccount" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "EmailAccount_ownerId_idx" ON "EmailAccount"("ownerId");

ALTER TABLE "BacklinkOrder" ADD COLUMN "ownerId" TEXT;
UPDATE "BacklinkOrder" SET "ownerId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;
ALTER TABLE "BacklinkOrder" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "BacklinkOrder" ADD CONSTRAINT "BacklinkOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "BacklinkOrder_ownerId_idx" ON "BacklinkOrder"("ownerId");
