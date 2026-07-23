-- ============================================================
-- Product reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS product_reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, customer_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_customer_idx ON product_reviews(customer_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads product reviews"
ON product_reviews FOR SELECT
USING (TRUE);

CREATE POLICY "Customers create own reviews"
ON product_reviews FOR INSERT
WITH CHECK (auth.uid() = customer_id AND get_user_role() = 'customer');

CREATE POLICY "Customers update own reviews"
ON product_reviews FOR UPDATE
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers delete own reviews"
ON product_reviews FOR DELETE
USING (auth.uid() = customer_id);

CREATE TRIGGER product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
