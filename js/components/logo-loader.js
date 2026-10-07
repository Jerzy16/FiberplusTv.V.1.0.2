var LogoLoader = (function () {
  var retryDelays = [300, 3000];
  var queue = [];
  var activeLoads = 0;
  var lastLoadStartedAt = 0;
  var pumpTimer = null;
  var failedHosts = Object.create(null);
  var imageCache = Object.create(null);

  function now() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function getHost(url) {
    var match = /^https?:\/\/([^/?#]+)/i.exec(url || "");
    return match ? match[1].toLowerCase() : "";
  }

  function getProxyUrl(url) {
    return "https://imagecdn.app/v2/image/" + encodeURIComponent(url) + "?width=240";
  }

  function markLoaded(image) {
    if (image.parentNode) image.parentNode.className = "channel-card-media has-logo";
  }

  function pump() {
    if (pumpTimer || !queue.length || activeLoads >= 3) return;

    var delay = 120 - (now() - lastLoadStartedAt);
    if (delay > 0) {
      pumpTimer = setTimeout(function () {
        pumpTimer = null;
        pump();
      }, delay);
      return;
    }

    var item = queue.shift();
    if (!item || !document.body.contains(item.image)) {
      pump();
      return;
    }

    load(item);
    pump();
  }

  function queueRetry(item, delay, prioritize) {
    setTimeout(function () {
      if (!document.body.contains(item.image)) {
        pump();
        return;
      }
      if (prioritize) queue.unshift(item);
      else queue.push(item);
      pump();
    }, delay);
  }

  function load(item) {
    var image = item.image;
    var source = item.source;
    var host = getHost(source);
    var tryOriginal = item.attempt === 0 && (failedHosts[host] || 0) < 3;
    var url = tryOriginal ? source : getProxyUrl(source);

    activeLoads += 1;
    lastLoadStartedAt = now();
    imageCache[source] = { status: "loading", url: url };

    image.onload = function () {
      image.onload = null;
      image.onerror = null;
      activeLoads = Math.max(0, activeLoads - 1);
      imageCache[source] = { status: "loaded", url: url };
      if (tryOriginal) failedHosts[host] = 0;
      markLoaded(image);
      pump();
    };

    image.onerror = function () {
      image.onload = null;
      image.onerror = null;
      activeLoads = Math.max(0, activeLoads - 1);
      if (tryOriginal) failedHosts[host] = (failedHosts[host] || 0) + 1;

      var retryDelay = retryDelays[item.attempt];
      item.attempt += 1;
      if (typeof retryDelay === "number") {
        queueRetry(item, retryDelay, item.attempt === 1);
      } else {
        imageCache[source] = { status: "failed", url: null };
      }
      pump();
    };

    image.src = url;
  }

  function useCachedImage(image, source, cached) {
    if (cached.status === "failed") return;
    image.onload = function () {
      image.onload = null;
      image.onerror = null;
      markLoaded(image);
    };
    image.onerror = function () {
      image.onload = null;
      image.onerror = null;
      if (imageCache[source] === cached) delete imageCache[source];
      image.logoQueued = false;
      enqueueImage(image);
    };
    image.src = cached.url;
    if (cached.status === "loaded" && image.complete && image.naturalWidth) {
      markLoaded(image);
    }
  }

  function enqueueImage(image) {
    if (image.logoQueued) return;
    var source = image.getAttribute("data-logo");
    if (!source) return;

    image.logoQueued = true;
    var cached = imageCache[source];
    if (cached) {
      useCachedImage(image, source, cached);
      return;
    }

    queue.push({ image: image, source: source, attempt: 0 });
    pump();
  }

  return {
    enqueue: function (container) {
      if (!container || !container.querySelectorAll) return;
      var images = container.querySelectorAll("img[data-logo]");
      for (var index = 0; index < images.length; index += 1) {
        enqueueImage(images[index]);
      }
      pump();
    }
  };
})();
