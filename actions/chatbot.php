<?php
header("Content-Type: application/json; charset=utf-8");
session_start();
require_once __DIR__ . "/../config/db.php";

$body = json_decode(file_get_contents("php://input"), true);
$msg = trim($body["message"] ?? "");
if ($msg === "") {
  http_response_code(422);
  echo json_encode(["ok" => false, "error" => "EMPTY"]);
  exit;
}

function normalize_arabic(string $text): string {
  $text = mb_strtolower($text, "UTF-8");
  $text = str_replace(["أ", "إ", "آ"], "ا", $text);
  $text = str_replace(["ة"], "ه", $text);
  $text = str_replace(["ى"], "ي", $text);
  $text = str_replace(["ؤ"], "و", $text);
  $text = str_replace(["ئ"], "ي", $text);
  $text = str_replace(["ـ"], "", $text);
  $text = preg_replace("/[^\\p{Arabic}0-9\\s]/u", " ", $text);
  $text = preg_replace("/\\s+/", " ", $text);
  return trim($text);
}

function contains_any(string $text, array $keywords): bool {
  foreach ($keywords as $keyword) {
    $needle = normalize_arabic($keyword);
    if ($needle !== "" && mb_strpos($text, $needle) !== false) {
      return true;
    }
  }
  return false;
}

function format_product_line(array $row): string {
  $price = number_format((float)$row["price_usd"], 2);
  return "- {$row['name']} (السعر: {$price}$)";
}

