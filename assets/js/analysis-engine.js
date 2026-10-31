/**
 * PC Builder - Analysis Engine
 * Stage 4: Real compatibility and performance analysis
 * Logic is separate from UI rendering for future Django backend reuse.
 */

/**
 * REQUIRED categories for a valid PC build.
 * These are the minimum components needed for a functional system.
 * Optional: psu (some test configs), cooler (if case has one), case (if external)
 */
var REQUIRED_CATEGORIES = ['cpu', 'gpu', 'ram', 'motherboard', 'storage', 'psu', 'case', 'cooler'];

/**
 * Check if a category is required
 * @param {string} catKey - Category key
 * @returns {boolean}
 */
function isRequiredCategory(catKey) {
    return REQUIRED_CATEGORIES.indexOf(catKey) !== -1;
}

/**
 * Get missing required categories
 * @returns {Array} - Array of missing category keys in order
 */
function getMissingRequiredCategories() {
    var missing = [];
    for (var i = 0; i < REQUIRED_CATEGORIES.length; i++) {
        var catKey = REQUIRED_CATEGORIES[i];
        var sel = state.selections[catKey];
        var hasSelection = Array.isArray(sel) ? sel.length > 0 : !!sel;
        if (!hasSelection) {
            missing.push(catKey);
        }
    }
    return missing;
}

/**
 * Get blocking compatibility errors (prevents analysis)
 * Distinguishes between blocking errors and warnings
 * @returns {Array} - Array of {type: 'error'|'warning', category: string, text: string}
 */
function getBlockingErrors() {
    var errors = [];

    // CPU/Motherboard socket incompatibility (blocking)
    if (state.selections.cpu && state.selections.motherboard) {
        var cpu = findById('cpu', state.selections.cpu);
        var mobo = findById('motherboard', state.selections.motherboard);
        if (cpu && mobo && cpu.socket !== mobo.socket) {
            errors.push({
                type: 'error',
                category: 'cpu',
                text: 'CPU socket (' + cpu.socket + ') is incompatible with motherboard socket (' + mobo.socket + ')'
            });
        }
    }

    // RAM/Motherboard DDR type incompatibility (blocking)
    if (state.selections.ram && state.selections.ram.length > 0 && state.selections.motherboard) {
        var mobo = findById('motherboard', state.selections.motherboard);
        if (mobo) {
            for (var i = 0; i < state.selections.ram.length; i++) {
                var ram = findById('ram', state.selections.ram[i]);
                if (ram && ram.type !== mobo.ramType) {
                    errors.push({
                        type: 'error',
                        category: 'ram',
                        text: 'RAM type (' + ram.type + ') is incompatible with motherboard RAM type (' + mobo.ramType + ')'
                    });
                }
            }
        }
    }

    // GPU/PSU power suitability (error if PSU below recommended)
    if (state.selections.gpu && state.selections.psu) {
        var gpu = findById('gpu', state.selections.gpu);
        var psu = findById('psu', state.selections.psu);
        if (gpu && psu && gpu.recommendedPSU) {
            var gpuW = parseInt(gpu.recommendedPSU);
            var psuW = parseInt(psu.wattage);
            if (!isNaN(gpuW) && !isNaN(psuW) && psuW < gpuW) {
                errors.push({
                    type: 'error',
                    category: 'psu',
                    text: 'PSU (' + psu.wattage + ') is below GPU recommended power (' + gpu.recommendedPSU + ')'
                });
            }
        }
    }

    // GPU/case physical fit (blocking error)
    if (state.selections.gpu && state.selections.case) {
        var gpu = findById('gpu', state.selections.gpu);
        var cs = findById('case', state.selections.case);
        if (gpu && cs && gpu.length && cs.gpuMaxLen) {
            var gpuLen = parseInt(gpu.length);
            var caseMax = parseInt(cs.gpuMaxLen);
            if (!isNaN(gpuLen) && !isNaN(caseMax) && gpuLen > caseMax) {
                errors.push({
                    type: 'error',
                    category: 'gpu',
                    text: 'GPU length (' + gpuLen + 'mm) exceeds case maximum (' + caseMax + 'mm)'
                });
            }
        }
    }

    // Cooler/socket incompatibility (blocking)
    if (state.selections.cooler && state.selections.cpu) {
        var cooler = findById('cooler', state.selections.cooler);
        var cpu = findById('cpu', state.selections.cpu);
        if (cooler && cpu && cooler.socketSupport && cooler.socketSupport.indexOf(cpu.socket) === -1) {
            errors.push({
                type: 'error',
                category: 'cooler',
                text: 'CPU cooler may not support socket ' + cpu.socket
            });
        }
    }

    // Cooler/case height incompatibility (blocking)
    if (state.selections.cooler && state.selections.case) {
        var cooler = findById('cooler', state.selections.cooler);
        var cs = findById('case', state.selections.case);
        if (cooler && cs && cooler.height && cs.coolerMaxHeight) {
            var coolerH = parseInt(cooler.height);
            var caseMaxH = parseInt(cs.coolerMaxHeight);
            if (!isNaN(coolerH) && !isNaN(caseMaxH) && coolerH > caseMaxH) {
                errors.push({
                    type: 'error',
                    category: 'cooler',
                    text: 'CPU cooler height (' + coolerH + 'mm) exceeds case limit (' + caseMaxH + 'mm)'
                });
            }
        }
    }

    // RAM module count exceeds DIMM slots (blocking)
    if (state.selections.ram && state.selections.ram.length > 0 && state.selections.motherboard) {
        var mobo = findById('motherboard', state.selections.motherboard);
        if (mobo && state.selections.ram.length > mobo.ramSlots) {
            errors.push({
                type: 'error',
                category: 'ram',
                text: 'Number of RAM modules (' + state.selections.ram.length + ') exceeds motherboard DIMM slots (' + mobo.ramSlots + ')'
            });
        }
    }

    // Storage/M.2 slot count (non-blocking warning)
    if (state.selections.motherboard) {
        var mobo = findById('motherboard', state.selections.motherboard);
        if (mobo && state.selections.storage && state.selections.storage.length > 0) {
            var m2Count = 0;
            var sataCount = 0;
            state.selections.storage.forEach(function(id) {
                var s = findById('storage', id);
                if (s) {
                    if (s.interface && s.interface.indexOf('NVMe') !== -1) m2Count++;
                    if (s.interface && s.interface.indexOf('SATA') !== -1) sataCount++;
                }
            });
            if (m2Count > mobo.m2Slots) {
                errors.push({
                    type: 'warning',
                    category: 'storage',
                    text: 'Number of M.2 drives (' + m2Count + ') exceeds motherboard M.2 slots (' + mobo.m2Slots + ')'
                });
            }
            if (sataCount > mobo.sataPorts) {
                errors.push({
                    type: 'warning',
                    category: 'storage',
                    text: 'Number of SATA drives (' + sataCount + ') exceeds motherboard SATA ports (' + mobo.sataPorts + ')'
                });
            }
        }
    }

    return errors;
}

