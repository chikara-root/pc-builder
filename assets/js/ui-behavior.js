/**
 * PC Builder - UI Behavior & State Management
 * Updated for Stage 5: API integration with fallback to local mock data.
 * Handles hardware selection, filters, multi-selection, compatibility checks, and UI synchronization.
 */

// Application State
var state = {
    selections: {
        cpu: null,
        gpu: null,
        ram: [],
        motherboard: null,
        storage: [],
        psu: null,
        case: null,
        cooler: null
    },
    filters: {
        cpu: { manufacturer: null, family: null, gen: null },
        gpu: { manufacturer: null, generation: null },
        ram: { type: null, capacity_GB: null },
        motherboard: { ramType: null },
        storage: { interface: null, type: null }
    },
    // In-memory cache of hardware data (populated from API on load)
    hardwareData: {
        categories: null,
        categoryMeta: null,
        mockDatabase: null,
        filterConfig: null
    },
    // API connectivity status
    apiAvailable: false
};

// --- Local fallback data (from mock-database.js) ---
function getLocalCategories() {
    if (typeof CATEGORIES !== 'undefined') return CATEGORIES;
    return ["cpu", "gpu", "ram", "motherboard", "storage", "psu", "case", "cooler"];
}

function getLocalCategoryMeta() {
    if (typeof CATEGORY_META !== 'undefined') return CATEGORY_META;
    return {
        cpu: { label: "CPU", icon: "bi-cpu", short: "CPU", filterable: true },
        gpu: { label: "GPU", icon: "bi-gpu-card", short: "GPU", filterable: true },
        ram: { label: "RAM", icon: "bi-memory", short: "RAM", filterable: true, multiSelect: true },
        motherboard: { label: "Motherboard", icon: "bi-layers", short: "MBO", filterable: true },
        storage: { label: "SSD / Storage", icon: "bi-hard-drive", short: "SSD", filterable: true, multiSelect: true },
        psu: { label: "Power Supply (PSU)", icon: "bi-power", short: "PSU" },
        case: { label: "PC Case", icon: "bi-box-seam", short: "CASE" },
        cooler: { label: "CPU Cooler", icon: "bi-fan", short: "COOL" }
    };
}

function getLocalMockDatabase() {
    if (typeof MOCK_DATABASE !== 'undefined') return MOCK_DATABASE;
    return {};
}

function getLocalFilterConfig() {
    if (typeof FILTER_CONFIG !== 'undefined') return FILTER_CONFIG;
    return {
        cpu: [{ key: 'manufacturer', label: 'Manufacturer' }, { key: 'family', label: 'Family (Intel)' }, { key: 'gen', label: 'Generation' }],
        gpu: [{ key: 'manufacturer', label: 'Manufacturer' }, { key: 'generation', label: 'Generation/Family' }],
        ram: [{ key: 'type', label: 'Type (DDR4/DDR5)' }, { key: 'capacity_GB', label: 'Capacity (GB)' }],
        motherboard: [{ key: 'ramType', label: 'RAM Type' }],
        storage: [{ key: 'interface', label: 'Interface' }, { key: 'type', label: 'Type' }]
    };
}

// --- Unified data accessors ---
function getCategoriesList() {
    return state.hardwareData.categories || getLocalCategories();
}

function getCategoryMetaObj() {
    return state.hardwareData.categoryMeta || getLocalCategoryMeta();
}

function getMockDatabaseObj() {
    return state.hardwareData.mockDatabase || getLocalMockDatabase();
}

function getFilterConfigObj() {
    return state.hardwareData.filterConfig || getLocalFilterConfig();
}

// --- Helper to find object by id ---
function findById(catKey, id) {
    var db = getMockDatabaseObj();
    return (db[catKey] || []).find(function(item) { return item.id === id; }) || null;
}

// --- Load hardware data from API or fallback ---
async function loadHardwareData() {
    try {
        var apiData = await hardwareAPI.getCategories();
        
        // Map API response format to internal structure
        var categories = apiData.map(function(c) { return c.key; });
        var categoryMeta = {};
        apiData.forEach(function(c) {
            categoryMeta[c.key] = {
                label: c.label,
                icon: c.icon,
                short: c.short,
                filterable: c.filterable || false,
                multiSelect: c.multiSelect || false
            };
        });

        // Load all components for each category
        var mockDatabase = {};
        for (var i = 0; i < categories.length; i++) {
            var catKey = categories[i];
            mockDatabase[catKey] = await hardwareAPI.getComponents(catKey);
        }

        // Load filter config from first category's filter options
        var filterConfig = {};
        var firstFilterable = categories.find(function(k) { 
            return categoryMeta[k].filterable; 
        });
        if (firstFilterable) {
            var filterOpts = await hardwareAPI.getFilterOptions(firstFilterable);
            // Build filter config from response
            filterConfig = getFilterConfigObj(); // fallback to local
        }

        state.hardwareData.categories = categories;
        state.hardwareData.categoryMeta = categoryMeta;
        state.hardwareData.mockDatabase = mockDatabase;
        state.hardwareData.filterConfig = filterConfig;
        state.apiAvailable = true;

        console.log('[PC BUILDER] Hardware data loaded from API.');
    } catch (error) {
        console.warn('[PC BUILDER] API unavailable, falling back to local data.', error);
        state.apiAvailable = false;
        // Fallback to local data (already in mock-database.js)
    }
}

