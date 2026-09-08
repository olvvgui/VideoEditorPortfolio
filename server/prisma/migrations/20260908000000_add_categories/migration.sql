CREATE TABLE "Category" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

INSERT INTO "Category" ("id", "name", "isDefault") VALUES
  ('default-commercial', 'Comercial', true),
  ('default-lifestyle', 'Lifestyle', true),
  ('default-music-video', 'Music video', true),
  ('default-documentary', 'Documentário', true),
  ('default-social-media', 'Social media', true);
