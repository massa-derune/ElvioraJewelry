<?php
header("Content-Type: application/json; charset=utf-8");
session_start();
require_once __DIR__ . "/../config/db.php";

function columnExists(PDO $pdo, string $table, string $column): bool {
  $q = "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?";
  $st = $pdo->prepare($q);
  $st->execute([$table, $column]);
  return (int)($st->fetchColumn() ?: 0) > 0;
}

function respondError(int $httpCode, string $code, string $message) {
  http_response_code($httpCode);
  echo json_encode(["ok" => false, "error" => $code, "message" => $message]);
  exit;
}

if (!isset($_SESSION["user_id"])) {
  respondError(401, "LOGIN_REQUIRED", "يجب تسجيل الدخول قبل إتمام الطلب.");
}
$userId = (int)$_SESSION["user_id"];

$body = json_decode(file_get_contents("php://input"), true);
if (!$body) {
  respondError(400, "INVALID_JSON", "البيانات المرسلة غير صالحة.");
}

// Support the newer front-end payload format:
// { customer:{fullName,email,phone,city,address,notes,payment}, cart:[{id,qty,...}], totals:{...} }
if (isset($body["customer"]) && is_array($body["customer"])) {
  $c = $body["customer"];
  $body["full_name"] = $body["full_name"] ?? ($c["fullName"] ?? "");
  $body["email"] = $body["email"] ?? ($c["email"] ?? "");
  $body["phone"] = $body["phone"] ?? ($c["phone"] ?? "");
  $body["governorate"] = $body["governorate"] ?? ($c["city"] ?? "");
  $body["address"] = $body["address"] ?? ($c["address"] ?? "");
  $body["notes"] = $body["notes"] ?? ($c["notes"] ?? "");
  $body["payment_method"] = $body["payment_method"] ?? ($c["payment"] ?? "cash");
}

$full_name = trim($body["full_name"] ?? "");
$email     = trim($body["email"] ?? "");
$phone     = trim($body["phone"] ?? "");
$gov       = trim($body["governorate"] ?? "");
$address   = trim($body["address"] ?? "");
$notes     = trim($body["notes"] ?? "");
$payRaw    = trim((string)($body["payment_method"] ?? "cash"));
$rate      = $body["currency_rate"] ?? null;

// Normalize payment method because the UI uses Arabic labels while the DB might
// still use an enum with fixed values.
function normalizePaymentMethod(string $raw): string {
  $r = mb_strtolower(trim($raw));
  $map = [
    // English
    'cash' => 'cash',
    'cod'  => 'cash',
    'paypal' => 'paypal',
    'local_gateway' => 'local_gateway',
    'bimo' => 'local_gateway',
    // Arabic labels in the checkout UI
    'شام كاش' => 'local_gateway',
    'شركة الفؤاد للحوالات' => 'local_gateway',
    'الهرم' => 'local_gateway',
    'بنك بيمو السعودي' => 'local_gateway',
    'الدفع نقداً' => 'cash',
    'الدفع نقدا' => 'cash',
    'كاش' => 'cash',
    'نقداً' => 'cash',
  ];
  foreach ($map as $k => $v) {
    if ($r === mb_strtolower($k)) return $v;
  }
  // Fallback: keep a safe value
  return 'cash';
}

$pay = normalizePaymentMethod($payRaw);

if ($full_name==="" || $email==="" || $phone==="" || $address==="") {
  respondError(422, "MISSING_FIELDS", "الرجاء تعبئة الاسم والإيميل ورقم الهاتف والعنوان.");
}

// Prefer cart coming from the client (localStorage cart) so guests can build a cart,
// then login and checkout without losing it.
  // Accept both "cart" and "cart_items" payload keys (older/newer frontends)
  $clientCart = $body["cart"] ?? ($body["cart_items"] ?? null);
$cart = [];

