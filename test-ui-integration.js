/**
 * UI Integration Tests for Analysis Engine
 * Tests the integration between ui-behavior.js and analysis-engine.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read source files
const mockDb = fs.readFileSync(path.join(__dirname, 'assets/js/mock-database.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, 'assets/js/analysis-engine.js'), 'utf8');

// Create VM context
const context = vm.createContext({
    console: console,
    module: module,
    exports: {},
    require: require,
    __dirname: __dirname
});

// Load mock-database
vm.runInContext(mockDb, context, { filename: 'mock-database.js' });

// Create a mock state object (mimics ui-behavior.js state)
context.state = {
    selections: {
        cpu: null,
        gpu: null,
        ram: [],
        motherboard: null,
        storage: [],
        psu: null,
        case: null,
        cooler: null
    }
};

// Mock findById function
context.findById = function(catKey, id) {
    return (context.MOCK_DATABASE[catKey] || []).find(function(item) {
        return item.id === id;
    });
};

// Mock CATEGORY_META
context.CATEGORY_META = context.CATEGORY_META || {};

// Mock MOCK_DATABASE, CATEGORIES, FILTER_CONFIG, parseTotalCapacityGB
context.MOCK_DATABASE = context.MOCK_DATABASE;
context.CATEGORIES = context.CATEGORIES;
context.FILTER_CONFIG = context.FILTER_CONFIG;
context.parseTotalCapacityGB = context.parseTotalCapacityGB;

// Mock sessionStorage
var sessionStorageData = {};
context.sessionStorage = {
    getItem: function(key) { return sessionStorageData[key] || null; },
    setItem: function(key, value) { sessionStorageData[key] = value; },
    removeItem: function(key) { delete sessionStorageData[key]; }
};

// Mock escapeHtml function
context.escapeHtml = function(text) {
    if (text === undefined || text === null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Load analysis engine
vm.runInContext(engine, context, { filename: 'analysis-engine.js' });

// Test counter
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}: ${e.message}`);
        failed++;
    }
}

// Setup a complete valid configuration
function setupCompleteValidConfig() {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_6400_32'],
        motherboard: 'mobo_z790_atx',
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
}

// Test: performAnalysis returns analysis object with correct structure
test('performAnalysis returns object with expected structure', () => {
    setupCompleteValidConfig();
    const analysis = context.performAnalysis();
    
    if (!analysis.hasOwnProperty('valid')) throw new Error('Missing "valid" property');
    if (!analysis.hasOwnProperty('validation')) throw new Error('Missing "validation" property');
    if (!analysis.hasOwnProperty('missingCategories')) throw new Error('Missing "missingCategories" property');
    if (!analysis.hasOwnProperty('blockingErrors')) throw new Error('Missing "blockingErrors" property');
    if (!analysis.hasOwnProperty('warnings')) throw new Error('Missing "warnings" property');
    if (!analysis.hasOwnProperty('performance')) throw new Error('Missing "performance" property');
    if (!analysis.hasOwnProperty('isEstimate')) throw new Error('Missing "isEstimate" property');
});

// Test: Missing categories property name matches UI expectations
test('missingCategories is an array', () => {
    context.state.selections = {
        cpu: null, gpu: null, ram: [], motherboard: null,
        storage: [], psu: null, case: null, cooler: null
    };
    const analysis = context.performAnalysis();
    if (!Array.isArray(analysis.missingCategories)) {
        throw new Error('missingCategories should be an array');
    }
    if (analysis.missingCategories.length !== 8) {
        throw new Error('Expected 8 missing categories, got: ' + analysis.missingCategories.length);
    }
});

// Test: blockingErrors has correct structure
test('blockingErrors entries have correct properties', () => {
    context.state.selections = {
        cpu: 'cpu_r9_7950x3d',  // AM5
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_6400_32'],
        motherboard: 'mobo_z790_atx',  // LGA 1700 - incompatible
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    const analysis = context.performAnalysis();
    if (analysis.blockingErrors.length === 0) {
        throw new Error('Expected blocking errors for incompatible build');
    }
    for (var i = 0; i < analysis.blockingErrors.length; i++) {
        var e = analysis.blockingErrors[i];
        if (typeof e.text !== 'string') throw new Error('Error missing "text" property');
        if (typeof e.category !== 'string') throw new Error('Error missing "category" property');
        if (e.type !== 'error') throw new Error('Expected type to be "error"');
    }
});

// Test: warnings are distinguished from errors
test('warnings have type="warning" and are separate from blockingErrors', () => {
    // Setup with M.2 slot overflow (warning, not blocking error)
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_5600_16'],
        motherboard: 'mobo_b650_matx',  // 1 M.2 slot
        storage: ['ssd_980_pro_1', 'ssd_990_pro_2'],  // 2 NVMe drives
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    
    // This should be valid (just a warning) but let's check warnings separately
    const analysis = context.performAnalysis();
    if (!analysis.warnings) {
        throw new Error('Expected warnings array');
    }
    for (var i = 0; i < analysis.warnings.length; i++) {
        if (analysis.warnings[i].type !== 'warning') {
            throw new Error('Expected warning type to be "warning"');
        }
    }
});

// Test: Performance object has all required properties
test('performance object has all required analysis properties', () => {
    setupCompleteValidConfig();
    const analysis = context.performAnalysis();
    var perf = analysis.performance;
    
    if (!perf.workloadScores) throw new Error('Missing workloadScores');
    if (!perf.bottleneck) throw new Error('Missing bottleneck');
    if (!perf.fpsEstimates) throw new Error('Missing fpsEstimates');
    if (!perf.powerConsumption) throw new Error('Missing powerConsumption');
    if (!perf.storageBandwidth) throw new Error('Missing storageBandwidth');
    if (!perf.memoryCapacity) throw new Error('Missing memoryCapacity');
    if (!perf.hasEstimates) throw new Error('Missing hasEstimates');
    if (perf.estimateQuality !== 'estimated') throw new Error('Expected estimateQuality="estimated"');
});

// Test: Performance analysis with missing optional components still works
test('performance analysis works with minimal valid config', () => {
    // Use a config with single RAM module, basic storage
    context.state.selections = {
        cpu: 'cpu_i5_12400f',
        gpu: 'gpu_rtx_3060',
        ram: ['ram_ddr4_3200_8'],   // 8GB DDR4
        motherboard: 'mobo_z690_atx',  // DDR4, LGA 1700
        storage: ['hdd_barracuda_2'],
        psu: 'psu_evga_600',
        case: 'case_h5_flow',
        cooler: 'cooler_pure_rock'
    };
    
    const analysis = context.performAnalysis();
    if (!analysis.valid) {
        throw new Error('Expected valid config, got errors: ' + JSON.stringify(analysis.blockingErrors));
    }
    if (analysis.performance.memoryCapacity.totalCapacity !== 8) {
        throw new Error('Expected 8GB total RAM, got: ' + analysis.performance.memoryCapacity.totalCapacity);
    }
});

// Test: Analysis object is serializable (for sessionStorage storage)
test('analysis object is JSON-serializable', () => {
    setupCompleteValidConfig();
    const analysis = context.performAnalysis();
    
    var serialized = JSON.stringify(analysis);
    var restored = JSON.parse(serialized);
    
    if (restored.valid !== true) throw new Error('valid not preserved');
    if (restored.performance.workloadScores.gaming !== analysis.performance.workloadScores.gaming) {
        throw new Error('workloadScores not preserved');
    }
});

// Test: Empty selections handled gracefully
test('performAnalysis handles empty selections gracefully', () => {
    context.state.selections = {
        cpu: null, gpu: null, ram: [], motherboard: null,
        storage: [], psu: null, case: null, cooler: null
    };
    const analysis = context.performAnalysis();
    
    if (analysis.valid !== false) throw new Error('Expected invalid for empty config');
    if (analysis.performance !== null) throw new Error('Expected null performance for invalid config');
    if (analysis.missingCategories.length !== 8) throw new Error('Expected 8 missing categories');
});

// Test: Analysis result structure matches what UI expects
test('analysis.blockingErrors matches UI showValidationError expectations', () => {
    context.state.selections = {
        cpu: 'cpu_r9_7950x3d',  // AM5
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_6400_32'],
        motherboard: 'mobo_z790_atx',  // LGA 1700
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    const analysis = context.performAnalysis();
    
    // The UI code does: analysis.missingCategories and analysis.blockingErrors
    if (!Array.isArray(analysis.missingCategories)) throw new Error('missingCategories should be array');
    if (!Array.isArray(analysis.blockingErrors)) throw new Error('blockingErrors should be array');
    
    // blockingErrors should have category and text properties (used in UI)
    if (analysis.blockingErrors.length > 0) {
        var error = analysis.blockingErrors[0];
        if (!error.category) throw new Error('blockingErrors items should have category');
        if (!error.text) throw new Error('blockingErrors items should have text');
    }
});

// Summary
console.log('\n--- UI Integration Test Results ---');
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
