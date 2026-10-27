const API_BASE = "http://127.0.0.1:8000/api/v1";
const REFRESH_MS = 60 * 1000;

const STATUS_LABELS = {
  up: "Працює",
  down: "Не працює",
  unknown: "Немає даних",
};

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url;
  }
}


function renderServiceCard(service) {
  const status = service.status || "unknown";
  const uptime = service.uptime_7d;

  const $card = $("<article>").addClass("card");
  if (status === "down") {
    $card.addClass("card--down");
  }

  const $status = $("<span>")
    .addClass("status status--" + status)
    .append($("<span>").addClass("status__dot"))
    .append($("<span>").text(STATUS_LABELS[status]));

  $card.append(
    $("<div>").addClass("card__top")
      .append($("<h3>").addClass("card__name").text(service.name))
      .append($status),
    $("<p>").addClass("card__host").text(hostOf(service.url)),
    $("<div>").addClass("metrics")
      .append(
        $("<div>")
          .append($("<span>").addClass("metric__label").text("Відповідь"))
          .append($("<span>").addClass("metric__value").text(
            service.response_time_ms !== null ? service.response_time_ms + " мс" : "—"
          ))
      )
      .append(
        $("<div>")
          .append($("<span>").addClass("metric__label").text("Uptime 7 днів"))
          .append($("<span>").addClass("metric__value").text(
            uptime !== null ? uptime + "%" : "—"
          ))
      ),
    $("<div>").addClass("uptime-bar").append(
      $("<div>").addClass("uptime-bar__fill").css("width", (uptime || 0) + "%")
    )
  );

  return $card;
}

function renderServices(services) {
  const $list = $("#services-list").empty();
  if (services.length === 0) {
    $list.append($("<p>").addClass("list__empty").text("Сервісів поки немає."));
    return;
  }
  services.forEach((service) => $list.append(renderServiceCard(service)));
}


function renderOutageBanner(activeOutages) {
  const $banner = $("#outage-banner");
  if (activeOutages.length === 0) {
    $banner.removeClass("outage-banner--active");
    $("#outage-text").text("Зараз відключень світла в Києві немає.");
    return;
  }
  const groups = activeOutages.map((outage) => outage.group).join(", ");
  $banner.addClass("outage-banner--active");
  $("#outage-text").text("Зараз без світла в Києві: групи " + groups + ".");
}

function renderOutages(outages) {
  const $list = $("#outages-list").empty();
  if (outages.length === 0) {
    $list.append($("<li>").addClass("list__empty").text("Відключень ще не внесено."));
    return;
  }
  outages.slice(0, 5).forEach((outage) => {
    $list.append(
      $("<li>").addClass("list__item")
        .append(
          $("<p>").addClass("list__title")
            .append($("<span>").addClass("tag tag--warn").text("група " + outage.group))
        )
        .append(
          $("<span>").addClass("list__meta").text(
            formatDateTime(outage.started_at) + " — " + formatTime(outage.finished_at)
          )
        )
    );
  });
}


function renderIncidents(incidents) {
  const $list = $("#incidents-list").empty();
  if (incidents.length === 0) {
    $list.append($("<li>").addClass("list__empty").text("Активних інцидентів немає."));
    return;
  }
  incidents.forEach((incident) => {
    const $title = $("<p>").addClass("list__title");
    if (incident.source_url) {
      $title.append(
        $("<a>").attr({ href: incident.source_url, target: "_blank", rel: "noopener" })
          .text(incident.title)
      );
    } else {
      $title.text(incident.title);
    }

    const $tags = $("<div>");
    incident.services.forEach((slug) => $tags.append($("<span>").addClass("tag").text(slug)));

    $list.append(
      $("<li>").addClass("list__item")
        .append($title)
        .append($tags)
        .append($("<span>").addClass("list__meta").text("з " + formatDateTime(incident.started_at)))
    );
  });
}


function showError(message) {
  $("#error-banner").text(message).prop("hidden", false);
}

function hideError() {
  $("#error-banner").prop("hidden", true);
}

function loadAll() {
  $.when(
    $.getJSON(API_BASE + "/services/"),
    $.getJSON(API_BASE + "/outages/?active=true"),
    $.getJSON(API_BASE + "/outages/"),
    $.getJSON(API_BASE + "/incidents/?active=true")
  )
    .done((servicesRes, activeOutagesRes, outagesRes, incidentsRes) => {
      hideError();
      renderServices(servicesRes[0]);
      renderOutageBanner(activeOutagesRes[0].results);
      renderOutages(outagesRes[0].results);
      renderIncidents(incidentsRes[0].results);
      $("#last-updated").text("Оновлено о " + formatTime(new Date().toISOString()));
    })
    .fail((xhr) => {
      if (xhr.status === 0) {
        showError(
          "Не вдалося підключитися до API (" + API_BASE + "). " +
          "Перевірте, чи запущений бекенд: python manage.py runserver"
        );
      } else {
        const message = xhr.responseJSON && xhr.responseJSON.error
          ? xhr.responseJSON.error.message
          : "Сервер повернув помилку " + xhr.status + ".";
        showError(message);
      }
      $("#last-updated").text("Помилка оновлення");
    });
}

$(function () {
  loadAll();
  setInterval(loadAll, REFRESH_MS);
  $("#reload-button").on("click", loadAll);
});