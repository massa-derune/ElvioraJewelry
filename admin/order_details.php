<?php
// Order details page
require_once __DIR__ . '/../config/db.php';

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
  http_response_code(400);
  echo "Invalid order id";
  exit;
}

$stmt = $conn->prepare("SELECT * FROM orders WHERE id=? LIMIT 1");
$stmt->execute([$id]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$order) {
  http_response_code(404);
  echo "Order not found";
  exit;
}

$stmt = $conn->prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY id ASC");
$stmt->execute([$id]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تفاصيل الطلب #<?= (int)$order['id'] ?> - Elviora</title>
  <link rel="stylesheet" href="../css/bootstrap.css">
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="mb-0">تفاصيل الطلب #<?= (int)$order['id'] ?></h3>
      <a class="btn btn-outline-secondary" href="orders.php">عودة</a>
    </div>

    <div class="row g-3">
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">معلومات الزبون</h5>
            <div>الاسم: <strong><?= htmlspecialchars($order['full_name'] ?? '') ?></strong></div>
            <div>الإيميل: <strong><?= htmlspecialchars($order['email'] ?? '') ?></strong></div>
            <div>الهاتف: <strong><?= htmlspecialchars($order['phone'] ?? '') ?></strong></div>
            <div>المحافظة: <strong><?= htmlspecialchars($order['governorate'] ?? '') ?></strong></div>
            <div>العنوان: <strong><?= htmlspecialchars($order['address'] ?? '') ?></strong></div>
            <div>ملاحظات: <strong><?= htmlspecialchars($order['notes'] ?? '') ?></strong></div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">ملخص</h5>
            <div>طريقة الدفع: <strong><?= htmlspecialchars($order['payment_method'] ?? '') ?></strong></div>
            <div>المجموع: <strong><?= htmlspecialchars($order['total_usd'] ?? '0') ?> $</strong></div>
            <div>التاريخ: <strong><?= htmlspecialchars($order['created_at'] ?? '') ?></strong></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-body">
        <h5 class="card-title">عناصر الطلب</h5>
        <?php if (!$items): ?>
          <div class="text-muted">لا يوجد عناصر.</div>
        <?php else: ?>
          <div class="table-responsive">
            <table class="table table-bordered bg-white">
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>المنتج</th>
                  <th>السعر ($)</th>
                  <th>الكمية</th>
                  <th>الإجمالي ($)</th>
                </tr>
              </thead>
              <tbody>
              <?php foreach ($items as $it): ?>
                <tr>
                  <td style="width:90px;">
                    <?php if (!empty($it['img'])): ?>
                      <img src="../<?= htmlspecialchars($it['img']) ?>" style="width:70px;height:70px;object-fit:cover;border-radius:10px;" />
                    <?php endif; ?>
                  </td>
                  <td><?= htmlspecialchars($it['title'] ?? '') ?></td>
                  <td><?= htmlspecialchars($it['price_usd'] ?? '0') ?></td>
                  <td><?= (int)($it['qty'] ?? 1) ?></td>
                  <td><?= number_format(((float)($it['price_usd'] ?? 0)) * ((int)($it['qty'] ?? 1)), 2) ?></td>
                </tr>
              <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</body>
</html>
