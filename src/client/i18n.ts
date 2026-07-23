export type Locale = "en" | "ru";
export type ControlMode = "keyboard" | "touch";
export type TranslationParams = Record<string, string | number>;

const en = {
        "meta.title": "T5C - The 5th Continent | Multiplayer Browser RPG",
        "meta.description": "Play T5C, a free multiplayer 3D browser RPG. Explore Eldoria, battle enemies, complete quests, collect loot, and build your character.",
        "a11y.skip": "Skip to the game",
        "a11y.gameTitle": "T5C - The 5th Continent multiplayer browser RPG",
        "a11y.gameDescription": "Explore Eldoria, fight enemies, complete quests, collect equipment, and chat with other players.",
        "a11y.controlsTitle": "Game controls",
        "a11y.controls.keyboard": "Move with W, A, S, and D. Use the mouse to select and interact, number keys 1 through 9 for hotbar actions, Enter for chat, and letter hotkeys for game panels.",
        "a11y.controls.touch": "Move with the on-screen joystick, swipe the world to rotate the camera, tap characters and objects to interact, and tap the hotbar to use abilities.",
        "a11y.canvas": "T5C interactive 3D game",
        "a11y.canvasFallback": "T5C requires a browser with canvas and WebGL support. Open technical help for compatibility information.",
        "a11y.loadingProgress": "Game loading progress",
        "a11y.touchControls": "Touch game controls",
        "entry.eyebrow": "Player setup",
        "entry.title": "Choose your experience",
        "entry.subtitle": "Select a language and control mode before entering Eldoria.",
        "entry.language": "Language",
        "entry.controls": "Control mode",
        "entry.keyboard": "Keyboard and mouse",
        "entry.keyboardDetail": "Desktop or laptop",
        "entry.touch": "Touch screen",
        "entry.touchDetail": "Phone or tablet",
        "entry.recommended": "Recommended",
        "entry.continue": "Continue",
        "entry.remember": "Saved on this device",
        "loading.title": "Preparing Eldoria",
        "loading.starting": "Starting the game...",
        "loading.gameData": "Loading game data...",
        "loading.worldData": "Loading world data...",
        "loading.ready": "T5C is ready to play.",
        "loading.assetFailed": "Unable to load {asset}",
        "loading.navmesh": "Loading navigation data...",
        "fatal.eyebrow": "T5C could not start",
        "fatal.title": "Your adventure is paused",
        "fatal.default": "The game could not finish loading. Check your connection and reload; if the problem continues, open technical help.",
        "fatal.webgl": "This browser could not create a WebGL graphics context. Enable hardware acceleration or try a current browser and reload the game.",
        "fatal.retry": "Retry",
        "fatal.help": "Open technical help",
        "fatal.announcement": "T5C could not start. {message}",
        "login.eyebrow": "Multiplayer browser RPG",
        "login.title": "Enter Eldoria",
        "login.version": "Version {version}",
        "login.username": "Adventurer name",
        "login.password": "Password",
        "login.connect": "Connect to game",
        "login.connecting": "Connecting...",
        "login.checking": "Checking your adventurer...",
        "login.quickPlay": "Quick Play",
        "login.quickCreating": "Creating a guest adventurer...",
        "login.or": "or",
        "login.hint": "Start immediately with a generated adventurer.",
        "login.error": "Unable to connect. Please try again.",
        "login.invalid": "Unable to connect. Check your details and try again.",
        "noscript.title": "JavaScript is required",
        "noscript.body": "T5C is an interactive 3D browser game and needs JavaScript to run.",
        "character.choose": "Choose your adventurer",
        "character.signedIn": "Signed in as {name}",
        "character.signOut": "Sign out",
        "character.createAdventurer": "Create adventurer",
        "character.level": "Level: {level}",
        "character.play": "Play",
        "editor.class": "Class",
        "editor.chooseClass": "Choose class",
        "editor.face": "Face",
        "editor.chooseFace": "Choose face",
        "editor.style": "Style",
        "editor.chooseStyle": "Choose style",
        "editor.styleNumber": "Style {number}",
        "editor.face.base": "Classic",
        "editor.face.barbarian": "Barbarian",
        "editor.face.engineer": "Engineer",
        "editor.face.mage": "Mage",
        "editor.face.rogue": "Rogue",
        "editor.face.paladin": "Paladin",
        "editor.characterName": "Enter character name",
        "editor.create": "Create",
        "common.cancel": "Cancel",
        "common.back": "Back",
        "common.close": "Close",
        "common.bye": "Goodbye",
        "common.level": "Level",
        "common.system": "System",
        "menu.inventory": "Inventory",
        "menu.quests": "Quests",
        "menu.abilities": "Abilities",
        "menu.character": "Character",
        "menu.help": "Help",
        "menu.stuck": "Reset position",
        "menu.screenshot": "Take a picture",
        "menu.quit": "Leave world",
        "panel.dialog": "Dialog",
        "panel.activeQuests": "Active Quests",
        "panel.help": "Welcome to T5C",
        "chat.placeholder": "Write a message...",
        "chat.send": "Send",
        "chat.global": "[Global] {name}: ",
        "chat.youSaid": "You said: ",
        "chat.system": "[System] ",
        "chat.joined": "{name} joined the room.",
        "event.killed": "You defeated {name}.",
        "event.gold": "You picked up {amount} gold.",
        "event.levelUp": "You gained knowledge and reached level {level}.",
        "casting.start": "Casting...",
        "status.level": "Lvl {level}",
        "status.gold": "Gold: {amount}",
        "tooltip.value": "Value: {value}",
        "tooltip.damage": "Damage: {min} - {max}",
        "tooltip.cost": "Cost: {min}-{max} {resource}",
        "tooltip.cooldown": "Cooldown: {seconds}s",
        "tooltip.castTime": "Cast time: {seconds}s",
        "tooltip.instant": "Instant cast",
        "inventory.equip": "Equip item",
        "inventory.use": "Use item",
        "inventory.dropAll": "Drop stack",
        "inventory.dropOne": "Drop one",
        "inventory.sell": "Sell",
        "inventory.sellOn": "Sell: active",
        "inventory.buy": "Buy {amount}",
        "inventory.cost": "Cost: {amount}",
        "vendor.empty": "There is nothing available here right now.",
        "trainer.empty": "You have already learned everything this trainer can teach.",
        "trainer.train": "Train",
        "trainer.level": "{title} (Level {level})",
        "requirement.cost": "Cost: {amount}",
        "requirement.level": "Required level: {amount}",
        "requirement.strength": "Required strength: {amount}",
        "requirement.endurance": "Required endurance: {amount}",
        "requirement.agility": "Required agility: {amount}",
        "requirement.intelligence": "Required intelligence: {amount}",
        "requirement.wisdom": "Required wisdom: {amount}",
        "dialog.train": "Can you train me?",
        "dialog.vendor": "May I see your wares?",
        "dialog.questMarker": "Quest",
        "quest.none": "You have no active quests. Explore the world and speak with its inhabitants to discover new ones.",
        "quest.killProgress": "Defeated {completed}/{required}: {target}",
        "quest.acceptedText": "Many thanks. Complete the objective and return to me.",
        "quest.ongoingText": "Complete the objective and return to me.",
        "quest.readyText": "The objective is complete. Please accept these tokens of my gratitude.",
        "quest.completedText": "Thank you, and may the goddess Athlea watch over you.",
        "quest.complete": "Complete quest",
        "quest.accept": "Accept",
        "quest.decline": "Decline",
        "quest.completed": "Quest completed",
        "quest.accepted": "Quest accepted",
        "quest.rewardExperience": "Experience: {amount}",
        "quest.rewardGold": "Gold: {amount}",
        "quest.rewardItem": "Item: {item}",
        "character.name": "Name",
        "character.id": "ID",
        "character.race": "Race",
        "character.health": "Health",
        "character.mana": "Mana",
        "attribute.strength": "Strength",
        "attribute.endurance": "Endurance",
        "attribute.agility": "Agility",
        "attribute.intelligence": "Intelligence",
        "attribute.wisdom": "Wisdom",
        "attribute.ac": "Armor",
        "attribute.points": "Available points",
        "slot.head": "Head",
        "slot.amulet": "Amulet",
        "slot.chest": "Chest",
        "slot.pants": "Legs",
        "slot.shoes": "Feet",
        "slot.weapon": "Weapon",
        "slot.offHand": "Off hand",
        "slot.ring1": "Ring 1",
        "slot.ring2": "Ring 2",
        "slot.back": "Back",
        "death.message": "You have fallen.",
        "death.resurrect": "Resurrect",
        "touch.interact": "Interact",
        "touch.target": "Target",
        "touch.chat": "Chat",
        "touch.zoomIn": "Zoom in",
        "touch.zoomOut": "Zoom out",
        "hint.keyboard.title": "Keyboard and mouse controls",
        "hint.keyboard.body": "WASD move | Mouse selects and interacts | 1-9 use the hotbar | E interacts | Tab targets | I/J/K/C/H open panels",
        "hint.touch.title": "Touch controls",
        "hint.touch.body": "Left stick moves | Swipe the world to rotate the camera | Tap characters and objects | Tap the hotbar to act | Use the right-side buttons for nearby actions, chat, and zoom",
        "hint.dismiss": "Dismiss control hint",
} as const;

