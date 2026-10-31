"""
Analysis service - Ports Stage 4 analysis logic to Python.
This is a direct translation of assets/js/analysis-engine.js.
Business logic is kept separate from Django views.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from hardware.data_loader import get_item_by_id, parse_tdp


# Required categories for a valid PC build
REQUIRED_CATEGORIES = ['cpu', 'gpu', 'ram', 'motherboard', 'storage', 'psu', 'case', 'cooler']


def get_required_categories() -> List[str]:
    """Get the list of required categories."""
    return REQUIRED_CATEGORIES.copy()


def is_required_category(cat_key: str) -> bool:
    """Check if a category is required."""
    return cat_key in REQUIRED_CATEGORIES


def _get_selected_item(selections: Dict, category_key: str) -> Optional[Dict]:
    """Get the selected item object for a single-select category."""
    sel_id = selections.get(category_key)
    if not sel_id:
        return None
    return get_item_by_id(category_key, sel_id)


def _get_selected_items(selections: Dict, category_key: str) -> List[Dict]:
    """Get selected item objects for a multi-select category."""
    sel_ids = selections.get(category_key, [])
    if not sel_ids:
        return []
    items = []
    for item_id in sel_ids:
        item = get_item_by_id(category_key, item_id)
        if item:
            items.append(item)
    return items


def _has_selection(selections: Dict, category_key: str) -> bool:
    """Check if a category has a valid selection."""
    sel = selections.get(category_key)
    if sel is None:
        return False
    if isinstance(sel, list):
        return len(sel) > 0
    return bool(sel)


def get_missing_required_categories(selections: Dict) -> List[str]:
    """Get list of missing required categories."""
    missing = []
    for cat_key in REQUIRED_CATEGORIES:
        if not _has_selection(selections, cat_key):
            missing.append(cat_key)
    return missing


def _check_cpu_mobo_socket(selections: Dict) -> List[Dict]:
    """Check CPU/motherboard socket compatibility."""
    errors = []
    cpu = _get_selected_item(selections, 'cpu')
    mobo = _get_selected_item(selections, 'motherboard')
    if cpu and mobo:
        if cpu.get('socket') and mobo.get('socket') and cpu['socket'] != mobo['socket']:
            errors.append({
                'type': 'error',
                'category': 'cpu',
                'text': f"CPU socket ({cpu['socket']}) is incompatible with motherboard socket ({mobo['socket']})"
            })
    return errors


def _check_ram_type(selections: Dict) -> List[Dict]:
    """Check RAM/motherboard DDR type compatibility."""
    errors = []
    ram_items = _get_selected_items(selections, 'ram')
    mobo = _get_selected_item(selections, 'motherboard')
    if ram_items and mobo:
        for ram in ram_items:
            if ram.get('type') != mobo.get('ramType'):
                errors.append({
                    'type': 'error',
                    'category': 'ram',
                    'text': f"RAM type ({ram.get('type')}) is incompatible with motherboard RAM type ({mobo.get('ramType')})"
                })
    return errors


def _check_gpu_psu_power(selections: Dict) -> List[Dict]:
    """Check GPU/PSU power suitability."""
    errors = []
    gpu = _get_selected_item(selections, 'gpu')
    psu = _get_selected_item(selections, 'psu')
    if gpu and psu:
        recommended_psu = gpu.get('recommendedPSU')
        if recommended_psu:
            gpu_w = parse_tdp(recommended_psu)
            psu_w = parse_tdp(psu.get('wattage'))
            if gpu_w > 0 and psu_w > 0 and psu_w < gpu_w:
                errors.append({
                    'type': 'error',
                    'category': 'psu',
                    'text': f"PSU ({psu.get('wattage')}) is below GPU recommended power ({recommended_psu})"
                })
    return errors


def _check_gpu_case_fit(selections: Dict) -> List[Dict]:
    """Check GPU/case physical fit."""
    errors = []
    gpu = _get_selected_item(selections, 'gpu')
    case = _get_selected_item(selections, 'case')
    if gpu and case:
        gpu_len_str = gpu.get('length', '')
        case_max_str = case.get('gpuMaxLen', '')
        if gpu_len_str and case_max_str:
            gpu_len = int(''.join(filter(str.isdigit, gpu_len_str)) or 0)
            case_max = int(''.join(filter(str.isdigit, case_max_str)) or 0)
            if gpu_len > 0 and case_max > 0 and gpu_len > case_max:
                errors.append({
                    'type': 'error',
                    'category': 'gpu',
                    'text': f"GPU length ({gpu_len}mm) exceeds case maximum ({case_max}mm)"
                })
    return errors


def _check_cooler_socket(selections: Dict) -> List[Dict]:
    """Check cooler/socket compatibility."""
    errors = []
    cooler = _get_selected_item(selections, 'cooler')
    cpu = _get_selected_item(selections, 'cpu')
    if cooler and cpu:
        socket_support = cooler.get('socketSupport', [])
        cpu_socket = cpu.get('socket')
        if cpu_socket and socket_support and cpu_socket not in socket_support:
            errors.append({
                'type': 'error',
                'category': 'cooler',
                'text': f"CPU cooler may not support socket {cpu_socket}"
            })
    return errors


def _check_cooler_height(selections: Dict) -> List[Dict]:
    """Check cooler/case height clearance."""
    errors = []
    cooler = _get_selected_item(selections, 'cooler')
    case = _get_selected_item(selections, 'case')
    if cooler and case:
        cooler_h_str = cooler.get('height', '')
        case_max_h_str = case.get('coolerMaxHeight', '')
        if cooler_h_str and case_max_h_str:
            cooler_h = int(''.join(filter(str.isdigit, cooler_h_str)) or 0)
            case_max_h = int(''.join(filter(str.isdigit, case_max_h_str)) or 0)
            if cooler_h > 0 and case_max_h > 0 and cooler_h > case_max_h:
                errors.append({
                    'type': 'error',
                    'category': 'cooler',
                    'text': f"CPU cooler height ({cooler_h}mm) exceeds case limit ({case_max_h}mm)"
                })
    return errors


def _check_ram_slots(selections: Dict) -> List[Dict]:
    """Check if RAM modules exceed motherboard DIMM slots."""
    errors = []
    ram_items = _get_selected_items(selections, 'ram')
    mobo = _get_selected_item(selections, 'motherboard')
    if ram_items and mobo:
        ram_count = len(ram_items)
        ram_slots = mobo.get('ramSlots', 0)
        if ram_count > ram_slots:
            errors.append({
                'type': 'error',
                'category': 'ram',
                'text': f"Number of RAM modules ({ram_count}) exceeds motherboard DIMM slots ({ram_slots})"
            })
    return errors


def _check_storage_slots(selections: Dict) -> List[Dict]:
    """Check M.2 and SATA slot counts (warnings, not blocking)."""
    warnings = []
    mobo = _get_selected_item(selections, 'motherboard')
    storage_items = _get_selected_items(selections, 'storage')
    if mobo and storage_items:
        m2_count = 0
        sata_count = 0
        for s in storage_items:
            interface = s.get('interface', '')
            if interface and 'NVMe' in interface:
                m2_count += 1
            if interface and 'SATA' in interface:
                sata_count += 1

        m2_slots = mobo.get('m2Slots', 0)
        sata_ports = mobo.get('sataPorts', 0)

        if m2_count > m2_slots:
            warnings.append({
                'type': 'warning',
                'category': 'storage',
                'text': f"Number of M.2 drives ({m2_count}) exceeds motherboard M.2 slots ({m2_slots})"
            })
        if sata_count > sata_ports:
            warnings.append({
                'type': 'warning',
                'category': 'storage',
                'text': f"Number of SATA drives ({sata_count}) exceeds motherboard SATA ports ({sata_ports})"
            })
    return warnings


def get_blocking_errors(selections: Dict) -> List[Dict]:
    """Get all blocking errors and warnings for a configuration."""
    errors = []
    errors.extend(_check_cpu_mobo_socket(selections))
    errors.extend(_check_ram_type(selections))
    errors.extend(_check_gpu_psu_power(selections))
    errors.extend(_check_gpu_case_fit(selections))
    errors.extend(_check_cooler_socket(selections))
    errors.extend(_check_cooler_height(selections))
    errors.extend(_check_ram_slots(selections))
    errors.extend(_check_storage_slots(selections))
    return errors


def validate_configuration(selections: Dict) -> Dict[str, Any]:
    """Validate the configuration and return validation result."""
    missing = get_missing_required_categories(selections)
    all_errors = get_blocking_errors(selections)
    blocking_errors = [e for e in all_errors if e['type'] == 'error']
    warnings = [e for e in all_errors if e['type'] == 'warning']

    return {
        'valid': len(missing) == 0 and len(blocking_errors) == 0,
        'missing': missing,
        'blockingErrors': blocking_errors,
        'warnings': warnings,
    }


def calculate_workload_scores(cpu: Optional[Dict], gpu: Optional[Dict], ram: List[Dict]) -> Dict[str, float]:
    """Calculate workload scores based on component specs."""
    scores = {
        'gaming': 0,
        'productivity': 0,
        'contentCreation': 0,
        'generalUse': 100
    }

    # Gaming score: heavily weighted on GPU performance tier
    if gpu and 'perfTier' in gpu and gpu['perfTier'] is not None:
        scores['gaming'] = min(100, gpu['perfTier'] * 10)
    # Add CPU contribution
    if cpu and 'cores' in cpu and cpu['cores'] is not None:
        scores['gaming'] = min(100, scores['gaming'] + cpu['cores'] * 0.5)

    # Productivity score: weighted on CPU cores/threads
    if cpu and 'cores' in cpu and cpu['cores'] is not None:
        cores = cpu['cores']
        threads = cpu.get('threads', cores)
        scores['productivity'] = min(100, cores * 6 + (threads - cores) * 4)
    # RAM contributes to productivity
    if ram:
        total_ram = sum(r.get('capacity_GB', 0) for r in ram)
        if total_ram >= 16:
            scores['productivity'] = min(100, scores['productivity'] + 10)

    # Content creation: depends on GPU VRAM, CPU cores, RAM
    if gpu and gpu.get('vram'):
        vram_str = str(gpu['vram'])
        vram_gb = int(''.join(filter(str.isdigit, vram_str.split()[0])) or 0) if vram_str else 0
        if vram_gb > 0:
            cpu_cores = cpu.get('cores', 0) if cpu else 0
            scores['contentCreation'] = min(100, vram_gb * 3 + cpu_cores * 2)
    if ram:
        total_ram = sum(r.get('capacity_GB', 0) for r in ram)
        if total_ram >= 32:
            scores['contentCreation'] = min(100, scores['contentCreation'] + 15)

    return scores


def calculate_bottleneck(cpu: Optional[Dict], gpu: Optional[Dict]) -> Dict[str, Any]:
    """Calculate CPU/GPU bottleneck indicators."""
    result = {
        'cpuBottleneck': 0,
        'gpuBottleneck': 0,
        'assessment': '',
        'isEstimate': True
    }

    if not cpu or not gpu:
        result['assessment'] = 'Cannot estimate bottleneck without CPU and GPU data.'
        return result

    cpu_tier = cpu.get('perfTier', 5) or 5
    gpu_tier = gpu.get('perfTier', 5) or 5

    tier_diff = cpu_tier - gpu_tier

    if tier_diff > 2:
        result['cpuBottleneck'] = 0
        result['gpuBottleneck'] = min(20, tier_diff * 5)
        result['assessment'] = 'GPU may bottleneck CPU. Consider a newer GPU for this CPU tier.'
    elif tier_diff < -2:
        result['cpuBottleneck'] = min(20, abs(tier_diff) * 5)
        result['gpuBottleneck'] = 0
        result['assessment'] = 'CPU may bottleneck GPU. Consider a more powerful CPU.'
    else:
        result['assessment'] = 'CPU and GPU are well-balanced for this configuration.'

    return result


def calculate_fps_estimates(gpu: Optional[Dict], cpu: Optional[Dict]) -> Dict[str, Any]:
    """Calculate estimated gaming FPS at different resolutions."""
    result = {
        '1080p': 0,
        '1440p': 0,
        '4K': 0,
        'isEstimate': True,
        'note': 'Estimates based on GPU tier. Actual FPS varies by game and settings.'
    }

    if not gpu:
        result['note'] = 'Cannot estimate FPS without GPU data.'
        return result

    tier = gpu.get('perfTier', 5) or 5
    base_fps_1080p = tier * 40
    base_fps_1440p = tier * 25
    base_fps_4k = tier * 12

    if cpu and cpu.get('cores'):
        cpu_impact = min(10, cpu['cores'] / 2)
        base_fps_1080p += cpu_impact
        base_fps_1440p += cpu_impact * 0.8

    result['1080p'] = round(base_fps_1080p)
    result['1440p'] = round(base_fps_1440p)
    result['4K'] = round(base_fps_4k)

    return result


def calculate_power_consumption(cpu: Optional[Dict], gpu: Optional[Dict], ram: List[Dict],
                                storage: List[Dict], cooler: Optional[Dict],
                                motherboard: Optional[Dict], psu_id: Optional[str]) -> Dict[str, Any]:
    """Calculate estimated system power consumption."""
    total_tdp = 0
    breakdown = []

    if cpu and cpu.get('tdp'):
        cpu_tdp = parse_tdp(cpu['tdp'])
        total_tdp += cpu_tdp
        breakdown.append({'component': 'CPU', 'tdp': cpu_tdp})
    if gpu and gpu.get('tdp'):
        gpu_tdp = parse_tdp(gpu['tdp'])
        total_tdp += gpu_tdp
        breakdown.append({'component': 'GPU', 'tdp': gpu_tdp})
    if ram:
        ram_tdp = len(ram) * 5
        total_tdp += ram_tdp
        breakdown.append({'component': 'RAM', 'tdp': ram_tdp})
    if motherboard:
        total_tdp += 25
        breakdown.append({'component': 'Motherboard', 'tdp': 25})
    if storage:
        storage_tdp = len(storage) * 5
        total_tdp += storage_tdp
        breakdown.append({'component': 'Storage', 'tdp': storage_tdp})

    estimated_with_overhead = round(total_tdp * 1.3)

    psu = get_item_by_id('psu', psu_id) if psu_id else None
    psu_wattage = parse_tdp(psu.get('wattage')) if psu else 0

    suitability = 'unknown'
    recommendation = ''

    if psu_wattage > 0:
        if psu_wattage >= estimated_with_overhead * 1.25:
            suitability = 'excellent'
            recommendation = 'PSU is well-sized for this build.'
        elif psu_wattage >= estimated_with_overhead:
            suitability = 'adequate'
            recommendation = 'PSU is adequate but has limited headroom.'
        else:
            suitability = 'insufficient'
            recommendation = f"PSU may be insufficient. Recommended: {estimated_with_overhead}W+"
    else:
        recommendation = f"Add a PSU to estimate power suitability. Estimated system draw: ~{estimated_with_overhead}W"

    return {
        'estimatedTdp': total_tdp,
        'estimatedWithOverhead': estimated_with_overhead,
        'psuWattage': psu_wattage,
        'suitability': suitability,
        'recommendation': recommendation,
        'breakdown': breakdown,
        'isEstimate': True
    }


def calculate_storage_bandwidth(storage: List[Dict]) -> Dict[str, Any]:
    """Calculate aggregate storage bandwidth and capacity."""
    result = {
        'totalCapacity': 0,
        'avgReadSpeed': 0,
        'isEstimate': True
    }

    if not storage:
        return result

    for s in storage:
        if s.get('capacity_GB'):
            result['totalCapacity'] += s['capacity_GB']
        if s.get('readSpeed'):
            speed_str = str(s['readSpeed'])
            speed = int(''.join(filter(str.isdigit, speed_str)) or 0)
            if speed > 0:
                result['avgReadSpeed'] += speed

    result['avgReadSpeed'] = round(result['avgReadSpeed'] / len(storage)) if storage else 0
    result['isEstimate'] = False

    return result


def calculate_memory_capacity(ram: List[Dict]) -> Dict[str, Any]:
    """Calculate total memory capacity."""
    result = {
        'totalCapacity': 0,
        'moduleCount': 0,
        'isEstimate': False
    }

    if not ram:
        return result

    for r in ram:
        if r.get('capacity_GB'):
            result['totalCapacity'] += r['capacity_GB']
    result['moduleCount'] = len(ram)

    return result


def run_performance_analysis(selections: Dict) -> Dict[str, Any]:
    """Run performance analysis for a complete PC configuration."""
    cpu = _get_selected_item(selections, 'cpu')
    gpu = _get_selected_item(selections, 'gpu')
    ram = _get_selected_items(selections, 'ram')
    motherboard = _get_selected_item(selections, 'motherboard')
    storage = _get_selected_items(selections, 'storage')
    psu = _get_selected_item(selections, 'psu')
    cooler = _get_selected_item(selections, 'cooler')
    case = _get_selected_item(selections, 'case')

    return {
        'cpu': _serialize_component(cpu),
        'gpu': _serialize_component(gpu),
        'ram': [_serialize_component(r) for r in ram],
        'motherboard': _serialize_component(motherboard),
        'storage': [_serialize_component(s) for s in storage],
        'psu': _serialize_component(psu),
        'cooler': _serialize_component(cooler),
        'case': _serialize_component(case),
        'workloadScores': calculate_workload_scores(cpu, gpu, ram),
        'bottleneck': calculate_bottleneck(cpu, gpu),
        'fpsEstimates': calculate_fps_estimates(gpu, cpu),
        'powerConsumption': calculate_power_consumption(cpu, gpu, ram, storage, cooler, motherboard, selections.get('psu')),
        'storageBandwidth': calculate_storage_bandwidth(storage),
        'memoryCapacity': calculate_memory_capacity(ram),
        'hasEstimates': True,
        'estimateQuality': 'estimated'
    }


def _serialize_component(component: Optional[Dict]) -> Optional[Dict]:
    """Serialize a component for JSON response."""
    if component is None:
        return None
    return dict(component)


def perform_analysis(selections: Dict) -> Dict[str, Any]:
    """
    Build the complete analysis result.
    Central entry point for the analysis engine.
    """
    validation = validate_configuration(selections)
    analysis = {
        'valid': validation['valid'],
        'validation': validation,
        'missingCategories': validation['missing'],
        'blockingErrors': validation['blockingErrors'],
        'warnings': validation['warnings'],
        'performance': None,
        'isEstimate': True,
        'generatedAt': datetime.now(timezone.utc).isoformat()
    }

    if validation['valid']:
        analysis['performance'] = run_performance_analysis(selections)

    return analysis
