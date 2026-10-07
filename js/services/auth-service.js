var AuthService = (function () {
  function sessionKey(providerId) {
    return "fiberplus_session_" + providerId;
  }

  function channelsKey(providerId) {
    return "fiberplus_channels_" + providerId;
  }

  function readSession(providerId) {
    try {
      var value = localStorage.getItem(sessionKey(providerId));
      if (!value) return null;

      var session = JSON.parse(value);
      if (
        !session ||
        session.provider !== providerId ||
        typeof session.username !== "string" ||
        !session.username ||
        typeof session.password !== "string" ||
        !session.password
      ) {
        return null;
      }
      return session;
    } catch (error) {
      console.error("Could not read saved IPTV credentials:", error);
      return null;
    }
  }

  function clearSession(providerId) {
    try {
      localStorage.removeItem(sessionKey(providerId));
      localStorage.removeItem(channelsKey(providerId));
    } catch (error) {
      console.error("Could not clear saved IPTV session:", error);
    }
  }

  return {
    isLoggedIn: function (providerId) {
      return !!readSession(providerId);
    },

    saveSession: function (providerId, credentials) {
      var session = {
        username: credentials.username,
        password: credentials.password,
        provider: providerId
      };
      localStorage.setItem(sessionKey(providerId), JSON.stringify(session));
    },

    getSession: readSession,
    clearSession: clearSession,

    clearAllSessions: function () {
      Providers.getAll().forEach(function (provider) {
        clearSession(provider.id);
      });
    },

    saveChannels: function (providerId, channels) {
      localStorage.setItem(channelsKey(providerId), JSON.stringify(channels));
    },

    getStoredChannels: function (providerId) {
      try {
        var value = localStorage.getItem(channelsKey(providerId));
        if (!value) return null;
        var channels = JSON.parse(value);
        if (!Array.isArray(channels)) {
          console.error("Saved IPTV channel data is not a list.");
          return null;
        }
        return channels;
      } catch (error) {
        console.error("Could not read saved IPTV channels:", error);
        return null;
      }
    }
  };
})();
