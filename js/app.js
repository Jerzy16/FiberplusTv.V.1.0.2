var App = {
  init: function () {
    Keyboard.init();
    if (typeof webOS !== "undefined") {
      try {
        var deviceInfo = webOS.deviceInfo;
        console.log("webOS TV:", deviceInfo.modelName || deviceInfo.platformVersion || "");
      } catch (error) {
        console.warn("Could not read webOS device information:", error);
      }
    }

    Router.register("login/:providerId", function (route) {
      LoginPage.render(route.providerId);
    });
    Router.register("home/:providerId", function (route) {
      HomePage.render(route.providerId);
    });
    Router.register("player/:providerId/:url", function (route) {
      PlayerPage.render(route.providerId, route.url);
    });

    window.location.hash = getStartupRoute();
    SplashPage.render();
    setTimeout(function () {
      Router.start();
    }, 1600);
  },

  openProvider: function (providerId) {
    var provider = Providers.getById(providerId);
    if (!provider) return;
    Router.navigate(
      provider.requiresAuth && !AuthService.isLoggedIn(providerId)
        ? "#login/" + providerId
        : "#home/" + providerId
    );
  },

  playChannelAt: function (index) {
    var channel = Store.getChannelAt(index);
    if (channel && channel.url) {
      Router.navigate(
        "#player/" + Store.get().providerId + "/" + encodeURIComponent(channel.url)
      );
    }
  },

  exitPlayer: function () {
    Router.navigate(Store.get().backRoute || "#login/fiberplus");
  },

  logout: function (providerId) {
    if (providerId) {
      AuthService.clearSession(providerId);
      Store.clearLastChannel(providerId);
    } else {
      AuthService.clearAllSessions();
      Providers.getAll().forEach(function (provider) {
        Store.clearLastChannel(provider.id);
      });
    }
    Store.clearCache();
    Router.navigate("#login/fiberplus");
  }
};

function getStartupRoute() {
  var providers = Providers.getAll();
  for (var index = 0; index < providers.length; index += 1) {
    var provider = providers[index];
    if (provider.requiresAuth && AuthService.isLoggedIn(provider.id)) {
      return "#home/" + provider.id;
    }
  }
  return "#login/fiberplus";
}

document.addEventListener("DOMContentLoaded", function () {
  App.init();
});