/**
 * Render spec details for a hardware card
 */
function renderSpecs(item, catKey) {
    var specs = [];
    switch (catKey) {
        case 'cpu':
            if (item.manufacturer) specs.push('Manufacturer: ' + item.manufacturer);
            if (item.family) specs.push('Family: ' + item.family);
            if (item.gen) specs.push('Gen: ' + item.gen);
            if (item.cores) specs.push('Cores: ' + item.cores);
            if (item.threads) specs.push('Threads: ' + item.threads);
            if (item.boostClock) specs.push('Boost: ' + item.boostClock);
            if (item.socket) specs.push('Socket: ' + item.socket);
            break;
        case 'gpu':
            if (item.manufacturer) specs.push('Manufacturer: ' + item.manufacturer);
            if (item.generation) specs.push('Gen: ' + item.generation);
            if (item.vram) specs.push('VRAM: ' + item.vram);
            if (item.tdp) specs.push('TDP: ' + item.tdp);
            break;
        case 'ram':
            if (item.type) specs.push('Type: ' + item.type);
            if (item.capacity_GB) specs.push('Capacity: ' + item.capacity_GB + 'GB');
            if (item.speed) specs.push('Speed: ' + item.speed);
            break;
        case 'motherboard':
            if (item.socket) specs.push('Socket: ' + item.socket);
            if (item.chipset) specs.push('Chipset: ' + item.chipset);
            if (item.ramType) specs.push('RAM: ' + item.ramType);
            break;
        case 'storage':
            if (item.interface) specs.push('Interface: ' + item.interface);
            if (item.capacity_GB) specs.push('Capacity: ' + item.capacity_GB + 'GB');
            break;
        case 'psu':
            if (item.wattage) specs.push('Wattage: ' + item.wattage);
            if (item.efficiency) specs.push('Efficiency: ' + item.efficiency);
            break;
        case 'case':
            if (item.formFactor) specs.push('Form: ' + item.formFactor);
            if (item.gpuMaxLen) specs.push('GPU Max Len: ' + item.gpuMaxLen);
            if (item.coolerMaxHeight) specs.push('CPU HS: ' + item.coolerMaxHeight);
            break;
        case 'cooler':
            if (item.type) specs.push('Type: ' + item.type);
            if (item.height) specs.push('Height: ' + item.height);
            if (item.tdpRating) specs.push('TDP: ' + item.tdpRating);
            break;
    }

    if (specs.length === 0) return '';
    return '<div class="specs-container">' + specs.map(function(s) {
        return '<span class="spec-inline">' + escapeHtml(s) + '</span>';
    }).join('') + '</div>';
}

/**
 * Get selected items as objects for a category
 */
function getSelectedItems(catKey) {
    var sel = state.selections[catKey];
    if (Array.isArray(sel)) {
        return sel.map(function(id) { return findById(catKey, id); }).filter(Boolean);
    }
    if (sel) {
        return [findById(catKey, sel)].filter(Boolean);
    }
    return [];
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    // Try to load from API, fall back to local data
    await loadHardwareData();

    // Now render with data available
    renderHardwareCategories();
    updateUI();
    setupClearAll();
    setupBackToTop();
    setupRevealObserver();
    setupCalculateButton();
    
    // If on analysis page, load state from sessionStorage
    if (document.getElementById('selection-summary-box')) {
        loadStateFromSession();
        renderAnalysisSummary();
    }
    
    console.log('[PC BUILDER] App initialized. API: ' + (state.apiAvailable ? 'online' : 'offline (local)'));
}

/**
 * Dynamic Rendering of Hardware Categories with Filters
 */
function renderHardwareCategories() {
    var container = document.getElementById('component-categories');
    if (!container) return;

    container.innerHTML = '';
    var categories = getCategoriesList();
    var categoryMeta = getCategoryMetaObj();
    var filterConfig = getFilterConfigObj();

    categories.forEach(function(catKey, index) {
        var meta = categoryMeta[catKey];
        var options = getMockDatabaseObj()[catKey] || [];

        var catCard = document.createElement('div');
        catCard.className = 'card animate-reveal stagger-' + ((index % 4) + 1) + ' mb-3';

        // Build filter UI if category is filterable
        var filterHtml = '';
        if (meta.filterable && filterConfig[catKey]) {
            var filterState = state.filters[catKey] || {};
            filterHtml = '<div class="card-header bg-light py-2 px-3" style="border-bottom: 1px solid var(--border-color);">' +
                '<div class="row g-2" id="filters-' + catKey + '">' + renderFilters(catKey, filterState) + '</div>' +
                '</div>';
        }

        catCard.innerHTML =
            '<div class="card-header d-flex justify-content-between align-items-center"' +
            ' data-bs-toggle="collapse" data-bs-target="#cat-' + catKey + '" role="button">' +
            '<div class="d-flex align-items-center gap-2">' +
            '<span class="cat-icon"><i class="bi ' + meta.icon + '"></i></span>' +
            '<strong>' + meta.label + '</strong>' +
            '<span id="selected-badge-' + catKey + '" class="badge bg-primary d-none">' + getSelectedCount(catKey) + ' Selected</span>' +
            '</div>' +
            '<span class="badge badge-demo">DEMO</span>' +
            '</div>' +
            filterHtml +
            '<div id="cat-' + catKey + '" class="collapse" data-bs-parent="#component-categories">' +
            '<div class="card-body p-3">' +
            '<div class="row row-cols-1 row-cols-md-2 g-3" id="options-' + catKey + '"></div>' +
            '</div>' +
            '</div>';

        container.appendChild(catCard);
        renderOptions(catKey);
    });
}

