DO $$ BEGIN
  CREATE TYPE "TrainingRoomBookingStatus" AS ENUM (
    'REQUESTED',
    'APPROVED',
    'ALTERNATIVE_PROPOSED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "training_rooms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "location" TEXT,
  "description" TEXT,
  "equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "layoutOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "imageUrl" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_room_bookings" (
  "id" TEXT NOT NULL,
  "trainerNeedId" TEXT NOT NULL,
  "requestedRoomId" TEXT,
  "approvedRoomId" TEXT,
  "status" "TrainingRoomBookingStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedLayout" TEXT,
  "coordinatorNote" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_room_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "training_rooms_isVisible_idx" ON "training_rooms"("isVisible");
CREATE INDEX IF NOT EXISTS "training_rooms_type_idx" ON "training_rooms"("type");
CREATE INDEX IF NOT EXISTS "training_rooms_capacity_idx" ON "training_rooms"("capacity");
CREATE UNIQUE INDEX IF NOT EXISTS "training_room_bookings_trainerNeedId_key" ON "training_room_bookings"("trainerNeedId");
CREATE INDEX IF NOT EXISTS "training_room_bookings_requestedRoomId_idx" ON "training_room_bookings"("requestedRoomId");
CREATE INDEX IF NOT EXISTS "training_room_bookings_approvedRoomId_idx" ON "training_room_bookings"("approvedRoomId");
CREATE INDEX IF NOT EXISTS "training_room_bookings_status_idx" ON "training_room_bookings"("status");
CREATE INDEX IF NOT EXISTS "training_room_bookings_startDate_endDate_idx" ON "training_room_bookings"("startDate", "endDate");

DO $$ BEGIN
  ALTER TABLE "training_room_bookings" ADD CONSTRAINT "training_room_bookings_trainerNeedId_fkey" FOREIGN KEY ("trainerNeedId") REFERENCES "trainer_needs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "training_room_bookings" ADD CONSTRAINT "training_room_bookings_requestedRoomId_fkey" FOREIGN KEY ("requestedRoomId") REFERENCES "training_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "training_room_bookings" ADD CONSTRAINT "training_room_bookings_approvedRoomId_fkey" FOREIGN KEY ("approvedRoomId") REFERENCES "training_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "training_room_bookings" ADD CONSTRAINT "training_room_bookings_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