const ru: Record<keyof typeof en, string> = {
        "meta.title": "T5C - Пятый континент | Многопользовательская браузерная RPG",
        "meta.description": "Играйте в T5C, бесплатную многопользовательскую браузерную 3D RPG. Исследуйте Элдорию, сражайтесь, выполняйте задания и развивайте героя.",
        "a11y.skip": "Перейти к игре",
        "a11y.gameTitle": "T5C - Пятый континент, многопользовательская браузерная RPG",
        "a11y.gameDescription": "Исследуйте Элдорию, сражайтесь с врагами, выполняйте задания, собирайте снаряжение и общайтесь с другими игроками.",
        "a11y.controlsTitle": "Управление игрой",
        "a11y.controls.keyboard": "Перемещайтесь клавишами W, A, S и D. Выбирайте цели и взаимодействуйте мышью, используйте клавиши от 1 до 9 для панели быстрого доступа, Enter для чата и буквенные горячие клавиши для игровых окон.",
        "a11y.controls.touch": "Перемещайтесь экранным джойстиком, проводите по игровому миру для поворота камеры, касайтесь персонажей и предметов для взаимодействия и используйте умения с панели быстрого доступа.",
        "a11y.canvas": "Интерактивная 3D-игра T5C",
        "a11y.canvasFallback": "Для T5C требуется браузер с поддержкой Canvas и WebGL. Информация о совместимости доступна в технической справке.",
        "a11y.loadingProgress": "Ход загрузки игры",
        "a11y.touchControls": "Сенсорные элементы управления игрой",
        "entry.eyebrow": "Настройка игрока",
        "entry.title": "Выберите формат игры",
        "entry.subtitle": "Выберите язык и режим управления перед входом в Элдорию.",
        "entry.language": "Язык",
        "entry.controls": "Режим управления",
        "entry.keyboard": "Клавиатура и мышь",
        "entry.keyboardDetail": "Компьютер или ноутбук",
        "entry.touch": "Сенсорный экран",
        "entry.touchDetail": "Телефон или планшет",
        "entry.recommended": "Рекомендуется",
        "entry.continue": "Продолжить",
        "entry.remember": "Сохранится на этом устройстве",
        "loading.title": "Подготавливаем Элдорию",
        "loading.starting": "Запускаем игру...",
        "loading.gameData": "Загружаем данные игры...",
        "loading.worldData": "Загружаем игровой мир...",
        "loading.ready": "Игра T5C готова.",
        "loading.assetFailed": "Не удалось загрузить {asset}",
        "loading.navmesh": "Загружаем данные навигации...",
        "fatal.eyebrow": "Не удалось запустить T5C",
        "fatal.title": "Приключение приостановлено",
        "fatal.default": "Не удалось завершить загрузку игры. Проверьте подключение и перезагрузите страницу. Если проблема повторится, откройте техническую справку.",
        "fatal.webgl": "Браузер не смог создать графический контекст WebGL. Включите аппаратное ускорение или откройте игру в актуальной версии браузера.",
        "fatal.retry": "Повторить",
        "fatal.help": "Открыть техническую справку",
        "fatal.announcement": "Не удалось запустить T5C. {message}",
        "login.eyebrow": "Многопользовательская браузерная RPG",
        "login.title": "Войти в Элдорию",
        "login.version": "Версия {version}",
        "login.username": "Имя искателя приключений",
        "login.password": "Пароль",
        "login.connect": "Войти в игру",
        "login.connecting": "Подключаемся...",
        "login.checking": "Проверяем данные персонажа...",
        "login.quickPlay": "Быстрая игра",
        "login.quickCreating": "Создаём гостевого персонажа...",
        "login.or": "или",
        "login.hint": "Начните сразу со случайно созданным персонажем.",
        "login.error": "Не удалось подключиться. Повторите попытку.",
        "login.invalid": "Не удалось подключиться. Проверьте данные и повторите попытку.",
        "noscript.title": "Требуется JavaScript",
        "noscript.body": "T5C - интерактивная браузерная 3D-игра, для запуска которой требуется JavaScript.",
        "character.choose": "Выберите персонажа",
        "character.signedIn": "Выполнен вход: {name}",
        "character.signOut": "Выйти из аккаунта",
        "character.createAdventurer": "Создать персонажа",
        "character.level": "Уровень: {level}",
        "character.play": "Играть",
        "editor.class": "Класс",
        "editor.chooseClass": "Выберите класс",
        "editor.face": "Лицо",
        "editor.chooseFace": "Выберите лицо",
        "editor.style": "Облик",
        "editor.chooseStyle": "Выберите облик",
        "editor.styleNumber": "Облик {number}",
        "editor.face.base": "Классика",
        "editor.face.barbarian": "Варвар",
        "editor.face.engineer": "Инженер",
        "editor.face.mage": "Маг",
        "editor.face.rogue": "Разбойник",
        "editor.face.paladin": "Паладин",
        "editor.characterName": "Введите имя персонажа",
        "editor.create": "Создать",
        "common.cancel": "Отмена",
        "common.back": "Назад",
        "common.close": "Закрыть",
        "common.bye": "До встречи",
        "common.level": "Уровень",
        "common.system": "Система",
        "menu.inventory": "Инвентарь",
        "menu.quests": "Задания",
        "menu.abilities": "Умения",
        "menu.character": "Персонаж",
        "menu.help": "Справка",
        "menu.stuck": "Вернуть персонажа",
        "menu.screenshot": "Сделать снимок",
        "menu.quit": "Покинуть мир",
        "panel.dialog": "Диалог",
        "panel.activeQuests": "Активные задания",
        "panel.help": "Добро пожаловать в T5C",
        "chat.placeholder": "Введите сообщение...",
        "chat.send": "Отправить",
        "chat.global": "[Общий] {name}: ",
        "chat.youSaid": "Вы сказали: ",
        "chat.system": "[Система] ",
        "chat.joined": "{name} присоединяется к игровому миру.",
        "event.killed": "Вы победили противника: {name}.",
        "event.gold": "Получено золота: {amount}.",
        "event.levelUp": "Вы обрели новые знания и достигли {level}-го уровня.",
        "casting.start": "Применение...",
        "status.level": "Ур. {level}",
        "status.gold": "Золото: {amount}",
        "tooltip.value": "Ценность: {value}",
        "tooltip.damage": "Урон: {min} - {max}",
        "tooltip.cost": "Расход: {min}-{max} {resource}",
        "tooltip.cooldown": "Перезарядка: {seconds} с",
        "tooltip.castTime": "Подготовка: {seconds} с",
        "tooltip.instant": "Мгновенное применение",
        "inventory.equip": "Надеть",
        "inventory.use": "Использовать",
        "inventory.dropAll": "Выбросить стопку",
        "inventory.dropOne": "Выбросить один",
        "inventory.sell": "Продать",
        "inventory.sellOn": "Продажа: включена",
        "inventory.buy": "Купить: {amount}",
        "inventory.cost": "Цена: {amount}",
        "vendor.empty": "Сейчас здесь нет доступных товаров.",
        "trainer.empty": "Вы уже изучили всё, чему может научить этот наставник.",
        "trainer.train": "Изучить",
        "trainer.level": "{title} (уровень {level})",
        "requirement.cost": "Цена: {amount}",
        "requirement.level": "Требуемый уровень: {amount}",
        "requirement.strength": "Требуемая сила: {amount}",
        "requirement.endurance": "Требуемая выносливость: {amount}",
        "requirement.agility": "Требуемая ловкость: {amount}",
        "requirement.intelligence": "Требуемый интеллект: {amount}",
        "requirement.wisdom": "Требуемая мудрость: {amount}",
        "dialog.train": "Вы можете меня обучить?",
        "dialog.vendor": "Покажите ваши товары.",
        "dialog.questMarker": "Задание",
        "quest.none": "У вас нет активных заданий. Исследуйте мир и разговаривайте с его жителями, чтобы найти новые.",
        "quest.killProgress": "Побеждено {completed}/{required}: {target}",
        "quest.acceptedText": "Большое спасибо. Выполните поручение и возвращайтесь ко мне.",
        "quest.ongoingText": "Выполните поручение и возвращайтесь ко мне.",
        "quest.readyText": "Поручение выполнено. Примите эти знаки моей благодарности.",
        "quest.completedText": "Благодарю вас. Да хранит вас богиня Атлея.",
        "quest.complete": "Завершить задание",
        "quest.accept": "Принять",
        "quest.decline": "Отказаться",
        "quest.completed": "Задание выполнено",
        "quest.accepted": "Задание принято",
        "quest.rewardExperience": "Опыт: {amount}",
        "quest.rewardGold": "Золото: {amount}",
        "quest.rewardItem": "Предмет: {item}",
        "character.name": "Имя",
        "character.id": "ID",
        "character.race": "Раса",
        "character.health": "Здоровье",
        "character.mana": "Мана",
        "attribute.strength": "Сила",
        "attribute.endurance": "Выносливость",
        "attribute.agility": "Ловкость",
        "attribute.intelligence": "Интеллект",
        "attribute.wisdom": "Мудрость",
        "attribute.ac": "Броня",
        "attribute.points": "Свободные очки",
        "slot.head": "Голова",
        "slot.amulet": "Амулет",
        "slot.chest": "Торс",
        "slot.pants": "Ноги",
        "slot.shoes": "Обувь",
        "slot.weapon": "Оружие",
        "slot.offHand": "Вторая рука",
        "slot.ring1": "Кольцо 1",
        "slot.ring2": "Кольцо 2",
        "slot.back": "Спина",
        "death.message": "Вы пали в бою.",
        "death.resurrect": "Воскреснуть",
        "touch.interact": "Взаимодействовать",
        "touch.target": "Выбрать цель",
        "touch.chat": "Чат",
        "touch.zoomIn": "Приблизить",
        "touch.zoomOut": "Отдалить",
        "hint.keyboard.title": "Управление клавиатурой и мышью",
        "hint.keyboard.body": "WASD - движение | Мышь - выбор и взаимодействие | 1-9 - панель умений | E - взаимодействие | Tab - цель | I/J/K/C/H - игровые окна",
        "hint.touch.title": "Сенсорное управление",
        "hint.touch.body": "Левый джойстик - движение | Проведите по миру для поворота камеры | Касайтесь персонажей и предметов | Умения находятся на нижней панели | Справа расположены взаимодействие, чат и масштаб",
        "hint.dismiss": "Закрыть подсказку по управлению",
};