/**
 * Render filter dropdowns based on filter config and available options
 */
function renderFilters(catKey, filterState) {
    var filterConfig = getFilterConfigObj();
    var configs = filterConfig[catKey] || [];
    var html = configs.map(function(cfg) {
        var options = getUniqueFilterValues(catKey, cfg.key);
        var selected = filterState[cfg.key];
        
        var optHtml = options.map(function(v) {
            return '<option value="' + escapeHtml(v) + '" ' + (selected === v ? 'selected' : '') + '>' + escapeHtml(v) + '</option>';
        }).join('');
        
        return '<div class="col-md-auto">' +
            '<label class="form-label small fw-medium mb-1">' + cfg.label + '</label>' +
            '<select class="form-select form-select-sm" onchange="updateFilter(\'' + catKey + '\', \'' + cfg.key + '\', this.value)">' +
            '<option value="">All ' + cfg.label + '</option>' +
            optHtml +
            '</select>' +
            '</div>';
    }).join('');
    
    return html;
}

/**
 * Get unique filter values for a field, applying cross-component compatibility
 */
function getUniqueFilterValues(catKey, fieldKey) {
    var items = getMockDatabaseObj()[catKey] || [];
    
    // For CPU: if manufacturer filter is set, only show matching families
    if (catKey === 'cpu' && fieldKey === 'family') {
        var manufacturer = state.filters.cpu && state.filters.cpu.manufacturer;
        if (manufacturer) {
            items = items.filter(function(item) { return item.manufacturer === manufacturer; });
        }
    }
    
    // For CPU: if family filter is set, only show matching generations
    if (catKey === 'cpu' && fieldKey === 'gen') {
        var family = state.filters.cpu && state.filters.cpu.family;
        if (family) {
            var manufacturer = state.filters.cpu && state.filters.cpu.manufacturer;
            if (manufacturer) {
                items = items.filter(function(item) { return item.manufacturer === manufacturer && item.family === family; });
            } else {
                items = items.filter(function(item) { return item.family === family; });
            }
        }
    }
    
    var values = new Set();
    items.forEach(function(item) {
        var val = item[fieldKey];
        if (val !== undefined && val !== null && val !== '') values.add(String(val));
    });
    return Array.from(values).sort(function(a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
}

/**
 * Update filter state and re-render options
 * Auto-expands the relevant category when filter changes
 */
function updateFilter(catKey, fieldKey, value) {
    state.filters[catKey] = state.filters[catKey] || {};
    state.filters[catKey][fieldKey] = value === '' ? null : value;
    
    // Re-render filters for CPU when manufacturer changes (to update family options)
    if (catKey === 'cpu' && fieldKey === 'manufacturer') {
        renderFiltersElement(catKey);
        // Also clear family and gen filters
        state.filters.cpu.family = null;
        state.filters.cpu.gen = null;
        renderFiltersElement(catKey); // Re-render to show cleared filters
    }
    
    // Re-render options
    renderOptions(catKey);
    
    // Auto-expand only this category when filter is applied
    expandCategory(catKey);
    
    // Cross-component: re-render affected categories
    if (catKey === 'cpu') {
        renderOptions('cpu');
    }
    if (catKey === 'motherboard') {
        renderOptions('ram');
        renderOptions('storage');
        renderOptions('motherboard'); // Re-render to show updated filters
    }
    if (catKey === 'ram') {
        renderOptions('motherboard');
    }
}

/**
 * Re-render filter elements for a category
 */
function renderFiltersElement(catKey) {
    var container = document.getElementById('filters-' + catKey);
    if (!container) return;
    var filterState = state.filters[catKey] || {};
    container.innerHTML = renderFilters(catKey, filterState);
}

/**
 * Get filtered items based on both user filters and cross-component compatibility
 */
function getFilteredItems(catKey) {
    var allItems = getMockDatabaseObj()[catKey] || [];
    var filterState = state.filters[catKey] || {};

    // Apply user-selected filters
    var filtered = allItems.filter(function(item) {
        for (var fKey in filterState) {
            var fVal = filterState[fKey];
            if (fVal && String(item[fKey]) !== fVal) return false;
        }
        return true;
    });

    // Apply cross-component compatibility filters
    
    // RAM must match motherboard RAM type
    if (catKey === 'ram' && state.selections.motherboard) {
        var mobo = findById('motherboard', state.selections.motherboard);
        if (mobo) {
            filtered = filtered.filter(function(item) { return item.type === mobo.ramType; });
        }
    }
    
    // Motherboard must match selected RAM type
    if (catKey === 'motherboard' && state.selections.ram && state.selections.ram.length > 0) {
        var ramType = findById('ram', state.selections.ram[0]);
        if (ramType) {
            filtered = filtered.filter(function(item) { return item.ramType === ramType.type; });
        }
    }
    
    return filtered;
}

/**
 * Render available options for a category, applying filters
 */
function renderOptions(catKey) {
    var optionsContainer = document.getElementById('options-' + catKey);
    if (!optionsContainer) return;

    var categoryMeta = getCategoryMetaObj();
    var meta = categoryMeta[catKey];
    var filtered = getFilteredItems(catKey);

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div class="col-12 text-muted small py-3 text-center">No components match the current filters and selections.</div>';
        return;
    }

    var isMulti = meta.multiSelect === true;
    var selectedIds = isMulti ? state.selections[catKey] : [state.selections[catKey]].filter(Boolean);

    optionsContainer.innerHTML = filtered.map(function(item) {
        var count = selectedIds.filter(function(id) { return id === item.id; }).length;
        var isSelected = count > 0;
        var compatWarnings = getCompatWarnings(catKey, item);

        var buttonText;
        if (isMulti) {
            if (isSelected && count > 0) {
                buttonText = 'Selected (' + count + 'x)';
            } else {
                buttonText = 'Add';
            }
        } else {
            buttonText = isSelected ? 'Selected' : 'Select';
        }

        return '<div class="col">' +
            '<div class="hardware-card h-100 ' + (isSelected ? 'border-primary shadow' : '') + '" id="card-' + item.id + '" onclick="toggleSelect(\'' + catKey + '\', \'' + item.id + '\')">' +
            '<div class="cat-icon d-flex justify-content-center align-items-center">' +
                '<i class="bi ' + meta.icon + '"></i>' +
            '</div>' +
            '<h3 class="h6 card-title text-center">' + escapeHtml(item.name) + '</h3>' +
            renderSpecs(item, catKey) +
            (compatWarnings ? '<div class="text-warning small mt-2">' + escapeHtml(compatWarnings) + '</div>' : '') +
            '<button type="button" class="btn btn-sm ' + (isSelected ? 'btn-primary' : 'btn-outline-primary') + ' w-100 select-btn mt-2">' +
            buttonText +
            '</button>' +
            '</div>' +
            '</div>';
    }).join('');
}

function getSelectedCount(catKey) {
    var sel = state.selections[catKey];
    if (Array.isArray(sel)) return sel.length;
    return sel ? 1 : 0;
}

/**
 * Compatibility Checks - inline warnings on hardware cards
 */
function getCompatWarnings(catKey, item) {
    var warnings = [];
    var categories = getCategoriesList();
    var categoryMeta = getCategoryMetaObj();
    var db = getMockDatabaseObj();

    // RAM type compatibility check
    if (catKey === 'ram') {
        var moboId = state.selections.motherboard;
        if (moboId) {
            var mobo = db.motherboard.find(function(m) { return m.id === moboId; });
            if (mobo) {
                if (item.type !== mobo.ramType) {
                    warnings.push('Incompatible RAM type: need ' + mobo.ramType + ', this is ' + item.type);
                }
                // Count total modules including this one
                var totalModules = state.selections.ram.length + 1;
                if (totalModules > mobo.ramSlots) {
                    warnings.push('Exceeds motherboard DIMM slots (' + totalModules + '/' + mobo.ramSlots + ')');
                }
            }
        }
    }

    if (catKey === 'storage') {
        var moboId = state.selections.motherboard;
        if (moboId) {
            var mobo = db.motherboard.find(function(m) { return m.id === moboId; });
            if (mobo) {
                // Count M.2 devices (including current item)
                var existingM2 = state.selections.storage.filter(function(s) {
                    var obj = findById('storage', s);
                    return obj && obj.interface && obj.interface.indexOf('NVMe') !== -1;
                }).length;
                var m2Count = item.interface && item.interface.indexOf('NVMe') !== -1 ? existingM2 + 1 : existingM2;

                // Count SATA devices (including current item)
                var existingSata = state.selections.storage.filter(function(s) {
                    var obj = findById('storage', s);
                    return obj && obj.interface && obj.interface.indexOf('SATA') !== -1;
                }).length;
                var sataCount = item.interface && item.interface.indexOf('SATA') !== -1 ? existingSata + 1 : existingSata;

                if (item.interface && item.interface.indexOf('NVMe') !== -1 && m2Count > mobo.m2Slots) {
                    warnings.push('Exceeds M.2 slots (' + m2Count + '/' + mobo.m2Slots + ')');
                }
                if (item.interface && item.interface.indexOf('SATA') !== -1 && sataCount > mobo.sataPorts) {
                    warnings.push('Exceeds SATA ports (' + sataCount + '/' + mobo.sataPorts + ')');
                }
            }
        }
    }

    return warnings.length ? warnings.join('; ') : null;
}

/**
 * Selection Toggle Logic
 * For multi-select: clicking adds an instance. If an index is provided, removes that specific instance.
 * For single-select: toggles on/off.
 */
window.toggleSelect = function(category, itemId, removeIndex) {
    var categoryMeta = getCategoryMetaObj();
    var meta = categoryMeta[category];
    var isMulti = meta.multiSelect === true;

    if (isMulti) {
        if (removeIndex !== undefined) {
            // Remove specific instance from the array
            state.selections[category].splice(removeIndex, 1);
        } else {
            // No index provided - add a new instance (allows multiple of same item)
            state.selections[category].push(itemId);
        }
    } else {
        // Single-select: toggle on/off
        var isDeselect = state.selections[category] === itemId;
        state.selections[category] = isDeselect ? null : itemId;
    }

    // Clear validation errors when user makes a selection
    clearValidationError();
    
    // Re-render dependent categories when key selections change
    if (category === 'motherboard') {
        renderOptions('ram');
        renderOptions('storage');
    }
    if (category === 'ram') {
        renderOptions('motherboard');
    }
    if (category === 'storage') {
        renderOptions('motherboard');
    }
    
    updateUI();
};

/**
 * UI Synchronization
 */
function updateUI() {
    updateHardwareCards();
    updateBuildSummary();
    updateCompletionTracker();
    updateCompatibilityStatus();
    updateCalculateButton();
}

/**
 * Update hardware card visual states
 */
function updateHardwareCards() {
    var categories = getCategoriesList();
    categories.forEach(function(catKey) {
        var categoryMeta = getCategoryMetaObj();
        var meta = categoryMeta[catKey];
        var isMulti = meta.multiSelect === true;
        var selectedIds = isMulti ? state.selections[catKey] : [state.selections[catKey]].filter(Boolean);
        var badge = document.getElementById('selected-badge-' + catKey);

        if (badge) {
            badge.innerText = selectedIds.length + ' Selected';
            badge.classList.toggle('d-none', selectedIds.length === 0);
        }

        var db = getMockDatabaseObj();
        var options = db[catKey] || [];
        options.forEach(function(item) {
            var card = document.getElementById('card-' + item.id);
            if (card) {
                var count = selectedIds.filter(function(id) { return id === item.id; }).length;
                var isSelected = count > 0;
                card.classList.toggle('border-primary', isSelected);
                card.classList.toggle('shadow', isSelected);
                var btn = card.querySelector('.select-btn');
                if (btn) {
                    if (isMulti) {
                        if (isSelected && count > 0) {
                            btn.innerText = 'Selected (' + count + 'x)';
                        } else {
                            btn.innerText = 'Add';
                        }
                    } else {
                        btn.innerText = isSelected ? 'Selected' : 'Select';
                    }
                    btn.classList.toggle('btn-primary', isSelected);
                    btn.classList.toggle('btn-outline-primary', !isSelected);
                }
            }
        });
    });
}

/**
 * Helper to get display text for item modules or capacity
 */
function itemModulesOrCapacity(item, catKey) {
    if (catKey === 'ram') return item.modules || (item.capacity_GB + 'GB');
    if (catKey === 'storage') return item.capacity_GB + 'GB';
    return '';
}

/**
 * Update the Build Summary panel with selected components
 */
function updateBuildSummary() {
    var categoryMeta = getCategoryMetaObj();
    var categories = getCategoriesList();
    var db = getMockDatabaseObj();
    var list = document.getElementById('summary-list');
    var emptyMsg = document.getElementById('summary-empty');
    if (!list || !emptyMsg) return;

    list.innerHTML = '';
    var hasAny = false;

    categories.forEach(function(catKey) {
        var meta = categoryMeta[catKey];
        var isMulti = meta.multiSelect === true;
        var selectedIds = isMulti ? state.selections[catKey] : [state.selections[catKey]].filter(Boolean);

        if (selectedIds.length > 0) {
            hasAny = true;

            if (isMulti) {
                // Multi-select: group by item ID, show quantity and individual remove buttons
                var itemGroups = {};
                selectedIds.forEach(function(id, idx) {
                    if (!itemGroups[id]) itemGroups[id] = { indices: [] };
                    itemGroups[id].indices.push(idx);
                });

                for (var itemId in itemGroups) {
                    var item = db[catKey].find(function(it) { return it.id === itemId; });
                    if (!item) continue;
                    
                    var count = itemGroups[itemId].indices.length;
                    var li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.innerHTML =
                        '<div class="d-flex flex-column">' +
                        '<div class="d-flex align-items-center mb-1">' +
                        '<span class="item-label">' + meta.short + '</span>' +
                        '<span class="badge bg-info text-dark ms-auto">' + count + 'x - ' + escapeHtml(itemModulesOrCapacity(item, catKey)) + '</span>' +
                        '</div>' +
                        '<div class="item-value">' + escapeHtml(item.name) + '</div>' +
                        '<div class="btn-group btn-group-sm mt-1" role="group">' +
                        itemGroups[itemId].indices.map(function(idx) {
                            return '<button type="button" class="btn-remove-small" onclick="toggleSelect(\'' + catKey + '\', \'' + item.id + '\', ' + idx + ')" title="Remove one">' +
                                '<i class="bi bi-x-lg"></i>' +
                                '</button>';
                        }).join('') +
                        '</div>' +
                        '</div>';
                    list.appendChild(li);
                }
                
                // Show total capacity for RAM and Storage
                var items = selectedIds.map(function(id) { return db[catKey].find(function(it) { return it.id === id; }); }).filter(Boolean);
                var totalCapacity = 0;
                items.forEach(function(i) { totalCapacity += (i.capacity_GB || 0); });
                if (totalCapacity > 0) {
                    var capacityLabel = catKey === 'ram' ? 'Total RAM' : 'Total Storage';
                    var capLi = document.createElement('li');
                    capLi.className = 'list-group-item bg-light';
                    capLi.innerHTML =
                        '<div class="d-flex justify-content-between align-items-center">' +
                        '<span class="item-label fw-bold">' + capacityLabel + '</span>' +
                        '<span class="item-value text-primary">' + totalCapacity + ' GB</span>' +
                        '</div>';
                    list.appendChild(capLi);
                }
            } else {
                // Single-select
                var item = db[catKey].find(function(it) { return it.id === selectedIds[0]; });
                if (item) {
                    var li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.innerHTML =
                        '<div class="d-flex justify-content-between align-items-center">' +
                        '<div>' +
                        '<span class="item-label">' + meta.short + '</span>' +
                        '<span class="item-value text-primary">' + escapeHtml(item.name) + '</span>' +
                        '</div>' +
                        '<button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2 py-0" onclick="toggleSelect(\'' + catKey + '\', \'' + item.id + '\')">' +
                        '<i class="bi bi-x"></i>' +
                        '</button>' +
                        '</div>';
                    list.appendChild(li);
                }
            }
        } else {
            // Empty state for this category
            var li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML =
                '<div class="d-flex justify-content-between align-items-center">' +
                '<span class="item-label text-muted">' + meta.short + '</span>' +
                '<span class="item-value text-muted small">Not Selected</span>' +
                '</div>';
            list.appendChild(li);
        }
    });

    emptyMsg.classList.toggle('d-none', hasAny);
}

/**
 * Update completion tracker progress
 */
function updateCompletionTracker() {
    var filled = 0;
    var categories = getCategoriesList();
    var categoryMeta = getCategoryMetaObj();
    categories.forEach(function(catKey) {
        var meta = categoryMeta[catKey];
        if (meta.multiSelect) {
            if (state.selections[catKey].length > 0) filled++;
        } else {
            if (state.selections[catKey]) filled++;
        }
    });
    var percent = Math.round((filled / 8) * 100);

    var bar = document.getElementById('completion-bar');
    var text = document.getElementById('completion-percent');

    if (bar) {
        bar.style.width = percent + '%';
        bar.setAttribute('aria-valuenow', percent);
        bar.classList.toggle('bg-success', percent === 100);
        bar.classList.toggle('bg-info', percent < 100);
    }
    if (text) text.innerText = percent + '%';
}

/**
 * Update compatibility status in the analysis panel
 * Uses the analysis engine's results (now from API)
 */
async function updateCompatibilityStatus() {
    if (state.apiAvailable) {
        // Use API-based analysis
        try {
            var result = await analysisAPI.analyze(state.selections);
            var compatStatus = document.getElementById('compat-status');
            var compatText = document.getElementById('compat-text');

            if (!compatStatus || !compatText) return;

            var allIssues = [];

            if (result.blockingErrors && result.blockingErrors.length > 0) {
                result.blockingErrors.forEach(function(e) {
                    allIssues.push('<div class="text-danger">' + escapeHtml(e.text) + '</div>');
                });
            }
            if (result.warnings && result.warnings.length > 0) {
                result.warnings.forEach(function(w) {
                    allIssues.push('<div class="text-warning">' + escapeHtml(w.text) + '</div>');
                });
            }

            if (allIssues.length === 0) {
                compatStatus.className = 'text-success small mb-3';
                compatText.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>All components compatible';
            } else {
                compatStatus.className = 'text-warning small mb-3';
                compatText.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>' + allIssues.join('');
            }
        } catch (e) {
            console.warn('[PC BUILDER] Analysis API failed:', e);
            // Fall through to local fallback
        }
    }

    // Fallback: use local analysis engine
    var analysis = performAnalysis();
    var compatStatus = document.getElementById('compat-status');
    var compatText = document.getElementById('compat-text');

    if (!compatStatus || !compatText) return;

    var allIssues = [];

    if (analysis.blockingErrors && analysis.blockingErrors.length > 0) {
        analysis.blockingErrors.forEach(function(e) {
            allIssues.push('<div class="text-danger">' + escapeHtml(e.text) + '</div>');
        });
    }
    if (analysis.warnings && analysis.warnings.length > 0) {
        analysis.warnings.forEach(function(w) {
            allIssues.push('<div class="text-warning">' + escapeHtml(w.text) + '</div>');
        });
    }

    if (allIssues.length === 0) {
        compatStatus.className = 'text-success small mb-3';
        compatText.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>All components compatible';
    } else {
        compatStatus.className = 'text-warning small mb-3';
        compatText.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>' + allIssues.join('');
    }
}

/**
 * Expand a category if collapsed
 */
function expandCategory(catKey) {
    var el = document.getElementById('cat-' + catKey);
    if (el && el.classList.contains('collapse') && !el.classList.contains('show')) {
        var collapse = bootstrap.Collapse.getInstance(el) || new bootstrap.Collapse(el, { toggle: false });
        collapse.show();
    }
}

/**
 * Scroll to and highlight a category
 */
function scrollToCategory(catKey) {
    var headerEl = document.querySelector('[data-bs-target="#cat-' + catKey + '"]');
    if (headerEl) {
        headerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        headerEl.classList.add('highlight-missing');
        setTimeout(function() {
            headerEl.classList.remove('highlight-missing');
        }, 3000);
    }
}

/**
 * Show validation error message to user
 */
function showValidationError(missing, blockingErrors) {
    var container = document.getElementById('component-categories');
    if (!container) return;
    
    // Remove any existing error box
    var existing = document.getElementById('validation-error-box');
    if (existing) existing.remove();
    
    var html = '<div id="validation-error-box" class="alert alert-danger small shadow-sm mb-3">' +
        '<h4 class="h6 fw-bold mb-2"><i class="bi bi-x-circle me-1"></i>Cannot Analyze - Missing Components</h4>';
    
    if (missing && missing.length > 0) {
        html += '<p class="mb-1">Please select at least one component from:</p><ul class="mb-0">';
        var categoryMeta = getCategoryMetaObj();
        missing.forEach(function(catKey) {
            var meta = categoryMeta[catKey];
            html += '<li>' + (meta ? meta.label : catKey) + '</li>';
        });
        html += '</ul>';
    }
    
    if (blockingErrors && blockingErrors.length > 0) {
        html += '<hr class="my-2"><p class="mb-1">Fix compatibility issues:</p><ul class="mb-0">';
        blockingErrors.forEach(function(e) {
            html += '<li>' + escapeHtml(e.text) + '</li>';
        });
        html += '</ul>';
    }
    
    html += '</div>';
    
    container.insertBefore(document.createRange().createContextualFragment(html).firstChild, container.firstChild);
}

/**
 * Show API error message to user
 */
function showApiError(message) {
    var container = document.getElementById('component-categories');
    if (!container) return;
    
    var existing = document.getElementById('api-error-box');
    if (existing) existing.remove();
    
    var html = '<div id="api-error-box" class="alert alert-warning small shadow-sm mb-3">' +
        '<h4 class="h6 fw-bold mb-2"><i class="bi bi-wifi-off me-1"></i>API Connection Failed</h4>' +
        '<p class="mb-0">' + escapeHtml(message) + '</p>' +
        '<p class="small mt-1 mb-0">Falling back to local demo data. Some features may be limited.</p>' +
        '</div>';
    
    container.insertBefore(document.createRange().createContextualFragment(html).firstChild, container.firstChild);
}

function clearApiError() {
    var existing = document.getElementById('api-error-box');
    if (existing) existing.remove();
}

/**
 * Clear validation error message
 */
function clearValidationError() {
    var existing = document.getElementById('validation-error-box');
    if (existing) existing.remove();
}

/**
 * Setup Calculate button - validates all required categories before navigation
 * Uses API-based analysis when available
 */
function setupCalculateButton() {
    var btn = document.getElementById('calculate-btn');
    if (!btn) return;

    btn.onclick = async function() {
        // Clear any previous validation errors
        clearValidationError();
        clearApiError();
        
        var allMissing = [];
        var analysisResult = null;
        var blockingErrors = [];
        var warnings = [];

        if (state.apiAvailable) {
            // Use API-based analysis
            try {
                analysisResult = await analysisAPI.analyze(state.selections);
                allMissing = analysisResult.missingCategories || [];
                blockingErrors = analysisResult.blockingErrors || [];
                warnings = analysisResult.warnings || [];
            } catch (e) {
                console.warn('[PC BUILDER] Analysis API failed, falling back to local analysis:', e);
                state.apiAvailable = false;
                showApiError(e.message || 'Could not connect to backend.');
            }
        }

        // Fallback to local analysis engine if API failed or unavailable
        if (!analysisResult) {
            analysisResult = performAnalysis();
            allMissing = analysisResult.missingCategories;
            blockingErrors = analysisResult.blockingErrors;
            warnings = analysisResult.warnings;
        }
        
        var valid = analysisResult.valid;
        
        if (!valid) {
            if (allMissing.length > 0) {
                // Scroll to and expand first missing category
                var firstMissing = allMissing[0];
                expandCategory(firstMissing);
                scrollToCategory(firstMissing);
            } else if (blockingErrors.length > 0) {
                // Scroll to the first blocking error's category
                var firstErrorCat = blockingErrors[0].category;
                expandCategory(firstErrorCat);
                scrollToCategory(firstErrorCat);
            }
            
            showValidationError(allMissing, blockingErrors);
            return;
        }
        
        // Validation passed - store state and analysis result, then navigate
        sessionStorage.setItem('pcBuilderSelections', JSON.stringify(state.selections));
        sessionStorage.setItem('pcBuilderAnalysis', JSON.stringify(analysisResult));
        window.location.href = 'analysis.html';
    };
}

/**
 * Show/hide calculate button based on selections
 */
function updateCalculateButton() {
    var btn = document.getElementById('calculate-btn');
    if (!btn) return;
    
    var hasSelections = getCategoriesList().some(function(k) {
        return (Array.isArray(state.selections[k]) ? state.selections[k].length : state.selections[k]);
    });
    
    // Button is visible when at least one component is selected
    // Validation happens in setupCalculateButton when clicked
    btn.classList.toggle('d-none', !hasSelections);
    
    // Show help text when no selections
    var helpText = document.querySelector('#calculate-section p.text-muted');
    if (helpText) {
        if (!hasSelections) {
            helpText.classList.remove('d-none');
        } else {
            helpText.classList.add('d-none');
        }
    }
}

/**
 * Load state from sessionStorage (for analysis page)
 */
function loadStateFromSession() {
    var saved = sessionStorage.getItem('pcBuilderSelections');
    if (saved) {
        try {
            var savedSelections = JSON.parse(saved);
            state.selections = {
                cpu: savedSelections.cpu || null,
                gpu: savedSelections.gpu || null,
                ram: savedSelections.ram || [],
                motherboard: savedSelections.motherboard || null,
                storage: savedSelections.storage || [],
                psu: savedSelections.psu || null,
                case: savedSelections.case || null,
                cooler: savedSelections.cooler || null
            };
        } catch (e) {
            console.warn('[PC BUILDER] Failed to restore state from sessionStorage');
        }
    }
}

/**
 * Render the analysis page summary from current state
 */
function renderAnalysisSummary() {
    var categoryMeta = getCategoryMetaObj();
    var categories = getCategoriesList();
    var db = getMockDatabaseObj();
    var list = document.getElementById('summary-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    categories.forEach(function(catKey) {
        var meta = categoryMeta[catKey];
        var isMulti = meta.multiSelect === true;
        var selectedIds = isMulti ? state.selections[catKey] : [state.selections[catKey]].filter(Boolean);
        
        if (selectedIds && selectedIds.length > 0) {
            if (isMulti) {
                var items = selectedIds.map(function(id) { return db[catKey].find(function(it) { return it.id === id; }); }).filter(Boolean);
                var totalCapacity = 0;
                items.forEach(function(i) { totalCapacity += (i.capacity_GB || 0); });
                
                var li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML =
                    '<div class="d-flex justify-content-between">' +
                    '<strong>' + escapeHtml(meta.label) + '</strong>' +
                    '<span class="text-muted">' + selectedIds.length + ' modules' + (totalCapacity > 0 ? ' (' + totalCapacity + ' GB)' : '') + '</span>' +
                    '</div>' +
                    '<div class="text-muted small">' + escapeHtml(items.map(function(i) { return i.name; }).join(', ')) + '</div>';
                list.appendChild(li);
            } else {
                var item = db[catKey].find(function(it) { return it.id === selectedIds[0]; });
                if (item) {
                    var li2 = document.createElement('li');
                    li2.className = 'list-group-item';
                    li2.innerHTML =
                        '<div class="d-flex justify-content-between">' +
                        '<strong>' + escapeHtml(meta.label) + '</strong>' +
                        '<span class="text-muted">' + escapeHtml(item.name) + '</span>' +
                        '</div>';
                    list.appendChild(li2);
                }
            }
        }
    });
    
    // Update compatibility status using analysis engine
    updateCompatibilityStatus();
}

