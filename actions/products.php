<?php
declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");
session_start();

require_once __DIR__ . "/../config/db.php";

function respond(array $payload, int $status = 200): void {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function isAdmin(): bool {
  // Header override for server-to-server/admin tools
  $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
  $secret = $headers['X-Admin-Secret'] ?? $_SERVER['HTTP_X_ADMIN_SECRET'] ?? null;
  $envSecret = $_ENV['ADMIN_SECRET'] ?? getenv('ADMIN_SECRET') ?: null;
  if ($secret && $envSecret && hash_equals((string)$envSecret, (string)$secret)) {
    return true;
  }

  // Session-based admin (expects role/is_admin stored in session)
  if (isset($_SESSION["is_admin"]) && $_SESSION["is_admin"]) return true;
  if (isset($_SESSION["user_role"]) && $_SESSION["user_role"] === "admin") return true;

  return false;
}

function requireAdmin(): void {
  if (!isAdmin()) {
    respond(["ok" => false, "error" => "ADMIN_REQUIRED"], 401);
  }
}

function inputBody(): array {
  $contentType = $_SERVER["CONTENT_TYPE"] ?? "";
  if (stripos($contentType, "application/json") !== false) {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
  }
  return $_POST ?: [];
}

function parseImages(mixed $raw): array {
  if (is_string($raw)) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) { $raw = $decoded; }
  }
  if (!is_array($raw)) return [];
  $list = [];
  foreach ($raw as $img) {
    $img = trim((string)$img);
    if ($img !== "") $list[] = $img;
  }
  return array_values(array_unique($list));
}

function parseVariants(mixed $raw): array {
  // Accept JSON string or array of variants. Normalize each variant.
  if (is_string($raw)) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) { $raw = $decoded; }
  }
  if (!is_array($raw)) return [];
  $out = [];
  foreach ($raw as $v) {
    if (!is_array($v)) continue;
    $sku = isset($v['sku']) ? trim((string)$v['sku']) : null;
    $title = isset($v['title']) ? trim((string)$v['title']) : null;
    $price = isset($v['price_usd']) ? (float)$v['price_usd'] : null;
    $stock = isset($v['stock']) ? (int)$v['stock'] : 0;
    $attrs = isset($v['attributes']) ? $v['attributes'] : null; // keep as array if provided
    $isActive = isset($v['is_active']) ? (int)(bool)$v['is_active'] : 1;
    $out[] = [
      'sku' => $sku,
      'title' => $title,
      'price_usd' => $price,
      'stock' => $stock,
      'attributes' => $attrs,
      'is_active' => $isActive
    ];
  }
  return $out;
}

/**
 * Build an image set by probing common numbered variants when DB has none.
 */
