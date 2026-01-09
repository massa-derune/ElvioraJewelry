<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . "/../config/db.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method not allowed"]);
    exit;
}

try {
    $productId = (int)($_GET['id'] ?? 0);
    error_log("Requested product ID: " . $productId);

    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Product ID required"]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT 
            p.id,
            p.name,
            p.description,
            p.material,
            p.karat,
            p.weight,
            p.price_usd,
            p.stock,
            p.is_active,
            c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.is_active = 1
    ");
    $stmt->execute([$productId]);
    $product = $stmt->fetch();

    if (!$product) {
        error_log("Product not found: " . $productId);
        http_response_code(404);
        echo json_encode(["ok" => false, "error" => "Product not found"]);
        exit;
    }

    $imagesStmt = $pdo->prepare("
        SELECT image_path, sort_order
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order ASC
    ");
    $imagesStmt->execute([$productId]);
    $images = $imagesStmt->fetchAll();

    $product['images'] = $images;
    $product['main_image'] = !empty($images) ? $images[0]['image_path'] : 'images/default-product.jpg';

    $materials = [
        'gold' => 'ذهب',
        'silver' => 'فضة',
        'diamond' => 'ألماس',
        'other' => 'أخرى'
    ];
    $product['material_name'] = $materials[$product['material']] ?? $product['material'];

    error_log("Product found successfully: " . $product['name']);

    echo json_encode([
        "ok" => true,
        "product" => $product
    ]);
} catch (Exception $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}
?>
