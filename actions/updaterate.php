<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$rate = 12300.0;

// Try DB first (optional)
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
    } else {
      $insert = $pdo->prepare("
        INSERT INTO currency_rates (base_currency, quote_currency, rate, source)
        VALUES ('USD', 'SYP', :rate, 'manual_default')
      ");
      $insert->execute([":rate" => $rate]);
    }
  }
} catch (Throwable $e) {
  // ignore db errors but still return rate
}

echo json_encode(["ok" => true, "rate" => $rate], JSON_UNESCAPED_UNICODE);