function recommend_products(PDO $pdo, string $material, string $label): ?string {
  $stmt = $pdo->prepare("
    SELECT name, price_usd
    FROM products
    WHERE is_active = 1 AND material = ?
    ORDER BY RAND()
    LIMIT 3
  ");
  $stmt->execute([$material]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  if (!$rows) {
    return null;
  }
  $lines = array_map("format_product_line", $rows);
  return "هذه ترشيحات {$label} مناسبة لك:\n" . implode("\n", $lines) . "\nتحب/ي أعرض لك خيارات أكثر؟";
}

$normalized = normalize_arabic($msg);

$hasGold = contains_any($normalized, ["ذهب", "ذهبي"]);
$hasSilver = contains_any($normalized, ["فضه", "فضة", "فضي"]);
$hasDiamond = contains_any($normalized, ["الماس", "ماس", "ألماس"]);

$routeMap = [
  ["keywords" => ["حلق", "اقراط", "أقراط", "سلاسل", "قلاده", "قلادة", "عقد", "اطواق", "اطواق", "اساور", "اسوره", "اسواره"], "title" => "الاكسسوارات", "url" => "Collar_earr_brac.html"],
  ["keywords" => ["خاتم", "خواتم", "دبله", "دبلة", "محبس"], "title" => "الخواتم", "url" => "Rings.html"],
  ["keywords" => ["طقم", "اطقم", "أطقم"], "title" => "الاطقم", "url" => "set.html"],
  ["keywords" => ["منوع", "متنوع", "متنوعات", "سبائك", "سبيكه", "سبيكة", "ساعه", "ساعة"], "title" => "المنوع", "url" => "diversified.html"],
];

$defaultReply = "أهلاً بك! كيف أقدر أساعدك اليوم؟";

if (contains_any($normalized, ["على ذوقك", "اقترح", "اقتراح", "اختيارك", "اختار لي", "اختاري لي", "ذوقك"])) {
  $_SESSION["chat_pref_pending"] = true;
  echo json_encode(["ok" => true, "reply" => "أقترح لك تصميم أنيق يناسب كل الإطلالات. تفضّلين ذهب أم فضة أم ألماس؟"]);
  exit;
}

if (!empty($_SESSION["chat_pref_pending"]) && ($hasGold || $hasSilver || $hasDiamond)) {
  $_SESSION["chat_pref_pending"] = false;
  $material = $hasGold ? "gold" : ($hasSilver ? "silver" : "diamond");
  $label = $hasGold ? "ذهب" : ($hasSilver ? "فضة" : "ألماس");
  try {
    $reply = recommend_products($pdo, $material, $label);
    if ($reply) {
      echo json_encode(["ok" => true, "reply" => $reply]);
      exit;
    }
  } catch (Throwable $e) {
    // ignore and continue
  }
}

if (contains_any($normalized, ["اكثر منتج مبيعا", "الاكثر مبيعا", "الأكثر مبيعا", "الاكثر بيع", "الأكثر بيع", "افضل مبيع", "منتج مبيع"])) {
  try {
    $stmt = $pdo->query("
      SELECT p.name, p.price_usd, SUM(oi.qty) AS total_qty
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY p.id, p.name, p.price_usd
      ORDER BY total_qty DESC
      LIMIT 1
    ");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
      $price = number_format((float)$row["price_usd"], 2);
      $reply = "الأكثر مبيعاً حالياً: {$row['name']} (السعر: {$price}$)";
      echo json_encode(["ok" => true, "reply" => $reply]);
      exit;
    }
    echo json_encode(["ok" => true, "reply" => "لا تتوفر بيانات مبيعات كافية حالياً."]); 
    exit;
  } catch (Throwable $e) {
    // ignore and continue
  }
}

if (contains_any($normalized, ["اكثر منتج عليه اراء", "اكثر منتج عليه آراء", "الاكثر تقييما", "الأكثر تقييما", "اكثر تقييمات", "اكثر اراء", "اكبر عدد اراء", "اكثر مراجعات"])) {
  try {
    $stmt = $pdo->query("
      SELECT p.name, p.price_usd, COUNT(pr.id) AS review_count
      FROM product_reviews pr
      JOIN products p ON p.id = pr.product_id
      GROUP BY p.id, p.name, p.price_usd
      ORDER BY review_count DESC
      LIMIT 1
    ");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
      $price = number_format((float)$row["price_usd"], 2);
      $reply = "الأكثر تقييماً: {$row['name']} بعدد {$row['review_count']} تقييم (السعر: {$price}$).";
      echo json_encode(["ok" => true, "reply" => $reply]);
      exit;
    }
    echo json_encode(["ok" => true, "reply" => "لا توجد تقييمات كافية حالياً."]);
    exit;
  } catch (Throwable $e) {
    // ignore and continue
  }
}

if (contains_any($normalized, ["ماذا يقدم المتجر", "ماذا يقدم متجرنا", "ماهي خدماتكم", "ماهي الخدمات", "الخدمات الاضافيه", "الخدمات الاضافية", "مميزات المتجر", "ميزات المتجر", "لماذا نختار", "ليش نختار", "لماذا نختاركم", "لماذا نختار متجر", "افضلية المتجر"])) {
  $reply = "نقدم مجوهرات ذهب وفضة وألماس بتصاميم متنوعة، مع تغليف هدايا أنيق، وصيانة وتنظيف دوري لبعض القطع، وتجربة افتراضية بالكاميرا لبعض المنتجات. لدينا شحن موثوق، ودفع مرن، وخدمة عملاء سريعة.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["كاميرا", "تجربه بالكاميرا", "تجربة بالكاميرا", "جرّبي بالكاميرا", "جربي بالكاميرا", "try on"])) {
  $reply = "ميزة التجربة بالكاميرا تساعدك تشوفي القطعة بشكل تقريبي قبل الشراء. افتحي صفحة المنتج واضغطي زر (جرّبي بالكاميرا) إن كان متاحاً للقطعة.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["تغليف", "تغليف الهدايا", "تغليف هدايا", "تغليف فاخر"])) {
  $reply = "نوفر تغليف هدايا أنيق وآمن يحافظ على القطعة ويجعلها مناسبة للإهداء.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["صيانة", "تنظيف", "تلميع", "polish"])) {
  $reply = "نوفر خدمات صيانة وتنظيف لبعض القطع للمحافظة على لمعانها وجودتها. أخبرنا عن القطعة لنوجهك للخدمة المناسبة.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["توصيل", "شحن", "مدة التوصيل", "الشحن", "التوصيل"])) {
  $reply = "التوصيل عادة خلال 2-4 أيام عمل داخل سوريا حسب المنطقة. إذا حابة/حاب تفاصيل أكثر أخبرني بالمدينة.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["استبدال", "ارجاع", "إرجاع", "سياسة الاسترجاع", "سياسة الاستبدال"])) {
  $reply = "يمكنك طلب الاستبدال أو الإرجاع خلال فترة محددة إذا كانت القطعة بحالتها الأصلية. أخبرني بالطلب لأساعدك بالإجراء.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["الدفع", "طرق الدفع", "طريقة الدفع", "كاش", "عند الاستلام", "بطاقة", "تحويل"])) {
  $reply = "نوفر الدفع عند الاستلام داخل سوريا، ويمكن توفير طرق أخرى حسب الطلب.";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

if (contains_any($normalized, ["تواصل", "رقم", "واتساب", "whatsapp", "الايميل", "البريد", "اتصال"])) {
  $reply = "يمكنك التواصل معنا عبر الهاتف/واتساب: 09998841365 أو البريد: info@ElvioraJewelry.com";
  echo json_encode(["ok" => true, "reply" => $reply]);
  exit;
}

$shouldSearch = mb_strlen($normalized, "UTF-8") >= 4 && contains_any($normalized, ["خاتم", "خواتم", "سوار", "اسواره", "اسوره", "قلاده", "قلادة", "عقد", "حلق", "اقراط", "أقراط", "تعليقه", "تعليقة", "طقم", "ساعة", "سبائك", "سبيكة"]);

if ($shouldSearch) {
  try {
    $term = "%" . $msg . "%";
    $st = $pdo->prepare("SELECT name, price_usd FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY id DESC LIMIT 3");
    $st->execute([$term, $term]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    if ($rows) {
      $lines = array_map("format_product_line", $rows);
      $reply = "هذه منتجات قريبة من طلبك:\n" . implode("\n", $lines) . "\nتحب/ي ترشيحات إضافية؟";
      echo json_encode(["ok" => true, "reply" => $reply]);
      exit;
    }
  } catch (Throwable $e) {
    // ignore and continue
  }
}

if ($hasGold || $hasSilver || $hasDiamond) {
  $material = $hasGold ? "gold" : ($hasSilver ? "silver" : "diamond");
  $label = $hasGold ? "ذهب" : ($hasSilver ? "فضة" : "ألماس");
  try {
    $reply = recommend_products($pdo, $material, $label);
    if ($reply) {
      echo json_encode(["ok" => true, "reply" => $reply]);
      exit;
    }
  } catch (Throwable $e) {
    // ignore and continue
  }
}

foreach ($routeMap as $route) {
  if (contains_any($normalized, $route["keywords"])) {
    $reply = "تفضلي إلى قسم {$route['title']}:\n{$route['url']}";
    echo json_encode(["ok" => true, "reply" => $reply]);
    exit;
  }
}

$userId = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : null;

try {
  $ins = $pdo->prepare("INSERT INTO chatbot_logs (user_id, message, reply) VALUES (?, ?, ?)");
  $ins->execute([$userId, $msg, $defaultReply]);
} catch (Throwable $e) {
  // ignore logging failures
}

echo json_encode(["ok" => true, "reply" => $defaultReply]);
