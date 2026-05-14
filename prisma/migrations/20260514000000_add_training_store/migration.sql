-- Add trainer needs permission
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canManageTrainerNeeds" BOOLEAN NOT NULL DEFAULT false;

-- Create enums
DO $$ BEGIN
  CREATE TYPE "TrainerNeedStatus" AS ENUM (
    'NEW',
    'IN_REVIEW',
    'ASSIGNED',
    'PLAN_PROPOSED',
    'RESERVED_AVAILABLE',
    'SHORTAGE_IN_PROGRESS',
    'READY_TO_REQUEST',
    'CONVERTED_TO_REQUEST',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TrainerNeedItemStatus" AS ENUM (
    'REQUESTED',
    'AVAILABLE',
    'RESERVED',
    'SHORTAGE',
    'ALTERNATIVE_PROPOSED',
    'ON_DEMAND',
    'CANCELLED',
    'CONVERTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TrainerNeedHandlingMode" AS ENUM (
    'RESERVE_FROM_STOCK',
    'USE_ALTERNATIVE',
    'WAIT_FOR_STOCK',
    'INTERNAL_SOURCE',
    'TRY_TO_PROVIDE',
    'CANCEL_ITEM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StoreReservationStatus" AS ENUM (
    'ACTIVE',
    'RELEASED',
    'CONVERTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Store catalog
CREATE TABLE IF NOT EXISTS "store_catalog_items" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "imageUrl" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isOnDemand" BOOLEAN NOT NULL DEFAULT false,
  "onDemandNote" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_item_alternatives" (
  "id" TEXT NOT NULL,
  "sourceItemId" TEXT NOT NULL,
  "alternativeId" TEXT NOT NULL,
  "note" TEXT,
  "requiresTrainerApproval" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_item_alternatives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_bundles" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_bundles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_bundle_items" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "catalogItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "store_bundle_items_pkey" PRIMARY KEY ("id")
);

-- Trainer needs
CREATE TABLE IF NOT EXISTS "trainer_needs" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "trainerName" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "traineeCount" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "status" "TrainerNeedStatus" NOT NULL DEFAULT 'NEW',
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "assignedToId" TEXT,
  "decisionNote" TEXT,
  "linkedRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_needs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trainer_need_items" (
  "id" TEXT NOT NULL,
  "needId" TEXT NOT NULL,
  "catalogItemId" TEXT,
  "inventoryItemId" TEXT,
  "title" TEXT NOT NULL,
  "requestedQty" INTEGER NOT NULL,
  "availableAtSubmission" INTEGER NOT NULL DEFAULT 0,
  "reservedQty" INTEGER NOT NULL DEFAULT 0,
  "shortageQty" INTEGER NOT NULL DEFAULT 0,
  "approvedQty" INTEGER NOT NULL DEFAULT 0,
  "status" "TrainerNeedItemStatus" NOT NULL DEFAULT 'REQUESTED',
  "handlingMode" "TrainerNeedHandlingMode",
  "coordinatorNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_need_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_reservations" (
  "id" TEXT NOT NULL,
  "needItemId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "StoreReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "store_reservations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "store_catalog_items_inventoryItemId_idx" ON "store_catalog_items"("inventoryItemId");
CREATE INDEX IF NOT EXISTS "store_catalog_items_category_idx" ON "store_catalog_items"("category");
CREATE INDEX IF NOT EXISTS "store_catalog_items_isVisible_idx" ON "store_catalog_items"("isVisible");
CREATE UNIQUE INDEX IF NOT EXISTS "store_item_alternatives_sourceItemId_alternativeId_key" ON "store_item_alternatives"("sourceItemId", "alternativeId");
CREATE INDEX IF NOT EXISTS "store_item_alternatives_alternativeId_idx" ON "store_item_alternatives"("alternativeId");
CREATE INDEX IF NOT EXISTS "store_bundles_isVisible_idx" ON "store_bundles"("isVisible");
CREATE UNIQUE INDEX IF NOT EXISTS "store_bundle_items_bundleId_catalogItemId_key" ON "store_bundle_items"("bundleId", "catalogItemId");
CREATE INDEX IF NOT EXISTS "store_bundle_items_catalogItemId_idx" ON "store_bundle_items"("catalogItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "trainer_needs_code_key" ON "trainer_needs"("code");
CREATE INDEX IF NOT EXISTS "trainer_needs_status_idx" ON "trainer_needs"("status");
CREATE INDEX IF NOT EXISTS "trainer_needs_assignedToId_idx" ON "trainer_needs"("assignedToId");
CREATE INDEX IF NOT EXISTS "trainer_needs_startDate_idx" ON "trainer_needs"("startDate");
CREATE INDEX IF NOT EXISTS "trainer_need_items_needId_idx" ON "trainer_need_items"("needId");
CREATE INDEX IF NOT EXISTS "trainer_need_items_catalogItemId_idx" ON "trainer_need_items"("catalogItemId");
CREATE INDEX IF NOT EXISTS "trainer_need_items_inventoryItemId_idx" ON "trainer_need_items"("inventoryItemId");
CREATE INDEX IF NOT EXISTS "trainer_need_items_status_idx" ON "trainer_need_items"("status");
CREATE INDEX IF NOT EXISTS "store_reservations_inventoryItemId_status_idx" ON "store_reservations"("inventoryItemId", "status");
CREATE INDEX IF NOT EXISTS "store_reservations_needItemId_idx" ON "store_reservations"("needItemId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "store_catalog_items" ADD CONSTRAINT "store_catalog_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_item_alternatives" ADD CONSTRAINT "store_item_alternatives_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "store_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_item_alternatives" ADD CONSTRAINT "store_item_alternatives_alternativeId_fkey" FOREIGN KEY ("alternativeId") REFERENCES "store_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_bundle_items" ADD CONSTRAINT "store_bundle_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "store_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_bundle_items" ADD CONSTRAINT "store_bundle_items_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "store_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_needs" ADD CONSTRAINT "trainer_needs_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_needs" ADD CONSTRAINT "trainer_needs_linkedRequestId_fkey" FOREIGN KEY ("linkedRequestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_need_items" ADD CONSTRAINT "trainer_need_items_needId_fkey" FOREIGN KEY ("needId") REFERENCES "trainer_needs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_need_items" ADD CONSTRAINT "trainer_need_items_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "store_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_need_items" ADD CONSTRAINT "trainer_need_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_reservations" ADD CONSTRAINT "store_reservations_needItemId_fkey" FOREIGN KEY ("needItemId") REFERENCES "trainer_need_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_reservations" ADD CONSTRAINT "store_reservations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "store_reservations" ADD CONSTRAINT "store_reservations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
