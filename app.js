(function () {
  "use strict";

  const model = window.GridModel;
  const initialConfig = model.createDefaultConfig();
  initialConfig.presetScenarioId = "manual";
  refreshScenarioMetadata(initialConfig);

  const state = {
    pendingConfig: model.clone(initialConfig),
    appliedConfig: model.clone(initialConfig),
    current: null,
    chartLayouts: {},
    chartFocus: {
      frequency: 0,
      power: 0,
      state: 0
    },
    activeChart: "frequency",
    scan: null,
    heatmap: null,
    sensitivity: [],
    insights: [],
    playing: false,
    playHandle: null,
    editingInputs: false,
    pendingDirty: false,
    revealIndex: null,
    batteryBackup: {
      bessMW: 1000,
      bessMWh: 1000,
      bessSoC0: 0.5
    }
  };

  const elements = {
    scenarioPreset: document.getElementById("scenarioPreset"),
    portfolioPreset: document.getElementById("portfolioPreset"),
    setInputsButton: document.getElementById("setInputsButton"),
    playButton: document.getElementById("playButton"),
    playStatePill: document.getElementById("playStatePill"),
    resetPlayback: document.getElementById("resetPlayback"),
    milestonePrimary: document.getElementById("milestonePrimary"),
    milestoneSecondary: document.getElementById("milestoneSecondary"),
    milestoneTertiary: document.getElementById("milestoneTertiary"),
    timelineScrubber: document.getElementById("timelineScrubber"),
    playerTrack: document.querySelector(".player-track"),
    weather: document.getElementById("weather"),
    demandGW: document.getElementById("demandGW"),
    resShare: document.getElementById("resShare"),
    importsMW: document.getElementById("importsMW"),
    systemStrength: document.getElementById("systemStrength"),
    enableVoltageLayer: document.getElementById("enableVoltageLayer"),
    lossMW: document.getElementById("lossMW"),
    eventType: document.getElementById("eventType"),
    rampDuration: document.getElementById("rampDuration"),
    tFault: document.getElementById("tFault"),
    enableLfdd: document.getElementById("enableLfdd"),
    lfddStage1MW: document.getElementById("lfddStage1MW"),
    enableVoltageRelief: document.getElementById("enableVoltageRelief"),
    voltageReliefMW: document.getElementById("voltageReliefMW"),
    enableReserveRelief: document.getElementById("enableReserveRelief"),
    reserveReliefMW: document.getElementById("reserveReliefMW"),
    enableEmbeddedTrips: document.getElementById("enableEmbeddedTrips"),
    embeddedTripMW: document.getElementById("embeddedTripMW"),
    useBess: document.getElementById("useBess"),
    bessMW: document.getElementById("bessMW"),
    bessMWh: document.getElementById("bessMWh"),
    bessSoC0: document.getElementById("bessSoC0"),
    govMW: document.getElementById("govMW"),
    headroomPct: document.getElementById("headroomPct"),
    drMW: document.getElementById("drMW"),
    useSyncon: document.getElementById("useSyncon"),
    synconH: document.getElementById("synconH"),
    useGfm: document.getElementById("useGfm"),
    gfmD: document.getElementById("gfmD"),
    useImportSupport: document.getElementById("useImportSupport"),
    importResponseMW: document.getElementById("importResponseMW"),
    duration: document.getElementById("duration"),
    dt: document.getElementById("dt"),
    weatherSummary: document.getElementById("weatherSummary"),
    eventSummary: document.getElementById("eventSummary"),
    serviceSummary: document.getElementById("serviceSummary"),
    mixSummary: document.getElementById("mixSummary"),
    statusGuide: document.getElementById("statusGuide"),
    scenarioTitle: document.getElementById("scenarioTitle"),
    scenarioSubtitle: document.getElementById("scenarioSubtitle"),
    statusPill: document.getElementById("statusPill"),
    statusDefinition: document.getElementById("statusDefinition"),
    focusReadout: document.getElementById("focusReadout"),
    focusMetrics: document.getElementById("focusMetrics"),
    kpiGrid: document.getElementById("kpiGrid"),
    causalDiagram: document.getElementById("causalDiagram"),
    limitRows: document.getElementById("limitRows"),
    insightList: document.getElementById("insightList"),
    relationshipList: document.getElementById("relationshipList"),
    cascadeSummary: document.getElementById("cascadeSummary"),
    frequencyChart: document.getElementById("frequencyChart"),
    powerChart: document.getElementById("powerChart"),
    stateChart: document.getElementById("stateChart"),
    marginFrequencyChart: document.getElementById("marginFrequencyChart"),
    marginRoCoFChart: document.getElementById("marginRoCoFChart"),
    marginVoltageChart: document.getElementById("marginVoltageChart"),
    marginEnergyChart: document.getElementById("marginEnergyChart"),
    heatmapChart: document.getElementById("heatmapChart"),
    sensitivityChart: document.getElementById("sensitivityChart")
  };

  const SCENARIO_OPTIONS = [
    { id: "manual", name: "Manual sliders" },
    { id: "event2019", name: model.SCENARIO_PRESETS.event2019.name }
  ];
  const PORTFOLIO_OPTION_IDS = ["manual", "none", "bess", "bessGov", "full", "fullSyncon", "fullGfm", "benchmark2019"];
  const SCENARIO_CONTROL_IDS = ["weather", "demandGW", "resShare", "importsMW", "systemStrength", "enableVoltageLayer", "lossMW", "eventType", "rampDuration", "tFault", "enableLfdd", "lfddStage1MW", "enableVoltageRelief", "voltageReliefMW", "enableReserveRelief", "reserveReliefMW", "enableEmbeddedTrips", "embeddedTripMW", "duration", "dt"];
  const PORTFOLIO_CONTROL_IDS = ["useBess", "bessMW", "bessMWh", "bessSoC0", "govMW", "headroomPct", "drMW", "useSyncon", "synconH", "useGfm", "gfmD", "useImportSupport", "importResponseMW"];
  const EDITABLE_CONTROL_IDS = ["scenarioPreset", "portfolioPreset"].concat(SCENARIO_CONTROL_IDS, PORTFOLIO_CONTROL_IDS);

  const COLORS = {
    navy: "#16324f",
    teal: "#157a6e",
    amber: "#f4a261",
    coral: "#c44536",
    softCoral: "#df7e6b",
    sky: "#2f6b9a",
    green: "#1f8f57",
    sand: "#b9945a",
    slate: "#5d728b"
  };

  const outputFormatters = {
    demandGW: function (value) { return Math.round(value) + " GW"; },
    resShare: function (value) { return Math.round(Number(value) * 100) + "%"; },
    importsMW: function (value) { return Math.round(value) + " MW"; },
    systemStrength: function (value) { return Number(value).toFixed(2) + " pu"; },
    lossMW: function (value) { return (Math.round(value) / 1000).toFixed(2) + " GW"; },
    rampDuration: function (value) { return Math.round(value) + " s"; },
    tFault: function (value) { return Math.round(value) + " s"; },
    lfddStage1MW: function (value) { return Math.round(value) + " MW"; },
    voltageReliefMW: function (value) { return Math.round(value) + " MW"; },
    reserveReliefMW: function (value) { return Math.round(value) + " MW"; },
    embeddedTripMW: function (value) { return Math.round(value) + " MW"; },
    bessMW: function (value) { return Math.round(value) + " MW"; },
    bessMWh: function (value) { return Math.round(value) + " MWh"; },
    bessSoC0: function (value) { return Math.round(Number(value) * 100) + "%"; },
    govMW: function (value) { return Math.round(value) + " MW"; },
    headroomPct: function (value) { return (Number(value) * 100).toFixed(1) + "%"; },
    drMW: function (value) { return Math.round(value) + " MW"; },
    synconH: function (value) { return Number(value).toFixed(2) + " s"; },
    gfmD: function (value) { return Number(value).toFixed(2) + " pu"; },
    importResponseMW: function (value) { return Math.round(value) + " MW"; },
    duration: function (value) { return Math.round(value) + " s"; },
    dt: function (value) { return Number(value).toFixed(2) + " s"; }
  };

  function batteryIsActive(config) {
    const source = config && config.services ? config.services : config || {};
    return Number(source.bessMW || 0) > 0 && Number(source.bessMWh || 0) > 0;
  }

  function normalizeBatteryControls(changedKey) {
    if (!elements.useBess.checked) {
      elements.bessMW.value = 0;
      elements.bessMWh.value = 0;
      elements.bessSoC0.value = 0.5;
      return;
    }

    const bessMW = Number(elements.bessMW.value);
    const bessMWh = Number(elements.bessMWh.value);
    const bessSoC0 = Number(elements.bessSoC0.value);

    if (bessMW > 0) {
      state.batteryBackup.bessMW = bessMW;
    }
    if (bessMWh > 0) {
      state.batteryBackup.bessMWh = bessMWh;
    }
    if (Number.isFinite(bessSoC0)) {
      state.batteryBackup.bessSoC0 = bessSoC0;
    }

    if ((changedKey === "bessMW" && bessMW <= 0) || (changedKey === "bessMWh" && bessMWh <= 0)) {
      elements.bessMW.value = 0;
      elements.bessMWh.value = 0;
      elements.bessSoC0.value = 0.5;
      return;
    }

    if (changedKey === "bessMW" && bessMW > 0 && bessMWh <= 0) {
      elements.bessMWh.value = state.batteryBackup.bessMWh;
    }
    if (changedKey === "bessMWh" && bessMWh > 0 && bessMW <= 0) {
      elements.bessMW.value = state.batteryBackup.bessMW;
    }
  }

  function normalizeOptionalFeatureControls() {
    if (!elements.useSyncon.checked) {
      elements.synconH.value = 0;
    }
    if (!elements.useGfm.checked) {
      elements.gfmD.value = 0;
    }
    if (!elements.useImportSupport.checked) {
      elements.importResponseMW.value = 0;
    }
    if (!elements.enableVoltageRelief.checked) {
      elements.voltageReliefMW.value = 0;
    }
    if (!elements.enableReserveRelief.checked) {
      elements.reserveReliefMW.value = 0;
    }
    if (!elements.enableEmbeddedTrips.checked) {
      elements.embeddedTripMW.value = 0;
    }
  }

  init();

  function init() {
    populatePresetSelects();
    bindInputs();
    syncControlsFromConfig(state.pendingConfig);
    updateOutputs();
    renderControlSummaries();
    updateRunButtonState();
    lockPendingInputs();
  }

  function populatePresetSelects() {
    elements.scenarioPreset.innerHTML = "";
    SCENARIO_OPTIONS.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      elements.scenarioPreset.appendChild(option);
    });

    elements.portfolioPreset.innerHTML = "";
    PORTFOLIO_OPTION_IDS.forEach(function (id) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id === "manual" ? "Manual sliders" : model.PORTFOLIO_PRESETS[id].name;
      elements.portfolioPreset.appendChild(option);
    });

    elements.scenarioPreset.value = "manual";
    elements.portfolioPreset.value = state.pendingConfig.presetPortfolioId || "manual";
  }

  function bindInputs() {
    elements.scenarioPreset.addEventListener("change", function () {
      if (elements.scenarioPreset.value === "manual") {
        state.pendingConfig.presetScenarioId = "manual";
        refreshScenarioMetadata(state.pendingConfig);
      } else {
        state.pendingConfig = model.applyScenarioPreset(state.pendingConfig, elements.scenarioPreset.value);
        if (elements.scenarioPreset.value === "event2019") {
          state.pendingConfig = model.applyPortfolioPreset(state.pendingConfig, "benchmark2019");
        }
      }
      syncControlsFromConfig(state.pendingConfig);
      renderControlSummaries();
      markPending(true);
    });

    elements.portfolioPreset.addEventListener("change", function () {
      if (elements.portfolioPreset.value === "manual") {
        state.pendingConfig.presetPortfolioId = "manual";
      } else {
        state.pendingConfig = model.applyPortfolioPreset(state.pendingConfig, elements.portfolioPreset.value);
      }
      syncControlsFromConfig(state.pendingConfig);
      renderControlSummaries();
      markPending(true);
    });

    elements.useBess.addEventListener("change", function () {
      elements.portfolioPreset.value = "manual";
      state.pendingConfig.presetPortfolioId = "manual";
      if (elements.useBess.checked) {
        elements.bessMW.value = state.batteryBackup.bessMW;
        elements.bessMWh.value = state.batteryBackup.bessMWh;
        elements.bessSoC0.value = state.batteryBackup.bessSoC0;
      } else {
        state.batteryBackup = {
          bessMW: Number(elements.bessMW.value) || state.batteryBackup.bessMW,
          bessMWh: Number(elements.bessMWh.value) || state.batteryBackup.bessMWh,
          bessSoC0: Number(elements.bessSoC0.value) || state.batteryBackup.bessSoC0
        };
        elements.bessMW.value = 0;
        elements.bessMWh.value = 0;
        elements.bessSoC0.value = 0.5;
      }
      pullControlsIntoPending();
      updateOutputs();
      updateConditionalControls();
      renderControlSummaries();
      markPending(true);
    });

    elements.setInputsButton.addEventListener("click", function () {
      if (state.editingInputs) {
        lockPendingInputs();
      } else {
        enableInputEditing();
      }
    });

    elements.playButton.addEventListener("click", function () {
      if (state.playing) {
        stopPlay();
      } else if (!state.current) {
        runAll(true);
      } else {
        startPlayback(playbackStartIndex());
      }
    });

    elements.resetPlayback.addEventListener("click", function () {
      if (!state.current) {
        return;
      }
      stopPlay();
      syncAllChartFocus(state.current.milestones.prefaultIndex);
    });

    elements.timelineScrubber.addEventListener("input", function () {
      if (!state.current) {
        return;
      }
      stopPlay();
      syncAllChartFocus(Number(elements.timelineScrubber.value));
    });

    SCENARIO_CONTROL_IDS.forEach(function (id) {
      const element = elements[id];
      ["input", "change"].forEach(function (eventName) {
        element.addEventListener(eventName, function () {
          elements.scenarioPreset.value = "manual";
          state.pendingConfig.presetScenarioId = "manual";
          normalizeOptionalFeatureControls();
          pullControlsIntoPending();
          refreshScenarioMetadata(state.pendingConfig);
          updateOutputs();
          renderControlSummaries();
          markPending(true);
        });
      });
    });

    PORTFOLIO_CONTROL_IDS.forEach(function (id) {
      const element = elements[id];
      ["input", "change"].forEach(function (eventName) {
        element.addEventListener(eventName, function () {
          elements.portfolioPreset.value = "manual";
          state.pendingConfig.presetPortfolioId = "manual";
          if (id === "bessMW" || id === "bessMWh") {
            normalizeBatteryControls(id);
          }
          normalizeOptionalFeatureControls();
          pullControlsIntoPending();
          updateOutputs();
          updateConditionalControls();
          renderControlSummaries();
          markPending(true);
        });
      });
    });

    [elements.milestonePrimary, elements.milestoneSecondary, elements.milestoneTertiary].forEach(function (button, index) {
      button.addEventListener("click", function () {
        if (!state.current) {
          return;
        }
        stopPlay();
        jumpToActiveMilestone(index);
      });
    });

    [
      { key: "frequency", canvas: elements.frequencyChart },
      { key: "power", canvas: elements.powerChart },
      { key: "state", canvas: elements.stateChart }
    ].forEach(function (item) {
      item.canvas.addEventListener("click", function (event) {
        handleChartHover(item.key, item.canvas, event);
      });
      item.canvas.addEventListener("mousemove", function (event) {
        if (state.activeChart !== item.key) {
          return;
        }
        handleChartHover(item.key, item.canvas, event);
      });
    });
  }

  function pullControlsIntoPending() {
    state.pendingConfig.weather = elements.weather.value;
    state.pendingConfig.demandGW = Number(elements.demandGW.value);
    state.pendingConfig.resShare = Number(elements.resShare.value);
    state.pendingConfig.importsMW = Number(elements.importsMW.value);
    state.pendingConfig.systemStrength = Number(elements.systemStrength.value);
    state.pendingConfig.enableVoltageLayer = elements.enableVoltageLayer.checked;
    state.pendingConfig.lossMW = Number(elements.lossMW.value);
    state.pendingConfig.eventType = elements.eventType.value;
    state.pendingConfig.rampDuration = Number(elements.rampDuration.value);
    state.pendingConfig.tFault = Number(elements.tFault.value);
    state.pendingConfig.protections = {
      enableLfdd: elements.enableLfdd.checked,
      lfddStage1MW: Number(elements.lfddStage1MW.value),
      enableVoltageRelief: elements.enableVoltageRelief.checked,
      voltageReliefMW: elements.enableVoltageRelief.checked ? Number(elements.voltageReliefMW.value) : 0,
      enableReserveRelief: elements.enableReserveRelief.checked,
      reserveReliefMW: elements.enableReserveRelief.checked ? Number(elements.reserveReliefMW.value) : 0,
      enableEmbeddedTrips: elements.enableEmbeddedTrips.checked,
      embeddedTripMW: elements.enableEmbeddedTrips.checked ? Number(elements.embeddedTripMW.value) : 0
    };
    state.pendingConfig.duration = Number(elements.duration.value);
    state.pendingConfig.dt = Number(elements.dt.value);
    const useBess = elements.useBess.checked;
    state.pendingConfig.services = {
      bessMW: useBess ? Number(elements.bessMW.value) : 0,
      bessMWh: useBess ? Number(elements.bessMWh.value) : 0,
      bessSoC0: useBess ? Number(elements.bessSoC0.value) : 0.5,
      govMW: Number(elements.govMW.value),
      headroomPct: Number(elements.headroomPct.value),
      drMW: Number(elements.drMW.value),
      useSyncon: elements.useSyncon.checked,
      synconH: elements.useSyncon.checked ? Number(elements.synconH.value) : 0,
      useGfm: elements.useGfm.checked,
      gfmD: elements.useGfm.checked ? Number(elements.gfmD.value) : 0,
      useImportSupport: elements.useImportSupport.checked,
      importResponseMW: elements.useImportSupport.checked ? Number(elements.importResponseMW.value) : 0
    };
  }

  function syncControlsFromConfig(config) {
    elements.weather.value = config.weather;
    elements.demandGW.value = config.demandGW;
    elements.resShare.value = config.resShare;
    elements.importsMW.value = config.importsMW;
    elements.systemStrength.value = config.systemStrength;
    elements.enableVoltageLayer.checked = config.enableVoltageLayer !== false;
    elements.lossMW.value = config.lossMW;
    elements.eventType.value = config.eventType === "aug2019" ? "aug2019" : "step";
    elements.rampDuration.value = config.rampDuration;
    elements.tFault.value = config.tFault;
    elements.enableLfdd.checked = !config.protections || config.protections.enableLfdd !== false;
    elements.lfddStage1MW.value = config.protections && Number.isFinite(Number(config.protections.lfddStage1MW))
      ? Number(config.protections.lfddStage1MW)
      : 931;
    elements.enableVoltageRelief.checked = !!(config.protections && config.protections.enableVoltageRelief);
    elements.voltageReliefMW.value = elements.enableVoltageRelief.checked && config.protections && Number.isFinite(Number(config.protections.voltageReliefMW))
      ? Number(config.protections.voltageReliefMW)
      : 0;
    elements.enableReserveRelief.checked = !!(config.protections && config.protections.enableReserveRelief);
    elements.reserveReliefMW.value = elements.enableReserveRelief.checked && config.protections && Number.isFinite(Number(config.protections.reserveReliefMW))
      ? Number(config.protections.reserveReliefMW)
      : 0;
    elements.enableEmbeddedTrips.checked = !config.protections || config.protections.enableEmbeddedTrips !== false;
    elements.embeddedTripMW.value = elements.enableEmbeddedTrips.checked && config.protections && Number.isFinite(Number(config.protections.embeddedTripMW))
      ? Number(config.protections.embeddedTripMW)
      : 0;
    elements.useBess.checked = batteryIsActive(config);
    elements.bessMW.value = config.services.bessMW;
    elements.bessMWh.value = config.services.bessMWh;
    elements.bessSoC0.value = config.services.bessSoC0;
    elements.govMW.value = config.services.govMW;
    elements.headroomPct.value = config.services.headroomPct;
    elements.drMW.value = config.services.drMW;
    elements.useSyncon.checked = config.services.useSyncon;
    elements.synconH.value = config.services.useSyncon ? config.services.synconH : 0;
    elements.useGfm.checked = config.services.useGfm;
    elements.gfmD.value = config.services.useGfm ? config.services.gfmD : 0;
    elements.useImportSupport.checked = Object.prototype.hasOwnProperty.call(config.services, "useImportSupport")
      ? Boolean(config.services.useImportSupport)
      : Number(config.services.importResponseMW || 0) > 0;
    elements.importResponseMW.value = elements.useImportSupport.checked ? config.services.importResponseMW : 0;
    elements.duration.value = config.duration;
    elements.dt.value = config.dt;
    elements.scenarioPreset.value = config.presetScenarioId === "event2019" ? "event2019" : "manual";
    elements.portfolioPreset.value = PORTFOLIO_OPTION_IDS.indexOf(config.presetPortfolioId) >= 0 ? config.presetPortfolioId : "manual";
    updateOutputs();
    updateConditionalControls();
  }

  function updateOutputs() {
    Array.prototype.slice.call(document.querySelectorAll("[data-output]")).forEach(function (node) {
      const key = node.getAttribute("data-output");
      let source;
      if (Object.prototype.hasOwnProperty.call(state.pendingConfig, key)) {
        source = state.pendingConfig[key];
      } else if (state.pendingConfig.protections && Object.prototype.hasOwnProperty.call(state.pendingConfig.protections, key)) {
        source = state.pendingConfig.protections[key];
      } else {
        source = state.pendingConfig.services[key];
      }
      if (key === "systemStrength" && state.pendingConfig.enableVoltageLayer === false) {
        node.textContent = "Bypassed";
      } else if (key === "bessSoC0" && !batteryIsActive(state.pendingConfig)) {
        node.textContent = "N/A";
      } else {
        node.textContent = outputFormatters[key](source);
      }
    });
  }

  function updateConditionalControls() {
    const isStep = true;
    const voltageBypassed = state.pendingConfig.enableVoltageLayer === false;
    const noBattery = !batteryIsActive(state.pendingConfig);
    elements.rampDuration.disabled = !state.editingInputs || isStep;
    elements.systemStrength.disabled = !state.editingInputs || voltageBypassed;
    elements.lfddStage1MW.disabled = !state.editingInputs || !elements.enableLfdd.checked;
    elements.enableVoltageRelief.disabled = !state.editingInputs || voltageBypassed;
    elements.voltageReliefMW.disabled = !state.editingInputs || voltageBypassed || !elements.enableVoltageRelief.checked;
    elements.enableReserveRelief.disabled = !state.editingInputs;
    elements.reserveReliefMW.disabled = !state.editingInputs || !elements.enableReserveRelief.checked;
    elements.embeddedTripMW.disabled = !state.editingInputs || !elements.enableEmbeddedTrips.checked;
    elements.bessMW.disabled = !state.editingInputs || !elements.useBess.checked;
    elements.bessMWh.disabled = !state.editingInputs || !elements.useBess.checked;
    elements.bessSoC0.disabled = !state.editingInputs || noBattery;
    elements.synconH.disabled = !state.editingInputs || !elements.useSyncon.checked;
    elements.gfmD.disabled = !state.editingInputs || !elements.useGfm.checked;
    elements.useImportSupport.disabled = !state.editingInputs;
    elements.importResponseMW.disabled = !state.editingInputs || !elements.useImportSupport.checked;
    if (elements.systemStrength.parentElement) {
      elements.systemStrength.parentElement.classList.toggle("is-disabled", voltageBypassed);
    }
    if (elements.rampDuration.parentElement) {
      elements.rampDuration.parentElement.classList.toggle("is-disabled", isStep);
    }
    if (elements.lfddStage1MW.parentElement) {
      elements.lfddStage1MW.parentElement.classList.toggle("is-disabled", !state.editingInputs || !elements.enableLfdd.checked);
    }
    if (elements.voltageReliefMW.parentElement) {
      elements.voltageReliefMW.parentElement.classList.toggle("is-disabled", voltageBypassed || !elements.enableVoltageRelief.checked);
    }
    if (elements.reserveReliefMW.parentElement) {
      elements.reserveReliefMW.parentElement.classList.toggle("is-disabled", !elements.enableReserveRelief.checked);
    }
    if (elements.embeddedTripMW.parentElement) {
      elements.embeddedTripMW.parentElement.classList.toggle("is-disabled", !elements.enableEmbeddedTrips.checked);
    }
    if (elements.bessMW.parentElement) {
      elements.bessMW.parentElement.classList.toggle("is-disabled", !elements.useBess.checked);
    }
    if (elements.bessMWh.parentElement) {
      elements.bessMWh.parentElement.classList.toggle("is-disabled", !elements.useBess.checked);
    }
    if (elements.bessSoC0.parentElement) {
      elements.bessSoC0.parentElement.classList.toggle("is-disabled", noBattery);
    }
    if (elements.synconH.parentElement) {
      elements.synconH.parentElement.classList.toggle("is-disabled", !elements.useSyncon.checked);
    }
    if (elements.gfmD.parentElement) {
      elements.gfmD.parentElement.classList.toggle("is-disabled", !elements.useGfm.checked);
    }
    if (elements.importResponseMW.parentElement) {
      elements.importResponseMW.parentElement.classList.toggle("is-disabled", !elements.useImportSupport.checked);
    }
    if (elements.enableVoltageRelief.parentElement) {
      elements.enableVoltageRelief.parentElement.classList.toggle("is-disabled", voltageBypassed);
    }
    if (elements.enableReserveRelief.parentElement) {
      elements.enableReserveRelief.parentElement.classList.toggle("is-disabled", !state.editingInputs);
    }
    if (elements.useImportSupport.parentElement) {
      elements.useImportSupport.parentElement.classList.toggle("is-disabled", !state.editingInputs);
    }
    if (elements.useSyncon.parentElement) {
      elements.useSyncon.parentElement.classList.toggle("is-disabled", !state.editingInputs);
    }
    if (elements.useGfm.parentElement) {
      elements.useGfm.parentElement.classList.toggle("is-disabled", !state.editingInputs);
    }
    if (elements.useBess.parentElement) {
      elements.useBess.parentElement.classList.toggle("is-disabled", !state.editingInputs);
    }
  }

  async function runAll(animateAfterRun) {
    stopPlay();
    updateRunButtonState(true);

    try {
      state.current = model.simulateGrid(state.appliedConfig);
      state.revealIndex = state.current.milestones.prefaultIndex;
      syncAllChartFocus(state.current.milestones.prefaultIndex);
      state.scan = null;
      state.heatmap = null;
      state.sensitivity = [];
      state.insights = [];

      renderPrimary();
      renderStatusGuide();
      renderLimits();
      renderFocus();
      renderMixSummary();
      renderCascadeSummary();
      renderMilestoneButtons();
      syncScrubber();

      await yieldFrame();
      state.scan = model.scanResilience(state.appliedConfig);
      renderPrimary();
      renderLimits();
      drawMarginCharts();

      await yieldFrame();
      state.heatmap = model.buildHeatmap(state.appliedConfig);
      drawHeatmapChart();

      await yieldFrame();
      state.sensitivity = model.runSensitivity(state.appliedConfig);
      state.insights = model.buildInsights(state.current, state.scan, state.sensitivity);
      drawSensitivityChart();
      renderInsights();
      renderRelationships();
      renderFocus();
      renderMixSummary();
      renderCascadeSummary();

      if (animateAfterRun !== false) {
        startPlayback(state.current.milestones.prefaultIndex);
      }
    } finally {
      updateRunButtonState(false);
    }
  }
  function renderPrimary() {
    if (!state.current) {
      renderEmptyDashboard();
      return;
    }
    const current = state.current;
    const k = current.kpis;
    const resilience = resilienceSummary(current, state.scan);
    elements.scenarioTitle.textContent = current.config.name || "Custom Operating Point";
    elements.scenarioSubtitle.textContent = current.config.narrative;
    elements.statusPill.textContent = current.operationalClass.status;
    elements.statusPill.style.background = "linear-gradient(135deg, " + current.operationalClass.color + ", " + tint(current.operationalClass.color, 0.34) + ")";
    renderStatusDefinition(current);

    const cards = [
      { label: "Frequency nadir", value: formatNumber(k.Nadir_Hz, 2) + " Hz", detail: "Main frequency depth after the disturbance." },
      { label: "Max RoCoF", value: formatNumber(k.MaxRoCoF, 2) + " Hz/s", detail: "Planning threshold 0.25 and operational threshold 0.50." },
      { label: "Recovery", value: Number.isFinite(k.Recovery_s) ? formatNumber(k.Recovery_s, 1) + " s" : "No recovery", detail: "Time back inside +/-0.2 Hz around 50 Hz." },
      { label: resilience.label, value: resilience.value, detail: resilience.detail },
      { label: "Effective Inertia", value: formatNumber(k.H_eff_s, 2) + " s", detail: "This mainly controls the first RoCoF swing." },
      { label: "Effective Damping", value: formatNumber(k.D_eff, 2), detail: "This helps settle the nadir and recovery tail." },
      { label: "System Strength", value: formatNumber(k.SystemStrength, 2) + " pu", detail: "User-set Operating Condition for strong or weak grid behavior." },
      { label: "Strength Index", value: formatNumber(k.SCL_index, 2), detail: "Proxy linking inertia context to Voltage Resilience." },
      { label: "Worst Deficit", value: formatNumber(k.Max_deficit_GW, 2) + " GW", detail: "Maximum net imbalance after services and imports." },
      { label: "Demand Shed", value: formatNumber(k.Max_demand_shed_GW, 2) + " GW", detail: "Emergency demand disconnection triggered by LFDD, if any." }
    ];

    elements.kpiGrid.innerHTML = "";
    cards.forEach(function (card) {
      const item = document.createElement("article");
      item.className = "kpi-card";
      item.innerHTML = ""
        + "<p class=\"label\">" + escapeHtml(card.label) + "</p>"
        + "<p class=\"value\">" + escapeHtml(card.value) + "</p>"
        + "<p class=\"detail\">" + escapeHtml(card.detail) + "</p>";
      elements.kpiGrid.appendChild(item);
    });

    drawFrequencyChart();
    drawPowerChart();
    drawStateChart();
    drawMarginCharts();
  }

  function renderStatusGuide() {
    if (!state.current) {
      return;
    }
    const currentStatus = state.current.operationalClass.status;
    const statuses = [
      { title: "SECURE", body: "All active layers remain inside their normal operating bands and no emergency intervention is required.", color: model.statusColor("SECURE") },
      { title: "STRESSED", body: "The system remains controllable, but at least one layer has moved into its warning band. In this simulator that means, for example, nadir between 49.5 Hz and 49.2 Hz, RoCoF between 0.50 and 0.75 Hz/s, Voltage Proxy between 0.95 pu and 0.92 pu, or recovery slower than 30 s but still regained.", color: model.statusColor("STRESSED") },
      { title: "EMERGENCY", body: "A hard boundary is crossed or emergency protection is required, but recovered operation is still regained during the run. In this simulator that covers cases such as nadir between 49.2 Hz and 48.8 Hz, Voltage Proxy below its hard floor with successful relief, reserve floor exhaustion with relief, or recovery taking more than 60 s.", color: model.statusColor("EMERGENCY") },
      { title: "BLACKOUT", body: "Blackout is reserved for the frequency-loss-of-supply outcome in this simulator: LFDD demand disconnection is triggered, frequency falls below 48.8 Hz, or frequency recovery is not regained inside the run. Voltage and energy layers can force Emergency, but they do not become Blackout by themselves unless frequency recovery is lost as well.", color: model.statusColor("BLACKOUT") }
    ];

    elements.statusGuide.innerHTML = "";
    statuses.forEach(function (item) {
      const card = document.createElement("div");
      const active = item.title === currentStatus;
      card.className = "status-card" + (active ? " is-active" : "");
      card.style.setProperty("--status-accent", item.color);
      card.innerHTML = ""
        + "<div class=\"status-card-head\"><strong>" + escapeHtml(item.title) + "</strong>"
        + (active ? "<span class=\"status-card-tag\">Current</span>" : "")
        + "</div><p>" + escapeHtml(item.body) + "</p>";
      elements.statusGuide.appendChild(card);
    });
  }

  function renderStatusDefinition(current) {
    if (!current) {
      elements.statusDefinition.innerHTML = ""
        + "<div class=\"hero-summary-grid\">"
        + "<div class=\"hero-summary-card\"><strong>Locked Case</strong><div class=\"hero-metric\">Ready to configure</div><p>Use <em>Change Inputs</em> to unlock the operating point, services, and protections before building the next case.</p></div>"
        + "<div class=\"hero-summary-card\"><strong>Run Flow</strong><div class=\"hero-metric\">Lock, then run</div><p>After editing, apply and lock the inputs. The top bar then controls run, pause, replay, and the chart milestones.</p></div>"
        + "<div class=\"hero-summary-card\"><strong>Study Focus</strong><div class=\"hero-metric\">Frequency and Power Security</div><p>The dashboard tracks imbalance, RoCoF, nadir, service delivery, SoC, Voltage Proxy, and protection actions from the same locked case.</p></div>"
        + "</div>";
      return;
    }
    const primary = describePrimaryConstraint(current);
    const resilience = resilienceSummary(current, state.scan);
    const services = current.config.services;
    const assessment = current.componentAssessment;
    const protectionStageMW = Number(current.summary.protections.lfddStage1MW || 0);
    const voltageReliefMW = Number(current.summary.protections.voltageReliefMW || 0);
    const reserveReliefMW = Number(current.summary.protections.reserveReliefMW || 0);
    const followOnTripMW = Number(current.summary.protections.embeddedTripMW || 0);
    const serviceParts = []
      .concat(services.bessMW > 0 ? [formatNumber(services.bessMW / 1000, 2) + " GW BESS"] : [])
      .concat(services.govMW > 0 ? [formatNumber(services.govMW / 1000, 2) + " GW Governor"] : [])
      .concat(services.drMW > 0 ? [formatNumber(services.drMW / 1000, 2) + " GW Demand Response"] : [])
      .concat(services.importResponseMW > 0 ? [formatNumber(services.importResponseMW / 1000, 2) + " GW Import Support"] : []);
    const armedProtectionParts = []
      .concat(current.summary.protections.enableLfdd ? ["LFDD"] : [])
      .concat(current.summary.protections.enableVoltageRelief ? ["Voltage Relief"] : [])
      .concat(current.summary.protections.enableReserveRelief ? ["Reserve Relief"] : []);
    const protectionMetric = armedProtectionParts.length
      ? armedProtectionParts.join(" + ") + " armed"
      : "No emergency relief armed";
    const protectionBody = ""
      + (current.summary.protections.enableLfdd
        ? "LFDD can disconnect up to " + formatNumber(protectionStageMW / 1000, 2) + " GW at the 48.8 Hz threshold. If LFDD actually triggers, this simulator classifies the run as Blackout because involuntary demand disconnection has occurred. If frequency enters the emergency region but stays above 48.8 Hz, or recovers before LFDD acts, the case remains Emergency. "
        : "LFDD is disabled, so no low-frequency emergency demand disconnection is available. ")
      + (current.summary.protections.enableVoltageRelief
        ? "Under-Voltage Emergency Relief can disconnect up to " + formatNumber(voltageReliefMW / 1000, 2) + " GW if the Voltage Proxy reaches the hard floor under severe dynamic stress. A recovered hard-floor event is treated as Emergency, not Blackout. "
        : "Under-Voltage Emergency Relief is disabled, so weak-grid voltage collapse must be contained by the normal service stack alone. ")
      + (current.summary.protections.enableReserveRelief
        ? "Reserve-Floor Emergency Relief can disconnect up to " + formatNumber(reserveReliefMW / 1000, 2) + " GW if battery energy reaches its minimum floor while frequency remains under stress. "
        : "Reserve-Floor Emergency Relief is disabled, so exhausted battery reserve will not trigger an emergency demand-relief block. ");
    const followOnBody = current.summary.protections.enableEmbeddedTrips
      ? "The adverse Follow-On Disturbance toggle is separate from protection. If armed, it can remove up to " + formatNumber(followOnTripMW / 1000, 2) + " GW only after the case first enters severe dynamic stress."
      : "The adverse Follow-On Disturbance toggle is off, so no extra cascade loss is injected after the initiating disturbance.";
    const marginMetric = resilience.heroMetric;
    const layerSummary = "Frequency envelope: " + assessment.frequencyEnvelope.status
      + ". Energy reserve: " + assessment.energy.status
      + ". Voltage operability: " + (assessment.voltage.status === "BYPASSED" ? "BYPASSED" : assessment.voltage.status) + ".";
    let consequenceBody = "";
    if (current.operationalClass.status === "BLACKOUT") {
      consequenceBody = " Blackout consequence in this run: blackout conditions persist for about "
        + formatNumber(current.summary.blackoutDurationS, 1)
        + " s, maximum disconnected demand reaches "
        + formatNumber(current.kpis.Max_demand_shed_GW, 2)
        + " GW, and the disconnected-demand energy proxy is about "
        + formatNumber(current.kpis.Demand_shed_MWh, 2)
        + " MWh.";
    } else if (current.operationalClass.status === "EMERGENCY") {
      consequenceBody = " Emergency consequence in this run: hard-boundary or protection-driven conditions persist for about "
        + formatNumber(current.summary.emergencyDurationS, 1)
        + " s before recovered operation is regained.";
    } else if (current.operationalClass.status === "STRESSED") {
      consequenceBody = " Stressed operation persists for about "
        + formatNumber(current.summary.stressedDurationS, 1)
        + " s after the event, without a blackout-level loss of supply.";
    }
    const serviceBody = (serviceParts.length ? (serviceParts.join(", ") + ".") : "No fast service portfolio is armed.")
      + " Effective inertia is " + formatNumber(current.kpis.H_eff_s, 2)
      + " s and damping is " + formatNumber(current.kpis.D_eff, 2)
      + ", which sets the first-swing stiffness and the recovery tail. "
      + layerSummary + " "
      + "In this simulator, recovery is counted when frequency returns inside the 49.8-50.2 Hz band; 30-60 s is treated as stressed recovery, more than 60 s is emergency recovery, and no regained frequency recovery inside the run is treated as blackout. "
      + "A weak Voltage Proxy or tight energy reserve can raise the case to stressed or emergency, but blackout is reserved for frequency-loss-of-supply cases where protected frequency recovery is not secured. "
      + resilience.heroBody
      + consequenceBody;
    elements.statusDefinition.innerHTML = ""
      + "<div class=\"hero-summary-grid\">"
      + "<div class=\"hero-summary-card\"><strong>Binding limit</strong><div class=\"hero-metric\">" + escapeHtml(primary.metric) + "</div><p>"
      + escapeHtml(primary.body)
      + "</p></div>"
      + "<div class=\"hero-summary-card\"><strong>Protection setup</strong><div class=\"hero-metric\">" + escapeHtml(protectionMetric) + "</div><p>"
      + escapeHtml(protectionBody + followOnBody)
      + "</p></div>"
      + "<div class=\"hero-summary-card\"><strong>Service posture</strong><div class=\"hero-metric\">" + escapeHtml(marginMetric) + "</div><p>"
      + escapeHtml(serviceBody)
      + "</p></div>"
      + "</div>";
  }

  function describePrimaryConstraint(current) {
    const k = current.kpis;
    const assessment = current.componentAssessment;
    const hasBattery = batteryIsActive(current.config);
    if (current.summary.lfddTriggered) {
      return {
        metric: "LFDD at " + formatNumber(k.Nadir_Hz, 2) + " Hz",
        body: "The nadir reaches the emergency load-shedding region and LFDD is needed to arrest the cascade with " + formatNumber(k.Max_demand_shed_GW, 2) + " GW of disconnected demand. In this simulator that counts as Blackout because involuntary demand disconnection has occurred, even if the trace later recovers. The disconnected-demand energy proxy is about " + formatNumber(k.Demand_shed_MWh, 2) + " MWh. This card identifies the limiting layer that ultimately decides the final class."
      };
    }
    if (current.summary.uvlsTriggered) {
      return {
        metric: "Voltage relief at " + formatNumber(k.V_min, 3) + " pu",
        body: "The voltage-operability proxy reaches its hard floor and under-voltage emergency relief is needed to support both voltage recovery and the coupled frequency response. This is an emergency operability event if recovery is regained, and the hard-voltage condition lasts about " + formatNumber(current.summary.voltageHardDurationS, 1) + " s in this run. The box is showing that voltage, not frequency, is the layer currently limiting resilience."
      };
    }
    if (current.summary.reserveProtectionTriggered) {
      return {
        metric: "Reserve relief at " + formatNumber(k.SoC_min * 100, 0) + "% SoC",
        body: "Battery energy reaches its minimum floor under continued frequency stress, so reserve-floor emergency relief is used to stop the case from deepening further. This is still an emergency event if protected recovery is regained. The limiting layer here is reserve endurance rather than the first frequency dip alone."
      };
    }
    if (
      assessment.frequencyEnvelope.status === "SECURE"
      && assessment.voltage.status === "STRESSED"
    ) {
      return {
        metric: "Voltage proxy " + formatNumber(k.V_min, 3) + " pu",
        body: "Frequency containment remains secure, but the voltage-operability layer is weak. That means the grid is still recovering in frequency, yet the operating point is less robust because weak-system conditions can de-rate support. The binding limit is therefore operability margin rather than outright frequency collapse."
      };
    }
    if (
      assessment.frequencyEnvelope.status === "SECURE"
      && hasBattery
      && assessment.energy.status !== "SECURE"
    ) {
      return {
        metric: "Minimum SoC " + formatNumber(k.SoC_min * 100, 0) + "%",
        body: "Frequency containment remains secure, but the reserve layer is tight. The event is being arrested successfully, yet the battery finishes with limited post-fault energy margin. This means the case is constrained by remaining energy support rather than by immediate arrest capability."
      };
    }
    if (current.operationalClass.status === "BLACKOUT") {
      return {
        metric: "Recovery not secured",
        body: "The case leaves the secure recovery envelope because frequency loss-of-supply has occurred or frequency recovery is not regained robustly after the event. In this simulator, Blackout is reserved for failure to secure recovered frequency continuity, not for a brief hard-limit crossing that protection successfully arrests. Blackout conditions last about " + formatNumber(current.summary.blackoutDurationS, 1) + " s in this run. The binding limit here is the loss of secure recovered frequency continuity."
      };
    }

    const candidates = [
      {
        score: normalizeAscendingBuffer(k.Nadir_Hz, model.LIMITS.frequency.lfdd, model.LIMITS.frequency.operationalLow),
        metric: "Nadir " + formatNumber(k.Nadir_Hz, 2) + " Hz",
        body: "Frequency nadir is the tightest margin and should be read against 49.5 Hz for stressed operation and 48.8 Hz for LFDD."
      },
      {
        score: normalizeDescendingBuffer(k.MaxRoCoF, model.LIMITS.rocof.operational, model.LIMITS.rocof.enhanced),
        metric: "RoCoF " + formatNumber(k.MaxRoCoF, 2) + " Hz/s",
        body: "Rate of change of frequency is the tightest margin, so inertia and fast arrest capability are driving the first swing."
      },
      {
        score: normalizeAscendingBuffer(k.V_min, model.LIMITS.voltage.hard, model.LIMITS.voltage.warning),
        metric: "Voltage proxy " + formatNumber(k.V_min, 3) + " pu",
        body: "The weak-system voltage proxy is the tightest limit. This points to operability stress rather than to a direct frequency blackout, unless the weak voltage also degrades containment and recovery."
      }
    ];
    if (hasBattery) {
      candidates.push({
        score: normalizeAscendingBuffer(k.SoC_min * 100, model.LIMITS.soc.minimum * 100, model.LIMITS.soc.healthy * 100),
        metric: "Minimum SoC " + formatNumber(k.SoC_min * 100, 0) + "%",
        body: "Battery energy margin is the tightest post-fault constraint, so the case is limited by endurance rather than by the first arrest."
      });
    }
    candidates.sort(function (a, b) {
      return a.score - b.score;
    });

    if (candidates[0].score > 1) {
      return {
        metric: "All core limits buffered",
        body: "Nadir, RoCoF, SoC, and voltage all remain inside their healthy planning bands, so no single limit dominates this case. The run is therefore being shaped by the overall service mix rather than by one binding weakness."
      };
    }

    return {
      metric: candidates[0].metric,
      body: candidates[0].body
    };
  }

  function resilienceSummary(current, scan) {
    const defaultLimit = {
      title: "Resilience margin",
      value: 0,
      min: -400,
      max: 1600,
      target: 300,
      caution: 0,
      unit: "MW",
      lowerIsWorse: false,
      labels: { low: "Already in emergency", mid: "Thin buffer", high: "Headroom left" },
      captions: {
        healthy: "Green means the locked case can absorb more loss before emergency intervention is needed.",
        marginal: "Amber means only a modest extra disturbance remains before emergency action is triggered.",
        critical: "Red means the locked case is already at or beyond the emergency boundary."
      },
      thresholds: [
        { value: 0, label: "0 MW" },
        { value: 300, label: "+300 MW" }
      ]
    };

    if (!current) {
      return {
        label: "Resilience margin",
        value: "--",
        detail: "Run the disturbance scan to quantify the remaining security buffer.",
        heroMetric: "Scan pending",
        heroBody: "The disturbance-buffer scan is still updating, so only the locked-case service stack is currently shown.",
        limit: defaultLimit
      };
    }

    if (!scan) {
      return {
        label: "Resilience margin",
        value: "--",
        detail: "The scan is updating. This card will switch from service posture to disturbance headroom once the sweep is ready.",
        heroMetric: formatNumber(current.kpis.Max_service_GW, 2) + " GW max fast support",
        heroBody: "The disturbance-buffer scan is still updating, so this fallback shows the peak fast service currently armed in the locked case.",
        limit: defaultLimit
      };
    }

    if (current.operationalClass.status === "BLACKOUT") {
      const excess = Math.abs(Math.min(scan.collapseMarginMW, 0));
      return {
        label: "Recovery not secured",
        value: signed(Math.round(scan.marginMW)) + " MW",
        detail: excess > 0
          ? "The locked case is already beyond the blackout-risk boundary by about " + Math.round(excess) + " MW in the disturbance scan."
          : "The locked case sits directly on the blackout-risk boundary in the disturbance scan.",
        heroMetric: "Protected recovery lost",
        heroBody: excess > 0
          ? "The disturbance scan places this case around " + Math.round(excess) + " MW beyond the blackout-risk boundary, so protected recovery is no longer secured by any remaining resilience buffer."
          : "The disturbance scan places this case directly on the blackout-risk boundary, so no additional resilience buffer remains.",
        limit: {
          title: "Recovery not secured",
          value: scan.marginMW,
          min: -800,
          max: 800,
          target: 300,
          caution: 0,
          unit: "MW",
          lowerIsWorse: false,
          labels: { low: "Beyond blackout", mid: "Boundary reached", high: "Buffer left" },
          captions: {
            healthy: "Green means a measurable blackout-risk buffer still exists.",
            marginal: "Amber means the blackout-risk boundary is close.",
            critical: "Red means the locked case is already beyond the blackout-risk boundary."
          },
          thresholds: [
            { value: 0, label: "0 MW" },
            { value: 300, label: "+300 MW" }
          ]
        }
      };
    }

    if (scan.marginMode === "collapse") {
      return {
        label: "Blackout buffer",
        value: signed(Math.round(scan.marginMW)) + " MW",
        detail: scan.marginMW > 0
          ? "Emergency action is already active, and only about +" + Math.round(scan.marginMW) + " MW remains before blackout."
          : "Emergency action is already active and the blackout buffer is exhausted at this operating point.",
        heroMetric: signed(Math.round(scan.marginMW)) + " MW blackout buffer",
        heroBody: scan.marginMW > 0
          ? "Emergency protection is already active. The remaining disturbance headroom before blackout is only about +" + Math.round(scan.marginMW) + " MW."
          : "Emergency protection is already active and no remaining blackout buffer is visible inside the tested disturbance envelope.",
        limit: {
          title: "Blackout buffer",
          value: scan.marginMW,
          min: -400,
          max: 1200,
          target: 300,
          caution: 0,
          unit: "MW",
          lowerIsWorse: false,
          labels: { low: "Blackout reached", mid: "Thin buffer", high: "Buffer left" },
          captions: {
            healthy: "Green means some disturbance headroom remains before the case tips into blackout.",
            marginal: "Amber means blackout is close even with emergency action active.",
            critical: "Red means the blackout boundary is already exhausted."
          },
          thresholds: [
            { value: 0, label: "0 MW" },
            { value: 300, label: "+300 MW" }
          ]
        }
      };
    }

    return {
      label: "Resilience margin",
      value: signed(Math.round(scan.marginMW)) + " MW",
      detail: scan.boundaryLossMW === null
        ? "No emergency boundary is reached anywhere inside the tested disturbance envelope."
        : "Extra disturbance before emergency intervention is required.",
      heroMetric: signed(Math.round(scan.marginMW)) + " MW resilience margin",
      heroBody: scan.boundaryLossMW === null
        ? "No emergency threshold is reached inside the tested disturbance envelope, so the locked case keeps a wide disturbance buffer."
        : "The disturbance scan shows about +" + Math.round(scan.marginMW) + " MW of additional loss before emergency intervention is required.",
      limit: defaultLimit
    };
  }

  function renderWeatherSummary() {
    const weather = model.WEATHER_LIBRARY[state.pendingConfig.weather] || model.WEATHER_LIBRARY.windy;
    const importsGW = state.pendingConfig.importsMW / 1000;
    const domesticGenerationGW = Math.max(state.pendingConfig.demandGW - importsGW, 0);
    const resGW = domesticGenerationGW * state.pendingConfig.resShare;
    const windGW = resGW * weather.windShare;
    const solarGW = resGW - windGW;
    const strengthLabel = state.pendingConfig.systemStrength < 0.8
      ? "weak-grid leaning"
      : (state.pendingConfig.systemStrength > 1.02 ? "strong-grid leaning" : "nominal grid strength");

    elements.weatherSummary.innerHTML = ""
      + "<strong>" + escapeHtml(weather.label) + ".</strong> "
      + escapeHtml(weather.narrative) + " "
      + "In this final model, pre-fault domestic generation is solved automatically to balance demand with the chosen net imports. "
      + "That gives about " + escapeHtml(formatNumber(domesticGenerationGW, 1)) + " GW domestic generation before the event, of which Renewable Share assigns "
      + escapeHtml(formatNumber(resGW, 1)) + " GW to renewables. "
      + "Weather then distributes that renewable block, using a stylized operating narrative rather than a historical forecast, into approximately "
      + escapeHtml(formatNumber(windGW, 1)) + " GW wind and "
      + escapeHtml(formatNumber(solarGW, 1)) + " GW solar. "
      + "So Renewable Share controls both the non-synchronous generation share and the inertia context, while Weather controls the wind-versus-solar composition and short-term renewable variability. Wind output loss and solar output loss are then applied as step removals from this pre-fault renewable mix at the event time. "
      + "Base imports are currently set to " + escapeHtml(String(Math.round(state.pendingConfig.importsMW))) + " MW, and system strength is currently set to "
      + escapeHtml(strengthLabel) + ". "
      + "The pre-fault operating point is therefore intentionally balanced before the disturbance, so the dashboard focuses on disturbance response, service action, protection action, and resilience rather than market dispatch. "
      + (state.pendingConfig.enableVoltageLayer === false
        ? "The Voltage Proxy layer is currently bypassed, so the proxy is held at 1.0 pu and System Strength does not affect the run."
        : "The Voltage Proxy layer is active, so lower System Strength reduces the voltage-operability buffer, can de-rate service effectiveness, and can indirectly worsen frequency recovery. If the hard voltage floor is reached and the emergency relief toggle is armed, a protective demand-relief block can act to arrest deeper voltage and frequency deterioration.");
  }

  function renderEventSummary() {
    if (state.pendingConfig.eventType === "aug2019") {
      elements.eventSummary.innerHTML = "This case uses the 9 Aug 2019 scripted sequence. Disturbance size sets the base Hornsea and Little Barford loss envelope, while the embedded generation trip block is treated as an adverse Follow-On Disturbance loss. LFDD, Under-Voltage Emergency Relief, and Reserve-Floor Emergency Relief are true protection actions; the Follow-On Disturbance block is not a protection action and only triggers if severe dynamic stress develops.";
      return;
    }
    if (state.pendingConfig.eventType === "windStep") {
      const weather = model.WEATHER_LIBRARY[state.pendingConfig.weather] || model.WEATHER_LIBRARY.windy;
      const domesticGenerationGW = Math.max(state.pendingConfig.demandGW - (state.pendingConfig.importsMW / 1000), 0);
      const prefaultResGW = domesticGenerationGW * state.pendingConfig.resShare;
      const prefaultWindGW = prefaultResGW * weather.windShare;
      const appliedLossGW = Math.min(state.pendingConfig.lossMW / 1000, prefaultWindGW);
      const appliedPct = prefaultWindGW > 0 ? (appliedLossGW / prefaultWindGW) * 100 : 0;
      elements.eventSummary.innerHTML = "This case uses a step loss of wind generation. Disturbance size removes up to "
        + formatNumber(appliedLossGW, 2) + " GW from the pre-fault wind block, which is about "
        + formatNumber(appliedPct, 0) + "% of the available wind generation in this operating point. It acts as an instantaneous step reduction at the event time, not as a ramp. The remaining wind trace still follows the selected weather variability after that step, but from a lower generation base. LFDD, Under-Voltage Emergency Relief, and Reserve-Floor Emergency Relief only act if armed and their thresholds are crossed.";
      return;
    }
    if (state.pendingConfig.eventType === "solarStep") {
      const weather = model.WEATHER_LIBRARY[state.pendingConfig.weather] || model.WEATHER_LIBRARY.windy;
      const domesticGenerationGW = Math.max(state.pendingConfig.demandGW - (state.pendingConfig.importsMW / 1000), 0);
      const prefaultResGW = domesticGenerationGW * state.pendingConfig.resShare;
      const prefaultSolarGW = prefaultResGW * (1 - weather.windShare);
      const appliedLossGW = Math.min(state.pendingConfig.lossMW / 1000, prefaultSolarGW);
      const appliedPct = prefaultSolarGW > 0 ? (appliedLossGW / prefaultSolarGW) * 100 : 0;
      elements.eventSummary.innerHTML = "This case uses a step loss of solar generation. Disturbance size removes up to "
        + formatNumber(appliedLossGW, 2) + " GW from the pre-fault solar block, which is about "
        + formatNumber(appliedPct, 0) + "% of the available solar generation in this operating point. It acts as an instantaneous step reduction at the event time, not as a ramp. The remaining solar trace still follows the selected weather variability after that step, but from a lower generation base. LFDD, Under-Voltage Emergency Relief, and Reserve-Floor Emergency Relief only act if armed and their thresholds are crossed.";
      return;
    }
    elements.eventSummary.innerHTML = "This case uses a generator-trip disturbance. The disturbance set stays intentionally simple: a discrete generator loss, a step wind loss, a step solar loss, or the 9 Aug 2019 scripted sequence. LFDD, Under-Voltage Emergency Relief, and Reserve-Floor Emergency Relief only act if armed and their thresholds are crossed. The Follow-On Disturbance block is a separate adverse cascade loss, not a protection action.";
  }

  function renderServiceSummary() {
    const services = state.pendingConfig.services;
    const lines = [];
    lines.push("BESS power sets the maximum arrest rate in MW, while BESS energy and initial SoC set how long that support can be sustained before the battery reaches its reserve floor.");
    lines.push("If MW is high but MWh is small, the battery can still arrest the first swing but it will hand off earlier during recovery, so energy matters most when the disturbance is long or the rest of the service stack is thin.");
    lines.push("Governor Headroom is slower synchronous support, RES Headroom is pre-curtailed renewable margin that can be released after the fault, Demand Response is delayed load relief, and Import Response is optional extra frequency-sensitive support on interconnectors.");
    if (services.useImportSupport) {
      lines.push("Import Response is currently armed, so interconnector support can add up to " + formatNumber(services.importResponseMW / 1000, 2) + " GW if the frequency fall is deep enough.");
    } else {
      lines.push("Import Response is currently switched off, so the service stack relies only on domestic support layers and protections.");
    }
    if (services.bessMWh > 0 && services.bessMW > 0) {
      const dischargeHours = services.bessMW > 0 ? services.bessMWh / Math.max(services.bessMW, 1) : 0;
      lines.push("At the current sliders, the battery can sustain full-power discharge for about " + formatNumber(dischargeHours * 60, 0) + " minutes if it starts above the minimum SoC.");
    }
    elements.serviceSummary.innerHTML = lines.join(" ");
  }

  function renderControlSummaries() {
    updateConditionalControls();
    renderWeatherSummary();
    renderEventSummary();
    renderServiceSummary();
  }

  function renderMixSummary() {
    if (!state.current) {
      return;
    }
    const summary = state.current.summary;
    const cards = [
      { label: "Wind Average", value: formatNumber(summary.prefaultWindGW, 1) + " GW", detail: formatNumber(summary.windPctOfRes, 0) + "% of renewables" },
      { label: "Solar Average", value: formatNumber(summary.prefaultSolarGW, 1) + " GW", detail: formatNumber(summary.solarPctOfRes, 0) + "% of renewables" },
      {
        label: "Domestic Generation",
        value: formatNumber(summary.prefaultGenerationGW, 1) + " GW",
        detail: "Automatically solved from demand minus net imports before the fault"
      },
      {
        label: "Total RES",
        value: formatNumber(summary.prefaultResGW, 1) + " GW",
        detail: "Renewable Share applied to domestic generation before the event"
      },
      { label: "Event", value: summary.eventLabel, detail: "Start " + formatNumber(state.current.config.tFault, 0) + " s" },
      {
        label: "System Strength",
        value: formatNumber(summary.systemStrength, 2) + " pu",
        detail: state.current.config.enableVoltageLayer === false
          ? "Voltage layer bypassed for frequency-only study."
          : "Lower strength weakens the voltage proxy and can indirectly worsen frequency and reserve margins through service de-rating."
      },
      {
        label: "Pre-Fault Balance",
        value: signed(formatNumber(summary.prefaultBalanceGW, 2)) + " GW",
        detail: Math.abs(summary.prefaultBalanceGW) < 0.15
          ? "Pre-fault supply and demand are closely balanced."
          : (summary.prefaultBalanceGW > 0
            ? "Domestic generation plus imports exceed demand before the disturbance."
            : "Demand exceeds domestic generation plus imports before the disturbance.")
      },
      { label: "Import Response", value: formatNumber(summary.importResponseGW, 2) + " GW", detail: "Extra frequency-sensitive support beyond base imports" }
    ];

    elements.mixSummary.innerHTML = "";
    cards.forEach(function (card) {
      const item = document.createElement("div");
      item.className = "mix-card";
      item.innerHTML = ""
        + "<span class=\"mix-label\">" + escapeHtml(card.label) + "</span>"
        + "<strong>" + escapeHtml(card.value) + "</strong>"
        + "<p>" + escapeHtml(card.detail) + "</p>";
      elements.mixSummary.appendChild(item);
    });
  }

  function renderCascadeSummary() {
    if (!state.current) {
      elements.cascadeSummary.innerHTML = "";
      return;
    }
    const rows = state.current.events.filter(function (event) {
      return event.category === "protection" || event.category === "lfdd" || event.category === "cascade";
    }).slice(0, 6);
    elements.cascadeSummary.innerHTML = "";
    if (!rows.length) {
      const protectionsArmed = state.current.summary.protections.enableLfdd
        || state.current.summary.protections.enableVoltageRelief
        || state.current.summary.protections.enableReserveRelief;
      const cascadeArmed = state.current.summary.protections.enableEmbeddedTrips;
      elements.cascadeSummary.innerHTML = protectionsArmed || cascadeArmed
        ? "<div class=\"cascade-item cascade-neutral\"><strong>No triggered protection or cascade action</strong><p>The locked case is contained without emergency relief or adverse follow-on disturbance losses.</p></div>"
        : "<div class=\"cascade-item cascade-neutral\"><strong>No triggered protection or cascade action</strong><p>All protection and follow-on disturbance toggles are off in the locked case, so only the primary disturbance is simulated.</p></div>";
      return;
    }
    rows.forEach(function (event) {
      const item = document.createElement("div");
      const className = event.category === "cascade"
        ? "cascade-item cascade-warning"
        : "cascade-item cascade-critical";
      const impactText = event.category === "lfdd"
        ? "Emergency demand disconnection removes " + formatNumber(event.impactGW, 3) + " GW of load to arrest a deeper low-frequency cascade."
        : (event.category === "protection"
          ? "Emergency relief disconnects " + formatNumber(event.impactGW, 3) + " GW to protect the grid after a hard operability boundary is crossed."
          : "An additional " + formatNumber(event.impactGW, 3) + " GW is lost through an adverse follow-on disturbance after the initiating event.");
      item.className = className;
      item.innerHTML = ""
        + "<span class=\"cascade-time\">t = " + escapeHtml(formatNumber(event.time, 1)) + " s</span>"
        + "<strong>" + escapeHtml(event.label) + "</strong>"
        + "<p>" + escapeHtml(impactText) + "</p>";
      elements.cascadeSummary.appendChild(item);
    });
  }

  function renderInsights() {
    elements.insightList.innerHTML = "";
    state.insights.forEach(function (insight) {
      const block = document.createElement("div");
      block.className = "insight-item tone-" + escapeHtml(insight.tone || "summary");
      block.innerHTML = ""
        + "<div class=\"insight-head\"><h4>" + escapeHtml(insight.title) + "</h4>"
        + "<span class=\"insight-badge\">" + escapeHtml(insightToneLabel(insight.tone)) + "</span></div>"
        + "<p>" + escapeHtml(insight.body) + "</p>";
      elements.insightList.appendChild(block);
    });
  }

  function renderRelationships() {
    if (!elements.relationshipList) {
      return;
    }
    if (!state.current) {
      elements.relationshipList.innerHTML = ""
        + "<div class=\"relationship-card tone-summary\"><div class=\"relationship-head\"><h4>Locked-Case Relationships</h4><span class=\"insight-badge\">Pending</span></div><p>Run a case to see how Frequency, Voltage Proxy, Battery Power, Battery Energy, and the emergency protections are interacting in the current operating point.</p></div>";
      return;
    }

    const current = state.current;
    const assessment = current.componentAssessment;
    const protections = current.summary.protections;
    const sensitivityByName = {};
    (state.sensitivity || []).forEach(function (item) {
      sensitivityByName[item.name] = item;
    });

    function signedDelta(value, digits, suffix) {
      if (!Number.isFinite(value)) {
        return "--";
      }
      const fixed = Number(value).toFixed(digits);
      return (value >= 0 ? "+" : "") + fixed + (suffix || "");
    }

    const bessPower = sensitivityByName["BESS power"];
    const bessEnergy = sensitivityByName["BESS energy"];
    const systemStrength = sensitivityByName["System strength"];
    const gfm = sensitivityByName["GFM damping"];
    const syncon = sensitivityByName["SynCon inertia"];
    const triggeredProtections = current.events.filter(function (event) {
      return event.category === "protection" || event.category === "lfdd";
    }).map(function (event) { return event.label; });

    const cards = [];

    cards.push({
      tone: "summary",
      title: "Frequency–Power Chain",
      badge: "Equation",
      body: "Frequency follows the imbalance equation and the swing response: higher net deficit pushes frequency down, while more inertia and damping soften the first swing. In this locked case the maximum deficit is "
        + formatNumber(current.kpis.Max_deficit_GW, 2) + " GW, the nadir is "
        + formatNumber(current.kpis.Nadir_Hz, 2) + " Hz, and the effective inertia / damping are "
        + formatNumber(current.kpis.H_eff_s, 2) + " s and " + formatNumber(current.kpis.D_eff, 2) + "."
    });

    let batteryBody = "Battery Power mainly affects first-swing arrest, while Battery Energy and initial SoC mainly affect how long support can be sustained before the reserve floor is reached.";
    if (bessPower) {
      batteryBody += " Around this locked case, increasing Battery Power shifts the nadir by "
        + signedDelta(bessPower.highDelta, 3, " Hz")
        + " and the Voltage Proxy by " + signedDelta(bessPower.voltageHighDelta, 3, " pu") + ".";
    }
    if (bessEnergy) {
      batteryBody += " Increasing Battery Energy shifts the nadir by "
        + signedDelta(bessEnergy.highDelta, 3, " Hz")
        + " and the minimum SoC by " + signedDelta(bessEnergy.socHighDelta * 100, 1, " pts") + ".";
    }
    batteryBody += current.config.services.useGfm || current.config.services.useSyncon
      ? " Because Grid-Forming Support or SynCon support is active, part of the service stack also helps the Voltage Proxy directly."
      : " Plain Battery MW is active-power support only in this model, so it can improve frequency much more than Voltage Proxy unless Grid-Forming Support or SynCon support is also enabled.";
    cards.push({
      tone: "summary",
      title: "Battery Power vs Energy",
      badge: "Service Split",
      body: batteryBody
    });

    let voltageBody = "The Voltage Proxy is driven by three stresses in the model: deficit stress, frequency stress, and RoCoF stress. Weak System Strength lowers the voltage-operability target and can also de-rate service effectiveness.";
    if (systemStrength) {
      voltageBody += " Around this locked case, increasing System Strength shifts the nadir by "
        + signedDelta(systemStrength.highDelta, 3, " Hz")
        + " and the Voltage Proxy by " + signedDelta(systemStrength.voltageHighDelta, 3, " pu") + ".";
    }
    if (gfm || syncon) {
      const extras = [];
      if (gfm) {
        extras.push("higher Grid-Forming damping changes Voltage Proxy by " + signedDelta(gfm.highVoltageDelta || gfm.voltageHighDelta, 3, " pu"));
      }
      if (syncon) {
        extras.push("higher SynCon inertia changes Voltage Proxy by " + signedDelta(syncon.highVoltageDelta || syncon.voltageHighDelta, 3, " pu"));
      }
      voltageBody += " In the local sensitivity scan, " + extras.join(" and ") + ".";
    }
    cards.push({
      tone: "summary",
      title: "Voltage Proxy Coupling",
      badge: "Operability",
      body: voltageBody
    });

    let protectionBody = "Emergency protections act by subtracting MW from effective demand. That helps frequency because it lifts the net imbalance term, and it helps Voltage Proxy because the deficit-stress term in the Voltage equation is reduced.";
    protectionBody += " The exact recovery depends on how large the armed relief block is compared with the continuing deficit.";
    if (triggeredProtections.length) {
      protectionBody += " In this run the triggered protection chain is: " + triggeredProtections.join(", ") + ".";
    } else {
      protectionBody += " In this run no emergency protection action was triggered.";
    }
    if (protections.enableEmbeddedTrips) {
      protectionBody += " The Follow-On Disturbance Block is separate from protection: if it triggers, it worsens the event instead of helping the grid.";
    }
    cards.push({
      tone: "summary",
      title: "Protection Interaction",
      badge: "Emergency Logic",
      body: protectionBody
    });

    const statusBody = "Overall case status is frequency-first, with Energy Reserve and Voltage Proxy tracked as coupled constraint layers. Stressed means warning-band operation without a hard boundary crossing; Emergency means a hard boundary was crossed or emergency action was needed but recovered operation was regained; and Blackout is reserved for frequency-loss-of-supply cases where LFDD demand disconnection occurs or frequency recovery is not regained. In this run, stressed conditions last about " + formatNumber(current.summary.stressedDurationS, 1) + " s, emergency conditions last about " + formatNumber(current.summary.emergencyDurationS, 1) + " s, and blackout conditions last about " + formatNumber(current.summary.blackoutDurationS, 1) + " s. A weak Voltage Proxy alone can mean operability stress, but it is not treated as a blackout unless it also causes loss of recovered frequency stability.";
    cards.push({
      tone: "summary",
      title: "Status Interpretation",
      badge: current.operationalClass.status,
      badgeColor: model.statusColor(current.operationalClass.status),
      body: statusBody
    });

    elements.relationshipList.innerHTML = "";
    cards.forEach(function (card) {
      const block = document.createElement("div");
      block.className = "relationship-card tone-" + escapeHtml(card.tone || "summary");
      const badgeStyle = card.badgeColor
        ? " style=\"color:" + escapeHtml(card.badgeColor) + ";border-color:" + escapeHtml(card.badgeColor) + ";background:" + escapeHtml(card.badgeColor) + "14;\""
        : "";
      block.innerHTML = ""
        + "<div class=\"relationship-head\"><h4>" + escapeHtml(card.title) + "</h4><span class=\"insight-badge\"" + badgeStyle + ">" + escapeHtml(card.badge) + "</span></div>"
        + "<p>" + escapeHtml(card.body) + "</p>";
      elements.relationshipList.appendChild(block);
    });
  }

  function renderFocus() {
    if (!state.current) {
      return;
    }
    const point = pointAt(state.current, activeIndex());
    if (state.activeChart === "power") {
      elements.focusReadout.textContent = "Power focus: t = " + formatNumber(point.time, 1)
        + " s | imbalance = " + signed(point.imbalance.toFixed(2))
        + " GW | disturbance = " + formatNumber(point.disturbance, 2)
        + " GW | fast support = " + formatNumber(state.current.dispatch.serviceTotalGW[state.chartFocus.power], 2) + " GW";
    } else if (state.activeChart === "state") {
      elements.focusReadout.textContent = "State focus: t = " + formatNumber(point.time, 1)
        + " s | "
        + (batteryIsActive(state.current.config)
          ? ("SoC = " + Math.round(point.soc * 100) + "% | ")
          : "No battery active | ")
        + "voltage proxy = " + formatNumber(point.voltage, 3) + " pu";
    } else {
      elements.focusReadout.textContent = "Frequency focus: t = " + formatNumber(point.time, 1)
        + " s | f = " + formatNumber(point.frequency, 2)
        + " Hz | RoCoF = " + signed(point.rocof.toFixed(2)) + " Hz/s";
    }
    renderFocusMetrics(point);

    const cards = [
      {
        title: "Weather and dispatch",
        value: point.weather,
        tone: "summary",
        body: "Demand " + formatNumber(point.demand, 1) + " GW with wind " + formatNumber(point.wind, 1)
          + " GW, solar " + formatNumber(point.solar, 1) + " GW, and total renewables " + formatNumber(point.res, 1) + " GW."
      },
      {
        title: "Disturbance",
        value: signed(point.disturbance.toFixed(2)) + " GW",
        tone: Math.abs(point.disturbance) >= 1.8 ? "critical" : "warning",
        body: point.eventLabel + " at t = " + formatNumber(state.current.config.tFault, 0)
          + " s. Positive means lost power. Negative means extra renewable power."
      },
      {
        title: "Net imbalance",
        value: signed(point.imbalance.toFixed(2)) + " GW",
        tone: Math.abs(point.imbalance) >= 1.0 ? "critical" : (Math.abs(point.imbalance) >= 0.3 ? "warning" : "good"),
        body: "Net generation " + formatNumber(point.generation, 2) + " GW against demand " + formatNumber(point.demand, 2)
          + " GW. This net deficit is the forcing term in the swing equation."
      },
      {
        title: "Inertia and damping",
        value: "H = " + formatNumber(state.current.kpis.H_eff_s, 2) + " s",
        tone: state.current.kpis.MaxRoCoF >= model.LIMITS.rocof.operational ? "warning" : "good",
        body: "Damping = " + formatNumber(state.current.kpis.D_eff, 2)
          + ". More inertia reduces early RoCoF; more damping helps the nadir settle."
      },
      {
        title: "Frequency state",
        value: formatNumber(point.frequency, 2) + " Hz",
        tone: point.frequency <= model.LIMITS.frequency.lfdd ? "critical" : (point.frequency <= model.LIMITS.frequency.operationalLow ? "warning" : "good"),
        body: "RoCoF " + signed(point.rocof.toFixed(2)) + " Hz/s. Total imports " + formatNumber(point.importsTotal, 2)
          + " GW including " + formatNumber(point.importAssist, 2) + " GW fast support."
      },
      {
        title: "Protection state",
        value: Math.round(point.soc * 100) + "%",
        tone: point.demandShed > 0 ? "critical" : (point.voltage < model.LIMITS.voltage.warning ? "warning" : "good"),
        body: "Voltage Proxy " + formatNumber(point.voltage, 3) + " pu. Demand shed is " + formatNumber(point.demandShed, 2)
          + " GW. Frequency envelope is " + state.current.componentAssessment.frequencyEnvelope.status
          + " and voltage operability is " + state.current.componentAssessment.voltage.status + "."
      }
    ];

    elements.causalDiagram.innerHTML = "";
    cards.forEach(function (card) {
      const item = document.createElement("div");
      item.className = "diagram-card tone-" + (card.tone || "summary");
      item.innerHTML = "<h4>" + escapeHtml(card.title) + "</h4><strong>" + escapeHtml(card.value) + "</strong><p>" + escapeHtml(card.body) + "</p>";
      elements.causalDiagram.appendChild(item);
    });
    syncScrubber();
  }

  function renderLimits() {
    if (!state.current) {
      return;
    }
    const k = state.current.kpis;
    const resilience = resilienceSummary(state.current, state.scan);
    const rows = [
      limitSpec({
        title: "Frequency nadir",
        value: k.Nadir_Hz,
        min: 48.5,
        max: 50.2,
        target: model.LIMITS.frequency.operationalLow,
        caution: model.LIMITS.frequency.lfdd,
        unit: "Hz",
        lowerIsWorse: false,
        labels: { low: "LFDD region", mid: "Stressed band", high: "Secure band" },
        captions: {
          healthy: "Green means the nadir stays above the operational floor.",
          marginal: "Amber means the case remains operable but the nadir is tight.",
          critical: "Red means the frequency path reaches the emergency load-shedding region."
        },
        thresholds: [
          { value: model.LIMITS.frequency.operationalLow, label: "49.5" },
          { value: model.LIMITS.frequency.lfdd, label: "48.8" }
        ]
      }),
      limitSpec({
        title: "RoCoF",
        value: k.MaxRoCoF,
        min: 0,
        max: 1.2,
        target: model.LIMITS.rocof.enhanced,
        caution: model.LIMITS.rocof.operational,
        unit: "Hz/s",
        lowerIsWorse: true,
        labels: { low: "Planning band", mid: "Stressed band", high: "Trip risk" },
        captions: {
          healthy: "Green means inertia keeps RoCoF inside the planning benchmark.",
          marginal: "Amber means the case remains operable, but the first swing is too sharp for comfortable margin.",
          critical: "Red means the rate of change enters a region where legacy protection can misoperate."
        },
        thresholds: [
          { value: model.LIMITS.rocof.enhanced, label: "0.25" },
          { value: model.LIMITS.rocof.operational, label: "0.50" }
        ]
      }),
      limitSpec({
        title: "Recovery time",
        value: Number.isFinite(k.Recovery_s) ? k.Recovery_s : 90,
        min: 0,
        max: 90,
        target: model.LIMITS.recovery.good,
        caution: model.LIMITS.recovery.marginal,
        unit: "s",
        lowerIsWorse: true,
        labels: { low: "Fast recovery", mid: "Slow recovery", high: "No recovery" },
        captions: {
          healthy: "Green means the system returns quickly toward nominal frequency.",
          marginal: "Amber means the system survives but restores slowly.",
          critical: "Red means recovery is too slow or absent after the event."
        },
        thresholds: [
          { value: model.LIMITS.recovery.good, label: "30 s" },
          { value: model.LIMITS.recovery.marginal, label: "60 s" }
        ]
      }),
      limitSpec({
        title: "Voltage Proxy",
        value: k.V_min,
        min: 0.88,
        max: 1.05,
        target: model.LIMITS.voltage.warning,
        caution: model.LIMITS.voltage.hard,
        unit: "pu",
        lowerIsWorse: false,
        labels: { low: "Hard floor", mid: "Weak region", high: "Healthy band" },
        captions: {
          healthy: "Green means the system-strength proxy remains in the healthy region.",
          marginal: "Amber means weak-system stress is visible even if frequency still recovers.",
          critical: "Red means the voltage proxy enters the hard operability floor; this flags weak-grid operability stress, not an automatic frequency blackout on its own."
        },
        thresholds: [
          { value: model.LIMITS.voltage.warning, label: "0.95" },
          { value: model.LIMITS.voltage.hard, label: "0.92" }
        ]
      }),
      limitSpec(resilience.limit)
    ];
    if (batteryIsActive(state.current.config)) {
      rows.splice(4, 0, limitSpec({
        title: "Minimum SoC",
        value: k.SoC_min * 100,
        min: 0,
        max: 100,
        target: model.LIMITS.soc.healthy * 100,
        caution: model.LIMITS.soc.minimum * 100,
        unit: "%",
        lowerIsWorse: false,
        labels: { low: "Reserve floor", mid: "Tight energy", high: "Healthy reserve" },
        captions: {
          healthy: "Green means battery energy remains available for post-fault support.",
          marginal: "Amber means the event consumes a large share of the battery recovery margin.",
          critical: "Red means the battery is forced close to its minimum reserve floor."
        },
        thresholds: [
          { value: model.LIMITS.soc.healthy * 100, label: "20%" },
          { value: model.LIMITS.soc.minimum * 100, label: "10%" }
        ]
      }));
    }

    elements.limitRows.innerHTML = "";
    rows.forEach(function (row) {
      const thresholdMarkup = row.thresholds.map(function (threshold) {
        return "<span class=\"limit-threshold\" style=\"left:" + threshold.position + "%;\" title=\"Threshold at " + escapeHtml(threshold.label) + "\"></span>";
      }).join("");
      const thresholdLabels = row.thresholds.map(function (threshold) {
        return "<span class=\"limit-threshold-label\" style=\"left:" + threshold.position + "%; top:" + (threshold.row * 22) + "px;\" title=\"Threshold at " + escapeHtml(threshold.label) + "\">" + escapeHtml(threshold.label) + "</span>";
      }).join("");
      const wrapper = document.createElement("div");
      wrapper.className = "limit-row";
      wrapper.innerHTML = ""
        + "<div class=\"limit-head\"><span class=\"limit-title\">" + escapeHtml(row.title) + "</span>"
        + "<span class=\"limit-meta\">" + escapeHtml(row.valueLabel) + "</span></div>"
        + "<p class=\"limit-caption\">" + escapeHtml(row.caption) + "</p>"
        + "<div class=\"limit-bar limit-band\" title=\"Current value: " + escapeHtml(row.valueLabel) + "\" style=\"background:" + row.band + ";\"><div class=\"limit-marker\" style=\"left:" + row.width + "%;\"></div>" + thresholdMarkup + "</div>"
        + "<div class=\"limit-thresholds\">" + thresholdLabels + "</div>"
        + "<div class=\"limit-scale\"><span>" + escapeHtml(row.lowLabel) + "</span><span>" + escapeHtml(row.midLabel) + "</span><span>" + escapeHtml(row.highLabel) + "</span></div>";
      elements.limitRows.appendChild(wrapper);
    });
  }

  function drawFrequencyChart() {
    const frequencyDomain = fittedDomain([state.current.traces.frequency], {
      includeValues: [50.0, 49.5, 49.2, 48.8],
      padFraction: 0.10,
      minSpan: 1.4
    });
    drawLineChart(elements.frequencyChart, {
      chartKey: "frequency",
      x: state.current.traces.t,
      datasets: [{ label: "Frequency", data: state.current.traces.frequency, color: COLORS.navy, lineWidth: 3 }],
      yDomain: frequencyDomain,
      horizontalLines: [
        { value: 50.0, color: "rgba(22,50,79,0.30)", dash: [4, 6], label: "50.0" },
        { value: 49.5, color: "rgba(217,145,42,0.85)", dash: [7, 6], label: "49.5 operational" },
        { value: 49.2, color: "rgba(196,69,54,0.70)", dash: [5, 6], label: "49.2 warning" },
        { value: 48.8, color: "rgba(123,45,38,0.85)", dash: [2, 4], label: "48.8 LFDD" }
      ],
      eventLine: state.current.config.tFault,
      cursorIndex: state.chartFocus.frequency,
      visibleUntilIndex: visibleIndex(),
      title: "Frequency (Hz)"
    });
  }

  function drawPowerChart() {
    drawLineChart(elements.powerChart, {
      chartKey: "power",
      x: state.current.traces.t,
      datasets: [
        { label: "Imbalance", data: state.current.dispatch.imbalanceGW, color: COLORS.coral, lineWidth: 2.8 },
        { label: "Disturbance", data: state.current.dispatch.disturbanceGW, color: "#2a313c", lineWidth: 2.0 },
        { label: "BESS", data: state.current.dispatch.bessGW, color: "#00a7a0", lineWidth: 2.0 },
        { label: "Governor", data: state.current.dispatch.governorGW, color: "#2f6bdb", lineWidth: 2.0 },
        { label: "Headroom", data: state.current.dispatch.headroomGW, color: "#d9912a", lineWidth: 2.0 },
        { label: "Demand Response", data: state.current.dispatch.drGW, color: "#3a9f4f", lineWidth: 2.0 },
        { label: "Import Response", data: state.current.dispatch.importAssistGW, color: "#7b4bcc", lineWidth: 2.0 },
        { label: "Demand Shed", data: state.current.dispatch.demandShedGW, color: "#7b2d26", lineWidth: 2.0 }
      ],
      yDomain: autoDomain([
        state.current.dispatch.imbalanceGW,
        state.current.dispatch.disturbanceGW,
        state.current.dispatch.bessGW,
        state.current.dispatch.governorGW,
        state.current.dispatch.headroomGW,
        state.current.dispatch.drGW,
        state.current.dispatch.importAssistGW,
        state.current.dispatch.demandShedGW
      ], 0.12),
      horizontalLines: [{ value: 0, color: "rgba(22,50,79,0.22)", dash: [4, 5], label: "balance" }],
      eventLine: state.current.config.tFault,
      cursorIndex: state.chartFocus.power,
      visibleUntilIndex: visibleIndex(),
      legendAlign: "center",
      title: "Power (GW)"
    });
  }

  function drawStateChart() {
    const canvas = elements.stateChart;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    fillBackground(ctx, width, height);

    const hasBattery = batteryIsActive(state.current.config);
    const stateLegend = legendLayout(hasBattery
      ? [
        { label: "SoC (%)" },
        { label: "Voltage (pu)" }
      ]
      : [
        { label: "Voltage (pu)" }
      ]);
    const margin = { top: 40 + stateLegend.height, right: 78, bottom: 42, left: 68 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = state.current.traces.t;
    const xMin = x[0];
    const xMax = x[x.length - 1];
    const cursorIndex = state.chartFocus.state;
    const reveal = visibleIndex();
    const socSeries = state.current.traces.soc.map(function (value) { return value * 100; });
    const voltageSeries = state.current.traces.voltage;
    const voltageDomain = fittedDomain([voltageSeries], {
      includeValues: [1.0, model.LIMITS.voltage.warning, model.LIMITS.voltage.hard],
      padFraction: 0.12,
      minSpan: 0.16
    });
    rememberChartLayout("state", margin, plotWidth, plotHeight, xMin, xMax);

    drawAxisFrame(ctx, margin, plotWidth, plotHeight);
    drawXAxis(ctx, margin, plotWidth, plotHeight, xMin, xMax);
    drawYAxis(ctx, margin, plotHeight, 0, 100);
    drawRightAxis(ctx, width, margin, plotHeight, voltageDomain[0], voltageDomain[1]);

    drawHorizontalGuide(ctx, margin, plotWidth, plotHeight, 20, 0, 100, "rgba(217,145,42,0.80)", "20% SoC", false, true);
    drawHorizontalGuide(ctx, margin, plotWidth, plotHeight, 10, 0, 100, "rgba(196,69,54,0.75)", "10% SoC", false, true);
    drawHorizontalGuide(ctx, margin, plotWidth, plotHeight, 0.95, voltageDomain[0], voltageDomain[1], "rgba(47,107,154,0.60)", "0.95 pu", true);
    drawHorizontalGuide(ctx, margin, plotWidth, plotHeight, 0.92, voltageDomain[0], voltageDomain[1], "rgba(196,69,54,0.56)", "0.92 pu", true);
    drawEventGuide(ctx, margin, plotWidth, plotHeight, state.current.config.tFault, xMin, xMax);
    if (hasBattery) {
      drawPartialLine(ctx, x, socSeries, xMin, xMax, 0, 100, margin, plotWidth, plotHeight, reveal, "#0f9e8f", 2.6);
    }
    drawPartialLine(ctx, x, voltageSeries, xMin, xMax, voltageDomain[0], voltageDomain[1], margin, plotWidth, plotHeight, reveal, "#8a5a2b", 2.2, true);
    drawCursorGuide(ctx, x, cursorIndex, xMin, xMax, margin, plotWidth, plotHeight);
    if (hasBattery) {
      drawCursorPoint(ctx, x, socSeries, cursorIndex, xMin, xMax, 0, 100, margin, plotWidth, plotHeight, "#0f9e8f");
    }
    drawCursorPoint(ctx, x, voltageSeries, cursorIndex, xMin, xMax, voltageDomain[0], voltageDomain[1], margin, plotWidth, plotHeight, "#8a5a2b", true);

    ctx.fillStyle = COLORS.navy;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.fillText("SoC axis (left)", margin.left, 18);
    ctx.textAlign = "right";
    ctx.fillText("Voltage axis (right)", width - margin.right, 18);
    ctx.textAlign = "left";
    drawLegend(ctx, hasBattery
      ? [
        { label: "SoC (%)", color: "#0f9e8f" },
        { label: "Voltage (pu)", color: "#8a5a2b" }
      ]
      : [
        { label: "Voltage (pu)", color: "#8a5a2b" }
      ], margin.left + plotWidth / 2, 30, "center");
  }

  function drawMarginCharts() {
    if (!state.current) {
      return;
    }
    const panels = securityMetricPanels(state.current);
    drawMetricPanelChart(elements.marginFrequencyChart, panels.frequency);
    drawMetricPanelChart(elements.marginRoCoFChart, panels.rocof);
    drawMetricPanelChart(elements.marginVoltageChart, panels.voltage);
    drawMetricPanelChart(elements.marginEnergyChart, panels.energy);
  }
  function drawHeatmapChart() {
    if (!state.heatmap) {
      return;
    }
    const canvas = elements.heatmapChart;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 26, right: 42, bottom: 86, left: 62 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    fillBackground(ctx, width, height);
    drawAxisFrame(ctx, margin, plotWidth, plotHeight);

    const cols = state.heatmap.resLevels.length;
    const rows = state.heatmap.lossLevels.length;
    const cellWidth = plotWidth / cols;
    const cellHeight = plotHeight / rows;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        ctx.fillStyle = heatColor(state.heatmap.grid[row][col].status);
        ctx.fillRect(margin.left + col * cellWidth, margin.top + row * cellHeight, cellWidth - 1, cellHeight - 1);
      }
    }

    const currentCol = closestIndex(state.heatmap.resLevels, state.heatmap.current.resShare);
    const currentRow = closestIndex(state.heatmap.lossLevels, state.heatmap.current.lossMW);
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = 3;
    ctx.strokeRect(margin.left + currentCol * cellWidth + 1, margin.top + currentRow * cellHeight + 1, cellWidth - 3, cellHeight - 3);

    drawYAxisLabels(ctx, state.heatmap.lossLevels.map(function (value) { return (value / 1000).toFixed(1); }), margin, plotHeight, rows);
    drawXAxisLabels(ctx, state.heatmap.resLevels.map(function (value) { return Math.round(value * 100) + "%"; }), margin, plotWidth, cols, height, height - 40);
    ctx.fillStyle = COLORS.navy;
    ctx.font = "600 13px Aptos, Trebuchet MS, sans-serif";
    ctx.fillText(state.appliedConfig.eventType === "step" || state.appliedConfig.eventType === "aug2019" ? "Disturbance size (GW)" : "Ramp magnitude (GW)", margin.left, 16);
    ctx.textAlign = "center";
    ctx.fillText("Renewable share", margin.left + plotWidth / 2, height - 14);
    ctx.textAlign = "left";
  }

  function drawSensitivityChart() {
    const canvas = elements.sensitivityChart;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    fillBackground(ctx, width, height);

    const margin = { top: 30, right: 34, bottom: 34, left: 290 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxAbs = Math.max.apply(null, state.sensitivity.map(function (item) {
      return Math.max(Math.abs(item.lowDelta), Math.abs(item.highDelta), 0.05);
    })) || 0.05;
    const zeroX = margin.left + plotWidth / 2;
    const rowHeight = plotHeight / Math.max(1, state.sensitivity.length);

    ctx.fillStyle = "rgba(22,50,79,0.05)";
    ctx.fillRect(0, margin.top, margin.left - 18, plotHeight);
    ctx.fillStyle = "rgba(196,69,54,0.05)";
    ctx.fillRect(margin.left, margin.top, plotWidth / 2, plotHeight);
    ctx.fillStyle = "rgba(31,143,87,0.05)";
    ctx.fillRect(zeroX, margin.top, plotWidth / 2, plotHeight);

    ctx.strokeStyle = "rgba(22,50,79,0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(zeroX, margin.top);
    ctx.lineTo(zeroX, height - margin.bottom);
    ctx.stroke();
    ctx.fillStyle = COLORS.navy;
    ctx.font = "700 14px Aptos, Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Nadir shift from the locked case (Hz)", zeroX, 18);
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.fillText("Lower setting tested", margin.left + plotWidth * 0.25, 18);
    ctx.fillText("Higher setting tested", margin.left + plotWidth * 0.75, 18);
    ctx.textAlign = "left";
    ctx.fillText("Positive values lift the nadir and improve resilience. Negative values deepen the nadir.", 18, height - 8);

    state.sensitivity.forEach(function (item, index) {
      const y = margin.top + index * rowHeight + rowHeight * 0.25;
      const barHeight = rowHeight * 0.5;
      const lowWidth = (Math.abs(item.lowDelta) / maxAbs) * (plotWidth / 2 - 20);
      const highWidth = (Math.abs(item.highDelta) / maxAbs) * (plotWidth / 2 - 20);

      ctx.fillStyle = "rgba(255,255,255,0.82)";
      roundedRect(ctx, 14, y - 4, margin.left - 32, barHeight + 8, 12);
      ctx.fill();
      ctx.fillStyle = COLORS.navy;
      ctx.font = "700 13px Aptos, Trebuchet MS, sans-serif";
      ctx.fillText(item.name, 28, y + barHeight * 0.78);
      ctx.fillStyle = item.lowDelta < 0 ? "rgba(196,69,54,0.82)" : "rgba(31,143,87,0.78)";
      ctx.fillRect(zeroX - lowWidth, y, lowWidth, barHeight);
      ctx.fillStyle = item.highDelta >= 0 ? "rgba(31,143,87,0.82)" : "rgba(196,69,54,0.82)";
      ctx.fillRect(zeroX, y, highWidth, barHeight);

      ctx.fillStyle = COLORS.slate;
      ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
      ctx.fillText(signed(item.lowDelta.toFixed(2)), zeroX - lowWidth - 52, y + barHeight * 0.78);
      ctx.fillText(signed(item.highDelta.toFixed(2)), zeroX + highWidth + 10, y + barHeight * 0.78);
    });
  }

  function drawLineChart(canvas, options) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    fillBackground(ctx, width, height);

    const legend = legendLayout(options.datasets);
    const margin = { top: 36 + legend.height, right: 24, bottom: 42, left: 64 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = options.x;
    const xMin = x[0];
    const xMax = x[x.length - 1];
    const yMin = options.yDomain[0];
    const yMax = options.yDomain[1];
    rememberChartLayout(options.chartKey, margin, plotWidth, plotHeight, xMin, xMax);

    ctx.fillStyle = COLORS.navy;
    ctx.font = "700 14px Aptos, Trebuchet MS, sans-serif";
    ctx.fillText(options.title, margin.left, 18);

    drawAxisFrame(ctx, margin, plotWidth, plotHeight);

    (options.horizontalLines || []).forEach(function (line) {
      const yPos = scale(line.value, yMin, yMax, margin.top + plotHeight, margin.top);
      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.setLineDash(line.dash || [5, 6]);
      ctx.beginPath();
      ctx.moveTo(margin.left, yPos);
      ctx.lineTo(margin.left + plotWidth, yPos);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = line.color;
      ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
      ctx.fillText(line.label, margin.left + 8, yPos - 6);
    });

    if (Number.isFinite(options.eventLine)) {
      const eventX = scale(options.eventLine, xMin, xMax, margin.left, margin.left + plotWidth);
      ctx.save();
      ctx.strokeStyle = "rgba(22,50,79,0.40)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(eventX, margin.top);
      ctx.lineTo(eventX, margin.top + plotHeight);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = COLORS.slate;
      ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
      ctx.fillText("event", eventX + 5, margin.top + 14);
    }

    const visibleUntilIndex = Number.isFinite(options.visibleUntilIndex) ? options.visibleUntilIndex : (x.length - 1);
    options.datasets.forEach(function (dataset) {
      ctx.save();
      ctx.strokeStyle = dataset.color;
      ctx.lineWidth = dataset.lineWidth || 2;
      ctx.beginPath();
      dataset.data.forEach(function (value, index) {
        if (index > visibleUntilIndex) {
          return;
        }
        const xPos = scale(x[index], xMin, xMax, margin.left, margin.left + plotWidth);
        const yPos = scale(value, yMin, yMax, margin.top + plotHeight, margin.top);
        if (index === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      });
      ctx.stroke();
      ctx.restore();
    });

    if (Number.isFinite(options.cursorIndex)) {
      const cursorX = scale(x[options.cursorIndex], xMin, xMax, margin.left, margin.left + plotWidth);
      ctx.save();
      ctx.strokeStyle = "rgba(22,50,79,0.36)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, margin.top);
      ctx.lineTo(cursorX, margin.top + plotHeight);
      ctx.stroke();
      ctx.restore();

      options.datasets.forEach(function (dataset) {
        const yValue = dataset.data[options.cursorIndex];
        const yPos = scale(yValue, yMin, yMax, margin.top + plotHeight, margin.top);
        ctx.beginPath();
        ctx.fillStyle = dataset.color;
        ctx.arc(cursorX, yPos, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (Number.isFinite(options.cursorXValue)) {
      const cursorX = scale(options.cursorXValue, xMin, xMax, margin.left, margin.left + plotWidth);
      ctx.save();
      ctx.strokeStyle = "rgba(22,50,79,0.36)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, margin.top);
      ctx.lineTo(cursorX, margin.top + plotHeight);
      ctx.stroke();
      ctx.restore();
    }

    drawXAxis(ctx, margin, plotWidth, plotHeight, xMin, xMax);
    drawYAxis(ctx, margin, plotHeight, yMin, yMax);
    drawLegend(ctx, options.datasets, options.legendAlign === "center" ? (margin.left + plotWidth / 2) : (width - margin.right - 12), 30, options.legendAlign || "right");
  }

  function drawMetricPanelChart(canvas, options) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    fillBackground(ctx, width, height);

    const margin = { top: 28, right: 18, bottom: 38, left: 58 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xMin = options.x[0];
    const xMax = options.x[options.x.length - 1];
    const yMin = options.yDomain[0];
    const yMax = options.yDomain[1];

    (options.bands || []).forEach(function (band) {
      const top = scale(band.to, yMin, yMax, margin.top + plotHeight, margin.top);
      const bottom = scale(band.from, yMin, yMax, margin.top + plotHeight, margin.top);
      ctx.fillStyle = band.color;
      ctx.fillRect(margin.left, top, plotWidth, bottom - top);
    });

    drawAxisFrame(ctx, margin, plotWidth, plotHeight);
    drawXAxis(ctx, margin, plotWidth, plotHeight, xMin, xMax);
    drawYAxis(ctx, margin, plotHeight, yMin, yMax);

    ctx.fillStyle = COLORS.navy;
    ctx.font = "700 13px Aptos, Trebuchet MS, sans-serif";
    ctx.fillText(options.title, margin.left, 16);

    (options.horizontalLines || []).forEach(function (line) {
      const yPos = scale(line.value, yMin, yMax, margin.top + plotHeight, margin.top);
      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.setLineDash(line.dash || [5, 6]);
      ctx.beginPath();
      ctx.moveTo(margin.left, yPos);
      ctx.lineTo(margin.left + plotWidth, yPos);
      ctx.stroke();
      ctx.restore();
    });

    if (Number.isFinite(options.eventLine)) {
      drawEventGuide(ctx, margin, plotWidth, plotHeight, options.eventLine, xMin, xMax);
    }

    if (!options.hideTrace) {
      drawPartialLine(ctx, options.x, options.y, xMin, xMax, yMin, yMax, margin, plotWidth, plotHeight, options.visibleUntilIndex, options.color, 2.6);
    }
    drawCursorGuide(ctx, options.x, options.cursorIndex, xMin, xMax, margin, plotWidth, plotHeight);
    if (!options.hideTrace) {
      drawCursorPoint(ctx, options.x, options.y, options.cursorIndex, xMin, xMax, yMin, yMax, margin, plotWidth, plotHeight, options.color);
    }
  }

  function legendLayout(datasets) {
    const columns = datasets.length > 5 ? 2 : 1;
    const rows = Math.ceil(datasets.length / columns);
    return {
      columns: columns,
      rows: rows,
      columnWidth: 184,
      rowHeight: 22,
      width: columns * 184,
      height: rows * 22
    };
  }

  function drawLegend(ctx, datasets, x, y, align) {
    const layout = legendLayout(datasets);
    const totalWidth = layout.width;
    const anchor = align || "right";
    const startX = anchor === "center" ? x - (totalWidth / 2) : x - totalWidth;
    datasets.forEach(function (dataset, index) {
      const col = layout.columns === 1 ? 0 : Math.floor(index / layout.rows);
      const row = layout.columns === 1 ? index : index % layout.rows;
      const top = y + row * layout.rowHeight;
      const left = startX + col * layout.columnWidth;
      ctx.fillStyle = dataset.color;
      ctx.fillRect(left, top - 8, 20, 5);
      ctx.fillStyle = COLORS.slate;
      ctx.font = "600 14px Aptos, Trebuchet MS, sans-serif";
      ctx.fillText(dataset.label, left + 28, top);
    });
  }

  function drawAxisFrame(ctx, margin, plotWidth, plotHeight) {
    ctx.strokeStyle = "rgba(22,50,79,0.12)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function rememberChartLayout(chartKey, margin, plotWidth, plotHeight, xMin, xMax) {
    if (!chartKey) {
      return;
    }
    state.chartLayouts[chartKey] = {
      left: margin.left,
      right: margin.left + plotWidth,
      top: margin.top,
      bottom: margin.top + plotHeight,
      xMin: xMin,
      xMax: xMax
    };
  }

  function drawXAxis(ctx, margin, plotWidth, plotHeight, min, max) {
    const ticks = 5;
    const span = max - min;
    const digits = span <= 6 ? 1 : 0;
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= ticks; i += 1) {
      const value = min + ((max - min) * i) / ticks;
      const x = margin.left + (plotWidth * i) / ticks;
      ctx.fillText(value.toFixed(digits) + " s", x, margin.top + plotHeight + 18);
    }
    ctx.textAlign = "left";
  }

  function drawYAxis(ctx, margin, plotHeight, min, max) {
    const ticks = 5;
    const digits = axisDigits(min, max, false);
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= ticks; i += 1) {
      const value = min + ((max - min) * i) / ticks;
      const y = margin.top + plotHeight - (plotHeight * i) / ticks;
      ctx.fillText(value.toFixed(digits), margin.left - 10, y + 4);
    }
    ctx.textAlign = "left";
  }

  function drawXAxisLabels(ctx, labels, margin, plotWidth, count, height, yPosition) {
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    labels.forEach(function (label, index) {
      const x = margin.left + (index + 0.5) * (plotWidth / count);
      ctx.fillText(label, x, Number.isFinite(yPosition) ? yPosition : (height - 14));
    });
    ctx.textAlign = "left";
  }

  function drawYAxisLabels(ctx, labels, margin, plotHeight, count) {
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.textAlign = "right";
    labels.forEach(function (label, index) {
      const y = margin.top + (index + 0.6) * (plotHeight / count);
      ctx.fillText(label, margin.left - 10, y);
    });
    ctx.textAlign = "left";
  }

  function fillBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(255,255,255,0.94)");
    gradient.addColorStop(1, "rgba(239,245,246,0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRightAxis(ctx, width, margin, plotHeight, min, max) {
    const ticks = 5;
    const digits = axisDigits(min, max, true);
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    for (let i = 0; i <= ticks; i += 1) {
      const value = min + ((max - min) * i) / ticks;
      const y = margin.top + plotHeight - (plotHeight * i) / ticks;
      ctx.fillText(value.toFixed(digits), width - margin.right + 8, y + 4);
    }
  }

  function drawHorizontalGuide(ctx, margin, plotWidth, plotHeight, value, min, max, color, label, rightAxis, placeBelow) {
    const yPos = scale(value, min, max, margin.top + plotHeight, margin.top);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(margin.left, yPos);
    ctx.lineTo(margin.left + plotWidth, yPos);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color;
    ctx.font = "600 12px Aptos, Trebuchet MS, sans-serif";
    ctx.fillText(label, rightAxis ? margin.left + plotWidth - 80 : margin.left + 8, yPos + (placeBelow ? 14 : -6));
  }

  function drawEventGuide(ctx, margin, plotWidth, plotHeight, eventTime, xMin, xMax) {
    const eventX = scale(eventTime, xMin, xMax, margin.left, margin.left + plotWidth);
    ctx.save();
    ctx.strokeStyle = "rgba(22,50,79,0.40)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(eventX, margin.top);
    ctx.lineTo(eventX, margin.top + plotHeight);
    ctx.stroke();
    ctx.restore();
  }

  function drawPartialLine(ctx, x, series, xMin, xMax, yMin, yMax, margin, plotWidth, plotHeight, reveal, color, lineWidth) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let index = 0; index < series.length && index <= reveal; index += 1) {
      const xPos = scale(x[index], xMin, xMax, margin.left, margin.left + plotWidth);
      const yPos = scale(series[index], yMin, yMax, margin.top + plotHeight, margin.top);
      if (index === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCursorGuide(ctx, x, cursorIndex, xMin, xMax, margin, plotWidth, plotHeight) {
    const cursorX = scale(x[cursorIndex], xMin, xMax, margin.left, margin.left + plotWidth);
    ctx.save();
    ctx.strokeStyle = "rgba(22,50,79,0.36)";
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(cursorX, margin.top);
    ctx.lineTo(cursorX, margin.top + plotHeight);
    ctx.stroke();
    ctx.restore();
  }

  function drawCursorPoint(ctx, x, series, cursorIndex, xMin, xMax, yMin, yMax, margin, plotWidth, plotHeight, color) {
    const cursorX = scale(x[cursorIndex], xMin, xMax, margin.left, margin.left + plotWidth);
    const yPos = scale(series[cursorIndex], yMin, yMax, margin.top + plotHeight, margin.top);
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(cursorX, yPos, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEmptyCanvas(canvas, message) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillBackground(ctx, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.slate;
    ctx.font = "600 18px Aptos, Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "left";
  }
  function pointAt(current, index) {
    const i = clamp(index, 0, current.traces.t.length - 1);
    return {
      time: current.traces.t[i],
      weather: current.profile.weather.label,
      wind: current.dispatch.windGW[i],
      solar: current.dispatch.solarGW[i],
      res: current.dispatch.resGW[i],
      demand: current.dispatch.demandGW[i],
      disturbance: current.dispatch.disturbanceGW[i],
      imbalance: current.dispatch.imbalanceGW[i],
      generation: current.dispatch.netGenerationGW[i],
      frequency: current.traces.frequency[i],
      rocof: current.traces.rocof[i],
      voltage: current.traces.voltage[i],
      soc: current.traces.soc[i],
      importsTotal: current.dispatch.importsTotalGW[i],
      importAssist: current.dispatch.importAssistGW[i],
      demandShed: current.dispatch.demandShedGW[i],
      eventLabel: current.summary.eventLabel
    };
  }

  function describeTimelinePhase(current, time) {
    const faultTime = current.config.tFault;
    const nadirTime = current.traces.t[current.milestones.nadirIndex];
    const recoveryTime = current.milestones.recoveryIndex < current.traces.t.length - 1
      ? current.traces.t[current.milestones.recoveryIndex]
      : null;
    if (time < faultTime) {
      return "Pre-fault operating point.";
    }
    if (time < nadirTime) {
      return "Initial arrest window: imbalance drives RoCoF and the nadir is still developing.";
    }
    if (recoveryTime !== null && time < recoveryTime) {
      return "Post-nadir recovery: services and damping are returning frequency toward nominal.";
    }
    if (recoveryTime !== null) {
      return "Recovered outcome: the trace has returned to the frequency band after the event.";
    }
    return "No recovery inside the simulated window: the disturbance remains unresolved by the end of the run.";
  }

  function securityMetricPanels(current) {
    const hasBattery = batteryIsActive(current.config);
    return {
      frequency: {
        title: "Frequency (Hz)",
        x: current.traces.t,
        y: current.traces.frequency,
        yDomain: fittedDomain([current.traces.frequency], {
          includeValues: [48.4, model.LIMITS.frequency.lfdd, model.LIMITS.frequency.warningLow, model.LIMITS.frequency.operationalLow, 50.0],
          padFraction: 0.08,
          minSpan: 1.6
        }),
        color: COLORS.navy,
        eventLine: current.config.tFault,
        cursorIndex: state.chartFocus.frequency,
        visibleUntilIndex: visibleIndex(),
        bands: [
          { from: 48.4, to: model.LIMITS.frequency.lfdd, color: "rgba(123,45,38,0.18)" },
          { from: model.LIMITS.frequency.lfdd, to: model.LIMITS.frequency.warningLow, color: "rgba(196,69,54,0.12)" },
          { from: model.LIMITS.frequency.warningLow, to: model.LIMITS.frequency.operationalLow, color: "rgba(217,145,42,0.12)" },
          { from: model.LIMITS.frequency.operationalLow, to: 50.3, color: "rgba(31,143,87,0.10)" }
        ],
        horizontalLines: [
          { value: model.LIMITS.frequency.operationalLow, color: "rgba(217,145,42,0.82)", dash: [6, 5], label: "Stressed 49.5" },
          { value: model.LIMITS.frequency.warningLow, color: "rgba(196,69,54,0.78)", dash: [5, 5], label: "Emergency 49.2" },
          { value: model.LIMITS.frequency.lfdd, color: "rgba(123,45,38,0.85)", dash: [4, 4], label: "Blackout 48.8" }
        ]
      },
      rocof: {
        title: "|RoCoF| (Hz/s)",
        x: current.traces.t,
        y: current.traces.rocof.map(function (value) { return Math.abs(value); }),
        yDomain: fittedDomain([current.traces.rocof.map(function (value) { return Math.abs(value); })], {
          includeValues: [0, model.LIMITS.rocof.enhanced, model.LIMITS.rocof.operational, 0.75, model.LIMITS.rocof.trip],
          padFraction: 0.10,
          minSpan: 1.05
        }),
        color: COLORS.coral,
        eventLine: current.config.tFault,
        cursorIndex: state.chartFocus.frequency,
        visibleUntilIndex: visibleIndex(),
        bands: [
          { from: model.LIMITS.rocof.trip, to: 1.2, color: "rgba(123,45,38,0.18)" },
          { from: 0.75, to: model.LIMITS.rocof.trip, color: "rgba(196,69,54,0.12)" },
          { from: model.LIMITS.rocof.operational, to: 0.75, color: "rgba(217,145,42,0.12)" },
          { from: 0, to: model.LIMITS.rocof.operational, color: "rgba(31,143,87,0.10)" }
        ],
        horizontalLines: [
          { value: model.LIMITS.rocof.enhanced, color: "rgba(93,114,139,0.70)", dash: [3, 4], label: "Planning 0.25" },
          { value: model.LIMITS.rocof.operational, color: "rgba(217,145,42,0.82)", dash: [6, 5], label: "Stressed 0.50" },
          { value: 0.75, color: "rgba(196,69,54,0.78)", dash: [5, 5], label: "Emergency 0.75" },
          { value: model.LIMITS.rocof.trip, color: "rgba(123,45,38,0.85)", dash: [4, 4], label: "Blackout 1.00" }
        ]
      },
      voltage: {
        title: "Voltage Proxy (pu)",
        x: current.traces.t,
        y: current.traces.voltage,
        yDomain: fittedDomain([current.traces.voltage], {
          includeValues: [0.88, model.LIMITS.voltage.hard, model.LIMITS.voltage.warning, 1.0],
          padFraction: 0.10,
          minSpan: 0.22
        }),
        color: COLORS.sand,
        eventLine: current.config.tFault,
        cursorIndex: state.chartFocus.state,
        visibleUntilIndex: visibleIndex(),
        bands: [
          { from: 0.80, to: model.LIMITS.voltage.hard, color: "rgba(123,45,38,0.18)" },
          { from: model.LIMITS.voltage.hard, to: model.LIMITS.voltage.warning, color: "rgba(196,69,54,0.12)" },
          { from: model.LIMITS.voltage.warning, to: 0.99, color: "rgba(217,145,42,0.12)" },
          { from: 0.99, to: 1.08, color: "rgba(31,143,87,0.10)" }
        ],
        horizontalLines: [
          { value: model.LIMITS.voltage.hard, color: "rgba(196,69,54,0.82)", dash: [4, 4], label: "Hard floor 0.92" },
          { value: model.LIMITS.voltage.warning, color: "rgba(217,145,42,0.82)", dash: [6, 5], label: "Weak region 0.95" }
        ]
      },
      energy: {
        title: "State of charge (%)",
        x: current.traces.t,
        y: hasBattery
          ? current.traces.soc.map(function (value) { return value * 100; })
          : current.traces.soc.map(function () { return 100; }),
        yDomain: fittedDomain([hasBattery
          ? current.traces.soc.map(function (value) { return value * 100; })
          : current.traces.soc.map(function () { return 100; })], {
          includeValues: [5, model.LIMITS.soc.minimum * 100, model.LIMITS.soc.healthy * 100, 35],
          padFraction: 0.10,
          minSpan: 35
        }),
        color: COLORS.teal,
        eventLine: current.config.tFault,
        cursorIndex: state.chartFocus.state,
        visibleUntilIndex: visibleIndex(),
        hideTrace: !hasBattery,
        bands: hasBattery
          ? [
            { from: 0, to: 5, color: "rgba(123,45,38,0.18)" },
            { from: 5, to: model.LIMITS.soc.minimum * 100, color: "rgba(196,69,54,0.12)" },
            { from: model.LIMITS.soc.minimum * 100, to: model.LIMITS.soc.healthy * 100, color: "rgba(217,145,42,0.12)" },
            { from: model.LIMITS.soc.healthy * 100, to: 100, color: "rgba(31,143,87,0.10)" }
          ]
          : [
            { from: 0, to: 5, color: "rgba(123,45,38,0.18)" },
            { from: 5, to: model.LIMITS.soc.minimum * 100, color: "rgba(196,69,54,0.12)" },
            { from: model.LIMITS.soc.minimum * 100, to: model.LIMITS.soc.healthy * 100, color: "rgba(217,145,42,0.12)" },
            { from: model.LIMITS.soc.healthy * 100, to: 100, color: "rgba(31,143,87,0.10)" }
          ],
        horizontalLines: hasBattery
          ? [
            { value: model.LIMITS.soc.minimum * 100, color: "rgba(196,69,54,0.82)", dash: [4, 4], label: "Reserve floor 10%" },
            { value: model.LIMITS.soc.healthy * 100, color: "rgba(217,145,42,0.82)", dash: [6, 5], label: "Healthy 20%" }
          ]
          : [
            { value: model.LIMITS.soc.minimum * 100, color: "rgba(196,69,54,0.82)", dash: [4, 4], label: "Reserve floor 10%" },
            { value: model.LIMITS.soc.healthy * 100, color: "rgba(217,145,42,0.82)", dash: [6, 5], label: "Healthy 20%" }
          ]
      }
    };
  }

  function normalizeAscendingBuffer(value, hardFloor, healthyBand) {
    return (value - hardFloor) / Math.max(healthyBand - hardFloor, 1e-6);
  }

  function normalizeDescendingBuffer(value, hardCeiling, healthyBand) {
    return (hardCeiling - value) / Math.max(hardCeiling - healthyBand, 1e-6);
  }

  function limitSpec(options) {
    const normalized = clamp(((options.value - options.min) / (options.max - options.min)) * 100, 0, 100);
    const captions = options.captions || {};
    let caption = captions.healthy || "Healthy operating region";
    if (options.lowerIsWorse) {
      if (options.value >= options.caution) {
        caption = captions.critical || "Operational failure region";
      } else if (options.value >= options.target) {
        caption = captions.marginal || "Marginal region";
      }
    } else {
      if (options.value <= options.caution) {
        caption = captions.critical || "Operational failure region";
      } else if (options.value <= options.target) {
        caption = captions.marginal || "Marginal region";
      }
    }
    const targetN = clamp(((options.target - options.min) / (options.max - options.min)) * 100, 0, 100);
    const cautionN = clamp(((options.caution - options.min) / (options.max - options.min)) * 100, 0, 100);
    const band = options.lowerIsWorse
      ? "linear-gradient(90deg, rgba(31,143,87,0.24) 0%, rgba(31,143,87,0.24) " + targetN + "%, rgba(217,145,42,0.24) " + targetN + "%, rgba(217,145,42,0.24) " + cautionN + "%, rgba(196,69,54,0.24) " + cautionN + "%, rgba(123,45,38,0.24) 100%)"
      : "linear-gradient(90deg, rgba(123,45,38,0.24) 0%, rgba(123,45,38,0.24) " + cautionN + "%, rgba(196,69,54,0.24) " + cautionN + "%, rgba(217,145,42,0.24) " + targetN + "%, rgba(31,143,87,0.24) 100%)";
    return {
      title: options.title,
      valueLabel: formatNumber(options.value, options.unit === "%" ? 0 : 2) + " " + options.unit,
      width: normalized,
      band: band,
      caption: caption,
      lowLabel: options.labels.low,
      midLabel: options.labels.mid,
      highLabel: options.labels.high,
      thresholds: (options.thresholds || []).map(function (threshold, index) {
        return {
          label: threshold.label,
          position: clamp(((threshold.value - options.min) / (options.max - options.min)) * 100, 0, 100),
          row: index % 2
        };
      })
    };
  }

  function closestVisibleIndex(targetTime) {
    const limit = visibleIndex();
    let best = 0;
    let distance = Infinity;
    for (let index = 0; index <= limit; index += 1) {
      const delta = Math.abs(state.current.traces.t[index] - targetTime);
      if (delta < distance) {
        distance = delta;
        best = index;
      }
    }
    return best;
  }

  function handleChartHover(chartKey, canvas, event) {
    if (!state.current) {
      return;
    }
    if (state.playing) {
      return;
    }
    const layout = state.chartLayouts[chartKey];
    if (!layout) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const plotX = clamp(canvasX, layout.left, layout.right);
    const time = scale(plotX, layout.left, layout.right, layout.xMin, layout.xMax);
    state.activeChart = chartKey;
    state.chartFocus[chartKey] = closestVisibleIndex(time);
    renderMilestoneButtons();
    renderActiveChart();
    renderFocus();
  }

  function startPlayback(startIndex) {
    if (!state.current) {
      return;
    }
    stopPlay();
    state.playing = true;
    elements.playButton.textContent = "Pause";
    renderPlayState("running");

    const total = state.current.traces.t.length - 1;
    const fromIndex = clamp(startIndex, 0, total);
    const playbackMs = Math.max(7000, Math.min(14000, state.current.config.duration * 40));
    const start = performance.now();

    function frame(now) {
      if (!state.playing) {
        return;
      }
      const ratio = clamp((now - start) / playbackMs, 0, 1);
      const index = Math.round(fromIndex + (total - fromIndex) * ratio);
      state.revealIndex = index;
      syncAllChartFocus(index);
      if (ratio >= 1) {
        state.revealIndex = total;
        stopPlay();
        return;
      }
      state.playHandle = requestAnimationFrame(frame);
    }

    state.revealIndex = fromIndex;
    syncAllChartFocus(fromIndex);
    state.playHandle = requestAnimationFrame(frame);
  }

  function stopPlay() {
    state.playing = false;
    if (state.playHandle) {
      cancelAnimationFrame(state.playHandle);
      state.playHandle = null;
    }
    updateRunButtonState(false);
  }

  function syncScrubber() {
    if (!state.current) {
      elements.timelineScrubber.value = "0";
      return;
    }
    elements.timelineScrubber.max = String(state.current.traces.t.length - 1);
    elements.timelineScrubber.value = String(activeIndex());
  }

  function setControlAvailability(isEnabled) {
    EDITABLE_CONTROL_IDS.forEach(function (id) {
      if (elements[id]) {
        elements[id].disabled = !isEnabled;
      }
    });
    updateConditionalControls();
  }

  function enableInputEditing() {
    stopPlay();
    state.editingInputs = true;
    setControlAvailability(true);
    state.pendingDirty = false;
    renderControlSummaries();
    updateRunButtonState(false);
    elements.scenarioSubtitle.textContent = "Inputs are unlocked. Adjust the operating point, services, or protections, then apply and lock the new case before running it.";
  }

  function markPending(isDirty) {
    state.pendingDirty = state.editingInputs && Boolean(isDirty);
    updateRunButtonState(false);
  }

  function updateRunButtonState(isBusy) {
    const milestoneButtons = [elements.milestonePrimary, elements.milestoneSecondary, elements.milestoneTertiary];
    const showPlaybackTools = !state.editingInputs && Boolean(state.current) && !isBusy;
    if (isBusy) {
      elements.setInputsButton.disabled = true;
      elements.playButton.disabled = true;
      elements.resetPlayback.disabled = true;
      elements.timelineScrubber.disabled = true;
      milestoneButtons.forEach(function (button) {
        button.disabled = true;
      });
      elements.setInputsButton.textContent = "Working...";
      renderPlayState("working");
      return;
    }
    elements.setInputsButton.disabled = false;
    elements.playButton.disabled = state.editingInputs;
    elements.resetPlayback.disabled = state.editingInputs || !state.current;
    elements.timelineScrubber.disabled = state.editingInputs || !state.current;
    milestoneButtons.forEach(function (button) {
      button.disabled = state.editingInputs || !state.current;
    });
    elements.setInputsButton.textContent = state.editingInputs ? "Apply and Lock Inputs" : "Change Inputs";
    elements.setInputsButton.classList.toggle("is-dirty", state.editingInputs);
    elements.setInputsButton.classList.toggle("is-change-mode", !state.editingInputs);
    elements.playButton.textContent = playButtonLabel();
    elements.playButton.classList.remove("action-run", "action-pause", "action-replay");
    elements.resetPlayback.classList.toggle("is-hidden", !showPlaybackTools);
    elements.playerTrack.classList.toggle("is-hidden", !showPlaybackTools);
    milestoneButtons.forEach(function (button) {
      button.classList.toggle("is-hidden", !showPlaybackTools);
    });
    if (state.playing) {
      elements.playButton.classList.add("action-pause");
    } else if (!state.current) {
      elements.playButton.classList.add("action-run");
    } else {
      elements.playButton.classList.add("action-replay");
    }
    elements.resetPlayback.classList.add("action-reset");
    if (state.playing) {
      renderPlayState("running");
    } else if (state.editingInputs) {
      renderPlayState("editing");
    } else if (!state.current) {
      renderPlayState("locked");
    } else if (Number.isFinite(state.revealIndex) && state.revealIndex >= state.current.traces.t.length - 1) {
      renderPlayState("finished");
    } else {
      renderPlayState("paused");
    }
  }

  function refreshScenarioMetadata(config) {
    if (config.presetScenarioId === "event2019") {
      return;
    }
    const weather = model.WEATHER_LIBRARY[config.weather] || model.WEATHER_LIBRARY.windy;
    const domesticGenerationGW = Math.max(config.demandGW - (config.importsMW / 1000), 0);
    config.name = "Custom Operating Point";
    config.narrative = weather.label + " conditions with " + Math.round(config.resShare * 100)
      + "% renewables, " + formatNumber(domesticGenerationGW, 1) + " GW domestic generation, "
      + Math.round(config.demandGW) + " GW demand, "
      + Math.round(config.importsMW) + " MW imports, and "
      + formatNumber(config.systemStrength, 2) + " pu system strength.";
  }

  function lockPendingInputs() {
    stopPlay();
    pullControlsIntoPending();
    refreshScenarioMetadata(state.pendingConfig);
    state.appliedConfig = model.clone(state.pendingConfig);
    state.editingInputs = false;
    state.pendingDirty = false;
    state.current = null;
    state.scan = null;
    state.heatmap = null;
    state.sensitivity = [];
    state.insights = [];
    state.revealIndex = null;
    state.chartFocus = { frequency: 0, power: 0, state: 0 };
    setControlAvailability(false);
    updateRunButtonState(false);
    renderControlSummaries();
    renderPrimary();
    renderStatusGuide();
    renderMixSummary();
    renderCascadeSummary();
    renderRelationships();
    elements.scenarioTitle.textContent = state.appliedConfig.name || "Locked Operating Point";
    elements.scenarioSubtitle.textContent = state.appliedConfig.narrative + " Inputs are now locked. Press Run Scenario to trace the disturbance from the pre-fault condition.";
  }

  function playButtonLabel() {
    if (state.playing) {
      return "Pause";
    }
    if (!state.current) {
      return "Run Scenario";
    }
    const finalIndex = state.current.traces.t.length - 1;
    if (Number.isFinite(state.revealIndex) && state.revealIndex >= finalIndex) {
      return "Replay Scenario";
    }
    return "Resume";
  }

  function renderPlayState(mode) {
    const labels = {
      locked: "Locked",
      editing: "Editing inputs",
      working: "Updating",
      running: "Running",
      paused: "Paused",
      finished: "Finished"
    };
    elements.playStatePill.textContent = labels[mode] || "Locked";
    elements.playStatePill.className = "play-state state-" + mode;
  }

  function playbackStartIndex() {
    if (!state.current) {
      return 0;
    }
    const finalIndex = state.current.traces.t.length - 1;
    if (!Number.isFinite(state.revealIndex) || state.revealIndex >= finalIndex) {
      return state.current.milestones.prefaultIndex;
    }
    return clamp(activeIndex(), state.current.milestones.prefaultIndex, finalIndex);
  }

  function activeIndex() {
    return state.chartFocus[state.activeChart] || 0;
  }

  function syncAllChartFocus(index) {
    if (!state.current) {
      return;
    }
    const clamped = clamp(index, 0, state.current.traces.t.length - 1);
    state.chartFocus.frequency = clamped;
    state.chartFocus.power = clamped;
    state.chartFocus.state = clamped;
    renderActiveChart();
    renderFocus();
  }

  function visibleIndex() {
    if (!state.current) {
      return 0;
    }
    return Number.isFinite(state.revealIndex) ? state.revealIndex : (state.current.traces.t.length - 1);
  }

  function renderActiveChart() {
    drawFrequencyChart();
    drawPowerChart();
    drawStateChart();
    drawMarginCharts();
    syncScrubber();
  }

  function renderMilestoneButtons() {
    if (!state.current) {
      return;
    }
    const sets = {
      frequency: [
        { label: "Fault", index: state.current.milestones.faultIndex },
        { label: "Max RoCoF", index: state.current.milestones.maxRoCoFIndex },
        { label: "Nadir", index: state.current.milestones.nadirIndex }
      ],
      power: [
        { label: "Fault", index: state.current.milestones.faultIndex },
        { label: "Max deficit", index: state.current.milestones.maxDeficitIndex },
        { label: "Max service", index: state.current.milestones.maxServiceIndex }
      ],
      state: [
        { label: "Fault", index: state.current.milestones.faultIndex },
        { label: "Min SoC", index: state.current.milestones.minSocIndex },
        { label: "Min voltage", index: state.current.milestones.minVoltageIndex }
      ]
    };
    const items = sets[state.activeChart];
    [elements.milestonePrimary, elements.milestoneSecondary, elements.milestoneTertiary].forEach(function (button, index) {
      button.textContent = items[index].label;
      button.dataset.index = String(items[index].index);
    });
  }

  function jumpToActiveMilestone(buttonIndex) {
    const buttons = [elements.milestonePrimary, elements.milestoneSecondary, elements.milestoneTertiary];
    const target = Number(buttons[buttonIndex].dataset.index || 0);
    state.chartFocus[state.activeChart] = target;
    renderActiveChart();
    renderFocus();
  }

  function renderFocusMetrics(point) {
    const stateIndex = state.chartFocus.state;
    const powerIndex = state.chartFocus.power;
    const metricSets = {
      frequency: [
        { label: "To 49.5", value: signed((point.frequency - model.LIMITS.frequency.operationalLow).toFixed(2)) + " Hz" },
        { label: "To 48.8", value: signed((point.frequency - model.LIMITS.frequency.lfdd).toFixed(2)) + " Hz" },
        { label: "Imbalance", value: signed(point.imbalance.toFixed(2)) + " GW" },
        { label: "Demand shed", value: formatNumber(point.demandShed, 2) + " GW" }
      ],
      power: [
        { label: "BESS", value: formatNumber(state.current.dispatch.bessGW[powerIndex], 2) + " GW" },
        { label: "Governor", value: formatNumber(state.current.dispatch.governorGW[powerIndex], 2) + " GW" },
        { label: "Headroom", value: formatNumber(state.current.dispatch.headroomGW[powerIndex], 2) + " GW" },
        { label: "Demand Response", value: formatNumber(state.current.dispatch.drGW[powerIndex], 2) + " GW" },
        { label: "Import Response", value: formatNumber(state.current.dispatch.importAssistGW[powerIndex], 2) + " GW" },
        { label: "Demand Shed", value: formatNumber(point.demandShed, 2) + " GW" }
      ],
      state: [
        { label: "Above 10%", value: signed(((point.soc * 100) - (model.LIMITS.soc.minimum * 100)).toFixed(0)) + " pts" },
        { label: "Above 0.95", value: signed((point.voltage - model.LIMITS.voltage.warning).toFixed(3)) + " pu" },
        { label: "BESS dispatch", value: formatNumber(state.current.dispatch.bessGW[stateIndex], 2) + " GW" },
        { label: "Demand shed", value: formatNumber(point.demandShed, 2) + " GW" }
      ]
    };
    elements.focusMetrics.innerHTML = "";
    metricSets[state.activeChart].forEach(function (metric) {
      const chip = document.createElement("span");
      chip.className = "focus-chip";
      chip.innerHTML = "<strong>" + escapeHtml(metric.label) + "</strong><span>" + escapeHtml(metric.value) + "</span>";
      elements.focusMetrics.appendChild(chip);
    });
  }

  function renderEmptyDashboard() {
    state.chartLayouts = {};
    elements.statusPill.textContent = "READY";
    elements.statusPill.style.background = "linear-gradient(135deg, #5d728b, #99a9bb)";
    renderStatusDefinition(null);
    elements.kpiGrid.innerHTML = "";
    elements.limitRows.innerHTML = "";
    elements.statusGuide.innerHTML = "";
    elements.focusReadout.textContent = "Focus: locked inputs ready to run";
    elements.focusMetrics.innerHTML = "";
    elements.causalDiagram.innerHTML = "";
    elements.insightList.innerHTML = "";
    renderRelationships();
    elements.mixSummary.innerHTML = "";
    elements.cascadeSummary.innerHTML = "";
    elements.milestonePrimary.textContent = "Fault";
    elements.milestoneSecondary.textContent = "Max RoCoF";
    elements.milestoneTertiary.textContent = "Nadir";
    elements.timelineScrubber.value = "0";
    [elements.frequencyChart, elements.powerChart, elements.stateChart, elements.marginFrequencyChart, elements.marginRoCoFChart, elements.marginVoltageChart, elements.marginEnergyChart, elements.heatmapChart, elements.sensitivityChart].forEach(function (canvas) {
      drawEmptyCanvas(canvas, "Inputs locked. Press Run Scenario.");
    });
  }

  function autoDomain(seriesList, padFraction) {
    let min = Infinity;
    let max = -Infinity;
    seriesList.forEach(function (series) {
      series.forEach(function (value) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      });
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [-1, 1];
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    const pad = span * (padFraction || 0.1);
    return [min - pad, max + pad];
  }

  function fittedDomain(seriesList, options) {
    const domain = autoDomain(seriesList, options && Number.isFinite(options.padFraction) ? options.padFraction : 0.1);
    const includeValues = (options && options.includeValues) || [];
    includeValues.forEach(function (value) {
      domain[0] = Math.min(domain[0], value);
      domain[1] = Math.max(domain[1], value);
    });
    const minSpan = options && Number.isFinite(options.minSpan) ? options.minSpan : 0;
    if ((domain[1] - domain[0]) < minSpan) {
      const center = (domain[0] + domain[1]) / 2;
      domain[0] = center - minSpan / 2;
      domain[1] = center + minSpan / 2;
    }
    return domain;
  }

  function axisDigits(min, max, preferFine) {
    const span = Math.abs(max - min);
    if (preferFine || span <= 0.3) {
      return 2;
    }
    if (span <= 2) {
      return 2;
    }
    return 1;
  }

  function heatColor(status) {
    switch (status) {
      case "SECURE":
        return "rgba(31,143,87,0.82)";
      case "STRESSED":
        return "rgba(217,145,42,0.82)";
      case "EMERGENCY":
        return "rgba(196,69,54,0.82)";
      default:
        return "rgba(123,45,38,0.90)";
      }
  }

  function insightToneLabel(tone) {
    switch (tone) {
      case "good":
        return "Good";
      case "warning":
        return "Warning";
      case "critical":
        return "Critical";
      default:
        return "Context";
    }
  }

  function yieldFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { resolve(); });
    });
  }

  function signed(value) {
    return Number(value) > 0 ? "+" + value : String(value);
  }

  function formatNumber(value, digits) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    return Number(value).toFixed(digits);
  }

  function tint(hex, amount) {
    const rgb = hex.replace("#", "");
    const value = parseInt(rgb, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    const nr = Math.round(r + (255 - r) * amount);
    const ng = Math.round(g + (255 - g) * amount);
    const nb = Math.round(b + (255 - b) * amount);
    return "rgb(" + nr + "," + ng + "," + nb + ")";
  }

  function scale(value, domainMin, domainMax, rangeMin, rangeMax) {
    if (domainMax === domainMin) {
      return rangeMin;
    }
    const ratio = (value - domainMin) / (domainMax - domainMin);
    return rangeMin + ratio * (rangeMax - rangeMin);
  }

  function closestIndex(values, target) {
    let best = 0;
    let bestDistance = Infinity;
    values.forEach(function (value, index) {
      const distance = Math.abs(value - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}());
