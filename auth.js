const AUTH_URL = "http://127.0.0.1:8000/api/v1/auth";
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USERNAME_KEY = "username";


function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

function saveTokens(access, refresh) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
}

function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

function isLoggedIn() {
  return getRefreshToken() !== null;
}


let refreshRequest = null;

function refreshAccessToken() {
  if (refreshRequest === null) {
    refreshRequest = $.ajax({
      method: "POST",
      url: AUTH_URL + "/token/refresh/",
      contentType: "application/json",
      data: JSON.stringify({ refresh: getRefreshToken() }),
      dataType: "json",
    })
      .then(function (data) {
        saveTokens(data.access);
      })
      .always(function () {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

function apiRequest(method, url, data) {
  function send() {
    const settings = { method: method, url: url, dataType: "json", headers: {} };

    const token = getAccessToken();
    if (token) {
      settings.headers.Authorization = "Bearer " + token;
    }
    if (data !== undefined) {
      settings.contentType = "application/json";
      settings.data = JSON.stringify(data);
    }
    return $.ajax(settings);
  }

  return send().catch(function (xhr) {
    if (xhr.status !== 401 || !getAccessToken()) {
      return $.Deferred().reject(xhr);
    }

    return refreshAccessToken().then(send, function () {
      clearTokens();
      return send();
    });
  });
}

function apiErrorMessage(xhr) {
  if (xhr.responseJSON && xhr.responseJSON.error) {
    return xhr.responseJSON.error.message;
  }
  return "Сервер недоступний. Перевірте, чи запущено бекенд.";
}

function login(username, password) {
  return $.ajax({
    method: "POST",
    url: AUTH_URL + "/token/",
    contentType: "application/json",
    data: JSON.stringify({ username: username, password: password }),
    dataType: "json",
  }).then(function (data) {
    saveTokens(data.access, data.refresh);
    localStorage.setItem(USERNAME_KEY, username);
  });
}

function logout() {
  clearTokens();
  window.location.href = "index.html";
}

function currentPage() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  return page + window.location.search;
}

function nextPage() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && /^[\w-]+\.html(\?.*)?$/.test(next)) {
    return next;
  }
  return "index.html";
}

function goToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent(currentPage());
}

function requireLogin() {
  if (!isLoggedIn()) {
    goToLogin();
    return false;
  }
  return true;
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.replace(nextPage());
  }
}

function renderAuthHeader() {
  const $area = $("#auth-area");
  if ($area.length === 0) {
    return;
  }
  $area.empty();

  if (!isLoggedIn()) {
    $area.append(
      $("<a>")
        .addClass("button")
        .attr("href", "login.html?next=" + encodeURIComponent(currentPage()))
        .text("Увійти")
    );
    return;
  }

  const $name = $("<span>")
    .addClass("auth-user")
    .text(localStorage.getItem(USERNAME_KEY) || "...");
  const $logout = $("<button>")
    .addClass("button")
    .attr("type", "button")
    .text("Вийти")
    .on("click", logout);
  $area.append($name, $logout);

  apiRequest("GET", AUTH_URL + "/me/").then(
    function (user) {
      localStorage.setItem(USERNAME_KEY, user.username);
      $name.text(user.username);
    },
    function () {
      if (!isLoggedIn()) {
        renderAuthHeader();
      }
    }
  );
}

$(renderAuthHeader);