# 🌲 Astra - Волшебное дерево

Telegram Mini App — игра "Найди артефакты" в стиле Samorost.

## 🎮 Описание

Приключение в волшебном лесу. Найди 5 скрытых артефактов, чтобы открыть портал!

## 📁 Структура

```
astraway/
├── index.html          # Главная страница
├── style.css           # Стили и анимации
├── script.js           # Логика игры
├── assets/
│   ├── background.jpg   # Фон (волшебное дерево)
│   └── objects/         # Папка для объектов
└── README.md
```

## 🚀 Установка в Telegram

1. Открой @BotFather
2. Создай/отредактируй бота @Astrajoybot
3. Отправь: `/setmenu`
4. Выбери бота
5. Укажи URL: `https://v5t9bd7958-sketch.github.io/astraway/`
6. Готово!

## 🎨 Замена фона

Замени `assets/background.jpg` на свой фон.
Объекты позиционируются в процентах — адаптируются под любой размер.

## 🎭 Замена персонажа

Персонаж сделан на CSS. Для замены на Rive/Spine:
1. Экспортируй `.riv` или `.json`
2. Замени `#troll` div на canvas
3. Подключи Rive runtime

## 📱 Тестирование

Открой `index.html` в Safari на iPhone 16 Pro Max.

## 🔧 GitHub Pages

1. Зайди в Settings → Pages
2. Source: Deploy from branch
3. Branch: main / root
4. Сохрани — игра доступна по URL
