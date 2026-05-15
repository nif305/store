ALTER TABLE "training_room_bookings"
ADD COLUMN IF NOT EXISTS "requestedPlan" JSONB;