if (is_array($clientCart) && count($clientCart) > 0) {
  // clientCart items: {product_id, qty, variant_id?}
  $ids = array_values(array_unique(array_map(fn($x)=> (int)($x["product_id"] ?? ($x["id"] ?? 0)), $clientCart)));
  $ids = array_filter($ids, fn($id)=>$id>0);

  $variantIds = array_values(array_unique(array_map(fn($x)=> (int)($x["variant_id"] ?? 0), $clientCart)));
  $variantIds = array_filter($variantIds, fn($id)=>$id>0);

  if ($ids) {
    $in = implode(",", array_fill(0, count($ids), "?"));
    $st = $pdo->prepare(
      "SELECT p.id AS product_id, p.name, p.price_usd, " .
      "(SELECT image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.id ASC LIMIT 1) AS img " .
      "FROM products p WHERE p.id IN ($in)"
    );
    $st->execute($ids);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    $byId = [];
    foreach ($rows as $r) $byId[(int)$r["product_id"]] = $r;
  } else {
    $byId = [];
  }

  $byVid = [];
  if ($variantIds) {
    $inv = implode(",", array_fill(0, count($variantIds), "?"));
    $stV = $pdo->prepare("SELECT * FROM product_variants WHERE id IN ($inv)");
    $stV->execute($variantIds);
    $vrows = $stV->fetchAll(PDO::FETCH_ASSOC);
    foreach ($vrows as $vr) $byVid[(int)$vr['id']] = $vr;
  }

  foreach ($clientCart as $it) {
    // Normalize price key (frontend uses priceUsd)
    if (isset($it["priceUsd"]) && !isset($it["price_usd"])) {
      $it["price_usd"] = $it["priceUsd"];
    }

    // Frontend items may be built from static pages/localStorage and their IDs might not
    // exist in DB (or might be strings). We try DB first (strong source of truth),
    // and if the product is missing we fallback to client-provided fields so checkout works.
    $rawId = $it["product_id"] ?? ($it["id"] ?? null);
    $pid = is_numeric($rawId) ? (int)$rawId : 0;
    $qty = max(1, (int)($it["qty"] ?? ($it["quantity"] ?? 1)));
    $rawVid = is_numeric($it["variant_id"] ?? null) ? (int)($it["variant_id"] ?? 0) : 0;

    if ($pid > 0 && isset($byId[$pid])) {
      $name = $byId[$pid]["name"];
      $price = $byId[$pid]["price_usd"];
      $img = $byId[$pid]["img"];
      $variantTitle = null;
      if ($rawVid > 0 && isset($byVid[$rawVid])) {
        $v = $byVid[$rawVid];
        if ($v['title']) $variantTitle = $v['title'];
        if ($v['price_usd'] !== null) $price = $v['price_usd'];
      }
      $cart[] = [
        "product_id" => $pid,
        "variant_id" => $rawVid > 0 ? $rawVid : null,
        "qty"        => $qty,
        "name"       => $variantTitle ? ($name . ' - ' . $variantTitle) : $name,
        "price_usd"  => $price,
        "img"        => $img,
        "variant_title" => $variantTitle,
      ];
      continue;
    }

    // Fallback from client payload
    $name = trim((string)($it["name"] ?? $it["title"] ?? ""));
    $price = $it["price_usd"] ?? ($it["price"] ?? ($it["usd"] ?? null));
    $img = $it["img"] ?? ($it["image"] ?? ($it["image_path"] ?? null));
    $priceNum = is_numeric($price) ? (float)$price : 0.0;
    if ($name !== "" && $priceNum > 0) {
      $cart[] = [
        "product_id" => null,
        "qty"        => $qty,
        "name"       => $name,
        "price_usd"  => $priceNum,
        "img"        => $img,
      ];
    }
  }

  // If we couldn't extract numeric IDs (or products are not in DB),
  // fall back to the client-provided data so checkout can still work.
  if (!$cart) {
    foreach ($clientCart as $it) {
      $qty = max(1, (int)($it["qty"] ?? ($it["quantity"] ?? 1)));
      $name = trim((string)($it["title"] ?? ($it["name"] ?? "")));
      $price = (float)($it["price_usd"] ?? ($it["priceUsd"] ?? ($it["price"] ?? 0)));
      $img = (string)($it["img"] ?? ($it["image"] ?? ""));
      if ($name === "" || $price <= 0) continue;
      $cart[] = [
        "product_id" => null,
        "qty" => $qty,
        "name" => $name,
        "price_usd" => $price,
        "img" => $img,
      ];
    }
  }
} else {
  // Fallback: server cart (include variant info)
  $stmt = $pdo->prepare("\n    SELECT c.product_id, c.variant_id, c.qty, p.name,\n           COALESCE(v.price_usd, p.price_usd) AS price_usd,\n           v.title AS variant_title,\n           (SELECT image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.id ASC LIMIT 1) AS img\n    FROM cart_items c\n    JOIN products p ON p.id=c.product_id\n    LEFT JOIN product_variants v ON v.id = c.variant_id\n    WHERE c.user_id=?\n  ");
  $stmt->execute([$userId]);
  $cart = $stmt->fetchAll(PDO::FETCH_ASSOC);
} 
if (!$cart) { http_response_code(400); echo json_encode(["ok"=>false,"error"=>"CART_EMPTY"]); exit; }