/**
 * Check if the configuration is valid for analysis
 * @returns {Object} { valid: boolean, missing: Array, errors: Array }
 */
function validateConfiguration() {
    var missing = getMissingRequiredCategories();
    var errors = getBlockingErrors();
    var blockingErrors = errors.filter(function(e) { return e.type === 'error'; });
    var warnings = errors.filter(function(e) { return e.type === 'warning'; });

    return {
        valid: missing.length === 0 && blockingErrors.length === 0,
        missing: missing,
        blockingErrors: blockingErrors,
        warnings: warnings
    };
}

/**
 * Performance Analysis Engine
 * Calculates estimates based on available hardware specifications.
 * Returns structured analysis results that the UI can display.
 */
function runPerformanceAnalysis() {
    var cpu = state.selections.cpu ? findById('cpu', state.selections.cpu) : null;
    var gpu = state.selections.gpu ? findById('gpu', state.selections.gpu) : null;
    var ram = state.selections.ram ? state.selections.ram.map(function(id) { return findById('ram', id); }).filter(Boolean) : [];
    var motherboard = state.selections.motherboard ? findById('motherboard', state.selections.motherboard) : null;
    var storage = state.selections.storage ? state.selections.storage.map(function(id) { return findById('storage', id); }).filter(Boolean) : [];
    var psu = state.selections.psu ? findById('psu', state.selections.psu) : null;
    var cooler = state.selections.cooler ? findById('cooler', state.selections.cooler) : null;
    var cs = state.selections.case ? findById('case', state.selections.case) : null;

    var analysis = {
        cpu: cpu,
        gpu: gpu,
        ram: ram,
        motherboard: motherboard,
        storage: storage,
        psu: psu,
        cooler: cooler,
        case: cs,
        workloadScores: calculateWorkloadScores(cpu, gpu, ram),
        bottleneck: calculateBottleneck(cpu, gpu),
        fpsEstimates: calculateFpsEstimates(gpu, cpu),
        powerConsumption: calculatePowerConsumption(cpu, gpu, ram, storage, cooler, motherboard),
        storageBandwidth: calculateStorageBandwidth(storage),
        memoryCapacity: calculateMemoryCapacity(ram),
        hasEstimates: true,
        estimateQuality: 'estimated' // Mark as estimated, not verified
    };

    return analysis;
}

