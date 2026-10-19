ALTER TABLE blog_posts ADD COLUMN cover_image text NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN cover_alt text NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN seo_title text NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN meta_description text NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN focus_keyword text NOT NULL DEFAULT '';
