var LoginPage = (function () {
  function root() {
    return document.getElementById("login-page-body");
  }

  function handleKey(event) {
    SpatialNav.handleKey(event, root());
  }

  async function verifyCredentials(provider) {
    var username = document.getElementById("login-user").value.trim();
    var password = document.getElementById("login-pass").value.trim();
    if (!username || !password) return;

    var card = document.querySelector(".login-card");
    card.innerHTML = StateMessage.loading("Verificando credenciales...");
    SpatialNav.ensureFocus(root());

    try {
      var channels = await IptvService.fetchForProvider(provider, {
        username: username,
        password: password
      });
      if (!channels.length) {
        throw new Error("No se encontraron canales para estas credenciales");
      }

      AuthService.saveSession(provider.id, {
        username: username,
        password: password
      });
      AuthService.saveChannels(provider.id, channels);
      Store.setChannels(provider.id, channels);
      Router.navigate("#home/" + provider.id);
    } catch (error) {
      card.innerHTML = StateMessage.error(
        "Error al iniciar sesión: " + error.message
      ) + '<div class="state-actions"><button class="btn btn-primary" onclick="LoginPage.render(\'' +
        Utils.escapeAttr(provider.id) + "')\">Reintentar</button></div>";
      SpatialNav.ensureFocus(root());
    }
  }

  function render(providerId) {
    var provider = Providers.getById(providerId);
    if (!provider) {
      Router.navigate("#login/fiberplus");
      return;
    }
    if (!provider.requiresAuth) {
      Router.navigate("#home/" + provider.id);
      return;
    }

    if (typeof VideoEngine !== "undefined") VideoEngine.destroy();
    Store.setBackRoute("#login/fiberplus");
    Store.setOnBack(function () {});
    Store.setNavHandler(handleKey);
    SpatialNav.clear();
    document.getElementById("app").innerHTML =
      '<div class="login-page" id="login-page-body"><div class="login-card">' +
      '<div class="login-avatar">' + ProviderCard.logoFor(provider) + "</div>" +
      "<p>Ingresa tus credenciales para acceder</p>" +
      '<form id="login-form">' +
      '<input type="text" id="login-user" class="input" placeholder="Ingresa tu usuario" autocomplete="username" />' +
      '<input type="password" id="login-pass" class="input" placeholder="Ingresa tu contraseña" autocomplete="current-password" />' +
      '<button type="submit" class="btn btn-primary">Iniciar Sesion</button>' +
      "</form></div></div>";

    document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      verifyCredentials(provider);
    });
    SpatialNav.focusFirst(root());
  }

  return { render: render };
})();
