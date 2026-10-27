# Detector Air Raid — Frontend

![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![jQuery](https://img.shields.io/badge/jQuery-3.7.1-0769AD?logo=jquery&logoColor=white)

> Клієнтська частина проєкту **Detector Air Raid**: показує, як працюють Дія,
> Укрзалізниця, monobank і Приват24, а також відключення світла та інциденти в Києві.

Бекенд (Django REST API): [Prokopiuk-Marta/detector-air-raid](https://github.com/Prokopiuk-Marta/detector-air-raid)

---

## Що є на сторінці

- **Картки сервісів**: поточний стан, час відповіді, доступність за 7 днів.
- **Плашка світла**: які групи в Києві зараз без світла.
- **Активні інциденти** з посиланням на джерело.
- **Останні відключення світла** за групами.
- Автоматичне оновлення даних щохвилини та зрозуміле повідомлення, якщо бекенд недоступний.

Сторінка отримує всі дані з API бекенду через AJAX-запити (jQuery).

---

## Адреси та порти

| Частина | Адреса |
| --- | --- |
| Фронтенд | http://localhost:3000 |
| Бекенд (API) | http://127.0.0.1:8000/api/v1/ |

Фронтенд і бекенд працюють на **різних портах**, тому на бекенді налаштовано CORS:
адреси `http://localhost:3000` і `http://127.0.0.1:3000` додано до `CORS_ALLOWED_ORIGINS`
у `config/settings.py`.

Адреса API задається на початку `app.js` у змінній `API_BASE`.

---

## Як запустити проєкт

Потрібен Python 3 (для простого локального сервера) і запущений бекенд.

1. **Запустити бекенд** за інструкцією в
   [його README](https://github.com/Prokopiuk-Marta/detector-air-raid). Коротко:

   ```bash
   cd detector-air-raid
   python manage.py migrate
   python manage.py runserver
   ```

   Бекенд запуститься на http://127.0.0.1:8000.

2. **В окремому терміналі запустити фронтенд:**

   ```bash
   cd detector-air-raid-frontend
   python -m http.server 3000
   ```

3. **Відкрити** http://localhost:3000 у браузері.

> [!NOTE]
> Відкривати `index.html` подвійним кліком (адреса `file://...`) не варто: браузер
> блокуватиме запити до API, бо такий origin не дозволено в CORS.

---

## Структура

```
├── index.html             розмітка сторінки
├── style.css              стилі (темна тема)
├── app.js                 запити до API та відображення даних
└── assets/
    └── background.jpg     фон із картою України
```

---

## Авторство

Контур карти України на фоні створено на основі карти
[MapSVG](https://mapsvg.com/maps/ukraine) (через пакет
[@svg-maps/ukraine](https://www.npmjs.com/package/@svg-maps/ukraine)) за ліцензією
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Зображення змінено: додано
підсвітку, кольори та міський пейзаж.