function buildImageSet(string $mainImage, int $limit = 6): array {
  $mainImage = trim($mainImage);
  if ($mainImage === '') return [];

  $images = [];
  $baseDir = realpath(__DIR__ . '/..');
  $pushIfExists = function(string $rel) use (&$images, $baseDir) {
    $rel = ltrim($rel, '/');
    if ($rel === '' || in_array($rel, $images, true)) return;
    $full = $baseDir ? $baseDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $rel) : $rel;
    if (file_exists($full)) {
      $images[] = $rel;
    }
  };

  $pushIfExists($mainImage);
  $dot = strrpos($mainImage, '.');
  if ($dot === false) return $images;
  $ext = substr($mainImage, $dot);
  $name = substr($mainImage, 0, $dot);

  // Strip existing numeric suffix like (1) or _1
  $base = preg_replace('/(\\s*\\(\\d+\\)|[_\\s]+\\d+)$/', '', $name) ?: $name;
  for ($i = 1; $i <= 5 && count($images) < $limit; $i++) {
    $candidates = [
      "{$base} ({$i}){$ext}",
      "{$base}{$i}{$ext}",
      "{$base}_{$i}{$ext}",
      "{$base} {$i}{$ext}",
    ];
    foreach ($candidates as $cand) {
      if (count($images) >= $limit) break 2;
      $pushIfExists($cand);
    }
  }

  // Glob any sibling files that start with the same base and extension.
  if ($baseDir && count($images) < $limit) {
    $dirName = dirname($mainImage);
    $fileName = basename($mainImage);
    $dot2 = strrpos($fileName, '.');
    if ($dot2 !== false) {
      $extOnly = substr($fileName, $dot2);
      $baseOnly = substr($fileName, 0, $dot2);
      $baseOnlyStripped = preg_replace('/(\\s*\\(\\d+\\)|[_\\s]+\\d+)$/', '', $baseOnly) ?: $baseOnly;
      $dirFs = $baseDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $dirName);
      $pattern = $dirFs . DIRECTORY_SEPARATOR . $baseOnlyStripped . '*' . $extOnly;
      $matches = glob($pattern, GLOB_NOSORT) ?: [];
      natsort($matches);
      foreach ($matches as $m) {
        if (count($images) >= $limit) break;
        $rel = ltrim(str_replace($baseDir . DIRECTORY_SEPARATOR, '', $m), '/\\');
        $pushIfExists($rel);
      }
    }
  }

  return $images;
}

/**
 * Apply manual overrides for known products with incorrect image paths.
 */
function applyImageOverride(array &$product): void {
  $overridesById = [
    3 => ['images/تعليقة غيار 24(2).webp'], // تعليقة ذهب
  ];

  // Manual grouped images for products that share multiple numbered files.
  $sets = [
    ['names' => ['عقد ذهب دائري عيار18', 'عقد ذهب دائري عيار18(2)'], 'images' => [
      'images/عقد ذهب دائري عيار18.webp',
      'images/عقد ذهب دائري عيار18(2).webp',
    ]],
    ['names' => ['عقد ذهب فراشة بوردة عيار18', 'عقد ذهب فراشة بوردة عيار18(2)'], 'images' => [
      'images/عقد ذهب فراشة بوردة عيار18.webp',
      'images/عقد ذهب فراشة بوردة عيار18(2).webp',
    ]],
    ['names' => ['عقد ذهب وردة عيار 21', 'عقد ذهب وردة عيار 21.webp(2)'], 'images' => [
      'images/عقد ذهب وردة عيار 21.webp',
      'images/عقد ذهب وردة عيار 21(2).webp',
    ]],
    ['names' => ['طقم ذهب بيضاوي مخطط', 'طقم ذهب بيضاوي مخطط 1'], 'images' => [
      'images/طقم ذهب بيضاوي مخطط 1.webp',
      'images/طقم ذهب بيضاوي مخطط 2.webp',
      'images/طقم ذهب بيضاوي مخطط 3.webp',
      'images/طقم ذهب بيضاوي مخطط4.webp',
    ]],
    ['names' => ['عقد الذهب قلب', 'عقد الذهب قلب(2)'], 'images' => [
      'images/عقد الذهب قلب.webp',
      'images/عقد الذهب قلب(2).webp',
    ]],
    ['names' => ['عقد ألماس قيراط', 'عقد ألماس قيراط 0.01', 'عقد ألماس قيراط 0.99'], 'images' => [
      'images/عقد ألماس قيراط 0.01.webp',
      'images/عقد ألماس قيراط 0.99.webp',
    ]],
    ['names' => ['طقم ذهب الدائرة', 'طقم ذهب الدائرة 2'], 'images' => [
      'images/طقم ذهب الدائرة 2.webp',
      'images/طقم ذهب الدائرة 3.webp',
    ]],
    ['names' => ['طقم ذهب الدمعة', 'طقم ذهب الدمعة 2'], 'images' => [
      'images/طقم ذهب الدمعة 2.webp',
      'images/طقم ذهب الدمعة3.webp',
      'images/طقم ذهب الدمعة 4.webp',
    ]],
    ['names' => ['طقم ذهب الزهرة', 'طقم ذهب الزهرة1'], 'images' => [
      'images/طقم ذهب الزهرة1.webp',
      'images/طقم ذهب الزهرة2.webp',
    ]],
    ['names' => ['طقم ذهب الزهرتين عيار21', 'طقم ذهب الزهرتين عيار21 -2'], 'images' => [
      'images/طقم ذهب الزهرتين عيار21.webp',
      'images/طقم ذهب الزهرتين عيار21 -2.webp',
      'images/طقم ذهب الزهرتين عيار21_3.webp',
      'images/طقم ذهب الزهرتين عيار21_4.webp',
    ]],
  ];

  $pid = isset($product['id']) ? (int)$product['id'] : 0;
  $name = trim((string)($product['name'] ?? $product['title'] ?? ''));
  $baseDir = realpath(__DIR__ . '/..');

  $applyList = null;
  if (isset($overridesById[$pid])) {
    $applyList = $overridesById[$pid];
  } else {
    foreach ($sets as $set) {
      foreach ($set['names'] as $n) {
        if ($name !== '' && $name === $n) {
          $applyList = $set['images'];
          break 2;
        }
      }
    }
  }

  if ($applyList === null) return;

  // Keep only existing files and merge with current images.
  $valid = [];
  foreach ($applyList as $rel) {
    $rel = ltrim((string)$rel, '/');
    if ($rel === '' || in_array($rel, $valid, true)) continue;
    $full = $baseDir ? $baseDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $rel) : $rel;
    if (file_exists($full)) {
      $valid[] = $rel;
    }
  }
  if (!$valid) return;

  $currentImages = [];
  if (isset($product['images']) && is_array($product['images'])) {
    $currentImages = array_values(array_filter(array_map('strval', $product['images'])));
  }
  $product['images'] = array_values(array_unique(array_merge($valid, $currentImages)));
  if (!empty($product['images'])) {
    $product['main_image'] = $product['images'][0];
  }
}

