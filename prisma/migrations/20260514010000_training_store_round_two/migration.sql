DO $$ BEGIN
  CREATE TYPE "StoreBundleQuantityMode" AS ENUM ('FIXED', 'PER_TRAINEE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "store_bundle_items"
  ADD COLUMN IF NOT EXISTS "quantityMode" "StoreBundleQuantityMode" NOT NULL DEFAULT 'FIXED';

ALTER TABLE "trainer_needs"
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
