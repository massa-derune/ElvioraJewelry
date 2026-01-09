<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . "/../config/db.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method not allowed"]);
    exit;
}

try {
    $category = $_GET['category'] ?? '';
    $limit = (int)($_GET['limit'] ?? 10);
    $offset = (int)($_GET['offset'] ?? 0);

    $whereClause = '';
    $params = [];

    if (!empty($category)) {
        $whereClause = "WHERE c.name = ? AND p.is_active = 1";
        $params[] = $category;
    } else {
        $whereClause = "WHERE p.is_active = 1";
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
            c.name as category_name,
            (SELECT pi.image_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) as main_image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        $whereClause
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    ");

    $params[] = $limit;
    $params[] = $offset;

    $stmt->execute($params);
    $products = $stmt->fetchAll();

    $materials = [
        'gold' => 'ذهب',
        'silver' => 'فضة',
        'diamond' => 'ألماس',
        'other' => 'أخرى'
    ];

    foreach ($products as &$product) {
        $product['material_name'] = $materials[$product['material']] ?? $product['material'];
        $product['main_image'] = $product['main_image'] ?: 'images/default-product.jpg';
    }

    echo json_encode([
        "ok" => true,
        "products" => $products,
        "total" => count($products)
    ]);
} catch (Exception $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}
?>
