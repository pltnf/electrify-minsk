<?php
// Приём заявок с формы сайта и отправка в группу Telegram.
// Лежит в корне сайта, форма шлёт сюда JSON: /lead.php
// Токен бота хранится в lead-config.php рядом (на сервере; в git не попадает, см. .gitignore).

ini_set('display_errors', '0');

function fail($code) { http_response_code($code); exit; }
// Боту отвечаем «успехом», чтобы он не понял, что его отсеяли
function fakeOk() { header('Content-Type: application/json'); echo '{"ok":true}'; exit; }

$configFile = __DIR__ . '/lead-config.php';
if (!is_file($configFile)) { fail(500); }
$config = require $configFile;
$apiBase = isset($config['api_base']) ? $config['api_base'] : 'https://api.telegram.org';

// Маршруты: адрес сайта => бот, группа и название сайта (оно попадёт в заголовок сообщения)
$routes = isset($config['routes']) ? $config['routes'] : [];

// Проверка Origin отсекает чужие сайты в браузере. От прямых запросов (curl) она не защищает:
// для этого ниже лимиты и серверная проверка honeypot и времени заполнения.
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$candidates = [$origin];
if ($origin === '' && !empty($_SERVER['HTTP_HOST'])) {
    $candidates = ['https://' . $_SERVER['HTTP_HOST'], 'http://' . $_SERVER['HTTP_HOST']];
}
$route = null;
foreach ($candidates as $c) {
    if ($c !== '' && isset($routes[$c])) { $origin = $c; $route = $routes[$c]; break; }
}
$originOk = $route !== null;
if ($originOk) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { fail($originOk ? 204 : 403); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !$originOk) { fail(403); }

// IP посетителя. Если хостинг стоит за своим прокси, REMOTE_ADDR будет внутренним адресом
// прокси, а настоящий IP — последним в X-Forwarded-For (его дописывает сам прокси).
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'x';
$isPublic = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
if (!$isPublic && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $chain = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
    $last = end($chain);
    if (filter_var($last, FILTER_VALIDATE_IP)) { $ip = $last; }
}

// Лимиты: не больше 5 заявок в час с одного IP и не больше 60 в час на сайт.
// Счётчики лежат в папке _lead_ratelimit рядом со скриптом (закрыта .htaccess), иначе во временной папке.
$rlDir = __DIR__ . '/_lead_ratelimit';
if (!is_dir($rlDir)) { @mkdir($rlDir, 0700); }
if (!is_dir($rlDir) || !is_writable($rlDir)) { $rlDir = sys_get_temp_dir(); }

function hit($file, $limit, $now) {
    $fh = @fopen($file, 'c+');
    if (!$fh) { return true; }
    flock($fh, LOCK_EX);
    $hits = array_filter(array_map('intval', explode(',', (string) stream_get_contents($fh))), function ($t) use ($now) {
        return $now - $t < 3600;
    });
    $ok = count($hits) < $limit;
    if ($ok) {
        $hits[] = $now;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, implode(',', $hits));
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $ok;
}
$now = time();
if (!hit($rlDir . '/lead_rl_' . md5($ip . $origin), 5, $now)) { fail(429); }
if (!hit($rlDir . '/lead_rl_site_' . md5($route['site']), 60, $now)) { fail(429); }

$raw = file_get_contents('php://input', false, null, 0, 20000);
$d = json_decode($raw, true);
if (!is_array($d) || empty($d['fields']) || !is_array($d['fields']) || empty($d['consent'])) { fail(400); }

// Honeypot и время заполнения формы: живой человек не заполняет скрытое поле
// и не отправляет форму быстрее чем за 1,5 секунды
if (!empty($d['hp']) || !isset($d['t']) || (int) $d['t'] < 1500) { fakeOk(); }

$lines = ['Новая заявка с сайта ' . $route['site']];
// Отметки ответственных (@username): они получат уведомление по каждой заявке
if (!empty($route['mention']) && is_array($route['mention'])) {
    $tags = [];
    foreach ($route['mention'] as $u) {
        $u = '@' . ltrim((string) $u, '@');
        if (preg_match('/^@[A-Za-z0-9_]{3,32}$/', $u)) { $tags[] = $u; }
    }
    if ($tags) { $lines[] = implode(' ', $tags); }
}
$lines[] = '';
foreach (array_slice($d['fields'], 0, 12) as $f) {
    if (!is_array($f) || !isset($f['label'], $f['value'])) { continue; }
    $lines[] = mb_substr((string) $f['label'], 0, 60) . ': ' . mb_substr((string) $f['value'], 0, 1500);
}
$lines[] = '';
$lines[] = 'Согласие на обработку ПД: да';
$lines[] = 'Страница: ' . mb_substr((string) (isset($d['page']) ? $d['page'] : ''), 0, 120);
$lines[] = mb_substr((string) (isset($d['url']) ? $d['url'] : ''), 0, 200);

$payload = http_build_query([
    'chat_id' => $route['chat_id'],
    'text' => mb_substr(implode("\n", $lines), 0, 4000),
    'disable_web_page_preview' => 'true',
]);
$url = $apiBase . '/bot' . $route['bot_token'] . '/sendMessage';

$ok = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $res = curl_exec($ch);
    $ok = $res !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
} else {
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $payload, 'timeout' => 10, 'ignore_errors' => true,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    $ok = $res !== false && strpos($res, '"ok":true') !== false;
}

if (!$ok) { fail(502); }
header('Content-Type: application/json');
echo '{"ok":true}';
