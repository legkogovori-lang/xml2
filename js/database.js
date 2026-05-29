// database.js - управление базой данных через IndexedDB + Dexie.js

// Создаем экземпляр базы данных
const db = new Dexie('ETRN_Database_V2');

// Определяем схему базы данных
db.version(1).stores({
    shippers: '++id, inn, name, kpp, address, phone',
    consignees: '++id, inn, name, kpp, address, phone',
    carriers: '++id, inn, name, kpp, transportType, address, phone',
    drivers: '++id, fullName, license, inn, phone',
    signers: '++id, fio, position',
    vehicles: '++id, regNumber, nationality, brand, capacity, loadCapacity',
    products: '++id, name, defaultTnved, densityDefault'
});

// Лимит для демо-режима (максимум записей на категорию)
const DEMO_LIMIT = 5;

// Данные по умолчанию
const DEFAULT_DATA = {
    shippers: [
        { inn: "4205099206", kpp: "772201001", name: "ООО \"ФАКТОР-2\"", address: "г. Москва, ул. Промышленная, д.15", phone: "74951234567" }
    ],
    consignees: [
        { inn: "4205099206", kpp: "772201001", name: "ООО \"ФАКТОР-2\"", address: "г. Москва, ул. Промышленная, д.15", phone: "74951234567" }
    ],
    carriers: [
        { inn: "8273281242", kpp: "870245783", name: "АО \"Берег\"", transportType: "Автомобильный", address: "г. Москва", phone: "74951234567" }
    ],
    drivers: [
        { fullName: "Жуков Сергей", license: "99 25 123456", inn: "124441231231", phone: "79161234567" }
    ],
    signers: [
        { fio: "Петрова Светлана Петровна", position: "Генеральный директор" }
    ],
    vehicles: [
        { regNumber: "А123ВЕ777", nationality: "RUS", brand: "MAN", capacity: "20000", loadCapacity: "20000" }
    ],
    products: [
        { name: "Нефть сырая", defaultTnved: "2709009009", densityDefault: "0.845" },
        { name: "Дизельное топливо", defaultTnved: "2710194210", densityDefault: "0.840" },
        { name: "Бензин АИ-92", defaultTnved: "2710124120", densityDefault: "0.745" }
    ]
};

// Флаг инициализации
let isInitialized = false;

// Получение текущего пользователя
function getCurrentUser() {
    const userData = sessionStorage.getItem('etrn_user');
    if (!userData) return null;
    try {
        return JSON.parse(userData);
    } catch {
        return null;
    }
}

// Проверка лимитов для демо-режима
async function checkDemoLimit(category) {
    const user = getCurrentUser();
    if (user && user.role === 'demo') {
        const count = await db[category].count();
        if (count >= DEMO_LIMIT) {
            throw new Error(`Демо-режим: нельзя добавить более ${DEMO_LIMIT} записей в категорию "${getCategoryNameRu(category)}". Для полной версии войдите под своим логином.`);
        }
    }
    return true;
}

// Инициализация базы данных с учётом роли пользователя
async function initDatabase() {
    if (isInitialized) return;
    
    try {
        const user = getCurrentUser();
        const isDemo = user && user.role === 'demo';
        
        // Для демо-режима не добавляем данные по умолчанию, только если их нет
        for (const [tableName, defaultData] of Object.entries(DEFAULT_DATA)) {
            const count = await db[tableName].count();
            if (count === 0) {
                if (isDemo) {
                    // В демо-режиме добавляем только 1 запись (в рамках лимита)
                    await db[tableName].bulkAdd(defaultData.slice(0, 1));
                    console.log(`✅ Добавлена 1 демо-запись в ${tableName}`);
                } else {
                    await db[tableName].bulkAdd(defaultData);
                    console.log(`✅ Добавлены данные по умолчанию в ${tableName}`);
                }
            }
        }
        isInitialized = true;
        console.log('✅ База данных IndexedDB инициализирована');
    } catch (error) {
        console.error('Ошибка инициализации базы:', error);
    }
}

// Получение всех записей из категории
async function getCategory(category) {
    try {
        return await db[category].toArray();
    } catch (error) {
        console.error(`Ошибка получения ${category}:`, error);
        return [];
    }
}