/**
 * Setup Clear All button
 */
function setupClearAll() {
    var btn = document.getElementById('clear-all-btn');
    if (!btn) return;

    btn.onclick = function() {
        var hasSelections = getCategoriesList().some(function(k) {
            return (Array.isArray(state.selections[k]) ? state.selections[k].length : state.selections[k]);
        });
        if (hasSelections) {
            if (confirm('Clear all component selections?')) {
                var categories = getCategoriesList();
                var categoryMeta = getCategoryMetaObj();
                categories.forEach(function(k) {
                    if (categoryMeta[k].multiSelect) state.selections[k] = [];
                    else state.selections[k] = null;
                    // Reset filters
                    if (state.filters[k]) {
                        Object.keys(state.filters[k]).forEach(function(fk) { state.filters[k][fk] = null; });
                    }
                });
                sessionStorage.removeItem('pcBuilderSelections');
                sessionStorage.removeItem('pcBuilderAnalysis');
                
                // If on analysis page, redirect back to builder
                var isAnalysisPage = document.getElementById('selection-summary-box') !== null;
                if (isAnalysisPage) {
                    window.location.href = 'index.html';
                } else {
                    renderHardwareCategories();
                    updateUI();
                }
            }
        }
    };
}

/**
 * Setup Back to Top button
 */
function setupBackToTop() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;

    window.addEventListener('scroll', function() {
        btn.style.display = window.scrollY > 400 ? 'block' : 'none';
    });

    btn.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

/**
 * Setup reveal animation observer
 */
function setupRevealObserver() {
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.classList.add('animate-reveal');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-reveal').forEach(function(el) { observer.observe(el); });
}

/**
 * Utility: escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (text === undefined || text === null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
