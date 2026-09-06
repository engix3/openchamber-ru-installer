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

## Удаление

Полностью закройте OpenChamber и запустите `uninstall-translation.cmd`. Оригинальные файлы будут восстановлены из резервных копий, а русский чанк удалён.

## Файлы

- `install-translation.cmd` — установить перевод.
- `update-translation.cmd` — повторно применить перевод после обновления OpenChamber.
- `uninstall-translation.cmd` — удалить перевод.
- `scripts/` — внутренние PowerShell-скрипты; обычно запускать их напрямую не требуется.
- `i18n/messages/` — исходные русские словари.

## Ограничения

- Перевод предназначен для OpenChamber Desktop на Windows.
- При изменении структуры собранного JavaScript установщик может не найти нужные участки. В таком случае он выведет предупреждение и сохранит резервные копии.
- Короткие стартовые сообщения приложения могут оставаться на английском.
- Машинный перевод новых строк требует внешнего LibreTranslate-совместимого API.

## Примечание о форке

Этот репозиторий является форком оригинального проекта [`kotobarsik/openchamber-ru-installer`](https://github.com/kotobarsik/openchamber-ru-installer). Изменения в форке направлены на более простую повторную установку перевода после обновлений OpenChamber и автоматическое определение версии словарей.
