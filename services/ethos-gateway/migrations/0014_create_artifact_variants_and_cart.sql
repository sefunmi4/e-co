-- migrate:up
CREATE TABLE IF NOT EXISTS artifact_variants (
    id UUID PRIMARY KEY,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifact_variants_artifact_id ON artifact_variants(artifact_id);

CREATE TABLE IF NOT EXISTS artifact_variant_options (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES artifact_variants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifact_variant_options_variant_id
    ON artifact_variant_options(variant_id);

CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES artifact_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

CREATE TABLE IF NOT EXISTS cart_item_options (
    cart_item_id UUID NOT NULL REFERENCES cart_items(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES artifact_variant_options(id) ON DELETE CASCADE,
    PRIMARY KEY (cart_item_id, option_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_item_options (
    id UUID PRIMARY KEY,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_id UUID NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id
    ON order_item_options(order_item_id);

-- migrate:down
DROP TABLE IF EXISTS order_item_options;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS cart_item_options;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS artifact_variant_options;
DROP TABLE IF EXISTS artifact_variants;
