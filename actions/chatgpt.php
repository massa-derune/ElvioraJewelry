<?php
header("Content-Type: application/json; charset=utf-8");
session_start();

require_once __DIR__ . "/../config/openai.php";

$body = json_decode(file_get_contents("php://input"), true);
$msg = trim($body["message"] ?? "");
if ($msg === "") { http_response_code(422); echo json_encode(["ok"=>false,"error"=>"EMPTY"]); exit; }

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
    require_once __DIR__ . "/../config/db.php";
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
    require_once __DIR__ . "/../config/db.php";
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
      echo json_encode(["ok" => true, "reply" => "الأكثر مبيعاً حالياً: {$row['name']} (السعر: {$price}$)"]);
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
    require_once __DIR__ . "/../config/db.php";
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
      echo json_encode(["ok" => true, "reply" => "الأكثر تقييماً: {$row['name']} بعدد {$row['review_count']} تقييم (السعر: {$price}$)."]);
      exit;
    }
    echo json_encode(["ok" => true, "reply" => "لا توجد تقييمات كافية حالياً."]);
    exit;
  } catch (Throwable $e) {
    // ignore and continue
  }
}

if (contains_any($normalized, ["ماذا يقدم المتجر", "ماذا يقدم متجرنا", "ماهي خدماتكم", "ماهي الخدمات", "الخدمات الاضافيه", "الخدمات الاضافية", "مميزات المتجر", "ميزات المتجر", "لماذا نختار", "ليش نختار", "لماذا نختاركم", "لماذا نختار متجر", "افضلية المتجر"])) {
  echo json_encode(["ok" => true, "reply" => "نقدم مجوهرات ذهب وفضة وألماس بتصاميم متنوعة، مع تغليف هدايا أنيق، وصيانة وتنظيف دوري لبعض القطع، وتجربة افتراضية بالكاميرا لبعض المنتجات. لدينا شحن موثوق، ودفع مرن، وخدمة عملاء سريعة."]);
  exit;
}

if (contains_any($normalized, ["كاميرا", "تجربه بالكاميرا", "تجربة بالكاميرا", "جرّبي بالكاميرا", "جربي بالكاميرا", "try on"])) {
  echo json_encode(["ok" => true, "reply" => "ميزة التجربة بالكاميرا تساعدك تشوفي القطعة بشكل تقريبي قبل الشراء. افتحي صفحة المنتج واضغطي زر (جرّبي بالكاميرا) إن كان متاحاً للقطعة."]);
  exit;
}

if (contains_any($normalized, ["تغليف", "تغليف الهدايا", "تغليف هدايا", "تغليف فاخر"])) {
  echo json_encode(["ok" => true, "reply" => "نوفر تغليف هدايا أنيق وآمن يحافظ على القطعة ويجعلها مناسبة للإهداء."]);
  exit;
}

if (contains_any($normalized, ["صيانة", "تنظيف", "تلميع", "polish"])) {
  echo json_encode(["ok" => true, "reply" => "نوفر خدمات صيانة وتنظيف لبعض القطع للمحافظة على لمعانها وجودتها. أخبرني عن القطعة لنوجهك للخدمة المناسبة."]);
  exit;
}

if (contains_any($normalized, ["توصيل", "شحن", "مدة التوصيل", "الشحن", "التوصيل"])) {
  echo json_encode(["ok" => true, "reply" => "التوصيل عادة خلال 2-4 أيام عمل داخل سوريا حسب المنطقة. إذا حابة/حاب تفاصيل أكثر أخبرني بالمدينة."]);
  exit;
}

if (contains_any($normalized, ["استبدال", "ارجاع", "إرجاع", "سياسة الاسترجاع", "سياسة الاستبدال"])) {
  echo json_encode(["ok" => true, "reply" => "يمكنك طلب الاستبدال أو الإرجاع خلال فترة محددة إذا كانت القطعة بحالتها الأصلية. أخبرني بالطلب لأساعدك بالإجراء."]);
  exit;
}

if (contains_any($normalized, ["الدفع", "طرق الدفع", "طريقة الدفع", "كاش", "عند الاستلام", "بطاقة", "تحويل"])) {
  echo json_encode(["ok" => true, "reply" => "نوفر الدفع عند الاستلام داخل سوريا، ويمكن توفير طرق أخرى حسب الطلب."]);
  exit;
}

if (contains_any($normalized, ["تواصل", "رقم", "واتساب", "whatsapp", "الايميل", "البريد", "اتصال"])) {
  echo json_encode(["ok" => true, "reply" => "يمكنك التواصل معنا عبر الهاتف/واتساب: 09998841365 أو البريد: info@ElvioraJewelry.com"]);
  exit;
}

$shouldSearch = mb_strlen($normalized, "UTF-8") >= 4 && contains_any($normalized, ["خاتم", "خواتم", "سوار", "اسواره", "اسوره", "قلاده", "قلادة", "عقد", "حلق", "اقراط", "أقراط", "تعليقه", "تعليقة", "طقم", "ساعة", "سبائك", "سبيكة"]);
if ($shouldSearch) {
  try {
    require_once __DIR__ . "/../config/db.php";
    $term = "%" . $msg . "%";
    $st = $pdo->prepare("SELECT name, price_usd FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY id DESC LIMIT 3");
    $st->execute([$term, $term]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    if ($rows) {
      $lines = array_map("format_product_line", $rows);
      echo json_encode(["ok" => true, "reply" => "هذه منتجات قريبة من طلبك:\n" . implode("\n", $lines) . "\nتحب/ي ترشيحات إضافية؟"]);
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
    require_once __DIR__ . "/../config/db.php";
    $reply = recommend_products($pdo, $material, $label);
    if ($reply) {
      echo json_encode(["ok" => true, "reply" => $reply]);
      exit;
    }
  } catch (Throwable $e) {
    // ignore and continue
  }
}

function callOpenAI(string $prompt): array {
  $payload = [
    "model" => OPENAI_API_MODEL,
    "messages" => [
      ["role" => "system", "content" => "You are a helpful assistant for an online jewelry store (Elviora). Answer in Arabic. If asked about products, shipping, payment, or contact info, be concise."],
      ["role" => "user", "content" => $prompt],
    ],
    "temperature" => 0.4,
    "max_tokens" => 350,
  ];

  $ch = curl_init(OPENAI_API_URL);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      "Content-Type: application/json",
      "Authorization: Bearer " . OPENAI_API_KEY,
    ],
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 15,
  ]);
  $resp = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);

  if ($resp === false || $httpCode >= 400) {
    throw new Exception("OpenAI error: " . ($err ?: $resp));
  }
  $data = json_decode($resp, true);
  $text = $data["choices"][0]["message"]["content"] ?? "";
  if (trim($text) === "") throw new Exception("Empty response from OpenAI");
  return [$text, $data];
}

try {
  [$reply, $raw] = callOpenAI($msg);
  $userId = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : null;
  try {
    require_once __DIR__ . "/../config/db.php";
    $ins = $pdo->prepare("INSERT INTO chatbot_logs (user_id, message, reply) VALUES (?, ?, ?)");
    $ins->execute([$userId, $msg, $reply]);
  } catch (Throwable $e) {
    // ignore logging failures
  }
  echo json_encode(["ok"=>true,"reply"=>$reply]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"OPENAI_FAILED","message"=>$e->getMessage()]);
}
