(function (global) {
  "use strict";

  const LIMITS = {
    frequency: {
      nominal: 50.0,
      normalLow: 49.8,
      operationalLow: 49.5,
      warningLow: 49.2,
      statutoryLow: 49.0,
      lfdd: 48.8
    },
    rocof: {
      enhanced: 0.25,
      operational: 0.50,
      trip: 1.00
    },
    voltage: {
      target: 1.0,
      warning: 0.95,
      hard: 0.92
    },
    soc: {
      healthy: 0.20,
      minimum: 0.10
    },
    recovery: {
      good: 30,
      marginal: 60
    }
  };

  const WEATHER_LIBRARY = {
    calm: {
      label: "Calm",
      narrative: "Low-wind operating conditions with moderate solar availability and a larger synchronous contribution in the remaining mix.",
      windShare: 0.38,
      windShape: { base: 0.54, amp1: 0.05, amp2: 0.02, phase: 0.35 },
      solarShape: { base: 0.96, amp1: 0.20, amp2: 0.04, phase: -0.1 }
    },
    sunny: {
      label: "Sunny",
      narrative: "Clear-weather conditions with strong solar availability, reduced wind share, and the most solar-heavy renewable split.",
      windShare: 0.24,
      windShape: { base: 0.70, amp1: 0.08, amp2: 0.03, phase: 0.45 },
      solarShape: { base: 1.12, amp1: 0.24, amp2: 0.04, phase: 0.0 }
    },
    windy: {
      label: "Windy",
      narrative: "Wind-led operating conditions with higher wind availability, lower solar contribution, and lighter synchronous support.",
      windShare: 0.74,
      windShape: { base: 1.04, amp1: 0.10, amp2: 0.04, phase: 0.2 },
      solarShape: { base: 0.42, amp1: 0.07, amp2: 0.02, phase: 0.7 }
    },
    gusty: {
      label: "Gusty",
      narrative: "More volatile wind conditions with visible variability and less predictable short-term renewable output.",
      windShare: 0.70,
      windShape: { base: 0.98, amp1: 0.16, amp2: 0.08, phase: 0.0 },
      solarShape: { base: 0.40, amp1: 0.09, amp2: 0.03, phase: 0.35 }
    },
    storm_2019: {
      label: "Storm / 9 Aug 2019",
      narrative: "Storm-driven wind conditions aligned with the 9 August 2019 calibration case.",
      windShare: 0.80,
      windShape: { base: 1.08, amp1: 0.14, amp2: 0.06, phase: 0.15 },
      solarShape: { base: 0.30, amp1: 0.05, amp2: 0.02, phase: 0.65 }
    }
  };

  const PORTFOLIO_PRESETS = {
    none: {
      name: "P0 - No fast services",
      description: "Only natural damping and conventional baseline.",
      services: {
        bessMW: 0,
        bessMWh: 0,
        bessSoC0: 0.5,
        govMW: 0,
        headroomPct: 0,
        drMW: 0,
        useSyncon: false,
        synconH: 0,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    bess: {
      name: "P1 - BESS only",
      description: "Fast frequency response with no governor or DR backup.",
      services: {
        bessMW: 1000,
        bessMWh: 1000,
        bessSoC0: 0.5,
        govMW: 0,
        headroomPct: 0,
        drMW: 0,
        useSyncon: false,
        synconH: 0,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    bessGov: {
      name: "P2 - BESS plus governor",
      description: "Fast arrest plus synchronous plant support.",
      services: {
        bessMW: 1000,
        bessMWh: 1000,
        bessSoC0: 0.5,
        govMW: 2000,
        headroomPct: 0,
        drMW: 0,
        useSyncon: false,
        synconH: 0,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    full: {
      name: "P3 - Full layered stack",
      description: "BESS, governor, headroom, and DR without optional import support.",
      services: {
        bessMW: 1000,
        bessMWh: 1000,
        bessSoC0: 0.5,
        govMW: 2000,
        headroomPct: 0.05,
        drMW: 500,
        useSyncon: false,
        synconH: 0,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    fullSyncon: {
      name: "P4 - Full plus SynCon",
      description: "Adds physical inertia and stronger system support without extra import response.",
      services: {
        bessMW: 1000,
        bessMWh: 1000,
        bessSoC0: 0.5,
        govMW: 2000,
        headroomPct: 0.05,
        drMW: 500,
        useSyncon: true,
        synconH: 1.5,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    fullGfm: {
      name: "P5 - Full plus GFM",
      description: "Adds virtual damping and reactive support proxy without extra import response.",
      services: {
        bessMW: 1000,
        bessMWh: 1000,
        bessSoC0: 0.5,
        govMW: 2000,
        headroomPct: 0.05,
        drMW: 500,
        useSyncon: false,
        synconH: 0,
        useGfm: true,
        gfmD: 0.8,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    weakStress: {
      name: "Weak-grid stress",
      description: "Full services but exposed to low system strength.",
      services: {
        bessMW: 1000,
        bessMWh: 1000,
        bessSoC0: 0.5,
        govMW: 1600,
        headroomPct: 0.05,
        drMW: 500,
        useSyncon: false,
        synconH: 0,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    },
    benchmark2019: {
      name: "2019 fleet benchmark",
      description: "Deliberately limited services to represent the 9 Aug 2019 stress point.",
      services: {
        bessMW: 472,
        bessMWh: 350,
        bessSoC0: 0.5,
        govMW: 550,
        headroomPct: 0.0,
        drMW: 0,
        useSyncon: false,
        synconH: 0,
        useGfm: false,
        gfmD: 0,
        useImportSupport: false,
        importResponseMW: 0
      }
    }
  };

  const SCENARIO_PRESETS = {
    operatorBase: {
      name: "Balanced 70% RES day",
      narrative: "A representative GB operating point for the main project story.",
      weather: "windy",
      demandGW: 30,
      generationGW: 28.0,
      resShare: 0.70,
      importsMW: 2000,
      systemStrength: 1.0,
      lossMW: 1500,
      eventType: "step",
      rampDuration: 60,
      tFault: 10,
      duration: 180,
      dt: 0.05
    },
    highStress: {
      name: "High-RES stress case",
      narrative: "Higher-renewable, larger-disturbance operating point used for direct comparison against the operator-base case.",
      weather: "windy",
      demandGW: 30,
      generationGW: 28.0,
      resShare: 0.90,
      importsMW: 2000,
      systemStrength: 1.0,
      lossMW: 1800,
      eventType: "step",
      rampDuration: 60,
      tFault: 10,
      duration: 180,
      dt: 0.05
    },
    event2019: {
      name: "9 Aug 2019 calibrated",
      narrative: "A benchmark stress case around the 9 Aug 2019 disturbance.",
      weather: "storm_2019",
      demandGW: 29,
      generationGW: 26.2,
      resShare: 0.32,
      importsMW: 2800,
      systemStrength: 0.94,
      lossMW: 1878,
      eventType: "aug2019",
      rampDuration: 60,
      tFault: 10,
      duration: 300,
      dt: 0.05,
      protections: {
        enableLfdd: true,
        lfddStage1MW: 931,
        enableVoltageRelief: false,
        voltageReliefMW: 450,
        enableReserveRelief: false,
        reserveReliefMW: 300,
        enableEmbeddedTrips: true,
        embeddedTripMW: 350
      }
    },
    weakGrid: {
      name: "Weak-grid stress case",
      narrative: "Reduced system strength and reduced effective inertia under high renewables.",
      weather: "gusty",
      demandGW: 26,
      generationGW: 24.8,
      resShare: 0.78,
      importsMW: 1200,
      systemStrength: 0.72,
      lossMW: 1600,
      eventType: "step",
      rampDuration: 45,
      tFault: 10,
      duration: 180,
      dt: 0.05
    },
  };

  const MODEL_CONSTANTS = {
    Sbase: 30e9,
    f0: 50,
    H_base: 6.0,
    H_min: 2.0,
    alphaH: 0.8,
    D: 1.0,
    k_ffr: 0.20,
    k_ffrRoCoF: 0.08,
    ffrDeadband: 0.015,
    ffrDelay: 0.5,
    bessSustainHorizonS: 1800,
    bessEnergyTau: 12,
    bessEtaDischarge: 0.95,
    bessEtaCharge: 0.95,
    socMin: 0.10,
    socMax: 0.90,
    kGov: 0.15,
    tauGov: 5.0,
    kAgc: 0.015,
    kHeadroom: 1.5,
    drDelay: 30,
    drTau: 20,
    importGain: 0.12,
    importRoCoFGain: 0.05,
    legacyRoCoFHzPerS: 0.125,
    frequencyAnomalyHz: 49.0,
    frequencyAnomalyLossMW: 200,
    lfddConfirmS: 0.25,
    lfddGenericStages: [
      { thresholdHz: 48.8, shedFraction: 0.05, label: "LFDD stage 1" },
      { thresholdHz: 48.6, shedFraction: 0.075, label: "LFDD stage 2" },
      { thresholdHz: 48.4, shedFraction: 0.10, label: "LFDD stage 3" }
    ],
    lfddAug2019Stages: [
      { thresholdHz: 48.8, shedMW: 931, label: "LFDD stage 1" },
      { thresholdHz: 48.6, shedFraction: 0.075, label: "LFDD stage 2" },
      { thresholdHz: 48.4, shedFraction: 0.10, label: "LFDD stage 3" }
    ],
    voltageTimeConstant: 3.8,
    voltageImbalanceGain: 0.26,
    voltageFrequencyGain: 0.06,
    voltageRoCoFGain: 0.04,
    weakGridVoltagePenalty: 0.035,
    voltageServiceFloor: 0.78,
    voltageEmergencyFloor: 0.88,
    uvlsConfirmS: 0.20,
    reserveReliefConfirmS: 0.50,
    gfmVoltageGain: 0.68,
    gfmVoltageCap: 0.08,
    synconVoltageGain: 0.12,
    hardVoltageMin: 0.80,
    hardVoltageMax: 1.15
  };

  const STATUS_SEVERITY = {
    "SECURE": 0,
    "STRESSED": 1,
    "EMERGENCY": 2,
    "BLACKOUT": 3
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createDefaultConfig() {
    const scenario = clone(SCENARIO_PRESETS.operatorBase);
    const portfolio = clone(PORTFOLIO_PRESETS.full.services);
    const importsMW = clamp(Number(scenario.importsMW) || 0, 0, 3000);
    return {
      name: scenario.name,
      narrative: scenario.narrative,
      presetScenarioId: "operatorBase",
      presetPortfolioId: "full",
      weather: scenario.weather,
      demandGW: scenario.demandGW,
      generationGW: Number.isFinite(Number(scenario.generationGW)) ? Number(scenario.generationGW) : Math.max(scenario.demandGW - (importsMW / 1000), 0),
      resShare: scenario.resShare,
      importsMW: importsMW,
      systemStrength: scenario.systemStrength,
      enableVoltageLayer: true,
      lossMW: scenario.lossMW,
      eventType: scenario.eventType,
      rampDuration: scenario.rampDuration,
      tFault: scenario.tFault,
      duration: scenario.duration,
      dt: scenario.dt,
      protections: {
        enableLfdd: true,
        lfddStage1MW: 931,
        enableVoltageRelief: false,
        voltageReliefMW: 450,
        enableReserveRelief: false,
        reserveReliefMW: 300,
        enableEmbeddedTrips: true,
        embeddedTripMW: 350
      },
      services: portfolio
    };
  }

  function applyScenarioPreset(config, presetId) {
    const preset = SCENARIO_PRESETS[presetId];
    if (!preset) {
      return config;
    }
    return Object.assign({}, config, clone(preset), {
      services: clone(config.services),
      protections: clone(preset.protections || config.protections || {
        enableLfdd: true,
        lfddStage1MW: 931,
        enableVoltageRelief: false,
        voltageReliefMW: 450,
        enableReserveRelief: false,
        reserveReliefMW: 300,
        enableEmbeddedTrips: true,
        embeddedTripMW: 350
      }),
      presetScenarioId: presetId,
      name: preset.name,
      narrative: preset.narrative
    });
  }

  function applyPortfolioPreset(config, presetId) {
    const preset = PORTFOLIO_PRESETS[presetId];
    if (!preset) {
      return config;
    }
    return Object.assign({}, config, {
      services: clone(preset.services),
      presetPortfolioId: presetId
    });
  }

  function inferDemandBand(demandGW) {
    if (demandGW <= 23) {
      return "Low demand";
    }
    if (demandGW >= 38) {
      return "High demand";
    }
    return "Medium demand";
  }

  function mean(values) {
    if (!values.length) {
      return 0;
    }
    let total = 0;
    for (let i = 0; i < values.length; i += 1) {
      total += values[i];
    }
    return total / values.length;
  }

  function statusSeverity(status) {
    return STATUS_SEVERITY[status] || 0;
  }

  function statusFromSeverity(severity) {
    if (severity >= STATUS_SEVERITY["BLACKOUT"]) {
      return "BLACKOUT";
    }
    if (severity >= STATUS_SEVERITY.EMERGENCY) {
      return "EMERGENCY";
    }
    if (severity >= STATUS_SEVERITY.STRESSED) {
      return "STRESSED";
    }
    return "SECURE";
  }

  function worstStatus(statuses) {
    let maxSeverity = 0;
    for (let i = 0; i < statuses.length; i += 1) {
      maxSeverity = Math.max(maxSeverity, statusSeverity(statuses[i]));
    }
    return statusFromSeverity(maxSeverity);
  }

  function classifyMetricComponents(kpis, summary) {
    let frequencyStatus = "SECURE";
    if (summary.lfddTriggered) {
      frequencyStatus = "BLACKOUT";
    } else if (kpis.Nadir_Hz < LIMITS.frequency.lfdd) {
      frequencyStatus = "BLACKOUT";
    } else if (kpis.Nadir_Hz <= LIMITS.frequency.warningLow) {
      frequencyStatus = "EMERGENCY";
    } else if (kpis.Nadir_Hz <= LIMITS.frequency.operationalLow) {
      frequencyStatus = "STRESSED";
    }

    let rocofStatus = "SECURE";
    if (kpis.MaxRoCoF > LIMITS.rocof.trip) {
      rocofStatus = "BLACKOUT";
    } else if (kpis.MaxRoCoF >= 0.75) {
      rocofStatus = "EMERGENCY";
    } else if (kpis.MaxRoCoF >= LIMITS.rocof.operational) {
      rocofStatus = "STRESSED";
    }

    let recoveryStatus = "SECURE";
    if (!Number.isFinite(kpis.Recovery_s)) {
      recoveryStatus = "BLACKOUT";
    } else if (kpis.Recovery_s > LIMITS.recovery.marginal) {
      recoveryStatus = "EMERGENCY";
    } else if (kpis.Recovery_s > LIMITS.recovery.good) {
      recoveryStatus = "STRESSED";
    }

    let energyStatus = "SECURE";
    if (kpis.SoC_min < 0.05) {
      energyStatus = "EMERGENCY";
    } else if (kpis.SoC_min < LIMITS.soc.minimum) {
      energyStatus = "EMERGENCY";
    } else if (kpis.SoC_min < LIMITS.soc.healthy) {
      energyStatus = "STRESSED";
    }

    let voltageStatus = "BYPASSED";
    if (summary.voltageLayerEnabled) {
      if (
        kpis.V_min < MODEL_CONSTANTS.voltageEmergencyFloor
        || kpis.V_min < LIMITS.voltage.hard
        || (!Number.isFinite(kpis.V_recovery_s) && kpis.V_min < LIMITS.voltage.hard)
        || (Number.isFinite(kpis.V_recovery_s) && kpis.V_recovery_s > LIMITS.recovery.marginal)
      ) {
        voltageStatus = "EMERGENCY";
      } else if (
        kpis.V_min < LIMITS.voltage.warning
        || (Number.isFinite(kpis.V_recovery_s) && kpis.V_recovery_s > LIMITS.recovery.good)
      ) {
        voltageStatus = "STRESSED";
      } else {
        voltageStatus = "SECURE";
      }
    }

    const frequencyEnvelope = worstStatus([frequencyStatus, rocofStatus, recoveryStatus]);
    return {
      frequency: { status: frequencyStatus },
      rocof: { status: rocofStatus },
      recovery: { status: recoveryStatus },
      energy: { status: energyStatus },
      voltage: { status: voltageStatus },
      frequencyEnvelope: { status: frequencyEnvelope }
    };
  }

  function buildAxisLevels(baseLevels, currentValue, digits) {
    const normalizedCurrent = Number(Number(currentValue).toFixed(digits));
    const levels = baseLevels.slice();
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < levels.length; i += 1) {
      const distance = Math.abs(levels[i] - normalizedCurrent);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    levels[bestIndex] = normalizedCurrent;
    return Array.from(new Set(levels.map(function (value) {
      return Number(Number(value).toFixed(digits));
    }))).sort(function (a, b) { return a - b; });
  }

  function buildSweepLevels(currentValue, maxValue, step) {
    const levels = [];
    for (let loss = 500; loss <= maxValue; loss += step) {
      levels.push(loss);
    }
    levels.push(Number(currentValue));
    return Array.from(new Set(levels)).sort(function (a, b) { return a - b; });
  }

  function buildAug2019Breakdown(config) {
    const protections = Object.assign({
      enableEmbeddedTrips: true,
      embeddedTripMW: 350
    }, config.protections || {});
    const baseScheduledMW = 737 + 244 + 210 + 187;
    const nominalEmbeddedTripMW = Math.max(Number(protections.embeddedTripMW) || 0, 0);
    const embeddedTripMW = protections.enableEmbeddedTrips ? nominalEmbeddedTripMW : 0;
    const scheduledMW = Math.max((Number(config.lossMW) || 0) - nominalEmbeddedTripMW, 0);
    const scale = scheduledMW / baseScheduledMW;
    return {
      hornseaMW: 737 * scale,
      steamMW: 244 * scale,
      gt1aMW: 210 * scale,
      gt1bMW: 187 * scale,
      embeddedTripMW: embeddedTripMW,
      totalMW: scheduledMW + embeddedTripMW
    };
  }

  function buildProfiles(config) {
    const constants = MODEL_CONSTANTS;
    const dt = config.dt;
    const duration = config.duration;
    const t = [];
    for (let x = 0; x <= duration + 1e-9; x += dt) {
      t.push(Number(x.toFixed(10)));
    }

    const weather = WEATHER_LIBRARY[config.weather] || WEATHER_LIBRARY.windy;
    const eventIndex = Math.max(1, Math.floor(config.tFault / dt));
    const prefaultCount = Math.max(5, eventIndex);
    const generationBaseGW = Math.max(config.demandGW - (config.importsMW / 1000), 0);
    const generationScale = config.demandGW > 0 ? generationBaseGW / config.demandGW : 1;

    const demandPu = [];
    const generationTargetPu = [];
    const windShape = [];
    const solarShape = [];
    const durationNorm = Math.max(duration, 1);

    for (let i = 0; i < t.length; i += 1) {
      const time = t[i];
      const loadBias = 1
        + 0.04 * Math.sin((2 * Math.PI * time) / durationNorm - 0.35)
        + 0.01 * Math.sin((2 * Math.PI * time) / 47 + 0.2);
      const demandPointPu = (config.demandGW * 1e9 / constants.Sbase) * loadBias;
      demandPu.push(demandPointPu);
      generationTargetPu.push(demandPointPu * generationScale);

      const windSignal = weather.windShape.base
        + weather.windShape.amp1 * Math.sin((2 * Math.PI * time) / 120 + weather.windShape.phase)
        + weather.windShape.amp2 * Math.sin((2 * Math.PI * time) / 38 - 0.6);
      const solarBell = Math.max(0.2, Math.cos((Math.PI * (time - durationNorm * 0.5)) / (durationNorm * 0.9)));
      const solarSignal = weather.solarShape.base
        + weather.solarShape.amp1 * solarBell
        + weather.solarShape.amp2 * Math.sin((2 * Math.PI * time) / 180 + weather.solarShape.phase);

      windShape.push(Math.max(0.06, windSignal));
      solarShape.push(Math.max(0.05, solarSignal));
    }

    const prefaultDemandPu = mean(demandPu.slice(0, prefaultCount));
    const prefaultGenerationPu = mean(generationTargetPu.slice(0, prefaultCount));
    const structuralResPu = prefaultGenerationPu * config.resShare;
    const targetResPu = clamp(structuralResPu, 0, prefaultGenerationPu * 0.98);
    const windSplit = clamp(weather.windShare, 0.15, 0.90);
    const solarSplit = 1 - windSplit;
    const windScale = (targetResPu * windSplit) / Math.max(mean(windShape.slice(0, prefaultCount)), 1e-6);
    const solarScale = (targetResPu * solarSplit) / Math.max(mean(solarShape.slice(0, prefaultCount)), 1e-6);

    const windPu = windShape.map(function (value) { return value * windScale; });
    const solarPu = solarShape.map(function (value) { return value * solarScale; });
    const resPu = windPu.map(function (value, index) { return value + solarPu[index]; });

    return {
      t: t,
      demandPu: demandPu,
      generationTargetPu: generationTargetPu,
      windPu: windPu,
      solarPu: solarPu,
      resPu: resPu,
      weather: weather,
      structuralResPu: structuralResPu,
      targetResPu: targetResPu
    };
  }

  function buildEventProfiles(t, config, profile) {
    const magnitudePu = (config.lossMW * 1e6) / MODEL_CONSTANTS.Sbase;
    const lossPu = new Array(t.length).fill(0);
    const windAdjustmentPu = new Array(t.length).fill(0);
    const solarAdjustmentPu = new Array(t.length).fill(0);
    const aug2019 = config.eventType === "aug2019"
      ? buildAug2019Breakdown(config)
      : null;
    const prefaultCount = Math.max(5, Math.floor(config.tFault / Math.max(config.dt, 1e-6)));
    const prefaultWindPu = profile ? mean(profile.windPu.slice(0, prefaultCount)) : 0;
    const prefaultSolarPu = profile ? mean(profile.solarPu.slice(0, prefaultCount)) : 0;
    const windStepPu = config.eventType === "windStep" ? Math.min(magnitudePu, prefaultWindPu) : 0;
    const solarStepPu = config.eventType === "solarStep" ? Math.min(magnitudePu, prefaultSolarPu) : 0;

    function eventFraction(time) {
      if (time < config.tFault) {
        return 0;
      }
      if (config.eventType === "aug2019") {
        return 1;
      }
      return 1;
    }

    for (let i = 0; i < t.length; i += 1) {
      const time = t[i];
      const frac = eventFraction(time);
      if (config.eventType === "aug2019") {
        const timeFromFault = time - config.tFault;
        if (timeFromFault >= 0) {
          lossPu[i] += (aug2019.steamMW * 1e6) / MODEL_CONSTANTS.Sbase;
          lossPu[i] += ((aug2019.hornseaMW * Math.min(Math.max(timeFromFault / 0.2, 0), 1)) * 1e6) / MODEL_CONSTANTS.Sbase;
        }
        if (timeFromFault >= 57) {
          lossPu[i] += (aug2019.gt1aMW * 1e6) / MODEL_CONSTANTS.Sbase;
        }
        if (timeFromFault >= 84) {
          lossPu[i] += (aug2019.gt1bMW * 1e6) / MODEL_CONSTANTS.Sbase;
        }
        continue;
      }
      if (config.eventType === "windStep" && frac > 0 && profile) {
        windAdjustmentPu[i] = -Math.min(windStepPu, profile.windPu[i]);
        continue;
      }
      if (config.eventType === "solarStep" && frac > 0 && profile) {
        solarAdjustmentPu[i] = -Math.min(solarStepPu, profile.solarPu[i]);
        continue;
      }
      lossPu[i] = magnitudePu * frac;
    }

    return {
      lossPu: lossPu,
      windAdjustmentPu: windAdjustmentPu,
      solarAdjustmentPu: solarAdjustmentPu,
      windStepMW: windStepPu * MODEL_CONSTANTS.Sbase / 1e6,
      solarStepMW: solarStepPu * MODEL_CONSTANTS.Sbase / 1e6
    };
  }

  function normalizeServices(input) {
    const services = clone(input);
    services.bessMW = Number(services.bessMW || 0);
    services.bessMWh = Number(services.bessMWh || 0);
    services.bessSoC0 = Number.isFinite(Number(services.bessSoC0)) ? Number(services.bessSoC0) : 0.5;
    services.govMW = Number(services.govMW || 0);
    services.headroomPct = Number(services.headroomPct || 0);
    services.drMW = Number(services.drMW || 0);
    services.useSyncon = Boolean(services.useSyncon);
    services.synconH = Number(services.synconH || 0);
    services.useGfm = Boolean(services.useGfm);
    services.gfmD = Number(services.gfmD || 0);
    services.useImportSupport = Boolean(services.useImportSupport);
    services.importResponseMW = services.useImportSupport ? Number(services.importResponseMW || 0) : 0;
    return services;
  }

  function simulateGrid(rawConfig) {
    const config = clone(rawConfig);
    const constants = MODEL_CONSTANTS;
    config.importsMW = clamp(Number(config.importsMW) || 0, 0, 3000);
    const voltageLayerEnabled = config.enableVoltageLayer !== false;
    const requestedSystemStrength = clamp(
      Number.isFinite(Number(config.systemStrength)) ? Number(config.systemStrength) : (config.weakGrid ? 0.72 : 1.0),
      0.45,
      1.35
    );
    const systemStrength = voltageLayerEnabled ? requestedSystemStrength : 1.0;
    config.systemStrength = requestedSystemStrength;
    const profile = buildProfiles(config);
    const t = profile.t;
    const dt = config.dt;
    const Sbase = constants.Sbase;
    const f0 = constants.f0;

    const services = normalizeServices(config.services || {});
    const protections = Object.assign({
      enableLfdd: true,
      lfddStage1MW: 931,
      enableVoltageRelief: false,
      voltageReliefMW: 450,
      enableReserveRelief: false,
      reserveReliefMW: 300,
      enableEmbeddedTrips: true,
      embeddedTripMW: 350
    }, config.protections || {});
    const eventProfiles = buildEventProfiles(t, config, profile);
    const aug2019Breakdown = config.eventType === "aug2019"
      ? buildAug2019Breakdown(config)
      : null;
    const P_importBase = (config.importsMW * 1e6) / Sbase;
    const scheduledHeadroomPu = profile.resPu.map(function (value) {
      return Math.max(value, 0) * services.headroomPct;
    });
    const scheduledConventionalPu = profile.generationTargetPu.map(function (generationTarget, index) {
      return Math.max(generationTarget - (profile.resPu[index] - scheduledHeadroomPu[index]), 0);
    });
    const windPu = profile.windPu.map(function (value, index) {
      return Math.max(0, value + eventProfiles.windAdjustmentPu[index]);
    });
    const solarPu = profile.solarPu.map(function (value, index) {
      return Math.max(0, value + eventProfiles.solarAdjustmentPu[index]);
    });
    const resPu = windPu.map(function (value, index) {
      return value + solarPu[index];
    });
    const disturbanceEquivalentPu = resPu.map(function (_value, index) {
      return eventProfiles.lossPu[index]
        + (profile.windPu[index] - windPu[index])
        + (profile.solarPu[index] - solarPu[index]);
    });
    const headroomAvailPu = resPu.map(function (value) {
      return Math.max(value, 0) * services.headroomPct;
    });

    let baseInertia = constants.H_base * (1 - constants.alphaH * config.resShare)
      + constants.H_min * (constants.alphaH * config.resShare);
    const strengthWeakness = voltageLayerEnabled ? clamp((1.0 - systemStrength) / 0.55, 0, 1) : 0;
    const strengthBonus = voltageLayerEnabled ? clamp((systemStrength - 1.0) / 0.35, 0, 1) : 0;
    const effectiveInertia = baseInertia + (services.useSyncon ? services.synconH : 0);
    const effectiveDamping = Math.max(
      0.45,
      constants.D + (services.useGfm ? services.gfmD : 0)
    );

    let sclIndex = 0.30 + 0.78 * systemStrength - 0.48 * config.resShare;
    if (services.useSyncon) {
      sclIndex += 0.15;
    }
    if (services.useGfm) {
      sclIndex += 0.06;
    }
    sclIndex = clamp(sclIndex, 0.18, 1.22);
    const nominalVoltageTarget = voltageLayerEnabled
      ? 1
        - constants.weakGridVoltagePenalty * strengthWeakness * (0.25 + 0.75 * config.resShare)
        + 0.01 * strengthBonus
      : 1.0;

    const bessPowerPu = (services.bessMW * 1e6) / Sbase;
    const bessEnergyPuS = (services.bessMWh * 3.6e9) / Sbase;
    const governorMaxPu = (services.govMW * 1e6) / Sbase;
    const drMaxPu = (services.drMW * 1e6) / Sbase;
    const importAssistCapPu = (services.importResponseMW * 1e6) / Sbase;
    const prefaultDemandRefPu = mean(profile.demandPu.slice(0, Math.max(5, Math.floor(config.tFault / dt))));

    const frequency = new Array(t.length).fill(f0);
    const voltage = new Array(t.length).fill(1.0);
    const rocof = new Array(t.length).fill(0);
    const soc = new Array(t.length).fill(clamp(services.bessSoC0, constants.socMin, constants.socMax));
    const dispatch = {
      windGW: windPu.map(function (value) { return value * Sbase / 1e9; }),
      solarGW: solarPu.map(function (value) { return value * Sbase / 1e9; }),
      resGW: resPu.map(function (value) { return value * Sbase / 1e9; }),
      demandGW: profile.demandPu.map(function (value) { return value * Sbase / 1e9; }),
      disturbanceGW: disturbanceEquivalentPu.map(function (value) { return value * Sbase / 1e9; }),
      conventionalGW: scheduledConventionalPu.map(function (value) { return value * Sbase / 1e9; }),
      importsBaseGW: new Array(t.length).fill(P_importBase * Sbase / 1e9),
      importsTotalGW: new Array(t.length).fill(P_importBase * Sbase / 1e9),
      bessGW: new Array(t.length).fill(0),
      governorGW: new Array(t.length).fill(0),
      headroomGW: new Array(t.length).fill(0),
      drGW: new Array(t.length).fill(0),
      importAssistGW: new Array(t.length).fill(0),
      demandShedGW: new Array(t.length).fill(0),
      effectiveDemandGW: new Array(t.length).fill(0),
      serviceTotalGW: new Array(t.length).fill(0),
      imbalanceGW: new Array(t.length).fill(0),
      netGenerationGW: new Array(t.length).fill(0)
    };

    const eventLog = [];
    const rocofLegacyLossPu = ((Number(protections.embeddedTripMW) || 350) * 1e6) / Sbase;
    const frequencyAnomalyLossPu = (constants.frequencyAnomalyLossMW * 1e6) / Sbase;
    const lfddStages = (config.eventType === "aug2019"
      ? constants.lfddAug2019Stages
      : constants.lfddGenericStages).map(function (stage, stageIndex) {
      if (stageIndex === 0) {
        return Object.assign({}, stage, { shedMW: Number(protections.lfddStage1MW) || 0 });
      }
      return Object.assign({}, stage);
    });
    const lfddTimers = new Array(lfddStages.length).fill(null);
    const uvlsReliefPu = ((Number(protections.voltageReliefMW) || 0) * 1e6) / Sbase;
    const reserveReliefPu = ((Number(protections.reserveReliefMW) || 0) * 1e6) / Sbase;
    let uvlsTimer = null;
    let reserveReliefTimer = null;
    let uvlsTriggered = false;
    let reserveProtectionTriggered = false;
    let protectionTriggered = false;
    let conditionalLossPu = 0;
    let demandShedPu = 0;
    let lfddStageReached = 0;
    let lfddActivated = false;
    let legacyRoCoFTriggered = false;
    let frequencyAnomalyTriggered = false;

    if (config.eventType === "aug2019" && aug2019Breakdown) {
      eventLog.push(
        { time: config.tFault, label: "Hornsea de-loading", impactGW: aug2019Breakdown.hornseaMW / 1000, category: "event" },
        { time: config.tFault, label: "Little Barford steam turbine trip", impactGW: aug2019Breakdown.steamMW / 1000, category: "event" }
      );
      eventLog.push(
        { time: config.tFault + 57, label: "Little Barford GT1A trip", impactGW: aug2019Breakdown.gt1aMW / 1000, category: "event" },
        { time: config.tFault + 84, label: "Little Barford GT1B trip", impactGW: aug2019Breakdown.gt1bMW / 1000, category: "event" }
      );
    }

    let governorState = 0;
    let agcState = 0;
    let drState = 0;
    let bessSustainState = 0;
    let chargeState = soc[0];

    let nadirHz = f0;
    let nadirIndex = 0;
    let maxRoCoF = 0;
    let minVoltage = 1.0;
    let maxDeficitGW = 0;
    let bessSatTime = 0;
    let governorSatTime = 0;
    let curtailmentPuS = 0;
    let drEnergyPuS = 0;

    for (let i = 1; i < t.length; i += 1) {
      const df = frequency[i - 1] - f0;
      const voltageMarginFactor = voltageLayerEnabled
        ? clamp(
          (voltage[i - 1] - LIMITS.voltage.hard) / Math.max(LIMITS.voltage.warning - LIMITS.voltage.hard, 1e-6),
          0,
          1
        )
        : 1;
      const serviceAvailability = voltageLayerEnabled
        ? clamp(
          constants.voltageServiceFloor + 0.22 * voltageMarginFactor + 0.05 * (1 - strengthWeakness) + 0.03 * strengthBonus,
          constants.voltageServiceFloor,
          1.05
        )
        : 1;
      const bessAvailability = services.useGfm ? Math.max(serviceAvailability, 0.88) : serviceAvailability;
      let dfEff = 0;
      if (Math.abs(df) > constants.ffrDeadband) {
        dfEff = df - Math.sign(df) * constants.ffrDeadband;
      }

      let activationFactor = 0;
      if (t[i] >= config.tFault + constants.ffrDelay) {
        activationFactor = 1;
      } else if (t[i] >= config.tFault) {
        activationFactor = clamp((t[i] - config.tFault) / constants.ffrDelay, 0, 1);
      }

      const fallingRoCoF = Math.max(-rocof[i - 1], 0);
      const fastBessPu = services.bessMW > 0
        ? activationFactor * (constants.k_ffr * (-dfEff) + constants.k_ffrRoCoF * fallingRoCoF)
        : 0;
      const energyAboveFloor = Math.max(chargeState - constants.socMin, 0);
      const sustainCapPu = bessEnergyPuS > 0
        ? Math.min(bessPowerPu, (energyAboveFloor * bessEnergyPuS) / constants.bessSustainHorizonS)
        : 0;
      const sustainTargetPu = services.bessMW > 0
        ? clamp(activationFactor * 0.95 * Math.max(-df - 0.01, 0) * bessAvailability, 0, sustainCapPu)
        : 0;
      bessSustainState += dt * (sustainTargetPu - bessSustainState) / constants.bessEnergyTau;
      bessSustainState = clamp(bessSustainState, 0, Math.max(sustainCapPu, 0));

      let bessPu = fastBessPu * bessAvailability + bessSustainState;
      bessPu = clamp(bessPu, -bessPowerPu, bessPowerPu);

      if (bessPu > 0 && chargeState <= constants.socMin) {
        bessPu = 0;
        bessSustainState = 0;
      }
      if (bessPu < 0 && chargeState >= constants.socMax) {
        bessPu = 0;
      }

      if (bessEnergyPuS > 0 && bessPu !== 0) {
        if (bessPu > 0) {
          chargeState -= (bessPu / constants.bessEtaDischarge) * dt / bessEnergyPuS;
        } else {
          chargeState -= (bessPu * constants.bessEtaCharge) * dt / bessEnergyPuS;
        }
      }
      chargeState = clamp(chargeState, 0, 1);
      soc[i] = chargeState;

      if (bessPowerPu > 0 && Math.abs(bessPu) >= bessPowerPu * 0.99) {
        bessSatTime += dt;
      }

      let governorPu = 0;
      if (services.govMW > 0) {
        agcState += dt * constants.kAgc * (-df);
        agcState = clamp(agcState, 0, governorMaxPu);
        const governorCommand = clamp(constants.kGov * (-df) + agcState, 0, governorMaxPu * serviceAvailability);
        governorState += dt * (governorCommand - governorState) / constants.tauGov;
        governorPu = governorState;
        if (governorCommand >= governorMaxPu * 0.99 && governorMaxPu > 0) {
          governorSatTime += dt;
        }
      } else {
        governorState = 0;
        agcState = 0;
      }

      const headroomPu = clamp(constants.kHeadroom * (-df) * serviceAvailability, 0, headroomAvailPu[i]);
      curtailmentPuS += headroomPu * dt;

      let demandResponsePu = 0;
      if (services.drMW > 0) {
        const drCommand = t[i] >= config.tFault + constants.drDelay ? drMaxPu : 0;
        drState += dt * (drCommand - drState) / constants.drTau;
        demandResponsePu = drState;
        drEnergyPuS += demandResponsePu * dt;
      } else {
        drState = 0;
      }

      let importAssistPu = 0;
      if (services.importResponseMW > 0 && (df < -0.08 || rocof[i - 1] < -0.20)) {
        importAssistPu = clamp(
          (constants.importGain * Math.max(-df - 0.04, 0) + constants.importRoCoFGain * fallingRoCoF) * serviceAvailability,
          0,
          importAssistCapPu
        );
      }

      if (protections.enableEmbeddedTrips && t[i] >= config.tFault) {
        const severeDynamicStress = (
          frequency[i - 1] <= LIMITS.frequency.warningLow
          || (Math.abs(rocof[i - 1]) >= constants.legacyRoCoFHzPerS && frequency[i - 1] <= LIMITS.frequency.operationalLow)
        );
        if (!legacyRoCoFTriggered && severeDynamicStress) {
          const followOnLossPu = config.eventType === "aug2019" && aug2019Breakdown
            ? (aug2019Breakdown.embeddedTripMW * 1e6) / Sbase
            : rocofLegacyLossPu;
          if (followOnLossPu > 0) {
            conditionalLossPu += followOnLossPu;
            legacyRoCoFTriggered = true;
            eventLog.push({
              time: t[i],
              label: config.eventType === "aug2019" ? "Embedded generation vector-shift trip" : "Adverse follow-on generation trip",
              impactGW: followOnLossPu * Sbase / 1e9,
              category: "cascade"
            });
          }
          legacyRoCoFTriggered = true;
        }
        if (config.eventType !== "aug2019" && !frequencyAnomalyTriggered && frequency[i - 1] <= constants.frequencyAnomalyHz) {
          conditionalLossPu += frequencyAnomalyLossPu;
          frequencyAnomalyTriggered = true;
          eventLog.push({
            time: t[i],
            label: "Additional low-frequency disturbance trip",
            impactGW: frequencyAnomalyLossPu * Sbase / 1e9,
            category: "cascade"
          });
        }
      }

      if (protections.enableLfdd) {
        for (let stageIndex = lfddStageReached; stageIndex < lfddStages.length; stageIndex += 1) {
          const stage = lfddStages[stageIndex];
          if (frequency[i - 1] <= stage.thresholdHz) {
            if (lfddTimers[stageIndex] === null) {
              lfddTimers[stageIndex] = t[i];
            }
            if (t[i] - lfddTimers[stageIndex] >= constants.lfddConfirmS) {
              const stageShedPu = Number.isFinite(stage.shedMW)
                ? (stage.shedMW * 1e6) / Sbase
                : prefaultDemandRefPu * stage.shedFraction;
              demandShedPu += stageShedPu;
              lfddStageReached = stageIndex + 1;
              lfddActivated = true;
              lfddTimers[stageIndex] = null;
              eventLog.push({
                time: t[i],
                label: stage.label,
                impactGW: stageShedPu * Sbase / 1e9,
                category: "lfdd"
              });
            }
          } else {
            lfddTimers[stageIndex] = null;
          }
        }
      }

      if (voltageLayerEnabled && protections.enableVoltageRelief && !uvlsTriggered && uvlsReliefPu > 0 && t[i] >= config.tFault) {
        const severeVoltageStress = voltage[i - 1] <= LIMITS.voltage.hard
          && (frequency[i - 1] <= LIMITS.frequency.warningLow || Math.abs(rocof[i - 1]) >= LIMITS.rocof.operational);
        if (severeVoltageStress) {
          if (uvlsTimer === null) {
            uvlsTimer = t[i];
          }
          if (t[i] - uvlsTimer >= constants.uvlsConfirmS) {
            demandShedPu += uvlsReliefPu;
            uvlsTriggered = true;
            protectionTriggered = true;
            uvlsTimer = null;
            eventLog.push({
              time: t[i],
              label: "Under-voltage emergency relief",
              impactGW: uvlsReliefPu * Sbase / 1e9,
              category: "protection"
            });
          }
        } else {
          uvlsTimer = null;
        }
      }

      if (protections.enableReserveRelief && !reserveProtectionTriggered && reserveReliefPu > 0 && t[i] >= config.tFault) {
        const reserveEmergency = chargeState <= LIMITS.soc.minimum
          && frequency[i - 1] <= LIMITS.frequency.warningLow;
        if (reserveEmergency) {
          if (reserveReliefTimer === null) {
            reserveReliefTimer = t[i];
          }
          if (t[i] - reserveReliefTimer >= constants.reserveReliefConfirmS) {
            demandShedPu += reserveReliefPu;
            reserveProtectionTriggered = true;
            protectionTriggered = true;
            reserveReliefTimer = null;
            eventLog.push({
              time: t[i],
              label: "Reserve-floor emergency relief",
              impactGW: reserveReliefPu * Sbase / 1e9,
              category: "protection"
            });
          }
        } else {
          reserveReliefTimer = null;
        }
      }

      const generationPu = (resPu[i] - headroomAvailPu[i])
        + headroomPu
        + scheduledConventionalPu[i]
        + governorPu
        + bessPu
        + demandResponsePu
        + P_importBase
        + importAssistPu;

      const totalLossPu = eventProfiles.lossPu[i] + conditionalLossPu;
      const effectiveDemandPu = Math.max(0, profile.demandPu[i] - demandShedPu);
      const imbalancePu = generationPu - effectiveDemandPu - totalLossPu;
      const electromechanicalFactor = voltageLayerEnabled
        ? clamp(0.88 + 0.14 * voltageMarginFactor - 0.05 * strengthWeakness + 0.03 * strengthBonus, 0.80, 1.05)
        : 1;
      const dynamicDamping = effectiveDamping * electromechanicalFactor;
      const dfdot = (f0 / (2 * effectiveInertia)) * (imbalancePu - dynamicDamping * (df / f0));
      frequency[i] = frequency[i - 1] + dt * dfdot;
      rocof[i] = (frequency[i] - frequency[i - 1]) / dt;

      if (voltageLayerEnabled) {
        const gfmScale = services.useGfm ? Math.max(services.gfmD, 0) / 0.8 : 0;
        const reactiveSupport = clamp(
          gfmScale * constants.gfmVoltageGain * (1 - voltage[i - 1]),
          -constants.gfmVoltageCap,
          constants.gfmVoltageCap
        );
        const synconSupport = services.useSyncon ? constants.synconVoltageGain * (1 - voltage[i - 1]) : 0;
        const deficitStressPu = Math.max(-imbalancePu, 0);
        const frequencyStress = Math.max(-df, 0) / 0.6;
        const rocofStress = Math.max(-rocof[i - 1], 0) / 0.7;
        const dVdt = (nominalVoltageTarget - voltage[i - 1]) / (constants.voltageTimeConstant * (1 + 0.55 * strengthWeakness - 0.15 * strengthBonus))
          - (constants.voltageImbalanceGain / Math.max(0.35, sclIndex)) * deficitStressPu
          - constants.voltageFrequencyGain * frequencyStress
          - constants.voltageRoCoFGain * rocofStress
          + reactiveSupport
          + synconSupport;
        voltage[i] = clamp(voltage[i - 1] + dt * dVdt, constants.hardVoltageMin, constants.hardVoltageMax);
      } else {
        voltage[i] = 1.0;
      }

      dispatch.bessGW[i] = bessPu * Sbase / 1e9;
      dispatch.governorGW[i] = governorPu * Sbase / 1e9;
      dispatch.headroomGW[i] = headroomPu * Sbase / 1e9;
      dispatch.drGW[i] = demandResponsePu * Sbase / 1e9;
      dispatch.importAssistGW[i] = importAssistPu * Sbase / 1e9;
      dispatch.demandShedGW[i] = demandShedPu * Sbase / 1e9;
      dispatch.effectiveDemandGW[i] = effectiveDemandPu * Sbase / 1e9;
      dispatch.serviceTotalGW[i] = (bessPu + governorPu + headroomPu + demandResponsePu + importAssistPu) * Sbase / 1e9;
      dispatch.importsTotalGW[i] = (P_importBase + importAssistPu) * Sbase / 1e9;
      dispatch.disturbanceGW[i] = (totalLossPu + (profile.windPu[i] - windPu[i]) + (profile.solarPu[i] - solarPu[i])) * Sbase / 1e9;
      dispatch.imbalanceGW[i] = imbalancePu * Sbase / 1e9;
      dispatch.netGenerationGW[i] = generationPu * Sbase / 1e9;

      if (frequency[i] < nadirHz) {
        nadirHz = frequency[i];
        nadirIndex = i;
      }
      maxRoCoF = Math.max(maxRoCoF, Math.abs(rocof[i]));
      minVoltage = Math.min(minVoltage, voltage[i]);
      maxDeficitGW = Math.max(maxDeficitGW, Math.abs(Math.min(dispatch.imbalanceGW[i], 0)));
    }

    const recoveryIndex = findSustainedIndex(
      frequency,
      t,
      config.tFault,
      1.0,
      function withinBand(value) {
        return Math.abs(value - f0) <= 0.2;
      }
    );

    const arrestIndex = findArrestIndex(frequency, nadirIndex);
    const voltageRecoveryIndex = findSustainedIndex(
      voltage,
      t,
      config.tFault,
      1.5,
      function withinVoltageBand(value) {
        return Math.abs(value - nominalVoltageTarget) <= 0.015;
      }
    );

    const postFaultStartIndex = Math.max(0, Math.floor(config.tFault / dt));
    const demandShedMWh = dispatch.demandShedGW.reduce(function (total, value, index) {
      return index >= postFaultStartIndex ? total + (value * dt / 3600) : total;
    }, 0);
    const blackoutDurationS = accumulateConditionDuration(frequency, postFaultStartIndex, dt, function (_value, index) {
      return dispatch.demandShedGW[index] > 0.01 || frequency[index] < LIMITS.frequency.lfdd;
    });
    const emergencyDurationS = accumulateConditionDuration(frequency, postFaultStartIndex, dt, function (_value, index) {
      if (dispatch.demandShedGW[index] > 0.01 || frequency[index] < LIMITS.frequency.lfdd) {
        return false;
      }
      return frequency[index] < LIMITS.frequency.warningLow
        || Math.abs(rocof[index]) >= 0.75
        || (voltageLayerEnabled && voltage[index] < LIMITS.voltage.hard)
        || soc[index] < LIMITS.soc.minimum;
    });
    const stressedDurationS = accumulateConditionDuration(frequency, postFaultStartIndex, dt, function (_value, index) {
      if (
        dispatch.demandShedGW[index] > 0.01
        || frequency[index] < LIMITS.frequency.lfdd
        || frequency[index] < LIMITS.frequency.warningLow
        || Math.abs(rocof[index]) >= 0.75
        || (voltageLayerEnabled && voltage[index] < LIMITS.voltage.hard)
        || soc[index] < LIMITS.soc.minimum
      ) {
        return false;
      }
      return frequency[index] < LIMITS.frequency.operationalLow
        || Math.abs(rocof[index]) >= LIMITS.rocof.operational
        || (voltageLayerEnabled && voltage[index] < LIMITS.voltage.warning)
        || soc[index] < LIMITS.soc.healthy;
    });
    const voltageHardDurationS = voltageLayerEnabled
      ? accumulateConditionDuration(voltage, postFaultStartIndex, dt, function (value) { return value < LIMITS.voltage.hard; })
      : 0;
    const voltageWeakDurationS = voltageLayerEnabled
      ? accumulateConditionDuration(voltage, postFaultStartIndex, dt, function (value) { return value < LIMITS.voltage.warning; })
      : 0;
    const freqEmergencyDurationS = accumulateConditionDuration(frequency, postFaultStartIndex, dt, function (value) { return value < LIMITS.frequency.warningLow; });
    const freqBlackoutDurationS = accumulateConditionDuration(frequency, postFaultStartIndex, dt, function (value) { return value < LIMITS.frequency.lfdd; });

    const postFaultSoc = soc.slice(Math.max(0, Math.floor(config.tFault / dt)));
    const prefaultCount = Math.max(2, Math.floor(config.tFault / dt));
    const prefaultWindGW = mean(dispatch.windGW.slice(0, prefaultCount));
    const prefaultSolarGW = mean(dispatch.solarGW.slice(0, prefaultCount));
    const prefaultResGW = mean(dispatch.resGW.slice(0, prefaultCount));
    const prefaultDemandGW = mean(dispatch.demandGW.slice(0, prefaultCount));
    const maxDemandShedGW = Math.max.apply(null, dispatch.demandShedGW);
    const maxServiceGW = Math.max.apply(null, dispatch.serviceTotalGW);
    const kpis = {
      Scenario: config.name || "Custom scenario",
      Weather: (WEATHER_LIBRARY[config.weather] || WEATHER_LIBRARY.windy).label,
      DemandBand: inferDemandBand(config.demandGW),
      RES_pct: config.resShare * 100,
      Loss_GW: config.lossMW / 1000,
      Imports_GW: config.importsMW / 1000,
      SystemStrength: systemStrength,
      RequestedSystemStrength: requestedSystemStrength,
      H_eff_s: effectiveInertia,
      D_eff: effectiveDamping,
      SCL_index: sclIndex,
      Nadir_Hz: nadirHz,
      MaxRoCoF: maxRoCoF,
      Final_f_Hz: frequency[frequency.length - 1],
      Recovery_s: recoveryIndex === -1 ? NaN : t[recoveryIndex] - config.tFault,
      Arrest_s: arrestIndex === -1 ? NaN : t[arrestIndex] - config.tFault,
      V_min: minVoltage,
      V_final: voltage[voltage.length - 1],
      V_recovery_s: voltageRecoveryIndex === -1 ? NaN : t[voltageRecoveryIndex] - config.tFault,
      SoC_min: Math.min.apply(null, postFaultSoc.length ? postFaultSoc : soc),
      SoC_final: soc[soc.length - 1],
      BESS_sat_min: bessSatTime / 60,
      GOV_sat_min: governorSatTime / 60,
      Curtail_MWh: (curtailmentPuS * Sbase) / 3.6e9,
      DR_MWh: (drEnergyPuS * Sbase) / 3.6e9,
      Max_deficit_GW: maxDeficitGW,
      Max_service_GW: maxServiceGW,
      Max_demand_shed_GW: maxDemandShedGW,
      LFDD_stage: lfddStageReached,
      Stress_duration_s: stressedDurationS,
      Emergency_duration_s: emergencyDurationS,
      Blackout_duration_s: blackoutDurationS,
      Demand_shed_MWh: demandShedMWh,
      Freq_emergency_s: freqEmergencyDurationS,
      Freq_blackout_s: freqBlackoutDurationS,
      Voltage_weak_s: voltageWeakDurationS,
      Voltage_hard_s: voltageHardDurationS
    };

    const summary = {
      prefaultWindGW: prefaultWindGW,
      prefaultSolarGW: prefaultSolarGW,
      prefaultResGW: prefaultResGW,
      prefaultDemandGW: prefaultDemandGW,
      prefaultGenerationGW: mean(profile.generationTargetPu.slice(0, Math.max(5, Math.floor(config.tFault / dt)))) * Sbase / 1e9,
      prefaultBalanceGW: mean(profile.generationTargetPu.slice(0, Math.max(5, Math.floor(config.tFault / dt)))) * Sbase / 1e9 + (config.importsMW / 1000) - prefaultDemandGW,
      structuralResGW: (profile.structuralResPu * Sbase) / 1e9,
      windPctOfRes: prefaultResGW > 0 ? (prefaultWindGW / prefaultResGW) * 100 : 0,
      solarPctOfRes: prefaultResGW > 0 ? (prefaultSolarGW / prefaultResGW) * 100 : 0,
      importResponseGW: services.importResponseMW / 1000,
      eventLabel: eventLabel(config.eventType),
      windStepGW: eventProfiles.windStepMW / 1000,
      solarStepGW: eventProfiles.solarStepMW / 1000,
      systemStrength: systemStrength,
      requestedSystemStrength: requestedSystemStrength,
      voltageLayerEnabled: voltageLayerEnabled,
      lfddTriggered: lfddActivated,
      protectionTriggered: protectionTriggered || lfddActivated,
      uvlsTriggered: uvlsTriggered,
      reserveProtectionTriggered: reserveProtectionTriggered,
      maxDemandShedGW: maxDemandShedGW,
      demandShedMWh: demandShedMWh,
      stressedDurationS: stressedDurationS,
      emergencyDurationS: emergencyDurationS,
      blackoutDurationS: blackoutDurationS,
      freqEmergencyDurationS: freqEmergencyDurationS,
      freqBlackoutDurationS: freqBlackoutDurationS,
      voltageWeakDurationS: voltageWeakDurationS,
      voltageHardDurationS: voltageHardDurationS,
      protections: protections
    };

    const componentAssessment = classifyMetricComponents(kpis, summary);
    const operationalClass = classifyOperationalScenario(kpis, summary, componentAssessment);
    const enhancedClass = classifyEnhancedScenario(kpis, summary, componentAssessment);
    const milestones = {
      prefaultIndex: Math.max(0, Math.floor((config.tFault - 1) / dt)),
      faultIndex: Math.max(0, Math.floor(config.tFault / dt)),
      maxRoCoFIndex: indexOfMaxAbs(rocof, false),
      nadirIndex: nadirIndex,
      recoveryIndex: recoveryIndex === -1 ? t.length - 1 : recoveryIndex,
      maxDeficitIndex: indexOfMaxAbs(dispatch.imbalanceGW, false),
      maxServiceIndex: indexOfMax(dispatch.serviceTotalGW),
      minSocIndex: indexOfMin(soc),
      minVoltageIndex: indexOfMin(voltage),
      lfddIndex: indexOfFirstAbove(dispatch.demandShedGW, 0.01)
    };

    return {
      config: config,
      profile: profile,
      dispatch: dispatch,
      traces: {
        t: t,
        frequency: frequency,
        rocof: rocof,
        voltage: voltage,
        soc: soc
      },
      kpis: kpis,
      componentAssessment: componentAssessment,
      operationalClass: operationalClass,
      enhancedClass: enhancedClass,
      milestones: milestones,
      summary: summary,
      events: eventLog.sort(function (a, b) { return a.time - b.time; })
    };
  }

  function classifyOperationalScenario(kpis, summary, componentAssessment) {
    const components = componentAssessment || classifyMetricComponents(kpis, summary);
    const frequencySeverity = statusSeverity(components.frequencyEnvelope.status);
    const energySeverity = statusSeverity(components.energy.status);
    const voltageSeverity = components.voltage.status === "BYPASSED" ? 0 : statusSeverity(components.voltage.status);
    let status = statusFromSeverity(frequencySeverity);
    let reason = "The scenario stays inside operational limits without emergency intervention.";

    if (summary.lfddTriggered) {
      status = "BLACKOUT";
      reason = "LFDD demand disconnection is triggered, so the run includes a realised blackout event even though frequency may later recover.";
    } else if (frequencySeverity >= STATUS_SEVERITY["BLACKOUT"]) {
      status = "BLACKOUT";
      reason = "Frequency enters the blackout region or does not regain recovery inside the run.";
    } else if (
      summary.protectionTriggered
      || frequencySeverity >= STATUS_SEVERITY.EMERGENCY
      || energySeverity >= STATUS_SEVERITY.EMERGENCY
      || voltageSeverity >= STATUS_SEVERITY.EMERGENCY
    ) {
      status = "EMERGENCY";
      if (summary.uvlsTriggered) {
        reason = "Emergency voltage-relief action is required to stop a deeper weak-grid collapse from developing.";
      } else if (summary.reserveProtectionTriggered) {
        reason = "Emergency reserve-floor relief is required because the post-fault energy floor is being exhausted.";
      } else if (voltageSeverity >= STATUS_SEVERITY.EMERGENCY) {
        reason = "Voltage operability enters a hard emergency region, even though the frequency envelope may still recover.";
      } else if (energySeverity >= STATUS_SEVERITY.EMERGENCY) {
        reason = "Energy reserve reaches its emergency floor under continued stress.";
      } else {
        reason = "Emergency action is required to keep the disturbance from deepening.";
      }
    } else if (
      frequencySeverity >= STATUS_SEVERITY.STRESSED
      || energySeverity >= STATUS_SEVERITY.STRESSED
      || voltageSeverity >= STATUS_SEVERITY.STRESSED
    ) {
      status = "STRESSED";
      reason = frequencySeverity >= STATUS_SEVERITY.STRESSED
        ? "Frequency remains operable, but the frequency envelope is tight."
        : (voltageSeverity >= STATUS_SEVERITY.STRESSED
          ? "Frequency remains contained, but the voltage-operability margin is weak."
          : "Frequency remains contained, but the post-fault energy margin is tight.");
    }

    return {
      mode: "operational",
      status: status,
      reason: reason,
      color: statusColor(status)
    };
  }

  function classifyEnhancedScenario(kpis, summary, componentAssessment) {
    const components = componentAssessment || classifyMetricComponents(kpis, summary || { voltageLayerEnabled: true, lfddTriggered: false });
    let status = "PASS";
    let reason = "The conservative screening thresholds remain satisfied.";

    if (
      kpis.Nadir_Hz < LIMITS.frequency.lfdd
      || kpis.MaxRoCoF > LIMITS.rocof.trip
      || !Number.isFinite(kpis.Recovery_s)
    ) {
      status = "BLACKOUT";
      reason = "The conservative screen enters the trip or blackout region.";
    } else if (
      kpis.Nadir_Hz <= LIMITS.frequency.warningLow
      || kpis.MaxRoCoF >= LIMITS.rocof.operational
      || (Number.isFinite(kpis.Recovery_s) && kpis.Recovery_s > LIMITS.recovery.marginal)
      || kpis.SoC_min < LIMITS.soc.minimum
      || components.voltage.status === "EMERGENCY"
    ) {
      status = "FAIL";
      reason = "The conservative screen crosses a hard resilience constraint.";
    } else if (
      kpis.Nadir_Hz <= LIMITS.frequency.operationalLow
      || kpis.MaxRoCoF >= LIMITS.rocof.enhanced
      || (Number.isFinite(kpis.Recovery_s) && kpis.Recovery_s > LIMITS.recovery.good)
      || kpis.SoC_min < LIMITS.soc.healthy
      || components.voltage.status === "STRESSED"
    ) {
      status = "MARGINAL";
      reason = "The case remains viable, but only with limited enhanced resilience margin.";
    }

    return {
      mode: "enhanced",
      status: status,
      reason: reason,
      color: statusColor(status)
    };
  }

  function statusColor(status) {
    switch (status) {
      case "SECURE":
      case "PASS":
        return "#1f8f57";
      case "STRESSED":
      case "MARGINAL":
        return "#d9912a";
      case "EMERGENCY":
      case "FAIL":
        return "#c44536";
      default:
        return "#7b2d26";
    }
  }

  function scanResilience(rawConfig, stepMW, maxLossMW) {
    const config = clone(rawConfig);
    const baseResult = simulateGrid(config);
    const baseSeverity = statusSeverity(baseResult.operationalClass.status);
    const currentLoss = config.lossMW;
    const maxLoss = maxLossMW || Math.max(3200, currentLoss + 1600);
    const step = stepMW || 50;
    const lossLevels = buildSweepLevels(currentLoss, maxLoss, step);
    const points = [];
    let stressedLoss = null;
    let emergencyLoss = null;
    let collapseLoss = null;

    for (let i = 0; i < lossLevels.length; i += 1) {
      const loss = lossLevels[i];
      config.lossMW = loss;
      const result = simulateGrid(config);
      const severity = statusSeverity(result.operationalClass.status);
      points.push({
        lossGW: loss / 1000,
        nadirHz: result.kpis.Nadir_Hz,
        rocof: result.kpis.MaxRoCoF,
        status: result.operationalClass.status
      });
      if (stressedLoss === null && severity >= STATUS_SEVERITY["STRESSED"]) {
        stressedLoss = loss;
      }
      if (emergencyLoss === null && severity >= STATUS_SEVERITY["EMERGENCY"]) {
        emergencyLoss = loss;
      }
      if (collapseLoss === null && severity >= STATUS_SEVERITY["BLACKOUT"]) {
        collapseLoss = loss;
      }
    }

    const emergencyMarginMW = (emergencyLoss !== null ? emergencyLoss : maxLoss) - currentLoss;
    const collapseMarginMW = (collapseLoss !== null ? collapseLoss : maxLoss) - currentLoss;
    const marginMode = baseSeverity >= STATUS_SEVERITY["EMERGENCY"] ? "collapse" : "emergency";
    const activeBoundaryLossMW = marginMode === "collapse" ? collapseLoss : emergencyLoss;
    const activeMarginMW = marginMode === "collapse" ? collapseMarginMW : emergencyMarginMW;

    return {
      baseStatus: baseResult.operationalClass.status,
      baseSeverity: baseSeverity,
      baseLossMW: currentLoss,
      stressedLossMW: stressedLoss,
      emergencyLossMW: emergencyLoss,
      collapseLossMW: collapseLoss,
      emergencyMarginMW: emergencyMarginMW,
      collapseMarginMW: collapseMarginMW,
      marginMode: marginMode,
      boundaryLossMW: activeBoundaryLossMW,
      marginMW: activeMarginMW,
      points: points
    };
  }

  function buildHeatmap(rawConfig) {
    const resLevels = buildAxisLevels([0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95], rawConfig.resShare, 2);
    const lossLevels = buildAxisLevels([500, 800, 1100, 1400, 1700, 2000, 2300, 2600], rawConfig.lossMW, 0);
    const grid = [];
    const lockedGenerationGW = Math.max(rawConfig.demandGW - (rawConfig.importsMW / 1000), 0);
    const lockedResGW = lockedGenerationGW * rawConfig.resShare;
    const lockedHeadroomMW = lockedResGW * (rawConfig.services.headroomPct || 0) * 1000;
    const lockedSyncShare = Math.max(0.05, 1 - rawConfig.resShare);

    for (let row = 0; row < lossLevels.length; row += 1) {
      const cells = [];
      for (let col = 0; col < resLevels.length; col += 1) {
        const cellConfig = clone(rawConfig);
        const resShare = resLevels[col];
        const lossMW = lossLevels[row];
        const resDelta = resShare - rawConfig.resShare;
        const cellGenerationGW = Math.max(cellConfig.demandGW - (cellConfig.importsMW / 1000), 0);
        const cellResGW = cellGenerationGW * resShare;
        const cellSyncShare = Math.max(0.05, 1 - resShare);
        const governorScale = clamp(cellSyncShare / lockedSyncShare, 0.35, 1.35);

        cellConfig.resShare = resShare;
        cellConfig.lossMW = lossMW;
        cellConfig.systemStrength = clamp(
          rawConfig.systemStrength
            - Math.max(resDelta, 0) * 0.38
            + Math.max(-resDelta, 0) * 0.12,
          0.45,
          1.35
        );

        if (lockedHeadroomMW > 0 && cellResGW > 0) {
          cellConfig.services.headroomPct = clamp((lockedHeadroomMW / 1000) / cellResGW, 0, 0.15);
        }
        cellConfig.services.govMW = clamp((rawConfig.services.govMW || 0) * governorScale, 0, 2500);

        const result = simulateGrid(cellConfig);
        cells.push({
          status: result.operationalClass.status,
          nadirHz: result.kpis.Nadir_Hz,
          rocof: result.kpis.MaxRoCoF,
          strength: result.kpis.SystemStrength
        });
      }
      grid.push(cells);
    }

    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid[row].length; col += 1) {
        let enforcedSeverity = statusSeverity(grid[row][col].status);
        if (col > 0) {
          enforcedSeverity = Math.max(enforcedSeverity, statusSeverity(grid[row][col - 1].status));
        }
        if (row > 0) {
          enforcedSeverity = Math.max(enforcedSeverity, statusSeverity(grid[row - 1][col].status));
        }
        grid[row][col].status = statusFromSeverity(enforcedSeverity);
      }
    }

    return {
      resLevels: resLevels,
      lossLevels: lossLevels,
      grid: grid,
      current: {
        resShare: rawConfig.resShare,
        lossMW: rawConfig.lossMW
      }
    };
  }

  function runSensitivity(rawConfig) {
    const baseConfig = clone(rawConfig);
    const baseResult = simulateGrid(baseConfig);
    const parameters = [
      { name: "Renewable share", path: "resShare", low: clamp(baseConfig.resShare - 0.15, 0.10, 0.95), high: clamp(baseConfig.resShare + 0.15, 0.10, 0.95) },
      { name: "Loss size", path: "lossMW", low: Math.max(500, baseConfig.lossMW * 0.8), high: Math.min(3000, baseConfig.lossMW * 1.2) },
      { name: "System strength", path: "systemStrength", low: clamp(baseConfig.systemStrength - 0.15, 0.60, 1.15), high: clamp(baseConfig.systemStrength + 0.10, 0.60, 1.15) },
      { name: "BESS power", path: "services.bessMW", low: Math.max(0, baseConfig.services.bessMW * 0.6), high: Math.min(2000, baseConfig.services.bessMW * 1.4 || 600) },
      { name: "BESS energy", path: "services.bessMWh", low: Math.max(0, baseConfig.services.bessMWh * 0.6), high: Math.min(4000, baseConfig.services.bessMWh * 1.4 || 800) },
      { name: "Governor headroom", path: "services.govMW", low: Math.max(0, baseConfig.services.govMW * 0.7), high: Math.min(2500, baseConfig.services.govMW * 1.3 || 1000) },
      { name: "Demand response", path: "services.drMW", low: Math.max(0, baseConfig.services.drMW * 0.5), high: Math.min(1500, baseConfig.services.drMW * 1.5 || 400) },
      { name: "RES headroom", path: "services.headroomPct", low: clamp(baseConfig.services.headroomPct * 0.5, 0, 0.15), high: clamp(baseConfig.services.headroomPct * 1.5 || 0.05, 0, 0.15) },
      { name: "Import response", path: "services.importResponseMW", low: Math.max(0, baseConfig.services.importResponseMW * 0.5), high: Math.min(1200, baseConfig.services.importResponseMW * 1.5 || 300) },
      { name: "SynCon inertia", path: "services.synconH", low: 0, high: clamp((baseConfig.services.synconH || 1.0) * 1.4, 0, 2.5) },
      { name: "GFM damping", path: "services.gfmD", low: 0, high: clamp((baseConfig.services.gfmD || 0.6) * 1.4, 0, 1.2) }
    ];

    const items = parameters.map(function (parameter) {
      const lowConfig = clone(baseConfig);
      const highConfig = clone(baseConfig);
      setByPath(lowConfig, parameter.path, parameter.low);
      setByPath(highConfig, parameter.path, parameter.high);
      if (parameter.path === "services.synconH" && parameter.high > 0) {
        highConfig.services.useSyncon = true;
      }
      if (parameter.path === "services.gfmD" && parameter.high > 0) {
        highConfig.services.useGfm = true;
      }
      const lowRun = simulateGrid(lowConfig);
      const highRun = simulateGrid(highConfig);
      return {
        name: parameter.name,
        lowDelta: lowRun.kpis.Nadir_Hz - baseResult.kpis.Nadir_Hz,
        highDelta: highRun.kpis.Nadir_Hz - baseResult.kpis.Nadir_Hz,
        rocofLowDelta: lowRun.kpis.MaxRoCoF - baseResult.kpis.MaxRoCoF,
        rocofHighDelta: highRun.kpis.MaxRoCoF - baseResult.kpis.MaxRoCoF,
        voltageLowDelta: lowRun.kpis.V_min - baseResult.kpis.V_min,
        voltageHighDelta: highRun.kpis.V_min - baseResult.kpis.V_min,
        socLowDelta: lowRun.kpis.SoC_min - baseResult.kpis.SoC_min,
        socHighDelta: highRun.kpis.SoC_min - baseResult.kpis.SoC_min
      };
    });

    items.sort(function (a, b) {
      return Math.max(Math.abs(b.lowDelta), Math.abs(b.highDelta))
        - Math.max(Math.abs(a.lowDelta), Math.abs(a.highDelta));
    });
    return items.slice(0, 8);
  }

  function buildInsights(result, scan, sensitivity) {
    const insights = [];
    const k = result.kpis;
    const assessment = result.componentAssessment || classifyMetricComponents(k, result.summary);
    const statusTone = result.operationalClass.status === "SECURE"
      ? "good"
      : (result.operationalClass.status === "STRESSED" ? "warning" : "critical");

    const frequencyBody = "Frequency containment is " + assessment.frequencyEnvelope.status
      + ". Frequency reaches a nadir of " + formatNumber(k.Nadir_Hz, 2)
      + " Hz with peak RoCoF " + formatNumber(k.MaxRoCoF, 2)
      + " Hz/s, so the first swing is being set by " + formatNumber(k.H_eff_s, 2)
      + " s effective inertia and " + formatNumber(k.D_eff, 2)
      + " damping. In this simulator, Blackout is reserved for frequency-loss-of-supply cases: LFDD demand disconnection, nadir below 48.8 Hz, or no regained frequency recovery inside the run. Hard-limit events that are arrested and recovered without that outcome remain Emergency. The overall case status is " + result.operationalClass.status
      + ", which can also reflect reserve or voltage-operability stress outside the pure frequency envelope.";
    insights.push({
      title: "Frequency Dynamics",
      body: frequencyBody,
      tone: assessment.frequencyEnvelope.status === "SECURE"
        ? "good"
        : (assessment.frequencyEnvelope.status === "STRESSED" ? "warning" : "critical")
    });

    const powerBody = "Peak net deficit reaches " + formatNumber(k.Max_deficit_GW, 2)
      + " GW and peak fast-service delivery reaches " + formatNumber(k.Max_service_GW, 2)
      + " GW. Minimum SoC ends at " + formatNumber(k.SoC_min * 100, 0)
      + "%. This is the power-and-energy backbone of the model: disturbance size sets the deficit, then BESS, governor, headroom, demand response, and import support work against it in time.";
    insights.push({
      title: "Power and Energy Balance",
      body: powerBody,
      tone: "summary"
    });

    if (result.config.enableVoltageLayer === false) {
      insights.push({
        title: "Voltage Operability",
        body: "The voltage-operability layer is bypassed in this run, so the dashboard is acting as a pure frequency-and-imbalance study without weak-grid de-rating.",
        tone: "summary"
      });
    } else {
      insights.push({
        title: "Voltage Operability",
        body: "The voltage proxy falls to " + formatNumber(k.V_min, 3)
          + " pu and the voltage layer is assessed as " + assessment.voltage.status
          + ". Lower system strength reduces the voltage buffer and can de-rate service effectiveness, but a weak voltage layer does not automatically mean a frequency blackout if nadir and RoCoF remain controlled.",
        tone: assessment.voltage.status === "SECURE" ? "good" : (assessment.voltage.status === "STRESSED" ? "warning" : "critical")
      });
    }

    if (result.summary.lfddTriggered) {
      insights.push({
        title: "Protection and Cascade",
        body: "LFDD activated and shed up to " + formatNumber(result.summary.maxDemandShedGW, 2)
          + " GW of demand to arrest the cascade. In this simulator that counts as Blackout because involuntary demand disconnection has occurred, even if frequency later recovers.",
        tone: "critical"
      });
    } else if (result.summary.uvlsTriggered) {
      insights.push({
        title: "Protection and Cascade",
        body: "Under-voltage emergency relief activated after the hard voltage-operability floor was crossed under severe dynamic stress. This is an Emergency case: protection is needed to recover operability, but it is not treated as Blackout unless the frequency side also loses recovered continuity.",
        tone: "critical"
      });
    } else if (result.summary.reserveProtectionTriggered) {
      insights.push({
        title: "Protection and Cascade",
        body: "Reserve-floor emergency relief activated after battery energy reached its minimum floor while the case remained under frequency stress. This is an Emergency case: the event is still recoverable, but only because emergency relief is being used.",
        tone: "critical"
      });
    } else if (!result.summary.protections.enableLfdd && k.Nadir_Hz < LIMITS.frequency.lfdd) {
      insights.push({
        title: "Protection and Cascade",
        body: "LFDD is disabled, so the trace shows the natural low-frequency outcome after the emergency threshold is crossed. This is the uncontained physics-only case and should be read against the risk of non-recovery.",
        tone: "critical"
      });
    } else {
      insights.push({
        title: "Protection and Cascade",
        body: "No emergency protection action is triggered in the locked case. The disturbance is contained by the service stack without entering the LFDD, under-voltage, or reserve-relief chains.",
        tone: result.summary.protections.enableLfdd
          || result.summary.protections.enableVoltageRelief
          || result.summary.protections.enableReserveRelief
          || result.summary.protections.enableEmbeddedTrips
          ? "good"
          : "summary"
      });
    }

    if (scan.marginMode === "collapse" && result.operationalClass.status === "BLACKOUT") {
      insights.push({
        title: "Resilience Margin",
        body: "The locked case is already beyond the blackout boundary in the disturbance scan. That means protected recovery is not secured at this operating point, not merely that a hard threshold was touched momentarily.",
        tone: "critical"
      });
    } else if (scan.marginMode === "collapse") {
      insights.push({
        title: "Resilience Margin",
        body: scan.collapseMarginMW > 0
          ? "Emergency protection is already active in the locked case. The remaining disturbance buffer before blackout is about +" + Math.round(scan.collapseMarginMW) + " MW."
          : "Emergency protection is already active and the blackout boundary is effectively exhausted at this operating point.",
        tone: scan.collapseMarginMW > 300 ? "warning" : "critical"
      });
    } else if (scan.boundaryLossMW !== null) {
      insights.push({
        title: "Resilience Margin",
        body: "This configuration can absorb roughly +" + Math.round(scan.marginMW)
          + " MW more disturbance before emergency protection is required.",
        tone: scan.marginMW > 300 ? "good" : "warning"
      });
    } else {
      insights.push({
        title: "Resilience Margin",
        body: "No emergency threshold is reached within the scan range, so the locked case keeps a wide disturbance buffer inside the tested envelope.",
        tone: "good"
      });
    }

    if (result.operationalClass.status === "BLACKOUT") {
      insights.push({
        title: "Run Consequence",
        body: "Blackout conditions persist for about " + formatNumber(result.summary.blackoutDurationS, 1)
          + " s in this run. Maximum disconnected demand reaches " + formatNumber(result.summary.maxDemandShedGW, 2)
          + " GW, and the disconnected-demand energy proxy is about " + formatNumber(result.summary.demandShedMWh, 2) + " MWh.",
        tone: "critical"
      });
    } else if (result.operationalClass.status === "EMERGENCY") {
      insights.push({
        title: "Run Consequence",
        body: "Emergency conditions persist for about " + formatNumber(result.summary.emergencyDurationS, 1)
          + " s before recovered operation is regained. Frequency may enter hard bands temporarily, but loss of supply is avoided in this run.",
        tone: "warning"
      });
    } else if (result.operationalClass.status === "STRESSED") {
      insights.push({
        title: "Run Consequence",
        body: "Stressed conditions persist for about " + formatNumber(result.summary.stressedDurationS, 1)
          + " s after the event. The case remains controllable, but the operating margin is thin and another disturbance could push it into emergency operation.",
        tone: "summary"
      });
    }

    if (sensitivity.length > 0) {
      insights.push({
        title: "Main Lever",
        body: sensitivity[0].name + " produces the strongest nadir movement around this operating point. In the tornado chart, the left bar is a lower setting and the right bar is a higher setting; a positive change lifts the nadir and improves security, while a negative change deepens the first swing.",
        tone: "summary"
      });
    }

    return insights.slice(0, 7);
  }

  function eventLabel(eventType) {
    switch (eventType) {
      case "aug2019":
        return "9 Aug 2019 scripted event";
      case "windStep":
        return "Wind output loss";
      case "solarStep":
        return "Solar output loss";
      default:
        return "Generator trip";
    }
  }

  function formatNumber(value, digits) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    return value.toFixed(digits);
  }

  function findSustainedIndex(series, t, tFault, windowSeconds, predicate) {
    const dt = t.length > 1 ? (t[1] - t[0]) : 1;
    const windowSamples = Math.max(1, Math.round(windowSeconds / dt));
    const startIndex = Math.max(0, Math.floor(tFault / dt));
    for (let i = startIndex; i < series.length - windowSamples; i += 1) {
      let okay = true;
      for (let j = 0; j < windowSamples; j += 1) {
        if (!predicate(series[i + j])) {
          okay = false;
          break;
        }
      }
      if (okay) {
        return i;
      }
    }
    return -1;
  }

  function findArrestIndex(frequency, nadirIndex) {
    for (let i = Math.max(1, nadirIndex); i < frequency.length - 2; i += 1) {
      if (frequency[i + 1] >= frequency[i] && frequency[i + 2] >= frequency[i + 1]) {
        return i;
      }
    }
    return -1;
  }

  function accumulateConditionDuration(values, startIndex, dt, predicate) {
    let total = 0;
    for (let i = startIndex; i < values.length; i += 1) {
      if (predicate(values[i], i)) {
        total += dt;
      }
    }
    return total;
  }

  function indexOfMax(values) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] > bestValue) {
        bestValue = values[i];
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function indexOfMin(values) {
    let bestIndex = 0;
    let bestValue = Infinity;
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] < bestValue) {
        bestValue = values[i];
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function indexOfMaxAbs(values, positiveOnly) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < values.length; i += 1) {
      const candidate = positiveOnly ? values[i] : Math.abs(values[i]);
      if (candidate > bestValue) {
        bestValue = candidate;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function indexOfFirstAbove(values, threshold) {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] > threshold) {
        return i;
      }
    }
    return -1;
  }

  function setByPath(target, path, value) {
    const parts = path.split(".");
    let pointer = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      pointer = pointer[parts[i]];
    }
    pointer[parts[parts.length - 1]] = value;
  }

  const api = {
    LIMITS: LIMITS,
    WEATHER_LIBRARY: WEATHER_LIBRARY,
    PORTFOLIO_PRESETS: PORTFOLIO_PRESETS,
    SCENARIO_PRESETS: SCENARIO_PRESETS,
    MODEL_CONSTANTS: MODEL_CONSTANTS,
    createDefaultConfig: createDefaultConfig,
    applyScenarioPreset: applyScenarioPreset,
    applyPortfolioPreset: applyPortfolioPreset,
    simulateGrid: simulateGrid,
    scanResilience: scanResilience,
    buildHeatmap: buildHeatmap,
    runSensitivity: runSensitivity,
    buildInsights: buildInsights,
    classifyOperationalScenario: classifyOperationalScenario,
    classifyEnhancedScenario: classifyEnhancedScenario,
    statusColor: statusColor,
    clone: clone
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.GridModel = api;
}(typeof window !== "undefined" ? window : globalThis));
