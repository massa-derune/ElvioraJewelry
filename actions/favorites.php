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
$action = $_REQUEST["action"] ?? "list";

try {
  if ($action === "list") {
    $stmt = $pdo->prepare("
      SELECT f.product_id, p.name, p.price_usd,
             (SELECT image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.id ASC LIMIT 1) AS img
      FROM favorites f
      JOIN products p ON p.id=f.product_id
      WHERE f.user_id=?
      ORDER BY f.created_at DESC
    ");
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    echo json_encode(["ok"=>true,"items"=>$items,"count"=>count($items)]);
    exit;
  }

  if ($action === "toggle") {
    $pid = (int)($_POST["product_id"] ?? 0);
    if ($pid<=0) { http_response_code(422); echo json_encode(["ok"=>false,"error"=>"INVALID_PRODUCT"]); exit; }
    $chk = $pdo->prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=? LIMIT 1");
    $chk->execute([$userId,$pid]);
    $row = $chk->fetch();
    if ($row) {
      $del = $pdo->prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?");
      $del->execute([$userId,$pid]);
      echo json_encode(["ok"=>true,"favorited"=>false]);
    } else {
      $ins = $pdo->prepare("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)");
      $ins->execute([$userId,$pid]);
      echo json_encode(["ok"=>true,"favorited"=>true]);
    }
    exit;
  }

  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"UNKNOWN_ACTION"]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"SERVER_ERROR"]);
}