/**
 * Calculate workload scores based on component specs.
 * Uses relative performance tiers and specifications.
 * @returns {Object} Workload score object
 */
function calculateWorkloadScores(cpu, gpu, ram) {
    var scores = {
        gaming: 0,
        productivity: 0,
        contentCreation: 0,
        generalUse: 100
    };

    // Gaming score: heavily weighted on GPU performance tier
    if (gpu && typeof gpu.perfTier !== 'undefined') {
        scores.gaming = Math.min(100, gpu.perfTier * 10);
    }
    // Add CPU contribution (reduced weight)
    if (cpu && typeof cpu.cores !== 'undefined') {
        scores.gaming = Math.min(100, scores.gaming + cpu.cores * 0.5);
    }

    // Productivity score: weighted on CPU cores/threads
    if (cpu && typeof cpu.cores !== 'undefined') {
        scores.productivity = Math.min(100, cpu.cores * 6 + (cpu.threads ? (cpu.threads - cpu.cores) * 4 : 0));
    }
    // RAM contributes to productivity
    if (ram && ram.length > 0) {
        var totalRam = ram.reduce(function(sum, r) { return sum + (r.capacity_GB || 0); }, 0);
        if (totalRam >= 16) {
            scores.productivity = Math.min(100, scores.productivity + 10);
        }
    }

    // Content creation: depends on GPU VRAM, CPU cores, RAM
    if (gpu && gpu.vram) {
        var vramGB = parseInt(gpu.vram);
        if (!isNaN(vramGB)) {
            scores.contentCreation = Math.min(100, vramGB * 3 + (cpu ? cpu.cores * 2 : 0));
        }
    }
    if (ram && ram.length > 0) {
        // Calculate total RAM for content creation bonus
        var totalRamForContent = ram.reduce(function(sum, r) { return sum + (r.capacity_GB || 0); }, 0);
        if (totalRamForContent >= 32) {
            scores.contentCreation = Math.min(100, scores.contentCreation + 15);
        }
    }

    // General use is always high (assumed 100 for basic tasks)
    scores.generalUse = 100;

    return scores;
}

/**
 * Calculate CPU/GPU bottleneck indicators.
 * Based on relative performance tiers.
 * @returns {Object} Bottleneck analysis result
 */
function calculateBottleneck(cpu, gpu) {
    var result = {
        cpuBottleneck: 0,
        gpuBottleneck: 0,
        assessment: '',
        isEstimate: true
    };

    if (!cpu || !gpu) {
        result.assessment = 'Cannot estimate bottleneck without CPU and GPU data.';
        return result;
    }

    // Use perfTier as proxy for relative performance
    var cpuTier = cpu.perfTier || 5; // Default if not specified
    var gpuTier = gpu.perfTier || 5;

    // Bottleneck estimation: difference in tiers
    var tierDiff = cpuTier - gpuTier;

    if (tierDiff > 2) {
        result.cpuBottleneck = 0;
        result.gpuBottleneck = Math.min(20, tierDiff * 5);
        result.assessment = 'GPU may bottleneck CPU. Consider a newer GPU for this CPU tier.';
    } else if (tierDiff < -2) {
        result.cpuBottleneck = Math.min(20, Math.abs(tierDiff) * 5);
        result.gpuBottleneck = 0;
        result.assessment = 'CPU may bottleneck GPU. Consider a more powerful CPU.';
    } else {
        result.assessment = 'CPU and GPU are well-balanced for this configuration.';
    }

    return result;
}

/**
 * Calculate estimated gaming FPS at different resolutions.
 * Based on GPU performance tier and CPU capability.
 * @returns {Object} FPS estimates per resolution
 */
function calculateFpsEstimates(gpu, cpu) {
    var result = {
        '1080p': 0,
        '1440p': 0,
        '4K': 0,
        isEstimate: true,
        note: 'Estimates based on GPU tier. Actual FPS varies by game and settings.'
    };

    if (!gpu) {
        result.note = 'Cannot estimate FPS without GPU data.';
        return result;
    }

    // Use perfTier as basis for FPS estimation
    var tier = gpu.perfTier || 5;
    var baseFps1080p = tier * 40; // Tier 5 = ~200 FPS
    var baseFps1440p = tier * 25;  // ~80% scaling
    var baseFps4k = tier * 12;     // ~65% scaling

    // CPU impact on lower-tier GPUs
    if (cpu && cpu.cores) {
        var cpuImpact = Math.min(10, cpu.cores / 2);
        baseFps1080p += cpuImpact;
        baseFps1440p += cpuImpact * 0.8;
    }

    result['1080p'] = Math.round(baseFps1080p);
    result['1440p'] = Math.round(baseFps1440p);
    result['4K'] = Math.round(baseFps4k);

    return result;
}

