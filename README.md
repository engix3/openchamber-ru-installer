# Русский перевод OpenChamber Desktop

Форк [`kotobarsik/openchamber-ru-installer`](https://github.com/kotobarsik/openchamber-ru-installer) с упрощённым обновлением русского перевода для OpenChamber Desktop на Windows.

## Быстрый старт

1. Установите OpenChamber Desktop из [официальных релизов](https://github.com/openchamber/openchamber/releases).
2. Скачайте этот репозиторий через **Code → Download ZIP**.
3. Полностью закройте OpenChamber через значок в трее → **Quit**.
4. Запустите `install-translation.cmd`.
5. Запустите OpenChamber и выберите **Settings → Appearance → Language → Russian**.

Обычно путь к OpenChamber определяется автоматически. Если это не сработало, передайте его первым аргументом:

```cmd
install-translation.cmd "C:\Users\Имя\AppData\Local\Programs\@openchamberelectron"
```

## После обновления

Официальное обновление OpenChamber заменяет файлы интерфейса. После него:

1. Полностью закройте OpenChamber.
2. Запустите `update-translation.cmd`.
3. Запустите OpenChamber снова.

Команда сама найдёт текущую установку и заново применит перевод:

```cmd
update-translation.cmd
```

Если появились новые пункты интерфейса, обновите словари командой `update-translation.ps1`. Она проверит текущую версию OpenChamber и найдёт отсутствующие ключи. Для автоматического перевода новых строк потребуется LibreTranslate-совместимый сервис:

```powershell
.\scripts\update-translation.ps1 -TranslatorEndpoint "https://your-translator.example/translate" -ApiKey "your-api-key"
```

После этого снова запустите `update-translation.cmd`.

## Linux / серверная версия (OpenChamber Web)

Для пакета `@openchamber/web` (интерфейс в браузере) перевод применяется прямо к собранным файлам установленного пакета.

Порядок:

1. Установите OpenChamber: `npm install -g @openchamber/web`.
2. Скопируйте этот репозиторий на сервер, например в `/opt/openchamber-ru` (путь можно переопределить переменной `OCRU_ROOT`).
3. Примените перевод: `node port.js`.

   Скрипт соберёт русский чанк из `i18n/messages/*` и `extra.json`, положит его в `dist/assets` установленного пакета, пропатчит загрузчик (список локалей, метка языка, автоопределение, импорт чанка, принудительный «ru») и оставит резервные копии `*.ru-bak`. После каждого обновления `@openchamber/web` просто повторите `node port.js`.

Когда в новой версии появляются новые строки:

1. Получите английские словари нужного тега:

   ```bash
   git clone --depth 1 --branch vX.Y.Z --filter=blob:none --sparse https://github.com/openchamber/openchamber.git oc-src
   cd oc-src && git sparse-checkout set packages/ui/src/lib/i18n
   ```

2. Найдите недостающие ключи:

   ```bash
   node diff-missing.js /путь/oc-src/packages/ui/src/lib/i18n/messages . missing-X.Y.Z.json
   ```

3. Переведите и домешайте результат в `extra.json`:

   ```bash
   OPENCHAMBER_TRANSLATOR_KEY=... node translate.js missing-X.Y.Z.json extra.json
   ```

   Скрипт переводит значения пакетами, проверяет сохранность плейсхолдеров `{...}` и добавляет переводы в `extra.json`, не затирая существующие.

4. Снова примените: `node port.js`.

Ключ перевода храните в переменной `OPENCHAMBER_TRANSLATOR_KEY` или в некоммитируемом `translate.local.js` (`module.exports = { key: '...', url: '...' }`).

## Удаление

Полностью закройте OpenChamber и запустите `uninstall-translation.cmd`. Оригинальные файлы будут восстановлены из резервных копий, а русский чанк удалён.

## Файлы

- `install-translation.cmd` — установить перевод.
- `update-translation.cmd` — повторно применить перевод после обновления OpenChamber.
- `uninstall-translation.cmd` — удалить перевод.
- `scripts/` — внутренние PowerShell-скрипты; обычно запускать их напрямую не требуется.
- `i18n/messages/` — исходные русские словари.
- `port.js` — применить перевод к установленному `@openchamber/web` на Linux (серверный вариант).
- `translate.js` — пакетный перевод новых строк через OpenAI-совместимый endpoint.
- `diff-missing.js` — сравнить английские словари OpenChamber с русским и вывести недостающие ключи.
- `extra.json` — накопленные переводы поверх `i18n/messages` (используются `port.js`).

Текущие словари содержат около `5669` ключей и ориентированы на интерфейс OpenChamber 1.22.2.

## Ограничения

- Для Windows предназначен установщик Desktop (PowerShell-скрипты); для Linux-сервера есть `port.js` — см. раздел «Linux / серверная версия».
- При изменении структуры собранного JavaScript установщик может не найти нужные участки. В таком случае он выведет предупреждение и сохранит резервные копии.
- Короткие стартовые сообщения приложения могут оставаться на английском.
- Машинный перевод новых строк требует внешнего LibreTranslate-совместимого API.

## Примечание о форке

Этот репозиторий является форком оригинального проекта [`kotobarsik/openchamber-ru-installer`](https://github.com/kotobarsik/openchamber-ru-installer). Изменения в форке направлены на более простую повторную установку перевода после обновлений OpenChamber и автоматическое определение версии словарей.

Часть обновлений словарей и защитных улучшений патчера перенесена из открытого [PR #1](https://github.com/kotobarsik/openchamber-ru-installer/pull/1) автора [hays0503](https://github.com/hays0503): покрытие новых ключей OpenChamber 1.22.1, проверка результата патчинга, откат при ошибке, определение версии приложения и безопасное удаление перевода.

Ключи, добавленные в OpenChamber 1.22.2, переведены в этом форке вручную.
