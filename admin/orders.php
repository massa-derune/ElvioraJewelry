<?php
// Simple admin page to view orders (for graduation demo)
require_once __DIR__ . '/../config/db.php';

$orders = $conn->query("SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS items_count FROM orders o ORDER BY o.id DESC")->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>إدارة الطلبات - Elviora</title>
  <link rel="stylesheet" href="../css/bootstrap.css">
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="mb-0">الطلبات</h3>
      <a class="btn btn-outline-secondary" href="../index.html">العودة للموقع</a>
    </div>

    <?php if (!$orders): ?>
      <div class="alert alert-info">لا يوجد طلبات بعد.</div>
    <?php else: ?>
      <div class="table-responsive">
        <table class="table table-bordered table-hover bg-white">
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>الإيميل</th>
              <th>الهاتف</th>
              <th>المحافظة</th>
              <th>المجموع ($)</th>
              <th>عدد العناصر</th>
              <th>الدفع</th>
              <th>التاريخ</th>
              <th>تفاصيل</th>
            </tr>
          </thead>
          <tbody>
          <?php foreach ($orders as $o): ?>
            <tr>
              <td><?= (int)$o['id'] ?></td>
              <td><?= htmlspecialchars($o['full_name'] ?? '') ?></td>
              <td><?= htmlspecialchars($o['email'] ?? '') ?></td>
              <td><?= htmlspecialchars($o['phone'] ?? '') ?></td>
              <td><?= htmlspecialchars($o['governorate'] ?? '') ?></td>
              <td><?= htmlspecialchars($o['total_usd'] ?? '0') ?></td>
              <td><?= (int)$o['items_count'] ?></td>
              <td><?= htmlspecialchars($o['payment_method'] ?? '') ?></td>
              <td><?= htmlspecialchars($o['created_at'] ?? '') ?></td>
              <td>
                <a class="btn btn-sm btn-primary" href="order_details.php?id=<?= (int)$o['id'] ?>">عرض</a>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
