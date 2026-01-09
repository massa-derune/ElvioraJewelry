<?php
// Unified auth endpoint: register | login | logout
header("Content-Type: application/json; charset=utf-8");
session_start();
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"METHOD_NOT_ALLOWED"]);
  exit;
}

$action = $_POST['action'] ?? '';
$legacy = isset($_GET['legacy']) && $_GET['legacy'] == '1';

function legacy_or_json($ok, $legacyText, $payload) {
  global $legacy;
  if ($legacy) {
    header("Content-Type: text/plain; charset=utf-8");
    echo $legacyText;
  } else {
    echo json_encode($payload);
  }
  exit;
}

if ($action === 'register') {
  $name = trim($_POST['name'] ?? '');
  $email = trim($_POST['email'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($name === '' || $email === '' || $password === '') {
    http_response_code(422);
    legacy_or_json(false, "REGISTER_FAILED", ["ok"=>false,"error"=>"MISSING_FIELDS"]);
  }

  $stmt = $pdo->prepare("SELECT id FROM users WHERE email=? LIMIT 1");
  $stmt->execute([$email]);
  if ($stmt->fetch()) {
    http_response_code(409);
    legacy_or_json(false, "REGISTER_FAILED", ["ok"=>false,"error"=>"EMAIL_EXISTS"]);
  }

  $hash = password_hash($password, PASSWORD_BCRYPT);
  $ins = $pdo->prepare("INSERT INTO users (name,email,password) VALUES (?,?,?)");
  $ins->execute([$name,$email,$hash]);
  $uid = (int)$pdo->lastInsertId();

  $_SESSION['user_id'] = $uid;
  $_SESSION['user_name'] = $name;
  $_SESSION['user_email'] = $email;

  legacy_or_json(true, "REGISTER_SUCCESS", ["ok"=>true,"user"=>["id"=>$uid,"name"=>$name,"email"=>$email]]);
}

if ($action === 'login') {
  $email = trim($_POST['email'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($email === '' || $password === '') {
    http_response_code(422);
    legacy_or_json(false, "LOGIN_FAILED", ["ok"=>false,"error"=>"MISSING_FIELDS"]);
  }

  $stmt = $pdo->prepare("SELECT id,name,email,password FROM users WHERE email=? LIMIT 1");
  $stmt->execute([$email]);
  $user = $stmt->fetch();

  if (!$user || !password_verify($password, $user['password'])) {
    http_response_code(401);
    legacy_or_json(false, "LOGIN_FAILED", ["ok"=>false,"error"=>"INVALID_CREDENTIALS"]);
  }

  $_SESSION['user_id'] = (int)$user['id'];
  $_SESSION['user_name'] = $user['name'];
  $_SESSION['user_email'] = $user['email'];

  legacy_or_json(true, "LOGIN_SUCCESS", ["ok"=>true,"user"=>["id"=>(int)$user['id'],"name"=>$user['name'],"email"=>$user['email']]]);
}

if ($action === 'logout') {
  session_destroy();
  legacy_or_json(true, "LOGOUT_SUCCESS", ["ok"=>true]);
}

http_response_code(400);
legacy_or_json(false, "UNKNOWN_ACTION", ["ok"=>false,"error"=>"UNKNOWN_ACTION"]);