$total = 0.0;
foreach ($cart as $it) $total += ((float)$it["price_usd"]) * ((int)$it["qty"]);

try {
  $pdo->beginTransaction();

  $hasCurrencyRate = columnExists($pdo, "orders", "currency_rate");
  if ($hasCurrencyRate) {
    $ins = $pdo->prepare("INSERT INTO orders
      (user_id, full_name, email, phone, governorate, address, notes, payment_method, status, total_usd, currency_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ");
    $ins->execute([$userId, $full_name, $email, $phone, $gov, $address, $notes, $pay, $total, $rate]);
  } else {
    $ins = $pdo->prepare("INSERT INTO orders
      (user_id, full_name, email, phone, governorate, address, notes, payment_method, status, total_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    ");
    $ins->execute([$userId, $full_name, $email, $phone, $gov, $address, $notes, $pay, $total]);
  }
  $orderId = (int)$pdo->lastInsertId();

  // Some dumps use `quantity` instead of `qty`. Make the insert resilient.
  $qtyCol = columnExists($pdo, "order_items", "qty") ? "qty" : (columnExists($pdo, "order_items", "quantity") ? "quantity" : "qty");

  $hasVariantId = columnExists($pdo, "order_items", "variant_id");
  $hasVariantTitle = columnExists($pdo, "order_items", "variant_title");

  $cols = ["order_id", "product_id", "title", "price_usd", $qtyCol, "img"];
  if ($hasVariantId) $cols[] = "variant_id";
  if ($hasVariantTitle) $cols[] = "variant_title";
  $placeholders = array_fill(0, count($cols), "?");
  $sqlItem = "INSERT INTO order_items (" . implode(",", $cols) . ") VALUES (" . implode(",", $placeholders) . ")";
  $insItem = $pdo->prepare($sqlItem);
  foreach ($cart as $it) {
    $pid = (int)($it["product_id"] ?? 0);
    $pid = ($pid > 0) ? $pid : null;
    $params = [
      $orderId,
      $pid,
      (string)$it["name"],
      (float)$it["price_usd"],
      (int)$it["qty"],
      (string)$it["img"],
    ];
    if ($hasVariantId) $params[] = isset($it['variant_id']) ? (int)$it['variant_id'] : null;
    if ($hasVariantTitle) $params[] = isset($it['variant_title']) ? (string)$it['variant_title'] : null;
    $insItem->execute($params);
  }

  // Clear both server cart and client cart.
  try {
    $clr = $pdo->prepare("DELETE FROM cart_items WHERE user_id=?");
    $clr->execute([$userId]);
  } catch (Throwable $ignore) {}

  $pdo->commit();
  echo json_encode(["ok"=>true,"order_id"=>$orderId,"total_usd"=>$total]);
} catch (Throwable $e) {
  $pdo->rollBack();
  respondError(
    500,
    "ORDER_FAILED",
    "تعذر حفظ الطلب. يرجى التأكد من قاعدة البيانات والحقول المطلوبة. (" . $e->getMessage() . ")"
  );
}
