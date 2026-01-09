<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");

// تسجيل مفصل للأخطاء
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

try {
    // الاتصال بقاعدة البيانات
    require_once __DIR__ . "/../config/db.php";
    
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode([
            "ok" => false, 
            "error" => "Method not allowed",
            "debug" => ["method" => $method, "allowed" => "GET"]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $productId = (int)($_GET['id'] ?? 0);
    
    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode([
            "ok" => false, 
            "error" => "معرف المنتج مطلوب ويجب أن يكون رقم صحيح",
            "debug" => ["received_id" => $_GET['id'] ?? null, "parsed_id" => $productId]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // جلب بيانات المنتج مع التصنيف
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
            p.created_at,
            c.name as category_name,
            c.id as category_id
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.is_active = 1
    ");
    
    $stmt->execute([$productId]);
    $product = $stmt->fetch();

    if (!$product) {
        http_response_code(404);
        echo json_encode([
            "ok" => false, 
            "error" => "المنتج غير موجود أو غير نشط",
            "debug" => [
                "product_id" => $productId,
                "query_executed" => true,
                "found" => false
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // جلب صور المنتج
    $imagesStmt = $pdo->prepare("
        SELECT image_path, sort_order
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order ASC
    ");
    $imagesStmt->execute([$productId]);
    $images = $imagesStmt->fetchAll();

    // جلب التقييمات
    $reviewStats = [
        'total_reviews' => 0,
        'average_rating' => 0,
        'five_star' => 0,
        'four_star' => 0,
        'three_star' => 0,
        'two_star' => 0,
        'one_star' => 0
    ];

    try {
        $reviewsStmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM product_reviews
            WHERE product_id = ?
        ");
        $reviewsStmt->execute([$productId]);
        $dbStats = $reviewsStmt->fetch();
        if ($dbStats) {
            $reviewStats = array_merge($reviewStats, $dbStats);
        }
    } catch (PDOException $e) {
        // Keep empty stats when reviews table is missing.
    }

    // إضافة البيانات المحسوبة إلى المنتج
    $product['images'] = $images;
    $product['main_image'] = !empty($images) ? $images[0]['image_path'] : 'images/default-product.jpg';
    
    // تحويل المادة إلى اسم عربي
    $materials = [
        'gold' => 'ذهب',
        'silver' => 'فضة',
        'diamond' => 'ألماس',
        'platinum' => 'بلاتين',
        'other' => 'أخرى'
    ];
    $product['material_name'] = $materials[$product['material']] ?? $product['material'];
    
    // إضافة إحصائيات التقييمات
    $product['reviews'] = [
        'total' => (int)$reviewStats['total_reviews'],
        'average' => $reviewStats['average_rating'] ? round((float)$reviewStats['average_rating'], 1) : 0,
        'breakdown' => [
            '5' => (int)$reviewStats['five_star'],
            '4' => (int)$reviewStats['four_star'],
            '3' => (int)$reviewStats['three_star'],
            '2' => (int)$reviewStats['two_star'],
            '1' => (int)$reviewStats['one_star']
        ]
    ];
    
    // تحويل الأرقام إلى النوع الصحيح
    $product['id'] = (int)$product['id'];
    $product['price_usd'] = (float)$product['price_usd'];
    $product['weight'] = $product['weight'] ? (float)$product['weight'] : null;
    $product['stock'] = (int)$product['stock'];
    $product['is_active'] = (bool)$product['is_active'];
    $product['category_id'] = $product['category_id'] ? (int)$product['category_id'] : null;

    // الاستجابة النهائية
    echo json_encode([
        "ok" => true,
        "product" => $product,
        "debug" => [
            "product_id" => $productId,
            "found" => true,
            "images_count" => count($images),
            "reviews_count" => $product['reviews']['total'],
            "timestamp" => date('Y-m-d H:i:s'),
            "api_version" => "2.0"
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (PDOException $e) {
    error_log("Database error in get_product_verified.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "error" => "خطأ في قاعدة البيانات",
        "debug" => [
            "type" => "database_error",
            "message" => $e->getMessage(),
            "code" => $e->getCode(),
            "timestamp" => date('Y-m-d H:i:s')
        ]
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    error_log("General error in get_product_verified.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "error" => "خطأ عام في الخادم",
        "debug" => [
            "type" => "general_error",
            "message" => $e->getMessage(),
            "file" => $e->getFile(),
            "line" => $e->getLine(),
            "timestamp" => date('Y-m-d H:i:s')
        ]
    ], JSON_UNESCAPED_UNICODE);
}
?>