export const translations = { en, ru } as const;

export type TranslationKey = keyof typeof translations.en;

type LocalizedText = Record<Locale, string>;

const localized = (en: string, ru: string): LocalizedText => ({ en, ru });

export const gameContent = {
    abilities: {
        base_attack: {
            title: localized("Attack", "Атака"),
            description: localized("A basic melee attack that deals light damage.", "Базовая атака ближнего боя, наносящая небольшой урон."),
        },
        slice_attack: {
            title: localized("Sweeping Strike", "Круговой удар"),
            description: localized("A sweeping strike that damages nearby enemies.", "Размашистый удар, наносящий урон ближайшим противникам."),
        },
        fire_dart: {
            title: localized("Fire Dart", "Огненная стрела"),
            description: localized("Launches a small flaming projectile at the target.", "Выпускает в цель небольшой горящий снаряд."),
        },
        poison: {
            title: localized("Poison", "Яд"),
            description: localized("Gradually drains the target's health over time.", "Постепенно отнимает здоровье цели в течение некоторого времени."),
        },
        light_heal: {
            title: localized("Light Heal", "Малое исцеление"),
            description: localized("Restores health to the target.", "Восстанавливает здоровье цели."),
        },
    },
    items: {
        sword_01: {
            title: localized("Tempered Sword", "Закалённый меч"),
            description: localized("A balanced steel sword suited to a new adventurer.", "Сбалансированный стальной меч для начинающего искателя приключений."),
        },
        shield_01: {
            title: localized("Round Shield", "Круглый щит"),
            description: localized("A sturdy shield that offers reliable protection.", "Прочный щит, обеспечивающий надёжную защиту."),
        },
        helm_01: {
            title: localized("Steel Helm", "Стальной шлем"),
            description: localized("A practical steel helm made for close combat.", "Практичный стальной шлем для ближнего боя."),
        },
        hat_01: {
            title: localized("Enchanted Hat", "Зачарованная шляпа"),
            description: localized("A rare hat carrying a trace of arcane power.", "Редкая шляпа, хранящая частицу магической силы."),
        },
        armor_01: {
            title: localized("Purple Robe", "Пурпурная мантия"),
            description: localized("A comfortable robe reinforced for dangerous journeys.", "Удобная мантия, усиленная для опасных путешествий."),
        },
        armor_02: {
            title: localized("White Robe", "Белая мантия"),
            description: localized("A finely woven robe with additional protection.", "Искусно сшитая мантия с дополнительной защитой."),
        },
        amulet_01: {
            title: localized("Ancient Amulet", "Древний амулет"),
            description: localized("An amulet from a forgotten age whose full power remains unknown.", "Амулет забытой эпохи, полная сила которого до сих пор неизвестна."),
        },
        potion_small_red: {
            title: localized("Small Health Potion", "Малое зелье здоровья"),
            description: localized("Restores up to 25 health.", "Восстанавливает до 25 единиц здоровья."),
        },
        potion_small_blue: {
            title: localized("Small Mana Potion", "Малое зелье маны"),
            description: localized("Restores up to 25 mana.", "Восстанавливает до 25 единиц маны."),
        },
    },
    races: {
        humanoid: {
            title: localized("Human", "Человек"),
            description: localized("A versatile adventurer with balanced health, mana, and equipment choices.", "Универсальный искатель приключений со сбалансированным запасом здоровья, маны и выбором снаряжения."),
        },
        skeleton_01: {
            title: localized("Skeleton", "Скелет"),
            description: localized("An animated skeleton held together by hostile magic.", "Оживший скелет, скреплённый враждебной магией."),
        },
    },
    quests: {
        LH_DANGEROUS_ERRANDS_01: {
            title: localized("Dangerous Errands", "Опасное поручение"),
            description: localized(
                "If you have a moment, travel to the forest south of town. Bandits have overrun the road, and the people of Lighthaven need your help.",
                "Если у вас есть время, отправляйтесь в лес к югу от города. Разбойники захватили дорогу, и жителям Светлой Гавани нужна ваша помощь."
            ),
            objective: localized(
                "@NpcName in @LocationName asks you to defeat @KillRequired @TargetName south of town.",
                "@NpcName в локации «@LocationName» просит вас победить противников: @TargetName — @KillRequired. Ищите их к югу от города."
            ),
        },
    },
    locations: {
        lh_town: localized("Lighthaven", "Светлая Гавань"),
        training_ground: localized("Training Ground", "Тренировочная площадка"),
        lh_dungeon_01: localized("Dungeon: First Level", "Подземелье: первый уровень"),
    },
    entities: {
        lh_town: {
            lh_town_blacksmith: {
                name: localized("Blacksmith Garin", "Кузнец Гарин"),
                dialog: [localized("Greetings, adventurer! Looking for a new weapon or sturdy armor? I carry some of the finest work in Eldoria.", "Приветствую, искатель приключений! Нужно новое оружие или крепкая броня? У меня одни из лучших изделий в Элдории.")],
            },
            lh_town_merchant: {
                name: localized("Merchant Elara", "Торговка Элара"),
                dialog: [localized("A well-prepared adventurer is a successful adventurer. Stock up before you head out!", "Хорошо подготовленный искатель приключений всегда добивается успеха. Пополните запасы перед дорогой!")],
            },
            lh_town_sorceress: {
                name: localized("Mira the Sorceress", "Чародейка Мира"),
                dialog: [localized("Another seeker of knowledge. Which arcane mystery shall we uncover today?", "Ещё один искатель знаний. Какую тайну волшебства мы раскроем сегодня?")],
            },
            lh_town_priestress: {
                name: localized("Priestess Alice", "Жрица Алиса"),
                dialog: [
                    localized("May Athlea bless you. How can I help you on your journey?", "Да благословит вас Атлея. Чем я могу помочь в вашем путешествии?"),
                    localized("Praise Athlea for her grace. Rest for a moment while her light restores your strength.", "Воздадим хвалу милосердной Атлее. Отдохните немного, пока её свет восстанавливает ваши силы."),
                    localized("Very well. May the goddess watch over your chosen path.", "Хорошо. Пусть богиня хранит вас на избранном пути."),
                ],
                buttons: [
                    localized("Can you heal me?", "Вы можете меня исцелить?"),
                    localized("Not now. I must continue my journey.", "Не сейчас. Мне нужно продолжить путь."),
                ],
                buttonNames: { 2: localized("Thank you", "Благодарю") },
            },
            lh_town_farmer: {
                name: localized("Farmer Jorin", "Фермер Джорин"),
                dialog: [localized("It is hard work, but honest work. The land provides for those who tend it with care.", "Работа тяжёлая, но честная. Земля кормит тех, кто заботится о ней.")],
            },
            lh_town_bartender: {
                name: localized("Bartender Morin", "Трактирщик Морин"),
                dialog: [localized("Welcome to the tavern! Sit down, have a drink, and share a tale from the road.", "Добро пожаловать в таверну! Присаживайтесь, выпейте и поделитесь историей из своих странствий.")],
            },
            lh_town_caretaker: {
                name: localized("Caretaker Ren", "Смотритель Рен"),
                dialog: [localized("The cemetery holds many secrets. Respect the dead, and they may share their wisdom.", "Кладбище хранит множество тайн. Уважайте мёртвых, и, возможно, они поделятся своей мудростью.")],
            },
            lh_town_seraphina: {
                name: localized("Madame Seraphina", "Мадам Серафина"),
                dialog: [localized("A new face! Make yourself at home and enjoy the performance.", "Новое лицо! Чувствуйте себя как дома и наслаждайтесь представлением.")],
            },
            lh_town_citizen: {
                name: localized("Citizen", "Горожанин"),
                dialog: [localized("Ah, @PlayerName! It is good to meet you.", "Рад встрече, @PlayerName!")],
            },
            lh_town_bandits2: { name: localized("Skeleton", "Скелет") },
            lh_town_bandits: { name: localized("Bandit", "Разбойник") },
        },
        training_ground: {
            spawn_01: { name: localized("Training Dummy II", "Тренировочный манекен II") },
            spawn_02: { name: localized("Training Dummy I", "Тренировочный манекен I") },
        },
        lh_dungeon_01: {
            spawn_01: { name: localized("Rat", "Крыса") },
        },
    },
    interactableTitle: localized("Talk", "Поговорить"),
    help: {
        title: localized("Welcome to T5C", "Добро пожаловать в T5C"),
        intro: localized("Create your own character and explore a shared fantasy world.", "Создайте собственного персонажа и исследуйте общий фэнтезийный мир."),
        movementTitle: localized("Movement", "Перемещение"),
        movementKeyboard: localized("Use W, A, S, and D to move relative to the camera.", "Используйте W, A, S и D для движения относительно камеры."),
        movementTouch: localized("Use the virtual joystick in the lower-left corner.", "Используйте виртуальный джойстик в левом нижнем углу."),
        cameraTitle: localized("Camera", "Камера"),
        cameraKeyboard: localized(
            "Drag with the middle or right mouse button to rotate the camera, and use the wheel to zoom.",
            "Удерживайте среднюю или правую кнопку мыши и перемещайте мышь для поворота камеры, используйте колесо для приближения."
        ),
        cameraTouch: localized("Swipe across the world to rotate the camera and use the zoom buttons on the right.", "Проводите пальцем по игровому миру для поворота камеры и используйте кнопки масштаба справа."),
        attackTitle: localized("Combat", "Сражения"),
        attackKeyboard: localized("Select a target, then press 1 through 9 or click an action on the hotbar.", "Выберите цель, затем нажмите клавишу от 1 до 9 или выберите действие на панели быстрого доступа."),
        attackTouch: localized("Tap a target, then tap an action on the hotbar at the bottom of the screen.", "Коснитесь цели, затем выберите действие на панели быстрого доступа в нижней части экрана."),
        interactTitle: localized("Interaction", "Взаимодействие"),
        interactKeyboard: localized("Approach a character or object and click it, or press E to interact with the nearest one.", "Подойдите к персонажу или предмету и щёлкните по нему либо нажмите E для взаимодействия с ближайшим объектом."),
        interactTouch: localized("Approach a character or object and tap it, or use the interaction button on the right.", "Подойдите к персонажу или предмету и коснитесь его либо используйте кнопку взаимодействия справа."),
    },
} as const;

