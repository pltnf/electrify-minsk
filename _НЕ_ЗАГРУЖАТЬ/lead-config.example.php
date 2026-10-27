<?php
// Настройки отправки заявок в Telegram для lead.php. Это шаблон (лежит в git). Рабочая копия — lead-config.php в корне сайта:
// она загружается на хостинг рядом с lead.php, в git не попадает и по прямой ссылке не открывается.
// bot_token — токен бота от @BotFather (бот должен состоять в группе);
// chat_id — id группы; mention — ники в Telegram без @, их отметит в каждой заявке (можно убрать).
$route = ['site' => 'electrify.minsk', 'bot_token' => 'ВСТАВЬТЕ_ТОКЕН_БОТА', 'chat_id' => '-100XXXXXXXXXX',
          'mention' => ['username1', 'username2']];

return [
    'routes' => [
        'https://electrifyminsk.by' => $route,
        'https://www.electrifyminsk.by' => $route,
    ],
];
