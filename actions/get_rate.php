<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$rate = 0.0;

// 1) Try DB (if configured)
try {
  require_once __DIR__ . '/../config/db.php';
  if (isset($pdo)) {
    $stmt = $pdo->prepare("
      SELECT rate
      FROM currency_rates
      WHERE base_currency = 'USD' AND quote_currency = 'SYP'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && (float)$row['rate'] > 0) {
      $rate = (float)$row['rate'];
    }
  }
} catch (Throwable $e) {}

// 2) Fallback to a safe default if DB empty
if ($rate <= 0) {
  $rate = 12300.0;
}

echo json_encode(["rate" => $rate], JSON_UNESCAPED_UNICODE);
