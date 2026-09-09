-- Fail on pre-existing inconsistent data rather than silently modifying user records.
CREATE UNIQUE INDEX "Video_single_showreel" ON "Video" ("isShowreel") WHERE "isShowreel" = 1;
CREATE INDEX "Video_createdAt_id_idx" ON "Video" ("createdAt", "id");
CREATE INDEX "Video_category_createdAt_id_idx" ON "Video" ("category", "createdAt", "id");
