<?php
header("Content-Type: application/json; charset=utf-8");
session_start();
require_once __DIR__ . "/../config/db.php";

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["ok"=>false,"error"=>"LOGIN_REQUIRED"]);
  exit;
}
$userId = (int)$_SESSION["user_id"];
$action = $_REQUEST["action"] ?? "get";

try {
  if ($action === "get") {
    $stmt = $pdo->prepare("
      SELECT c.product_id, c.variant_id, c.qty, p.name,
             COALESCE(v.price_usd, p.price_usd) AS price_usd,
             v.title AS variant_title,
             (SELECT image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.id ASC LIMIT 1) AS img
      FROM cart_items c
      JOIN products p ON p.id=c.product_id
      LEFT JOIN product_variants v ON v.id = c.variant_id
      WHERE c.user_id=?
      ORDER BY c.updated_at DESC
    ");
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    $count = 0; $total = 0.0;
    foreach ($items as $it) { $count += (int)$it["qty"]; $total += ((float)$it["price_usd"]) * ((int)$it["qty"]); }
    echo json_encode(["ok"=>true,"items"=>$items,"count"=>$count,"total_usd"=>$total]);
    exit;
  }

  if ($action === "add") {
    $pid = (int)($_POST["product_id"] ?? 0);
    $qty = (int)($_POST["qty"] ?? 1);
    $vid = isset($_POST['variant_id']) ? (int)$_POST['variant_id'] : null;
    if ($pid<=0) { http_response_code(422); echo json_encode(["ok"=>false,"error"=>"INVALID_PRODUCT"]); exit; }
    if ($qty<1) $qty=1;

    $stmt = $pdo->prepare("\n      INSERT INTO cart_items (user_id, product_id, variant_id, qty)\n      VALUES (?, ?, ?, ?)\n      ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)\n    ");
    $stmt->execute([$userId,$pid,$vid,$qty]);
    echo json_encode(["ok"=>true]);
    exit;
  }

  if ($action === "update") {
    $pid = (int)($_POST["product_id"] ?? 0);
    $qty = (int)($_POST["qty"] ?? 1);
    $vid = isset($_POST['variant_id']) ? (int)$_POST['variant_id'] : null;
    if ($pid<=0) { http_response_code(422); echo json_encode(["ok"=>false,"error"=>"INVALID_PRODUCT"]); exit; }
    if ($qty<1) $qty=1;

    $stmt = $pdo->prepare("UPDATE cart_items SET qty=? WHERE user_id=? AND product_id=? AND (variant_id <=> ?)");
    $stmt->execute([$qty,$userId,$pid,$vid]);
    echo json_encode(["ok"=>true]);
    exit;
  }

  if ($action === "remove") {
    $pid = (int)($_POST["product_id"] ?? 0);
    $vid = isset($_POST['variant_id']) ? (int)$_POST['variant_id'] : null;
    $stmt = $pdo->prepare("DELETE FROM cart_items WHERE user_id=? AND product_id=? AND (variant_id <=> ?)");
    $stmt->execute([$userId,$pid,$vid]);
    echo json_encode(["ok"=>true]);
    exit;
  }

  if ($action === "clear") {
    $stmt = $pdo->prepare("DELETE FROM cart_items WHERE user_id=?");
    $stmt->execute([$userId]);
    echo json_encode(["ok"=>true]);
    exit;
  }

  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"UNKNOWN_ACTION"]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"SERVER_ERROR"]);
}
