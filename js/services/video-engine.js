var VideoEngine = (function () {
  var AUTH_OR_UNAVAILABLE_STATUS_CODES = [400, 401, 403, 404, 410, 451];
  var MAX_NETWORK_RETRIES = 3;
  var MAX_MEDIA_RECOVERIES = 2;
  var hls = null;
  var video = null;
  var stateChangeHandler = null;
  var errorHandler = null;
  var retryTimer = null;
  var networkRetries = 0;
  var mediaRecoveries = 0;
  var generation = 0;
  var currentUrl = null;
  var usingNativeHls = false;
  var triedHlsFallback = false;
  var resumeAtLiveEdge = false;
  var hasReportedError = false;

  function isCurrent(token) {
    return token === generation;
  }

  function clearRetryTimer() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function resizeVideo() {
    if (!video) return;
    video.style.width = window.innerWidth + "px";
    video.style.height = window.innerHeight + "px";
  }

  function notifyStateChange() {
    if (stateChangeHandler) stateChangeHandler(getState());
  }

  function reportError(message) {
    if (hasReportedError) return;
    hasReportedError = true;
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (errorHandler) errorHandler(message);
  }

  function isWebOS() {
    var userAgent = (navigator.userAgent || "").toLowerCase();
    return userAgent.indexOf("web0s") !== -1 ||
      userAgent.indexOf("webos") !== -1 ||
      typeof window.PalmSystem !== "undefined";
  }

  function isM3u8(url) {
    return /\.m3u8(?:[?#]|$)/i.test(url);
  }

  function supportsNativeHls() {
    return isWebOS() || !!(
      video &&
      video.canPlayType &&
      video.canPlayType("application/vnd.apple.mpegurl")
    );
  }

  function canUseHlsJs() {
    return !!(window.Hls && Hls.isSupported());
  }

  function playVideo(token) {
    if (!video || !isCurrent(token)) return;
    try {
      var playResult = video.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function (error) {
          if (isCurrent(token)) console.warn("Playback start was blocked:", error);
        });
      }
    } catch (error) {
      console.warn("Playback start failed:", error);
    }
  }

  function clearVideoSource() {
    if (!video) return;
    video.pause();
    video.src = "";
    video.removeAttribute("src");
    video.load();
  }

  function retryDelay(retryNumber) {
    return Math.min(1000 * Math.pow(2, retryNumber - 1), 4000);
  }

  function scheduleNativeRetry(token) {
    if (networkRetries >= MAX_NETWORK_RETRIES) {
      reportError("No se pudo reproducir este canal.");
      return;
    }

    networkRetries += 1;
    clearRetryTimer();
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (!isCurrent(token) || !currentUrl) return;
      clearVideoSource();
      startNativePlayback(currentUrl, token);
    }, retryDelay(networkRetries));
  }

  function handleNativeError() {
    if (!currentUrl || !video || !video.src) return;
    var token = generation;
    var error = video && video.error;
    var code = error ? error.code : 0;
    console.error("Native playback error:", code || "(none)");

    if (code === 2 || code === 3) {
      scheduleNativeRetry(token);
      return;
    }

    if (
      code === 4 &&
      isM3u8(currentUrl) &&
      usingNativeHls &&
      !triedHlsFallback &&
      canUseHlsJs()
    ) {
      triedHlsFallback = true;
      startHlsPlayback(currentUrl, token);
      return;
    }

    reportError("No se pudo reproducir este canal.");
  }

  function startNativePlayback(url, token) {
    if (!video || !isCurrent(token)) return;
    usingNativeHls = isM3u8(url);
    video.src = url;
    video.load();
    playVideo(token);
  }

  function handleHlsError(event, data, token, instance) {
    if (!isCurrent(token) || !data.fatal || hls !== instance) return;

    var statusCode = data.response && data.response.code;
    console.error("Fatal HLS error:", data.type, data.details, statusCode || "");

    if (statusCode && AUTH_OR_UNAVAILABLE_STATUS_CODES.indexOf(statusCode) !== -1) {
      reportError("No se pudo reproducir este canal.");
      return;
    }

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      if (networkRetries >= MAX_NETWORK_RETRIES) {
        reportError("No se pudo reproducir este canal.");
        return;
      }
      networkRetries += 1;
      clearRetryTimer();
      retryTimer = setTimeout(function () {
        retryTimer = null;
        if (isCurrent(token) && hls === instance) instance.startLoad();
      }, retryDelay(networkRetries));
      return;
    }

    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      if (mediaRecoveries < MAX_MEDIA_RECOVERIES) {
        mediaRecoveries += 1;
        instance.recoverMediaError();
        return;
      }
    }

    reportError("No se pudo reproducir este canal.");
  }

  function startHlsPlayback(url, token) {
    if (!video || !isCurrent(token) || !canUseHlsJs()) return;
    if (hls) {
      hls.destroy();
      hls = null;
    }

    var instance = new Hls();
    hls = instance;
    instance.loadSource(url);
    instance.attachMedia(video);
    instance.on(Hls.Events.MANIFEST_PARSED, function () {
      if (isCurrent(token) && hls === instance) playVideo(token);
    });
    instance.on(Hls.Events.ERROR, function (event, data) {
      handleHlsError(event, data, token, instance);
    });
  }

  function isLiveStream() {
    if (hls && typeof hls.liveSyncPosition === "number" &&
      isFinite(hls.liveSyncPosition)) return true;
    if (!video) return false;
    if (video.duration === Infinity) return true;
    if (video.seekable && video.seekable.length) {
      var lastRange = video.seekable.length - 1;
      return video.seekable.start(lastRange) > 0.5 ||
        video.duration > video.seekable.end(lastRange) + 10;
    }
    return false;
  }

  function seekToLiveEdge() {
    if (!video) return;

    var target = null;
    if (hls && typeof hls.liveSyncPosition === "number" &&
      isFinite(hls.liveSyncPosition)) {
      target = hls.liveSyncPosition;
    } else if (video.seekable && video.seekable.length) {
      var lastRange = video.seekable.length - 1;
      target = Math.max(
        video.seekable.start(lastRange),
        video.seekable.end(lastRange) - 2
      );
    }

    if (target === null) return;
    try {
      video.currentTime = target;
    } catch (error) {
      console.warn("Could not seek to the live edge:", error);
    }
  }

  function getCurrentTime() {
    return video ? video.currentTime : 0;
  }

  function getDuration() {
    return video && video.duration || 0;
  }

  function isPlaying() {
    return !!video && !video.paused;
  }

  function isMuted() {
    return !!video && video.muted;
  }

  function getVolume() {
    return video ? video.volume : 0.5;
  }

  function getState() {
    return {
      playing: isPlaying(),
      muted: isMuted(),
      volume: getVolume(),
      currentTime: getCurrentTime(),
      duration: getDuration()
    };
  }

  function resetCurrentPlayback() {
    generation += 1;
    clearRetryTimer();
    currentUrl = null;
    resumeAtLiveEdge = false;
    hasReportedError = false;
    if (hls) {
      hls.destroy();
      hls = null;
    }
    clearVideoSource();
  }

  function detachVideo() {
    if (!video) return;
    video.removeEventListener("play", notifyStateChange);
    video.removeEventListener("pause", notifyStateChange);
    video.removeEventListener("volumechange", notifyStateChange);
    video.removeEventListener("error", handleNativeError);
    video.pause();
    video.src = "";
    video.removeAttribute("src");
    video.load();
    window.removeEventListener("resize", resizeVideo);
    video = null;
  }

  return {
    init: function (element) {
      if (video && video !== element) detachVideo();
      video = element;
      if (!video) return;
      video.addEventListener("play", notifyStateChange);
      video.addEventListener("pause", notifyStateChange);
      video.addEventListener("volumechange", notifyStateChange);
      video.addEventListener("error", handleNativeError);
      resizeVideo();
      window.addEventListener("resize", resizeVideo);
    },

    load: function (url) {
      resetCurrentPlayback();
      networkRetries = 0;
      mediaRecoveries = 0;
      triedHlsFallback = false;
      if (!video) {
        console.error("VideoEngine is not initialized");
        return;
      }

      currentUrl = url;
      var token = generation;
      requestAnimationFrame(resizeVideo);

      if (isM3u8(url) && supportsNativeHls()) {
        startNativePlayback(url, token);
      } else if (isM3u8(url) && canUseHlsJs()) {
        startHlsPlayback(url, token);
      } else if (isM3u8(url)) {
        console.error("HLS playback is not supported on this device");
        reportError("Este dispositivo no soporta reproducción HLS.");
      } else {
        startNativePlayback(url, token);
      }
    },

    destroy: function (preserveHandlers) {
      resetCurrentPlayback();
      if (!preserveHandlers) {
        detachVideo();
        stateChangeHandler = null;
        errorHandler = null;
      }
    },

    togglePlay: function () {
      if (!video) return;
      if (video.paused) {
        if (resumeAtLiveEdge) seekToLiveEdge();
        resumeAtLiveEdge = false;
        playVideo(generation);
      } else {
        resumeAtLiveEdge = isLiveStream();
        video.pause();
      }
    },

    toggleMute: function () {
      if (video) video.muted = !video.muted;
    },

    setVolume: function (volume) {
      if (video) video.volume = Math.max(0, Math.min(1, volume));
    },

    getVolume: getVolume,
    seek: function (time) {
      if (video) video.currentTime = time;
    },
    getCurrentTime: getCurrentTime,
    getDuration: getDuration,
    isPlaying: isPlaying,
    isMuted: isMuted,
    getState: getState,
    onStateChange: function (handler) {
      stateChangeHandler = handler;
    },
    onError: function (handler) {
      errorHandler = handler;
    },
    isWebOS: isWebOS
  };
})();
