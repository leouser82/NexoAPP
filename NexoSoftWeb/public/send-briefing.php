<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'method']);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
  $data = $_POST;
}

function clean_header($value) {
  return trim(str_replace(["\r", "\n"], '', (string) $value));
}

$name = clean_header($data['name'] ?? '');
$email = clean_header($data['email'] ?? '');
$need = clean_header($data['need'] ?? '');
$message = trim((string) ($data['message'] ?? ''));

if ($name === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid']);
  exit;
}

$to = 'leonexo@nexosoft.site';
$subject = 'Briefing: ' . ($need !== '' ? $need : 'Consulta') . ' — ' . $name;
$body = "Nombre: {$name}\nEmail: {$email}\nServicio: {$need}\n\n{$message}\n";
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$headers = implode("\r\n", [
  'From: NexoSoft <noreply@nexosoft.site>',
  'Reply-To: ' . $email,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
]);

$sent = mail($to, $encodedSubject, $body, $headers);

if (!$sent) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'mail']);
  exit;
}

echo json_encode(['ok' => true]);