export function t(locale: Locale, key: TranslationKey, params: TranslationParams = {}): string {
    let value: string = translations[locale][key] ?? translations.en[key];
    for (const [name, replacement] of Object.entries(params)) {
        value = value.split(`{${name}}`).join(String(replacement));
    }
    return value;
}

function pick(value: LocalizedText, locale: Locale): string {
    return value[locale] || value.en;
}

export function localizeGameData(data: any, locale: Locale, controlMode: ControlMode): any {
    for (const [key, content] of Object.entries(gameContent.abilities)) {
        if (data.abilities?.[key]) {
            data.abilities[key].title = pick(content.title, locale);
            data.abilities[key].description = pick(content.description, locale);
        }
    }

    for (const [key, content] of Object.entries(gameContent.items)) {
        if (data.items?.[key]) {
            data.items[key].title = pick(content.title, locale);
            data.items[key].description = pick(content.description, locale);
        }
    }

    for (const [key, content] of Object.entries(gameContent.races)) {
        if (data.races?.[key]) {
            data.races[key].title = pick(content.title, locale);
            data.races[key].description = pick(content.description, locale);
        }
    }

    for (const [key, content] of Object.entries(gameContent.quests)) {
        if (data.quests?.[key]) {
            data.quests[key].title = pick(content.title, locale);
            data.quests[key].description = pick(content.description, locale);
            data.quests[key].objective = pick(content.objective, locale);
        }
    }

    for (const [locationKey, title] of Object.entries(gameContent.locations)) {
        const location = data.locations?.[locationKey];
        if (!location) {
            continue;
        }
        location.title = pick(title, locale);

        const entityContent = gameContent.entities[locationKey] ?? {};
        for (const spawn of location.dynamic?.spawns ?? []) {
            const content = entityContent[spawn.key];
            if (!content) {
                continue;
            }
            if (content.name) {
                spawn.name = pick(content.name, locale);
            }
            if (spawn.interactable) {
                spawn.interactable.title = pick(gameContent.interactableTitle, locale);
                for (const [index, dialog] of (spawn.interactable.data ?? []).entries()) {
                    if (content.dialog?.[index]) {
                        dialog.text = pick(content.dialog[index], locale);
                    }
                    for (const [buttonIndex, button] of (dialog.buttons ?? []).entries()) {
                        if (content.buttons?.[buttonIndex]) {
                            button.label = pick(content.buttons[buttonIndex], locale);
                        }
                    }
                    if (content.buttonNames?.[index]) {
                        dialog.buttonName = pick(content.buttonNames[index], locale);
                    }
                }
            }
        }
    }

    const helpTab = data.help?.tab_01;
    if (helpTab?.objects?.length >= 5) {
        helpTab.title = pick(gameContent.help.title, locale);
        const descriptions =
            controlMode === "touch"
                ? [gameContent.help.intro, gameContent.help.movementTouch, gameContent.help.cameraTouch, gameContent.help.attackTouch, gameContent.help.interactTouch]
                : [gameContent.help.intro, gameContent.help.movementKeyboard, gameContent.help.cameraKeyboard, gameContent.help.attackKeyboard, gameContent.help.interactKeyboard];
        const titles = [
            gameContent.help.title,
            gameContent.help.movementTitle,
            gameContent.help.cameraTitle,
            gameContent.help.attackTitle,
            gameContent.help.interactTitle,
        ];
        helpTab.objects.forEach((item, index) => {
            item.title = pick(titles[index], locale);
            item.description = pick(descriptions[index], locale);
        });
    }

    return data;
}

export function localizeEntityName(name: string, locale: Locale): string {
    for (const locations of Object.values(gameContent.entities)) {
        for (const entity of Object.values(locations)) {
            if (entity.name?.en === name || entity.name?.ru === name) {
                return pick(entity.name, locale);
            }
        }
    }
    return name;
}

export function localizeServerMessage(message: string, locale: Locale): string {
    const joined = message.match(/^(.+) has joined the room\.$/);
    if (joined) {
        return t(locale, "chat.joined", { name: joined[1] });
    }

    const killed = message.match(/^You've killed (.+)\.$/);
    if (killed) {
        return t(locale, "event.killed", { name: localizeEntityName(killed[1], locale) });
    }

    const gold = message.match(/^You pick up (\d+) worth of gold\.$/);
    if (gold) {
        return t(locale, "event.gold", { amount: gold[1] });
    }

    const levelUp = message.match(/^You've gained knowledge and are now level (\d+)\.$/);
    if (levelUp) {
        return t(locale, "event.levelUp", { level: levelUp[1] });
    }

    return message;
}
