-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "DomainCategory" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainCategory_ownerId_name_key" ON "DomainCategory"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Domain_categoryId_idx" ON "Domain"("categoryId");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DomainCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainCategory" ADD CONSTRAINT "DomainCategory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