// Поиск в категории
async function searchInCategory(category, searchText) {
    try {
        if (!searchText || searchText.trim() === '') {
            return await db[category].toArray();
        }
        
        const items = await db[category].toArray();
        const searchLower = searchText.toLowerCase();
        
        return items.filter(item => {
            const nameField = item.name || item.fullName || item.fio || item.regNumber;
            if (nameField && nameField.toLowerCase().includes(searchLower)) return true;
            if (item.inn && item.inn.toLowerCase().includes(searchLower)) return true;
            if (item.license && item.license.toLowerCase().includes(searchLower)) return true;
            return false;
        });
    } catch (error) {
        console.error(`Ошибка поиска в ${category}:`, error);
        return [];
    }
}

// Добавление записи с проверкой лимитов
async function addItem(category, item) {
    try {
        await checkDemoLimit(category);
        const id = await db[category].add(item);
        return { ...item, id };
    } catch (error) {
        console.error(`Ошибка добавления в ${category}:`, error);
        throw error;
    }
}

// Удаление записи
async function deleteItem(category, id) {
    try {
        await db[category].delete(id);
        return true;
    } catch (error) {
        console.error(`Ошибка удаления из ${category}:`, error);
        throw error;
    }
}

// Обновление записи
async function updateItem(category, id, item) {
    try {
        await db[category].update(id, item);
        return true;
    } catch (error) {
        console.error(`Ошибка обновления в ${category}:`, error);
        throw error;
    }
}

// Экспорт всей базы в JSON файлы
async function exportAllToFiles() {
    try {
        const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
        
        for (const category of categories) {
            const data = await db[category].toArray();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `${category}.json`;
            link.click();
            URL.revokeObjectURL(url);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        throw error;
    }
}

// Импорт данных из JSON файла
async function importFromFile(category, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    const user = getCurrentUser();
                    const isDemo = user && user.role === 'demo';
                    
                    if (isDemo && data.length > DEMO_LIMIT) {
                        reject(new Error(`Демо-режим: нельзя импортировать более ${DEMO_LIMIT} записей в категорию`));
                        return;
                    }
                    
                    await db[category].clear();
                    await db[category].bulkAdd(data);
                    resolve(data.length);
                } else {
                    reject(new Error('Неверный формат файла'));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Импорт всех файлов
async function importAllFromFiles(files) {
    let importedCount = 0;
    for (const file of files) {
        const category = file.name.replace('.json', '');
        if (db[category]) {
            try {
                await importFromFile(category, file);
                importedCount++;
                console.log(`Импортировано в ${category}`);
            } catch (error) {
                console.error(`Ошибка импорта ${file.name}:`, error);
                throw error;
            }
        }
    }
    return importedCount;
}

// Очистка всей базы данных
async function clearAllDatabase() {
    try {
        const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
        for (const category of categories) {
            await db[category].clear();
        }
        console.log('✅ База данных очищена');
        return true;
    } catch (error) {
        console.error('Ошибка очистки базы:', error);
        throw error;
    }
}

// Сброс к данным по умолчанию
async function resetToDefault() {
    try {
        await clearAllDatabase();
        
        const user = getCurrentUser();
        const isDemo = user && user.role === 'demo';
        
        for (const [tableName, defaultData] of Object.entries(DEFAULT_DATA)) {
            if (isDemo) {
                await db[tableName].bulkAdd(defaultData.slice(0, 1));
            } else {
                await db[tableName].bulkAdd(defaultData);
            }
        }
        
        console.log('✅ База данных сброшена к значениям по умолчанию');
        return true;
    } catch (error) {
        console.error('Ошибка сброса базы:', error);
        throw error;
    }
}

// Получение статистики базы
async function getDatabaseStats() {
    const stats = {};
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
    
    for (const category of categories) {
        const count = await db[category].count();
        stats[category] = count;
    }
    
    return stats;
}

// Получение названия категории на русском
function getCategoryNameRu(category) {
    const names = {
        shippers: 'Грузоотправители',
        consignees: 'Грузополучатели',
        carriers: 'Перевозчики',
        drivers: 'Водители',
        signers: 'Подписанты',
        vehicles: 'Транспорт',
        products: 'Продукты'
    };
    return names[category] || category;
}