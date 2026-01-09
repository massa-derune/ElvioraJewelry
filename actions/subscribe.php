<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method not allowed"], JSON_UNESCAPED_UNICODE);
    exit;
}

$email = trim($_POST["email"] ?? "");
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "يرجى إدخال بريد إلكتروني صحيح."], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . "/../config/db.php";

try {
    $stmt = $pdo->prepare("INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)");
    $stmt->execute([$email]);

    $message = $stmt->rowCount() > 0
        ? "تم الاشتراك بنجاح."
        : "أنتِ مشتركة بالفعل.";

    echo json_encode(["ok" => true, "message" => $message], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "تعذر إتمام الطلب."], JSON_UNESCAPED_UNICODE);
}
