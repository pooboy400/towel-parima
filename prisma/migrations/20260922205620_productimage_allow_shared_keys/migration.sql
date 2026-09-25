-- DropIndex
DROP INDEX "ProductImage_storageKey_key";

-- CreateIndex
CREATE INDEX "ProductImage_storageKey_idx" ON "ProductImage"("storageKey");