$action = $_REQUEST["action"] ?? "list";
$isAdmin = isAdmin();

try {
  // Public list/detail; create/update/delete require admin
  if (in_array($action, ["create", "update", "delete"], true)) {
    requireAdmin();
  }

  if ($action === "list") {
    $page = max(1, (int)($_GET["page"] ?? 1));
    $perPage = max(1, min(100, (int)($_GET["limit"] ?? 20)));
    $offset = ($page - 1) * $perPage;
    $q = trim((string)($_GET["q"] ?? ""));
    $categoryId = (int)($_GET["category_id"] ?? 0);
    // Only admins can view inactive products
    $includeInactive = $isAdmin && isset($_GET["include_inactive"]) ? (bool)$_GET["include_inactive"] : false;

    $where = "WHERE 1=1";
    $params = [];
    if (!$includeInactive) { $where .= " AND p.is_active=1"; }
    if ($categoryId > 0) { $where .= " AND p.category_id=?"; $params[] = $categoryId; }
    if ($q !== "") {
      $where .= " AND (p.name LIKE ? OR p.description LIKE ?)";
      $like = "%" . $q . "%";
      $params[] = $like; $params[] = $like;
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM products p $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $sql = "
      SELECT
        p.id, p.name, p.description, p.price_usd, p.category_id, p.material, p.karat, p.weight, p.stock, p.is_active,
        c.name AS category_name,
        (SELECT image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1) AS main_image,
        (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id) AS variants_count,
        (SELECT MIN(COALESCE(v.price_usd, p.price_usd)) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) AS min_price
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      $where
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    ";
    $paramsLimit = array_merge($params, [$perPage, $offset]);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($paramsLimit);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($items) {
      $ids = array_column($items, 'id');
      $ph = implode(',', array_fill(0, count($ids), '?'));
      $imgStmt = $pdo->prepare("SELECT product_id, image_path FROM product_images WHERE product_id IN ($ph) ORDER BY sort_order ASC, id ASC");
      $imgStmt->execute($ids);
      $imagesMap = [];
    while ($row = $imgStmt->fetch(PDO::FETCH_ASSOC)) {
      $pid = (int)($row['product_id'] ?? 0);
      if ($pid <= 0) continue;
      $img = $row['image_path'] ?? '';
      if ($img === '') continue;
        $imagesMap[$pid][] = $img;
      }
    foreach ($items as &$it) {
      $pid = (int)($it['id'] ?? 0);
      $it['images'] = $imagesMap[$pid] ?? [];
      if ((!$it['main_image'] || $it['main_image'] === null) && !empty($it['images'])) {
        $it['main_image'] = $it['images'][0];
      }
      if (!$it['images'] && !empty($it['main_image'])) {
        $it['images'] = buildImageSet($it['main_image']);
      }
      applyImageOverride($it);
    }
    unset($it);
  }

    respond([
      "ok" => true,
      "items" => $items,
      "pagination" => [
        "page" => $page,
        "per_page" => $perPage,
        "total" => $total,
        "has_more" => ($offset + count($items)) < $total
      ]
    ]);
  }

  if ($action === "get") {
    $id = (int)($_GET["id"] ?? 0);
    if ($id <= 0) { respond(["ok" => false, "error" => "INVALID_ID"], 422); }

    $st = $pdo->prepare("
      SELECT p.*, c.name AS category_name,
        (SELECT image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1) AS main_image
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.id=? LIMIT 1
    ");
    $st->execute([$id]);
    $product = $st->fetch(PDO::FETCH_ASSOC);
    if (!$product) { respond(["ok" => false, "error" => "NOT_FOUND"], 404); }

    $imgs = $pdo->prepare("SELECT image_path FROM product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC");
    $imgs->execute([$id]);
    $product["images"] = $imgs->fetchAll(PDO::FETCH_COLUMN);

    // variants
    $vst = $pdo->prepare("SELECT id, sku, title, price_usd, stock, attributes, is_active FROM product_variants WHERE product_id=? ORDER BY id ASC");
    $vst->execute([$id]);
    $variants = $vst->fetchAll(PDO::FETCH_ASSOC);
    foreach ($variants as &$vv) {
      if (isset($vv['attributes']) && $vv['attributes'] !== null) {
        $decoded = json_decode($vv['attributes'], true);
        $vv['attributes'] = is_array($decoded) ? $decoded : [];
      } else {
        $vv['attributes'] = [];
      }
    }
    unset($vv);
    $product['variants'] = $variants;

    respond(["ok" => true, "product" => $product]);
  }

  if ($action === "create") {
    $data = inputBody();
    $name = trim((string)($data["name"] ?? ""));
    $price = (float)($data["price_usd"] ?? 0);
    if ($name === "" || $price <= 0) {
      respond(["ok" => false, "error" => "MISSING_FIELDS"], 422);
    }

    $categoryId = isset($data["category_id"]) ? (int)$data["category_id"] : null;
    $desc = trim((string)($data["description"] ?? ""));
    $material = $data["material"] ?? "other";
    $karat = trim((string)($data["karat"] ?? ""));
    $weight = isset($data["weight"]) ? (float)$data["weight"] : null;
    $stock = max(0, (int)($data["stock"] ?? 0));
    $isActive = isset($data["is_active"]) ? (int)(bool)$data["is_active"] : 1;
    $images = parseImages($data["images"] ?? []);

    $ins = $pdo->prepare("
      INSERT INTO products (category_id, name, description, material, karat, weight, price_usd, stock, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $ins->execute([
      $categoryId ?: null,
      $name,
      $desc === "" ? null : $desc,
      $material ?: "other",
      $karat === "" ? null : $karat,
      $weight,
      $price,
      $stock,
      $isActive
    ]);
    $pid = (int)$pdo->lastInsertId();

    if ($images) {
      $imgStmt = $pdo->prepare("INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)");
      foreach ($images as $idx => $img) {
        $imgStmt->execute([$pid, $img, $idx]);
      }
    }

    // variants
    $variants = parseVariants($data['variants'] ?? []);
    if ($variants) {
      $vstmt = $pdo->prepare("INSERT INTO product_variants (product_id, sku, title, price_usd, stock, attributes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
      foreach ($variants as $v) {
        $attrs = $v['attributes'] ? json_encode($v['attributes'], JSON_UNESCAPED_UNICODE) : null;
        $vstmt->execute([$pid, $v['sku'], $v['title'], $v['price_usd'], $v['stock'], $attrs, $v['is_active']]);
      }
    }

    respond(["ok" => true, "product_id" => $pid]);
  }

  if ($action === "update") {
    $data = inputBody() + $_REQUEST;
    $id = (int)($data["id"] ?? 0);
    if ($id <= 0) { respond(["ok" => false, "error" => "INVALID_ID"], 422); }

    $allowed = [
      "category_id" => "int",
      "name" => "str",
      "description" => "str",
      "material" => "str",
      "karat" => "str",
      "weight" => "float",
      "price_usd" => "float",
      "stock" => "int",
      "is_active" => "bool",
    ];
    $sets = [];
    $params = [];
    foreach ($allowed as $key => $type) {
      if (!array_key_exists($key, $data)) continue;
      $val = $data[$key];
      if ($type === "int") $val = (int)$val;
      if ($type === "float") $val = (float)$val;
      if ($type === "bool") $val = (int)(bool)$val;
      $sets[] = "{$key}=?";
      $params[] = ($val === "" ? null : $val);
    }

    if (!$sets) {
      respond(["ok" => false, "error" => "NO_FIELDS"], 422);
    }

    $params[] = $id;
    $sql = "UPDATE products SET " . implode(", ", $sets) . " WHERE id=?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if (isset($data["images"])) {
      $images = parseImages($data["images"]);
      $pdo->prepare("DELETE FROM product_images WHERE product_id=?")->execute([$id]);
      if ($images) {
        $imgStmt = $pdo->prepare("INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)");
        foreach ($images as $idx => $img) {
          $imgStmt->execute([$id, $img, $idx]);
        }
      }
    }

    // variants
    if (isset($data['variants'])) {
      $variants = parseVariants($data['variants']);
      // remove old
      $pdo->prepare("DELETE FROM product_variants WHERE product_id=?")->execute([$id]);
      if ($variants) {
        $vstmt = $pdo->prepare("INSERT INTO product_variants (product_id, sku, title, price_usd, stock, attributes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
        foreach ($variants as $v) {
          $attrs = $v['attributes'] ? json_encode($v['attributes'], JSON_UNESCAPED_UNICODE) : null;
          $vstmt->execute([$id, $v['sku'], $v['title'], $v['price_usd'], $v['stock'], $attrs, $v['is_active']]);
        }
      }
    }

    respond(["ok" => true, "updated_id" => $id]);
  }

  if ($action === "delete") {
    $id = (int)($_REQUEST["id"] ?? 0);
    if ($id <= 0) { respond(["ok" => false, "error" => "INVALID_ID"], 422); }

    $del = $pdo->prepare("DELETE FROM products WHERE id=?");
    $del->execute([$id]);
    if ($del->rowCount() === 0) {
      respond(["ok" => false, "error" => "NOT_FOUND"], 404);
    }
    respond(["ok" => true, "deleted_id" => $id]);
  }

  respond(["ok" => false, "error" => "UNKNOWN_ACTION"], 400);
} catch (Throwable $e) {
  respond(["ok" => false, "error" => "SERVER_ERROR"], 500);
}
