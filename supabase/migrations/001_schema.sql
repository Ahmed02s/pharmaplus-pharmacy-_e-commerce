-- ============================================================
-- PharmaPlus: Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'pharmacist', 'admin');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'dispensed', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE payment_provider AS ENUM ('paystack', 'stripe');
CREATE TYPE payment_state AS ENUM ('pending', 'success', 'failed');
CREATE TYPE prescription_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE dosage_form AS ENUM ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'suppository', 'patch', 'other');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  phone         TEXT,
  role          user_role NOT NULL DEFAULT 'customer',
  avatar_url    TEXT,
  date_of_birth DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADDRESSES
-- ============================================================

CREATE TABLE addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Home',
  street      TEXT NOT NULL,
  city        TEXT NOT NULL,
  region      TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'Ghana',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   TEXT NOT NULL,
  generic_name           TEXT,
  brand                  TEXT,
  category_id            UUID REFERENCES categories(id) ON DELETE SET NULL,
  description            TEXT,
  dosage_form            dosage_form NOT NULL DEFAULT 'tablet',
  strength               TEXT,
  price                  NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sale_price             NUMERIC(10,2),
  stock_quantity         INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_threshold      INTEGER NOT NULL DEFAULT 10,
  requires_prescription  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  image_url              TEXT,
  expiry_date            DATE,
  manufacturer           TEXT,
  storage_instructions   TEXT,
  side_effects           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX products_search_idx ON products USING gin(
  to_tsvector('english', name || ' ' || COALESCE(generic_name,'') || ' ' || COALESCE(brand,''))
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_active_idx ON products(is_active);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status           order_status NOT NULL DEFAULT 'pending',
  payment_status   payment_status NOT NULL DEFAULT 'unpaid',
  subtotal         NUMERIC(10,2) NOT NULL,
  delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  discount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(10,2) NOT NULL,
  delivery_address JSONB NOT NULL,
  notes            TEXT,
  coupon_code      TEXT,
  pharmacist_id    UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_customer_idx ON orders(customer_id);
CREATE INDEX orders_status_idx ON orders(status);

-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX order_items_order_idx ON order_items(order_id);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================

CREATE TABLE prescriptions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  image_path     TEXT NOT NULL,
  status         prescription_status NOT NULL DEFAULT 'pending',
  pharmacist_id  UUID REFERENCES profiles(id),
  notes          TEXT,
  reviewed_at    TIMESTAMPTZ,
  expires_at     DATE,
  doctor_name    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX prescriptions_customer_idx ON prescriptions(customer_id);
CREATE INDEX prescriptions_status_idx ON prescriptions(status);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider      payment_provider NOT NULL,
  provider_ref  TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'GHS',
  status        payment_state NOT NULL DEFAULT 'pending',
  metadata      JSONB,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX payments_provider_ref_idx ON payments(provider_ref);

-- ============================================================
-- COUPONS
-- ============================================================

CREATE TABLE coupons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             TEXT NOT NULL UNIQUE,
  description      TEXT,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value   NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_uses         INTEGER,
  current_uses     INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications(user_id, is_read);

-- ============================================================
-- ORDER STATUS HISTORY (audit trail)
-- ============================================================

CREATE TABLE order_status_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON profiles   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at   BEFORE UPDATE ON products   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at     BEFORE UPDATE ON orders     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Decrement stock on order confirm
CREATE OR REPLACE FUNCTION decrement_stock_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    UPDATE products p
    SET stock_quantity = stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_stock_decrement
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_confirm();

-- Log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO order_status_history (order_id, status)
    VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_logger
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Users read own profile"        ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff read all profiles"       ON profiles FOR SELECT USING (get_user_role() IN ('pharmacist','admin'));
CREATE POLICY "Users update own profile"      ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin update any profile"      ON profiles FOR UPDATE USING (get_user_role() = 'admin');

-- ADDRESSES
CREATE POLICY "Users manage own addresses"    ON addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Staff read all addresses"      ON addresses FOR SELECT USING (get_user_role() IN ('pharmacist','admin'));

-- PRODUCTS (public read, staff write)
CREATE POLICY "Anyone reads active products"  ON products FOR SELECT USING (is_active = TRUE OR get_user_role() IN ('pharmacist','admin'));
CREATE POLICY "Staff manage products"         ON products FOR ALL USING (get_user_role() IN ('pharmacist','admin'));

-- CATEGORIES (public read)
CREATE POLICY "Anyone reads categories"       ON categories FOR SELECT USING (TRUE);
CREATE POLICY "Admin manages categories"      ON categories FOR ALL USING (get_user_role() = 'admin');

-- ORDERS
CREATE POLICY "Customers read own orders"     ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Staff read all orders"         ON orders FOR SELECT USING (get_user_role() IN ('pharmacist','admin'));
CREATE POLICY "Customers create orders"       ON orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Staff update orders"           ON orders FOR UPDATE USING (get_user_role() IN ('pharmacist','admin'));
CREATE POLICY "Customer cancel own order"     ON orders FOR UPDATE USING (auth.uid() = customer_id AND status = 'pending');

-- ORDER ITEMS
CREATE POLICY "Read items of own orders"      ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND (customer_id = auth.uid() OR get_user_role() IN ('pharmacist','admin')))
);
CREATE POLICY "Insert items with own order"   ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND customer_id = auth.uid())
);

-- PRESCRIPTIONS
CREATE POLICY "Customers manage own Rx"       ON prescriptions FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "Pharmacist read all Rx"        ON prescriptions FOR SELECT USING (get_user_role() IN ('pharmacist','admin'));
CREATE POLICY "Pharmacist review Rx"          ON prescriptions FOR UPDATE USING (get_user_role() IN ('pharmacist','admin'));

