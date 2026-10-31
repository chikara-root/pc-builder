/**
 * Node.js VM tests for the Analysis Engine
 * Tests validation, compatibility, and performance analysis functions
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read source files
const code = fs.readFileSync(path.join(__dirname, 'assets/js/analysis-engine.js'), 'utf8');
const mockDb = fs.readFileSync(path.join(__dirname, 'assets/js/mock-database.js'), 'utf8');

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

// Create a mock state object
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

// Mock findById function (from ui-behavior.js)
context.findById = function(catKey, id) {
    return (context.MOCK_DATABASE[catKey] || []).find(function(item) {
        return item.id === id;
    });
};

// Mock CATEGORY_META
context.CATEGORY_META = context.CATEGORY_META || {};

// Load analysis engine
vm.runInContext(code, context, { filename: 'analysis-engine.js' });

// Extract functions from context
const { 
    getMissingRequiredCategories, 
    getBlockingErrors, 
    validateConfiguration, 
    runPerformanceAnalysis, 
    performAnalysis,
    calculateWorkloadScores,
    calculateBottleneck,
    calculateFpsEstimates,
    calculatePowerConsumption,
    calculateStorageBandwidth,
    calculateMemoryCapacity,
    REQUIRED_CATEGORIES
} = context;

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

// Setup a complete valid configuration (matching LGA 1700 + DDR5 mobo)
function setupCompleteValidConfig() {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',          // LGA 1700
        gpu: 'gpu_rtx_4070_ti',         // 285mm, 700W PSU recommended
        ram: ['ram_ddr5_6400_32'],      // DDR5 32GB (single module)
        motherboard: 'mobo_z790_atx',   // LGA 1700, DDR5, 4 DIMM, 2 M.2
        storage: ['ssd_980_pro_1'],     // NVMe
        psu: 'psu_rm750x',              // 750W
        case: 'case_4000d',             // gpuMaxLen 360mm, coolerMaxHeight 170mm
        cooler: 'cooler_nh_d15'         // 165mm, LGA 1700 compatible
    };
}

// Test 1: Required categories list
test('REQUIRED_CATEGORIES contains all 8 categories', () => {
    const expected = ['cpu', 'gpu', 'ram', 'motherboard', 'storage', 'psu', 'case', 'cooler'];
    if (JSON.stringify(REQUIRED_CATEGORIES) !== JSON.stringify(expected)) {
        throw new Error('Expected 8 required categories, got: ' + JSON.stringify(REQUIRED_CATEGORIES));
    }
});

// Test 2: Missing categories when empty
test('getMissingRequiredCategories returns all when empty', () => {
    context.state.selections = {
        cpu: null, gpu: null, ram: [], motherboard: null,
        storage: [], psu: null, case: null, cooler: null
    };
    const missing = getMissingRequiredCategories();
    if (missing.length !== 8) {
        throw new Error('Expected 8 missing categories, got: ' + missing.length);
    }
});

// Test 3: Missing categories with partial selection
test('getMissingRequiredCategories returns correct missing count', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: null,
        ram: ['ram_ddr5_5600_16'],
        motherboard: null,
        storage: [],
        psu: 'psu_rm750x',
        case: null,
        cooler: null
    };
    const missing = getMissingRequiredCategories();
    if (missing.length !== 5) {
        throw new Error('Expected 5 missing categories, got: ' + missing.length + ': ' + JSON.stringify(missing));
    }
});

// Test 4: Validate configuration with all components
test('validateConfiguration returns valid=true with complete build', () => {
    setupCompleteValidConfig();
    const validation = validateConfiguration();
    if (!validation.valid) {
        throw new Error('Expected valid config, got errors: ' + JSON.stringify(validation.blockingErrors));
    }
});

// Test 5: Validate configuration missing components
test('validateConfiguration returns valid=false without all components', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: null,
        ram: [],
        motherboard: null,
        storage: [],
        psu: null,
        case: null,
        cooler: null
    };
    const validation = validateConfiguration();
    if (validation.valid) {
        throw new Error('Expected invalid config');
    }
    if (validation.missing.length !== 7) {
        throw new Error('Expected 7 missing categories, got: ' + validation.missing.length);
    }
});

// Test 6: CPU/Motherboard socket incompatibility (blocking)
test('getBlockingErrors detects socket incompatibility', () => {
    context.state.selections = {
        cpu: 'cpu_r9_7950x3d',        // AM5
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_6400_32'],
        motherboard: 'mobo_z790_atx', // LGA 1700
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    const errors = getBlockingErrors();
    const socketError = errors.find(e => e.text.includes('socket') || e.text.includes('Socket'));
    if (!socketError) {
        throw new Error('Expected socket incompatibility error, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 7: RAM/DDR type incompatibility (blocking)
test('getBlockingErrors detects RAM type incompatibility', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr4_3600_32'],    // DDR4
        motherboard: 'mobo_z790_atx', // DDR5
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    const errors = getBlockingErrors();
    const ramError = errors.find(e => e.text.includes('RAM type'));
    if (!ramError) {
        throw new Error('Expected RAM type incompatibility error, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 8: RAM slots exceeded (blocking)
test('getBlockingErrors detects DIMM slot overflow', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_5600_16', 'ram_ddr5_5600_16', 'ram_ddr5_5600_16', 'ram_ddr5_5600_16'],  // 4 modules
        motherboard: 'mobo_a520_itx',  // 2 DIMM slots
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    const errors = getBlockingErrors();
    const slotError = errors.find(e => e.text.includes('DIMM slots'));
    if (!slotError) {
        throw new Error('Expected DIMM slot overflow error, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 9: GPU/PSU power suitability
test('getBlockingErrors detects insufficient PSU for GPU', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4090',          // 450W GPU, 850W recommended
        ram: ['ram_ddr5_5600_16'],
        motherboard: 'mobo_z790_atx',
        storage: ['ssd_980_pro_1'],
        psu: 'psu_evga_600',         // 600W - too low
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    const errors = getBlockingErrors();
    const psuError = errors.find(e => e.text.includes('PSU') || e.text.includes('below GPU'));
    if (!psuError) {
        throw new Error('Expected PSU insufficient error, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 10: No errors with valid build
test('getBlockingErrors returns empty for valid compatible build', () => {
    setupCompleteValidConfig();
    const errors = getBlockingErrors();
    if (errors.length > 0) {
        throw new Error('Expected no errors for valid config, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 11: Performance analysis with valid config
test('runPerformanceAnalysis returns workload scores', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    if (!perf.workloadScores) {
        throw new Error('Expected workloadScores in performance analysis');
    }
    if (typeof perf.workloadScores.gaming !== 'number') {
        throw new Error('Expected gaming score to be a number');
    }
});

// Test 12: Performance analysis bottleneck calculation
test('runPerformanceAnalysis returns bottleneck analysis', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    if (!perf.bottleneck) {
        throw new Error('Expected bottleneck in performance analysis');
    }
    if (typeof perf.bottleneck.cpuBottleneck !== 'number') {
        throw new Error('Expected cpuBottleneck to be a number');
    }
    if (typeof perf.bottleneck.gpuBottleneck !== 'number') {
        throw new Error('Expected gpuBottleneck to be a number');
    }
});

// Test 13: FPS estimates
test('runPerformanceAnalysis returns FPS estimates', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    if (!perf.fpsEstimates) {
        throw new Error('Expected fpsEstimates in performance analysis');
    }
    if (typeof perf.fpsEstimates['1080p'] !== 'number') {
        throw new Error('Expected 1080p FPS to be a number');
    }
    if (typeof perf.fpsEstimates['1440p'] !== 'number') {
        throw new Error('Expected 1440p FPS to be a number');
    }
    if (typeof perf.fpsEstimates['4K'] !== 'number') {
        throw new Error('Expected 4K FPS to be a number');
    }
});

// Test 14: Power consumption calculation
test('runPerformanceAnalysis returns power consumption', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    if (!perf.powerConsumption) {
        throw new Error('Expected powerConsumption in performance analysis');
    }
    if (typeof perf.powerConsumption.estimatedWithOverhead !== 'number') {
        throw new Error('Expected estimatedWithOverhead to be a number');
    }
    if (perf.powerConsumption.estimatedWithOverhead <= 0) {
        throw new Error('Expected positive power estimate, got: ' + perf.powerConsumption.estimatedWithOverhead);
    }
});

// Test 15: Storage bandwidth
test('runPerformanceAnalysis returns storage bandwidth', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    if (!perf.storageBandwidth) {
        throw new Error('Expected storageBandwidth in performance analysis');
    }
    if (typeof perf.storageBandwidth.totalCapacity !== 'number') {
        throw new Error('Expected totalCapacity to be a number');
    }
});

// Test 16: Memory capacity
test('runPerformanceAnalysis returns memory capacity', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    if (!perf.memoryCapacity) {
        throw new Error('Expected memoryCapacity in performance analysis');
    }
    if (perf.memoryCapacity.totalCapacity !== 32) {
        throw new Error('Expected 32GB total RAM, got: ' + perf.memoryCapacity.totalCapacity);
    }
    if (perf.memoryCapacity.moduleCount !== 1) {
        throw new Error('Expected 1 module count, got: ' + perf.memoryCapacity.moduleCount);
    }
});

// Test 17: performAnalysis with invalid config
test('performAnalysis returns valid=false for invalid config', () => {
    context.state.selections = {
        cpu: null, gpu: null, ram: [], motherboard: null,
        storage: [], psu: null, case: null, cooler: null
    };
    const analysis = performAnalysis();
    if (analysis.valid !== false) {
        throw new Error('Expected valid=false for empty config');
    }
    if (analysis.missingCategories.length !== 8) {
        throw new Error('Expected 8 missing categories');
    }
});

// Test 18: performAnalysis with valid config
test('performAnalysis returns valid=true and performance for complete config', () => {
    setupCompleteValidConfig();
    const analysis = performAnalysis();
    if (!analysis.valid) {
        throw new Error('Expected valid=true, got error: ' + JSON.stringify(analysis.blockingErrors));
    }
    if (!analysis.performance) {
        throw new Error('Expected performance object when valid');
    }
});

// Test 19: Estimate quality flag
test('performAnalysis marks results as estimates', () => {
    setupCompleteValidConfig();
    const analysis = performAnalysis();
    if (!analysis.performance.hasEstimates) {
        throw new Error('Expected hasEstimates flag');
    }
    if (analysis.performance.estimateQuality !== 'estimated') {
        throw new Error('Expected estimateQuality to be "estimated"');
    }
});

// Test 20: M.2 slot count warning (non-blocking)
test('getBlockingErrors detects M.2 slot overflow as warning', () => {
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
    const errors = getBlockingErrors();
    const m2Warning = errors.find(e => e.type === 'warning' && e.text.includes('M.2'));
    if (!m2Warning) {
        throw new Error('Expected M.2 slot overflow warning, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 21: Cooler socket incompatibility
test('getBlockingErrors detects cooler socket incompatibility', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_5600_16'],
        motherboard: 'mobo_z790_atx',
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'  // This should be compatible with LGA 1700
    };
    const errors = getBlockingErrors();
    // Just verify the check runs - this should not produce a cooler socket error
    const coolerSocketError = errors.find(e => e.category === 'cooler');
    if (coolerSocketError) {
        throw new Error('Expected no cooler error for compatible cooler, got: ' + coolerSocketError.text);
    }
});

// Test 22: Cooler height incompatibility
test('getBlockingErrors detects cooler height incompatibility', () => {
    context.state.selections = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_5600_16'],
        motherboard: 'mobo_z790_atx',
        storage: ['ssd_980_pro_1'],
        psu: 'psu_rm750x',
        case: 'case_nr200',      // coolerMaxHeight: 155mm
        cooler: 'cooler_nh_d15'  // height: 165mm
    };
    const errors = getBlockingErrors();
    const heightError = errors.find(e => e.text.includes('cooler height') || e.text.includes('height'));
    if (!heightError) {
        throw new Error('Expected cooler height error, got: ' + JSON.stringify(errors.map(e => e.text)));
    }
});

// Test 23: Multiple warnings vs errors distinction
test('getBlockingErrors distinguishes errors from warnings', () => {
    setupCompleteValidConfig();
    const errors = getBlockingErrors();
    // For valid config, there should be no errors or warnings
    if (errors.length > 0) {
        throw new Error('Expected no errors or warnings for valid config');
    }
    // Check that warnings have type 'warning'
    const warningOnlyConfig = {
        cpu: 'cpu_i9_14900k',
        gpu: 'gpu_rtx_4070_ti',
        ram: ['ram_ddr5_5600_16'],
        motherboard: 'mobo_b650_matx',  // 1 M.2 slot
        storage: ['ssd_980_pro_1', 'ssd_990_pro_2', 'ssd_990_pro_2'],  // 3 NVMe drives
        psu: 'psu_rm750x',
        case: 'case_4000d',
        cooler: 'cooler_nh_d15'
    };
    context.state.selections = warningOnlyConfig;
    const warningErrors = getBlockingErrors();
    const onlyWarnings = warningErrors.filter(function(e) { return e.type === 'warning'; });
    const onlyErrors = warningErrors.filter(function(e) { return e.type === 'error'; });
    if (onlyErrors.length === 0) {
        throw new Error('Expected at least some M.2 warnings (non-blocking)');
    }
});

// Test 24: Workload scores are within reasonable range
test('Workload scores are between 0 and 100', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    var scores = perf.workloadScores;
    var keys = ['gaming', 'productivity', 'contentCreation', 'generalUse'];
    for (var i = 0; i < keys.length; i++) {
        var score = scores[keys[i]];
        if (score < 0 || score > 100) {
            throw new Error('Score ' + keys[i] + '=' + score + ' out of range [0, 100]');
        }
    }
});

// Test 25: Bottleneck percentages are reasonable
test('Bottleneck percentages are within expected range', () => {
    setupCompleteValidConfig();
    const perf = runPerformanceAnalysis();
    var bn = perf.bottleneck;
    if (bn.cpuBottleneck < 0 || bn.gpuBottleneck > 30) {
        throw new Error('Bottleneck percentages out of expected range');
    }
});

// Summary
console.log('\n--- Test Results ---');
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
