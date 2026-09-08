ALTER TABLE "Video" ADD COLUMN "isShowreel" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Video"
SET "isShowreel" = true
WHERE "id" = (
  SELECT "id" FROM "Video" ORDER BY "createdAt" DESC LIMIT 1
);
