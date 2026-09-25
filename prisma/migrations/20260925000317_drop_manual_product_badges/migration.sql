-- ADR 011: برچسب‌ها محاسباتی شدند — ستون دستی badges حذف می‌شود
-- منبع برچسب: store.badgeRules + فروش واقعی (OrderItem) + createdAt + موجودی
ALTER TABLE "Product" DROP COLUMN "badges";