/**
 * Calculate estimated system power consumption.
 * Uses TDP values from components.
 * @returns {Object} Power consumption and PSU suitability
 */
function calculatePowerConsumption(cpu, gpu, ram, storage, cooler, motherboard) {
    var totalTdp = 0;
    var breakdown = [];

    function parseTdp(str) {
        if (!str) return 0;
        var num = parseInt(str.toString().replace(/\D/g, ''));
        return isNaN(num) ? 0 : num;
    }

    if (cpu && cpu.tdp) {
        var cpuTdp = parseTdp(cpu.tdp);
        totalTdp += cpuTdp;
        breakdown.push({ component: 'CPU', tdp: cpuTdp });
    }
    if (gpu && gpu.tdp) {
        var gpuTdp = parseTdp(gpu.tdp);
        totalTdp += gpuTdp;
        breakdown.push({ component: 'GPU', tdp: gpuTdp });
    }
    // RAM: ~5W per module
    if (ram && ram.length > 0) {
        var ramTdp = ram.length * 5;
        totalTdp += ramTdp;
        breakdown.push({ component: 'RAM', tdp: ramTdp });
    }
    // Motherboard: ~20-30W
    if (motherboard) {
        totalTdp += 25;
        breakdown.push({ component: 'Motherboard', tdp: 25 });
    }
    // Storage: ~5W per drive
    if (storage && storage.length > 0) {
        var storageTdp = storage.length * 5;
        totalTdp += storageTdp;
        breakdown.push({ component: 'Storage', tdp: storageTdp });
    }
    // Add 30% overhead for efficiency
    var estimatedWithOverhead = Math.round(totalTdp * 1.3);

    var psu = state.selections.psu ? findById('psu', state.selections.psu) : null;
    var psuWattage = psu ? parseInt(psu.wattage) : 0;

    var suitability = 'unknown';
    var recommendation = '';

    if (psuWattage > 0) {
        if (psuWattage >= estimatedWithOverhead * 1.25) {
            suitability = 'excellent';
            recommendation = 'PSU is well-sized for this build.';
        } else if (psuWattage >= estimatedWithOverhead) {
            suitability = 'adequate';
            recommendation = 'PSU is adequate but has limited headroom.';
        } else {
            suitability = 'insufficient';
            recommendation = 'PSU may be insufficient. Recommended: ' + estimatedWithOverhead + 'W+';
        }
    } else {
        recommendation = 'Add a PSU to estimate power suitability. Estimated system draw: ~' + estimatedWithOverhead + 'W';
    }

    return {
        estimatedTdp: totalTdp,
        estimatedWithOverhead: estimatedWithOverhead,
        psuWattage: psuWattage,
        suitability: suitability,
        recommendation: recommendation,
        breakdown: breakdown,
        isEstimate: true
    };
}

/**
 * Calculate aggregate storage bandwidth and capacity.
 * @returns {Object}
 */
function calculateStorageBandwidth(storage) {
    var result = {
        totalCapacity: 0,
        avgReadSpeed: 0,
        isEstimate: true
    };

    if (!storage || storage.length === 0) return result;

    storage.forEach(function(s) {
        if (s.capacity_GB) result.totalCapacity += s.capacity_GB;
        if (s.readSpeed) {
            var speed = parseInt(s.readSpeed);
            if (!isNaN(speed)) result.avgReadSpeed += speed;
        }
    });

    result.avgReadSpeed = Math.round(result.avgReadSpeed / storage.length) || 0;
    result.isEstimate = false;

    return result;
}

/**
 * Calculate total memory capacity.
 * @returns {Object}
 */
function calculateMemoryCapacity(ram) {
    var result = {
        totalCapacity: 0,
        moduleCount: 0,
        isEstimate: false
    };

    if (!ram || ram.length === 0) return result;

    ram.forEach(function(r) {
        if (r.capacity_GB) result.totalCapacity += r.capacity_GB;
    });
    result.moduleCount = ram.length;

    return result;
}

/**
 * Build the complete analysis result.
 * Central entry point for the analysis engine.
 * @returns {Object} Complete analysis result
 */
function performAnalysis() {
    var validation = validateConfiguration();
    var analysis = {
        valid: validation.valid,
        validation: validation,
        missingCategories: validation.missing,
        blockingErrors: validation.blockingErrors,
        warnings: validation.warnings,
        performance: null,
        isEstimate: true,
        generatedAt: new Date().toISOString()
    };

    if (validation.valid) {
        analysis.performance = runPerformanceAnalysis();
    }

    return analysis;
}