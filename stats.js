const API_BASE = "http://127.0.0.1:8000/api/v1";
const CHECK_INTERVAL_MINUTES = 5;
const HOUR = 3600 * 1000;

const state = {
  service: null,
  days: 7,
  group: "",
  layers: { alerts: false, outages: false, incidents: false },
  data: null,
};

const BUCKET_MINUTES = { 1: 5, 7: 30, 30: 120 };

const toTime = (iso) => new Date(iso).getTime();
const fmt = (t, opts) => new Date(t).toLocaleString("uk-UA", opts);

// ---------- Шари поверх графіка ----------

const bandsPlugin = {
  id: "bands",
  beforeDatasetsDraw(chart) {
    const d = state.data;
    if (!d) {
      return;
    }
    const { ctx, chartArea: area, scales: { x } } = chart;
    const periodEnd = toTime(d.to);

    const band = (from, to, color, top, height) => {
      const x1 = Math.max(x.getPixelForValue(from), area.left);
      const x2 = Math.min(x.getPixelForValue(to), area.right);
      if (x2 > x1) {
        ctx.fillStyle = color;
        ctx.fillRect(x1, top, x2 - x1, height);
      }
    };

    ctx.save();

    if (state.layers.outages) {
      visibleOutages().forEach((o) => {
        const from = toTime(o.started_at);
        const to = toTime(o.finished_at);
        band(from, to, "rgba(167,139,250,0.16)", area.top, area.height);
        band(from, to, "rgba(167,139,250,0.75)", area.bottom - 4, 4);
      });
    }

    if (state.layers.alerts) {
      d.alerts.forEach((alert) => {
        const color = alert.alert_level === "yellow" ? "255,200,87" : "255,90,90";
        const from = toTime(alert.started_at);
        const to = alert.finished_at ? toTime(alert.finished_at) : periodEnd;
        band(from, to, `rgba(${color},0.15)`, area.top, area.height);
        band(from, to, `rgba(${color},0.85)`, area.top, 4);
      });
    }

    if (state.layers.incidents) {
      d.incidents.forEach((incident) => {
        const from = toTime(incident.started_at);
        const to = incident.resolved_at ? toTime(incident.resolved_at) : periodEnd;
        band(from, to, "rgba(255,90,90,0.22)", area.top, area.height);

        const px = x.getPixelForValue(from);
        if (px >= area.left && px <= area.right) {
          ctx.strokeStyle = "#ff5a5a";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(px, area.top);
          ctx.lineTo(px, area.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#ff5a5a";
          ctx.font = "600 12px Manrope, sans-serif";
          const label = "Інцидент";
          const width = ctx.measureText(label).width;
          const labelX = px + 6 + width > area.right ? px - 6 - width : px + 6;
          ctx.fillText(label, labelX, area.top + 20);
        }
      });
    }

    ctx.restore();
  },
};

const chart = new Chart(document.getElementById("chart"), {
  type: "line",
  data: {
    datasets: [{
      data: [],
      borderColor: "#5fd4ff",
      borderWidth: 1.6,
      pointRadius: 0,
      tension: 0.25,
      spanGaps: false,
      fill: { target: "origin", above: "rgba(95,212,255,0.06)" },
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => fmt(items[0].parsed.x, {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
          }),
          label: (item) => item.parsed.y + " мс",
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        ticks: {
          color: "#8a97a6",
          maxRotation: 0,
          callback: (v) => (state.days === 1
            ? fmt(v, { hour: "2-digit", minute: "2-digit" })
            : fmt(v, { day: "2-digit", month: "2-digit" })),
        },
        grid: { color: "rgba(143,227,255,0.06)" },
      },
      y: {
        min: 0,
        ticks: { color: "#8a97a6", callback: (v) => v + " мс" },
        grid: { color: "rgba(143,227,255,0.06)" },
      },
    },
  },
  plugins: [bandsPlugin],
});

// ---------- Відображення ----------

// Групує перевірки в проміжки (5 хв / 30 хв / 2 год): середній час відповіді
// працюючих перевірок; якщо в проміжку сервіс жодного разу не відповів — розрив на графіку.
function toChartPoints(checks) {
  const size = BUCKET_MINUTES[state.days] * 60 * 1000;
  const buckets = new Map();
  checks.forEach((check) => {
    const key = Math.floor(toTime(check.checked_at) / size) * size;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(check);
  });

  return [...buckets.entries()].map(([key, group]) => {
    const times = group
      .filter((c) => c.is_up && c.response_time_ms !== null)
      .map((c) => c.response_time_ms);
    return {
      x: key + size / 2,
      y: times.length ? Math.round(times.reduce((sum, ms) => sum + ms, 0) / times.length) : null,
    };
  });
}

function visibleOutages() {
  const outages = state.data ? state.data.outages : [];
  return state.group ? outages.filter((o) => o.group === state.group) : outages;
}

function drawStrip(checks) {
  const strip = document.getElementById("strip");
  const dpr = window.devicePixelRatio || 1;
  strip.width = strip.clientWidth * dpr;
  strip.height = 22 * dpr;
  const ctx = strip.getContext("2d");
  ctx.clearRect(0, 0, strip.width, strip.height);
  if (checks.length === 0) {
    return;
  }

  const from = toTime(state.data.from);
  const to = toTime(state.data.to);
  const scale = strip.width / (to - from);
  checks.forEach((check, i) => {
    const start = toTime(check.checked_at);
    const next = i + 1 < checks.length ? toTime(checks[i + 1].checked_at) : to;
    ctx.fillStyle = check.is_up ? "rgba(61,220,151,0.75)" : "#ff5a5a";
    ctx.fillRect((start - from) * scale, 0, Math.max((next - start) * scale, 1), strip.height);
  });
}

function renderTiles(checks) {
  const up = checks.filter((c) => c.is_up);
  const times = up.map((c) => c.response_time_ms).filter((ms) => ms !== null);
  const down = checks.length - up.length;

  $("#t-uptime").text(checks.length ? ((up.length / checks.length) * 100).toFixed(2) + "%" : "—");
  $("#t-avg").text(times.length ? Math.round(times.reduce((s, ms) => s + ms, 0) / times.length) + " мс" : "—");
  $("#t-checks").text(checks.length.toLocaleString("uk-UA"));
  $("#t-down").text(down * CHECK_INTERVAL_MINUTES);
}

function renderGroups() {
  const groups = [...new Set(state.data.outages.map((o) => o.group))].sort();
  const $select = $("#group-select");
  $select.find("option:not(:first)").remove();
  groups.forEach((g) => $select.append($("<option>").val(g).text("група " + g)));
  if (!groups.includes(state.group)) {
    state.group = "";
  }
  $select.val(state.group);
}

function renderIncidents() {
  const $list = $("#incidents-list").empty();
  if (state.data.incidents.length === 0) {
    $list.append($("<li>").addClass("list__empty").text("Інцидентів за період немає."));
    return;
  }
  state.data.incidents.forEach((incident) => {
    const end = incident.resolved_at
      ? fmt(incident.resolved_at, { hour: "2-digit", minute: "2-digit" })
      : "триває";
    const $title = incident.source_url
      ? $("<a>").attr({ href: incident.source_url, target: "_blank", rel: "noopener" }).text(incident.title)
      : $("<span>").text(incident.title);
    $list.append(
      $("<li>").addClass("list__item incident")
        .append($("<span>").addClass("flag").text("!"))
        .append(
          $("<div>")
            .append($("<p>").addClass("list__title").append($title))
            .append($("<span>").addClass("list__meta").text(
              fmt(incident.started_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) +
              " — " + end,
            )),
        ),
    );
  });
}

function renderLayers() {
  $("[data-legend]").each(function () {
    this.hidden = !state.layers[this.dataset.legend];
  });
  $("#group-select").prop("hidden", !state.layers.outages);
  $("#incidents-block").prop("hidden", !state.layers.incidents);
  chart.update();
}

function render() {
  const d = state.data;
  const checks = d.checks;

  chart.data.datasets[0].data = toChartPoints(checks);
  chart.options.scales.x.min = toTime(d.from);
  chart.options.scales.x.max = toTime(d.to);
  chart.options.scales.x.ticks.stepSize = state.days === 1 ? 3 * HOUR : state.days === 7 ? 24 * HOUR : 5 * 24 * HOUR;

  $("#chart-title").text(d.service.name + " · час відповіді, мс");
  $("#empty-note").prop("hidden", checks.length > 0);

  renderTiles(checks);
  renderGroups();
  renderIncidents();
  renderLayers();
  drawStrip(checks);
}

// ---------- Завантаження ----------

function showError(xhr) {
  const message = xhr.status === 0
    ? "Не вдалося підключитися до API (" + API_BASE + "). Чи запущений бекенд?"
    : (xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error.message : "Помилка " + xhr.status);
  $("#error-banner").text(message).prop("hidden", false);
}

function loadTimeline() {
  if (!state.service) {
    return;
  }
  $.getJSON(API_BASE + "/services/" + state.service + "/timeline/?days=" + state.days)
    .done((data) => {
      $("#error-banner").prop("hidden", true);
      state.data = data;
      render();
    })
    .fail(showError);
}

function loadServices() {
  $.getJSON(API_BASE + "/services/")
    .done((services) => {
      const $row = $("#service-chips");
      services.forEach((service) => {
        $row.append(
          $("<button>").addClass("chip").attr({ type: "button", "data-service": service.slug }).text(service.name),
        );
      });
      if (services.length > 0) {
        selectService(services[0].slug);
      }
    })
    .fail(showError);
}

function selectService(slug) {
  state.service = slug;
  $("[data-service]").each(function () {
    $(this).toggleClass("active", this.dataset.service === slug);
  });
  loadTimeline();
}

$(function () {
  $("#service-chips").on("click", "[data-service]", function () {
    selectService(this.dataset.service);
  });

  $("[data-days]").on("click", function () {
    $("[data-days]").removeClass("active");
    $(this).addClass("active");
    state.days = Number(this.dataset.days);
    loadTimeline();
  });

  $("[data-layer]").on("click", function () {
    const on = this.getAttribute("aria-pressed") !== "true";
    this.setAttribute("aria-pressed", String(on));
    state.layers[this.dataset.layer] = on;
    renderLayers();
  });

  $("#group-select").on("change", function () {
    state.group = this.value;
    chart.update();
  });

  loadServices();
});