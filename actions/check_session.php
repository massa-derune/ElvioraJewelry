<?php
header("Content-Type: application/json; charset=utf-8");
session_start();

if (isset($_SESSION['user_id'])) {
  echo json_encode([
    "ok" => true,
    "logged_in" => true,
    "user_id" => (int)$_SESSION['user_id'],
    "name" => $_SESSION['user_name'] ?? '',
    "email" => $_SESSION['user_email'] ?? ''
  ]);
} else {
  echo json_encode([
    "ok" => true,
    "logged_in" => false
  ]);
}