-- PAYMENTS
CREATE POLICY "Customer reads own payments"   ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = payments.order_id AND customer_id = auth.uid())
);
CREATE POLICY "Staff reads all payments"      ON payments FOR SELECT USING (get_user_role() IN ('pharmacist','admin'));

-- COUPONS
CREATE POLICY "Anyone reads active coupons"   ON coupons FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin manages coupons"         ON coupons FOR ALL USING (get_user_role() = 'admin');

-- NOTIFICATIONS
CREATE POLICY "Users read own notifications"  ON notifications FOR ALL USING (auth.uid() = user_id);

-- ORDER STATUS HISTORY
CREATE POLICY "Read history of own orders"    ON order_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = order_status_history.order_id AND (customer_id = auth.uid() OR get_user_role() IN ('pharmacist','admin')))
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO categories (name, slug, description, icon) VALUES
  ('Antibiotics',      'antibiotics',      'Medicines that fight bacterial infections',      'bacteria'),
  ('Pain Relief',      'pain-relief',      'Analgesics and anti-inflammatory medicines',     'pill'),
  ('Vitamins',         'vitamins',         'Vitamins and dietary supplements',               'leaf'),
  ('Diabetes',         'diabetes',         'Insulin and blood sugar management',             'droplet'),
  ('Cardiovascular',   'cardiovascular',   'Heart and blood pressure medicines',             'heart'),
  ('Antimalarials',    'antimalarials',    'Prevention and treatment of malaria',            'shield'),
  ('Skincare',         'skincare',         'Topical creams, ointments and skincare',         'sparkles'),
  ('Respiratory',      'respiratory',      'Asthma, cough and cold medicines',              'wind');

INSERT INTO products (name, generic_name, brand, category_id, description, dosage_form, strength, price, stock_quantity, requires_prescription, image_url, manufacturer) VALUES
  ('Amoxicillin 500mg', 'Amoxicillin', 'Amoxil', (SELECT id FROM categories WHERE slug='antibiotics'), 'Broad-spectrum antibiotic for bacterial infections', 'capsule', '500mg', 15.00, 200, TRUE, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 'GSK Ghana'),
  ('Paracetamol 500mg', 'Paracetamol', 'Panadol', (SELECT id FROM categories WHERE slug='pain-relief'), 'Fever and mild to moderate pain relief', 'tablet', '500mg', 5.00, 500, FALSE, 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400', 'Phyto-Riker'),
  ('Vitamin C 1000mg', 'Ascorbic Acid', 'Cevitt', (SELECT id FROM categories WHERE slug='vitamins'), 'High-dose vitamin C for immune support', 'tablet', '1000mg', 25.00, 150, FALSE, 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400', 'BAYER Ghana'),
  ('Metformin 500mg', 'Metformin HCl', 'Glucophage', (SELECT id FROM categories WHERE slug='diabetes'), 'First-line oral medication for type 2 diabetes', 'tablet', '500mg', 20.00, 100, TRUE, 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400', 'Merck Ghana'),
  ('Amlodipine 5mg', 'Amlodipine Besylate', 'Norvasc', (SELECT id FROM categories WHERE slug='cardiovascular'), 'Calcium channel blocker for hypertension', 'tablet', '5mg', 30.00, 80, TRUE, 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400', 'Pfizer Ghana'),
  ('Artemether/Lumefantrine', 'Artemether+Lumefantrine', 'Coartem', (SELECT id FROM categories WHERE slug='antimalarials'), 'First-line treatment for uncomplicated malaria', 'tablet', '20mg/120mg', 45.00, 300, TRUE, 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400', 'Novartis Ghana'),
  ('Ibuprofen 400mg', 'Ibuprofen', 'Brufen', (SELECT id FROM categories WHERE slug='pain-relief'), 'NSAID for pain, fever and inflammation', 'tablet', '400mg', 8.00, 400, FALSE, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 'Abbott Ghana'),
  ('Salbutamol Inhaler', 'Salbutamol', 'Ventolin', (SELECT id FROM categories WHERE slug='respiratory'), 'Reliever inhaler for asthma and bronchospasm', 'inhaler', '100mcg', 55.00, 60, TRUE, 'https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=400', 'GSK Ghana'),
  ('Zinc 20mg', 'Zinc Sulphate', 'Zincovit', (SELECT id FROM categories WHERE slug='vitamins'), 'Essential mineral for immune function and wound healing', 'tablet', '20mg', 12.00, 200, FALSE, 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400', 'BAYER Ghana'),
  ('Lisinopril 10mg', 'Lisinopril', 'Zestril', (SELECT id FROM categories WHERE slug='cardiovascular'), 'ACE inhibitor for hypertension and heart failure', 'tablet', '10mg', 25.00, 120, TRUE, 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400', 'AstraZeneca Ghana'),
  ('Ciprofloxacin 500mg', 'Ciprofloxacin', 'Cipro', (SELECT id FROM categories WHERE slug='antibiotics'), 'Fluoroquinolone antibiotic for urinary tract and respiratory infections', 'tablet', '500mg', 22.00, 180, TRUE, 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400', 'Bayer Ghana'),
  ('Hydrocortisone Cream', 'Hydrocortisone', 'Dermacort', (SELECT id FROM categories WHERE slug='skincare'), 'Mild steroid cream for eczema and skin inflammation', 'cream', '1%', 18.00, 90, FALSE, 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400', 'Reiss Pharma');

INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_uses) VALUES
  ('WELCOME10', 'Welcome discount - 10% off first order', 'percentage', 10, 50, 1000),
  ('SAVE20',    'GHS 20 off orders above GHS 100',        'fixed',      20, 100, 500),
  ('HEALTH15',  '15% off all health supplements',         'percentage', 15, 0,  NULL);
