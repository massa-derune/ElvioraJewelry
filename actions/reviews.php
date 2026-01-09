<?php
header("Content-Type: application/json; charset=utf-8");
session_start();
require_once __DIR__ . "/../config/db.php";

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGetReviews();
            break;
        case 'POST':
            handleAddReview();
            break;
        default:
            http_response_code(405);
            echo json_encode(["ok" => false, "error" => "Method not allowed"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}

function handleGetReviews() {
    global $pdo;
    ensureReviewsTable();

    $productId = (int)($_GET['product_id'] ?? 0);
    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Product ID required"]);
        return;
    }

    $stmt = $pdo->prepare("
        SELECT
            pr.id,
            pr.rating,
            pr.review_text,
            pr.created_at,
            COALESCE(u.full_name, u.username, 'مستخدم مجهول') as user_name
        FROM product_reviews pr
        LEFT JOIN users u ON u.id = pr.user_id
        WHERE pr.product_id = ?
        ORDER BY pr.created_at DESC
    ");
    $stmt->execute([$productId]);
    $reviews = $stmt->fetchAll();

    $statsStmt = $pdo->prepare("
        SELECT
            COUNT(*) as total_reviews,
            AVG(rating) as average_rating,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
        FROM product_reviews
        WHERE product_id = ?
    ");
    $statsStmt->execute([$productId]);
    $stats = $statsStmt->fetch();

    echo json_encode([
        "ok" => true,
        "reviews" => $reviews,
        "stats" => [
            "total_reviews" => (int)$stats['total_reviews'],
            "average_rating" => $stats['average_rating'] ? round((float)$stats['average_rating'], 1) : 0,
            "rating_breakdown" => [
                "5" => (int)$stats['five_stars'],
                "4" => (int)$stats['four_stars'],
                "3" => (int)$stats['three_stars'],
                "2" => (int)$stats['two_stars'],
                "1" => (int)$stats['one_star']
            ]
        ]
    ]);
}

function handleAddReview() {
    global $pdo;
    ensureReviewsTable();

    $input = json_decode(file_get_contents('php://input'), true);
    $productId = (int)($input['product_id'] ?? 0);
    $rating = (int)($input['rating'] ?? 0);
    $reviewText = trim($input['review_text'] ?? '');
    $userId = (int)($input['user_id'] ?? 1);

    if ($productId <= 0 || $rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Invalid review data"]);
        return;
    }

    $productStmt = $pdo->prepare("SELECT id FROM products WHERE id = ?");
    $productStmt->execute([$productId]);
    if (!$productStmt->fetch()) {
        http_response_code(404);
        echo json_encode(["ok" => false, "error" => "Product not found"]);
        return;
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO product_reviews (product_id, user_id, rating, review_text, is_approved)
        VALUES (?, ?, ?, ?, 1)
    ");
    $insertStmt->execute([$productId, $userId, $rating, $reviewText]);

    echo json_encode(["ok" => true, "message" => "تم إضافة التقييم بنجاح"]);
}

function ensureReviewsTable() {
    global $pdo;

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS product_reviews (
              id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              product_id BIGINT UNSIGNED NOT NULL,
              user_id BIGINT UNSIGNED NOT NULL,
              rating TINYINT NOT NULL,
              review_text TEXT NULL,
              is_approved TINYINT(1) NOT NULL DEFAULT 1,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY idx_reviews_product (product_id),
              KEY idx_reviews_user (user_id),
              KEY idx_reviews_rating (rating)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        return true;
    } catch (Exception $e) {
        return false;
    }
}
?>
