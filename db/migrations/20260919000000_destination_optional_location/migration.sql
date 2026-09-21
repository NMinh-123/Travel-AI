-- Unverified measurements remain NULL; preserve all existing rows and values.
ALTER TABLE "Destination"
  ALTER COLUMN "elevation" DROP NOT NULL,
  ALTER COLUMN "distanceFromStart" DROP NOT NULL,
  ALTER COLUMN "lat" DROP NOT NULL,
  ALTER COLUMN "lng" DROP NOT NULL;

ALTER TABLE "Destination" ADD CONSTRAINT "Destination_coordinate_pair_check"
  CHECK (("lat" IS NULL AND "lng" IS NULL) OR
    ("lat" IS NOT NULL AND "lng" IS NOT NULL AND
     "lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180));
